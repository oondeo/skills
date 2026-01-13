export type DataSource = 'claude-code' | 'opencode' | 'goose' | 'memos' | 'all';

export interface ConversationExchange {
  id: string;
  project: string;
  timestamp: string;
  userMessage: string;
  assistantMessage: string;
  archivePath: string;
  lineStart: number;
  lineEnd: number;
  source?: DataSource;
}

export interface SearchResult {
  exchange: ConversationExchange;
  similarity: number;
  snippet: string;
  source?: DataSource;
}

// OpenCode session types
export interface OpenCodeSession {
  id: string;
  version: string;
  projectID: string;
  directory: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
  summary: {
    additions: number;
    deletions: number;
    files: number;
  };
}

export interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant' | 'system';
  time: {
    created: number;
    completed?: number;
  };
  parentID?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  agent?: string;
  path?: {
    cwd: string;
    root: string;
  };
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  finish?: string;
  content?: any[];
  summary?: {
    diffs: any[];
  };
}

// Goose session types
export interface GooseSession {
  working_dir: string;
  description: string;
  schedule_id: string | null;
  message_count: number;
  total_tokens: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  accumulated_total_tokens: number | null;
  accumulated_input_tokens: number | null;
  accumulated_output_tokens: number | null;
}

export interface GooseMessage {
  role: 'user' | 'assistant' | 'system';
  created: number;
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Memos API types
export interface MemosMemory {
  id: string;
  memory_key: string;
  memory_value: string;
  memory_type: 'UserMemory' | 'LongTermMemory' | 'WorkingMemory';
  create_time: number;
  update_time: number;
  conversation_id: string;
  confidence: number;
  tags: string[];
  status: 'activated' | 'archived';
}
