import urllib.request
import json
import urllib.error

BASE_URL = "http://127.0.0.1:5000"

def login(username, password):
    print(f"Attempting login for: {username}")
    payload = {"username": username, "password": password}
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/api/login", 
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req) as response:
            print(f"Login Success: {response.status}")
            return True
    except urllib.error.HTTPError as e:
        print(f"Login Failed: {e.code} - {e.read().decode()}")
        return False

def test_soft_delete():
    # 1. Create a user
    username = "soft_delete_user"
    password = "password"
    
    print("Creating user...")
    try:
        req = urllib.request.Request(
            f"{BASE_URL}/api/users", 
            data=json.dumps({
                "username": username, "password": password, "role": "NURSE", "location_id": 1, "email": "sd@test.com"
            }).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        urllib.request.urlopen(req)
    except: pass # User might exist

    # 2. Get User ID
    print("Getting user ID...")
    with urllib.request.urlopen(f"{BASE_URL}/api/users") as response:
        users = json.loads(response.read().decode())
        user = next((u for u in users if u['username'] == username), None)
        if not user:
            print("User creation failed or user not found.")
            return
        user_id = user['id']
        print(f"User ID: {user_id}")

    # 3. Verify Login (Should succeed)
    print("Verifying initial login...")
    if not login(username, password):
        print("Initial login failed!")
        return

    # 4. Delete User (Soft Delete)
    print("Deleting user...")
    req = urllib.request.Request(
        f"{BASE_URL}/api/users/{user_id}", 
        method='DELETE'
    )
    urllib.request.urlopen(req)

    # 5. Verify Login (Should fail)
    print("Verifying login after deletion...")
    if login(username, password):
        print("Login succeeded after deletion! (FAIL)")
    else:
        print("Login failed after deletion (SUCCESS)")

    # 6. Verify List (Should be gone)
    print("Verifying user list...")
    with urllib.request.urlopen(f"{BASE_URL}/api/users") as response:
        users = json.loads(response.read().decode())
        user = next((u for u in users if u['username'] == username), None)
        if user:
            print("User still in list! (FAIL)")
        else:
            print("User gone from list (SUCCESS)")

if __name__ == "__main__":
    test_soft_delete()
