// components/SettingsPanel/index.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SettingsState } from '../../types';
import { AboutPanel } from '../AboutPanel';
import './SettingsPanel.css';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { state, updateSettings, showToast } = useApp();
  const [local, setLocal] = useState<SettingsState>(state.settings);

  // Sync from state if it changes externally
  useEffect(() => {
    setLocal(state.settings);
  }, [state.settings]);

  const handleSave = () => {
    updateSettings(local);
    showToast('info', 'Settings saved');
    onClose();
  };

  const handleReset = () => {
    const defaults: SettingsState = {
      baseUrl: 'http://127.0.0.1:8642/v1',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
    };
    setLocal(defaults);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>设置</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          {/* API Configuration */}
          <div className="settings-section">
            <h3>API 配置</h3>

            <div className="settings-field">
              <label>API 地址</label>
              <input
                type="text"
                value={local.baseUrl}
                onChange={(e) => setLocal({ ...local, baseUrl: e.target.value })}
                placeholder="http://127.0.0.1:8642/v1"
              />
            </div>

            <div className="settings-field">
              <label>API Key (optional)</label>
              <input
                type="password"
                value={local.apiKey}
                onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
                placeholder="不需要则留空"
              />
            </div>
          </div>

          {/* Generation Parameters */}
          <div className="settings-section">
            <h3>生成参数</h3>

            <div className="settings-field">
              <label>Temperature ({local.temperature})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={local.temperature}
                onChange={(e) => setLocal({ ...local, temperature: parseFloat(e.target.value) })}
              />
              <div className="range-labels">
                <span>精确</span>
                <span>创意</span>
              </div>
            </div>

            <div className="settings-field">
              <label>最大 Token 数</label>
              <input
                type="number"
                min="256"
                max="128000"
                step="256"
                value={local.maxTokens}
                onChange={(e) => setLocal({ ...local, maxTokens: parseInt(e.target.value) || 4096 })}
              />
            </div>
          </div>

          <AboutPanel />
        </div>

        <div className="settings-footer">
          <button className="settings-btn secondary" onClick={handleReset}>恢复默认</button>
          <button className="settings-btn primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
