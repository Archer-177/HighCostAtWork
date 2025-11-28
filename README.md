# FUNLHN Medicine Tracker

A comprehensive High-Cost Medicine Management System for the Flinders Upper North Local Health Network.

## Features

- **Real-time Inventory Tracking**: Track individual vials with unique Asset IDs
- **Expiry Management**: Visual indicators (Green/Amber/Red) for expiry status
- **Stock Rotation**: Facilitate movement between Hub pharmacies and remote sites
- **QR Code Integration**: Generate and scan QR codes for each medicine unit
- **Financial Reporting**: Track usage vs wastage with detailed cost analysis
- **Multi-Location Support**: Hub-and-Spoke network architecture
- **Role-Based Access**: Different permissions for Pharmacists, Pharmacy Techs, and Nurses

## System Architecture

### Network Structure
- **Hub Pharmacies**: Port Augusta Hospital, Whyalla Hospital
- **Wards**: Port Augusta ED, Whyalla HDU, Whyalla ED
- **Remote Sites**: Roxby Downs, Quorn, Hawker, Leigh Creek, Oodnadatta

### User Roles
1. **Pharmacist (Admin)**
   - Global view of all locations
   - Can manage catalog, locations, and users
   - Approve transfers between Whyalla and other sites
   - View financial reports

2. **Pharmacy Technician**
   - Can receive stock and create transfers
   - View basic reports
   - Access to all locations

3. **Nurse**
   - Local view only (own location)
   - Can use and discard stock
   - Cannot transfer or receive stock

## Technical Stack

- **Frontend**: React 18, Tailwind CSS, Framer Motion
- **Backend**: Python Flask
- **Database**: SQLite (file-based)
- **Deployment**: PyInstaller (portable executable)
- **Barcode**: QR code generation for Zebra printers

## Deployment Instructions

### Prerequisites
- Python 3.9+
- Node.js 16+
- Network drive with read/write access
- No admin rights required

### Build Steps

1. Clone the repository to a local folder
2. Run the build script:
   ```batch
   build.bat
   ```

### Network Deployment

1. Create folder structure on network drive:
   ```
   \\Server\Share\MedicineTracker\
   ├── 🚀 Launch Medicine Tracker.lnk
   └── 📁 _system_data (hidden)
        ├── FUNLHN_Medicine_Tracker.exe
        ├── sys_data.dat
        └── backups\
   ```

2. Copy the executable from `dist\FUNLHN_Medicine_Tracker.exe` to `_system_data`

3. Create shortcut:
   - Right-click in main folder → New → Shortcut
   - Target: `\\Server\Share\MedicineTracker\_system_data\FUNLHN_Medicine_Tracker.exe`
   - Name: "Launch Medicine Tracker"

4. Hide the `_system_data` folder:
   - Right-click → Properties → Hidden

### Configuration

Default admin credentials:
- Username: `admin`
- Password: `admin123`

First-time setup:
1. Login as admin
2. Navigate to Settings
3. Add users for each location
4. Configure minimum stock levels

## Security Features

- Session timeout after 15 minutes of inactivity
- Password hashing (PBKDF2)
- Audit logging of all actions
- Optimistic locking for concurrent access
- Automatic database backups (last 7 versions)

## Backup and Recovery

- Automatic backups on each startup
- Backups stored in `_system_data\backups`
- Manual backup: Copy `sys_data.dat`
- Recovery: Replace `sys_data.dat` with backup file

## Support

For technical issues or questions, contact FUNLHN IT Support.

## License

© 2025 Flinders Upper North Local Health Network. All rights reserved.
