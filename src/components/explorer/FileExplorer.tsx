import { useEffect, useCallback, useState, useRef, createContext, useContext } from 'react';
import { useFileStore, type FileEntry } from '../../store/fileStore';
import { useEditorStore } from '../../store/editorStore';
import clsx from 'clsx';

// ── Path helpers (no Node path module in renderer) ──────────────────────────
const joinPath = (base: string, name: string) =>
  `${base.replace(/\/$/, '')}/${name}`;

const parentPath = (p: string) => p.replace(/\/[^/]+\/?$/, '') || '/';
const basename = (p: string) => p.split('/').filter(Boolean).pop() || '';

// ── Context ──────────────────────────────────────────────────────────────────
type ContextMenuState = { x: number; y: number; entry: FileEntry | null; parentPath: string };
type CreatingState = { parentPath: string; type: 'file' | 'folder' } | null;

type ExplorerCtx = {
  creating: CreatingState;
  renaming: string | null;
  startCreate: (parentPath: string, type: 'file' | 'folder') => void;
  startRename: (path: string) => void;
  cancelCreate: () => void;
  cancelRename: () => void;
  onCreateConfirm: (parentPath: string, name: string, type: 'file' | 'folder') => Promise<void>;
  onRenameConfirm: (oldPath: string, newName: string) => Promise<void>;
  onDelete: (entry: FileEntry) => Promise<void>;
  openContextMenu: (x: number, y: number, entry: FileEntry | null, parentPath: string) => void;
};

const ExplorerContext = createContext<ExplorerCtx | null>(null);

