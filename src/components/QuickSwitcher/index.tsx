import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Session } from '../../types';
import './styles.css';

interface QuickSwitcherProps {
  visible: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  onClose: () => void;
  onSelect: (sessionId: string) => void;
}

export function QuickSwitcher({ visible, sessions, activeSessionId, onClose, onSelect }: QuickSwitcherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter sessions by query
  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.messages.some(m => m.content.toLowerCase().includes(q))
    );
  }, [sessions, query]);

  // Reset selection when filter changes
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Focus input when visible
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[selectedIndex]) {
      (items[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      onSelect(filtered[selectedIndex].id);
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filtered, selectedIndex, onSelect, onClose]);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleDateString('zh-CN');
  };

  if (!visible) return null;

  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div className="quick-switcher" onClick={e => e.stopPropagation()}>
        <div className="quick-switcher-input-wrap">
          <span className="quick-switcher-icon">🔍</span>
          <input
            ref={inputRef}
            className="quick-switcher-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索会话..."
          />
          <kbd className="quick-switcher-kbd">Esc</kbd>
        </div>

        <div className="quick-switcher-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="quick-switcher-empty">没有匹配的会话</div>
          ) : (
            filtered.map((session, index) => (
              <div
                key={session.id}
                className={`quick-switcher-item ${index === selectedIndex ? 'selected' : ''} ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => { onSelect(session.id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="quick-switcher-item-title">{session.title}</div>
                <div className="quick-switcher-item-meta">
                  <span>{session.messages.length} 条消息</span>
                  <span>{formatTime(session.updatedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="quick-switcher-footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 选择</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
