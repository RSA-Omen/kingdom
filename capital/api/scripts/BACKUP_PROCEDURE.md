# Capital API Database Backup Procedure

## Overview
This document describes the backup and restore procedures for the Capital API's SQLite database (`app-registry.db`).

*Paths updated 2026-05-27 when the database moved from `~/admin-center/data/` to `~/Kingdom/capital/api/data/` as part of the admin-center decommission.*

## Database Location
- **Database**: `/home/lauchlandupreez/Kingdom/capital/api/data/app-registry.db`
- **Backup Directory**: `/home/lauchlandupreez/Kingdom/capital/api/data/backups/`

## Manual Backup

### Creating a Backup
Run the backup script:
```bash
cd /home/lauchlandupreez/Kingdom/capital/api
python3 scripts/backup_database.py
```

The script will:
- Create a timestamped backup file (e.g., `app-registry_backup_20260105_010323.db`)
- Create a symlink `latest_backup.db` pointing to the most recent backup
- Automatically clean up backups older than 30 days
- Display backup location and file size

### Listing Available Backups
```bash
ls -lah /home/lauchlandupreez/Kingdom/capital/api/data/backups/
```

## Restore Procedure

### Restoring from a Backup
1. List available backups:
```bash
cd /home/lauchlandupreez/Kingdom/capital/api
python3 scripts/restore_database.py
```

2. Restore a specific backup:
```bash
python3 scripts/restore_database.py app-registry_backup_20260105_010323.db
```

**Important Notes:**
- The restore script will ask for confirmation before proceeding
- It automatically creates a safety backup of the current database before restoration
- The safety backup is saved as `app-registry.db.pre_restore_YYYYMMDD_HHMMSS`

### Verification After Restore
After restoring, verify the database:
```bash
python3 -c "import sqlite3; conn = sqlite3.connect('/home/lauchlandupreez/Kingdom/capital/api/data/app-registry.db'); tables = [r[0] for r in conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\"').fetchall()]; print(f'Tables: {len(tables)}'); conn.close()"
```

## Automated Backups (Cron Jobs)

### Setting Up Automated Daily Backups
Run the setup script:
```bash
cd /home/lauchlandupreez/Kingdom/capital/api/scripts
./setup_backup_cron.sh
```

This will configure a cron job that:
- Runs daily at 2:00 AM
- Logs output to `/tmp/admin-center-backup.log`
- Automatically creates daily backups

### Viewing Cron Jobs
```bash
crontab -l
```

### Viewing Backup Logs
```bash
tail -f /tmp/admin-center-backup.log
```

### Removing Automated Backups
To remove the cron job:
```bash
crontab -l | grep -v backup_database.py | crontab -
```

## Backup Retention Policy
- Backups are automatically retained for 30 days
- Older backups are automatically cleaned up by the backup script
- Manual cleanup can be performed if needed:
```bash
cd /home/lauchlandupreez/Kingdom/capital/api/data/backups
# Remove backups older than 30 days
find . -name "app-registry_backup_*.db" -type f -mtime +30 -delete
```

## Backup Verification

### Verify Backup Integrity
```bash
cd /home/lauchlandupreez/Kingdom/capital/api/data/backups
python3 -c "import sqlite3; conn = sqlite3.connect('latest_backup.db'); print('✓ Backup is valid'); tables = [r[0] for r in conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\"').fetchall()]; print(f'Tables: {len(tables)}'); conn.close()"
```

### Compare Backup Sizes
Compare backup file sizes to detect anomalies:
```bash
ls -lh /home/lauchlandupreez/Kingdom/capital/api/data/backups/app-registry_backup_*.db
```

## Troubleshooting

### Backup Script Fails
- Ensure Python 3 is installed: `python3 --version`
- Check database file permissions: `ls -lah /home/lauchlandupreez/Kingdom/capital/api/data/app-registry.db`
- Verify backup directory is writable: `ls -ld /home/lauchlandupreez/Kingdom/capital/api/data/backups`

### Restore Fails
- Ensure the backup file exists and is readable
- Check disk space: `df -h`
- Verify database is not locked (stop any running services)

### Cron Job Not Running
- Check cron service: `systemctl status cron` (or `systemctl status crond`)
- Verify cron job exists: `crontab -l`
- Check log file: `cat /tmp/admin-center-backup.log`
- Verify Python path: `which python3`

## Emergency Procedures

### Quick Backup Before Major Changes
```bash
cd /home/lauchlandupreez/Kingdom/capital/api
python3 scripts/backup_database.py
```

### Quick Restore from Latest Backup
```bash
cd /home/lauchlandupreez/Kingdom/capital/api
python3 scripts/restore_database.py $(basename $(readlink /home/lauchlandupreez/Kingdom/capital/api/data/backups/latest_backup.db))
```

## Best Practices
1. **Regular Backups**: Ensure automated backups are running (check cron jobs)
2. **Pre-Change Backups**: Always create a backup before major changes or migrations
3. **Verify Backups**: Periodically verify backup integrity
4. **Test Restores**: Periodically test the restore process in a test environment
5. **Monitor Disk Space**: Ensure sufficient disk space for backups
6. **Off-Site Backups**: Consider copying backups to an off-site location for disaster recovery

