"""
Stock management routes
Receiving, using, discarding stock
"""
from flask import Blueprint, request, jsonify, current_app
from models.database import get_session
from models.schemas import VialCreate, VialUse, VialDiscard, StockSearchRequest
from services.stock_service import StockService

bp = Blueprint('stock', __name__)


@bp.route('/dashboard/<int:user_id>', methods=['GET'])
def get_dashboard(user_id):
    """Get dashboard data for user"""
    session = get_session(current_app.engine)
    try:
        service = StockService(session)
        data = service.get_dashboard_data(user_id)
        return jsonify(data)
    finally:
        session.close()


@bp.route('/receive_stock', methods=['POST'])
def receive_stock():
    """Receive stock from supplier"""
    try:
        data = VialCreate(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = StockService(session)
        success, result = service.receive_stock(data, request.json.get('user_id'))

        if success:
            return jsonify({'success': True, **result})
        else:
            return jsonify({'success': False, **result}), 400
    finally:
        session.close()


@bp.route('/use_stock', methods=['POST'])
def use_stock():
    """Mark stock as used (clinical)"""
    try:
        data = VialUse(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = StockService(session)
        success, result = service.use_stock(data)

        if success:
            return jsonify({'success': True, **result})
        else:
            if result.get('error') == 'CONFLICT':
                return jsonify(result), 409
            return jsonify(result), 400
    finally:
        session.close()


@bp.route('/discard_stock', methods=['POST'])
def discard_stock():
    """Mark stock as discarded"""
    try:
        data = VialDiscard(**request.json)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    session = get_session(current_app.engine)
    try:
        service = StockService(session)
        success, result = service.discard_stock(data)

        if success:
            return jsonify({'success': True, **result})
        else:
            if result.get('error') == 'CONFLICT':
                return jsonify(result), 409
            return jsonify(result), 400
    finally:
        session.close()


@bp.route('/stock_search', methods=['GET'])
def stock_search():
    """Search stock with filters"""
    try:
        filters = StockSearchRequest(
            query=request.args.get('query'),
            status=request.args.get('status'),
            location_id=request.args.get('location_id', type=int),
            drug_id=request.args.get('drug_id', type=int),
            limit=request.args.get('limit', 50, type=int),
            offset=request.args.get('offset', 0, type=int)
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    # Get user info from request (in production, this would be from session/JWT)
    user_role = request.args.get('user_role', 'PHARMACIST')
    user_location_id = request.args.get('user_location_id', 1, type=int)

    session = get_session(current_app.engine)
    try:
        service = StockService(session)
        stock = service.get_stock(user_role, user_location_id, filters)
        return jsonify(stock)
    finally:
        session.close()


@bp.route('/stock_journey/<asset_id>', methods=['GET'])
def stock_journey(asset_id):
    """Get stock journey/timeline"""
    session = get_session(current_app.engine)
    try:
        service = StockService(session)
        journey = service.get_stock_journey(asset_id)

        if journey:
            return jsonify(journey)
        else:
            return jsonify({'error': 'Asset not found'}), 404
    finally:
        session.close()
