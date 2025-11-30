# Stock Transfer Workflow Fixes

## Goal
Fix the "Connection Error" issues, resolve the ambiguous button states (Approve/Receive both visible), and refine the stock transfer workflow as requested.

## User Review Required
> [!IMPORTANT]
> **Workflow Changes**:
> - **Hub-to-Hub**: Requires Approval (Pharmacist at Dest) -> In Transit -> Receive (at Dest).
> - **Hub-to-Remote**: In Transit -> Receive (at Dest).
> - **Ward-to-Ward / Hub-to-Ward**: Immediate Completion.

> [!WARNING]
> **Database Logic Fix**:
> - The current backend allows "Receiving" a transfer even if the status update fails (e.g., if it's not IN_TRANSIT). I will add strict checks to ensure the transfer status is valid before moving stock.

## Proposed Changes

### Backend (`server.py`)

#### [MODIFY] [server.py](file:///c:/Stock%20rotation/server.py)
- **`get_transfers`**: Join with `locations` table to return `from_location_type` and `to_location_type`. This allows the frontend to correctly identify Hub-to-Hub transfers.
- **`handle_transfer_action`**:
    - **`approve`**: Ensure status is `PENDING`. Check `rowcount` to confirm update.
    - **`complete`**: Ensure status is `IN_TRANSIT`. Check `rowcount` to confirm update. **Critical Fix**: Do not move vials if transfer update fails.
    - **`cancel`**: Ensure status is `PENDING`.

### Frontend (`StockTransfer.jsx`)

#### [MODIFY] [StockTransfer.jsx](file:///c:/Stock%20rotation/frontend/src/components/StockTransfer.jsx)
- **Button Logic**:
    - Calculate `isHubToHub` based on location types.
    - `needsApproval` = `isHubToHub`.
    - **Approve Button**: Show if `status === 'PENDING'` AND `needsApproval` AND `user.location_id === to_location_id` AND `isPharmacist`.
    - **Receive Button**: Show if `status === 'IN_TRANSIT'` AND `user.location_id === to_location_id`. (Also allow if PENDING & !needsApproval, but Hub-to-Remote starts as IN_TRANSIT anyway).
- **Styling**:
    - Change "Approve" button from Maroon to Indigo/Blue with iconto distinguish from "Cancel" (often red) or "Action Required".
- **Error Handling**:
    - Improve `handleAction` error logging to console for debugging "Connection Error".

## Verification Plan

### Automated Tests
- Create `tests/test_transfer_logic.py`:
    - Test Hub-to-Hub flow: Create -> PENDING -> Approve -> IN_TRANSIT -> Receive -> COMPLETED.
    - Test Hub-to-Remote flow: Create -> IN_TRANSIT -> Receive -> COMPLETED.
    - Test Invalid Actions: Try to Receive a PENDING Hub-to-Hub transfer (should fail).

### Manual Verification
1.  **Login as Port Augusta Pharmacist (Source Hub)**.
2.  Create Transfer to Whyalla Hospital (Dest Hub).
3.  Verify status is **PENDING**.
4.  Verify **NO** Approve/Receive buttons are visible for the sender (or maybe Cancel is visible).
5.  **Login as Whyalla Pharmacist (Dest Hub)**.
6.  Go to Pending Transfers.
7.  Verify **Approve** button is visible (Blue). **Receive** button is **HIDDEN**.
8.  Click **Approve**.
9.  Verify status changes to **IN_TRANSIT**.
10. Verify **Approve** button is **HIDDEN**. **Receive** button is **VISIBLE** (Green).
11. Click **Receive**.
12. Verify transfer moves to History (COMPLETED).
