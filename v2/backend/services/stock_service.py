"""
Stock Service - Business logic for stock operations
Separated from routes for better testing and reusability
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from datetime import date, datetime
from typing import List, Optional, Tuple
import json

from models.database import Vial, Drug, Location, User, AuditLog, StockLevel
from models.schemas import VialCreate, VialUse, VialDiscard, VialStatus, StockSearchRequest
from utils.helpers import (
    generate_asset_id, days_until_expiry, get_status_color,
    get_adelaide_now, calculate_stock_value
)


class StockService:
    """Service for stock management operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # RECEIVE STOCK
    # ========================================================================
    def receive_stock(
        self,
        data: VialCreate,
        user_id: int
    ) -> Tuple[bool, dict]:
        """
        Receive stock from supplier

        Creates multiple vial records with unique asset IDs
        Logs the action for audit
        Returns list of generated asset IDs

        Args:
            data: VialCreate schema with quantity
            user_id: ID of user receiving the stock

        Returns:
            (success, result_dict)
        """
        try:
            # Get drug and location info
            drug = self.db.query(Drug).filter_by(id=data.drug_id, is_active=True).first()
            if not drug:
                return False, {"error": "Drug not found or inactive"}

            location = self.db.query(Location).filter_by(id=data.location_id, is_active=True).first()
            if not location:
                return False, {"error": "Location not found or inactive"}

            # Generate asset IDs and create vials
            asset_ids = []
            timestamp = int(get_adelaide_now().timestamp())

            for i in range(data.quantity):
                # Generate unique asset ID
                asset_id = generate_asset_id(
                    drug.name,
                    location.name,
                    timestamp + i  # Ensure uniqueness
                )

                # Create vial
                vial = Vial(
                    asset_id=asset_id,
                    drug_id=data.drug_id,
                    batch_number=data.batch_number,
                    expiry_date=data.expiry_date,
                    location_id=data.location_id,
                    goods_receipt_number=data.goods_receipt_number,
                    status=VialStatus.AVAILABLE,
                    created_at=get_adelaide_now()
                )
                self.db.add(vial)
                asset_ids.append(asset_id)

            # Log the action
            audit_log = AuditLog(
                user_id=user_id,
                action='RECEIVE_STOCK',
                entity_type='vial',
                details=json.dumps({
                    'drug_id': data.drug_id,
                    'drug_name': drug.name,
                    'location_id': data.location_id,
                    'location_name': location.name,
                    'batch_number': data.batch_number,
                    'quantity': data.quantity,
                    'goods_receipt_number': data.goods_receipt_number,
                    'asset_ids': asset_ids[:5]  # Store first 5 for reference
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {
                "asset_ids": asset_ids,
                "drug_name": drug.name,
                "location_name": location.name,
                "total_value": drug.unit_price * data.quantity,
                "quantity": data.quantity
            }

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # USE STOCK (CLINICAL)
    # ========================================================================
    def use_stock(self, data: VialUse) -> Tuple[bool, dict]:
        """
        Mark vial as used for clinical purposes

        Implements optimistic locking via version check
        Checks if stock falls below minimum levels
        Logs the action

        Returns:
            (success, result_dict with needs_notification flag)
        """
        try:
            # Get vial with version lock
            vial = self.db.query(Vial).filter_by(id=data.vial_id).first()
            if not vial:
                return False, {"error": "Vial not found"}

            # Optimistic locking check
            if vial.version != data.version:
                return False, {
                    "error": "CONFLICT",
                    "message": "Vial was modified by another user. Please refresh."
                }

            # Status check
            if vial.status != VialStatus.AVAILABLE:
                return False, {"error": f"Vial is already {vial.status}"}

            # Update vial
            vial.status = VialStatus.USED_CLINICAL
            vial.patient_mrn = data.patient_mrn
            vial.clinical_notes = data.clinical_notes
            vial.used_at = get_adelaide_now()
            vial.used_by = data.user_id
            vial.version += 1

            # Check if stock is below minimum
            stock_info = self._check_stock_level(vial.location_id, vial.drug_id)

            # Log action
            audit_log = AuditLog(
                user_id=data.user_id,
                action='USE_STOCK',
                entity_type='vial',
                entity_id=vial.id,
                details=json.dumps({
                    'asset_id': vial.asset_id,
                    'patient_mrn': data.patient_mrn,
                    'clinical_notes': data.clinical_notes
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {
                "needs_notification": stock_info['is_below_minimum'],
                "stock_info": stock_info
            }

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # DISCARD STOCK
    # ========================================================================
    def discard_stock(self, data: VialDiscard) -> Tuple[bool, dict]:
        """
        Mark vial as discarded (wastage)

        Similar to use_stock but for wastage tracking
        """
        try:
            vial = self.db.query(Vial).filter_by(id=data.vial_id).first()
            if not vial:
                return False, {"error": "Vial not found"}

            # Optimistic locking
            if vial.version != data.version:
                return False, {
                    "error": "CONFLICT",
                    "message": "Vial was modified by another user. Please refresh."
                }

            if vial.status != VialStatus.AVAILABLE:
                return False, {"error": f"Vial is already {vial.status}"}

            # Update vial
            vial.status = VialStatus.DISCARDED
            vial.discard_reason = data.discard_reason.value
            vial.disposal_register_number = data.disposal_register_number
            vial.used_at = get_adelaide_now()
            vial.used_by = data.user_id
            vial.version += 1

            # Check stock level
            stock_info = self._check_stock_level(vial.location_id, vial.drug_id)

            # Log action
            audit_log = AuditLog(
                user_id=data.user_id,
                action='DISCARD_STOCK',
                entity_type='vial',
                entity_id=vial.id,
                details=json.dumps({
                    'asset_id': vial.asset_id,
                    'discard_reason': data.discard_reason.value,
                    'disposal_register_number': data.disposal_register_number
                }),
                timestamp=get_adelaide_now()
            )
            self.db.add(audit_log)

            self.db.commit()

            return True, {
                "needs_notification": stock_info['is_below_minimum'],
                "stock_info": stock_info
            }

        except Exception as e:
            self.db.rollback()
            return False, {"error": str(e)}

    # ========================================================================
    # GET STOCK (WITH FILTERS)
    # ========================================================================
    def get_stock(
        self,
        user_role: str,
        user_location_id: int,
        filters: Optional[StockSearchRequest] = None
    ) -> List[dict]:
        """
        Get stock with filters and role-based access

        PHARMACIST/PHARMACY_TECH: See all locations
        NURSE: See only their location

        Returns enriched vial data with drug/location info
        """
        query = self.db.query(Vial).options(
            joinedload(Vial.drug),
            joinedload(Vial.location)
        )

        # Role-based filtering
        if user_role == 'NURSE':
            query = query.filter(Vial.location_id == user_location_id)

        # Apply filters if provided
        if filters:
            if filters.query:
                search_term = f"%{filters.query}%"
                query = query.join(Drug).join(Location).filter(
                    or_(
                        Vial.asset_id.ilike(search_term),
                        Vial.batch_number.ilike(search_term),
                        Drug.name.ilike(search_term),
                        Location.name.ilike(search_term)
                    )
                )

            if filters.status:
                query = query.filter(Vial.status == filters.status)

            if filters.location_id:
                query = query.filter(Vial.location_id == filters.location_id)

            if filters.drug_id:
                query = query.filter(Vial.drug_id == filters.drug_id)

            if filters.expiry_before:
                query = query.filter(Vial.expiry_date <= filters.expiry_before)

            if filters.expiry_after:
                query = query.filter(Vial.expiry_date >= filters.expiry_after)

            # Pagination
            query = query.limit(filters.limit).offset(filters.offset)
        else:
            # Default: Only available stock, ordered by expiry
            query = query.filter(Vial.status == VialStatus.AVAILABLE)
            query = query.order_by(Vial.expiry_date.asc())

        vials = query.all()

        # Enrich with computed fields
        result = []
        for vial in vials:
            vial_dict = {
                'id': vial.id,
                'asset_id': vial.asset_id,
                'drug_id': vial.drug_id,
                'drug_name': vial.drug.name,
                'category': vial.drug.category,
                'storage_temp': vial.drug.storage_temp,
                'unit_price': vial.drug.unit_price,
                'batch_number': vial.batch_number,
                'expiry_date': vial.expiry_date.isoformat(),
                'location_id': vial.location_id,
                'location_name': vial.location.name,
                'location_type': vial.location.type,
                'status': vial.status,
                'goods_receipt_number': vial.goods_receipt_number,
                'patient_mrn': vial.patient_mrn,
                'clinical_notes': vial.clinical_notes,
                'discard_reason': vial.discard_reason,
                'disposal_register_number': vial.disposal_register_number,
                'created_at': vial.created_at.isoformat(),
                'used_at': vial.used_at.isoformat() if vial.used_at else None,
                'used_by': vial.used_by,
                'version': vial.version,
                # Computed fields
                'days_until_expiry': days_until_expiry(vial.expiry_date),
                'status_color': get_status_color(vial.expiry_date)
            }
            result.append(vial_dict)

        return result

    # ========================================================================
    # GET DASHBOARD DATA
    # ========================================================================
    def get_dashboard_data(self, user_id: int) -> dict:
        """
        Get comprehensive dashboard data for user

        Includes:
        - Stock list (filtered by role)
        - Statistics (total, expiring, etc.)
        - Total value
        """
        user = self.db.query(User).filter_by(id=user_id).first()
        if not user:
            return {"error": "User not found"}

        # Get stock based on role
        stock = self.get_stock(user.role, user.location_id)

        # Calculate statistics
        stats = {
            'total_stock': len(stock),
            'healthy_stock': sum(1 for s in stock if s['status_color'] == 'green'),
            'warning_stock': sum(1 for s in stock if s['status_color'] == 'amber'),
            'expiring_soon': sum(1 for s in stock if s['status_color'] == 'red'),
            'total_value': sum(s['unit_price'] for s in stock)
        }

        return {
            'user': user,
            'stock': stock,
            'stats': stats
        }

    # ========================================================================
    # STOCK JOURNEY
    # ========================================================================
    def get_stock_journey(self, asset_id: str) -> Optional[dict]:
        """
        Get complete journey/timeline of a vial

        Returns vial details and timeline of all events
        """
        vial = self.db.query(Vial).options(
            joinedload(Vial.drug),
            joinedload(Vial.location)
        ).filter_by(asset_id=asset_id).first()

        if not vial:
            return None

        timeline = []

        # 1. Creation event
        creator_log = self.db.query(AuditLog).filter(
            and_(
                AuditLog.action == 'RECEIVE_STOCK',
                AuditLog.details.contains(asset_id)
            )
        ).first()

        timeline.append({
            'type': 'CREATED',
            'timestamp': vial.created_at.isoformat(),
            'title': 'Stock Received',
            'location': vial.location.name,
            'user': creator_log.user.username if creator_log else 'System',
            'details': {
                'Batch': vial.batch_number,
                'Expiry': vial.expiry_date.isoformat(),
                'Goods Receipt': vial.goods_receipt_number
            }
        })

        # 2. Transfer events (TODO: Implement when transfer service is created)

        # 3. Final event (if used/discarded)
        if vial.status == VialStatus.USED_CLINICAL:
            user = self.db.query(User).filter_by(id=vial.used_by).first()
            timeline.append({
                'type': 'USED',
                'timestamp': vial.used_at.isoformat(),
                'title': 'Clinical Use',
                'location': vial.location.name,
                'user': user.username if user else 'Unknown',
                'details': {
                    'Patient MRN': vial.patient_mrn,
                    'Notes': vial.clinical_notes
                }
            })
        elif vial.status == VialStatus.DISCARDED:
            user = self.db.query(User).filter_by(id=vial.used_by).first()
            timeline.append({
                'type': 'DISCARDED',
                'timestamp': vial.used_at.isoformat(),
                'title': 'Stock Discarded',
                'location': vial.location.name,
                'user': user.username if user else 'Unknown',
                'details': {
                    'Reason': vial.discard_reason,
                    'Register #': vial.disposal_register_number
                }
            })

        # Sort by timestamp (newest first)
        timeline.sort(key=lambda x: x['timestamp'], reverse=True)

        return {
            'vial': {
                'id': vial.id,
                'asset_id': vial.asset_id,
                'drug_name': vial.drug.name,
                'category': vial.drug.category,
                'storage_temp': vial.drug.storage_temp,
                'batch_number': vial.batch_number,
                'expiry_date': vial.expiry_date.isoformat(),
                'status': vial.status,
                'location_name': vial.location.name
            },
            'timeline': timeline
        }

    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    def _check_stock_level(self, location_id: int, drug_id: int) -> dict:
        """
        Check if available stock is below minimum level

        Returns dict with stock info and alert flag
        """
        # Get available count
        available_count = self.db.query(func.count(Vial.id)).filter(
            and_(
                Vial.location_id == location_id,
                Vial.drug_id == drug_id,
                Vial.status == VialStatus.AVAILABLE
            )
        ).scalar()

        # Get minimum stock level
        stock_level = self.db.query(StockLevel).filter_by(
            location_id=location_id,
            drug_id=drug_id
        ).first()

        min_stock = stock_level.min_stock if stock_level else 0

        # Get drug and location names
        drug = self.db.query(Drug).filter_by(id=drug_id).first()
        location = self.db.query(Location).filter_by(id=location_id).first()

        return {
            'available_count': available_count,
            'min_stock': min_stock,
            'is_below_minimum': available_count < min_stock,
            'drug_name': drug.name if drug else 'Unknown',
            'location_name': location.name if location else 'Unknown'
        }
