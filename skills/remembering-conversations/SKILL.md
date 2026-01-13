---
name: Remembering Conversations
description: Search previous conversations from multiple sources (Claude Code, OpenCode, Goose, Memos) for facts, patterns, decisions, and context using semantic or text search
when_to_use: when partner mentions past discussions, debugging familiar issues, or seeking historical context about decisions and patterns
version: 2.0.0
---

# Remembering Conversations

Search archived conversations from multiple sources using semantic similarity or exact text matching.

**Core principle:** Search before reinventing.

**Announce:** "I'm searching previous conversations for [topic]."

**Setup:** See INDEXING.md

## When to Use

**Search when:**
- Your human partner mentions "we discussed this before"
- Debugging similar issues
- Looking for architectural decisions or patterns
- Before implementing something familiar

**Don't search when:**
- Info in current conversation
- Question about current codebase (use Grep/Read)

## In-Session Use

**Always use subagents** (50-100x context savings). See skills/using-skills for workflow.

**Manual/CLI use:** Direct search (below) for humans outside Claude Code sessions.

## Data Sources

The skill searches across four data sources:

1. **Claude Code conversations** - Indexed with vector embeddings (see INDEXING.md)
2. **OpenCode sessions** - Automatically loaded from `~/.local/share/opencode/storage/`
3. **Goose sessions** - Automatically loaded from `~/.local/share/goose/sessions/`
4. **Memos API** - Searches via memos-api-mcp (requires configuration)

## Direct Search (Manual/CLI)

**Tool:** `${SUPERPOWERS_SKILLS_ROOT}/skills/remembering-conversations/tool/search-conversations`

**Modes:**
```bash
search-conversations "query"              # Vector similarity (default)
search-conversations --text "exact"       # Exact string match
search-conversations --both "query"       # Both modes
```

**Flags:**
```bash
--after YYYY-MM-DD    # Filter by date
--before YYYY-MM-DD   # Filter by date
--limit N             # Max results (default: 10)
--source S            # Filter by source: claude-code, opencode, goose, memos, or all (default)
--help                # Full usage
```

**Examples:**
```bash
# Search all sources (default)
search-conversations "React Router authentication errors"

# Search specific source only
search-conversations --source opencode "error handling"
search-conversations --source goose,memos "deployment"

# Find exact string in OpenCode
search-conversations --source opencode --text "a1b2c3d4"

# Time range
search-conversations --after 2025-09-01 "refactoring"

# Combine filters
search-conversations --source opencode,goose --after 2025-09-01 --limit 20 "database"
```

Returns: source, project, date, conversation summary (if available), matched exchange, similarity %, file path or memory ID.

**For details:** Run `search-conversations --help`
