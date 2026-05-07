#!/usr/bin/env python3
"""
The Master of Whisperers — Intelligence from beyond the walls.
Watches AI/LLM feeds and reports new models, tools, and developments.
"""

import os
import re
import sys
import sqlite3
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict, Optional
from email.utils import parsedate_to_datetime

# Load env from ~/.kingdom.env if vars not already set
_env_file = Path.home() / ".kingdom.env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DB_PATH = Path.home() / ".whisperers.db"

FEEDS = [
    {
        "name": "Simon Willison",
        "url": "https://simonwillison.net/atom/everything/",
        "kind": "atom",
    },
    {
        "name": "Hacker News AI/LLM",
        "url": "https://hnrss.org/newest?q=AI+LLM+Claude+GPT&count=20",
        "kind": "rss",
    },
    {
        "name": "Anthropic",
        "url": "https://www.anthropic.com/feed.rss",
        "kind": "rss",
    },
    {
        "name": "The Batch",
        "url": "https://read.deeplearning.ai/the-batch/rss/",
        "kind": "rss",
    },
]

NS_ATOM = "http://www.w3.org/2005/Atom"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _truncate(text: str, max_chars: int = 200) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "…"


def _parse_date(raw: str) -> Optional[datetime]:
    """Parse RFC-2822 or ISO-8601 dates into UTC-aware datetime."""
    if not raw:
        return None
    raw = raw.strip()
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Feed fetching / parsing
# ---------------------------------------------------------------------------

def _fetch_xml(url: str, timeout: int = 10) -> Optional[ET.Element]:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "MasterOfWhisperers/1.0 (Kingdom/Gekko)"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
        return ET.fromstring(data)
    except Exception as e:
        print(f"  [whisperers] fetch failed for {url}: {e}", file=sys.stderr)
        return None


def _parse_atom(root: ET.Element, source: str) -> List[Dict]:
    items = []
    for entry in root.findall(f"{{{NS_ATOM}}}entry"):
        title_el = entry.find(f"{{{NS_ATOM}}}title")
        title = (title_el.text or "Untitled").strip()
        link_el = entry.find(f"{{{NS_ATOM}}}link")
        url = (link_el.get("href", "") or (link_el.text or "")).strip() if link_el is not None else ""
        date_el = entry.find(f"{{{NS_ATOM}}}updated") or entry.find(f"{{{NS_ATOM}}}published")
        published = _parse_date(date_el.text if date_el is not None else "")
        summary_el = entry.find(f"{{{NS_ATOM}}}summary") or entry.find(f"{{{NS_ATOM}}}content")
        summary = _truncate(_strip_html((summary_el.text or "") if summary_el is not None else ""))
        if url:
            items.append({"source": source, "title": title, "url": url, "summary": summary, "published_at": published})
    return items


def _parse_rss(root: ET.Element, source: str) -> List[Dict]:
    items = []
    channel = root.find("channel")
    entries = channel.findall("item") if channel is not None else root.findall(".//item")
    for item in entries:
        title_el = item.find("title")
        title = (title_el.text or "Untitled").strip()
        link_el = item.find("link")
        url = (link_el.text or "").strip() if link_el is not None else ""
        pub_el = item.find("pubDate")
        published = _parse_date(pub_el.text if pub_el is not None else "")
        desc_el = item.find("description")
        summary = _truncate(_strip_html((desc_el.text or "") if desc_el is not None else ""))
        if url:
            items.append({"source": source, "title": title, "url": url, "summary": summary, "published_at": published})
    return items


def fetch_all_feeds() -> List[Dict]:
    """Fetch all configured feeds. Returns a flat list of items."""
    results = []
    for feed in FEEDS:
        print(f"  fetching {feed['name']}…", file=sys.stderr)
        root = _fetch_xml(feed["url"])
        if root is None:
            continue
        try:
            parser = _parse_atom if feed["kind"] == "atom" else _parse_rss
            results.extend(parser(root, feed["name"]))
        except Exception as e:
            print(f"  [whisperers] parse error for {feed['name']}: {e}", file=sys.stderr)
    return results


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE IF NOT EXISTS items ("
        "id INTEGER PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL, "
        "url TEXT UNIQUE NOT NULL, summary TEXT, published_at TEXT, first_seen_at TEXT NOT NULL)"
    )
    conn.commit()
    return conn


