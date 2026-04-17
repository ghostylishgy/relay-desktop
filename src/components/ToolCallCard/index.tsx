// components/ToolCallCard/index.tsx

import { useState } from 'react';
import { ToolCall } from '../../types';
import { BrowserResult } from '../BrowserResult';
import './ToolCallCard.css';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const BROWSER_TOOLS = new Set([
  'browser', 'browser_navigate', 'browser_click', 'browser_snapshot',
  'browser_screenshot', 'browser_vision', 'browser_type', 'browser_scroll',
  'browser_get_images', 'browser_console', 'browser_press', 'browser_back',
  'web_search', 'web_extract', 'vision_analyze', 'image_generate',
]);

function isBrowserTool(name: string): boolean {
  const lowerName = name.toLowerCase();
  for (const tool of BROWSER_TOOLS) {
    if (lowerName.includes(tool.toLowerCase())) return true;
  }
  return false;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(true);

  const hasResult = toolCall.result !== undefined;
  const hasError = toolCall.error !== undefined;
  const status: 'pending' | 'success' | 'error' = hasError ? 'error' : hasResult ? 'success' : 'pending';
  const isBrowser = isBrowserTool(toolCall.name);

  const formatArgs = (args: Record<string, any>): string => {
    return JSON.stringify(args, null, 2);
  };

  const truncateResult = (text: string, maxLen: number = 500): string => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '\n... (truncated)';
  };

  return (
    <div className={`tool-call-card ${status}`}>
      <div className="tool-call-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-call-expand">{expanded ? '▼' : '▶'}</span>
        <span className={`tool-call-status-dot ${status}`}></span>
        <span className="tool-call-name">{toolCall.name}</span>
        {toolCall.duration !== undefined && (
          <span className="tool-call-duration">{toolCall.duration}ms</span>
        )}
      </div>

      {expanded && (
        <div className="tool-call-body">
          {/* Arguments */}
          <div className="tool-call-section">
            <div className="tool-call-section-label">参数</div>
            <pre className="tool-call-args">{formatArgs(toolCall.arguments)}</pre>
          </div>

          {/* Result */}
          {hasResult && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">输出</div>
              {isBrowser ? (
                <BrowserResult result={toolCall.result!} toolName={toolCall.name} />
              ) : (
                <pre className="tool-call-result">{truncateResult(toolCall.result!)}</pre>
              )}
            </div>
          )}

          {/* Error */}
          {hasError && (
            <div className="tool-call-section">
              <div className="tool-call-section-label">错误</div>
              <pre className="tool-call-error">{toolCall.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
