import { contextBridge, ipcRenderer } from 'electron';

export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
};

export type GitStatus = {
  modified: string[];
  added: string[];
  deleted: string[];
  renamed: string[];
  untracked: string[];
  staged: string[];
  branch: string;
  ahead: number;
  behind: number;
};

export type OpenClawStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const api = {
  // ──── File System ────
  readDir: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  createFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('fs:createFile', filePath),
  createDir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:createDir', dirPath),
  deleteEntry: (entryPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:delete', entryPath),
  renameEntry: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:rename', oldPath, newPath),
  watchDir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:watch', dirPath),
  unwatchDir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:unwatch', dirPath),
  onFsChange: (callback: (event: string, filePath: string) => void) => {
    const handler = (_: unknown, event: string, filePath: string) => callback(event, filePath);
    ipcRenderer.on('fs:change', handler);
    return () => ipcRenderer.removeListener('fs:change', handler);
  },

  // ──── Terminal ────
  terminalCreate: (cwd?: string): Promise<string> =>
    ipcRenderer.invoke('terminal:create', cwd),
  terminalWrite: (id: string, data: string): Promise<void> =>
    ipcRenderer.invoke('terminal:write', id, data),
  terminalResize: (id: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('terminal:resize', id, cols, rows),
  terminalDestroy: (id: string): Promise<void> =>
    ipcRenderer.invoke('terminal:destroy', id),
  onTerminalData: (callback: (id: string, data: string) => void) => {
    const handler = (_: unknown, id: string, data: string) => callback(id, data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  getTerminalBuffer: (id?: string): Promise<string> =>
    ipcRenderer.invoke('terminal:getBuffer', id),
  terminalExec: (command: string, cwd?: string): Promise<string> =>
    ipcRenderer.invoke('terminal:exec', command, cwd),

  // ──── Git ────
  gitStatus: (repoPath: string): Promise<GitStatus> =>
    ipcRenderer.invoke('git:status', repoPath),
  gitStage: (repoPath: string, files: string[]): Promise<void> =>
    ipcRenderer.invoke('git:stage', repoPath, files),
  gitUnstage: (repoPath: string, files: string[]): Promise<void> =>
    ipcRenderer.invoke('git:unstage', repoPath, files),
  gitCommit: (repoPath: string, message: string): Promise<void> =>
    ipcRenderer.invoke('git:commit', repoPath, message),
  gitDiff: (repoPath: string, filePath: string): Promise<string> =>
    ipcRenderer.invoke('git:diff', repoPath, filePath),
  gitBranches: (repoPath: string): Promise<{ current: string; all: string[] }> =>
    ipcRenderer.invoke('git:branches', repoPath),
  gitCheckout: (repoPath: string, branch: string): Promise<void> =>
    ipcRenderer.invoke('git:checkout', repoPath, branch),

  // ──── OpenClaw ────
  openclawConnect: (gatewayUrl: string, token?: string | null): Promise<void> =>
    ipcRenderer.invoke('openclaw:connect', gatewayUrl, token),
  openclawDisconnect: (): Promise<void> =>
    ipcRenderer.invoke('openclaw:disconnect'),
  openclawSendMessage: (sessionId: string, message: string, context?: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('openclaw:sendMessage', sessionId, message, context),
  openclawCreateSession: (workspacePath: string): Promise<string> =>
    ipcRenderer.invoke('openclaw:createSession', workspacePath),
  openclawAutoStart: (): Promise<boolean> =>
    ipcRenderer.invoke('openclaw:autoStart'),
  openclawGetStatus: (): Promise<{ status: OpenClawStatus; version?: string; gatewayUrl?: string }> =>
    ipcRenderer.invoke('openclaw:getStatus'),
  onOpenClawMessage: (callback: (sessionId: string, chunk: string, done: boolean) => void) => {
    const handler = (_: unknown, sessionId: string, chunk: string, done: boolean) =>
      callback(sessionId, chunk, done);
    ipcRenderer.on('openclaw:message', handler);
    return () => ipcRenderer.removeListener('openclaw:message', handler);
  },
  onOpenClawStatus: (callback: (status: OpenClawStatus) => void) => {
    const handler = (_: unknown, status: OpenClawStatus) => callback(status);
    ipcRenderer.on('openclaw:status', handler);
    return () => ipcRenderer.removeListener('openclaw:status', handler);
  },
  onOpenClawToolEvent: (callback: (event: string, payload: unknown) => void) => {
    const handler = (_: unknown, event: string, payload: unknown) => callback(event, payload);
    ipcRenderer.on('openclaw:toolEvent', handler);
    return () => ipcRenderer.removeListener('openclaw:toolEvent', handler);
  },

  // ──── Window ────
  openFolderDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),
  onOpenFolder: (callback: (folderPath: string) => void) => {
    const handler = (_: unknown, folderPath: string) => callback(folderPath);
    ipcRenderer.on('open-folder', handler);
    return () => ipcRenderer.removeListener('open-folder', handler);
  },
  onSaveFile: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('save-file', handler);
    return () => ipcRenderer.removeListener('save-file', handler);
  },
  onSaveAllFiles: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('save-all-files', handler);
    return () => ipcRenderer.removeListener('save-all-files', handler);
  },
};

contextBridge.exposeInMainWorld('nestcode', api);

export type NestCodeAPI = typeof api;
