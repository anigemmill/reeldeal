# Connect Claude to Reeldeal (local)

This connects Claude Desktop or Claude Code on your computer to the Reeldeal MCP server running from
this repository. The server runs on your machine over STDIO; nothing is exposed to the internet.

Verified on 15 November 2026 with the Claude Code CLI as the client: it connected, discovered the tools
and called `get_my_workspace`, `search_media` and `get_usage` with a generated development token. Claude
Desktop uses the same configuration format but has not been tried from here.

## 1. One-time setup

Needs Node 22+, Git, and FFmpeg (`brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu,
`winget install ffmpeg` on Windows).

```bash
git clone https://github.com/anigemmill/reeldeal.git
```

```bash
cd reeldeal && git checkout claude/new-session-p7jbcx && npm install
```

Choose where the data lives:

| | What you get | Setup |
|---|---|---|
| **A. Demo (start here)** | Embedded database, local files, two demo workspaces with footage | `npm run dev:setup` |
| **B. Your Supabase and R2** | Your real dev project and bucket | Follow [`infrastructure-setup.md`](infrastructure-setup.md), then `npm run workspace:bootstrap` |

For **A**, `npm run dev:setup` prints where it saved four demo tokens (`.data/dev-tokens.json`). Use
`aroha_owner_full` (owner, can render). For **B**, `workspace:bootstrap` prints a token once.

## 2. Check the token before adding it to Claude

```bash
REELDEAL_MCP_TOKEN=rdl_pat_REPLACE_ME npm run mcp:smoke
```

You should see `✓ connected over STDIO`, the tool list and your workspace. If the token is wrong the
server refuses to start and the smoke test prints `REELDEAL_MCP_TOKEN was rejected (invalid, expired or revoked)`.

## 3a. Claude Desktop

Settings → Developer → Edit Config, then add (use the absolute path of **your** checkout):

```json
{
  "mcpServers": {
    "reeldeal": {
      "command": "/Users/you/code/reeldeal/scripts/mcp-stdio.sh",
      "env": { "REELDEAL_MCP_TOKEN": "rdl_pat_REPLACE_ME" }
    }
  }
}
```

Quit and reopen Claude Desktop. In a new chat, the tools menu lists **reeldeal**.

Windows: `scripts/mcp-stdio.sh` is a bash script, so point at Node directly:

```json
{
  "mcpServers": {
    "reeldeal": {
      "command": "node",
      "args": ["--env-file-if-exists=.env.local", "--conditions=react-server", "--import", "tsx", "src/mcp/stdio.ts"],
      "cwd": "C:\\code\\reeldeal",
      "env": { "REELDEAL_MCP_TOKEN": "rdl_pat_REPLACE_ME" }
    }
  }
}
```

## 3b. Claude Code

From any folder:

```bash
claude mcp add reeldeal --scope user --env REELDEAL_MCP_TOKEN=rdl_pat_REPLACE_ME -- /Users/you/code/reeldeal/scripts/mcp-stdio.sh
```

Then run `/mcp` inside Claude Code: **reeldeal** should show as connected.

## 4. Try it

- "What's in my Reeldeal workspace and how many video credits do I have?"
- "Find footage of the geothermal valley and tell me its quality score."
- "Make a 15 second vertical video for couples booking a summer weekend." Claude writes a brief and
  storyboard, then **shows you the credit cost and waits for your yes** before it renders.

## 5. Optional settings (`.env.local` in the repo)

| Setting | Effect |
|---|---|
| `OPENAI_API_KEY` | Turns on the brief, concepts and storyboard tools (paid OpenAI calls) |
| `DATABASE_URL`, `R2_*`, `SIGNING_SECRET` | Use your Supabase project and R2 bucket instead of the local demo (then run `npm run worker` too) |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Server not listed / "failed to start" | Run the `mcp:smoke` command above: it prints the real error |
| `REELDEAL_MCP_TOKEN was rejected…` | Token expired or revoked. Create one: `npm run mcp:token -- --email <you> --scopes mcp:read,mcp:write,mcp:render` |
| `forbidden: … mcp:render` | The token has no render scope; create one that includes `mcp:render` |
| Analysis or render stays `queued` | With `DATABASE_URL` set, start `npm run worker` (the embedded demo runs one automatically) |
| `capability_unavailable … FFmpeg` | Install FFmpeg and restart Claude |
| Logs | Claude Desktop: Settings → Developer → reeldeal → Open logs. The server writes JSON logs to stderr with tokens redacted |

Revoke a token at any time (takes effect on the next tool call):

```bash
npm run mcp:token -- --revoke <token-id>
```

Remote connection (Claude on the web, other machines) waits for OAuth sign-in; until then the remote
endpoint stays development-only. See [`mcp.md`](mcp.md#remote-streamable-http).
