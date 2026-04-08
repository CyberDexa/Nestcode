import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';

export function SettingsPanel() {
  const { gatewayUrl, setGatewayUrl, status } = useChatStore();
  const [url, setUrl] = useState(gatewayUrl);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setGatewayUrl(url);
    
    if (window.nestcode) {
      try {
        await window.nestcode.openclawConnect(url);
      } catch {
        // Error status will be set via IPC
      }
    }
    setConnecting(false);
  };

  const handleAutoStart = async () => {
    setConnecting(true);
    if (window.nestcode) {
      await window.nestcode.openclawAutoStart();
    }
    setConnecting(false);
  };

  return (
    <div className="px-3 py-3 space-y-6">
      {/* OpenClaw Connection */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          OpenClaw Connection
        </h3>
        
        <div className="space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-3 rounded-lg border border-border-subtle">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                status === 'connected'
                  ? 'bg-status-success'
                  : status === 'connecting'
                  ? 'bg-status-warning animate-pulse'
                  : status === 'error'
                  ? 'bg-status-error'
                  : 'bg-text-muted'
              }`}
            />
            <span className="text-xs text-text-secondary">
              {status === 'connected'
                ? 'Connected to OpenClaw'
                : status === 'connecting'
                ? 'Connecting...'
                : status === 'error'
                ? 'Connection failed'
                : 'Not connected'}
            </span>
          </div>

          {/* Gateway URL */}
          <div>
            <label className="text-2xs text-text-muted block mb-1.5">
              Gateway URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3100"
              className="w-full h-8 px-3 text-xs bg-surface-3 border border-border-subtle rounded text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none transition-colors"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting || !url.trim()}
              className="flex-1 h-8 text-xs bg-nest/15 text-nest border border-nest/25 rounded hover:bg-nest/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Connect
            </button>
            <button
              onClick={handleAutoStart}
              disabled={connecting}
              className="flex-1 h-8 text-xs bg-surface-4 text-text-secondary border border-border-subtle rounded hover:bg-surface-5 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Auto-detect
            </button>
          </div>
        </div>
      </section>

      {/* Editor Settings */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          Editor
        </h3>
        <div className="space-y-2">
          <SettingRow label="Font Size" value="13px" />
          <SettingRow label="Tab Size" value="2" />
          <SettingRow label="Word Wrap" value="Off" />
          <SettingRow label="Minimap" value="On" />
        </div>
      </section>

      {/* About */}
      <section>
        <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
          About
        </h3>
        <div className="px-3 py-3 bg-surface-3 rounded-lg border border-border-subtle space-y-1">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-nest" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-xs font-medium text-text-primary">NestCode</span>
          </div>
          <p className="text-2xs text-text-muted">
            AI-native IDE powered by OpenClaw
          </p>
          <p className="text-2xs text-text-muted">v1.0.0</p>
        </div>
      </section>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 hover:bg-surface-3 rounded transition-colors">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xs text-text-muted">{value}</span>
    </div>
  );
}
