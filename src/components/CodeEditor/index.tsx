import { useState, useRef, useCallback, useEffect } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import './styles.css';

interface CodeEditorProps {
  visible: boolean;
  onToggle: () => void;
}

interface ExecutionResult {
  code: string;
  language: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
}

const LANGUAGE_CONFIG = {
  python: {
    name: 'Python',
    command: 'python3',
    args: ['-c'],
    fallbackCommand: 'python',
    placeholder: '# 输入 Python 代码\nprint("Hello, World!")',
    comment: '#',
  },
  javascript: {
    name: 'JavaScript',
    command: 'node',
    args: ['-e'],
    fallbackCommand: null,
    placeholder: '// 输入 JavaScript 代码\nconsole.log("Hello, World!");',
    comment: '//',
  },
};

type Language = keyof typeof LANGUAGE_CONFIG;

export function CodeEditor({ visible, onToggle }: CodeEditorProps) {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<Language>('python');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [history, setHistory] = useState<ExecutionResult[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result]);

  // Focus textarea when visible
  useEffect(() => {
    if (visible && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [visible]);

  const executeCode = useCallback(async () => {
    if (!code.trim() || isRunning) return;

    setIsRunning(true);
    const startTime = Date.now();
    const config = LANGUAGE_CONFIG[language];

    try {
      let command;

      try {
        // Try primary command first
        command = Command.create(config.command, [...config.args, code]);
      } catch {
        if (config.fallbackCommand) {
          // Fallback to secondary command
          command = Command.create(config.fallbackCommand, [...config.args, code]);
        } else {
          throw new Error(`${config.command} not found`);
        }
      }

      const output = await command.execute();
      const duration = Date.now() - startTime;

      const newResult: ExecutionResult = {
        code,
        language,
        stdout: output.stdout || '',
        stderr: output.stderr || '',
        exitCode: output.code,
        duration,
      };

      setResult(newResult);
      setHistory(prev => [...prev.slice(-9), newResult]); // Keep last 10
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      const newResult: ExecutionResult = {
        code,
        language,
        stdout: '',
        stderr: `执行失败: ${errorMsg}\n请确认已安装 ${config.command}`,
        exitCode: -1,
        duration,
      };

      setResult(newResult);
      setHistory(prev => [...prev.slice(-9), newResult]);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, isRunning]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Enter to run
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      executeCode();
      return;
    }

    // Tab to indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        setCode(newValue);
        // Restore cursor position after state update
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    }
  }, [executeCode]);

  const clearOutput = useCallback(() => {
    setResult(null);
  }, []);

  const loadFromHistory = useCallback((item: ExecutionResult) => {
    setCode(item.code);
    setLanguage(item.language as Language);
    setResult(item);
  }, []);

  if (!visible) {
    return (
      <div className="code-editor-toggle" onClick={onToggle}>
        <span>{'</>'}</span>
        <span>代码</span>
      </div>
    );
  }

  return (
    <div className="code-editor-panel">
      <div className="code-editor-header">
        <span className="code-editor-title">代码执行</span>
        <div className="code-editor-actions">
          <select
            className="code-editor-lang-select"
            value={language}
            onChange={e => setLanguage(e.target.value as Language)}
            disabled={isRunning}
          >
            {Object.entries(LANGUAGE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.name}</option>
            ))}
          </select>
          <button
            className="code-editor-run-btn"
            onClick={executeCode}
            disabled={isRunning || !code.trim()}
            title="运行 (Ctrl+Enter)"
          >
            {isRunning ? '⟳' : '▶'} 运行
          </button>
          <button
            className="code-editor-btn"
            onClick={clearOutput}
            title="清除输出"
          >
            清除
          </button>
          <button
            className="code-editor-btn code-editor-btn-close"
            onClick={onToggle}
            title="收起"
          >
            ▾
          </button>
        </div>
      </div>

      <div className="code-editor-content">
        <div className="code-editor-main">
          <textarea
            ref={textareaRef}
            className="code-editor-textarea"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={LANGUAGE_CONFIG[language].placeholder}
            spellCheck={false}
            disabled={isRunning}
          />

          <div className="code-editor-output" ref={outputRef}>
            {!result && !isRunning && (
              <div className="code-editor-placeholder">
                输入代码后点击运行或按 Ctrl+Enter 执行...
              </div>
            )}
            {isRunning && (
              <div className="code-editor-running">
                <span className="code-editor-spinner">⟳</span> 执行中...
              </div>
            )}
            {result && (
              <div className="code-editor-result">
                <div className="code-editor-result-header">
                  <span className={result.exitCode === 0 ? 'success' : 'error'}>
                    {result.exitCode === 0 ? '✓ 成功' : `✗ 失败 (退出码: ${result.exitCode})`}
                  </span>
                  <span className="code-editor-result-duration">{result.duration}ms</span>
                </div>
                {result.stdout && (
                  <pre className="code-editor-stdout">{result.stdout}</pre>
                )}
                {result.stderr && (
                  <pre className="code-editor-stderr">{result.stderr}</pre>
                )}
              </div>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="code-editor-history">
            <div className="code-editor-history-title">历史记录</div>
            <div className="code-editor-history-list">
              {history.map((item, index) => (
                <div
                  key={index}
                  className="code-editor-history-item"
                  onClick={() => loadFromHistory(item)}
                  title={item.code.slice(0, 100)}
                >
                  <span className="code-editor-history-lang">{item.language}</span>
                  <span className="code-editor-history-preview">
                    {item.code.split('\n')[0].slice(0, 30)}
                    {item.code.length > 30 ? '...' : ''}
                  </span>
                  <span className={`code-editor-history-status ${item.exitCode === 0 ? 'success' : 'error'}`}>
                    {item.exitCode === 0 ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
