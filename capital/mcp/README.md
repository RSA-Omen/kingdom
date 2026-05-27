# Capital MCP

Stdio MCP server exposing the Capital API's capabilities to Claude Code, Claude Desktop, and other MCP clients.

Lifted from `~/admin-center/mcp-server/` on 2026-05-27 as part of the admin-center decommission.

## Tools exposed

Wraps the Capital API with Basic Auth. ~16 tools: `list_containers`, `container_status`, `tail_logs`, `restart_container`, `read_config`, `health_check`, `read_registry`, `write_registry`, `analyze_error`, `scan_logs`, `get_health_history`, `get_usage_stats`, `get_top_apps`, `list_dependencies`, `repair_dependencies`, `get_system_resources`, `get_backup_stats`, `trigger_backup`.

See `src/index.ts` for the full registration.

## Setup

```bash
cd ~/Kingdom/capital/mcp
npm install
npm run build
```

Register in Claude Code / Desktop config to point at `dist/index.js` once built.
