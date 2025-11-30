import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"

def login(username, password):
    response = requests.post(f"{BASE_URL}/login", json={
        "username": username,
        "password": password
    })
    if response.status_code == 200:
        return response.json()['user']
    return None

def create_transfer(from_loc, to_loc, vial_ids, user_id):
    response = requests.post(f"{BASE_URL}/create_transfer", json={
        "from_location_id": from_loc,
        "to_location_id": to_loc,
        "vial_ids": vial_ids,
        "created_by": user_id
    })
    return response.json()

def get_transfer(transfer_id, location_id):
    # This is a bit indirect as we don't have a get_transfer_by_id endpoint, 
    # so we list transfers for a location and find it.
    response = requests.get(f"{BASE_URL}/transfers/{location_id}")
    transfers = response.json()
    for t in transfers:
        if t['id'] == transfer_id:
            return t
    return None

def perform_action(transfer_id, action, user_id, version):
    response = requests.post(f"{BASE_URL}/transfer/{transfer_id}/{action}", json={
        "user_id": user_id,
        "version": version
    })
    return response

def run_tests():
    print("--- Starting Transfer Workflow Tests ---")

    # 1. Setup Users
    # Assuming standard seed data:
    # Admin (PA Hub)
    admin = login("admin", "admin123")
    if not admin:
        print("FATAL: Could not login as admin")
        return

    # Create a Whyalla Pharmacist
    requests.post(f"{BASE_URL}/users", json={
        "username": "whyalla_pharm",
        "password": "password123",
        "role": "PHARMACIST",
        "location_id": 2, # Whyalla Hub
        "email": "whyalla@test.com"
    })
    whyalla_pharm = login("whyalla_pharm", "password123")

    # Create a Remote User (Roxby)
    # First find Roxby ID
    locs = requests.get(f"{BASE_URL}/locations").json()
    roxby_id = next(l['id'] for l in locs if l['name'] == 'Roxby Downs')
    
    requests.post(f"{BASE_URL}/users", json={
        "username": "roxby_nurse",
        "password": "password123",
        "role": "NURSE",
        "location_id": roxby_id,
        "email": "roxby@test.com"
    })
    roxby_user = login("roxby_nurse", "password123")

    # 2. Get some stock to transfer
    stock = requests.get(f"{BASE_URL}/stock/{admin['location_id']}").json()
    if not stock:
        print("FATAL: No stock at PA Hub to transfer")
        return
    
    vial_1 = stock[0]['id']
    vial_2 = stock[1]['id'] if len(stock) > 1 else stock[0]['id']

    # --- TEST CASE 1: Hub-to-Hub (PA -> Whyalla) ---
    print("\n[TEST 1] Hub-to-Hub Transfer (Approval Required)")
    
    # Create
    print("Creating transfer...")
    res = create_transfer(admin['location_id'], whyalla_pharm['location_id'], [vial_1], admin['id'])
    transfer_id = res['transfer_id']
    print(f"Transfer {transfer_id} created. Status: {res['status']} (Expected: PENDING)")
    
    if res['status'] != 'PENDING':
        print("FAIL: Hub-to-Hub should be PENDING")
        return

    # Verify State
    t = get_transfer(transfer_id, admin['location_id'])
    
    # Try to Receive (Should Fail)
    print("Attempting to Receive before Approval (Should Fail)...")
    res = perform_action(transfer_id, 'complete', whyalla_pharm['id'], t['version'])
    if res.status_code != 200:
        print("PASS: Receive failed as expected")
    else:
        print("FAIL: Receive succeeded but should have failed")

    # Approve
    print("Approving transfer...")
    res = perform_action(transfer_id, 'approve', whyalla_pharm['id'], t['version'])
    if res.status_code == 200:
        print("PASS: Approval successful")
    else:
        print(f"FAIL: Approval failed: {res.text}")
        return

    # Verify Status
    t = get_transfer(transfer_id, admin['location_id'])
    if t['status'] == 'IN_TRANSIT':
        print("PASS: Status is IN_TRANSIT")
    else:
        print(f"FAIL: Status is {t['status']}, expected IN_TRANSIT")

    # Receive
    print("Receiving transfer...")
    res = perform_action(transfer_id, 'complete', whyalla_pharm['id'], t['version'])
    if res.status_code == 200:
        print("PASS: Receive successful")
    else:
        print(f"FAIL: Receive failed: {res.text}")

    # Verify Completed
    t = get_transfer(transfer_id, admin['location_id'])
    if t['status'] == 'COMPLETED':
        print("PASS: Status is COMPLETED")
    else:
        print(f"FAIL: Status is {t['status']}, expected COMPLETED")


    # --- TEST CASE 2: Hub-to-Remote (PA -> Roxby) ---
    print("\n[TEST 2] Hub-to-Remote Transfer (No Approval)")
    
    # Create
    print("Creating transfer...")
    res = create_transfer(admin['location_id'], roxby_id, [vial_2], admin['id'])
    transfer_id = res['transfer_id']
    print(f"Transfer {transfer_id} created. Status: {res['status']} (Expected: IN_TRANSIT)")
    
    if res['status'] != 'IN_TRANSIT':
        print("FAIL: Hub-to-Remote should be IN_TRANSIT")
        return

    # Verify State
    t = get_transfer(transfer_id, admin['location_id'])

    # Receive
    print("Receiving transfer...")
    res = perform_action(transfer_id, 'complete', roxby_user['id'], t['version'])
    if res.status_code == 200:
        print("PASS: Receive successful")
    else:
        print(f"FAIL: Receive failed: {res.text}")

    # Verify Completed
    t = get_transfer(transfer_id, admin['location_id'])
    if t['status'] == 'COMPLETED':
        print("PASS: Status is COMPLETED")
    else:
        print(f"FAIL: Status is {t['status']}, expected COMPLETED")

    print("\n--- All Tests Completed ---")

if __name__ == "__main__":
    run_tests()
