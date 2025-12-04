import sqlite3
import os
from datetime import datetime, timedelta
import uuid

# Database path
DB_FILE = os.path.join(os.path.dirname(__file__), 'sys_data.dat')

def reset_database():
    """Reset database and populate with specific medications"""
    
    if not os.path.exists(DB_FILE):
        print(f"❌ Database file not found at: {DB_FILE}")
        print("Please run the application first to createthe database.")
        return
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    print("Resetting database...")
    
    # Check if vials table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='vials'")
    if not cursor.fetchone():
        print("❌ Database tables not initialized. Please run the application first.")
        conn.close()
        return
    
    # Delete all vials
    cursor.execute("DELETE FROM vials")
    print("✓ Cleared all vials")
    
    # Get drug IDs
    tenecteplase = cursor.execute("SELECT id FROM drugs WHERE name = 'Tenecteplase'").fetchone()
    
    # If Tenecteplase doesn't exist, create it
    if not tenecteplase:
        cursor.execute("""
            INSERT INTO drugs (name, category, storage_temp, unit_price)
            VALUES ('Tenecteplase', 'Thrombolytic', '<25°C', 2500.00)
        """)
        tenecteplase_id = cursor.lastrowid
        print("✓ Created Tenecteplase drug")
    else:
        tenecteplase_id = tenecteplase[0]
    
    # Check for antivenoms - update existing or create
    antivenom_ids = []
    antivenoms = [
        ('Red Back Spider Antivenom', 'Antivenom', '2-8°C', 850.00),
        ('Brown Snake Antivenom', 'Antivenom', '2-8°C', 1200.00)
    ]
   
    for name, category, temp, price in antivenoms:
        existing = cursor.execute("SELECT id FROM drugs WHERE name = ?", (name,)).fetchone()
        if existing:
            antivenom_ids.append(existing[0])
        else:
            cursor.execute("""
                INSERT INTO drugs (name, category, storage_temp, unit_price)
                VALUES (?, ?, ?, ?)
            """, (name, category, temp, price))
            antivenom_ids.append(cursor.lastrowid)
    
    print(f"✓ Antivenoms ready: {len(antivenom_ids)} types")
    
    # Get locations
    locations = cursor.execute("SELECT id, name, type FROM locations").fetchall()
    print(f"✓ Found {len(locations)} locations")
    
    # Batch numbers for Tenecteplase (3 batches)
    tenecteplase_batches = ['TNK-2024-A', 'TNK-2024-B', 'TNK-2024-C']
    # Batch numbers for Antivenoms (2 batches each)
    antivenom_batches = ['AV-2024-X', 'AV-2024-Y']
    
    # Create Tenecteplase stock (20 vials across 3 batches)
    vials_created = 0
    batch_distribution = [7, 7, 6]  # Distribute 20 vials across 3 batches
    
    for batch_idx, (batch_num, count) in enumerate(zip(tenecteplase_batches, batch_distribution)):
        # Vary expiry dates within each batch
        # Batch A: 120-150 days (healthy)
        # Batch B: 45-75 days (warning)
        # Batch C: 15-25 days (critical)
        if batch_idx == 0:
            days_range = (120, 150)
        elif batch_idx == 1:
            days_range = (45, 75)
        else:
            days_range = (15, 25)
       
        # Pick a consistent expiry for the batch
        import random
        days_offset = random.randint(*days_range)
        expiry_date = (datetime.now() + timedelta(days=days_offset)).strftime('%Y-%m-%d')
        
        # Distribute vials across locations
        for i in range(count):
            # Cycle through locations
            loc = locations[i % len(locations)]
            asset_id = f"TNK-{str(uuid.uuid4())[:8].upper()}"
            
            cursor.execute("""
                INSERT INTO vials (asset_id, drug_id, batch_number, expiry_date, location_id, status)
                VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
            """, (asset_id, tenecteplase_id, batch_num, expiry_date, loc[0]))
            vials_created += 1
    
    print(f"✓ Created {vials_created} Tenecteplase vials across 3 batches")
    
    # Create Antivenom stock (10 vials per antivenom type, 2 batches each)
    for antivenom_id in antivenom_ids:
        for batch_idx, batch_num in enumerate(antivenom_batches):
            # Batch X: 60-90 days (warning/healthy)
            # Batch Y: 100-180 days (healthy)
            if batch_idx == 0:
                days_offset = random.randint(60, 90)
            else:
                days_offset = random.randint(100, 180)
            
            expiry_date = (datetime.now() + timedelta(days=days_offset)).strftime('%Y-%m-%d')
            
            # Create 5 vials per batch
            for i in range(5):
                loc = locations[i % len(locations)]
                asset_id = f"AV-{str(uuid.uuid4())[:8].upper()}"
                
                cursor.execute("""
                    INSERT INTO vials (asset_id, drug_id, batch_number, expiry_date, location_id, status)
                    VALUES (?, ?, ?, ?, ?, 'AVAILABLE')
                """, (asset_id, antivenom_id, batch_num, expiry_date, loc[0]))
                vials_created += 1
    
    print(f"✓ Created {20} Antivenom vials across 2 batches per type")
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Database reset complete!")
    print(f"Total vials created: {vials_created}")
    print(f"  - Tenecteplase: 20 vials (3 batches)")
    print(f"  - Antivenoms: 20 vials (2 types × 2 batches × 5 vials)")

if __name__ == "__main__":
    reset_database()
