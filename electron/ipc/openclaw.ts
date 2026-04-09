import { ipcMain, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';

// ── OpenClaw WebSocket RPC Protocol ──────────────────────────────────────────

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface WsRpcResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

interface WsEvent {
  type: 'event';
  seq?: number;
  event: string;
  payload?: unknown;
}

type WsInboundMessage = WsRpcResponse | WsEvent;

interface ChatEventPayload {
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  sessionKey?: string;
  runId?: string;
  errorMessage?: string;
}

// ── Text extractor: handles Anthropic, OpenAI, and plain string shapes ────────
function extractText(msg: unknown): string {
  if (typeof msg === 'string') return msg;
  if (!msg || typeof msg !== 'object') return '';
  const m = msg as Record<string, unknown>;
  // Plain string content
  if (typeof m.content === 'string') return m.content;
  // Anthropic array content: [{ type: 'text', text: '...' }]
  if (Array.isArray(m.content)) {
    return (m.content as Array<Record<string, unknown>>)
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
  }
  // Direct text field
  if (typeof m.text === 'string') return m.text;
  // OpenAI delta: { choices: [{ delta: { content } }] }
  if (Array.isArray((m as { choices?: unknown }).choices)) {
    const choice = (m.choices as Array<Record<string, Record<string, string>>>)[0];
    return choice?.delta?.content ?? choice?.message?.content ?? '';
  }
  return '';
}

// ── IDE Context formatting for agentic messages ──────────────────────────────
function formatContextBlock(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return '';
  const parts: string[] = [];
  if (ctx.workspace) {
    parts.push(`<workspace>${ctx.workspace}</workspace>`);
  }
  if (Array.isArray(ctx.openFiles) && ctx.openFiles.length > 0) {
    parts.push(`<open_files>\n${(ctx.openFiles as string[]).join('\n')}\n</open_files>`);
  }
  if (ctx.activeFile) {
    const lang = (ctx.activeFileLanguage as string) || '';
    parts.push(`<active_file path="${ctx.activeFile}" language="${lang}">`);
    if (ctx.activeFileContent) {
      const content = String(ctx.activeFileContent).slice(0, 12_000);
      parts.push('```' + lang + '\n' + content + '\n```');
    }
    parts.push('</active_file>');
  }
  if (ctx.selection) {
    const sel = ctx.selection as { text: string; startLine?: number; endLine?: number };
    parts.push(`<selection lines="${sel.startLine ?? '?'}-${sel.endLine ?? '?'}">\n${sel.text}\n</selection>`);
  }
  if (ctx.terminalOutput) {
    parts.push(`<terminal_output>\n${String(ctx.terminalOutput).slice(-3000)}\n</terminal_output>`);
  }
  if (Array.isArray(ctx.diagnostics) && ctx.diagnostics.length > 0) {
    parts.push(`<diagnostics>\n${(ctx.diagnostics as string[]).join('\n')}\n</diagnostics>`);
  }
  return parts.length > 0 ? '<ide_context>\n' + parts.join('\n') + '\n</ide_context>' : '';
}

// ── WebSocket RPC client class ────────────────────────────────────────────────
class OpenClawWsClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private eventCb: ((event: string, payload: unknown) => void) | null = null;
  private onClose: (() => void) | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  constructor(
    private readonly url: string, // already ws:// or wss://
    private readonly token: string | null,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      // Derive an HTTP Origin from the ws:// URL so the gateway origin-check passes
      const origin = this.url.replace(/^ws(s?):\/\//, 'http$1://');

      try {
        this.ws = new WebSocket(this.url, { headers: { Origin: origin } });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }

      const connTimeout = setTimeout(() => {
        if (this.connectReject) {
          this.connectReject(new Error('Connection timeout after 15s'));
          this.connectResolve = null;
          this.connectReject = null;
          this.ws?.terminate();
        }
      }, 15000);

      let connectSent = false;
      let connectTimer: ReturnType<typeof setTimeout> | null = null;

      // Real OpenClaw protocol: client sends a JSON-RPC 'connect' request
      // (type:'req', method:'connect') after open (+750ms or on connect.challenge event).
      // Server replies with type:'res', ok:true — that IS the hello.
      const sendConnect = () => {
        if (connectSent) return;
        connectSent = true;
        if (connectTimer !== null) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }

        const id = randomUUID();
        const auth: Record<string, unknown> = {};
        if (this.token) auth.token = this.token;

        const params: Record<string, unknown> = {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'openclaw-control-ui',
            version: '1.0',
            platform: 'electron',
            mode: 'webchat',
          },
          role: 'operator',
          scopes: [
            'operator.admin',
            'operator.read',
            'operator.write',
            'operator.approvals',
            'operator.pairing',
          ],
          caps: ['tool-events'],
          auth,
          locale: 'en',
        };

        // Register as a pending request; its resolution resolves the connect() promise
        const reqTimer = setTimeout(() => {
          this.pending.delete(id);
          const err = new Error('Connect request timed out (no response from gateway)');
          clearTimeout(connTimeout);
          this.connectReject?.(err);
          this.connectResolve = null;
          this.connectReject = null;
        }, 12000);

        this.pending.set(id, {
          resolve: (_payload) => {
            clearTimeout(connTimeout);
            this.connectResolve?.();
            this.connectResolve = null;
            this.connectReject = null;
          },
          reject: (err) => {
            clearTimeout(connTimeout);
            this.connectReject?.(err);
            this.connectResolve = null;
            this.connectReject = null;
            this.ws?.terminate();
          },
          timer: reqTimer,
        });

        this.ws!.send(JSON.stringify({ type: 'req', id, method: 'connect', params }));
      };

      this.ws.on('open', () => {
        // Wait 750ms for a connect.challenge event; fire connect regardless after that
        connectTimer = setTimeout(sendConnect, 750);
      });

      this.ws.on('message', (raw: WebSocket.RawData) => {
        let msg: WsInboundMessage;
        try {
          msg = JSON.parse(raw.toString()) as WsInboundMessage;
        } catch {
          return;
        }

        // Server may challenge us before we time out — respond immediately
        if (msg.type === 'event' && (msg as WsEvent).event === 'connect.challenge') {
          sendConnect();
          return;
        }

        if (msg.type === 'res' && (msg as WsRpcResponse).id) {
          const rpcMsg = msg as WsRpcResponse;
          const pending = this.pending.get(rpcMsg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(rpcMsg.id);
            if (rpcMsg.ok) {
              pending.resolve(rpcMsg.payload ?? null);
            } else {
              pending.reject(new Error(rpcMsg.error?.message ?? 'RPC error'));
            }
          }
          return;
        }

        if (msg.type === 'event' && (msg as WsEvent).event) {
          const evtMsg = msg as WsEvent;
          this.eventCb?.(evtMsg.event, evtMsg.payload ?? null);
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(connTimeout);
        if (connectTimer) clearTimeout(connectTimer);
        const e = err instanceof Error ? err : new Error(String(err));
        if (this.connectReject) {
          this.connectReject(e);
          this.connectResolve = null;
          this.connectReject = null;
        }
        this.rejectAllPending(e);
      });

      this.ws.on('close', (code) => {
        clearTimeout(connTimeout);
        if (connectTimer) clearTimeout(connectTimer);
        // code 4008 = gateway closed due to auth/connect failure
        let errMsg = 'WebSocket connection closed';
        if (code === 4008) errMsg = 'Gateway rejected the connection (auth token invalid or missing)';
        const e = new Error(errMsg);
        if (this.connectReject) {
          this.connectReject(e);
          this.connectResolve = null;
          this.connectReject = null;
        }
        this.rejectAllPending(e);
        this.onClose?.();
      });
    });
  }

  request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to gateway'));
        return;
      }
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (p) => resolve(p as T),
        reject,
        timer,
      });
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }

  setEventCallback(cb: (event: string, payload: unknown) => void): void {
    this.eventCb = cb;
  }

  setCloseCallback(cb: () => void): void {
    this.onClose = cb;
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    this.rejectAllPending(new Error('Client disconnected'));
    this.ws?.terminate();
    this.ws = null;
  }

  private rejectAllPending(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }
}