// ── FileExplorer (root) ───────────────────────────────────────────────────────
export function FileExplorer() {
  const { rootPath, rootName, tree, loading, setTree, setLoading, setRootPath } = useFileStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [creating, setCreating] = useState<CreatingState>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    if (rootPath) loadRoot(rootPath);
  }, [rootPath, loadRoot]);

  useEffect(() => {
    if (!window.nestcode || !rootPath) return;
    return window.nestcode.onFsChange(() => loadRoot(rootPath));
  }, [rootPath, loadRoot]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const startCreate = (parentP: string, type: 'file' | 'folder') => {
    setContextMenu(null);
    setCreating({ parentPath: parentP, type });
    // Ensure parent directory is expanded (best effort)
    if (rootPath && parentP !== rootPath) {
      useFileStore.getState().expandPath(parentP);
    }
  };

  const startRename = (p: string) => {
    setContextMenu(null);
    setRenaming(p);
  };

  const onCreateConfirm = async (parentP: string, name: string, type: 'file' | 'folder') => {
    const trimmed = name.trim();
    if (!trimmed || !window.nestcode) { setCreating(null); return; }
    try {
      const newPath = joinPath(parentP, trimmed);
      if (type === 'file') await window.nestcode.createFile(newPath);
      else await window.nestcode.createDir(newPath);
    } catch (err) {
      console.error('Create failed:', err);
    }
    setCreating(null);
  };

  const onRenameConfirm = async (oldP: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !window.nestcode) { setRenaming(null); return; }
    try {
      const newP = joinPath(parentPath(oldP), trimmed);
      await window.nestcode.renameEntry(oldP, newP);
    } catch (err) {
      console.error('Rename failed:', err);
    }
    setRenaming(null);
  };

  const onDelete = async (entry: FileEntry) => {
    setContextMenu(null);
    if (!window.nestcode) return;
    if (!window.confirm(`Delete "${entry.name}"?\nThis cannot be undone.`)) return;
    try {
      await window.nestcode.deleteEntry(entry.path);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const openContextMenu = (x: number, y: number, entry: FileEntry | null, parentP: string) => {
    setContextMenu({ x, y, entry, parentPath: parentP });
  };

  const ctxValue: ExplorerCtx = {
    creating, renaming,
    startCreate, startRename, cancelCreate: () => setCreating(null), cancelRename: () => setRenaming(null),
    onCreateConfirm, onRenameConfirm, onDelete, openContextMenu,
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!rootPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 py-8">
        <svg className="w-10 h-10 text-text-muted mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        <p className="text-xs text-text-muted mb-4 text-center">No folder open</p>
        <button
          onClick={async () => {
            if (window.nestcode?.openFolderDialog) {
              const folder = await window.nestcode.openFolderDialog();
              if (folder) setRootPath(folder);
            } else {
              setRootPath('/tmp/demo');
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
    return <div className="p-4 text-xs text-text-muted animate-pulse">Loading files…</div>;
  }

  const cmParentPath = rootPath;

  return (
    <ExplorerContext.Provider value={ctxValue}>
      <div
        className="py-1 select-none min-h-full"
        onContextMenu={(e) => {
          e.preventDefault();
          openContextMenu(e.clientX, e.clientY, null, cmParentPath);
        }}
      >
        {/* Root folder header */}
        <div className="flex items-center justify-between px-3 py-1 group">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider truncate">
            {rootName}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconBtn title="New File" onClick={() => startCreate(rootPath, 'file')}>
              <path d="M12 5v14M5 12h14" />
            </IconBtn>
            <IconBtn title="New Folder" onClick={() => startCreate(rootPath, 'folder')}>
              <path d="M9 13h6m-3-3v6M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </IconBtn>
            <IconBtn title="Refresh" onClick={() => loadRoot(rootPath)}>
              <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.65-2.65L20 9M4 15l1.35 2.65A9 9 0 0020 15" />
            </IconBtn>
          </div>
        </div>

        {/* Root-level inline create */}
        {creating?.parentPath === rootPath && (
          <InlineInput
            type={creating.type}
            parentPath={rootPath}
            depth={0}
            onConfirm={onCreateConfirm}
            onCancel={() => setCreating(null)}
          />
        )}

        {tree.map((entry) => (
          <TreeNode key={entry.path} entry={entry} depth={0} />
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-surface-2 border border-border-DEFAULT rounded-lg shadow-2xl py-1 min-w-[168px] text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <CtxItem
            label="New File"
            icon={<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />}
            onClick={() => {
              const target = contextMenu.entry?.isDirectory
                ? contextMenu.entry.path
                : contextMenu.entry
                ? parentPath(contextMenu.entry.path)
                : contextMenu.parentPath;
              startCreate(target, 'file');
            }}
          />
          <CtxItem
            label="New Folder"
            icon={<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />}
            onClick={() => {
              const target = contextMenu.entry?.isDirectory
                ? contextMenu.entry.path
                : contextMenu.entry
                ? parentPath(contextMenu.entry.path)
                : contextMenu.parentPath;
              startCreate(target, 'folder');
            }}
          />
          {contextMenu.entry && (
            <>
              <div className="my-1 h-px bg-border-subtle" />
              <CtxItem
                label="Rename"
                icon={<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />}
                onClick={() => startRename(contextMenu.entry!.path)}
              />
              <CtxItem
                label="Delete"
                icon={<path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />}
                danger
                onClick={() => onDelete(contextMenu.entry!)}
              />
            </>
          )}
        </div>
      )}
    </ExplorerContext.Provider>
  );
}

// ── TreeNode ──────────────────────────────────────────────────────────────────
function TreeNode({ entry, depth }: { entry: FileEntry; depth: number }) {
  const ctx = useContext(ExplorerContext)!;
  const { toggleExpanded, updateChildren } = useFileStore();
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const isActive = tabs.some((t) => t.filePath === entry.path && t.id === activeTabId);
  const isRenaming = ctx.renaming === entry.path;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.isDirectory) {
      if (!entry.children && window.nestcode) {
        const children = await window.nestcode.readDir(entry.path);
        updateChildren(entry.path, children.map((c: FileEntry) => ({ ...c, isExpanded: false })));
      } else {
        toggleExpanded(entry.path);
      }
    } else {
      if (window.nestcode) {
        const content = await window.nestcode.readFile(entry.path);
        useEditorStore.getState().openFile(entry.path, content);
      } else {
        useEditorStore.getState().openFile(entry.path, `// ${entry.name}\n`);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    ctx.openContextMenu(e.clientX, e.clientY, entry, entry.isDirectory ? entry.path : parentPath(entry.path));
  };

  if (isRenaming) {
    return (
      <RenameInput
        entry={entry}
        depth={depth}
        onConfirm={ctx.onRenameConfirm}
        onCancel={ctx.cancelRename}
      />
    );
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={clsx(
          'flex items-center h-[26px] px-2 cursor-pointer transition-colors group',
          isActive
            ? 'bg-nest/10 text-text-primary'
            : 'hover:bg-surface-3 text-text-secondary hover:text-text-primary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {entry.isDirectory ? (
          <svg viewBox="0 0 24 24" className={clsx('w-3.5 h-3.5 mr-1 flex-shrink-0 text-text-muted transition-transform', entry.isExpanded && 'rotate-90')} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <span className="w-3.5 mr-1 flex-shrink-0" />
        )}
        <span className="text-2xs mr-1.5 flex-shrink-0">
          {entry.isDirectory ? (entry.isExpanded ? '📂' : '📁') : getFileIcon(entry.name)}
        </span>
        <span className="text-xs truncate flex-1">{entry.name}</span>
      </div>

      {entry.isDirectory && entry.isExpanded && (
        <div className="animate-slide-up">
          {/* Inline create inside this directory */}
          {ctx.creating?.parentPath === entry.path && (
            <InlineInput
              type={ctx.creating.type}
              parentPath={entry.path}
              depth={depth + 1}
              onConfirm={ctx.onCreateConfirm}
              onCancel={ctx.cancelCreate}
            />
          )}
          {entry.children?.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── InlineInput (new file/folder) ─────────────────────────────────────────────
function InlineInput({
  type, parentPath: parentP, depth, onConfirm, onCancel,
}: {
  type: 'file' | 'folder';
  parentPath: string;
  depth: number;
  onConfirm: (parentPath: string, name: string, type: 'file' | 'folder') => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div
      className="flex items-center h-[26px] gap-1"
      style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
    >
      <span className="text-sm flex-shrink-0">{type === 'file' ? '📄' : '📁'}</span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm(parentP, value, type);
          else if (e.key === 'Escape') onCancel();
        }}
        onBlur={onCancel}
        placeholder={type === 'file' ? 'filename.ext' : 'folder name'}
        className="flex-1 text-xs bg-surface-3 border border-nest/50 rounded px-1.5 h-5 text-text-primary placeholder:text-text-muted focus:outline-none"
      />
    </div>
  );
}

// ── RenameInput ───────────────────────────────────────────────────────────────
function RenameInput({
  entry, depth, onConfirm, onCancel,
}: {
  entry: FileEntry;
  depth: number;
  onConfirm: (oldPath: string, newName: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(basename(entry.path) || entry.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <div
      className="flex items-center h-[26px] gap-1"
      style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
    >
      <span className="text-2xs flex-shrink-0">
        {entry.isDirectory ? '📁' : getFileIcon(entry.name)}
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm(entry.path, value);
          else if (e.key === 'Escape') onCancel();
        }}
        onBlur={onCancel}
        className="flex-1 text-xs bg-surface-3 border border-nest/50 rounded px-1.5 h-5 text-text-primary focus:outline-none"
      />
    </div>
  );
}

// ── Context menu item ─────────────────────────────────────────────────────────
function CtxItem({
  label, icon, danger, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => { e.stopPropagation(); onClick(); }}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface-3 transition-colors text-left',
        danger ? 'text-status-error' : 'text-text-secondary hover:text-text-primary'
      )}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        {icon}
      </svg>
      {label}
    </button>
  );
}

// ── Small icon button for toolbar ─────────────────────────────────────────────
function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </button>
  );
}

// ── File icon helper ──────────────────────────────────────────────────────────
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

