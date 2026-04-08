import { useLayoutStore } from '../store/layoutStore';
import clsx from 'clsx';

const icons = {
  explorer: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  git: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 012 2v7" />
      <path d="M6 9v12" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
};

type Panel = 'explorer' | 'git' | 'search' | 'settings';

const topItems: { panel: Panel; icon: keyof typeof icons; label: string }[] = [
  { panel: 'explorer', icon: 'explorer', label: 'Explorer' },
  { panel: 'search', icon: 'search', label: 'Search' },
  { panel: 'git', icon: 'git', label: 'Source Control' },
];

export function ActivityBar() {
  const { sidebarPanel, setSidebarPanel, toggleChatPanel, chatPanelOpen, toggleBottomPanel, bottomPanelOpen } =
    useLayoutStore();

  return (
    <div className="w-[48px] flex-shrink-0 bg-surface-0 border-r border-border-subtle flex flex-col items-center py-2 justify-between">
      {/* Top icons */}
      <div className="flex flex-col items-center gap-1">
        {topItems.map(({ panel, icon, label }) => (
          <button
            key={panel}
            onClick={() => setSidebarPanel(panel)}
            title={label}
            className={clsx(
              'relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150',
              sidebarPanel === panel
                ? 'text-text-primary bg-surface-3'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
            )}
          >
            {sidebarPanel === panel && (
              <div className="activity-indicator" />
            )}
            {icons[icon]}
          </button>
        ))}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={toggleBottomPanel}
          title="Terminal"
          className={clsx(
            'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150',
            bottomPanelOpen
              ? 'text-text-primary bg-surface-3'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
          )}
        >
          {icons.terminal}
        </button>
        <button
          onClick={toggleChatPanel}
          title="OpenClaw Chat"
          className={clsx(
            'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150',
            chatPanelOpen
              ? 'text-nest bg-nest/10'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
          )}
        >
          {icons.chat}
        </button>
        <button
          onClick={() => setSidebarPanel('settings')}
          title="Settings"
          className={clsx(
            'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150',
            sidebarPanel === 'settings'
              ? 'text-text-primary bg-surface-3'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
          )}
        >
          {icons.settings}
        </button>
      </div>
    </div>
  );
}
