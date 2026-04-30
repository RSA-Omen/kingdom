# The Master of Works

Infrastructure watchkeeper. Monitors system resources (CPU, memory, disk, GPU), container health, and critical service availability.

## Commands

```bash
# Run infrastructure checks (resources + services)
python3 -m council.the-master-of-works check

# Run checks and send Telegram report
python3 -m council.the-master-of-works report

# Display database statistics
python3 -m council.the-master-of-works db
```

## State

Database: `~/.master-of-works.db`

Tracks:
- Resource snapshots (CPU, memory, disk, GPU, load average)
- Service health (Docker, Open WebUI, Local API, Kanban AI, Admin Center API)
- Incidents (threshold violations, service outages)

## Cron Schedule

```
*/5 * * * *   python3 -m council.the-master-of-works check
0 6 * * *     python3 -m council.the-master-of-works report
```

Checks every 5 minutes. Daily briefing at 06:00 CAT.

## Thresholds

- CPU: ⚠️ 80% → 🔴 95%
- Memory: ⚠️ 80% → 🔴 95%
- Disk: ⚠️ 80% → 🔴 90%
- GPU Memory: ⚠️ 85% → 🔴 95%

Services checked: Docker daemon, Open WebUI, Local API, Kanban AI, Admin Center API.

## Dependencies

- psutil (system resources)
- nvidia-smi (GPU stats, optional)
- requests (Telegram)
