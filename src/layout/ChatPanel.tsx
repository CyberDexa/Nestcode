import { useState, useRef, useEffect } from 'react';
import { useChatStore, type ChatMessage } from '../store/chatStore';
import { useEditorStore } from '../store/editorStore';
import { useFileStore } from '../store/fileStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatPanel() {
  const { messages, isStreaming, status, sessionId } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionInitRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for OpenClaw tool events (bash, file edits, etc.)
  useEffect(() => {
    if (!window.nestcode?.onOpenClawToolEvent) return;
    const unsub = window.nestcode.onOpenClawToolEvent((event: string, payload: unknown) => {
      useChatStore.getState().addToolEvent(event, payload);
    });
    return unsub;
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const { addMessage, appendToMessage, finishStreaming, setIsStreaming, setSessionId } =
      useChatStore.getState();

    // Add user message
    addMessage({ role: 'user', content: input.trim() });
    setInput('');
    setIsStreaming(true);

    // Create session if needed
    let sid = sessionId;
    if (!sid && window.nestcode) {
      const rootPath = useFileStore.getState().rootPath;
      try {
        sid = await window.nestcode.openclawCreateSession(rootPath || '');
      } catch {
        sid = null;
      }
      if (sid) {
        setSessionId(sid);
      } else {
        // No session — fall through to demo mode below
        sid = null;
      }
    }

    // Add assistant placeholder
    const assistantId = addMessage({ role: 'assistant', content: '', isStreaming: true });

    // Build rich IDE context for agentic coding
    const editorState = useEditorStore.getState();
    const activeTab = editorState.tabs.find(
      (t) => t.id === editorState.activeTabId
    );

    let terminalOutput: string | undefined;
    if (window.nestcode?.getTerminalBuffer) {
      try {
        const buf = await window.nestcode.getTerminalBuffer();
        if (buf?.trim()) terminalOutput = buf;
      } catch { /* ignore */ }
    }

    const context: Record<string, unknown> = {
      activeFile: activeTab?.filePath,
      activeFileContent: activeTab?.content,
      activeFileLanguage: activeTab?.language,
      openFiles: editorState.tabs.map((t) => t.filePath),
      workspace: useFileStore.getState().rootPath,
      terminalOutput,
      _sessionInitialized: sessionInitRef.current,
    };
    sessionInitRef.current = true;

    if (window.nestcode && sid) {
      // Set up listener for streaming response
      const unsub = window.nestcode.onOpenClawMessage((msgSessionId: string, chunk: string, done: boolean) => {
        if (msgSessionId !== sid) return;
        if (done) {
          finishStreaming(assistantId);
          unsub();
        } else {
          appendToMessage(assistantId, chunk);
        }
      });

      try {
        await window.nestcode.openclawSendMessage(sid, input.trim(), context);
      } catch (err) {
        finishStreaming(assistantId);
        const msg = err instanceof Error ? err.message : 'Unknown error';
        appendToMessage(assistantId, `\n\n*⚠ Gateway error: ${msg}*`);
      }
    } else if (!window.nestcode) {
      // Only show demo response when running in a browser (no Electron IPC)
      const demoResponse = `I'm NestCode's AI assistant powered by OpenClaw. I can help you with:\n\n- Writing and editing code\n- Explaining code snippets\n- Debugging issues\n- Generating tests\n\nConnect to an OpenClaw gateway to get started with full AI capabilities.`;
      
      let i = 0;
      const interval = setInterval(() => {
        if (i < demoResponse.length) {
          const chunkSize = Math.floor(Math.random() * 4) + 1;
          appendToMessage(assistantId, demoResponse.slice(i, i + chunkSize));
          i += chunkSize;
        } else {
          finishStreaming(assistantId);
          clearInterval(interval);
        }
      }, 20);
    } else {
      // Electron is available but session/connection not ready
      finishStreaming(assistantId);
      appendToMessage(assistantId, '*⚠ Not connected to OpenClaw. Go to Settings and connect to your gateway.*');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-4 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-status-success animate-pulse-glow'
                  : status === 'connecting'
                  ? 'bg-status-warning animate-pulse'
                  : status === 'error'
                  ? 'bg-status-error'
                  : 'bg-text-muted'
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              OpenClaw
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* New Chat */}
          <button
            onClick={async () => {
              useChatStore.getState().clearMessages();
              useChatStore.getState().setSessionId(null);
              sessionInitRef.current = false;
              if (window.nestcode?.openclawResetSession) {
                try {
                  const newSid = await window.nestcode.openclawResetSession();
                  useChatStore.getState().setSessionId(newSid);
                } catch { /* ignore */ }
              }
            }}
            className="text-text-muted hover:text-text-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
            title="New chat"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {/* New Window */}
          <button
            onClick={() => window.nestcode?.newWindow?.()}
            className="text-text-muted hover:text-text-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
            title="New window"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M3 9h6" />
            </svg>
          </button>
          {/* Clear chat */}
          <button
            onClick={() => useChatStore.getState().clearMessages()}
            className="text-text-muted hover:text-text-secondary transition-colors p-0.5 rounded hover:bg-surface-3"
            title="Clear chat"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-nest/10 border border-nest/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-nest" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <p className="text-xs text-text-secondary mb-1">Ask OpenClaw anything</p>
            <p className="text-2xs text-text-muted">Code, debug, explain, generate</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border-subtle">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response...' : 'Ask OpenClaw... (type @file to attach)'}
            disabled={isStreaming}
            rows={1}
            className="w-full px-3 py-2.5 pr-20 text-xs bg-surface-3 border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none resize-none transition-colors disabled:opacity-50"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {/* Insert active file reference */}
            <button
              onClick={() => {
                const tab = useEditorStore.getState().tabs.find(
                  (t) => t.id === useEditorStore.getState().activeTabId
                );
                if (tab) {
                  const ref = `@${tab.fileName}`;
                  setInput((prev) => prev + (prev.endsWith(' ') || !prev ? ref : ' ' + ref));
                  inputRef.current?.focus();
                }
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-all"
              title="Attach current file"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-nest text-surface-0 hover:bg-nest-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22l-4-9-9-4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`animate-slide-up ${isUser ? 'flex justify-end' : ''}`}>
      <div
        className={`max-w-[95%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
          isUser
            ? 'bg-nest/15 text-text-primary border border-nest/20'
            : isSystem
            ? 'bg-status-warning/10 text-status-warning border border-status-warning/20'
            : 'bg-surface-3 text-text-primary border border-border-subtle'
        }`}
      >
        {!isUser && !isSystem && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-4 h-4 rounded bg-nest/20 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-nest" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
              </svg>
            </div>
            <span className="text-2xs font-medium text-nest">OpenClaw</span>
            {message.isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-nest animate-typing" />
            )}
          </div>
        )}
        <div className="prose prose-invert prose-xs max-w-none [&_code]:text-nest-300 [&_code]:text-[11px] [&_code]:font-mono">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre({ children }) {
                return <>{children}</>;
              },
              code({ className, children, ...props }: any) {
                const text = String(children).replace(/\n$/, '');
                const langMatch = /language-(\w+)/.exec(className || '');
                if (langMatch || text.includes('\n')) {
                  return <CodeBlockWithActions code={text} lang={langMatch?.[1] || ''} />;
                }
                return (
                  <code className="bg-surface-0/50 px-1 py-0.5 rounded" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content || (message.isStreaming ? '...' : '')}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// ── Code block with Apply / Copy / Run action buttons ─────────────────────────
function CodeBlockWithActions({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);

  // Detect file path from first-line comment like "// file: src/main.ts"
  const lines = code.split('\n');
  const firstLine = lines[0]?.trim() || '';
  const pathMatch = firstLine.match(
    /^(?:\/\/|#|--|\/\*)\s*(?:file|path|filename):\s*(.+?)(?:\s*\*\/)?$/i
  );
  const detectedPath = pathMatch?.[1]?.trim() || null;

  const rootPath = useFileStore.getState().rootPath;
  const editorState = useEditorStore.getState();
  const activeTab = editorState.tabs.find((t) => t.id === editorState.activeTabId);

  const targetFile = detectedPath
    ? detectedPath.startsWith('/')
      ? detectedPath
      : rootPath
        ? `${rootPath}/${detectedPath}`
        : detectedPath
    : activeTab?.filePath || null;

  const targetName = detectedPath
    ? detectedPath.split('/').pop()
    : activeTab?.fileName;

  const isShell = ['bash', 'sh', 'shell', 'zsh', 'terminal', 'console', 'cmd'].includes(lang);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleApply = async () => {
    if (!targetFile || !window.nestcode) return;
    try {
      const contentToWrite = detectedPath ? lines.slice(1).join('\n') : code;
      const dir = targetFile.substring(0, targetFile.lastIndexOf('/'));
      if (dir) {
        try { await window.nestcode.createDir(dir); } catch { /* exists */ }
      }
      await window.nestcode.writeFile(targetFile, contentToWrite);
      // Refresh editor tab if open
      const es = useEditorStore.getState();
      const tab = es.tabs.find((t) => t.filePath === targetFile);
      if (tab) {
        es.updateContent(tab.id, contentToWrite);
        es.markSaved(tab.id);
      } else {
        es.openFile(targetFile, contentToWrite);
      }
      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    } catch { /* noop */ }
  };

  const handleRun = async () => {
    if (!window.nestcode?.terminalExec) return;
    setRunning(true);
    setRunOutput(null);
    try {
      const cwd = useFileStore.getState().rootPath || undefined;
      const output = await window.nestcode.terminalExec(code, cwd);
      setRunOutput(output.slice(0, 5000));
    } catch (err) {
      setRunOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-2 rounded-lg border border-border-subtle overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-0 border-b border-border-subtle">
        <span className="text-2xs text-text-muted font-mono">
          {lang || 'code'}{targetName ? ` · ${targetName}` : ''}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="px-2 py-0.5 text-2xs bg-surface-2 text-text-secondary rounded hover:bg-surface-3 transition-colors"
          >
            {copied ? '✓' : 'Copy'}
          </button>
          {targetFile && (
            <button
              onClick={handleApply}
              className="px-2 py-0.5 text-2xs bg-nest/20 text-nest rounded hover:bg-nest/30 transition-colors"
            >
              {applied ? '✓ Applied' : 'Apply'}
            </button>
          )}
          {isShell && (
            <button
              onClick={handleRun}
              disabled={running}
              className="px-2 py-0.5 text-2xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
            >
              {running ? '...' : '▶ Run'}
            </button>
          )}
        </div>
      </div>
      <pre className="p-3 bg-surface-0 overflow-x-auto m-0">
        <code className={`text-[11px] font-mono text-nest-300 ${lang ? `language-${lang}` : ''}`}>
          {code}
        </code>
      </pre>
      {runOutput !== null && (
        <div className="border-t border-border-subtle">
          <pre className="p-2 bg-surface-0/50 text-[10px] text-text-muted font-mono max-h-40 overflow-auto m-0 whitespace-pre-wrap">
            {runOutput || '(no output)'}
          </pre>
        </div>
      )}
    </div>
  );
}
