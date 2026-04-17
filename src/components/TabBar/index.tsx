import { useCallback } from 'react';
import { Session } from '../../types';
import './styles.css';

interface TabBarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onActivate: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onNew: () => void;
}

export function TabBar({ sessions, activeSessionId, onActivate, onClose, onNew }: TabBarProps) {
  const handleTabClick = useCallback((sessionId: string, e: React.MouseEvent) => {
    // Middle click to close
    if (e.button === 1) {
      e.preventDefault();
      if (sessions.length > 1) {
        onClose(sessionId);
      }
      return;
    }
    onActivate(sessionId);
  }, [onActivate, onClose, sessions.length]);

  const handleCloseClick = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length > 1) {
      onClose(sessionId);
    }
  }, [onClose, sessions.length]);

  const truncateTitle = (title: string, maxLen: number = 20) => {
    if (title.length <= maxLen) return title;
    return title.slice(0, maxLen - 2) + '…';
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`tab-item ${session.id === activeSessionId ? 'active' : ''}`}
            onClick={(e) => handleTabClick(session.id, e)}
            onMouseDown={(e) => e.button === 1 && e.preventDefault()} // Prevent auto-scroll on middle click
            title={session.title}
          >
            <span className="tab-title">{truncateTitle(session.title)}</span>
            {sessions.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => handleCloseClick(session.id, e)}
                title="关闭"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="tab-new" onClick={onNew} title="新建会话 (Ctrl+N)">
        +
      </button>
    </div>
  );
}
