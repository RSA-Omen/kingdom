#!/usr/bin/env python3
"""The Scriptorium — static site renderer.

Reads `scriptorium/content/villages/<slug>/{meta.yml, wiki/*.md, demos/*.html}`
and renders the site into `scriptorium/build/`. Deploy by copying the contents
of `build/` to wherever the site is served from (currently `~/reports/`).

Usage:
    .venv/bin/python build.py
"""

from __future__ import annotations
import re
import shutil
from datetime import date, datetime
from pathlib import Path

import yaml
import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
TEMPLATES = ROOT / "templates"
BUILD = ROOT / "build"

STATIC_FILES = ["styles.css", "scriptorium.js"]

MANDATORY_POSTS = {
    "app": {"ui", "journeys"},
    "process": {"flow", "integrations"},
    "service": {"sequence", "capabilities"},
    "bridge": {"crossings", "failures"},
}


def humanize_age(d) -> str:
    """Render a date as '2d ago' / 'today' / 'yesterday'."""
    if d is None:
        return ""
    if isinstance(d, str):
        try:
            d = datetime.strptime(d, "%Y-%m-%d").date()
        except ValueError:
            return d
    if isinstance(d, datetime):
        d = d.date()
    if not isinstance(d, date):
        return str(d)
    delta = (date.today() - d).days
    if delta <= 0:
        return "today"
    if delta == 1:
        return "yesterday"
    if delta < 7:
        return f"{delta}d ago"
    if delta < 30:
        return f"{delta // 7}w ago"
    if delta < 365:
        return f"{delta // 30}mo ago"
    return f"{delta // 365}y ago"


def extract_h1(md_text: str) -> str:
    m = re.search(r"^#\s+(.+)$", md_text, re.MULTILINE)
    return m.group(1).strip() if m else ""


