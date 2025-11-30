import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"

def make_request(url, method='GET', data=None):
    try:
        req = urllib.request.Request(url, method=method)
        req.add_header('Content-Type', 'application/json')
        
        if data:
            json_data = json.dumps(data).encode('utf-8')
            req.data = json_data
            
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode())
        except:
            return {"error": str(e)}
    except Exception as e:
        return {"error": str(e)}

def login(username, password):
    res = make_request(f"{BASE_URL}/login", 'POST', {"username": username, "password": password})
    if not res.get('user'):
        print(f"Login failed for {username}. Response: {res}")
    return res.get('user')

def create_transfer(user, from_loc, to_loc, vial_ids):
    return make_request(f"{BASE_URL}/create_transfer", 'POST', {
        "from_location_id": from_loc,
        "to_location_id": to_loc,
        "vial_ids": vial_ids,
        "created_by": user['id']
    })

def get_transfers(location_id):
    return make_request(f"{BASE_URL}/transfers/{location_id}")

def action_transfer(transfer_id, action, user):
    transfers = get_transfers(user['location_id'])
    transfer = next((t for t in transfers if t['id'] == transfer_id), None)
    
    if not transfer:
        print(f"Transfer {transfer_id} not found for user {user['username']}")
        return None

    return make_request(f"{BASE_URL}/transfer/{transfer_id}/{action}", 'POST', {
        "user_id": user['id'],
        "version": transfer['version']
    })

def run_test():
    print("--- Starting Stock Transfer Workflow Test (urllib) ---")

    # 1. Setup Users
    admin = login("admin", "admin123")
    if not admin:
        print("Failed to login as admin")
        return

    locations = make_request(f"{BASE_URL}/locations")
    whyalla = next((l for l in locations if l['name'] == 'Whyalla Hospital Pharmacy'), None)
    port_augusta = next((l for l in locations if l['name'] == 'Port Augusta Hospital Pharmacy'), None)
    
    if not whyalla or not port_augusta:
        print("Hubs not found")
        return

    print(f"Port Augusta ID: {port_augusta['id']}, Whyalla ID: {whyalla['id']}")

    # Create/Get Whyalla User
    whyalla_user = login("whyalla_pharm", "password123")
    
    if not whyalla_user:
        print("Creating Whyalla Pharmacist...")
        make_request(f"{BASE_URL}/users", 'POST', {
            "username": "whyalla_pharm",
            "password": "password123",
            "role": "PHARMACIST",
            "location_id": whyalla['id'],
            "email": "whyalla@test.com"
        })
        whyalla_user = login("whyalla_pharm", "password123")

    if not whyalla_user:
        print("Failed to create/login Whyalla user")
        return

    # 2. Ensure Stock at Port Augusta
    drugs = make_request(f"{BASE_URL}/drugs")
    if not drugs:
        print("No drugs found")
        return
    drug = drugs[0]
    
    print(f"Receiving stock of {drug['name']} at Port Augusta...")
    receive_res = make_request(f"{BASE_URL}/receive_stock", 'POST', {
        "drug_id": drug['id'],
        "batch_number": "TEST-BATCH-001",
        "expiry_date": "2025-12-31",
        "quantity": 1,
        "location_id": port_augusta['id'],
        "user_id": admin['id']
    })
    
    stock = make_request(f"{BASE_URL}/stock/{port_augusta['id']}")
    created_asset_id = receive_res['asset_ids'][0]
    vial = next((v for v in stock if v['asset_id'] == created_asset_id), None)
    
    if not vial:
        print("Failed to find created vial")
        return
    vial_id = vial['id']
    print(f"Vial ID: {vial_id}")

    # 3. Create Transfer: Port Augusta -> Whyalla (Hub-to-Hub)
    print("\n[Step 1] Creating Hub-to-Hub Transfer...")
    create_res = create_transfer(admin, port_augusta['id'], whyalla['id'], [vial_id])
    
    if not create_res.get('success'):
        print(f"Failed to create transfer: {create_res}")
        return
        
    transfer_id = create_res['transfer_id']
    print(f"Transfer Created: ID {transfer_id}")
    print(f"Needs Approval: {create_res.get('needs_approval')}")
    print(f"Status: {create_res.get('status')}")

    if create_res.get('status') != 'PENDING':
        print("ERROR: Hub-to-Hub transfer should be PENDING")
        return

    # 4. Verify Whyalla User sees it and can Approve
    print("\n[Step 2] Whyalla User Approving...")
    # Try to approve with Admin (Should Fail)
    fail_res = action_transfer(transfer_id, 'approve', admin)
    if fail_res and fail_res.get('success'):
        print("ERROR: Admin (Port Augusta) approved transfer to Whyalla!")
        return
    else:
        print("Verified: Admin cannot approve transfer to other hub.")

    # Approve with Whyalla User
    approve_res = action_transfer(transfer_id, 'approve', whyalla_user)
    if not approve_res or not approve_res.get('success'):
        print(f"Whyalla user failed to approve: {approve_res}")
        return
    print("Transfer Approved by Whyalla User")

    # Verify Status is IN_TRANSIT
    transfers = get_transfers(whyalla['id'])
    transfer = next((t for t in transfers if t['id'] == transfer_id), None)
    if transfer['status'] != 'IN_TRANSIT':
        print(f"ERROR: Status should be IN_TRANSIT, got {transfer['status']}")
        return
    print("Status Verified: IN_TRANSIT")

    # 5. Receive Transfer
    print("\n[Step 3] Receiving Transfer...")
    receive_res = action_transfer(transfer_id, 'complete', whyalla_user)
    if not receive_res or not receive_res.get('success'):
        print(f"Failed to receive: {receive_res}")
        return
    print("Transfer Received")

    # Verify Status is COMPLETED
    transfers = get_transfers(whyalla['id'])
    transfer = next((t for t in transfers if t['id'] == transfer_id), None)
    if transfer['status'] != 'COMPLETED':
        print(f"ERROR: Status should be COMPLETED, got {transfer['status']}")
        return
    print("Status Verified: COMPLETED")

    print("\n--- Test Passed Successfully ---")

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"Test failed with exception: {e}")
