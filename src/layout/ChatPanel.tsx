import { useState, useRef, useEffect } from 'react';
import { useChatStore, type ChatMessage, type ChatSession } from '../store/chatStore';
import { useEditorStore } from '../store/editorStore';
import { useFileStore } from '../store/fileStore';
import { useLayoutStore } from '../store/layoutStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatPanel() {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const status = useChatStore((s) => s.status);

  const activeSession: ChatSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const messages = activeSession?.messages ?? [];
  const sessionId = activeSession?.sessionId ?? null;

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionInitRef = useRef(false);

  // Reset sessionInitRef when active session changes
  useEffect(() => {
    sessionInitRef.current = activeSession.messages.length > 0;
  }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const userText = input.trim();
    const { addMessage, appendToMessage, finishStreaming, setIsStreaming, setSessionId } =
      useChatStore.getState();

    addMessage({ role: 'user', content: userText });
    setInput('');
    setIsStreaming(true);

    // Use or create a session key
    let sid = useChatStore.getState().sessions.find(
      (s) => s.id === useChatStore.getState().activeSessionId
    )?.sessionId ?? null;

    if (!sid && window.nestcode) {
      const rootPath = useFileStore.getState().rootPath;
      try {
        sid = await window.nestcode.openclawCreateSession(rootPath || '');
      } catch {
        sid = null;
      }
      if (sid) setSessionId(sid);
    }

    const assistantId = addMessage({ role: 'assistant', content: '', isStreaming: true });

    const editorState = useEditorStore.getState();
    const activeTab = editorState.tabs.find((t) => t.id === editorState.activeTabId);

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
      // Accept messages matching our session key, OR messages with no session key
      // (some gateway versions don't echo sessionKey back in the event payload).
      const unsub = window.nestcode.onOpenClawMessage((msgSessionId: string, chunk: string, done: boolean) => {
        if (msgSessionId && msgSessionId !== sid) return;
        if (done) {
          finishStreaming(assistantId);
          unsub();
        } else {
          appendToMessage(assistantId, chunk);
        }
      });

      try {
        await window.nestcode.openclawSendMessage(sid, userText, context);
      } catch (err) {
        finishStreaming(assistantId);
        appendToMessage(assistantId, `\n\n*⚠ Gateway error: ${err instanceof Error ? err.message : String(err)}*`);
      }
    } else if (!window.nestcode) {
      // Browser preview / demo
      const demo = `I'm NestCode's AI assistant powered by OpenClaw. Connect to a gateway to get started.`;
      let i = 0;
      const iv = setInterval(() => {
        if (i < demo.length) {
          appendToMessage(assistantId, demo.slice(i, i + 3));
          i += 3;
        } else {
          finishStreaming(assistantId);
          clearInterval(iv);
        }
      }, 20);
    } else {
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

  const handleNewChat = async () => {
    const { createSession } = useChatStore.getState();
    createSession();
    sessionInitRef.current = false;
    if (window.nestcode?.openclawResetSession) {
      try {
        const newSid = await window.nestcode.openclawResetSession();
        useChatStore.getState().setSessionId(newSid);
      } catch { /* ignore */ }
    }
  };

  const handleTerminal = () => {
    const ls = useLayoutStore.getState();
    // Always ensure terminal tab is selected; toggle panel if already on terminal
    ls.setBottomPanel('terminal');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
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
        <div className="flex items-center gap-0.5">
          {/* Terminal toggle */}
          <button
            onClick={handleTerminal}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            title="Open terminal"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          {/* New chat */}
          <button
            onClick={handleNewChat}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            title="New chat"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {/* New window */}
          <button
            onClick={() => window.nestcode?.newWindow?.()}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            title="New window"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M3 9h6" />
            </svg>
          </button>
          {/* Clear current chat */}
          <button
            onClick={() => useChatStore.getState().clearMessages()}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-secondary hover:bg-surface-3 transition-colors"
            title="Clear chat"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Session tabs — shown when there are multiple sessions */}
      {sessions.length > 1 && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border-subtle bg-surface-1 overflow-x-auto flex-shrink-0">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`group flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors ${
                sess.id === activeSessionId
                  ? 'bg-nest/15 text-nest border border-nest/20'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-3'
              }`}
              onClick={() => useChatStore.getState().switchSession(sess.id)}
            >
              <span>{sess.label}</span>
              {sess.messages.length > 0 && (
                <span className={`text-[9px] ${sess.id === activeSessionId ? 'text-nest/60' : 'text-text-muted'}`}>
                  {sess.messages.filter((m) => m.role === 'user').length}
                </span>
              )}
              {sessions.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useChatStore.getState().deleteSession(sess.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-3 h-3 flex items-center justify-center rounded-full hover:bg-red-500/20 hover:text-red-400 transition-all"
                  title="Close"
                >
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
            <p className="text-[10px] text-text-muted">Code, debug, explain, generate</p>
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
            placeholder={isStreaming ? 'Waiting for response...' : 'Ask OpenClaw... (Enter to send)'}
            disabled={isStreaming}
            rows={1}
            className="w-full px-3 py-2.5 pr-20 text-xs bg-surface-3 border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none resize-none transition-colors disabled:opacity-50 select-text"
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
            <span className="text-[10px] font-medium text-nest">OpenClaw</span>
            {message.isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-nest animate-typing" />
            )}
          </div>
        )}
        {/* select-text allows text selection despite body user-select: none */}
        <div className="prose prose-invert prose-xs max-w-none select-text cursor-text [&_code]:text-nest-300 [&_code]:text-[11px] [&_code]:font-mono">
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
      : rootPath ? `${rootPath}/${detectedPath}` : detectedPath
    : activeTab?.filePath || null;

  const targetName = detectedPath ? detectedPath.split('/').pop() : activeTab?.fileName;
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
      if (dir) { try { await window.nestcode.createDir(dir); } catch { /* exists */ } }
      await window.nestcode.writeFile(targetFile, contentToWrite);
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
        <span className="text-[10px] text-text-muted font-mono">
          {lang || 'code'}{targetName ? ` · ${targetName}` : ''}
        </span>
        <div className="flex gap-1">
          <button onClick={handleCopy} className="px-2 py-0.5 text-[10px] bg-surface-2 text-text-secondary rounded hover:bg-surface-3 transition-colors">
            {copied ? '✓' : 'Copy'}
          </button>
          {targetFile && (
            <button onClick={handleApply} className="px-2 py-0.5 text-[10px] bg-nest/20 text-nest rounded hover:bg-nest/30 transition-colors">
              {applied ? '✓ Applied' : 'Apply'}
            </button>
          )}
          {isShell && (
            <button onClick={handleRun} disabled={running} className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50">
              {running ? '...' : '▶ Run'}
            </button>
          )}
        </div>
      </div>
      <pre className="p-3 bg-surface-0 overflow-x-auto m-0">
        <code className={`text-[11px] font-mono text-nest-300 select-text ${lang ? `language-${lang}` : ''}`}>
          {code}
        </code>
      </pre>
      {runOutput !== null && (
        <div className="border-t border-border-subtle">
          <pre className="p-2 bg-surface-0/50 text-[10px] text-text-muted font-mono max-h-40 overflow-auto m-0 whitespace-pre-wrap select-text">
            {runOutput || '(no output)'}
          </pre>
        </div>
      )}
    </div>
  );
}

