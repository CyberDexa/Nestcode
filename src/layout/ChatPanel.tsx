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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // Build context
    const activeTab = useEditorStore.getState().tabs.find(
      (t) => t.id === useEditorStore.getState().activeTabId
    );

    const context = {
      activeFile: activeTab?.filePath,
      activeFileContent: activeTab?.content?.slice(0, 5000),
      workspace: useFileStore.getState().rootPath,
    };

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
        <button
          onClick={() => useChatStore.getState().clearMessages()}
          className="text-text-muted hover:text-text-secondary transition-colors"
          title="Clear chat"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
          </svg>
        </button>
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
            placeholder={isStreaming ? 'Waiting for response...' : 'Ask OpenClaw...'}
            disabled={isStreaming}
            rows={1}
            className="w-full px-3 py-2.5 pr-10 text-xs bg-surface-3 border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:border-nest/40 focus:outline-none resize-none transition-colors disabled:opacity-50"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center rounded-md bg-nest text-surface-0 hover:bg-nest-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22l-4-9-9-4z" />
            </svg>
          </button>
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
        <div className="prose prose-invert prose-xs max-w-none [&_pre]:bg-surface-0 [&_pre]:border [&_pre]:border-border-subtle [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-nest-300 [&_code]:text-[11px] [&_code]:font-mono">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || (message.isStreaming ? '...' : '')}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
