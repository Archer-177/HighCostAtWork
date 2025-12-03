# FUNLHN Medicine Tracker

A comprehensive High-Cost Medicine Management System for the Flinders Upper North Local Health Network (FUNLHN). This application serves as a "Single Source of Truth" for tracking high-value inventory across the Hub-and-Spoke hospital network, preventing wastage and ensuring accountability.

## Key Features

### 📦 Inventory Management
- **Real-time Tracking**: Track individual vials with unique Asset IDs (e.g., `RIT-WHY-1733205-1`).
- **Stock Journey**: Visualize the complete lifecycle of a medicine vial from receipt to disposal/use.
- **Expiry Management**: Visual indicators (Green/Amber/Red) for expiry status to facilitate stock rotation.
- **Stock Rotation**: Seamlessly transfer stock between Hub pharmacies (Port Augusta, Whyalla) and remote sites.
- **Tracking Numbers**: Record "iPharmacy Goods Receipt Number" on intake and "Disposal Register Number" on discard.

### 🔍 Enhanced Search & Visibility
- **Global Search**: Find items by Asset ID, Drug Name, Batch Number, or Status.
- **Timeline View**: Detailed chronological history of every action taken on a vial.
- **Adelaide Time**: All timestamps are localized to Adelaide time (ACDT/ACST).

### 🏥 Network Architecture
- **Hub Pharmacies**: Port Augusta Hospital, Whyalla Hospital.
- **Wards**: Port Augusta ED, Whyalla HDU, Whyalla ED.
- **Remote Sites**: Roxby Downs, Quorn, Hawker, Leigh Creek, Oodnadatta.

### 👥 Role-Based Access Control
The system supports three distinct user roles with specific permissions:

1.  **Pharmacist (Admin/Supervisor)**
    *   **Access**: Global view of all locations.
    *   **Capabilities**:
        *   Manage Drug Catalog, Locations, and Users.
        *   Approve stock transfers (e.g., Hub-to-Hub transfers).
        *   View financial and usage reports.
        *   Override stock levels and correct data.
    *   **Supervisor**: Can delegate permissions and manage other users.

2.  **Pharmacy Technician**
    *   **Access**: All locations.
    *   **Capabilities**:
        *   **Receive Stock**: Enter new stock into the system (requires Goods Receipt #).
        *   **Create Transfers**: Initiate stock movement between locations.
        *   View basic stock reports.

3.  **Nurse / Clinical Staff**
    *   **Access**: Local view only (their assigned ward/location).
    *   **Capabilities**:
        *   **Clinical Use**: Record usage for a patient (requires MRN).
        *   **Discard Stock**: Record wastage (requires Reason & Disposal Register #).
        *   View current stock levels at their location.
    *   **Restrictions**: Cannot receive new stock or initiate transfers.

## Workflows

### 1. Receiving Stock
*   **Role**: Pharmacist / Pharmacy Tech
*   **Action**: Scan manufacturer barcode, enter Batch/Expiry, and "iPharmacy Goods Receipt Number".
*   **Result**: System generates unique Asset IDs and prints QR code labels.

### 2. Stock Transfer
*   **Hub-to-Ward**: Immediate transfer (e.g., Whyalla Pharmacy -> Whyalla ED).
*   **Hub-to-Hub**: Requires approval.
    *   *Initiator*: Creates transfer request.
    *   *Receiver*: Must "Approve" the transfer to accept stock into their inventory.
*   **Tracking**: "In Transit" status prevents double-counting.

### 3. Clinical Use
*   **Role**: Nurse / Pharmacist
*   **Action**: Scan QR code, select "Clinical Use", enter Patient MRN and Notes.
*   **Result**: Item marked as `USED_CLINICAL`, removed from available inventory.

### 4. Discarding Stock
*   **Role**: Nurse / Pharmacist
*   **Action**: Scan QR code, select "Discard", enter Reason and "Disposal Register Number".
*   **Result**: Item marked as `DISCARDED`, removed from inventory.

## Technical Stack

-   **Frontend**: React 18, Tailwind CSS, Framer Motion, Lucide Icons.
-   **Backend**: Python Flask (REST API).
-   **Database**: SQLite (File-based, portable).
-   **Timezone**: Server-side enforcement of Adelaide Local Time.

## Deployment Instructions

### Prerequisites
-   Python 3.9+
-   Node.js 16+ (for development)
-   Network drive with read/write access

### Build Steps
1.  Clone the repository.
2.  Run the build script:
    ```batch
    build.bat
    ```
    This compiles the React frontend and packages the Python backend into a single executable.

### Network Deployment
1.  Create a folder on the network drive (e.g., `\\Server\Share\MedicineTracker\`).
2.  Copy the `dist` contents (executable and `_internal` folder) to a hidden `_system_data` subfolder.
3.  Create a shortcut to the executable in the main folder.
4.  **Data Persistence**: The `sys_data.db` file will be created automatically in the same directory as the executable. Ensure all users have **Read/Write** permissions to this folder.

## Support

For technical issues, contact the FUNLHN IT Support team.

---
© 2025 Flinders Upper North Local Health Network. All rights reserved.
