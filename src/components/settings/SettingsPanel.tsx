import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useLayoutStore } from '../../store/layoutStore';

/** Strip #token= or ?token= from a gateway URL and return { url, token }. */
function parseUrl(raw: string): { url: string; token: string } {
  const hashIdx = raw.indexOf('#token=');
  if (hashIdx !== -1) {
    return {
      url: raw.slice(0, hashIdx).replace(/\/+$/, ''),
      token: raw.slice(hashIdx + 7).split(/[&#]/)[0] ?? '',
    };
  }
  try {
    const parsed = new URL(raw);
    const t = parsed.searchParams.get('token') ?? '';
    parsed.search = '';
    return { url: parsed.href.replace(/\/+$/, ''), token: t };
  } catch { /* ignore */ }
  return { url: raw.replace(/\/+$/, ''), token: '' };
}

export function SettingsPanel() {
  const { gatewayUrl, setGatewayUrl, status } = useChatStore();
  const { theme, setTheme, editorSettings, setEditorSettings } = useLayoutStore();
  const [url, setUrl] = useState(gatewayUrl);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const isElectron = typeof window !== 'undefined' && !!window.nestcode;

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  /** When user pastes a full URL with #token= embedded, auto-split it. */
  const handleUrlChange = (raw: string) => {
    if (raw.includes('#token=') || raw.includes('?token=')) {
      const { url: cleanUrl, token: extractedToken } = parseUrl(raw);
      setUrl(cleanUrl);
      if (extractedToken) setToken(extractedToken);
    } else {
      setUrl(raw);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    const cleanUrl = url.trim().replace(/\/+$/, '');
    setGatewayUrl(cleanUrl);
    try {
      if (isElectron) {
        await window.nestcode!.openclawConnect(cleanUrl, token.trim() || null);
        showFeedback('ok', 'Connected successfully');
      } else {
        const res = await fetch(`${url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          showFeedback('ok', 'Gateway reachable');
          useChatStore.getState().setStatus('connected');
        } else {
          showFeedback('err', `Gateway returned ${res.status}`);
        }
      }
    } catch {
      showFeedback('err', 'Could not reach gateway');
    }
    setConnecting(false);
  };

  const handleAutoStart = async () => {
    setConnecting(true);
    try {
      if (isElectron) {
        const started = await window.nestcode!.openclawAutoStart();
        showFeedback(started ? 'ok' : 'err', started ? 'OpenClaw started' : 'Auto-detect failed');
      } else {
        showFeedback('err', 'Auto-detect requires the desktop app');
      }
    } catch {
      showFeedback('err', 'Auto-detect failed');
    }
    setConnecting(false);
  };

  return (
    <div className="px-3 py-3 space-y-6 overflow-y-auto">
      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          Appearance
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTheme('dark')}
            className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
              theme === 'dark'
                ? 'border-nest bg-nest/10'
                : 'border-border-subtle bg-surface-3 hover:border-border'
            }`}
          >
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-[#0A0A0F]" />
              <div className="w-3 h-3 rounded-sm bg-[#0F0F17]" />
              <div className="w-3 h-3 rounded-sm bg-[#1A1A27]" />
            </div>
            <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-nest' : 'text-text-muted'}`}>
              Dark
            </span>
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
              theme === 'light'
                ? 'border-nest bg-nest/10'
                : 'border-border-subtle bg-surface-3 hover:border-border'
            }`}
          >
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-[#F2F2F7]" />
              <div className="w-3 h-3 rounded-sm bg-[#EAEAF2]" />
              <div className="w-3 h-3 rounded-sm bg-[#D8D8E8]" />
            </div>
            <span className={`text-[10px] font-medium ${theme === 'light' ? 'text-nest' : 'text-text-muted'}`}>
              Light
            </span>
          </button>
        </div>
      </section>

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          Editor
        </h3>
        <div className="space-y-3">
          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary">Font Size</label>
              <span className="text-xs font-mono text-text-primary">{editorSettings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={22}
              value={editorSettings.fontSize}
              onChange={(e) => setEditorSettings({ fontSize: Number(e.target.value) })}
              className="w-full h-1.5 accent-nest cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
              <span>10</span><span>22</span>
            </div>
          </div>

          {/* Tab Size */}
          <div>
            <label className="text-xs text-text-secondary block mb-1.5">Tab Size</label>
            <div className="flex gap-1.5">
              {[2, 4, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setEditorSettings({ tabSize: n })}
                  className={`flex-1 h-7 text-xs rounded border transition-colors ${
                    editorSettings.tabSize === n
                      ? 'bg-nest/15 border-nest/40 text-nest font-semibold'
                      : 'bg-surface-3 border-border-subtle text-text-secondary hover:border-border'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle rows */}
          <ToggleRow
            label="Word Wrap"
            description="Wrap long lines"
            checked={editorSettings.wordWrap}
            onChange={(v) => setEditorSettings({ wordWrap: v })}
          />
          <ToggleRow
            label="Minimap"
            description="Show code minimap"
            checked={editorSettings.minimap}
            onChange={(v) => setEditorSettings({ minimap: v })}
          />
        </div>
      </section>

      {/* ── OpenClaw Connection ──────────────────────────────────────────── */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          OpenClaw Connection
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-3 rounded-lg border border-border-subtle">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              status === 'connected' ? 'bg-status-success' :
              status === 'connecting' ? 'bg-status-warning animate-pulse' :
              status === 'error' ? 'bg-status-error' : 'bg-text-muted'
            }`} />
            <span className="text-xs text-text-secondary">
              {status === 'connected' ? 'Connected to OpenClaw' :
               status === 'connecting' ? 'Connecting…' :
               status === 'error' ? 'Connection failed' : 'Not connected'}
            </span>
          </div>

          {feedback && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
              feedback.type === 'ok'
                ? 'bg-status-success/10 border-status-success/20 text-status-success'
                : 'bg-status-error/10 border-status-error/20 text-status-error'
            }`}>
              {feedback.type === 'ok' ? '✓' : '✕'} {feedback.msg}
            </div>
          )}

          <div>
            <label className="text-2xs text-text-muted block mb-1.5">Gateway URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              placeholder="http://162.62.226.231:18789"
              className="w-full h-8 px-3 text-xs bg-surface-3 border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none transition-colors"
            />
            <p className="text-[10px] text-text-muted mt-1 px-1">
              Paste full URL with <code className="font-mono">#token=</code> and it will be split automatically.
            </p>
          </div>

          <div>
            <label className="text-2xs text-text-muted block mb-1.5">Auth Token (optional)</label>
            <div className="flex gap-1.5">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="f9ce911266f53…"
                className="flex-1 h-8 px-3 text-xs bg-surface-3 border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="w-8 h-8 flex items-center justify-center bg-surface-3 border border-border-subtle rounded hover:bg-surface-4 text-text-muted hover:text-text-primary transition-colors text-xs"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting || !url.trim()}
              className="flex-1 h-8 text-xs bg-nest/15 text-nest border border-nest/25 rounded hover:bg-nest/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <button
              onClick={handleAutoStart}
              disabled={connecting}
              className="flex-1 h-8 text-xs bg-surface-3 text-text-secondary border border-border-subtle rounded hover:bg-surface-4 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Auto-detect
            </button>
          </div>

          {!isElectron && (
            <p className="text-2xs text-text-muted px-1">
              Running in web mode — auto-detect requires the desktop app.
            </p>
          )}
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          About
        </h3>
        <div className="px-3 py-3 bg-surface-3 rounded-lg border border-border-subtle space-y-1">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-nest" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-xs font-medium text-text-primary">NestCode</span>
          </div>
          <p className="text-2xs text-text-muted">AI-native IDE powered by OpenClaw</p>
          <p className="text-2xs text-text-muted">v1.0.0</p>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 bg-surface-3 rounded-lg border border-border-subtle cursor-pointer hover:border-border transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className="text-xs text-text-primary">{label}</p>
        <p className="text-[10px] text-text-muted">{description}</p>
      </div>
      {/* Toggle pill */}
      <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${checked ? 'bg-nest' : 'bg-surface-5'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}
