# Medicine Tracker v2.0 - Workflow & Business Rules Documentation

**For: John**
**Date: December 3, 2025**
**System: FUNLHN High-Cost Medicine Tracking**

---

## 📍 Network Structure

### Port Augusta Hub (Parent Hub)
**Type:** HUB
**Role:** Primary distribution center for entire Upper North region
**Remote Site Management:** YES - Manages all remote sites

**Child Locations:**
- Port Augusta Emergency Department (WARD)
- Roxby Downs Health Service (REMOTE)
- Quorn Health Service (REMOTE)
- Hawker Health Service (REMOTE)
- Leigh Creek Health Centre (REMOTE)
- Oodnadatta Health Service (REMOTE)

### Whyalla Hub (Parent Hub)
**Type:** HUB
**Role:** Distribution center for Whyalla region only
**Remote Site Management:** NO - Cannot transfer or receive from remote sites

**Child Locations:**
- Whyalla Hospital High Dependency Unit (WARD)
- Whyalla Emergency Department (WARD)

### CRITICAL BUSINESS RULE
**Parent Hub Locations (Port Augusta & Whyalla) CANNOT be deleted or edited** to maintain referential integrity in the network hierarchy.

---

## 👥 User Roles & Permissions

### Role Hierarchy

| Role | Can Receive Stock | Can Transfer | Can Approve Transfers | Can Use/Discard | Can View Reports | Can Manage Settings |
|------|-------------------|--------------|----------------------|-----------------|------------------|---------------------|
| **PHARMACIST** | ✅ Yes (Hub only) | ✅ Yes | ✅ Yes (if supervisor) | ✅ Yes | ✅ Yes | ✅ Yes (if supervisor) |
| **PHARMACY_TECH** | ✅ Yes (Hub only) | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **NURSE** | ❌ No | ✅ Yes (Ward/Remote) | ❌ No | ✅ Yes | ⚠️ Limited | ❌ No |

### Supervisor Permissions (is_supervisor = true)

**IMPORTANT:** Supervisors can **ONLY** perform administrative tasks on **THEIR HUB and HUB CHILDREN**.

**Scope Limitations:**
- Port Augusta Supervisor: Can manage Port Augusta Hub + its 6 children
- Whyalla Supervisor: Can manage Whyalla Hub + its 2 children
- **CANNOT manage cross-hub** (Port Augusta supervisor cannot manage Whyalla)
- **CANNOT manage network-wide settings**

**Administrative Capabilities (Hub-scoped only):**
- Create/Edit/Delete Users (at their hub and children)
- Create/Edit/Delete Drugs (hub-specific formulary)
- Edit Stock Levels (for their hub and children)
- Approve Transfers (for transfers involving their hub/children)
- Edit Location details (EXCEPT parent hub - cannot edit Port Augusta or Whyalla hub details)
- Delete Child Locations (EXCEPT parent hubs)
- Access Settings (hub-scoped configuration)

---

## 🔄 Transfer Workflows (CORRECTED)

### Transfer Rules by Location Type

#### 1. WARD Transfers
**WARDs can ONLY transfer to:**
- ✅ Other wards in the **SAME parent hub**
- ✅ Their own **parent hub**
- ❌ **CANNOT** transfer to wards in different hub
- ❌ **CANNOT** transfer to remote sites

**Examples:**
- ✅ Port Augusta ED → Port Augusta Hub (ALLOWED)
- ✅ Whyalla HDU → Whyalla ED (ALLOWED - same parent hub)
- ❌ Port Augusta ED → Whyalla ED (BLOCKED - different hub)
- ❌ Whyalla ED → Roxby Downs (BLOCKED - ward cannot send to remote)

**Status Logic:**
- Ward → Same Hub Ward: **COMPLETED** (no transit required - same hospital)
- Ward → Parent Hub: **PENDING_APPROVAL** (requires pharmacist approval)

