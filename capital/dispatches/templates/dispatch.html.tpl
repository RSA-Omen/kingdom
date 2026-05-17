<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TITLE}} — Kingdom Dispatch</title>
<style>
  /* Void Teal — mirrors capital/dashboard/app/globals.css */
  :root {
    --bg-page: #050510;
    --bg-surface: rgba(8, 8, 32, 0.85);
    --bg-surface-elevated: rgba(10, 10, 42, 0.92);
    --bg-subtle: rgba(129, 230, 217, 0.05);
    --text-primary: #ccfbf1;
    --text-secondary: #5eada3;
    --text-tertiary: #2d6b64;
    --border: rgba(129, 230, 217, 0.15);
    --border-strong: rgba(129, 230, 217, 0.28);
    --accent: #81e6d9;
    --accent-hover: #2dd4bf;
    --accent-fg: #050510;
    --success: #34d399;
    --warning: #fbbf24;
    --danger: #f87171;
    --info: #60a5fa;
    --radius-sm: 0.25rem;
    --radius-lg: 0.5rem;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body {
    background-color: var(--bg-page);
    color: var(--text-primary);
    background-image: url("data:image/svg+xml,%3Csvg width='48' height='84' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='-2' y1='0' x2='50' y2='0' stroke='rgba(129,230,217,0.12)' stroke-width='0.7'/%3E%3Cline x1='-2' y1='42' x2='50' y2='42' stroke='rgba(129,230,217,0.12)' stroke-width='0.7'/%3E%3Cline x1='0' y1='0' x2='24' y2='42' stroke='rgba(129,230,217,0.12)' stroke-width='0.7'/%3E%3Cline x1='48' y1='0' x2='24' y2='42' stroke='rgba(129,230,217,0.12)' stroke-width='0.7'/%3E%3Cline x1='24' y1='42' x2='48' y2='84' stroke='rgba(129,230,217,0.12)' stroke-width='0.7'/%3E%3Cline x1='24' y1='42' x2='0' y2='84' stroke='rgba(129,230,217,0.12)' stroke-width='0.7'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 48px 84px;
    line-height: 1.6;
    min-height: 100vh;
  }
  ::selection { background: var(--accent); color: var(--accent-fg); }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: var(--radius-lg); }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

  .topbar {
    position: sticky; top: 0; z-index: 10;
    background: rgba(5, 5, 16, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .topbar-inner {
    max-width: 760px; margin: 0 auto;
    padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px;
  }
  .topbar a { color: var(--text-secondary); text-decoration: none; }
  .topbar a:hover { color: var(--accent); }
  .topbar .crown {
    color: var(--accent); font-weight: 600; letter-spacing: 0.02em;
  }

  main {
    max-width: 760px; margin: 0 auto;
    padding: 48px 24px 96px;
  }
  .meta-top {
    color: var(--text-tertiary);
    font-size: 12px; font-family: "JetBrains Mono", ui-monospace, monospace;
    text-transform: uppercase; letter-spacing: 0.1em;
    margin-bottom: 12px;
  }
  h1 {
    font-size: 36px; font-weight: 600; line-height: 1.2;
    margin: 0 0 16px;
    color: var(--text-primary);
  }
  .lede {
    font-size: 18px; color: var(--text-secondary);
    margin: 0 0 32px;
  }

  .audience {
    margin: 32px 0;
    padding: 28px;
    background: var(--bg-surface);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: 0 1px 16px 0 rgba(0, 0, 0, 0.3);
  }
  .audience h2 {
    margin: 0 0 16px;
    font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--accent);
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }
  .audience-plain { border-left: 2px solid var(--accent); }
  .audience-technical { border-left: 2px solid var(--text-tertiary); }
  .audience-technical h2 { color: var(--text-secondary); }

  h3 {
    font-size: 18px; font-weight: 600;
    margin: 28px 0 12px;
    color: var(--text-primary);
  }
  p, ul, ol { margin: 0 0 16px; }
  p { color: var(--text-primary); }
  ul, ol { padding-left: 24px; }
  li { margin: 6px 0; }
  strong { color: var(--text-primary); font-weight: 600; }
  em { color: var(--text-secondary); font-style: italic; }
  a {
    color: var(--accent); text-decoration: none;
    border-bottom: 1px solid var(--border);
    transition: border-color 0.15s, color 0.15s;
  }
  a:hover { color: var(--accent-hover); border-bottom-color: var(--accent); }

  code {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 13px;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    color: var(--accent);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }
  pre {
    background: var(--bg-surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    overflow-x: auto;
    margin: 16px 0;
  }
  pre code {
    background: transparent; border: none; padding: 0;
    color: var(--text-primary);
    font-size: 13px;
  }

  table {
    width: 100%; border-collapse: collapse;
    margin: 20px 0;
    font-size: 14px;
  }
  th, td {
    text-align: left; padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-weight: 600; color: var(--text-secondary);
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
  }

  blockquote {
    margin: 20px 0;
    padding: 12px 20px;
    border-left: 2px solid var(--accent);
    background: var(--bg-subtle);
    color: var(--text-secondary);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .badge {
    display: inline-block;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 11px; font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    margin-right: 6px;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .badge-accent { color: var(--accent); border-color: var(--border-strong); }
  .badge-success { color: var(--success); border-color: rgba(52, 211, 153, 0.3); }
  .badge-warning { color: var(--warning); border-color: rgba(251, 191, 36, 0.3); }
  .badge-danger { color: var(--danger); border-color: rgba(248, 113, 113, 0.3); }

  hr {
    border: none; height: 1px;
    background: var(--border);
    margin: 48px 0;
  }

  footer {
    margin-top: 64px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    color: var(--text-tertiary);
    font-size: 12px;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }
  footer dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
  footer dt { color: var(--text-tertiary); }
  footer dd { margin: 0; color: var(--text-secondary); }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-inner">
    <a href="./" class="crown">⌂ Kingdom Dispatches</a>
    <span>{{DATE_HUMAN}}</span>
  </div>
</div>

<main>
  <div class="meta-top">{{DISPATCH_KIND}} · {{DATE_ISO}}</div>
  <h1>{{TITLE}}</h1>
  <p class="lede">{{LEDE}}</p>

  <section class="audience audience-plain">
    <h2>In plain English</h2>
    {{PLAIN_BODY}}
  </section>

  <section class="audience audience-technical">
    <h2>Technical detail</h2>
    {{TECHNICAL_BODY}}
  </section>

  <footer>
    <dl>
      <dt>Source</dt><dd>{{SOURCE}}</dd>
      <dt>Generated</dt><dd>{{GENERATED_AT}}</dd>
      <dt>Author</dt><dd>{{AUTHOR}}</dd>
    </dl>
  </footer>
</main>

</body>
</html>
