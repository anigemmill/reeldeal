#!/usr/bin/env bash
# Launches the Reeldeal MCP server over STDIO. Point your MCP client (Claude Desktop,
# Claude Code) at this file. It reads REELDEAL_MCP_TOKEN from the client's environment
# and optional settings from .env.local. Logs go to stderr; stdout is the MCP protocol.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node --env-file-if-exists=.env.local --conditions=react-server --import tsx src/mcp/stdio.ts
