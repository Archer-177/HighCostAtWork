# Stock Transfer Workflow Verification

## Changes Implemented

### Backend (`server.py`)
- **Strict Status Validation**: `handle_transfer_action` now enforces strict state checks (e.g., can only `approve` if `PENDING`, can only `complete` if `IN_TRANSIT`).
- **Atomic Updates**: Uses `rowcount` to ensure no race conditions occur during status updates.
- **Location Types**: `get_transfers` now returns `from_location_type` and `to_location_type` to support frontend logic.

### Frontend (`StockTransfer.jsx`)
- **Hub-to-Hub Logic**:
    - **Approve Button**: Only visible for **PENDING** transfers between **two HUBs**, and only for a **Pharmacist** at the **Destination Hub**.
    - **Receive Button**: Only visible for **IN_TRANSIT** transfers (which happens after approval for Hub-to-Hub, or immediately for Hub-to-Remote).
- **Styling**: "Approve" button is now **Indigo/Blue** with a checkmark icon. "Receive" is **Green**. "Cancel" is **Gray/Red**.
- **Error Handling**: Improved error logging for "Connection Error" debugging.

## Manual Verification Steps

> [!IMPORTANT]
> Please restart `server.py` to ensure the backend changes are loaded.

### Scenario 1: Hub-to-Hub Transfer (Approval Required)
1.  **Login** as **Port Augusta Pharmacist** (Source).
2.  **Create Transfer** to **Whyalla Hospital Pharmacy** (Destination).
    - Select "Port Augusta Hospital Pharmacy".
    - Select "Whyalla Hospital Pharmacy".
    - Select an item and click "Create Transfer".
3.  **Verify**:
    - Status should be **PENDING**.
    - **NO** "Approve" or "Receive" buttons should be visible for you.
4.  **Logout** and **Login** as **Whyalla Pharmacist** (Destination).
5.  Go to **Stock Transfer** -> **Pending Transfers**.
6.  **Verify**:
    - You see the transfer.
    - **"Approve"** button (Blue) is **VISIBLE**.
    - "Receive" button is **HIDDEN**.
7.  Click **Approve**.
8.  **Verify**:
    - Status changes to **IN_TRANSIT**.
    - "Approve" button disappears.
    - **"Receive"** button (Green) appears.
9.  Click **Receive**.
10. **Verify**:
    - Transfer moves to **Transfer History**.
    - Status is **COMPLETED**.

### Scenario 2: Hub-to-Remote Transfer (No Approval)
1.  **Login** as **Port Augusta Pharmacist**.
2.  **Create Transfer** to a Remote Site (e.g., **Roxby Downs**).
3.  **Verify**:
    - Status is immediately **IN_TRANSIT**.
    - "Receive" button is **HIDDEN** (unless you login as Roxby user).
4.  (Optional) Login as Roxby user and click **Receive** to complete.

### Scenario 3: Ward Transfer (Immediate)
1.  **Create Transfer** from **Port Augusta Hub** to **Port Augusta ED** (Ward).
2.  **Verify**:
    - Transfer is immediately **COMPLETED** and appears in History.

## Site Supervisor Role Verification

### Overview
A new **Site Supervisor** permission has been added. Only users with this flag (and Pharmacist role) can access **Settings** and **Min Stock Levels**.

### Verification Steps
1.  **Login** as an existing Admin/Supervisor (e.g. `admin`).
2.  Go to **Settings** -> **Users**.
3.  **Create/Edit User**:
    - Create a new Pharmacist user (e.g. `supervisor_user`).
    - Check the **"Site Supervisor"** checkbox.
    - Save.
4.  **Logout** and **Login** as the new `supervisor_user`.
5.  **Verify**:
    - **Settings** and **Min Stock Levels** appear in the side menu.
    - You can access these pages.
6.  **Logout** and **Login** as a regular Pharmacist (without the flag).
7.  **Verify**:
    - **Settings** and **Min Stock Levels** are **HIDDEN** from the side menu.

