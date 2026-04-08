import { ipcMain, BrowserWindow } from 'electron';
import os from 'os';

// node-pty is a native module — require at runtime
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
} catch {
  console.warn('node-pty not available — terminal disabled');
}

const terminals = new Map<string, import('node-pty').IPty>();
let terminalCounter = 0;

export function registerTerminalHandlers() {
  ipcMain.handle('terminal:create', (event, cwd?: string) => {
    if (!pty) throw new Error('Terminal not available');

    const id = `term-${++terminalCounter}`;
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';

    const term = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: cwd || os.homedir(),
      env: { ...process.env } as Record<string, string>,
    });

    term.onData((data) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.webContents.send('terminal:data', id, data);
    });

    term.onExit(() => {
      terminals.delete(id);
    });

    terminals.set(id, term);
    return id;
  });

  ipcMain.handle('terminal:write', (_, id: string, data: string) => {
    const term = terminals.get(id);
    if (!term) throw new Error(`Terminal ${id} not found`);
    term.write(data);
  });

  ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number) => {
    const term = terminals.get(id);
    if (!term) throw new Error(`Terminal ${id} not found`);
    term.resize(cols, rows);
  });

  ipcMain.handle('terminal:destroy', (_, id: string) => {
    const term = terminals.get(id);
    if (term) {
      term.kill();
      terminals.delete(id);
    }
  });
}
