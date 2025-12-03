"""
Transfer routes
Creating, approving, completing, cancelling transfers
"""
from flask import Blueprint, request, jsonify, current_app
from models.database import get_session
from models.schemas import TransferCreate, TransferAction
from services.transfer_service import TransferService

bp = Blueprint('transfers', __name__)


@bp.route('/create_transfer', methods=['POST'])
def create_transfer():
    """Create a new transfer"""
    try:
        data = TransferCreate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = TransferService(session)
        success, result = service.create_transfer(data)

        if success:
            return jsonify({'success': True, **result})
        else:
            return jsonify({'success': False, **result}), 400
    finally:
        session.close()


@bp.route('/transfer/<int:transfer_id>/approve', methods=['POST'])
def approve_transfer(transfer_id):
    """Approve a pending transfer"""
    try:
        data = TransferAction(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = TransferService(session)
        success, result = service.approve_transfer(transfer_id, data)

        if success:
            return jsonify({'success': True, **result})
        else:
            if result.get('error') == 'CONFLICT':
                return jsonify(result), 409
            return jsonify(result), 400
    finally:
        session.close()


@bp.route('/transfer/<int:transfer_id>/complete', methods=['POST'])
def complete_transfer(transfer_id):
    """Complete a transfer"""
    try:
        data = TransferAction(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = TransferService(session)
        success, result = service.complete_transfer(transfer_id, data)

        if success:
            return jsonify({'success': True, **result})
        else:
            if result.get('error') == 'CONFLICT':
                return jsonify(result), 409
            return jsonify(result), 400
    finally:
        session.close()


@bp.route('/transfer/<int:transfer_id>/cancel', methods=['POST'])
def cancel_transfer(transfer_id):
    """Cancel a transfer"""
    try:
        data = TransferAction(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = TransferService(session)
        success, result = service.cancel_transfer(transfer_id, data)

        if success:
            return jsonify({'success': True, **result})
        else:
            if result.get('error') == 'CONFLICT':
                return jsonify(result), 409
            return jsonify(result), 400
    finally:
        session.close()


@bp.route('/transfers/<int:location_id>', methods=['GET'])
def get_transfers(location_id):
    """Get all transfers for a location"""
    session = get_session(current_app.engine)
    try:
        service = TransferService(session)
        transfers = service.get_transfers(location_id)
        return jsonify(transfers)
    finally:
        session.close()
