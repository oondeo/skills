import fs from 'fs';
import path from 'path';
import os from 'os';
import { OpenCodeSession, OpenCodeMessage, ConversationExchange, DataSource } from './types.js';

export interface OpenCodeExchange extends ConversationExchange {
  source: 'opencode';
}

const OPENCODE_STORAGE_BASE = path.join(os.homedir(), '.local', 'share', 'opencode', 'storage');
const OPENCODE_SESSION_DIR = path.join(OPENCODE_STORAGE_BASE, 'session');
const OPENCODE_MESSAGE_DIR = path.join(OPENCODE_STORAGE_BASE, 'message');

export async function listOpenCodeSessions(): Promise<string[]> {
  const sessions: string[] = [];

  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('ses_')) {
          const sessionPath = path.join(dir, entry.name);
          const sessionFile = path.join(sessionPath, entry.name + '.json');

          if (fs.existsSync(sessionFile)) {
            sessions.push(sessionFile);
          }
        } else {
          scanDirectory(path.join(dir, entry.name));
        }
      }
    }
  }

  scanDirectory(OPENCODE_SESSION_DIR);
  return sessions;
}

export async function loadOpenCodeSession(sessionPath: string): Promise<OpenCodeSession | null> {
  try {
    const content = fs.readFileSync(sessionPath, 'utf-8');
    return JSON.parse(content) as OpenCodeSession;
  } catch (error) {
    console.error(`Error loading OpenCode session from ${sessionPath}:`, error);
    return null;
  }
}

export async function loadOpenCodeMessages(sessionID: string): Promise<OpenCodeMessage[]> {
  const messageDir = path.join(OPENCODE_MESSAGE_DIR, sessionID);

  if (!fs.existsSync(messageDir)) {
    return [];
  }

  const messages: OpenCodeMessage[] = [];
  const entries = fs.readdirSync(messageDir);

  for (const entry of entries) {
    if (entry.startsWith('msg_') && entry.endsWith('.json')) {
      try {
        const messagePath = path.join(messageDir, entry);
        const content = fs.readFileSync(messagePath, 'utf-8');
        const message = JSON.parse(content) as OpenCodeMessage;
        messages.push(message);
      } catch (error) {
        console.error(`Error loading OpenCode message ${entry}:`, error);
      }
    }
  }

  return messages.sort((a, b) => a.time.created - b.time.created);
}

export async function convertToExchanges(
  session: OpenCodeSession,
  messages: OpenCodeMessage[]
): Promise<OpenCodeExchange[]> {
  const exchanges: OpenCodeExchange[] = [];
  let currentUserMessage: OpenCodeMessage | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      currentUserMessage = message;
    } else if (message.role === 'assistant' && currentUserMessage) {
      const userContent = extractContentText(currentUserMessage.content);
      const assistantContent = extractContentText(message.content);

      if (userContent || assistantContent) {
        const timestamp = new Date(currentUserMessage.time.created).toISOString().split('T')[0];
        const project = session.projectID || 'unknown';

        exchanges.push({
          id: message.id,
          project,
          timestamp,
          userMessage: userContent,
          assistantMessage: assistantContent,
          archivePath: sessionPathToArchive(session.id),
          lineStart: 0,
          lineEnd: 0,
          source: 'opencode'
        });
      }

      currentUserMessage = null;
    }
  }

  return exchanges;
}

function extractContentText(content: any[] | undefined): string {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  return content
    .filter(item => {
      if (item.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
      return '';
    })
    .join('\n');
}

function sessionPathToArchive(sessionID: string): string {
  return path.join(OPENCODE_SESSION_DIR, sessionID, `${sessionID}.json`);
}

export async function getAllOpenCodeExchanges(): Promise<OpenCodeExchange[]> {
  const sessionPaths = await listOpenCodeSessions();
  const allExchanges: OpenCodeExchange[] = [];

  for (const sessionPath of sessionPaths) {
    const session = await loadOpenCodeSession(sessionPath);
    if (!session) continue;

    const messages = await loadOpenCodeMessages(session.id);
    const exchanges = await convertToExchanges(session, messages);

    allExchanges.push(...exchanges);
  }

  return allExchanges;
}

export async function searchOpenCodeSessions(
  query: string,
  limit: number = 10,
  after?: string,
  before?: string
): Promise<OpenCodeExchange[]> {
  const allExchanges = await getAllOpenCodeExchanges();

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
