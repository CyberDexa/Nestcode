import { useLayoutStore } from '../store/layoutStore';
import { TerminalPane } from '../components/terminal/TerminalPane';
import clsx from 'clsx';

type Tab = 'terminal' | 'problems' | 'output';

export function BottomPane({ onResizeMouseDown }: { onResizeMouseDown: (e: React.MouseEvent) => void }) {
  const { bottomPanel, setBottomPanel, toggleBottomPanel } = useLayoutStore();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'problems', label: 'Problems' },
    { id: 'output', label: 'Output' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Drag resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        className="h-1 flex-shrink-0 cursor-row-resize hover:bg-nest/40 transition-colors"
        title="Drag to resize"
      />

      {/* Tab bar */}
      <div className="h-8 flex items-center px-2 gap-0.5 border-b border-border-subtle flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setBottomPanel(tab.id)}
            className={clsx(
              'px-3 h-7 text-[11px] font-medium rounded-t transition-colors',
              bottomPanel === tab.id
                ? 'text-text-primary bg-surface-2 border-b-2 border-nest'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {tab.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Collapse button */}
        <button
          onClick={toggleBottomPanel}
          title="Close panel"
          className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6 6-6-6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {bottomPanel === 'terminal' && <TerminalPane />}
        {bottomPanel === 'problems' && (
          <div className="p-3 text-xs text-text-muted">No problems detected</div>
        )}
        {bottomPanel === 'output' && (
          <div className="p-3 text-xs text-text-muted">No output</div>
        )}
      </div>
    </div>
  );
}