#### 2. REMOTE Site Transfers
**Remote sites can transfer to:**
- ✅ Other **remote sites** (any remote in network)
- ✅ Their **parent hub**
- ❌ **CANNOT** transfer to wards
- ❌ **CANNOT** transfer to Whyalla Hub (Whyalla doesn't manage remotes)

**Examples:**
- ✅ Roxby Downs → Quorn (ALLOWED - remote to remote)
- ✅ Hawker → Port Augusta Hub (ALLOWED - to parent hub)
- ❌ Roxby Downs → Whyalla Hub (BLOCKED - Whyalla can't receive from remotes)
- ❌ Leigh Creek → Port Augusta ED (BLOCKED - remote cannot send to ward)

**Status Logic:**
- Remote → Remote: **IN_TRANSIT** → **COMPLETED**
- Remote → Parent Hub: **IN_TRANSIT** → **COMPLETED**

#### 3. HUB Transfers

**Port Augusta Hub can transfer to:**
- ✅ Its child wards (Port Augusta ED)
- ✅ All remote sites (Roxby Downs, Quorn, Hawker, Leigh Creek, Oodnadatta)
- ✅ Whyalla Hub (hub-to-hub)
- ❌ **CANNOT** transfer to Whyalla's child wards directly

**Whyalla Hub can transfer to:**
- ✅ Its child wards (Whyalla HDU, Whyalla ED)
- ✅ Port Augusta Hub (hub-to-hub)
- ❌ **CANNOT** transfer to remote sites (business rule restriction)
- ❌ **CANNOT** receive from remote sites (business rule restriction)

**Status Logic:**
- Hub → Ward (own child): **PENDING_APPROVAL** → **COMPLETED**
- Hub → Remote: **PENDING_APPROVAL** → **IN_TRANSIT** → **COMPLETED**
- Hub → Hub: **PENDING_APPROVAL** → **IN_TRANSIT** → **COMPLETED**

### Transfer Status Flow

```
PENDING_APPROVAL (requires pharmacist approval)
    ↓
IN_TRANSIT (for remote transfers or cross-hub)
    ↓
COMPLETED (stock moved to destination)

OR

COMPLETED (immediate - for same-hospital ward-to-ward)

OR

CANCELLED (rejected or cancelled by user)
```

### Approval Requirements

| Transfer Type | Requires Approval | Approver |
|---------------|-------------------|----------|
| Ward → Same Hub Ward | ❌ No (immediate COMPLETED) | N/A |
| Ward → Parent Hub | ✅ Yes | Hub Pharmacist Supervisor |
| Remote → Remote | ✅ Yes | Source Hub Pharmacist Supervisor |
| Remote → Parent Hub | ✅ Yes | Hub Pharmacist Supervisor |
| Hub → Ward | ✅ Yes | Hub Pharmacist Supervisor |
| Hub → Remote | ✅ Yes | Hub Pharmacist Supervisor |
| Hub → Hub | ✅ Yes | Destination Hub Pharmacist Supervisor |

---

## 📦 Stock Receiving Workflow

**Who Can Receive Stock:** Hub Pharmacists and Pharmacy Techs ONLY

**Process:**
1. User scans/enters supplier delivery details
2. System generates unique Asset IDs for each vial
3. For each vial:
   - Drug selected from formulary
   - Batch number entered
   - Expiry date entered
   - Quantity entered
   - Cost per unit (optional)
4. Stock created with status: **AVAILABLE**
5. Audit log entry created
6. Labels generated for printing (ZPL format for Zebra printers)

**Asset ID Format:** `{DRUG_CODE}-{LOCATION_CODE}-{TIMESTAMP}-{UUID}`
Example: `TNK-PAH-20251203-A7F2`

**Validations:**
- Expiry date must be in future
- Quantity must be > 0 and ≤ 1000
- Batch number required
- Drug must be in formulary
- User must be at a HUB location

---

## 💉 Stock Use Workflow (Clinical Administration)

**Who Can Use Stock:** All roles (Pharmacists, Pharmacy Techs, Nurses)

**Process:**
1. User searches for vial by Asset ID or scans barcode
2. System verifies vial status is **AVAILABLE**
3. User enters:
   - Patient MRN (Medical Record Number) - **REQUIRED**
   - Date/time of administration (defaults to now)
   - Notes (optional)
4. System updates vial status to **USED**
5. Audit log created with patient MRN
6. Stock statistics updated

**Validations:**
- Vial must be AVAILABLE (not already used/discarded/in-transit)
- Patient MRN required (cannot be blank)
- User must be authorized to use stock
- Optimistic locking check (version conflict detection)

---

## 🗑️ Stock Discard Workflow

**Who Can Discard:** Pharmacists and Pharmacy Techs

**Discard Reasons:**
- **EXPIRED** - Past expiry date
- **DAMAGED** - Physical damage to vial/packaging
- **CONTAMINATED** - Suspected contamination
- **RECALLED** - Manufacturer recall
- **OTHER** - Other reason (requires notes)

**Process:**
1. User searches for vial by Asset ID
2. System verifies vial status is **AVAILABLE** or **EXPIRED**
3. User selects discard reason
4. User enters detailed notes (required for OTHER reason)
5. System updates vial status to **DISCARDED**
6. Audit log created with reason and notes
7. Wastage statistics updated

**Validations:**
- Vial must be AVAILABLE or EXPIRED
- Reason must be selected
- Notes required if reason is OTHER
- User must be Pharmacist or Pharmacy Tech
- Optimistic locking check

---

## 🔍 Stock Search & Journey

### Stock Search
**Available to:** All authenticated users

**Search Filters:**
- Location (user's location or network-wide for supervisors)
- Drug
- Status (AVAILABLE, IN_TRANSIT, USED, DISCARDED, EXPIRED)
- Expiry date range
- Asset ID

**Results Include:**
- Asset ID
- Drug name
- Batch number
- Expiry date
- Days until expiry
- Current location
- Status with color coding:
  - 🟢 Green: >90 days until expiry
  - 🟡 Amber: 30-90 days until expiry
  - 🔴 Red: <30 days until expiry
- Current value

### Stock Journey (Timeline)
**Available to:** All authenticated users

**Shows complete history of a vial:**
1. **RECEIVED** - Initial stock receipt (supplier details, batch, expiry)
2. **TRANSFER_CREATED** - Transfer initiated
3. **TRANSFER_APPROVED** - Pharmacist approved transfer
4. **IN_TRANSIT** - Stock in transit to destination
5. **TRANSFER_COMPLETED** - Arrived at destination
6. **USED** - Clinical administration (patient MRN, date/time)
7. **DISCARDED** - Wastage (reason, notes)

Each event includes:
- Timestamp (Adelaide timezone)
- User who performed action
- Location
- Relevant details (patient MRN, transfer ID, reason, etc.)

---

## 📊 Reports & Analytics

### Dashboard Metrics
**Available to:** All authenticated users

**Displays:**
- Total stock count at user's location
- Total stock value (AUD)
- Healthy stock (>90 days to expiry)
- Warning stock (30-90 days to expiry)
- Critical stock (<30 days to expiry)
- Recent stock movements (last 10)
- Stock levels by drug
- Expiry alerts

### Stock Level Reports
**Available to:** Pharmacists and Pharmacy Techs

**Shows for each drug at each location:**
- Current stock count
- Minimum stock level (configured threshold)
- Stock status: ✅ Adequate, ⚠️ Low, 🔴 Critical
- Days of supply remaining
- Reorder recommendations

### Usage Reports
**Available to:** Pharmacists and Supervisors

**Metrics:**
- Usage by drug (count, value)
- Usage by location
- Usage trends over time
- Top 10 most-used drugs
- Patient administration count (no patient details - privacy)

### Wastage Reports
**Available to:** Pharmacists and Supervisors

**Metrics:**
- Wastage by reason (count, value)
- Wastage by location
- Wastage trends over time
- Expiry wastage (preventable losses)
- Total wastage cost

### Transfer Reports
**Available to:** Pharmacists and Supervisors

**Metrics:**
- Transfer volume by route (e.g., Port Augusta Hub → Roxby Downs)
- Average transfer completion time
- Pending approvals
- Transfer status breakdown
- Network flow visualization (interactive map)

---

## 🔒 Security & Access Control

### Authentication
- Argon2 password hashing (industry standard)
- Mandatory password change on first login
- Session management with heartbeat (5-second interval)
- Auto-logout on inactivity (configurable timeout)
- Password complexity requirements (configurable)

### Authorization Checks

**Every API endpoint validates:**
1. User is authenticated (valid session)
2. User has required role for action
3. User has permission to access resource (location-scoped)
4. Supervisors can only manage their hub and children

**Examples:**
- Nurse at Whyalla ED can view stock at Whyalla ED only
- Pharmacist Supervisor at Port Augusta can manage Port Augusta Hub + 6 children
- Pharmacist Supervisor at Whyalla CANNOT manage Port Augusta locations
- Non-supervisors CANNOT create/edit/delete users or settings

### Audit Logging

**All actions are logged:**
- User ID and username
- Action type (RECEIVE, USE, DISCARD, TRANSFER, EDIT, DELETE)
- Timestamp (Adelaide timezone)
- Resource ID (vial ID, transfer ID, etc.)
- Details (JSON payload with before/after values)
- IP address (if available)
- Success/failure status

**Audit logs are:**
- Immutable (cannot be edited or deleted)
- Retained indefinitely
- Accessible to Supervisors only
- Exportable for compliance audits

---

## 🛠️ Concurrency & Data Integrity

### Optimistic Locking
**All mutable resources have version fields:**
- Vials (version)
- Transfers (version)
- Locations (version)
- Drugs (version)
- Users (version)

**On every update:**
1. Client sends current version number
2. Server checks if version matches database
3. If match: Update proceeds, version incremented
4. If mismatch: 409 CONFLICT error returned
5. Client must refetch latest data and retry

**Example:**
```json
{
  "vial_id": 123,
  "version": 5,  // Client thinks this is current
  "patient_mrn": "12345678"
}
```
If database has version 6, update fails with:
```json
{
  "error": "CONFLICT",
  "message": "Resource has been modified by another user",
  "current_version": 6
}
```

### Write Queue
**All database writes are serialized through a background thread queue:**
- Prevents SQLite database locks
- Ensures write operations complete in order
- Safe for multi-user access on network drive
- Timeout protection (30 seconds per operation)

### Database Backups
**Automatic rolling backups:**
- Triggered every 24 hours
- Last 7 backups retained
- Stored in `/backups` directory
- File format: `sys_data_backup_YYYYMMDD_HHMMSS.db`
- Manual backup API endpoint available

---

## 🚨 Business Rules Summary

### Transfer Restrictions
1. ✅ Ward → Same Hub Ward (immediate completion)
2. ✅ Ward → Parent Hub
3. ❌ Ward → Different Hub Ward (BLOCKED)
4. ❌ Ward → Remote (BLOCKED)
5. ✅ Remote → Remote
6. ✅ Remote → Parent Hub (Port Augusta only)
7. ❌ Remote → Whyalla (BLOCKED)
8. ❌ Remote → Ward (BLOCKED)
9. ✅ Hub → Own Child Ward
10. ✅ Hub → Remote (Port Augusta only)
11. ❌ Hub → Cross-hub Ward (BLOCKED)
12. ✅ Hub → Hub
13. ❌ Whyalla → Remote (BLOCKED)
14. ❌ Whyalla ← Remote (BLOCKED)

### Permission Restrictions
1. ✅ Supervisors manage ONLY their hub and children
2. ❌ Supervisors CANNOT manage cross-hub resources
3. ❌ Parent hubs (Port Augusta, Whyalla) CANNOT be deleted
4. ❌ Parent hubs CANNOT be edited (name, type, parent_id)
5. ✅ Child locations CAN be deleted (by their hub supervisor)
6. ✅ Supervisors can edit child locations (except type, parent_id)

### Stock Restrictions
1. ✅ Only Hubs can receive stock from suppliers
2. ✅ All roles can use stock (with patient MRN)
3. ✅ Only Pharmacists and Pharmacy Techs can discard stock
4. ❌ Cannot use/discard stock that is IN_TRANSIT
5. ❌ Cannot transfer stock that is USED or DISCARDED
6. ✅ Stock expires automatically (daily check at midnight)

---

## 📋 Example User Profiles

### Example 1: Sarah - Pharmacist Supervisor at Port Augusta
**Role:** PHARMACIST
**Location:** Port Augusta Hospital Pharmacy (HUB)
**Supervisor:** Yes
**Can Delegate:** Yes

**Permissions:**
- ✅ Receive stock from suppliers
- ✅ Transfer stock to: Port Augusta ED, all 5 remote sites, Whyalla Hub
- ✅ Approve transfers involving Port Augusta Hub and its children
- ✅ Use stock clinically (with patient MRN)
- ✅ Discard stock (with reason)
- ✅ View all reports for Port Augusta network
- ✅ Manage users at Port Augusta Hub and 6 children
- ✅ Manage drugs in Port Augusta formulary
- ✅ Edit settings for Port Augusta network
- ❌ CANNOT manage Whyalla resources
- ❌ CANNOT edit Port Augusta Hub details (parent hub protection)

### Example 2: James - Pharmacy Tech at Whyalla
**Role:** PHARMACY_TECH
**Location:** Whyalla Hospital Pharmacy (HUB)
**Supervisor:** No
**Can Delegate:** No

**Permissions:**
- ✅ Receive stock from suppliers
- ✅ Transfer stock to: Whyalla HDU, Whyalla ED, Port Augusta Hub
- ❌ CANNOT transfer to remote sites (Whyalla restriction)
- ❌ CANNOT approve transfers
- ✅ Use stock clinically (with patient MRN)
- ✅ Discard stock (with reason)
- ✅ View reports for Whyalla locations
- ❌ CANNOT manage users or settings

### Example 3: Maria - Nurse at Roxby Downs Remote Site
**Role:** NURSE
**Location:** Roxby Downs Health Service (REMOTE)
**Supervisor:** No
**Can Delegate:** No

**Permissions:**
- ❌ CANNOT receive stock from suppliers
- ✅ Transfer stock to: Other remote sites, Port Augusta Hub
- ❌ CANNOT transfer to Whyalla (Whyalla doesn't manage remotes)
- ❌ CANNOT approve transfers
- ✅ Use stock clinically (with patient MRN) - PRIMARY JOB
- ❌ CANNOT discard stock (must transfer back to hub)
- ✅ View basic reports for Roxby Downs only
- ❌ CANNOT manage users or settings

### Example 4: David - Nurse at Whyalla ED
**Role:** NURSE
**Location:** Whyalla Emergency Department (WARD)
**Supervisor:** No
**Can Delegate:** No

**Permissions:**
- ❌ CANNOT receive stock from suppliers
- ✅ Transfer stock to: Whyalla HDU (same parent hub), Whyalla Hub (parent)
- ❌ CANNOT transfer to Port Augusta locations (different hub)
- ❌ CANNOT approve transfers
- ✅ Use stock clinically (with patient MRN) - PRIMARY JOB
- ❌ CANNOT discard stock (must transfer to Whyalla Hub)
- ✅ View basic reports for Whyalla ED only
- ❌ CANNOT manage users or settings

---

## 🎯 Key Takeaways

1. **Hub-and-Spoke Model:** Port Augusta manages remotes, Whyalla does not
2. **Same-Hospital Transfers:** Ward-to-ward within same hub = immediate completion
3. **Cross-Hub Restriction:** Wards cannot transfer between hubs
4. **Remote Flexibility:** Remotes can transfer to each other and parent hub
5. **Whyalla Limitation:** Cannot interact with remote sites at all
6. **Supervisor Scope:** Hub and children only, not network-wide
7. **Parent Hub Protection:** Cannot delete or edit Port Augusta or Whyalla hub records
8. **Clinical Priority:** All roles can use stock with patient MRN (saves lives)
9. **Audit Everything:** Complete trail for compliance and accountability
10. **Concurrency Safe:** Optimistic locking + write queue = multi-user ready

---

**End of Documentation**
**Last Updated:** December 3, 2025
**System Version:** v2.0
