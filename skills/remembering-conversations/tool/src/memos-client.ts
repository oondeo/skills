import https from 'https';
import { ConversationExchange, DataSource, MemosMemory } from './types.js';

export interface MemosExchange extends ConversationExchange {
  source: 'memos';
}

export interface MemosSearchResult {
  memory: MemosMemory;
  exchange: MemosExchange;
  similarity: number;
}

const MEMOS_CONFIG = {
  API_KEY: process.env.MEMOS_API_KEY || '',
  CHANNEL: process.env.MEMOS_CHANNEL || 'MODELSCOPE',
  USER_ID: process.env.MEMOS_USER_ID || '',
  BASE_URL: process.env.MEMOS_BASE_URL || 'https://api.memos.ai'
};

function loadMemosConfig(): boolean {
  const configPath = `${process.env.HOME || process.env.USERPROFILE}/.config/opencode/opencode.json`;

  try {
    const fs = require('fs');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (config.mcp?.['memos-api-mcp']?.environment) {
      const env = config.mcp['memos-api-mcp'].environment;
      MEMOS_CONFIG.API_KEY = env.MEMOS_API_KEY || '';
      MEMOS_CONFIG.CHANNEL = env.MEMOS_CHANNEL || 'MODELSCOPE';
      MEMOS_CONFIG.USER_ID = env.MEMOS_USER_ID || '';
      return true;
    }
  } catch (error) {
    console.error('Error loading memos config:', error);
    return false;
  }

  return false;
}

export async function searchMemosMemories(
  query: string,
  limit: number = 10,
  after?: string,
  before?: string
): Promise<MemosSearchResult[]> {
  if (!MEMOS_CONFIG.API_KEY) {
    loadMemosConfig();
  }

  if (!MEMOS_CONFIG.API_KEY) {
    console.error('Memos API key not configured. Please set up memos-api-mcp in OpenCode config.');
    return [];
  }

  try {
    const memories = await callMemosAPI(query, limit);

    let filtered = memories;

    if (after) {
      const afterDate = new Date(after).getTime() / 1000;
      filtered = filtered.filter(m => m.create_time >= afterDate);
    }

    if (before) {
      const beforeDate = new Date(before).getTime() / 1000;
      filtered = filtered.filter(m => m.create_time <= beforeDate);
    }

    return filtered.map(memory => memoryToExchange(memory, query));
  } catch (error) {
    console.error('Error searching memos:', error);
    return [];
  }
}

function memoryToExchange(memory: MemosMemory, query: string): MemosSearchResult {
  const timestamp = new Date(memory.create_time * 1000).toISOString().split('T')[0];
  const project = memory.tags?.join(', ') || 'memos';

  const exchange: MemosExchange = {
    id: memory.id,
    project,
    timestamp,
    userMessage: memory.memory_value,
    assistantMessage: '',
    archivePath: `memos://${memory.id}`,
    lineStart: 0,
    lineEnd: 0,
    source: 'memos'
  };

  const queryLower = query.toLowerCase();
  const valueLower = memory.memory_value.toLowerCase();
  const keyLower = memory.memory_key.toLowerCase();

  let score = 0;
  if (valueLower.includes(queryLower)) score += 2;
  if (keyLower.includes(queryLower)) score += 1;

  const similarity = score > 0 ? Math.min(score / 3, 1.0) : 0;

  return {
    memory,
    exchange,
    similarity
  };
}

async function callMemosAPI(query: string, limit: number): Promise<MemosMemory[]> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${MEMOS_CONFIG.BASE_URL}/memory/search`);

    const data = JSON.stringify({
      query: query,
      memory_limit_number: limit
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${MEMOS_CONFIG.API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', chunk => {
        body += chunk.toString();
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.code === 0 && response.data?.memory_detail_list) {
            resolve(response.data.memory_detail_list);
          } else {
            reject(new Error(`Memos API error: ${response.message || 'Unknown error'}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    req.write(data);
    req.end();
  });
}

export async function addMemory(
  conversationFirstMessage: string,
  messages: Array<{ role: string; content: string; chat_time?: string }>
): Promise<boolean> {
  if (!MEMOS_CONFIG.API_KEY) {
    loadMemosConfig();
  }

  if (!MEMOS_CONFIG.API_KEY) {
    console.error('Memos API key not configured.');
    return false;
  }

  try {
    const data = JSON.stringify({
      conversation_first_message,
      messages
    });

    const url = new URL(`${MEMOS_CONFIG.BASE_URL}/memory/add_message`);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${MEMOS_CONFIG.API_KEY}`
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', chunk => {
          body += chunk.toString();
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            resolve(response.code === 0);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);

      req.write(data);
      req.end();
    });
  } catch (error) {
    console.error('Error adding memory:', error);
    return false;
  }
}
