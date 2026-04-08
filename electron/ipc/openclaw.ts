import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess, execSync } from 'child_process';
import http from 'http';
import https from 'https';
import { URL } from 'url';

let openclawProcess: ChildProcess | null = null;
let gatewayUrl: string | null = null;
let wsConnection: import('http').ClientRequest | null = null;
let statusInterval: NodeJS.Timeout | null = null;

type OpenClawStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
let currentStatus: OpenClawStatus = 'disconnected';

function setStatus(status: OpenClawStatus, win?: BrowserWindow | null) {
  currentStatus = status;
  if (win) {
    win.webContents.send('openclaw:status', status);
  } else {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('openclaw:status', status)
    );
  }
}

function isOpenClawInstalled(): string | null {
  try {
    const result = execSync('which openclaw', { encoding: 'utf-8' }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function isGatewayRunning(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(`${url}/health`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function registerOpenClawHandlers() {
  // Auto-start: detect if OpenClaw is installed, start gateway if not running
  ipcMain.handle('openclaw:autoStart', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const clawPath = isOpenClawInstalled();
    if (!clawPath) {
      setStatus('error', win);
      return false;
    }

    // Try common local gateway ports
    const candidates = [
      'http://localhost:3100',
      'http://localhost:3000',
      'http://localhost:8080',
    ];

    for (const url of candidates) {
      if (await isGatewayRunning(url)) {
        gatewayUrl = url;
        setStatus('connected', win);
        startHealthCheck(win);
        return true;
      }
    }

    // Gateway not running — start it
    try {
      setStatus('connecting', win);
      openclawProcess = spawn('openclaw', ['gateway', 'start'], {
        stdio: 'ignore',
        detached: true,
        env: { ...process.env },
      });

      openclawProcess.unref();

      // Wait for gateway to be ready (poll up to 15s)
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        for (const url of candidates) {
          if (await isGatewayRunning(url)) {
            gatewayUrl = url;
            setStatus('connected', win);
            startHealthCheck(win);
            return true;
          }
        }
      }

      setStatus('error', win);
      return false;
    } catch {
      setStatus('error', win);
      return false;
    }
  });

  ipcMain.handle('openclaw:connect', async (event, url: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    setStatus('connecting', win);

    if (await isGatewayRunning(url)) {
      gatewayUrl = url;
      setStatus('connected', win);
      startHealthCheck(win);
    } else {
      setStatus('error', win);
      throw new Error(`Cannot connect to OpenClaw at ${url}`);
    }
  });

  ipcMain.handle('openclaw:disconnect', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    stopHealthCheck();
    gatewayUrl = null;
    setStatus('disconnected', win);
  });

  ipcMain.handle('openclaw:getStatus', async () => {
    return {
      status: currentStatus,
      gatewayUrl,
    };
  });

  ipcMain.handle('openclaw:createSession', async (_, workspacePath: string) => {
    if (!gatewayUrl) throw new Error('Not connected to OpenClaw');

    const res = await fetch(`${gatewayUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace: workspacePath }),
    });

    if (!res.ok) throw new Error(`Session creation failed: ${res.statusText}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  });

  ipcMain.handle(
    'openclaw:sendMessage',
    async (
      event,
      sessionId: string,
      message: string,
      context?: Record<string, unknown>
    ) => {
      if (!gatewayUrl) throw new Error('Not connected to OpenClaw');

      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await fetch(`${gatewayUrl}/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
      });

      if (!res.ok) throw new Error(`Send failed: ${res.statusText}`);
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          win?.webContents.send('openclaw:message', sessionId, '', true);
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        win?.webContents.send('openclaw:message', sessionId, chunk, false);
      }
    }
  );
}

function startHealthCheck(win: BrowserWindow | null) {
  stopHealthCheck();
  statusInterval = setInterval(async () => {
    if (!gatewayUrl) return;
    const alive = await isGatewayRunning(gatewayUrl);
    if (!alive && currentStatus === 'connected') {
      setStatus('error', win);
    } else if (alive && currentStatus !== 'connected') {
      setStatus('connected', win);
    }
  }, 10000);
}

function stopHealthCheck() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}
