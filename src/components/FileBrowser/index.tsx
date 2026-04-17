import { useState, useCallback, useEffect } from 'react';
import { readDir, readTextFile, readFile } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
import './styles.css';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
  expanded?: boolean;
}

interface FileBrowserProps {
  visible: boolean;
  onToggle: () => void;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'htm',
  'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
  'py', 'rb', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'java',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'sql', 'graphql', 'gql', 'proto',
  'log', 'csv', 'tsv',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
]);

function getFileType(filename: string): 'text' | 'image' | 'binary' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'binary';
}

function getFileIcon(entry: FileEntry): string {
  if (entry.isDirectory) {
    return entry.expanded ? '📂' : '📁';
  }
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts': case 'tsx': return '🔷';
    case 'js': case 'jsx': return '🟡';
    case 'json': return '📋';
    case 'md': return '📝';
    case 'css': case 'scss': return '🎨';
    case 'html': case 'htm': return '🌐';
    case 'py': return '🐍';
    case 'rs': return '🦀';
    case 'go': return '🐹';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': case 'svg': return '🖼️';
    case 'sh': case 'bash': return '⚡';
    default: return '📄';
  }
}

async function loadDirectory(dirPath: string): Promise<FileEntry[]> {
  try {
    const entries = await readDir(dirPath);
    const result: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name?.startsWith('.')) continue;

      const fullPath = await join(dirPath, entry.name);

      result.push({
        name: entry.name || 'unknown',
        path: fullPath,
        isDirectory: entry.isDirectory,
        expanded: false,
        children: undefined,
      });
    }

    // Sort: directories first, then files, both alphabetically
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch (err) {
    console.error('Failed to read directory:', err);
    return [];
  }
}

export function FileBrowser({ visible, onToggle }: FileBrowserProps) {
  const [rootPath, setRootPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewType, setPreviewType] = useState<'text' | 'image' | 'binary' | null>(null);
  const [loading, setLoading] = useState(false);
  const [pathInput, setPathInput] = useState('');

  // Initialize with home directory
  useEffect(() => {
    if (visible && !rootPath) {
      homeDir().then(home => {
        setRootPath(home);
        setPathInput(home);
        loadDirectory(home).then(setEntries);
      });
    }
  }, [visible, rootPath]);

  // Cleanup ObjectURL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewContent && previewContent.startsWith('blob:')) {
        URL.revokeObjectURL(previewContent);
      }
    };
  }, [previewContent]);

  const navigateTo = useCallback(async (path: string) => {
    setRootPath(path);
    setPathInput(path);
    setSelectedFile(null);
    setPreviewContent('');
    setPreviewType(null);
    setLoading(true);
    const items = await loadDirectory(path);
    setEntries(items);
    setLoading(false);
  }, []);

  const toggleDirectory = useCallback(async (targetPath: string, entries: FileEntry[]): Promise<FileEntry[]> => {
    return Promise.all(entries.map(async (entry) => {
      if (entry.path === targetPath && entry.isDirectory) {
        if (!entry.expanded) {
          const children = await loadDirectory(entry.path);
          return { ...entry, expanded: true, children };
        } else {
          return { ...entry, expanded: false, children: undefined };
        }
      }
      if (entry.children && entry.expanded) {
        const newChildren = await toggleDirectory(targetPath, entry.children);
        return { ...entry, children: newChildren };
      }
      return entry;
    }));
  }, []);

  const handleEntryClick = useCallback(async (entry: FileEntry) => {
    if (entry.isDirectory) {
      const newEntries = await toggleDirectory(entry.path, entries);
      setEntries(newEntries);
    } else {
      setSelectedFile(entry.path);
      const fileType = getFileType(entry.name);
      setPreviewType(fileType);

      if (fileType === 'text') {
        try {
          const content = await readTextFile(entry.path);
          setPreviewContent(content);
        } catch (err) {
          setPreviewContent(`读取失败: ${err}`);
        }
      } else if (fileType === 'image') {
        try {
          const buffer = await readFile(entry.path);
          const blob = new Blob([buffer]);
          const url = URL.createObjectURL(blob);
          setPreviewContent(url);
        } catch (err) {
          setPreviewContent('');
          console.error('Failed to load image:', err);
        }
      } else {
        setPreviewContent('二进制文件，无法预览');
      }
    }
  }, [entries, toggleDirectory]);

  const handlePathKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      navigateTo(pathInput);
    }
  }, [pathInput, navigateTo]);

  const goUp = useCallback(() => {
    if (rootPath) {
      // Handle different path separators and edge cases
      const normalized = rootPath.replace(/\\/g, '/');
      // Check if already at root
      if (normalized === '/' || /^[A-Za-z]:\/?$/.test(normalized)) {
        return; // Already at root, do nothing
      }
      const parent = normalized.replace(/\/[^/]+$/, '') || '/';
      if (parent !== normalized) {
        navigateTo(parent);
      }
    }
  }, [rootPath, navigateTo]);

  const renderTree = (items: FileEntry[], depth = 0) => {
    return items.map(entry => (
      <div key={entry.path}>
        <div
          className={`file-tree-item ${selectedFile === entry.path ? 'selected' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleEntryClick(entry)}
          title={entry.path}
        >
          <span className="file-icon">{getFileIcon(entry)}</span>
          <span className="file-name">{entry.name}</span>
        </div>
        {entry.expanded && entry.children && (
          renderTree(entry.children, depth + 1)
        )}
      </div>
    ));
  };

  if (!visible) {
    return (
      <div className="file-browser-toggle" onClick={onToggle}>
        <span>📁</span>
        <span>文件</span>
      </div>
    );
  }

  return (
    <div className="file-browser-panel">
      <div className="file-browser-header">
        <span className="file-browser-title">文件浏览器</span>
        <button className="file-browser-btn" onClick={onToggle} title="关闭">×</button>
      </div>

      <div className="file-browser-path">
        <button className="file-browser-up-btn" onClick={goUp} title="上级目录">↑</button>
        <input
          className="file-browser-path-input"
          value={pathInput}
          onChange={e => setPathInput(e.target.value)}
          onKeyDown={handlePathKeyDown}
          placeholder="输入路径后回车..."
          spellCheck={false}
        />
      </div>

      <div className="file-browser-content">
        <div className="file-tree">
          {loading ? (
            <div className="file-loading">加载中...</div>
          ) : (
            renderTree(entries)
          )}
        </div>

        <div className="file-preview">
          {!selectedFile && (
            <div className="file-preview-placeholder">
              选择文件预览
            </div>
          )}
          {selectedFile && previewType === 'text' && (
            <pre className="file-preview-text">{previewContent}</pre>
          )}
          {selectedFile && previewType === 'image' && previewContent && (
            <div className="file-preview-image">
              <img src={previewContent} alt={selectedFile} />
            </div>
          )}
          {selectedFile && previewType === 'binary' && (
            <div className="file-preview-binary">{previewContent}</div>
          )}
        </div>
      </div>
    </div>
  );
}
