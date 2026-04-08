import { useEffect, useCallback } from 'react';
import { useFileStore, type FileEntry } from '../../store/fileStore';
import { useEditorStore } from '../../store/editorStore';
import clsx from 'clsx';

export function FileExplorer() {
  const { rootPath, rootName, tree, loading, setTree, setLoading, setRootPath } = useFileStore();

  const loadRoot = useCallback(async (dirPath: string) => {
    if (!window.nestcode) return;
    setLoading(true);
    try {
      const entries = await window.nestcode.readDir(dirPath);
      setTree(entries.map((e: FileEntry) => ({ ...e, isExpanded: false })));
      window.nestcode.watchDir(dirPath);
    } catch (err) {
      console.error('Failed to read directory:', err);
    }
    setLoading(false);
  }, [setTree, setLoading]);

  useEffect(() => {
    if (rootPath) {
      loadRoot(rootPath);
    }
  }, [rootPath, loadRoot]);

  // Listen for fs changes and refresh
  useEffect(() => {
    if (!window.nestcode || !rootPath) return;
    return window.nestcode.onFsChange(() => {
      loadRoot(rootPath);
    });
  }, [rootPath, loadRoot]);

  if (!rootPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 py-8">
        <p className="text-xs text-text-muted mb-4 text-center">
          No folder open
        </p>
        <button
          onClick={async () => {
            // In non-Electron mode, show a message
            if (!window.nestcode) {
              setRootPath('/tmp/demo');
              return;
            }
          }}
          className="px-4 py-2 text-xs bg-nest/10 text-nest border border-nest/20 rounded-lg hover:bg-nest/20 transition-colors"
        >
          Open Folder
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-xs text-text-muted animate-pulse">
        Loading files...
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* Root folder name */}
      <div className="px-3 py-1 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
        {rootName}
      </div>
      {tree.map((entry) => (
        <TreeNode key={entry.path} entry={entry} depth={0} />
      ))}
    </div>
  );
}

function TreeNode({ entry, depth }: { entry: FileEntry; depth: number }) {
  const { toggleExpanded, updateChildren } = useFileStore();
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const isActive = tabs.some((t) => t.filePath === entry.path && t.id === activeTabId);

  const handleClick = async () => {
    if (entry.isDirectory) {
      if (!entry.children && window.nestcode) {
        const children = await window.nestcode.readDir(entry.path);
        updateChildren(
          entry.path,
          children.map((c: FileEntry) => ({ ...c, isExpanded: false }))
        );
      } else {
        toggleExpanded(entry.path);
      }
    } else {
      // Open file
      if (window.nestcode) {
        const content = await window.nestcode.readFile(entry.path);
        useEditorStore.getState().openFile(entry.path, content);
      } else {
        useEditorStore.getState().openFile(entry.path, `// ${entry.name}\n`);
      }
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={clsx(
          'flex items-center h-[26px] px-2 cursor-pointer transition-colors group',
          isActive
            ? 'bg-nest/10 text-text-primary'
            : 'hover:bg-surface-3 text-text-secondary hover:text-text-primary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Chevron for directories */}
        {entry.isDirectory ? (
          <svg
            viewBox="0 0 24 24"
            className={clsx(
              'w-3.5 h-3.5 mr-1 flex-shrink-0 text-text-muted transition-transform',
              entry.isExpanded && 'rotate-90'
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <span className="w-3.5 mr-1 flex-shrink-0" />
        )}

        {/* Icon */}
        <span className="text-2xs mr-1.5 flex-shrink-0">
          {entry.isDirectory
            ? entry.isExpanded ? '📂' : '📁'
            : getFileIcon(entry.name)}
        </span>

        {/* Name */}
        <span className="text-xs truncate">{entry.name}</span>
      </div>

      {/* Children */}
      {entry.isDirectory && entry.isExpanded && entry.children && (
        <div className="animate-slide-up">
          {entry.children.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: '🔷', tsx: '⚛️', js: '🟡', jsx: '⚛️',
    json: '📋', md: '📝', css: '🎨', html: '🌐',
    py: '🐍', rs: '🦀', go: '🔵', yaml: '⚙️', yml: '⚙️',
    sh: '🖥️', svg: '🎯', lock: '🔒', gitignore: '🔒',
  };
  return map[ext] || '📄';
}