def _is_known(conn: sqlite3.Connection, url: str) -> bool:
    row = conn.execute("SELECT 1 FROM items WHERE url = ?", (url,)).fetchone()
    return row is not None


def _insert(conn: sqlite3.Connection, item: Dict) -> None:
    pub = item["published_at"].isoformat() if item["published_at"] else None
    conn.execute(
        "INSERT OR IGNORE INTO items (source, title, url, summary, published_at, first_seen_at) VALUES (?,?,?,?,?,?)",
        (item["source"], item["title"], item["url"], item["summary"], pub, datetime.now(timezone.utc).isoformat()),
    )


def _items_since(conn: sqlite3.Connection, hours: int = 48) -> List[sqlite3.Row]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    return conn.execute(
        "SELECT * FROM items WHERE first_seen_at >= ? ORDER BY published_at DESC NULLS LAST",
        (cutoff,),
    ).fetchall()


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_fetch() -> int:
    """Pull feeds, persist new items, print count."""
    raw_items = fetch_all_feeds()
    conn = _db()
    new_count = 0
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)

    for item in raw_items:
        if _is_known(conn, item["url"]):
            continue
        # Filter: only items published in the last 48 hours (or undated)
        if item["published_at"] and item["published_at"] < cutoff:
            continue
        _insert(conn, item)
        new_count += 1

    conn.commit()
    conn.close()
    print(f"New items: {new_count}")
    return new_count


def cmd_report() -> None:
    """Print today's items as markdown."""
    conn = _db()
    items = _items_since(conn, hours=48)
    conn.close()

    today = datetime.now().strftime("%-d %b %Y")
    print(f"# Master of Whisperers — Intelligence Report")
    print(f"## {today}\n")

    if not items:
        print("No new intelligence in the last 48 hours.")
        return

    for item in items:
        pub = item["published_at"] or "unknown date"
        print(f"### {item['title']}")
        print(f"**Source:** {item['source']}  **Published:** {pub}")
        print(f"**URL:** {item['url']}")
        if item["summary"]:
            print(f"\n{item['summary']}")
        print()


def cmd_brief() -> str:
    """One-line summary for the Herald."""
    conn = _db()
    items = _items_since(conn, hours=48)
    conn.close()

    count = len(items)
    if count == 0:
        line = "👁 No new AI intelligence today"
    else:
        top_title = items[0]["title"] if items else ""
        short_title = top_title[:60] + "…" if len(top_title) > 60 else top_title
        line = f"👁 {count} new AI item{'s' if count != 1 else ''}: {short_title}"

    print(line)
    return line


def cmd_telegram() -> None:
    """Send today's digest via Telegram."""
    conn = _db()
    items = _items_since(conn, hours=48)
    conn.close()

    today = datetime.now().strftime("%-d %b %Y")
    lines = [
        f"👁 <b>Master of Whisperers — Intelligence Report</b>",
        f"{today}",
        "",
    ]

    if not items:
        lines.append("No new intelligence today.")
    else:
        capped = list(items)[:5]
        lines.append(f"🤖 <b>New AI/LLM Intelligence ({len(items)} item{'s' if len(items) != 1 else ''})</b>")
        lines.append("")
        for item in capped:
            lines.append(f"  · <b>{item['title']}</b> — {item['source']}")
            lines.append(f"    {item['url']}")
            lines.append("")

        if len(items) > 5:
            lines.append(f"  <i>…and {len(items) - 5} more. Run `report` for the full list.</i>")
            lines.append("")

    lines.append("— <i>From beyond the walls</i>")
    message = "\n".join(lines)
    _send_telegram(message)


def _send_telegram(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("Telegram not configured — printing instead:")
        print(message)
        return

    import urllib.parse
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = urllib.parse.urlencode({
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                print("Telegram message sent.")
            else:
                print(f"Telegram responded {resp.status}", file=sys.stderr)
    except Exception as e:
        print(f"Failed to send Telegram: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "report"

    if command == "fetch":
        cmd_fetch()
    elif command == "report":
        cmd_report()
    elif command == "brief":
        cmd_brief()
    elif command == "telegram":
        cmd_telegram()
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        print("Usage: python3 -m council.the-master-of-whisperers [fetch|report|brief|telegram]", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
