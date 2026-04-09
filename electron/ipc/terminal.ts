import { ipcMain, BrowserWindow } from 'electron';
import { exec } from 'child_process';
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

// ── Terminal output buffer (for error surfacing to AI) ──────────────────────
const terminalBuffers = new Map<string, string>();
const MAX_BUFFER_SIZE = 30_000;

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\r/g, '');
}

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
      // Capture in buffer for AI context / error surfacing
      let buf = (terminalBuffers.get(id) || '') + data;
      if (buf.length > MAX_BUFFER_SIZE) buf = buf.slice(-MAX_BUFFER_SIZE);
      terminalBuffers.set(id, buf);

      const win = BrowserWindow.fromWebContents(event.sender);
      win?.webContents.send('terminal:data', id, data);
    });

    term.onExit(() => {
      terminals.delete(id);
      terminalBuffers.delete(id);
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
      terminalBuffers.delete(id);
    }
  });

  // Return recent terminal output (ANSI-stripped) for AI context
  ipcMain.handle('terminal:getBuffer', (_event, id?: string) => {
    if (id) return stripAnsi(terminalBuffers.get(id) || '').slice(-5000);
    const all = Array.from(terminalBuffers.values()).join('\n');
    return stripAnsi(all).slice(-5000);
  });

  // Execute a one-shot command and return output (for chat "Run" actions)
  ipcMain.handle('terminal:exec', (_event, command: string, cwd?: string) => {
    return new Promise<string>((resolve) => {
      exec(command, {
        cwd: cwd || os.homedir(),
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env } as Record<string, string>,
      }, (err, stdout, stderr) => {
        if (err) resolve(`Error: ${err.message}\n${stderr || ''}`);
        else resolve(stdout + (stderr ? `\n${stderr}` : ''));
      });
    });
  });
}
