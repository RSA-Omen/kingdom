# The Castellan

Keeps the castle clean. Identifies abandoned wings, recommends archive or demolish.

## Usage

```bash
cd ~/Kingdom

# Scan for abandoned directories and update the database
python3 -m council.the-castellan scan

# Send Telegram report with top findings
python3 -m council.the-castellan report

# One-line summary for the Herald
python3 -m council.the-castellan brief
```

## State

Findings persist at `~/.castellan.db` (SQLite).

Table `findings`: `path`, `category`, `reason`, `first_seen`, `last_seen`, `status` (open/dismissed).

## Categories

- `DEMOLISH` — empty directories, confirmed scratch/temp dirs
- `ARCHIVE` — has files but no recent git activity and no running service
- `REVIEW` — has files, unclear if active

## Scheduling

Daily scan (e.g., 06:10 CAT):
```
10 6 * * * cd ~/Kingdom && python3 -m council.the-castellan scan >> .castellan-cron.log 2>&1
```

Weekly report (e.g., Monday 06:15 CAT):
```
15 6 * * 1 cd ~/Kingdom && python3 -m council.the-castellan report >> .castellan-cron.log 2>&1
```
