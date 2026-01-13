import Database from 'better-sqlite3';
import { initDatabase } from './db.js';
import { initEmbeddings, generateEmbedding } from './embeddings.js';
import { SearchResult, ConversationExchange, DataSource } from './types.js';
import fs from 'fs';
import { searchOpenCodeSessions } from './opencode-session-loader.js';
import { searchGooseSessions } from './goose-session-loader.js';
import { searchMemosMemories, MemosSearchResult } from './memos-client.js';

export interface SearchOptions {
  limit?: number;
  mode?: 'vector' | 'text' | 'both';
  after?: string;  // ISO date string
  before?: string; // ISO date string
  sources?: DataSource[];  // Filter by data sources
}

function validateISODate(dateStr: string, paramName: string): void {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateStr)) {
    throw new Error(`Invalid ${paramName} date: "${dateStr}". Expected YYYY-MM-DD format (e.g., 2025-10-01)`);
  }
  // Verify it's actually a valid date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${paramName} date: "${dateStr}". Not a valid calendar date.`);
  }
}

export async function searchConversations(
  query: string,
  options: SearchOptions = {}
): Promise<(SearchResult & { source: DataSource })[]> {
  const { limit = 10, mode = 'vector', after, before, sources = ['all'] } = options;

  // Validate date parameters
  if (after) validateISODate(after, '--after');
  if (before) validateISODate(before, '--before');

  const allResults: Array<SearchResult & { source: DataSource }> = [];

  const sourcesToSearch = sources.includes('all')
    ? ['claude-code', 'opencode', 'goose', 'memos'] as DataSource[]
    : sources;

  for (const source of sourcesToSearch) {
    if (source === 'claude-code') {
      const claudeResults = await searchClaudeCode(query, mode, limit, after, before);
      allResults.push(...claudeResults.map(r => ({ ...r, source: 'claude-code' as const })));
    } else if (source === 'opencode') {
      const opencodeResults = await searchOpenCodeSessions(query, limit, after, before);
      allResults.push(...opencodeResults.map(r => ({
        exchange: r,
        similarity: 1,
        snippet: r.userMessage.substring(0, 200),
        source: 'opencode' as const
      })));
    } else if (source === 'goose') {
      const gooseResults = await searchGooseSessions(query, limit, after, before);
      allResults.push(...gooseResults.map(r => ({
        exchange: r,
        similarity: 1,
        snippet: r.userMessage.substring(0, 200),
        source: 'goose' as const
      })));
    } else if (source === 'memos') {
      const memosResults = await searchMemosMemories(query, limit, after, before);
      allResults.push(...memosResults.map(mr => ({
        exchange: mr.exchange,
        similarity: mr.similarity,
        snippet: mr.exchange.userMessage.substring(0, 200),
        source: 'memos' as const
      })));
    }
  }

  const sorted = allResults
    .sort((a, b) => {
      if (mode === 'text') {
        return new Date(b.exchange.timestamp).getTime() - new Date(a.exchange.timestamp).getTime();
      }
      return (b.similarity || 0) - (a.similarity || 0);
    })
    .slice(0, limit);

  return sorted;
}

async function searchClaudeCode(
  query: string,
  mode: 'vector' | 'text' | 'both',
  limit: number,
  after?: string,
  before?: string
): Promise<SearchResult[]> {
  const db = initDatabase();

  let results: any[] = [];

  const timeFilter = [];
  if (after) timeFilter.push(`e.timestamp >= '${after}'`);
  if (before) timeFilter.push(`e.timestamp <= '${before}'`);
  const timeClause = timeFilter.length > 0 ? `AND ${timeFilter.join(' AND ')}` : '';

  if (mode === 'vector' || mode === 'both') {
    await initEmbeddings();
    const queryEmbedding = await generateEmbedding(query);

    const stmt = db.prepare(`
      SELECT
        e.id,
        e.project,
        e.timestamp,
        e.user_message,
        e.assistant_message,
        e.archive_path,
        e.line_start,
        e.line_end,
        vec.distance
      FROM vec_exchanges AS vec
      JOIN exchanges AS e ON vec.id = e.id
      WHERE vec.embedding MATCH ?
        AND k = ?
        ${timeClause}
      ORDER BY vec.distance ASC
    `);

    results = stmt.all(
      Buffer.from(new Float32Array(queryEmbedding).buffer),
      limit
    );
  }

  if (mode === 'text' || mode === 'both') {
    const textStmt = db.prepare(`
      SELECT
        e.id,
        e.project,
        e.timestamp,
        e.user_message,
        e.assistant_message,
        e.archive_path,
        e.line_start,
        e.line_end,
        0 as distance
      FROM exchanges AS e
      WHERE (e.user_message LIKE ? OR e.assistant_message LIKE ?)
        ${timeClause}
      ORDER BY e.timestamp DESC
      LIMIT ?
    `);

    const textResults = textStmt.all(`%${query}%`, `%${query}%`, limit);

    if (mode === 'both') {
      const seenIds = new Set(results.map(r => r.id));
      for (const textResult of textResults) {
        if (!seenIds.has(textResult.id)) {
          results.push(textResult);
        }
      }
    } else {
      results = textResults;
    }
  }

  db.close();

  return results.map((row: any) => {
    const exchange: ConversationExchange = {
      id: row.id,
      project: row.project,
      timestamp: row.timestamp,
      userMessage: row.user_message,
      assistantMessage: row.assistant_message,
      archivePath: row.archive_path,
      lineStart: row.line_start,
      lineEnd: row.line_end
    };

    const summaryPath = row.archive_path.replace('.jsonl', '-summary.txt');
    let summary: string | undefined;
    if (fs.existsSync(summaryPath)) {
      summary = fs.readFileSync(summaryPath, 'utf-8').trim();
    }

    const snippet = exchange.userMessage.substring(0, 200) +
      (exchange.userMessage.length > 200 ? '...' : '');

    return {
      exchange,
      similarity: mode === 'text' ? undefined : 1 - row.distance,
      snippet,
      summary
    } as SearchResult & { summary?: string };
  });
}

export function formatResults(results: Array<(SearchResult & { summary?: string; source: DataSource })>): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  let output = `Found ${results.length} relevant conversations:\n\n`;

  results.forEach((result, index) => {
    const date = new Date(result.exchange.timestamp).toISOString().split('T')[0];
    const sourceLabel = result.source ? `[${result.source}] ` : '';
    output += `${index + 1}. ${sourceLabel}[${result.exchange.project}, ${date}]\n`;

    if (result.summary) {
      output += `   ${result.summary}\n\n`;
    }

    if (result.similarity !== undefined) {
      const pct = Math.round(result.similarity * 100);
      output += `   ${pct}% match: "${result.snippet}"\n`;
    } else {
      output += `   Match: "${result.snippet}"\n`;
    }

    const location = result.exchange.archivePath.startsWith('memos://')
      ? result.exchange.archivePath
      : `${result.exchange.archivePath}:${result.exchange.lineStart}-${result.exchange.lineEnd}`;
    output += `   ${location}\n\n`;
  });

  return output;
}
