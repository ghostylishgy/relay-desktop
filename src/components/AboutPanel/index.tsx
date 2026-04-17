import { useState, useCallback } from 'react';
import './styles.css';

interface ReleaseInfo {
  version: string;
  name: string;
  body: string;
  url: string;
  publishedAt: string;
}

// TODO: 配置你的 GitHub 仓库信息
const GITHUB_OWNER = 'your-username';
const GITHUB_REPO = 'hermes-desktop';
const CURRENT_VERSION = '0.1.0';

async function checkForUpdate(): Promise<ReleaseInfo | null> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No releases found
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      version: data.tag_name?.replace(/^v/, '') || '',
      name: data.name || data.tag_name || '',
      body: data.body || '',
      url: data.html_url || '',
      publishedAt: data.published_at || '',
    };
  } catch (err) {
    console.error('Failed to check for update:', err);
    throw err;
  }
}

function compareVersions(current: string, latest: string): number {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return 1;  // latest is newer
    if (l < c) return -1; // latest is older (shouldn't happen)
  }
  return 0; // same version
}

export function AboutPanel() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<ReleaseInfo | null>(null);
  const [isLatest, setIsLatest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckUpdate = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    setIsLatest(false);
    setUpdateInfo(null);

    try {
      const release = await checkForUpdate();

      if (!release) {
        setError('暂未发布任何版本');
        return;
      }

      const comparison = compareVersions(CURRENT_VERSION, release.version);

      if (comparison > 0) {
        setUpdateInfo(release);
      } else {
        setIsLatest(true);
      }
    } catch (err) {
      setError('检查更新失败，请检查网络连接');
    } finally {
      setIsChecking(false);
    }
  }, []);

  return (
    <div className="about-panel">
      <div className="about-header">
        <h3>关于</h3>
      </div>

      <div className="about-content">
        <div className="about-info">
          <div className="about-row">
            <span className="about-label">应用名称</span>
            <span className="about-value">Hermes Desktop</span>
          </div>
          <div className="about-row">
            <span className="about-label">当前版本</span>
            <span className="about-value about-version">v{CURRENT_VERSION}</span>
          </div>
        </div>

        <div className="about-update">
          <button
            className="about-check-btn"
            onClick={handleCheckUpdate}
            disabled={isChecking}
          >
            {isChecking ? '⟳ 检查中...' : '检查更新'}
          </button>

          {isLatest && (
            <div className="about-status about-status-success">
              ✓ 当前已是最新版本
            </div>
          )}

          {error && (
            <div className="about-status about-status-error">
              ✗ {error}
            </div>
          )}

          {updateInfo && (
            <div className="about-update-available">
              <div className="about-update-header">
                <span className="about-update-badge">新版本可用</span>
                <span className="about-update-version">v{updateInfo.version}</span>
              </div>
              {updateInfo.name && (
                <div className="about-update-name">{updateInfo.name}</div>
              )}
              {updateInfo.body && (
                <div className="about-update-changelog">
                  <div className="about-update-changelog-title">更新内容：</div>
                  <pre className="about-update-changelog-body">{updateInfo.body}</pre>
                </div>
              )}
              <a
                href={updateInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="about-update-link"
              >
                前往 GitHub 下载 →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
