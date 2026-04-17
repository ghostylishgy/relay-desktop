// types/index.ts

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: {
    input: number;
    output: number;
  };
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: string;
  error?: string;
  duration?: number;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
  totalTokens: {
    input: number;
    output: number;
  };
  totalCost: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export interface ToolStatus {
  name: string;
  enabled: boolean;
  status: 'online' | 'offline' | 'error';
  lastUsed?: Date;
}

export interface AppState {
  sessions: Session[];
  activeSessionId: string | null;
  models: ModelInfo[];
  currentModel: string;
  theme: 'dark' | 'light' | 'system';
  tools: ToolStatus[];
  isLoading: boolean;
  error: string | null;
  settings: SettingsState;
  toasts: Toast[];
}

export interface SettingsState {
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
}

export interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  averageResponseTime: number;
  sessionsCount: number;
  messagesCount: number;
}

export interface Toast {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}