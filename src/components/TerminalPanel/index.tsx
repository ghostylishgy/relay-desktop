import { useState, useRef, useEffect, useCallback } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { platform } from '@tauri-apps/plugin-os';
import './styles.css';

interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  error: string | null;
  timestamp: Date;
}

interface TerminalPanelProps {
  visible: boolean;
  onToggle: () => void;
}

export function TerminalPanel({ visible, onToggle }: TerminalPanelProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string>('linux');
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);

  // Detect platform via Tauri OS plugin
  useEffect(() => {
    try {
      setDetectedPlatform(platform());
    } catch {}
  }, []);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus input when panel becomes visible
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  const addEntry = useCallback((command: string): string => {
    const id = `cmd-${++idCounter.current}`;
    setEntries(prev => [...prev, {
      id,
      command,
      output: '',
      exitCode: null,
      error: null,
      timestamp: new Date(),
    }]);
    return id;
  }, []);

  const executeCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim()) return;

    const entryId = addEntry(cmd.trim());
    setIsRunning(true);

    try {
      // Detect platform - use appropriate shell
      const isWindows = detectedPlatform === 'windows';
      const shell = isWindows ? 'powershell' : 'bash';
      const shellArgs = isWindows ? '-Command' : '-c';

      const command = Command.create(shell, [shellArgs, cmd.trim()]);

      // Stream stdout - use functional update to avoid closure stale state
      command.stdout.on('data', (line: string) => {
        setEntries(prev => prev.map(e =>
          e.id === entryId ? { ...e, output: e.output + line + '\n' } : e
        ));
      });

      // Stream stderr - use functional update
      command.stderr.on('data', (line: string) => {
        setEntries(prev => prev.map(e =>
          e.id === entryId ? { ...e, error: (e.error || '') + line + '\n' } : e
        ));
      });

      const output = await command.execute();

      setEntries(prev => prev.map(e =>
        e.id === entryId ? {
          ...e,
          exitCode: output.code,
          output: output.stdout || e.output,
          error: output.stderr || e.error,
        } : e
      ));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, exitCode: -1, error: errorMsg } : e
      ));
    } finally {
      setIsRunning(false);
    }
  }, [addEntry]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isRunning && input.trim()) {
        executeCommand(input);
        setInput('');
      }
    }
  }, [input, isRunning, executeCommand]);

  const clearOutput = useCallback(() => {
    setEntries([]);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!visible) {
    return (
      <div className="terminal-toggle-bar" onClick={onToggle}>
        <span className="terminal-toggle-icon">▸</span>
        <span>终端</span>
      </div>
    );
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span className="terminal-title">终端</span>
        <div className="terminal-actions">
          <button
            className="terminal-btn"
            onClick={clearOutput}
            title="清除输出"
          >
            清除
          </button>
          <button
            className="terminal-btn terminal-btn-close"
            onClick={onToggle}
            title="收起终端"
          >
            ▾
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef}>
        {entries.length === 0 && (
          <div className="terminal-placeholder">
            输入命令后按 Enter 执行...
          </div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="terminal-entry">
            <div className="terminal-command">
              <span className="terminal-prompt">$</span>
              <span className="terminal-cmd-text">{entry.command}</span>
              <span className="terminal-time">{formatTime(entry.timestamp)}</span>
            </div>
            {entry.output && (
              <pre className="terminal-stdout">{entry.output}</pre>
            )}
            {entry.error && (
              <pre className="terminal-stderr">{entry.error}</pre>
            )}
            {entry.exitCode !== null && (
              <div className={`terminal-exit-code ${entry.exitCode === 0 ? 'success' : 'error'}`}>
                退出码: {entry.exitCode}
              </div>
            )}
          </div>
        ))}
        {isRunning && (
          <div className="terminal-running">
            <span className="terminal-spinner">⟳</span> 执行中...
          </div>
        )}
      </div>

      <div className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? '等待命令完成...' : '输入命令...'}
          disabled={isRunning}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
