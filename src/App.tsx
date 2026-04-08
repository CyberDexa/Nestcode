import { useEffect } from 'react';
import { TitleBar } from './layout/TitleBar';
import { ActivityBar } from './layout/ActivityBar';
import { Sidebar } from './layout/Sidebar';
import { EditorArea } from './layout/EditorArea';
import { ChatPanel } from './layout/ChatPanel';
import { BottomPane } from './layout/BottomPane';
import { StatusBar } from './layout/StatusBar';
import { useLayoutStore } from './store/layoutStore';
import { useFileStore } from './store/fileStore';
import { useChatStore } from './store/chatStore';

export default function App() {
  const { sidebarOpen, chatPanelOpen, bottomPanelOpen, sidebarWidth, chatWidth, bottomHeight } =
    useLayoutStore();

  // Listen for folder open from Electron menu
  useEffect(() => {
    if (!window.nestcode) return;

    const unsub = window.nestcode.onOpenFolder((folderPath: string) => {
      useFileStore.getState().setRootPath(folderPath);
    });

    // Listen for save
    const unsubSave = window.nestcode.onSaveFile(() => {
      // Save handled by editor component
    });

    // Auto-start OpenClaw
    window.nestcode.openclawAutoStart().then((started: boolean) => {
      if (started) {
        useChatStore.getState().setStatus('connected');
      }
    });

    // Listen for OpenClaw status changes
    const unsubStatus = window.nestcode.onOpenClawStatus((status: 'disconnected' | 'connecting' | 'connected' | 'error') => {
      useChatStore.getState().setStatus(status);
    });

    return () => {
      unsub();
      unsubSave();
      unsubStatus();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-surface-0 overflow-hidden">
      {/* Title Bar */}
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Sidebar */}
        {sidebarOpen && (
          <div
            className="flex-shrink-0 border-r border-border-subtle bg-surface-1"
            style={{ width: sidebarWidth }}
          >
            <Sidebar />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <EditorArea />
            </div>

            {/* Chat Panel */}
            {chatPanelOpen && (
              <div
                className="flex-shrink-0 border-l border-border-subtle bg-surface-1"
                style={{ width: chatWidth }}
              >
                <ChatPanel />
              </div>
            )}
          </div>

          {/* Bottom Pane */}
          {bottomPanelOpen && (
            <div
              className="flex-shrink-0 border-t border-border-subtle bg-surface-1"
              style={{ height: bottomHeight }}
            >
              <BottomPane />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
