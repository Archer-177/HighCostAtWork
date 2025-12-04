"""
Transfer Service - Business logic for stock transfers
Handles complex approval workflows and stock movement
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Tuple, Optional
import json

from models.database import (
    Transfer, TransferItem, Vial, Location, User, AuditLog
)
from models.schemas import TransferCreate, TransferAction, TransferStatus, VialStatus
from utils.helpers import (
    determine_transfer_status, requires_approval, can_user_approve_transfer,
    can_transfer_between_locations, get_adelaide_now
)


class TransferService:
    """Service for transfer management operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # CREATE TRANSFER
    # ========================================================================
    def create_transfer(self, data: TransferCreate) -> Tuple[bool, dict]:
        """
        Create a new transfer

        Determines initial status based on location types:
        - Hub -> Own Ward: COMPLETED (immediate)
        - Hub -> Hub (different): PENDING (needs approval)
        - Other: IN_TRANSIT

        Returns:
            (success, result_dict)
        """
        try:
            # Get location details
            from_location = self.db.query(Location).filter_by(
                id=data.from_location_id, is_active=True
            ).first()
            to_location = self.db.query(Location).filter_by(
                id=data.to_location_id, is_active=True
            ).first()

            if not from_location or not to_location:
                return False, {"error": "Invalid location(s)"}

            # Determine hub IDs for validation
            from_hub_id = from_location.parent_hub_id or (
                from_location.id if from_location.type == 'HUB' else None
            )
            to_hub_id = to_location.parent_hub_id or (
                to_location.id if to_location.type == 'HUB' else None
            )

            # Validate transfer is allowed by business rules
            can_transfer, error_msg = can_transfer_between_locations(
                from_location.type,
                to_location.type,
                from_hub_id,
                to_hub_id,
                from_location.id,
                to_location.id
            )

            if not can_transfer:
                return False, {"error": error_msg}

            # Check if all vials are available and at from_location
            vials = self.db.query(Vial).filter(
                and_(
                    Vial.id.in_(data.vial_ids),
                    Vial.location_id == data.from_location_id,
                    Vial.status == VialStatus.AVAILABLE
                )
            ).all()

            if len(vials) != len(data.vial_ids):
                return False, {"error": "Some vials are not available at source location"}

            initial_status = determine_transfer_status(
                from_location.type,
                to_location.type,
                from_hub_id,
                to_hub_id
            )

            needs_approval_flag = requires_approval(
                from_location.type,
                to_location.type,
                from_hub_id,
                to_hub_id
            )

            # Create transfer
            transfer = Transfer(
                from_location_id=data.from_location_id,
                to_location_id=data.to_location_id,
                status=initial_status,
                created_by=data.created_by,
                created_at=get_adelaide_now()
            )

            # If immediate completion
            if initial_status == TransferStatus.COMPLETED:
                transfer.completed_at = get_adelaide_now()
                transfer.completed_by = data.created_by

            self.db.add(transfer)
            self.db.flush()  # Get transfer ID

            # Add transfer items
            for vial_id in data.vial_ids:
                transfer_item = TransferItem(
                    transfer_id=transfer.id,
                    vial_id=vial_id
                )
                self.db.add(transfer_item)

                # Update vial status based on initial status
                vial = self.db.query(Vial).filter_by(id=vial_id).first()
                if initial_status == TransferStatus.COMPLETED:
                    # Immediate transfer (Ward → Ward same hub) - move to destination
                    vial.location_id = data.to_location_id
                    vial.status = VialStatus.AVAILABLE
                # If PENDING_APPROVAL, leave vials as AVAILABLE at source
                # They will be updated when transfer is approved

                vial.version += 1

            # Log action
            audit_log = AuditLog(
                user_id=data.created_by,
                action='CREATE_TRANSFER',
                entity_type='transfer',
                entity_id=transfer.id,
                details=json.dumps({
                    'from_location': from_location.name,
                    'to_location': to_location.name,
                    'vial_count': len(data.vial_ids),
                    'status': initial_status,
                    'needs_approval': needs_approval_flag
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {
                "transfer_id": transfer.id,
                "status": initial_status,
                "needs_approval": needs_approval_flag,
                "item_count": len(data.vial_ids)
            }

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # APPROVE TRANSFER
    # ========================================================================
    def approve_transfer(
        self,
        transfer_id: int,
        data: TransferAction
    ) -> Tuple[bool, dict]:
        """
        Approve a pending transfer

        Only pharmacists with can_delegate can approve
        Changes status from PENDING_APPROVAL -> IN_TRANSIT
        Updates vial status to IN_TRANSIT
        """
        try:
            # Get transfer with optimistic lock
            transfer = self.db.query(Transfer).filter_by(id=transfer_id).first()
            if not transfer:
                return False, {"error": "Transfer not found"}

            # Version check
            if transfer.version != data.version:
                return False, {
                    "error": "CONFLICT",
                    "message": "Transfer was modified. Please refresh."
                }

            # Status check
            if transfer.status != TransferStatus.PENDING_APPROVAL:
                return False, {"error": f"Transfer is {transfer.status}, cannot approve"}

            # Get user info
            user = self.db.query(User).filter_by(id=data.user_id).first()
            if not user:
                return False, {"error": "User not found"}

            # Get creator info
            creator = self.db.query(User).filter_by(id=transfer.created_by).first()

            # Permission check
            can_approve, error_msg = can_user_approve_transfer(
                user.location_id,
                user.role,
                user.can_delegate,
                creator.location_id,
                transfer.from_location_id,
                transfer.to_location_id
            )

            if not can_approve:
                return False, {"error": error_msg}

            # Cannot self-approve
            if data.user_id == transfer.created_by:
                return False, {"error": "Cannot approve your own transfer"}

            # Update transfer
            transfer.status = TransferStatus.IN_TRANSIT
            transfer.approved_by = data.user_id
            transfer.approved_at = get_adelaide_now()
            transfer.version += 1

            # Update vial statuses
            vial_ids = [item.vial_id for item in transfer.items]
            self.db.query(Vial).filter(Vial.id.in_(vial_ids)).update(
                {Vial.status: VialStatus.IN_TRANSIT, Vial.version: Vial.version + 1},
                synchronize_session=False
            )

            # Log action
            audit_log = AuditLog(
                user_id=data.user_id,
                action='APPROVE_TRANSFER',
                entity_type='transfer',
                entity_id=transfer.id,
                details=json.dumps({
                    'approved_by': user.username,
                    'vial_count': len(vial_ids)
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {"transfer_id": transfer.id, "status": TransferStatus.IN_TRANSIT}

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # COMPLETE TRANSFER
    # ========================================================================
    def complete_transfer(
        self,
        transfer_id: int,
        data: TransferAction
    ) -> Tuple[bool, dict]:
        """
        Complete a transfer in IN_TRANSIT status

        Moves vials to destination location
        Changes status to COMPLETED
        """
        try:
            transfer = self.db.query(Transfer).filter_by(id=transfer_id).first()
            if not transfer:
                return False, {"error": "Transfer not found"}

            # Version check
            if transfer.version != data.version:
                return False, {
                    "error": "CONFLICT",
                    "message": "Transfer was modified. Please refresh."
                }

            # Status check
            if transfer.status != TransferStatus.IN_TRANSIT:
                return False, {"error": f"Transfer is {transfer.status}, cannot complete"}

            # Update transfer
            transfer.status = TransferStatus.COMPLETED
            transfer.completed_at = get_adelaide_now()
            transfer.completed_by = data.user_id
            transfer.version += 1

            # Move vials to destination
            vial_ids = [item.vial_id for item in transfer.items]
            self.db.query(Vial).filter(Vial.id.in_(vial_ids)).update(
                {
                    Vial.status: VialStatus.AVAILABLE,
                    Vial.location_id: transfer.to_location_id,
                    Vial.version: Vial.version + 1
                },
                synchronize_session=False
            )

            # Log action
            audit_log = AuditLog(
                user_id=data.user_id,
                action='COMPLETE_TRANSFER',
                entity_type='transfer',
                entity_id=transfer.id,
                details=json.dumps({
                    'vial_count': len(vial_ids),
                    'destination': transfer.to_location.name
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {"transfer_id": transfer.id, "status": TransferStatus.COMPLETED}

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # CANCEL TRANSFER
    # ========================================================================
    def cancel_transfer(
        self,
        transfer_id: int,
        data: TransferAction
    ) -> Tuple[bool, dict]:
        """
        Cancel a pending transfer

        Returns vials to AVAILABLE at source location
        """
        try:
            transfer = self.db.query(Transfer).filter_by(id=transfer_id).first()
            if not transfer:
                return False, {"error": "Transfer not found"}

            # Version check
            if transfer.version != data.version:
                return False, {
                    "error": "CONFLICT",
                    "message": "Transfer was modified. Please refresh."
                }

            # Can only cancel PENDING or IN_TRANSIT
            if transfer.status not in [TransferStatus.PENDING, TransferStatus.IN_TRANSIT]:
                return False, {"error": f"Cannot cancel {transfer.status} transfer"}

            # Update transfer
            transfer.status = TransferStatus.CANCELLED
            transfer.version += 1

            # Return vials to source
            vial_ids = [item.vial_id for item in transfer.items]
            self.db.query(Vial).filter(Vial.id.in_(vial_ids)).update(
                {
                    Vial.status: VialStatus.AVAILABLE,
                    Vial.location_id: transfer.from_location_id,
                    Vial.version: Vial.version + 1
                },
                synchronize_session=False
            )

            # Log action
            audit_log = AuditLog(
                user_id=data.user_id,
                action='CANCEL_TRANSFER',
                entity_type='transfer',
                entity_id=transfer.id,
                details=json.dumps({
                    'vial_count': len(vial_ids),
                    'reason': 'User cancelled'
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {"transfer_id": transfer.id, "status": TransferStatus.CANCELLED}

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # GET TRANSFERS
    # ========================================================================
    def get_transfers(self, location_id: int) -> List[dict]:
        """
        Get all transfers involving a location

        Returns enriched transfer data with user names, item details, etc.
        """
        transfers = self.db.query(Transfer).options(
            joinedload(Transfer.from_location),
            joinedload(Transfer.to_location),
            joinedload(Transfer.creator),
            joinedload(Transfer.approver),
            joinedload(Transfer.completer),
            joinedload(Transfer.items).joinedload(TransferItem.vial).joinedload(Vial.drug)
        ).filter(
            or_(
                Transfer.from_location_id == location_id,
                Transfer.to_location_id == location_id
            )
        ).order_by(Transfer.created_at.desc()).all()

        result = []
        for transfer in transfers:
            # Build item list
            items = []
            for transfer_item in transfer.items:
                vial = transfer_item.vial
                from utils.helpers import days_until_expiry, get_status_color

                items.append({
                    'id': vial.id,
                    'asset_id': vial.asset_id,
                    'drug_name': vial.drug.name,
                    'category': vial.drug.category,
                    'batch_number': vial.batch_number,
                    'expiry_date': vial.expiry_date.isoformat(),
                    'days_until_expiry': days_until_expiry(vial.expiry_date),
                    'status_color': get_status_color(vial.expiry_date)
                })

            transfer_dict = {
                'id': transfer.id,
                'from_location_id': transfer.from_location_id,
                'from_location_name': transfer.from_location.name,
                'from_location_type': transfer.from_location.type,
                'to_location_id': transfer.to_location_id,
                'to_location_name': transfer.to_location.name,
                'to_location_type': transfer.to_location.type,
                'status': transfer.status,
                'created_by': transfer.created_by,
                'creator_username': transfer.creator.username,
                'approved_by': transfer.approved_by,
                'approver_username': transfer.approver.username if transfer.approver else None,
                'completed_by': transfer.completed_by,
                'completer_username': transfer.completer.username if transfer.completer else None,
                'created_at': transfer.created_at.isoformat(),
                'approved_at': transfer.approved_at.isoformat() if transfer.approved_at else None,
                'completed_at': transfer.completed_at.isoformat() if transfer.completed_at else None,
                'version': transfer.version,
                'item_count': len(items),
                'items': items
            }
            result.append(transfer_dict)

        return result
