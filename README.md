# NestCode

A lightweight Electron-based IDE with an integrated AI chat panel powered by [OpenClaw](https://openclaw.ai).

---

## Features

- Monaco-based code editor with syntax highlighting
- File explorer with open/save support
- Integrated terminal (xterm.js)
- Git status panel
- AI chat panel connected to an OpenClaw gateway (local or remote)

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/)
- An [OpenClaw](https://openclaw.ai) gateway running locally or on a VPS

---

## Local Development

```bash
git clone https://github.com/CyberDexa/Nestcode.git
cd Nestcode
npm install
npm run dev
```

This starts the Vite dev server and Electron together.

---

## Connecting to OpenClaw

NestCode connects to an OpenClaw gateway over WebSocket. Open **Settings** in the app and paste your gateway URL in the **Gateway URL** field.

### Option A — Local Gateway (no VPS)

1. Install OpenClaw: `npm install -g openclaw`
2. Start the gateway: `openclaw gateway run`
3. In NestCode Settings, paste: `ws://127.0.0.1:18789`
4. Click **Connect**

### Option B — Remote VPS Gateway (direct connection)

> Make sure your VPS has OpenClaw bound to `0.0.0.0` (see VPS setup below).

1. In NestCode Settings, paste your tokenized gateway URL:
   ```
   http://<YOUR_VPS_IP>:18789/#token=<YOUR_GATEWAY_TOKEN>
   ```
2. Click **Connect**

### Option C — Remote VPS Gateway via SSH Tunnel

If your gateway is bound to `127.0.0.1` on the VPS:

1. Open an SSH tunnel in a terminal:
   ```bash
   ssh -N -L 18789:127.0.0.1:18789 ubuntu@<YOUR_VPS_IP>
   ```
2. In NestCode Settings, paste:
   ```
   http://127.0.0.1:18789/#token=<YOUR_GATEWAY_TOKEN>
   ```
3. Click **Connect**

---

## VPS Setup (OpenClaw on a remote server)

### 1. Install OpenClaw on the VPS

```bash
ssh ubuntu@<YOUR_VPS_IP>
npm install -g openclaw
```

### 2. Configure the Gateway

Edit `~/.openclaw/openclaw.json` and set the `gateway` section:

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "0.0.0.0",
    "auth": {
      "mode": "token",
      "token": "<YOUR_SECURE_TOKEN>"
    },
    "controlUi": {
      "allowInsecureAuth": true,
      "allowedOrigins": [
        "http://<YOUR_VPS_IP>:18789",
        "http://localhost:18789",
        "http://127.0.0.1:18789"
      ]
    }
  }
}
```

> Set `"bind": "0.0.0.0"` to listen on all interfaces (required for direct public access).
> Set `"bind": "127.0.0.1"` if you only want SSH tunnel access (more secure).

### 3. Start the Gateway

```bash
nohup openclaw gateway run > /tmp/openclaw-gw.log 2>&1 &
```

To run it persistently with systemd, create `/etc/systemd/system/openclaw.service`:

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
User=ubuntu
ExecStart=/usr/local/bin/openclaw gateway run
Restart=always
RestartSec=5
StandardOutput=append:/var/log/openclaw.log
StandardError=append:/var/log/openclaw.log

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw
```

### 4. Open the Firewall Port (if using direct access)

```bash
sudo ufw allow 18789/tcp
sudo ufw enable
```

If on a cloud provider (AWS, GCP, DigitalOcean, Hetzner, etc.), also open TCP port `18789` in the provider's security group / firewall rules.

---

## Building for Production

```bash
npm run build
```

This produces:
- `dist/` — the compiled renderer (Vite)
- `dist-electron/` — the compiled Electron main process

---

## Project Structure

```
nestcode/
├── electron/                  # Electron main process
│   ├── main.ts                # Entry point
│   ├── preload.ts             # Context bridge (renderer ↔ main)
│   └── ipc/
│       ├── openclaw.ts        # OpenClaw WebSocket RPC client
│       ├── filesystem.ts      # File system IPC handlers
│       ├── terminal.ts        # Terminal IPC handlers
│       └── git.ts             # Git IPC handlers
├── src/                       # React renderer
│   ├── App.tsx
│   ├── layout/
│   │   ├── ChatPanel.tsx      # AI chat UI
│   │   └── BottomPane.tsx
│   ├── components/
│   │   ├── editor/            # Monaco editor
│   │   ├── explorer/          # File explorer
│   │   └── settings/          # Settings panel
│   └── store/                 # Zustand state
├── package.json
└── vite.config.ts
```

---

## License

MIT
