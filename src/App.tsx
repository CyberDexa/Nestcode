import { useEffect, useRef, useCallback } from 'react';
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
  const { sidebarOpen, chatPanelOpen, bottomPanelOpen, sidebarWidth, chatWidth, bottomHeight, setBottomHeight, theme } =
    useLayoutStore();

  // Sync theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Bottom pane drag-to-resize ─────────────────────────────────────────────
  const isDraggingBottom = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleBottomResizeMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingBottom.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = bottomHeight;
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  }, [bottomHeight]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingBottom.current) return;
      const delta = dragStartY.current - e.clientY;
      setBottomHeight(dragStartHeight.current + delta);
    };
    const onMouseUp = () => {
      if (!isDraggingBottom.current) return;
      isDraggingBottom.current = false;
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [setBottomHeight]);

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
              <BottomPane onResizeMouseDown={handleBottomResizeMouseDown} />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}
