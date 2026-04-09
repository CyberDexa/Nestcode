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

type OpenClawStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type ChatStore = {
  messages: ChatMessage[];
  toolEvents: ToolEvent[];
  sessionId: string | null;
  isStreaming: boolean;
  status: OpenClawStatus;
  gatewayUrl: string;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  appendToMessage: (id: string, chunk: string) => void;
  finishStreaming: (id: string) => void;
  addToolEvent: (event: string, payload: unknown) => void;
  setSessionId: (id: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStatus: (status: OpenClawStatus) => void;
  setGatewayUrl: (url: string) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  toolEvents: [],
  sessionId: null,
  isStreaming: false,
  status: 'disconnected',
  gatewayUrl: 'http://localhost:3100',

  addMessage: (msg) => {
    const id = crypto.randomUUID();
    const message: ChatMessage = {
      ...msg,
      id,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, message] }));
    return id;
  },

  appendToMessage: (id, chunk) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m
      ),
    }));
  },

  finishStreaming: (id) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
      isStreaming: false,
    }));
  },

  setSessionId: (id) => set({ sessionId: id }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStatus: (status) => set({ status }),
  addToolEvent: (event, payload) => {
    const te: ToolEvent = {
      id: crypto.randomUUID(),
      event,
      payload,
      timestamp: Date.now(),
    };
    set((s) => ({ toolEvents: [...s.toolEvents.slice(-50), te] }));
  },

  setGatewayUrl: (url) => set({ gatewayUrl: url }),
  clearMessages: () => set({ messages: [], toolEvents: [] }),
}));
