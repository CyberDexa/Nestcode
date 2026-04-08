import { useEffect, useRef, useState } from 'react';

export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    async function init() {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');

      // Import xterm CSS
      // @ts-ignore - CSS import handled by bundler
      await import('@xterm/xterm/css/xterm.css');

      if (disposed || !containerRef.current) return;

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      const term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'bar',
        allowTransparency: true,
        theme: {
          background: '#0F0F17',
          foreground: '#EEEEF0',
          cursor: '#00D4AA',
          cursorAccent: '#0F0F17',
          selectionBackground: '#00D4AA30',
          black: '#0A0A0F',
          red: '#FF4466',
          green: '#00D4AA',
          yellow: '#FFB020',
          blue: '#4499FF',
          magenta: '#8866FF',
          cyan: '#00D4AA',
          white: '#EEEEF0',
          brightBlack: '#555570',
          brightRed: '#FF6688',
          brightGreen: '#33FFD4',
          brightYellow: '#FFD060',
          brightBlue: '#66BBFF',
          brightMagenta: '#AA88FF',
          brightCyan: '#33FFD4',
          brightWhite: '#FFFFFF',
        },
      });

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Connect to node-pty via IPC
      if (window.nestcode) {
        try {
          const id = await window.nestcode.terminalCreate();
          setTerminalId(id);

          // Terminal input → pty
          term.onData((data) => {
            window.nestcode.terminalWrite(id, data);
          });

          // pty output → terminal
          const unsub = window.nestcode.onTerminalData((dataId: string, data: string) => {
            if (dataId === id) {
              term.write(data);
            }
          });

          // Resize
          term.onResize(({ cols, rows }) => {
            window.nestcode.terminalResize(id, cols, rows);
          });

          // Handle cleanup
          return () => {
            unsub();
            window.nestcode.terminalDestroy(id);
          };
        } catch (err) {
          term.writeln('\x1b[33mTerminal not available in web mode\x1b[0m');
          term.writeln('Run NestCode as Electron app for full terminal support.');
        }
      } else {
        // Web mode: show message
        term.writeln('\x1b[36m┌──────────────────────────────────────┐\x1b[0m');
        term.writeln('\x1b[36m│\x1b[0m  🖥️  \x1b[1mNestCode Terminal\x1b[0m                \x1b[36m│\x1b[0m');
        term.writeln('\x1b[36m│\x1b[0m                                      \x1b[36m│\x1b[0m');
        term.writeln('\x1b[36m│\x1b[0m  Terminal requires Electron shell     \x1b[36m│\x1b[0m');
        term.writeln('\x1b[36m│\x1b[0m  or VPS SSH connection.               \x1b[36m│\x1b[0m');
        term.writeln('\x1b[36m└──────────────────────────────────────┘\x1b[0m');
      }
    }

    init();

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      disposed = true;
      observer.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: '#0F0F17' }}
    />
  );
}
