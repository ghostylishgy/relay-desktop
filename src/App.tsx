import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useApp } from './context/AppContext';
import { getCurrentWindow, availableMonitors, LogicalSize } from '@tauri-apps/api/window';
import { QuickSwitcher } from './components/QuickSwitcher';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { StatusBar } from './components/StatusBar';
import { SettingsPanel } from './components/SettingsPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { FileBrowser } from './components/FileBrowser';
import { CodeEditor } from './components/CodeEditor';
import { Dashboard } from './components/Dashboard';
import { ToastContainer } from './components/Toast';
import './App.css';

function AppContent() {
  const { state, createSession, deleteSession, dispatch } = useApp();
  const { sessions, activeSessionId } = state;
  const [showSettings, setShowSettings] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);

  const handleActivateSession = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
  }, [dispatch]);

  const handleCloseSession = useCallback((sessionId: string) => {
    deleteSession(sessionId);
  }, [deleteSession]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+, — Open settings
    if (ctrl && e.key === ',') {
      e.preventDefault();
      setShowSettings(prev => !prev);
      return;
    }

    // Ctrl+K — Quick session switcher
    if (ctrl && e.key === 'k') {
      e.preventDefault();
      setShowQuickSwitcher(prev => !prev);
      return;
    }

    // Ctrl+N — New session
    if (ctrl && e.key === 'n') {
      e.preventDefault();
      createSession();
      return;
    }

    // Ctrl+` — Toggle terminal
    if (ctrl && e.key === '`') {
      e.preventDefault();
      setShowTerminal(prev => !prev);
      return;
    }

    // Ctrl+B — Toggle file browser
    if (ctrl && e.key === 'b') {
      e.preventDefault();
      setShowFileBrowser(prev => !prev);
      return;
    }

    // Ctrl+J — Toggle code editor
    if (ctrl && e.key === 'j') {
      e.preventDefault();
      setShowCodeEditor(prev => !prev);
      return;
    }

    // Ctrl+D — Toggle dashboard
    if (ctrl && e.key === 'd') {
      e.preventDefault();
      setShowDashboard(prev => !prev);
      return;
    }

    // Ctrl+Tab / Ctrl+Shift+Tab — Switch tabs
    if (ctrl && e.key === 'Tab') {
      e.preventDefault();
      const currentIndex = sessions.findIndex((s: any) => s.id === activeSessionId);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (e.shiftKey) {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
      } else {
        nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0;
      }
      handleActivateSession(sessions[nextIndex].id);
      return;
    }

    // Ctrl+W — Close current tab (if more than 1)
    if (ctrl && e.key === 'w') {
      e.preventDefault();
      if (sessions.length > 1 && activeSessionId) {
        handleCloseSession(activeSessionId);
      }
      return;
    }

    // Escape — Close settings
    if (e.key === 'Escape' && showSettings) {
      setShowSettings(false);
      return;
    }
  }, [createSession, showSettings, sessions, activeSessionId, handleActivateSession, handleCloseSession]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-adapt window size to screen resolution
  useEffect(() => {
    const adaptWindowSize = async () => {
      try {
        const monitors = await availableMonitors();
        if (monitors.length === 0) return;

        const primary = monitors[0];
        const { width: screenW, height: screenH } = primary.size;

        // If screen is smaller than 1920x1080, scale down to 85%
        let targetW = 1920;
        let targetH = 1080;

        if (screenW < 1920 || screenH < 1080) {
          targetW = Math.floor(screenW * 0.85);
          targetH = Math.floor(screenH * 0.85);
        }

        // Cap at screen size
        targetW = Math.min(targetW, screenW);
        targetH = Math.min(targetH, screenH);

        const appWindow = getCurrentWindow();
        await appWindow.setSize(new LogicalSize(targetW, targetH));
        await appWindow.center();
      } catch (err) {
        // Window API may not be available in dev mode, silently ignore
      }
    };

    adaptWindowSize();
  }, []);

  // Intercept close button — hide to tray instead of quitting
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await appWindow.hide();
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return (
    <>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <TabBar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onActivate={handleActivateSession}
            onClose={handleCloseSession}
            onNew={createSession}
          />
          <ChatWindow />
          <div className="bottom-panels">
            <Dashboard visible={showDashboard} onToggle={() => setShowDashboard(prev => !prev)} sessions={sessions} />
            <CodeEditor visible={showCodeEditor} onToggle={() => setShowCodeEditor(prev => !prev)} />
            <FileBrowser visible={showFileBrowser} onToggle={() => setShowFileBrowser(prev => !prev)} />
            <TerminalPanel visible={showTerminal} onToggle={() => setShowTerminal(prev => !prev)} />
          </div>
        </div>
        <StatusBar onOpenSettings={() => setShowSettings(true)} />
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <QuickSwitcher
        visible={showQuickSwitcher}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onClose={() => setShowQuickSwitcher(false)}
        onSelect={handleActivateSession}
      />
      <ToastContainer />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
