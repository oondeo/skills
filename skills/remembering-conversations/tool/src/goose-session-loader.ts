import fs from 'fs';
import path from 'path';
import os from 'os';
import { GooseSession, GooseMessage, ConversationExchange, DataSource } from './types.js';

export interface GooseExchange extends ConversationExchange {
  source: 'goose';
}

const GOOSE_SESSION_DIR = path.join(os.homedir(), '.local', 'share', 'goose', 'sessions');

export async function listGooseSessions(): Promise<string[]> {
  if (!fs.existsSync(GOOSE_SESSION_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(GOOSE_SESSION_DIR);
  return entries
    .filter(entry => entry.endsWith('.jsonl'))
    .map(entry => path.join(GOOSE_SESSION_DIR, entry));
}

export async function loadGooseSession(sessionPath: string): Promise<{
  session: GooseSession;
  messages: GooseMessage[];
} | null> {
  try {
    const content = fs.readFileSync(sessionPath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length === 0) {
      return null;
    }

    const session = JSON.parse(lines[0]) as GooseSession;
    const messages: GooseMessage[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        try {
          const message = JSON.parse(line) as GooseMessage;
          messages.push(message);
        } catch (error) {
          console.error(`Error parsing goose message at line ${i}:`, error);
        }
      }
    }

    return { session, messages };
  } catch (error) {
    console.error(`Error loading Goose session from ${sessionPath}:`, error);
    return null;
  }
}

export async function convertToExchanges(
  session: GooseSession,
  messages: GooseMessage[]
): Promise<GooseExchange[]> {
  const exchanges: GooseExchange[] = [];
  let currentUserMessage: GooseMessage | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      currentUserMessage = message;
    } else if (message.role === 'assistant' && currentUserMessage) {
      const userContent = extractContentText(currentUserMessage.content);
      const assistantContent = extractContentText(message.content);

      if (userContent || assistantContent) {
        const timestamp = new Date(currentUserMessage.created * 1000).toISOString().split('T')[0];
        const project = path.basename(sessionPath, '.jsonl');

        exchanges.push({
          id: message.created.toString(),
          project,
          timestamp,
          userMessage: userContent,
          assistantMessage: assistantContent,
          archivePath: sessionPath,
          lineStart: 0,
          lineEnd: 0,
          source: 'goose'
        });
      }

      currentUserMessage = null;
    }
  }

  return exchanges;
}

function extractContentText(content: Array<{ type: string; text: string }>): string {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  return content
    .filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n');
}

export async function getAllGooseExchanges(): Promise<GooseExchange[]> {
  const sessionPaths = await listGooseSessions();
  const allExchanges: GooseExchange[] = [];

  for (const sessionPath of sessionPaths) {
    const data = await loadGooseSession(sessionPath);
    if (!data) continue;

    const exchanges = await convertToExchanges(data.session, data.messages);
    allExchanges.push(...exchanges);
  }

  return allExchanges;
}

export async function searchGooseSessions(
  query: string,
  limit: number = 10,
  after?: string,
  before?: string
): Promise<GooseExchange[]> {
  const allExchanges = await getAllGooseExchanges();

  let filtered = allExchanges;

  if (after) {
    filtered = filtered.filter(e => e.timestamp >= after);
  }

  if (before) {
    filtered = filtered.filter(e => e.timestamp <= before);
  }

  const queryLower = query.toLowerCase();
  const scored = filtered
    .map(exchange => {
      const userMatch = exchange.userMessage.toLowerCase().includes(queryLower);
      const assistantMatch = exchange.assistantMessage.toLowerCase().includes(queryLower);
      const score = userMatch ? 2 : assistantMatch ? 1 : 0;
      return { exchange, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.exchange);

  return scored;
}
