// context/AppContext.tsx

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { AppState, Session, Message, ModelInfo, ToolStatus, SettingsState, Toast } from '../types';
import { getHermesApi } from '../services/hermesApi';
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

// Initial state
const initialState: AppState = {
  sessions: [],
  activeSessionId: null,
  models: [],
  currentModel: 'hermes-agent',
  theme: 'dark',
  tools: [
    { name: 'Terminal', enabled: true, status: 'online' },
    { name: 'Browser', enabled: true, status: 'online' },
    { name: 'File System', enabled: false, status: 'offline' },
    { name: 'Code Execution', enabled: false, status: 'offline' },
  ],
  isLoading: false,
  error: null,
  settings: {
    baseUrl: 'http://127.0.0.1:8642/v1',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4096,
  },
  toasts: [],
};

// Action types
type AppAction =
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'UPDATE_SESSION'; payload: { id: string; updates: Partial<Session> } }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | null }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { sessionId: string; messageId: string; updates: Partial<Message> } }
  | { type: 'SET_MODELS'; payload: ModelInfo[] }
  | { type: 'SET_CURRENT_MODEL'; payload: string }
  | { type: 'SET_THEME'; payload: 'dark' | 'light' | 'system' }
  | { type: 'UPDATE_TOOL'; payload: { name: string; updates: Partial<ToolStatus> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SETTINGS'; payload: Partial<SettingsState> }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    
    case 'ADD_SESSION':
      return { 
        ...state, 
        sessions: [...state.sessions, action.payload],
        activeSessionId: action.payload.id,
      };
    
    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.id
            ? { ...session, ...action.payload.updates }
            : session
        ),
      };
    
    case 'DELETE_SESSION':
      const newSessions = state.sessions.filter(s => s.id !== action.payload);
      return {
        ...state,
        sessions: newSessions,
        activeSessionId: state.activeSessionId === action.payload
          ? (newSessions[0]?.id || null)
          : state.activeSessionId,
      };
    
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.sessionId
            ? {
                ...session,
                messages: [...session.messages, action.payload.message],
                updatedAt: new Date(),
                totalTokens: {
                  input: session.totalTokens.input + (action.payload.message.tokens?.input || 0),
                  output: session.totalTokens.output + (action.payload.message.tokens?.output || 0),
                },
              }
            : session
        ),
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.sessionId
            ? {
                ...session,
                messages: session.messages.map(msg =>
                  msg.id === action.payload.messageId
                    ? { ...msg, ...action.payload.updates }
                    : msg
                ),
              }
            : session
        ),
      };
    
    case 'SET_MODELS':
      return { ...state, models: action.payload };
    
    case 'SET_CURRENT_MODEL':
      return { ...state, currentModel: action.payload };
    
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    
    case 'UPDATE_TOOL':
      return {
        ...state,
        tools: state.tools.map(tool =>
          tool.name === action.payload.name
            ? { ...tool, ...action.payload.updates }
            : tool
        ),
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    
    case 'LOAD_STATE':
      return {
        ...state,
        ...action.payload,
        // Preserve defaults for settings if not present in loaded state
        settings: { ...state.settings, ...(action.payload.settings || {}) },
        toasts: [],
      };
    
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  createSession: () => void;
  deleteSession: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  updateTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleTool: (toolName: string) => void;
  exportSession: (format: 'json' | 'markdown') => void;
  importSessions: (file: File) => Promise<void>;
  showToast: (type: Toast['type'], message: string) => void;
  updateSettings: (settings: Partial<SettingsState>) => void;
  editAndResend: (sessionId: string, messageId: string, newContent: string) => Promise<boolean>;
  regenerateLast: (sessionId: string) => Promise<void>;
  retryLastSend: (sessionId: string) => Promise<void>;
  clearSessionMessages: (sessionId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const isLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest sessions ref for async functions to avoid stale closures
  const sessionsRef = useRef(state.sessions);
  useEffect(() => { sessionsRef.current = state.sessions; }, [state.sessions]);

  // Keep latest settings ref
  const settingsRef = useRef(state.settings);
  useEffect(() => { settingsRef.current = state.settings; }, [state.settings]);

  const currentModelRef = useRef(state.currentModel);
  useEffect(() => { currentModelRef.current = state.currentModel; }, [state.currentModel]);

  // Send mutex — prevent concurrent sends
  const sendingRef = useRef(false);

  // Restore Date objects from serialized JSON
  const restoreDates = (sessions: any[]): Session[] =>
    sessions.map((s: any) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
      messages: (s.messages || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));

  // Load state from file (fallback to localStorage)
  useEffect(() => {
    const loadState = async () => {
      let loaded = false;

      // Try file first
      try {
        const content = await readTextFile('hermes-sessions.json', { baseDir: BaseDirectory.AppData });
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.sessions) {
            parsed.sessions = restoreDates(parsed.sessions);
            dispatch({ type: 'LOAD_STATE', payload: parsed });
            loaded = true;
          }
        }
      } catch {
        // File doesn't exist yet, try localStorage
      }

      // Fallback to localStorage
      if (!loaded) {
        try {
          const savedState = localStorage.getItem('hermes-desktop-state');
          if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.sessions) {
              parsed.sessions = restoreDates(parsed.sessions);
              dispatch({ type: 'LOAD_STATE', payload: parsed });
            }
          }
        } catch (error) {
          console.error('Failed to load state:', error);
        }
      }

      isLoadedRef.current = true;
    };

    loadState();
  }, []);

  // Save state to file (debounced 1s) + localStorage backup
  useEffect(() => {
    if (!isLoadedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { toasts, ...toSave } = state;
      const json = JSON.stringify(toSave);

      // Save to file (includes apiKey — file in AppData is acceptable)
      try {
        await writeTextFile('hermes-sessions.json', json, { baseDir: BaseDirectory.AppData });
      } catch (err) {
        console.warn('File save failed, using localStorage:', err);
      }

      // localStorage backup — strip apiKey for security
      try {
        const { apiKey, ...safeSettings } = toSave.settings;
        const safeState = { ...toSave, settings: { ...safeSettings, apiKey: '' } };
        localStorage.setItem('hermes-desktop-state', JSON.stringify(safeState));
      } catch {}
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // Flush save on page unload (window hide / close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isLoadedRef.current) return;
      const { toasts, ...toSave } = state;
      const json = JSON.stringify(toSave);
      try {
        localStorage.setItem('hermes-desktop-state', json);
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // Check API health
  useEffect(() => {
    const checkHealth = async () => {
      const api = getHermesApi();
      const isHealthy = await api.checkHealth();
      if (!isHealthy) {
        dispatch({ type: 'SET_ERROR', payload: 'Hermes API is not available. Please ensure the gateway is running.' });
      }
    };
    checkHealth();
  }, []);

  const createSession = () => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: `Session ${state.sessions.length + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      model: state.currentModel,
      totalTokens: { input: 0, output: 0 },
      totalCost: 0,
    };
    dispatch({ type: 'ADD_SESSION', payload: newSession });
  };

  const deleteSession = (id: string) => {
    dispatch({ type: 'DELETE_SESSION', payload: id });
  };

  const sendMessage = async (content: string) => {
    if (sendingRef.current) {
      showToast('warn', '消息发送中，请稍候');
      return;
    }
    sendingRef.current = true;

    let sessionId = state.activeSessionId;
    const settings = settingsRef.current;
    const currentModel = currentModelRef.current;

    // Auto-create session if none active
    if (!sessionId) {
      const newSession: Session = {
        id: crypto.randomUUID(),
        title: `Session ${sessionsRef.current.length + 1}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        model: currentModel,
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
      };
      dispatch({ type: 'ADD_SESSION', payload: newSession });
      sessionId = newSession.id;
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    dispatch({
      type: 'ADD_MESSAGE',
      payload: { sessionId, message: userMessage },
    });

    // Auto-update title from first user message
    const existingSession = sessionsRef.current.find(s => s.id === sessionId);
    if (existingSession && existingSession.messages.length === 0) {
      dispatch({
        type: 'UPDATE_SESSION',
        payload: {
          id: sessionId,
          updates: { title: content.slice(0, 50) + (content.length > 50 ? '...' : '') },
        },
      });
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const api = getHermesApi({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey || undefined,
        model: currentModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      // Wait for dispatch to sync sessionsRef
      await new Promise(resolve => setTimeout(resolve, 0));

      const latestSession = sessionsRef.current.find(s => s.id === sessionId);
      const messagesForApi = latestSession?.messages || [userMessage];

      const assistantMessage = await api.sendMessage(messagesForApi, {
        model: currentModel,
        stream: false,
      });

      dispatch({
        type: 'ADD_MESSAGE',
        payload: { sessionId, message: assistantMessage },
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to send message. Please try again.' });
      showToast('error', '消息发送失败');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      sendingRef.current = false;
    }
  };

  const updateTheme = (theme: 'dark' | 'light' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const toggleTool = (toolName: string) => {
    const tool = state.tools.find(t => t.name === toolName);
    if (tool) {
      dispatch({
        type: 'UPDATE_TOOL',
        payload: { name: toolName, updates: { enabled: !tool.enabled } },
      });
    }
  };

  const exportSession = (format: 'json' | 'markdown') => {
    if (!state.activeSessionId) return;
    
    const session = state.sessions.find(s => s.id === state.activeSessionId);
    if (!session) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(session, null, 2);
      filename = `hermes-session-${session.id}.json`;
      mimeType = 'application/json';
    } else {
      // Markdown format
      content = `# ${session.title}\n\n`;
      content += `**Model:** ${session.model}\n`;
      content += `**Created:** ${session.createdAt}\n`;
      content += `**Total Tokens:** ${session.totalTokens.input + session.totalTokens.output}\n\n`;
      
      session.messages.forEach(msg => {
        content += `## ${msg.role === 'user' ? 'You' : 'Hermes'}\n`;
        content += `${msg.content}\n\n`;
        if (msg.toolCalls) {
          content += `**Tool Calls:**\n`;
          msg.toolCalls.forEach(tc => {
            content += `- \`${tc.name}\`: ${JSON.stringify(tc.arguments)}\n`;
          });
          content += '\n';
        }
      });
      
      filename = `hermes-session-${session.id}.md`;
      mimeType = 'text/markdown';
    }

    // Create download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showToast = (type: Toast['type'], message: string) => {
    const toast: Toast = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_TOAST', payload: toast });
    // Auto-remove after 5 seconds
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: toast.id });
    }, 5000);
  };

  const updateSettings = (newSettings: Partial<SettingsState>) => {
    dispatch({ type: 'SET_SETTINGS', payload: newSettings });
    // Reinitialize API client with new settings
    const merged = { ...state.settings, ...newSettings };
    getHermesApi({
      baseUrl: merged.baseUrl,
      apiKey: merged.apiKey || undefined,
      temperature: merged.temperature,
      maxTokens: merged.maxTokens,
    });
  };

  const importSessions = async (file: File) => {
    // 10MB size limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast('error', `文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，最大支持 10MB`);
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Support importing single session or array of sessions
      const sessions = Array.isArray(data) ? data : [data];

      let imported = 0;
      for (const raw of sessions) {
        // Validate required fields
        if (!raw.id || !raw.messages || !Array.isArray(raw.messages)) {
          continue;
        }

        // Restore Date objects and generate new ID to avoid conflicts
        const session: Session = {
          id: crypto.randomUUID(),
          title: raw.title || 'Imported Session',
          messages: raw.messages.map((m: any) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role || 'user',
            content: m.content || '',
            timestamp: new Date(m.timestamp || Date.now()),
            tokens: m.tokens,
            toolCalls: m.toolCalls,
          })),
          createdAt: new Date(raw.createdAt || Date.now()),
          updatedAt: new Date(raw.updatedAt || Date.now()),
          model: raw.model || state.currentModel,
          totalTokens: raw.totalTokens || { input: 0, output: 0 },
          totalCost: raw.totalCost || 0,
        };

        dispatch({ type: 'ADD_SESSION', payload: session });
        imported++;
      }

      if (imported > 0) {
        showToast('info', `Imported ${imported} session(s)`);
      } else {
        showToast('error', 'No valid sessions found in file');
      }
    } catch (err) {
      showToast('error', 'Failed to parse import file');
    }
  };

  const editAndResend = async (sessionId: string, messageId: string, newContent: string): Promise<boolean> => {
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (!session) return false;

    const msgIndex = session.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return false;

    const editedMsg = session.messages[msgIndex];
    if (editedMsg.role !== 'user') return false;

    // Calculate tokens to subtract (messages after the edit point)
    const removedTokens = session.messages.slice(msgIndex + 1).reduce(
      (acc, m) => ({
        input: acc.input + (m.tokens?.input || 0),
        output: acc.output + (m.tokens?.output || 0),
      }),
      { input: 0, output: 0 }
    );

    // Truncate messages after the edit point, update content
    const updatedMessages = session.messages.slice(0, msgIndex + 1).map(m =>
      m.id === messageId ? { ...m, content: newContent } : m
    );

    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        id: sessionId,
        updates: {
          messages: updatedMessages,
          totalTokens: {
            input: Math.max(0, session.totalTokens.input - removedTokens.input),
            output: Math.max(0, session.totalTokens.output - removedTokens.output),
          },
          updatedAt: new Date(),
        },
      },
    });

    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const settings = settingsRef.current;
    const currentModel = currentModelRef.current;

    try {
      const api = getHermesApi({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey || undefined,
        model: currentModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const assistantMessage = await api.sendMessage(updatedMessages, {
        model: currentModel,
        stream: false,
      });

      dispatch({
        type: 'ADD_MESSAGE',
        payload: { sessionId, message: assistantMessage },
      });
      return true;
    } catch (error) {
      console.error('Failed to resend:', error);
      showToast('error', 'Failed to resend message');
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const regenerateLast = async (sessionId: string) => {
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (!session || session.messages.length < 2) return;

    const lastMsg = session.messages[session.messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    const messagesWithoutLast = session.messages.slice(0, -1);

    // Subtract tokens from removed assistant message
    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        id: sessionId,
        updates: {
          messages: messagesWithoutLast,
          totalTokens: {
            input: session.totalTokens.input - (lastMsg.tokens?.input || 0),
            output: session.totalTokens.output - (lastMsg.tokens?.output || 0),
          },
          updatedAt: new Date(),
        },
      },
    });

    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const settings = settingsRef.current;
    const currentModel = currentModelRef.current;

    try {
      const api = getHermesApi({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey || undefined,
        model: currentModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const assistantMessage = await api.sendMessage(messagesWithoutLast, {
        model: currentModel,
        stream: false,
      });

      dispatch({
        type: 'ADD_MESSAGE',
        payload: { sessionId, message: assistantMessage },
      });
    } catch (error) {
      console.error('Failed to regenerate:', error);
      showToast('error', 'Failed to regenerate response');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const retryLastSend = async (sessionId: string) => {
    const session = sessionsRef.current.find(s => s.id === sessionId);
    if (!session) return;

    // Find the last user message
    const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove messages after the last user message (failed partial responses)
    const lastUserIndex = session.messages.findIndex(m => m.id === lastUserMsg.id);
    const messagesUpToUser = session.messages.slice(0, lastUserIndex + 1);

    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        id: sessionId,
        updates: { messages: messagesUpToUser, updatedAt: new Date() },
      },
    });

    // Direct API call using local snapshot — bypasses sessionsRef sync issues
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    const settings = settingsRef.current;
    const currentModel = currentModelRef.current;

    try {
      const api = getHermesApi({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey || undefined,
        model: currentModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const assistantMessage = await api.sendMessage(messagesUpToUser, {
        model: currentModel,
        stream: false,
      });

      dispatch({
        type: 'ADD_MESSAGE',
        payload: { sessionId, message: assistantMessage },
      });
    } catch (error) {
      console.error('Failed to retry:', error);
      showToast('error', '重试失败');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const clearSessionMessages = (sessionId: string) => {
    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        id: sessionId,
        updates: {
          messages: [],
          totalTokens: { input: 0, output: 0 },
          totalCost: 0,
          updatedAt: new Date(),
        },
      },
    });
    showToast('info', '会话已清空');
  };

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      createSession,
      deleteSession,
      sendMessage,
      updateTheme,
      toggleTool,
      exportSession,
      importSessions,
      showToast,
      updateSettings,
      editAndResend,
      regenerateLast,
      retryLastSend,
      clearSessionMessages,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}