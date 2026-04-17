// components/StatusBar/index.tsx

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getHermesApi } from '../../services/hermesApi';
import { Icon } from '../Icon';
import './StatusBar.css';

export function StatusBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state } = useApp();
  const [apiStatus, setApiStatus] = useState<'ok' | 'error' | 'checking'>('checking');

  const activeSession = state.sessions.find(s => s.id === state.activeSessionId);

  // Periodic API health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const api = getHermesApi();
        const healthy = await api.checkHealth();
        setApiStatus(healthy ? 'ok' : 'error');
      } catch {
        setApiStatus('error');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats
  const totalTokens = activeSession
    ? activeSession.totalTokens.input + activeSession.totalTokens.output
    : 0;

  // Session duration
  const getSessionDuration = () => {
    if (!activeSession) return '0m';
    const start = new Date(activeSession.createdAt).getTime();
    const now = Date.now();
    const mins = Math.floor((now - start) / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  // Quick action handlers
  const handleUsageStats = useCallback(() => {
    const total = state.sessions.reduce((sum, s) => {
      return sum + s.totalTokens.input + s.totalTokens.output;
    }, 0);
    const totalMsgs = state.sessions.reduce((sum, s) => sum + s.messages.length, 0);
    alert(`Global Stats:\n\nSessions: ${state.sessions.length}\nTotal Messages: ${totalMsgs}\nTotal Tokens: ${total.toLocaleString()}`);
  }, [state.sessions]);

  const handleSettings = useCallback(() => {
    onOpenSettings();
  }, [onOpenSettings]);

  const handleHelp = useCallback(() => {
    window.open('https://hermes-agent.nousresearch.com/docs', '_blank');
  }, []);

  return (
    <aside className="status-bar">
      {/* Session Stats */}
      <div className="status-section">
        <h3 className="section-title">会话统计</h3>
        
        <div className="stat-grid">
          <div className="stat-item">
            <span className="stat-label">Token 用量</span>
            <span className="stat-value">{totalTokens.toLocaleString()}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">消息数</span>
            <span className="stat-value">
              {activeSession?.messages.length || 0}
            </span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">时长</span>
            <span className="stat-value">{getSessionDuration()}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">模型</span>
            <span className="stat-value model-name">
              {activeSession?.model || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Tools Status */}
      <div className="status-section">
        <h3 className="section-title">工具状态</h3>
        
        <div className="tools-status-list">
          {state.tools.map(tool => (
            <div key={tool.name} className="tool-status-item">
              <div className="tool-info">
                <span className={`status-indicator ${tool.status}`}></span>
                <span className="tool-name">{tool.name}</span>
              </div>
              <span className={`tool-status-badge ${tool.status}`}>
                {tool.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* API Status */}
      <div className="status-section">
        <h3 className="section-title">API 状态</h3>
        
        <div className="api-status">
          <div className="api-endpoint">
            <span className="endpoint-label">接口地址</span>
            <span className="endpoint-value">{state.settings.baseUrl}</span>
          </div>
          
          <div className="api-health">
            <span className={`health-indicator ${apiStatus === 'ok' ? 'ok' : 'error'}`}></span>
            <span className="health-text">
              {apiStatus === 'checking' ? 'Checking...' : apiStatus === 'ok' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {state.error && (
            <div className="api-error">
              {state.error}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="status-section quick-actions">
        <button className="quick-action-btn" onClick={handleUsageStats}>
          <Icon name="dashboard" size={16} className="action-icon" />
          <span>使用统计</span>
        </button>
        
        <button className="quick-action-btn" onClick={handleSettings}>
          <Icon name="settings" size={16} className="action-icon" />
          <span>设置</span>
        </button>
        
        <button className="quick-action-btn" onClick={handleHelp}>
          <span className="action-icon">❓</span>
          <span>帮助</span>
        </button>
      </div>
    </aside>
  );
}
