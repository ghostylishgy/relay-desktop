import { useMemo } from 'react';
import { Session, UsageStats } from '../../types';
import './styles.css';

interface DashboardProps {
  visible: boolean;
  onToggle: () => void;
  sessions: Session[];
}

function calculateStats(sessions: Session[]): UsageStats {
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;
  let messagesCount = 0;
  let totalResponseTime = 0;
  let responseCount = 0;

  for (const session of sessions) {
    inputTokens += session.totalTokens?.input || 0;
    outputTokens += session.totalTokens?.output || 0;
    totalCost += session.totalCost || 0;
    messagesCount += session.messages?.length || 0;

    // Estimate response time from messages (if available)
    if (session.messages) {
      for (let i = 1; i < session.messages.length; i++) {
        const prev = session.messages[i - 1];
        const curr = session.messages[i];
        if (prev.role === 'user' && curr.role === 'assistant') {
          const prevTime = new Date(prev.timestamp).getTime();
          const currTime = new Date(curr.timestamp).getTime();
          if (currTime > prevTime) {
            totalResponseTime += (currTime - prevTime);
            responseCount++;
          }
        }
      }
    }
  }

  totalTokens = inputTokens + outputTokens;

  return {
    totalTokens,
    inputTokens,
    outputTokens,
    totalCost,
    averageResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount / 1000) : 0,
    sessionsCount: sessions.length,
    messagesCount,
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  return '$' + cost.toFixed(4);
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function Dashboard({ visible, onToggle, sessions }: DashboardProps) {
  const stats = useMemo(() => calculateStats(sessions), [sessions]);

  if (!visible) {
    return (
      <div className="dashboard-toggle" onClick={onToggle}>
        <span>📊</span>
        <span>统计</span>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-header">
        <span className="dashboard-title">使用统计</span>
        <button className="dashboard-btn" onClick={onToggle} title="关闭">×</button>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-grid">
          {/* Token 用量 */}
          <div className="dashboard-card">
            <div className="dashboard-card-icon">🪙</div>
            <div className="dashboard-card-body">
              <div className="dashboard-card-value">{formatNumber(stats.totalTokens)}</div>
              <div className="dashboard-card-label">总 Token</div>
              <div className="dashboard-card-sub">
                <span>输入: {formatNumber(stats.inputTokens)}</span>
                <span>输出: {formatNumber(stats.outputTokens)}</span>
              </div>
            </div>
          </div>

          {/* 累计成本 */}
          <div className="dashboard-card">
            <div className="dashboard-card-icon">💰</div>
            <div className="dashboard-card-body">
              <div className="dashboard-card-value">{formatCost(stats.totalCost)}</div>
              <div className="dashboard-card-label">累计成本</div>
            </div>
          </div>

          {/* Session 数 */}
          <div className="dashboard-card">
            <div className="dashboard-card-icon">📁</div>
            <div className="dashboard-card-body">
              <div className="dashboard-card-value">{stats.sessionsCount}</div>
              <div className="dashboard-card-label">会话数</div>
            </div>
          </div>

          {/* 消息数 */}
          <div className="dashboard-card">
            <div className="dashboard-card-icon">💬</div>
            <div className="dashboard-card-body">
              <div className="dashboard-card-value">{formatNumber(stats.messagesCount)}</div>
              <div className="dashboard-card-label">总消息</div>
            </div>
          </div>

          {/* 平均响应时间 */}
          <div className="dashboard-card">
            <div className="dashboard-card-icon">⏱️</div>
            <div className="dashboard-card-body">
              <div className="dashboard-card-value">
                {stats.averageResponseTime > 0 ? formatTime(stats.averageResponseTime) : '-'}
              </div>
              <div className="dashboard-card-label">平均响应</div>
            </div>
          </div>

          {/* 每条消息平均 Token */}
          <div className="dashboard-card">
            <div className="dashboard-card-icon">📈</div>
            <div className="dashboard-card-body">
              <div className="dashboard-card-value">
                {stats.messagesCount > 0 ? formatNumber(Math.round(stats.totalTokens / stats.messagesCount)) : '-'}
              </div>
              <div className="dashboard-card-label">消息均 Token</div>
            </div>
          </div>
        </div>

        {/* Session 列表统计 */}
        {sessions.length > 0 && (
          <div className="dashboard-sessions">
            <div className="dashboard-section-title">各会话统计</div>
            <div className="dashboard-session-list">
              {[...sessions]
                .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
                .slice(0, 5)
                .map(session => (
                  <div key={session.id} className="dashboard-session-item">
                    <span className="dashboard-session-name" title={session.title}>
                      {session.title.length > 20 ? session.title.slice(0, 18) + '…' : session.title}
                    </span>
                    <span className="dashboard-session-tokens">
                      {formatNumber((session.totalTokens?.input || 0) + (session.totalTokens?.output || 0))} tokens
                    </span>
                    <span className="dashboard-session-cost">
                      {formatCost(session.totalCost || 0)}
                    </span>
                  </div>
                ))}
              {sessions.length > 5 && (
                <div className="dashboard-session-more">
                  还有 {sessions.length - 5} 个会话...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