// ── Module-level state ────────────────────────────────────────────────────────
let client: OpenClawWsClient | null = null;
let gatewayUrl: string | null = null;
let authToken: string | null = null;
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

/**
 * Parse a raw gateway URL that may contain the auth token in the hash or
 * query string (e.g. http://host:port/#token=abc or ?token=abc).
 * Also accepts the base64 setup code that OpenClaw provides
 * (decodes to {url: 'ws://...', bootstrapToken: '...'}).
 * Returns clean baseUrl and the token separately.
 */
function parseGatewayInput(raw: string): { baseUrl: string; token: string | null } {
  const trimmed = raw.trim();

  // Base64 setup code format (no spaces, no ://)  e.g. eyJ1cmwiOi...
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length > 40) {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
      const obj = JSON.parse(decoded) as { url?: string; bootstrapToken?: string };
      if (obj.url && typeof obj.url === 'string') {
        const baseUrl = obj.url.replace(/\/+$/, '');
        return { baseUrl, token: obj.bootstrapToken ?? null };
      }
    } catch { /* not base64 JSON, fall through */ }
  }

  // Already a ws:// or wss:// URL — keep as-is
  if (/^wss?:\/\//.test(trimmed)) {
    const hashIdx = trimmed.indexOf('#token=');
    if (hashIdx !== -1) {
      const tok = trimmed.slice(hashIdx + 7).split(/[&#]/)[0] || null;
      return { baseUrl: trimmed.slice(0, hashIdx).replace(/\/+$/, ''), token: tok };
    }
    return { baseUrl: trimmed.replace(/\/+$/, ''), token: null };
  }

  // Fragment form: http://host:port/#token=abc
  const hashIdx = trimmed.indexOf('#token=');
  if (hashIdx !== -1) {
    const tok = trimmed.slice(hashIdx + 7).split(/[&#]/)[0] || null;
    return { baseUrl: trimmed.slice(0, hashIdx).replace(/\/+$/, ''), token: tok };
  }
  // Query form: http://host:port/?token=abc
  try {
    const parsed = new URL(trimmed);
    const tok = parsed.searchParams.get('token');
    if (tok) {
      parsed.search = '';
      return { baseUrl: parsed.href.replace(/\/+$/, ''), token: tok };
    }
  } catch { /* fall through */ }
  return { baseUrl: trimmed.replace(/\/+$/, ''), token: null };
}

/** Convert http:// → ws://, https:// → wss://.  ws:// and wss:// pass through unchanged. */
function toWsUrl(httpUrl: string): string {
  if (/^wss?:\/\//.test(httpUrl)) return httpUrl;
  return httpUrl.replace(/^http(s?):\/\//, (_, s: string) => `ws${s}://`);
}

// ── Helper: disconnect + clean up the current client ─────────────────────────
function disconnectClient(win?: BrowserWindow | null) {
  stopHealthCheck();
  client?.close();
  client = null;
  gatewayUrl = null;
  authToken = null;
  setStatus('disconnected', win);
}

// ── IPC handler registration ──────────────────────────────────────────────────
export function registerOpenClawHandlers() {

  // autoStart: for remote VPS gateways there is nothing local to start.
  // Just check if we already have a working connection and return the status.
  ipcMain.handle('openclaw:autoStart', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (client?.isOpen()) {
      setStatus('connected', win);
      return true;
    }
    setStatus('disconnected', win);
    return false;
  });

  // connect: establish WebSocket RPC connection to the gateway
  ipcMain.handle('openclaw:connect', async (event, rawUrl: string, rawToken?: string | null) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    setStatus('connecting', win);

    // Tear down any existing connection
    client?.close();
    client = null;
    stopHealthCheck();

    const { baseUrl, token: parsedToken } = parseGatewayInput(rawUrl);
    const token = rawToken?.trim() || parsedToken || null;

    const wsUrl = toWsUrl(baseUrl);
    const c = new OpenClawWsClient(wsUrl, token);

    // Forward events to renderer windows
    c.setEventCallback((event, payload) => {
      const windows = BrowserWindow.getAllWindows();

      // Forward tool/agent events to renderer for display
      if (event !== 'chat' && event !== 'connect.challenge') {
        windows.forEach((w) =>
          w.webContents.send('openclaw:toolEvent', event, payload)
        );
      }

      if (event !== 'chat') return;
      const chatPayload = payload as ChatEventPayload;

      if (chatPayload.state === 'delta') {
        const chunk = extractText(chatPayload.message);
        if (chunk) {
          windows.forEach((w) =>
            w.webContents.send('openclaw:message', 'main', chunk, false)
          );
        }
      } else if (chatPayload.state === 'final') {
        windows.forEach((w) =>
          w.webContents.send('openclaw:message', 'main', '', true)
        );
      } else if (chatPayload.state === 'aborted' || chatPayload.state === 'error') {
        const errMsg = chatPayload.errorMessage ?? 'Chat request failed';
        windows.forEach((w) => {
          w.webContents.send('openclaw:message', 'main', `\n\n*⚠ ${errMsg}*`, false);
          w.webContents.send('openclaw:message', 'main', '', true);
        });
      }
    });

    // Handle unexpected disconnects
    c.setCloseCallback(() => {
      if (currentStatus === 'connected') {
        setStatus('error');
      }
    });

    try {
      await c.connect();
    } catch (err) {
      setStatus('error', win);
      const raw = err instanceof Error ? err.message : String(err);
      let msg: string;
      if (raw.includes('ECONNREFUSED')) {
        msg = `Port unreachable (ECONNREFUSED). The VPS firewall may be blocking port ${new URL(wsUrl).port || 80}. ` +
              `Open that port in your VPS security group / iptables for your local IP, then retry.`;
      } else if (raw.includes('ETIMEDOUT') || raw.includes('timeout')) {
        msg = `Connection timed out. Check VPS firewall rules and that the OpenClaw gateway is running on the VPS.`;
      } else if (raw.includes('ENOTFOUND')) {
        msg = `Hostname not found. Verify the gateway URL is correct.`;
      } else {
        msg = raw;
      }
      throw new Error(msg);
    }

    client = c;
    gatewayUrl = baseUrl;
    authToken = token;
    setStatus('connected', win);
    startHealthCheck(win);
  });

  ipcMain.handle('openclaw:disconnect', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    disconnectClient(win);
  });

  ipcMain.handle('openclaw:getStatus', async () => {
    return {
      status: currentStatus,
      gatewayUrl,
      hasToken: !!authToken,
    };
  });

  // createSession: OpenClaw uses persistent session keys, not ephemeral IDs.
  // The default session key is always 'main'.
  ipcMain.handle('openclaw:createSession', async () => {
    if (!client?.isOpen()) return null;
    return 'main';
  });

  ipcMain.handle(
    'openclaw:sendMessage',
    async (
      event,
      _sessionId: string,
      message: string,
      context?: Record<string, unknown>
    ) => {
      if (!client?.isOpen()) throw new Error('Not connected to OpenClaw gateway');

      const win = BrowserWindow.fromWebContents(event.sender);

      // Enrich message with IDE context (active file, workspace, terminal output, etc.)
      const contextBlock = formatContextBlock(context);
      const enrichedMessage = contextBlock ? contextBlock + '\n\n' + message : message;

      try {
        await client.request('chat.send', {
          sessionKey: 'main',
          message: enrichedMessage,
          deliver: false,
          idempotencyKey: randomUUID(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        win?.webContents.send('openclaw:message', 'main', `\n\n*⚠ ${msg}*`, false);
        win?.webContents.send('openclaw:message', 'main', '', true);
        throw err;
      }
    }
  );
}

function startHealthCheck(win: BrowserWindow | null) {
  stopHealthCheck();
  statusInterval = setInterval(async () => {
    if (!client?.isOpen()) {
      if (currentStatus === 'connected') setStatus('error', win);
      return;
    }
    try {
      await client.request('health', {});
      if (currentStatus !== 'connected') setStatus('connected', win);
    } catch {
      if (currentStatus === 'connected') setStatus('error', win);
    }
  }, 15000);
}

function stopHealthCheck() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}
