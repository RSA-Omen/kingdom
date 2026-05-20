# The Scriptorium

The Kingdom's documentation + design-demo village. One page per village (an
app, service, process, or bridge in the Kingdom), with a **wiki** on top and
a gallery of **HTML demos** on the bottom.

Live at `http://gvdi-30:8095/`.

The rules for what every village owes the Scriptorium are codified in
`docs/GEKKO_STANDARD.md` Section 15 — village-type taxonomy and mandatory
wiki posts per type.

---

## How this folder is organised

```
scriptorium/
├── build.py              # the renderer (this folder's main entry point)
├── requirements.txt      # python deps (jinja2, markdown, pyyaml)
├── styles.css            # shared Void Teal stylesheet (copied into build/)
├── scriptorium.js        # ⌘K focus + Enter → search.html
├── content/
│   └── villages/<slug>/
│       ├── meta.yml      # village info — see Standard §15.2
│       ├── wiki/         # markdown pages — see Standard §15.4
│       └── demos/        # HTML demos — see Standard §15.5
├── templates/            # Jinja2 templates the renderer uses
│   ├── index.html        # homepage with village grid
│   ├── village.html      # a single village's page (wiki + demos)
│   └── search.html       # search-results placeholder
└── build/                # generated output (gitignored, deployed)
```

The static HTML files at `scriptorium/` root (`index.html`, `village.html`,
`demo.html`, `search.html`) are the original design prototype from the
claude.ai/design handoff. They will be removed in a follow-up; the renderer
+ templates replace them.

---

## Building

```sh
# one-time setup
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# build
.venv/bin/python build.py
```

Output lands in `build/`. The renderer prints a summary including any
required wiki posts missing per the Standard.

---

## Deploying

The site is served by nginx from `~/reports/` on port 8095. To deploy:

```sh
cp -r build/* ~/reports/
```

The existing dispatches at `~/reports/Kingdom/` and the legacy reports listing
at `~/reports/legacy-reports.html` are not touched by this and stay
accessible.

There is no automated build/deploy yet. The follow-up is an `inotifywait`
watcher service that rebuilds on commit.

---

## Adding or editing content from any Claude Code session

Per the Standard (Section 15.7), Scriptorium edits land in the Kingdom repo,
not in the village's own repo.

1. Edit the relevant file under `scriptorium/content/villages/<slug>/`
2. Commit in the Kingdom repo with a message prefix:
   - `wiki(<slug>): <change>` for wiki edits
   - `demo(<slug>): <description>` for a new demo
3. Push the Kingdom repo
4. Run the renderer and redeploy (until the watcher service lands)
