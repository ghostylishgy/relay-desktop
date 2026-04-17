// components/Sidebar/index.tsx

import { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getHermesApi } from '../../services/hermesApi';
import { Icon } from '../Icon';
import './Sidebar.css';

export function Sidebar() {
  const { state, dispatch, createSession, deleteSession, updateTheme, toggleTool, importSessions, exportSession, clearSessionMessages } = useApp();
  const [availableModels, setAvailableModels] = useState<string[]>(['hermes-agent']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load available models from API
  useEffect(() => {
    const loadModels = async () => {
      try {
        const api = getHermesApi();
        const models = await api.getModels();
        if (models.length > 0) {
          setAvailableModels(models.map(m => m.id));
        }
      } catch (err) {
        console.warn('Could not load models:', err);
      }
    };
    loadModels();
  }, []);

  const handleNewSession = () => {
    createSession();
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const handleClearAll = () => {
    if (state.sessions.length === 0) return;
    if (!window.confirm(`确定清空全部 ${state.sessions.length} 个会话？此操作不可撤销。`)) return;
    dispatch({ type: 'SET_SESSIONS', payload: [] });
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const startRename = (sessionId: string, currentTitle: string) => {
    setRenamingSessionId(sessionId);
    setRenameValue(currentTitle);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const saveRename = () => {
    if (renamingSessionId && renameValue.trim()) {
      dispatch({
        type: 'UPDATE_SESSION',
        payload: { id: renamingSessionId, updates: { title: renameValue.trim() } },
      });
    }
    setRenamingSessionId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingSessionId(null);
    setRenameValue('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importSessions(file);
      // Reset input so same file can be imported again
      e.target.value = '';
    }
  };

  // Format date for session display
  const formatSessionDate = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // Generate session title from first message
  const getSessionTitle = (session: typeof state.sessions[0]) => {
    if (session.title.startsWith('Session ') && session.messages.length > 0) {
      const firstMsg = session.messages[0].content;
      return firstMsg.length > 30 ? firstMsg.slice(0, 30) + '...' : firstMsg;
    }
    return session.title;
  };

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <Icon name="app" size={32} className="sidebar-app-icon" />
        <div className="sidebar-header-text">
          <h1 className="app-title">Hermes Desktop</h1>
          <p className="app-version">v0.1.1</p>
        </div>
      </div>

      {/* Sessions Section */}
      <div className="sidebar-section">
        <div className="section-header">
          <h3>会话 ({state.sessions.length})</h3>
          <div className="section-actions">
            <button className="new-session-btn" onClick={handleNewSession}>
              + 新建
            </button>
            <button className="import-session-btn" onClick={handleImport} title="从 JSON 导入会话">
              Import
            </button>
            {state.activeSessionId && (
              <button
                className="export-session-btn"
                onClick={() => exportSession('markdown')}
                title="导出当前会话为 Markdown"
              >
                Export
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {state.sessions.length > 0 && (
              <button className="clear-sessions-btn" onClick={handleClearAll} title="清空所有会话">
                清空
              </button>
            )}
          </div>
        </div>
        
        <div className="sessions-list">
          {state.sessions.length === 0 ? (
            <div className="no-sessions">暂无会话</div>
          ) : (
            state.sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${state.activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => {
                  if (renamingSessionId !== session.id) {
                    dispatch({ type: 'SET_ACTIVE_SESSION', payload: session.id });
                  }
                }}
              >
                <div className="session-info">
                  {renamingSessionId === session.id ? (
                    <input
                      ref={renameInputRef}
                      className="session-rename-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      onBlur={saveRename}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="session-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(session.id, getSessionTitle(session));
                      }}
                      title="双击重命名"
                    >
                      {getSessionTitle(session)}
                    </span>
                  )}
                  <span className="session-meta">
                    {session.messages.length} 条消息 · {formatSessionDate(session.updatedAt)}
                  </span>
                </div>
                <button
                  className="clear-session-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (session.messages.length > 0) {
                      clearSessionMessages(session.id);
                    }
                  }}
                  title="清空对话"
                  disabled={session.messages.length === 0}
                >
                  🗑
                </button>
                <button
                  className="delete-session-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  title="删除会话"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Model Section */}
      <div className="sidebar-section">
        <h3>模型</h3>
        <div className="model-selector">
          <select
            value={state.currentModel}
            onChange={(e) => dispatch({ type: 'SET_CURRENT_MODEL', payload: e.target.value })}
            className="model-select"
          >
            {availableModels.map(modelId => (
              <option key={modelId} value={modelId}>{modelId}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Theme Section */}
      <div className="sidebar-section">
        <h3>主题</h3>
        <div className="theme-buttons">
          {(['dark', 'light', 'system'] as const).map(theme => (
            <button
              key={theme}
              className={`theme-btn ${state.theme === theme ? 'active' : ''}`}
              onClick={() => updateTheme(theme)}
            >
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Section */}
      <div className="sidebar-section">
        <h3>工具</h3>
        <div className="tools-list">
          {state.tools.map(tool => {
            const iconMap: Record<string, string> = {
              Terminal: 'terminal',
              Browser: 'browser',
              'File System': 'file',
              'Code Execution': 'code',
            };
            return (
              <div key={tool.name} className="tool-item">
                <label className="tool-toggle">
                  <input
                    type="checkbox"
                    checked={tool.enabled}
                    onChange={() => toggleTool(tool.name)}
                  />
                  {iconMap[tool.name] && (
                    <Icon name={iconMap[tool.name] as any} size={16} className="tool-icon" />
                  )}
                  <span className="tool-name">{tool.name}</span>
                </label>
                <span className={`tool-status ${tool.status}`}>
                  {tool.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="footer-links">
          <a href="https://github.com/NousResearch/hermes-agent" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://hermes-agent.nousresearch.com/docs" target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
        </div>
        <p className="footer-text">
          Built with ❤️ using Tauri + React
        </p>
      </div>
    </aside>
  );
}