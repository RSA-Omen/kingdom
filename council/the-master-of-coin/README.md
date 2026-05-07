# The Master of Coin

**Beat:** Finance — tracks infrastructure spend signals, Docker disk usage, system disk health, container memory, and time saved through automation.

## What it watches

- **Time saved** — calculates automation hours saved per app from the app-registry (`automation_time_seconds × usage count`), totalled and broken down by app
- **Docker disk** — images, containers, volumes, and build cache sizes via `docker system df`
- **System disk** — root partition used/total/percent via `shutil.disk_usage`
- **Container memory** — top 5 containers by memory usage via `docker stats`

## What it produces

- A persisted snapshot in `~/.coin.db` on every `scan`
- A markdown summary report via `report`
- A single-line brief via `brief`
- A Telegram digest via `telegram`

## What it cannot do

- It cannot modify infrastructure or container configuration
- It cannot make purchasing decisions
- It cannot access billing APIs or financial accounts

## Schedule

Run manually or via cron. Typical cadence: daily scan, weekly Telegram digest.

```
python3 -m council.the-master-of-coin scan
python3 -m council.the-master-of-coin brief
python3 -m council.the-master-of-coin telegram
```
