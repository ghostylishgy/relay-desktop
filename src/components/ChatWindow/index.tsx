// components/ChatWindow/index.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import { ToolCallCard } from '../ToolCallCard';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './ChatWindow.css';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// XSS sanitization config — whitelist only safe tags
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'hr', 'del', 'sup', 'sub', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target'],
  ALLOW_DATA_ATTR: false,
};

export function ChatWindow() {
  const { state, sendMessage, exportSession, editAndResend, regenerateLast, retryLastSend } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isAtBottom, setIsAtBottom] = useState(true);

  const activeSession = state.sessions.find(s => s.id === state.activeSessionId);

  // Scroll to bottom only when user is already at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, isAtBottom]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Ctrl+F to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  // Search results
  const matchedMessages = activeSession?.messages.filter(msg =>
    searchQuery.length > 0 && msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Navigate search results
  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    if (matchedMessages.length === 0) return;
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentMatchIndex + 1) % matchedMessages.length;
    } else {
      newIndex = (currentMatchIndex - 1 + matchedMessages.length) % matchedMessages.length;
    }
    setCurrentMatchIndex(newIndex);
    const targetMsg = matchedMessages[newIndex];
    const el = messageRefs.current.get(targetMsg.id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchedMessages, currentMatchIndex]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || state.isLoading) return;

    const message = inputValue.trim();
    setInputValue('');

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExport = (format: 'json' | 'markdown') => {
    exportSession(format);
  };

    const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullTimestamp = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const isMatched = searchQuery.length > 0 && 
      message.content.toLowerCase().includes(searchQuery.toLowerCase());
    const isCurrentMatch = isMatched && matchedMessages[currentMatchIndex]?.id === message.id;
    
    return (
      <div
        key={message.id}
        ref={(el) => {
          if (el) messageRefs.current.set(message.id, el);
          else messageRefs.current.delete(message.id);
        }}
        className={`message ${message.role} ${isCurrentMatch ? 'search-highlight' : ''} ${isMatched && !isCurrentMatch ? 'search-match' : ''}`}
      >
        <div className="message-header">
          <span className="message-role">
            {isUser ? 'You' : 'Hermes'}
          </span>
          <span className="message-time" title={formatFullTimestamp(message.timestamp)}>
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        
<div className="message-content">
          {message.id === editingMessageId ? (
            <div className="edit-container">
              <textarea
                className="edit-textarea"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (editContent.trim() && activeSession) {
                      editAndResend(activeSession.id, message.id, editContent.trim()).then(ok => {
                        if (ok) setEditingMessageId(null);
                      });
                    }
                  }
                  if (e.key === 'Escape') {
                    setEditingMessageId(null);
                  }
                }}
                rows={3}
                autoFocus
              />
              <div className="edit-actions">
                <button
                  className="edit-save-btn"
                  onClick={() => {
                    if (editContent.trim() && activeSession) {
                      editAndResend(activeSession.id, message.id, editContent.trim()).then(ok => {
                        if (ok) setEditingMessageId(null);
                      });
                    }
                  }}
                >
                  保存并重发
                </button>
                <button
                  className="edit-cancel-btn"
                  onClick={() => setEditingMessageId(null)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : isUser ? (
            message.content.split('\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))
          ) : (
            <div dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(message.content) as string, SANITIZE_CONFIG)
            }} />
          )}
        </div>
        
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="tool-calls">
            <div className="tool-calls-header">
              <span>工具调用</span>
              <span className="tool-calls-count">{message.toolCalls.length}</span>
            </div>
            {message.toolCalls.map((toolCall, i) => (
              <ToolCallCard key={i} toolCall={toolCall} />
            ))}
          </div>
        )}
        
        <div className="message-actions">
          {isUser && message.id !== editingMessageId && (
            <button
              className="copy-btn"
              onClick={() => {
                setEditingMessageId(message.id);
                setEditContent(message.content);
              }}
            >
              编辑
            </button>
          )}
          {!isUser && activeSession && message.id === activeSession.messages[activeSession.messages.length - 1]?.id && (
            <button
              className="copy-btn"
              onClick={() => regenerateLast(activeSession.id)}
              disabled={state.isLoading}
            >
              重新生成
            </button>
          )}
          <button
            className="copy-btn"
            onClick={() => handleCopy(message.content, message.id)}
          >
            {copiedId === message.id ? '已复制' : '复制'}
          </button>
        </div>
        
        {message.tokens && (
          <div className="message-meta">
            <span className="tokens-used">
              {message.tokens.input + message.tokens.output} tokens
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="session-info">
          {activeSession ? (
            <>
              <h2 className="session-title">{activeSession.title}</h2>
              <div className="session-stats">
                <span>{activeSession.messages.length} 条消息</span>
                <span>•</span>
                <span>{activeSession.totalTokens.input + activeSession.totalTokens.output} tokens</span>
              </div>
            </>
          ) : (
            <h2 className="session-title">未选择会话</h2>
          )}
        </div>
        
        <div className="chat-actions">
          <div className="export-dropdown">
            <button className="action-btn">
              Export
              <span className="dropdown-arrow">▼</span>
            </button>
            <div className="dropdown-content">
              <button onClick={() => handleExport('json')}>JSON</button>
              <button onClick={() => handleExport('markdown')}>Markdown</button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && (
        <div className="search-bar">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                navigateMatch(e.shiftKey ? 'prev' : 'next');
              }
              if (e.key === 'Escape') {
                setSearchOpen(false);
                setSearchQuery('');
              }
            }}
            placeholder="搜索消息..."
          />
          {searchQuery.length > 0 && (
            <span className="search-count">
              {matchedMessages.length > 0
                ? `${currentMatchIndex + 1}/${matchedMessages.length}`
                : '无结果'}
            </span>
          )}
          <button className="search-nav-btn" onClick={() => navigateMatch('prev')} title="上一条">▲</button>
          <button className="search-nav-btn" onClick={() => navigateMatch('next')} title="下一条">▼</button>
          <button
            className="search-close-btn"
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            title="关闭"
          >×</button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {activeSession ? (
          activeSession.messages.length > 0 ? (
            activeSession.messages.map(renderMessage)
          ) : (
            <div className="empty-state">
              <div className="empty-icon">✨</div>
              <h3>开始对话</h3>
              <p>输入消息，让 Hermes 帮你完成任务。</p>
              <div className="empty-tips">
                <div className="empty-tip" onClick={() => setInputValue('帮我搜索最新的科技新闻')}>
                  💡 试试：帮我搜索最新的科技新闻
                </div>
                <div className="empty-tip" onClick={() => setInputValue('写一段 Python 代码，读取 Excel 文件')}>
                  💡 试试：写一段 Python 代码，读取 Excel 文件
                </div>
                <div className="empty-tip" onClick={() => setInputValue('打开终端，查看系统磁盘使用情况')}>
                  💡 试试：打开终端，查看系统磁盘使用情况
                </div>
              </div>
              <div className="empty-shortcuts">
                <span><kbd>Ctrl</kbd>+<kbd>N</kbd> 新建会话</span>
                <span><kbd>Ctrl</kbd>+<kbd>`</kbd> 终端</span>
                <span><kbd>Ctrl</kbd>+<kbd>B</kbd> 文件</span>
                <span><kbd>Ctrl</kbd>+<kbd>,</kbd> 设置</span>
              </div>
            </div>
          )
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h3>未选择会话</h3>
            <p>从左侧选择已有会话，或按 <kbd>Ctrl</kbd>+<kbd>N</kbd> 创建新会话。</p>
          </div>
        )}
        {state.isLoading && activeSession && (
          <div className="message assistant typing-indicator">
            <div className="message-header">
              <span className="message-role">Hermes</span>
            </div>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        {!isAtBottom && activeSession && activeSession.messages.length > 0 && (
          <button className="scroll-to-bottom" onClick={scrollToBottom} title="回到底部">
            ↓
          </button>
        )}
        {/* Retry button on send failure */}
        {state.error && activeSession && activeSession.messages.length > 0 &&
         activeSession.messages[activeSession.messages.length - 1]?.role === 'user' && (
          <div className="retry-bar">
            <span className="retry-error">发送失败</span>
            <button
              className="retry-btn"
              onClick={() => retryLastSend(activeSession.id)}
              disabled={state.isLoading}
            >
              ↻ 重试
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input">
        <div className="input-container">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={3}
            disabled={state.isLoading || !activeSession}
          />
          <div className="input-actions">
            <span className="char-count">
              {inputValue.length > 0 ? `${inputValue.length} 字` : ''}
            </span>
            {inputValue.length > 0 && (
              <button
                className="clear-btn"
                onClick={() => setInputValue('')}
                title="清空"
              >
                ×
              </button>
            )}
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || state.isLoading || !activeSession}
            >
              {state.isLoading ? (
                <span className="loading-spinner">⏳</span>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
        
        <div className="input-hints">
          <span>按 <kbd>Enter</kbd> 发送，<kbd>Shift+Enter</kbd> 换行</span>
        </div>
      </div>
    </main>
  );
}