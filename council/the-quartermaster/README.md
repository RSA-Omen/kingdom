# The Quartermaster

Resource provisioning advisor. Monitors disk space, forecasts when quotas will be exceeded, and recommends provisioning.

## Commands

```bash
# Check resource usage and forecast
python3 -m council.the-quartermaster check

# Check and send Telegram report
python3 -m council.the-quartermaster report

# Display database statistics
python3 -m council.the-quartermaster db
```

## State

Database: `~/.quartermaster.db`

Tracks:
- Usage history (disk space per resource)
- Resource forecasts (growth trends, days until full)
- Alerts (thresholds exceeded)

## Cron Schedule

```
*/6 * * * *   python3 -m council.the-quartermaster check
0 7 * * *     python3 -m council.the-quartermaster report
```

Checks every 6 minutes. Daily report at 07:00 CAT.

## Monitored Resources

- **root** (`/`) — System disk
- **home** (`~`) — User home directory

Warnings trigger at 80% capacity; critical at 95%.

## Features

- 72-hour trend analysis
- Forecast: days until full capacity
- Growth rate: GB/day
- Alert on thresholds exceeded

## Dependencies

- shutil (disk usage)
- requests (Telegram)
