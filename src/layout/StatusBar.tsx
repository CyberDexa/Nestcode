import { useChatStore } from '../store/chatStore';
import { useEditorStore } from '../store/editorStore';
import { useFileStore } from '../store/fileStore';

export function StatusBar() {
  const status = useChatStore((s) => s.status);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const rootPath = useFileStore((s) => s.rootPath);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="h-7 flex items-center justify-between px-3 bg-surface-0 border-t border-border-subtle flex-shrink-0 select-none">
      {/* Left */}
      <div className="flex items-center gap-3">
        {/* OpenClaw status */}
        <button className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-text-secondary transition-colors">
          <div
            className={`w-[7px] h-[7px] rounded-full ${
              status === 'connected'
                ? 'bg-nest'
                : status === 'connecting'
                ? 'bg-status-warning'
                : status === 'error'
                ? 'bg-status-error'
                : 'bg-text-muted'
            }`}
          />
          <span>
            OpenClaw:{' '}
            {status === 'connected'
              ? 'Connected'
              : status === 'connecting'
              ? 'Connecting...'
              : status === 'error'
              ? 'Error'
              : 'Disconnected'}
          </span>
        </button>

        {/* Branch */}
        {rootPath && (
          <div className="flex items-center gap-1 text-2xs text-text-muted">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 01-9 9" />
            </svg>
            <span>main</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 text-2xs text-text-muted">
        {activeTab && (
          <>
            <span>{activeTab.language}</span>
            <span>UTF-8</span>
          </>
        )}
        <span className="text-nest font-medium">NestCode</span>
      </div>
    </div>
  );
}
