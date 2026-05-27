#!/usr/bin/env python3
"""
Backup the Admin Center SQLite database to a timestamped file.
"""
import os
import sys
import sqlite3
from datetime import datetime
from pathlib import Path
import shutil

# Database path
script_dir = Path(__file__).parent.parent
data_dir = script_dir.parent / "data"
db_path = data_dir / "app-registry.db"

# Create backups directory
backups_dir = data_dir / "backups"
backups_dir.mkdir(exist_ok=True)

# Generate backup filename with timestamp
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_file = backups_dir / f"app-registry_backup_{timestamp}.db"

print(f"Backing up database '{db_path}' to {backup_file}...")

# Verify database exists
if not db_path.exists():
    print(f"✗ Database file not found: {db_path}")
    sys.exit(1)

try:
    # Connect to source database
    source_conn = sqlite3.connect(str(db_path))
    
    # Create backup database connection
    backup_conn = sqlite3.connect(str(backup_file))
    
    # Perform backup using SQLite backup API
    source_conn.backup(backup_conn)
    
    # Close connections
    backup_conn.close()
    source_conn.close()
    
    file_size = backup_file.stat().st_size / 1024  # Size in KB
    print(f"✓ Backup completed successfully!")
    print(f"  File: {backup_file}")
    print(f"  Size: {file_size:.2f} KB")
    print(f"\nTo restore this backup, run:")
    print(f"  python3 {Path(__file__).parent / 'restore_database.py'} {backup_file.name}")
    
    # Also create a symlink to the latest backup
    latest_link = backups_dir / "latest_backup.db"
    if latest_link.exists():
        latest_link.unlink()
    latest_link.symlink_to(backup_file.name)
    print(f"\n  Latest backup linked as: {latest_link}")
    
    # Cleanup old backups (keep last 30 days)
    cutoff_date = datetime.now().timestamp() - (30 * 24 * 60 * 60)
    cleaned = 0
    for old_backup in backups_dir.glob("app-registry_backup_*.db"):
        if old_backup.is_file() and not old_backup.is_symlink():
            if old_backup.stat().st_mtime < cutoff_date:
                old_backup.unlink()
                cleaned += 1
    
    if cleaned > 0:
        print(f"\n  Cleaned up {cleaned} old backup(s) (older than 30 days)")
    
except sqlite3.Error as e:
    print(f"✗ Backup failed!")
    print(f"  Error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"✗ Backup failed!")
    print(f"  Error: {e}")
    sys.exit(1)

