# The Master of Whisperers

**Beat:** Intelligence from beyond the walls — new AI models, new tools, what the wider world is doing.

Fetches AI/LLM news from curated RSS/Atom feeds, persists new items to `~/.whisperers.db`, and delivers a daily digest via Telegram.

## Usage

```bash
# From ~/Kingdom/
python3 -m council.the-master-of-whisperers fetch     # pull feeds, store new items
python3 -m council.the-master-of-whisperers report    # print today's items as markdown
python3 -m council.the-master-of-whisperers brief     # one-line summary for the Herald
python3 -m council.the-master-of-whisperers telegram  # send Telegram digest
```

## Feeds watched

- Simon Willison (`simonwillison.net`)
- Hacker News AI/LLM (hnrss.org)
- Anthropic blog
- The Batch (DeepLearning.AI)

## Herald integration

The Herald calls `brief` to include a one-liner in the morning digest:

```
👁 3 new AI items: GPT-5 announced with…
```

## Schedule

Recommended: daily at 07:00 CAT via systemd timer or cron.

## Database

`~/.whisperers.db` — SQLite, single `items` table. Safe to delete to reset.
