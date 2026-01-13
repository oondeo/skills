# Managing Conversation Index

Index, archive, and maintain conversations from multiple sources for search.

## Data Sources

The search tool supports four data sources:

1. **Claude Code conversations** - Requires indexing (see below)
2. **OpenCode sessions** - Automatically loaded, no setup required
3. **Goose sessions** - Automatically loaded, no setup required
4. **Memos API** - Requires MCP configuration (see Memos Setup section)

## Quick Start

### Claude Code Conversations

**Install auto-indexing hook:**
```bash
cd ~/.claude/skills/collaboration/remembering-conversations/tool
./install-hook
```

**Index all conversations:**
```bash
./index-conversations
```

### OpenCode Sessions

No setup required. Sessions are automatically loaded from:
- `~/.local/share/opencode/storage/session/` (session metadata)
- `~/.local/share/opencode/storage/message/` (message content)

**Note:** OpenCode message format varies by version. Content extraction is implemented for standard formats, but some sessions may not have extractable content. Results may be empty for some OpenCode sessions.

### Goose Sessions

No setup required. Sessions are automatically loaded from:
- `~/.local/share/goose/sessions/` (JSONL format)

### Memos API

Requires memos-api-mcp configuration. OpenCode sessions are automatically saved to Memos when configured.

## Features

- **Automatic indexing** via sessionEnd hook (install once, forget)
- **Semantic search** across all past conversations
- **AI summaries** (Claude Haiku with Sonnet fallback)
- **Recovery modes** (verify, repair, rebuild)
- **Permanent archive** at `~/.config/superpowers/conversation-archive/`
- **Multi-source search** across Claude Code, OpenCode, Goose, and Memos

## Setup

### 1. Install Hook (One-Time) - Claude Code Only

```bash
cd ~/.claude/skills/collaboration/remembering-conversations/tool
./install-hook
```

Handles existing hooks gracefully (merge or replace). Runs in background after each session.

### 2. Index Existing Conversations - Claude Code Only

```bash
# Index everything
./index-conversations

# Or just unindexed (faster, cheaper)
./index-conversations --cleanup
```

### 3. Configure Memos API - Optional

Ensure memos-api-mcp is configured in your OpenCode config:

```bash
# Check if configured
cat ~/.config/opencode/opencode.json | grep memos-api-mcp
```

Configuration is loaded automatically from:
- `~/.config/opencode/opencode.json` (per-user)
- `/home/opencode/.config/opencode/opencode.json` (opencode user)

Required environment variables in memos-api-mcp config:
- `MEMOS_API_KEY` - Your Memos API key
- `MEMOS_CHANNEL` - Channel identifier (default: MODELSCOPE)
- `MEMOS_USER_ID` - Your user ID

## Index Modes - Claude Code Only

```bash
# Index all (first run or full rebuild)
./index-conversations

# Index specific session (used by hook)
./index-conversations --session <uuid>

# Process only unindexed (missing summaries)
./index-conversations --cleanup

# Check index health
./index-conversations --verify

# Fix detected issues
./index-conversations --repair

# Nuclear option (deletes DB, re-indexes everything)
./index-conversations --rebuild
```

## Recovery Scenarios

| Situation | Command |
|-----------|---------|
| Missed conversations | `--cleanup` |
| Hook didn't run | `--cleanup` |
| Updated conversation | `--verify` then `--repair` |
| Corrupted database | `--rebuild` |
| Index health check | `--verify` |

## Troubleshooting

**Hook not running:**
- Check: `ls -l ~/.claude/hooks/sessionEnd` (should be executable)
- Test: `SESSION_ID=test-$(date +%s) ~/.claude/hooks/sessionEnd`
- Re-install: `./install-hook`

**Summaries failing:**
- Check API key: `echo $ANTHROPIC_API_KEY`
- Check logs in ~/.config/superpowers/conversation-index/
- Try manual: `./index-conversations --session <uuid>`

**Search not finding results:**
- Verify indexed: `./index-conversations --verify`
- Try text search: `./search-conversations --text "exact phrase"`
- Rebuild if needed: `./index-conversations --rebuild`

## Excluding Projects

To exclude specific projects from indexing (e.g., meta-conversations), create:

`~/.config/superpowers/conversation-index/exclude.txt`
```
# One project name per line
# Lines starting with # are comments
-Users-yourname-Documents-some-project
```

Or set env variable:
```bash
export CONVERSATION_SEARCH_EXCLUDE_PROJECTS="project1,project2"
```

## Storage

- **Archive:** `~/.config/superpowers/conversation-archive/<project>/<uuid>.jsonl`
- **Summaries:** `~/.config/superpowers/conversation-archive/<project>/<uuid>-summary.txt`
- **Database:** `~/.config/superpowers/conversation-index/db.sqlite`
- **Exclusions:** `~/.config/superpowers/conversation-index/exclude.txt` (optional)

## Technical Details

- **Embeddings:** @xenova/transformers (all-MiniLM-L6-v2, 384 dimensions, local/free)
- **Vector search:** sqlite-vec (local/free)
- **Summaries:** Claude Haiku with Sonnet fallback (~$0.01-0.02/conversation)
- **Parser:** Handles multi-message exchanges and sidechains

## See Also

- **Searching:** See SKILL.md for search modes (vector, text, time filtering)
- **Deployment:** See DEPLOYMENT.md for production runbook
