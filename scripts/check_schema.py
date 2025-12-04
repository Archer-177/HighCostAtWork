import sqlite3

def check_schema():
    conn = sqlite3.connect('sys_data.dat')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Users table columns: {columns}")
    if 'is_active' in columns:
        print("is_active column exists.")
    else:
        print("is_active column MISSING!")
    conn.close()

if __name__ == "__main__":
    check_schema()
