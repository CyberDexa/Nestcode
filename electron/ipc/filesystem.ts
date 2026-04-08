import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

const watchers = new Map<string, fs.FSWatcher>();

export function registerFileSystemHandlers() {
  ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const results = entries
      .filter((e) => !e.name.startsWith('.') || e.name === '.gitignore')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
      }));
    return results;
  });

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('fs:createFile', async (_, filePath: string) => {
    await fs.promises.writeFile(filePath, '', 'utf-8');
  });

  ipcMain.handle('fs:createDir', async (_, dirPath: string) => {
    await fs.promises.mkdir(dirPath, { recursive: true });
  });

  ipcMain.handle('fs:delete', async (_, entryPath: string) => {
    const stat = await fs.promises.stat(entryPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(entryPath, { recursive: true });
    } else {
      await fs.promises.unlink(entryPath);
    }
  });

  ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
    await fs.promises.rename(oldPath, newPath);
  });

  ipcMain.handle('fs:watch', async (event, dirPath: string) => {
    if (watchers.has(dirPath)) return;

    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.webContents.send('fs:change', eventType, path.join(dirPath, filename));
    });

    watchers.set(dirPath, watcher);
  });

  ipcMain.handle('fs:unwatch', async (_, dirPath: string) => {
    const watcher = watchers.get(dirPath);
    if (watcher) {
      watcher.close();
      watchers.delete(dirPath);
    }
  });
}
