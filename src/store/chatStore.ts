import { create } from 'zustand';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
};

export type ToolEvent = {
  id: string;
  event: string;
  payload: unknown;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  label: string;
  messages: ChatMessage[];
  sessionId: string | null;
  createdAt: number;
};

type OpenClawStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function makeSession(label: string): ChatSession {
  return { id: crypto.randomUUID(), label, messages: [], sessionId: null, createdAt: Date.now() };
}

type ChatStore = {
  // Multi-session state
  sessions: ChatSession[];
  activeSessionId: string;
  // Global state (not per-session)
  toolEvents: ToolEvent[];
  isStreaming: boolean;
  status: OpenClawStatus;
  gatewayUrl: string;

  // Session management
  createSession: () => string;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
  renameSession: (id: string, label: string) => void;

  // Message operations (on active session)
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  appendToMessage: (id: string, chunk: string) => void;
  finishStreaming: (id: string) => void;
  clearMessages: () => void;
  setSessionId: (id: string | null) => void;

  // Global ops (unchanged API — used by App.tsx, StatusBar, SettingsPanel)
  addToolEvent: (event: string, payload: unknown) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStatus: (status: OpenClawStatus) => void;
  setGatewayUrl: (url: string) => void;
};

const _initial = makeSession('Chat 1');

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [_initial],
  activeSessionId: _initial.id,
  toolEvents: [],
  isStreaming: false,
  status: 'disconnected',
  gatewayUrl: 'http://localhost:3100',

  // ── Session management ──────────────────────────────────────────────────────
  createSession: () => {
    const label = `Chat ${get().sessions.length + 1}`;
    const s = makeSession(label);
    set((st) => ({ sessions: [...st.sessions, s], activeSessionId: s.id }));
    return s.id;
  },

  deleteSession: (id) => {
    set((st) => {
      const remaining = st.sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = makeSession('Chat 1');
        return { sessions: [fresh], activeSessionId: fresh.id };
      }
      const newActive =
        st.activeSessionId === id ? remaining[remaining.length - 1].id : st.activeSessionId;
      return { sessions: remaining, activeSessionId: newActive };
    });
  },

  switchSession: (id) => set({ activeSessionId: id }),

  renameSession: (id, label) => {
    set((st) => ({
      sessions: st.sessions.map((s) => (s.id === id ? { ...s, label } : s)),
    }));
  },

  // ── Message operations ──────────────────────────────────────────────────────
  addMessage: (msg) => {
    const id = crypto.randomUUID();
    const message: ChatMessage = { ...msg, id, timestamp: Date.now() };
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === st.activeSessionId ? { ...s, messages: [...s.messages, message] } : s
      ),
      isStreaming: msg.isStreaming ? true : st.isStreaming,
    }));
    return id;
  },

  appendToMessage: (id, chunk) => {
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === st.activeSessionId
          ? { ...s, messages: s.messages.map((m) => m.id === id ? { ...m, content: m.content + chunk } : m) }
          : s
      ),
    }));
  },

  finishStreaming: (id) => {
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === st.activeSessionId
          ? { ...s, messages: s.messages.map((m) => m.id === id ? { ...m, isStreaming: false } : m) }
          : s
      ),
      isStreaming: false,
    }));
  },

  clearMessages: () => {
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === st.activeSessionId ? { ...s, messages: [], sessionId: null } : s
      ),
    }));
  },

  setSessionId: (id) => {
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === st.activeSessionId ? { ...s, sessionId: id } : s
      ),
    }));
  },

  // ── Global ops ──────────────────────────────────────────────────────────────
  addToolEvent: (event, payload) => {
    const te: ToolEvent = { id: crypto.randomUUID(), event, payload, timestamp: Date.now() };
    set((st) => ({ toolEvents: [...st.toolEvents.slice(-50), te] }));
  },
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStatus: (status) => set({ status }),
  setGatewayUrl: (url) => set({ gatewayUrl: url }),
}));
