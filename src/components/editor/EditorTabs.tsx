import { useEditorStore, type OpenTab } from '../../store/editorStore';
import clsx from 'clsx';

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  return (
    <div className="h-9 flex items-end bg-surface-0 border-b border-border-subtle overflow-x-auto flex-shrink-0">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
    </div>
  );
}

function Tab({
  tab,
  isActive,
  onSelect,
  onClose,
}: {
  tab: OpenTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const icon = getFileIcon(tab.fileName);

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group flex items-center gap-2 h-[34px] px-3 cursor-pointer border-r border-border-subtle transition-colors relative select-none',
        isActive
          ? 'bg-surface-2 text-text-primary'
          : 'bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary'
      )}
    >
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-nest" />
      )}

      {/* File icon */}
      <span className="text-2xs">{icon}</span>

      {/* File name */}
      <span className="text-xs whitespace-nowrap">{tab.fileName}</span>

      {/* Dirty indicator / Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={clsx(
          'w-4 h-4 flex items-center justify-center rounded-sm transition-all ml-1',
          'opacity-0 group-hover:opacity-100',
          tab.isDirty && 'opacity-100'
        )}
      >
        {tab.isDirty ? (
          <div className="w-2 h-2 rounded-full bg-text-secondary" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-text-muted hover:text-text-primary" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: '🔷',
    tsx: '⚛️',
    js: '🟡',
    jsx: '⚛️',
    json: '📋',
    md: '📝',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    py: '🐍',
    rs: '🦀',
    go: '🔵',
    yaml: '⚙️',
    yml: '⚙️',
    toml: '⚙️',
    sh: '🖥️',
    sql: '🗃️',
    svg: '🎯',
    gitignore: '🔒',
  };
  return map[ext] || '📄';
}
