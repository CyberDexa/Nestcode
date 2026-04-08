import { useEffect, useState } from 'react';
import { useFileStore } from '../../store/fileStore';

type GitStatus = {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  staged: string[];
  branch: string;
  ahead: number;
  behind: number;
};

export function GitPanel() {
  const rootPath = useFileStore((s) => s.rootPath);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rootPath || !window.nestcode) return;

    const refresh = async () => {
      try {
        const s = await window.nestcode.gitStatus(rootPath);
        setStatus(s);
      } catch {
        setStatus(null);
      }
    };

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [rootPath]);

  if (!rootPath) {
    return (
      <div className="px-4 py-8 text-center text-xs text-text-muted">
        Open a folder to see source control
      </div>
    );
  }

  if (!status) {
    return (
      <div className="px-4 py-8 text-center text-xs text-text-muted">
        Not a git repository
      </div>
    );
  }

  const changes = [
    ...status.modified.map((f) => ({ name: f, status: 'M' as const })),
    ...status.added.map((f) => ({ name: f, status: 'A' as const })),
    ...status.deleted.map((f) => ({ name: f, status: 'D' as const })),
    ...status.untracked.map((f) => ({ name: f, status: 'U' as const })),
  ];

  const handleCommit = async () => {
    if (!commitMsg.trim() || !rootPath || !window.nestcode) return;
    setLoading(true);
    try {
      // Stage all
      const allFiles = changes.map((c) => c.name);
      if (allFiles.length > 0) {
        await window.nestcode.gitStage(rootPath, allFiles);
      }
      await window.nestcode.gitCommit(rootPath, commitMsg.trim());
      setCommitMsg('');
      // Refresh
      const s = await window.nestcode.gitStatus(rootPath);
      setStatus(s);
    } catch (err) {
      console.error('Commit failed:', err);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Branch info */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border-subtle">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-nest" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 01-9 9" />
        </svg>
        <span className="text-xs text-text-primary font-medium">{status.branch}</span>
        {(status.ahead > 0 || status.behind > 0) && (
          <span className="text-2xs text-text-muted">
            {status.ahead > 0 && `↑${status.ahead}`}
            {status.behind > 0 && ` ↓${status.behind}`}
          </span>
        )}
      </div>

      {/* Commit input */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <input
          type="text"
          placeholder="Commit message"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
          className="w-full h-7 px-2.5 text-xs bg-surface-3 border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none transition-colors"
        />
        <button
          onClick={handleCommit}
          disabled={!commitMsg.trim() || loading || changes.length === 0}
          className="mt-2 w-full h-7 text-xs bg-nest/15 text-nest border border-nest/25 rounded hover:bg-nest/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Committing...' : `Commit All (${changes.length})`}
        </button>
      </div>

      {/* Changes list */}
      <div className="flex-1 overflow-y-auto py-1">
        {changes.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted">
            No changes
          </div>
        ) : (
          <>
            <div className="px-3 py-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Changes ({changes.length})
            </div>
            {changes.map((change) => (
              <div
                key={change.name}
                className="flex items-center h-[26px] px-3 hover:bg-surface-3 cursor-pointer transition-colors group"
              >
                <span
                  className={`text-2xs font-mono font-bold w-4 flex-shrink-0 ${
                    change.status === 'M'
                      ? 'text-status-modified'
                      : change.status === 'A'
                      ? 'text-status-added'
                      : change.status === 'D'
                      ? 'text-status-deleted'
                      : 'text-text-muted'
                  }`}
                >
                  {change.status}
                </span>
                <span className="text-xs text-text-secondary truncate ml-2 group-hover:text-text-primary transition-colors">
                  {change.name}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
