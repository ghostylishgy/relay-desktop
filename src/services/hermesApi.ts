// services/hermesApi.ts

import OpenAI from 'openai';
import { Message, ApiConfig } from '../types';

export class HermesApi {
  private client: OpenAI;
  private config: ApiConfig;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      baseUrl: 'http://127.0.0.1:8642/v1',
      model: 'hermes-agent',
      temperature: 0.7,
      maxTokens: 4096,
      stream: true,
      ...config,
    };

    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey || 'dummy-key', // Hermes doesn't require auth by default
      dangerouslyAllowBrowser: true, // For Tauri context
      timeout: 60000,
      maxRetries: 2,
    });
  }

  async sendMessage(
    messages: Message[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      onToken?: (token: string) => void;
      onToolCall?: (toolCall: any) => void;
    } = {}
  ): Promise<Message> {
    const {
      model = this.config.model,
      temperature = this.config.temperature,
      maxTokens = this.config.maxTokens,
      stream = this.config.stream,
      onToken,
      onToolCall,
    } = options;

    // Convert our Message format to OpenAI format
    const openaiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    if (stream) {
      return this.handleStreamingResponse(openaiMessages, {
        model,
        temperature,
        maxTokens,
        onToken,
        onToolCall,
      });
    } else {
      return this.handleNonStreamingResponse(openaiMessages, {
        model,
        temperature,
        maxTokens,
        onToolCall,
      });
    }
  }

  private async handleStreamingResponse(
    messages: any[],
    options: {
      model: string;
      temperature: number;
      maxTokens: number;
      onToken?: (token: string) => void;
      onToolCall?: (toolCall: any) => void;
    }
  ): Promise<Message> {
    const { model, temperature, maxTokens, onToken, onToolCall } = options;

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = '';
    const toolCalls: any[] = [];
    let usage = { prompt_tokens: 0, completion_tokens: 0 };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        content += delta.content;
        onToken?.(delta.content);
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!toolCalls[toolCall.index]) {
              toolCalls[toolCall.index] = {
                id: toolCall.id,
                name: toolCall.function?.name,
                arguments: '',
              };
            }
            if (toolCall.function?.arguments) {
              toolCalls[toolCall.index].arguments += toolCall.function.arguments;
            }
          }
        }
      }

      // Capture usage from the final chunk
      if ((chunk as any).usage) {
        usage = (chunk as any).usage;
      }
    }

    // Parse tool call arguments (with fallback for incomplete JSON)
    const parsedToolCalls = toolCalls.map(tc => {
      let args = {};
      if (tc.arguments) {
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          args = { _raw: tc.arguments };
        }
      }
      return { ...tc, arguments: args };
    });

    // Notify about tool calls
    for (const toolCall of parsedToolCalls) {
      onToolCall?.(toolCall);
    }

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      tokens: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
      },
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
    };
  }

  private async handleNonStreamingResponse(
    messages: any[],
    options: {
      model: string;
      temperature: number;
      maxTokens: number;
      onToolCall?: (toolCall: any) => void;
    }
  ): Promise<Message> {
    const { model, temperature, maxTokens, onToolCall } = options;

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || '';
    
    const toolCalls = choice?.message?.tool_calls?.filter(tc => tc.type === 'function').map(tc => {
      if (tc.type === 'function') {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = { _raw: tc.function.arguments };
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      }
      return { id: '', name: '', arguments: {} };
    }) || [];

    // Notify about tool calls
    for (const toolCall of toolCalls) {
      onToolCall?.(toolCall);
    }

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      tokens: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
      },
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async getModels(): Promise<{ id: string; object?: string; created?: number; owned_by?: string }[]> {
    try {
      const response = await this.client.models.list();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const url = new URL(this.config.baseUrl);
      url.pathname = '/health';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey || 'dummy-key',
      dangerouslyAllowBrowser: true,
      timeout: 60000,
      maxRetries: 2,
    });
  }
}

// Singleton instance
let hermesApiInstance: HermesApi | null = null;

export const getHermesApi = (config?: Partial<ApiConfig>): HermesApi => {
  if (!hermesApiInstance) {
    hermesApiInstance = new HermesApi(config);
  } else if (config) {
    hermesApiInstance.updateConfig(config);
  }
  return hermesApiInstance;
};