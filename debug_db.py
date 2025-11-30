import sqlite3
import json

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

try:
    conn = sqlite3.connect('sys_data.dat')
    conn.row_factory = dict_factory
    cursor = conn.cursor()

    # Check transfer 12
    transfer = cursor.execute("SELECT * FROM transfers WHERE id = 12").fetchone()
    if transfer:
        print(f"Latest Transfer ID: {transfer['id']}")

        # Get items for this transfer using the query from server.py
        items = cursor.execute("""
            SELECT 
                v.id, v.asset_id, v.batch_number, v.expiry_date,
                d.name as drug_name, d.category, d.storage_temp, d.unit_price,
                julianday(v.expiry_date) - julianday('now') as days_until_expiry
            FROM transfer_items ti
            JOIN vials v ON ti.vial_id = v.id
            JOIN drugs d ON v.drug_id = d.id
            WHERE ti.transfer_id = ?
        """, (transfer['id'],)).fetchall()

        print(f"Items found: {len(items)}")
        for item in items:
            print(f"Item: {item['drug_name']}, Storage: '{item['storage_temp']}'")
        # print(json.dumps(items, indent=2, default=str))
    else:
        print("No transfers found.")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
