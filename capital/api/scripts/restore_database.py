#!/usr/bin/env python3
"""
Restore the Admin Center SQLite database from a backup file.
"""
import os
import sys
import sqlite3
from pathlib import Path
from datetime import datetime

# Database path
script_dir = Path(__file__).parent.parent
data_dir = script_dir.parent / "data"
db_path = data_dir / "app-registry.db"
backups_dir = data_dir / "backups"

# Get backup filename from command line
if len(sys.argv) < 2:
    print("Usage: python3 restore_database.py <backup_filename>")
    print("\nAvailable backups:")
    for backup in sorted(backups_dir.glob("app-registry_backup_*.db"), reverse=True):
        size_kb = backup.stat().st_size / 1024
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        print(f"  {backup.name} ({size_kb:.2f} KB, {mtime.strftime('%Y-%m-%d %H:%M:%S')})")
    sys.exit(1)

backup_filename = sys.argv[1]
backup_file = backups_dir / backup_filename

# Verify backup file exists
if not backup_file.exists():
    print(f"✗ Backup file not found: {backup_file}")
    sys.exit(1)

# Confirm restoration
print(f"WARNING: This will overwrite the current database!")
print(f"  Current database: {db_path}")
print(f"  Backup file: {backup_file}")
response = input("\nAre you sure you want to continue? (yes/no): ")

if response.lower() not in ['yes', 'y']:
    print("Restoration cancelled.")
    sys.exit(0)

try:
    # Create a backup of the current database before restoration
    current_backup = data_dir / f"app-registry.db.pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    if db_path.exists():
        print(f"\nCreating safety backup of current database: {current_backup}")
        source_conn = sqlite3.connect(str(db_path))
        backup_conn = sqlite3.connect(str(current_backup))
        source_conn.backup(backup_conn)
        backup_conn.close()
        source_conn.close()
    
    # Close any existing connections and remove current database
    if db_path.exists():
        db_path.unlink()
    
    # Restore from backup
    print(f"\nRestoring database from backup...")
    backup_conn = sqlite3.connect(str(backup_file))
    restored_conn = sqlite3.connect(str(db_path))
    backup_conn.backup(restored_conn)
    restored_conn.close()
    backup_conn.close()
    
    print(f"✓ Database restored successfully!")
    print(f"  Restored from: {backup_file}")
    if current_backup.exists():
        print(f"  Previous database saved as: {current_backup}")
    
except sqlite3.Error as e:
    print(f"✗ Restore failed!")
    print(f"  Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Restore failed!")
    print(f"  Error: {e}")
    sys.exit(1)

