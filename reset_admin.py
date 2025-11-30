import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_FILE = 'sys_data.dat'

def reset_admin():
    if not os.path.exists(DB_FILE):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Reset admin password
    password_hash = generate_password_hash('admin123')
    cursor.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", (password_hash,))
    
    if cursor.rowcount == 0:
        print("Admin user not found!")
    else:
        print("Admin password reset to 'admin123'")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    reset_admin()
