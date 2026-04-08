import { create } from 'zustand';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
};

type OpenClawStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type ChatStore = {
  messages: ChatMessage[];
  sessionId: string | null;
  isStreaming: boolean;
  status: OpenClawStatus;
  gatewayUrl: string;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  appendToMessage: (id: string, chunk: string) => void;
  finishStreaming: (id: string) => void;
  setSessionId: (id: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStatus: (status: OpenClawStatus) => void;
  setGatewayUrl: (url: string) => void;
  clearMessages: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
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
  setGatewayUrl: (url) => set({ gatewayUrl: url }),
  clearMessages: () => set({ messages: [] }),
}));
