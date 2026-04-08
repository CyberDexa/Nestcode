import { useLayoutStore } from '../store/layoutStore';
import { FileExplorer } from '../components/explorer/FileExplorer';
import { GitPanel } from '../components/git/GitPanel';
import { SettingsPanel } from '../components/settings/SettingsPanel';

export function Sidebar() {
  const panel = useLayoutStore((s) => s.sidebarPanel);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="h-9 flex items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted flex-shrink-0">
        {panel === 'explorer' && 'Explorer'}
        {panel === 'git' && 'Source Control'}
        {panel === 'search' && 'Search'}
        {panel === 'settings' && 'Settings'}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {panel === 'explorer' && <FileExplorer />}
        {panel === 'git' && <GitPanel />}
        {panel === 'search' && <SearchPanel />}
        {panel === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}

function SearchPanel() {
  return (
    <div className="px-3 py-2">
      <div className="relative">
        <input
          type="text"
          placeholder="Search files..."
          className="w-full h-8 px-3 pr-8 text-xs bg-surface-3 border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:border-nest/50 focus:outline-none transition-colors"
        />
        <svg
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <p className="text-2xs text-text-muted mt-3 text-center">
        Type to search across files
      </p>
    </div>
  );
}