def extract_title_tag(html: str) -> str:
    m = re.search(r"<title>(.+?)</title>", html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else "Untitled demo"


def extract_demo_date(filename: str) -> str:
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", filename)
    return m.group(1) if m else ""


def load_village(village_dir: Path):
    meta_path = village_dir / "meta.yml"
    if not meta_path.exists():
        return None
    meta = yaml.safe_load(meta_path.read_text())

    wiki_dir = village_dir / "wiki"
    wiki_pages = []
    if wiki_dir.exists():
        files = sorted(wiki_dir.glob("*.md"))
        files.sort(key=lambda p: (p.stem != "index", p.stem))
        for md_file in files:
            text = md_file.read_text()
            wiki_pages.append({
                "name": md_file.stem,
                "title": extract_h1(text) or md_file.stem.replace("-", " ").title(),
                "source": text,
                "path": md_file,
            })

    demos_dir = village_dir / "demos"
    demos = []
    if demos_dir.exists():
        for demo_file in sorted(demos_dir.glob("*.html"), reverse=True):
            html = demo_file.read_text(errors="replace")
            demos.append({
                "filename": demo_file.name,
                "title": extract_title_tag(html),
                "date": extract_demo_date(demo_file.name),
                "path": demo_file,
            })

    page_names = {p["name"] for p in wiki_pages}
    required = MANDATORY_POSTS.get(meta["type"], set()) | {"index"}
    missing = sorted(required - page_names)

    return {
        "slug": meta["slug"],
        "name": meta["name"],
        "type": meta["type"],
        "summary": meta["summary"].strip(),
        "owner": meta.get("owner", ""),
        "created": meta.get("created"),
        "created_human": humanize_age(meta.get("created")) if meta.get("created") else "",
        "repo": meta.get("repo"),
        "wiki_pages": wiki_pages,
        "demos": demos,
        "doc_count": len(wiki_pages),
        "demo_count": len(demos),
        "missing_required": missing,
    }


def load_all_villages():
    out = []
    villages_dir = CONTENT / "villages"
    if not villages_dir.exists():
        return out
    for village_dir in sorted(villages_dir.iterdir()):
        if not village_dir.is_dir():
            continue
        v = load_village(village_dir)
        if v:
            out.append(v)
    return out


WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def resolve_wikilinks(text: str, villages_by_slug: dict) -> str:
    """Turn `[[slug]]`, `[[slug/page]]`, `[[#section]]` into markdown links."""
    def replace(m):
        target = m.group(1).strip()
        if target.startswith("#"):
            label = target[1:]
            return f"[{label}]({target})"
        anchor = ""
        if "#" in target:
            target, anchor = target.split("#", 1)
            anchor = "#" + anchor
        page = ""
        if "/" in target:
            slug, page = target.split("/", 1)
        else:
            slug = target
        if slug in villages_by_slug:
            v = villages_by_slug[slug]
            if page and page != "index":
                label = f"{v['name']} · {page}"
                url = f"/villages/{slug}.html#{page}{anchor}"
            else:
                label = v["name"]
                url = f"/villages/{slug}.html{anchor}"
            return f"[{label}]({url})"
        return f'<span class="wiki-broken">{target}</span>'
    return WIKILINK_RE.sub(replace, text)


def render_wiki_sections(village, villages_by_slug):
    md = markdown.Markdown(extensions=["fenced_code", "tables", "sane_lists"])
    sections = []
    for page in village["wiki_pages"]:
        text = page["source"]
        # Drop the first H1 (page heading) — we render the page name as section header
        text = re.sub(r"^#\s+.+$", "", text, count=1, flags=re.MULTILINE).lstrip()
        text = resolve_wikilinks(text, villages_by_slug)
        body_html = md.convert(text)
        md.reset()
        sections.append({
            "name": page["name"],
            "anchor": page["name"],
            "title": page["title"],
            "html": body_html,
        })
    return sections


def demo_thumb_svg(demo) -> str:
    title = (demo["title"] or "Untitled").replace("<", "").replace(">", "")
    if len(title) > 36:
        title = title[:33] + "…"
    gid = "g_" + re.sub(r"[^a-z0-9]", "_", demo["filename"].lower())
    return (
        f'<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
        f'<defs><linearGradient id="{gid}" x1="0%" y1="0%" x2="100%" y2="100%">'
        f'<stop offset="0%" stop-color="#0d0d1a"/>'
        f'<stop offset="100%" stop-color="#10101f"/>'
        f'</linearGradient></defs>'
        f'<rect width="320" height="200" fill="url(#{gid})"/>'
        f'<rect x="14" y="14" width="292" height="172" rx="8" '
        f'fill="rgba(129,230,217,0.04)" stroke="rgba(129,230,217,0.3)" stroke-width="1"/>'
        f'<text x="160" y="108" text-anchor="middle" fill="#81e6d9" '
        f'font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600">{title}</text>'
        f'</svg>'
    )


def build():
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir()

    villages = load_all_villages()
    villages_by_slug = {v["slug"]: v for v in villages}

    env = Environment(
        loader=FileSystemLoader(TEMPLATES),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals["humanize_age"] = humanize_age

    type_counts = {"app": 0, "process": 0, "service": 0, "bridge": 0}
    for v in villages:
        type_counts[v["type"]] = type_counts.get(v["type"], 0) + 1
    total_docs = sum(len(v["wiki_pages"]) for v in villages)
    total_demos = sum(len(v["demos"]) for v in villages)

    (BUILD / "index.html").write_text(
        env.get_template("index.html").render(
            villages=villages,
            type_counts=type_counts,
            total_villages=len(villages),
            total_docs=total_docs,
            total_demos=total_demos,
        )
    )

    villages_out = BUILD / "villages"
    villages_out.mkdir()
    for v in villages:
        sections = render_wiki_sections(v, villages_by_slug)
        for d in v["demos"]:
            d["thumb_svg"] = demo_thumb_svg(d)
        (villages_out / f"{v['slug']}.html").write_text(
            env.get_template("village.html").render(
                village=v,
                sections=sections,
                all_villages=villages,
            )
        )
        if v["demos"]:
            demos_out = villages_out / v["slug"] / "demos"
            demos_out.mkdir(parents=True)
            for d in v["demos"]:
                shutil.copy(d["path"], demos_out / d["filename"])

    (BUILD / "search.html").write_text(env.get_template("search.html").render(villages=villages))

    for static in STATIC_FILES:
        src = ROOT / static
        if src.exists():
            shutil.copy(src, BUILD / static)

    print(f"Built {len(villages)} villages → {BUILD}")
    print(f"  {total_docs} wiki pages, {total_demos} demos")
    for v in villages:
        warn = f"  ⚠ missing: {', '.join(v['missing_required'])}" if v["missing_required"] else ""
        print(f"  - {v['slug']} ({v['type']}){warn}")


if __name__ == "__main__":
    build()
