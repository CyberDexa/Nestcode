import { create } from 'zustand';

export type OpenTab = {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  language: string;
  isDirty: boolean;
  originalContent: string;
};

type EditorStore = {
  tabs: OpenTab[];
  activeTabId: string | null;
  splitDirection: 'none' | 'horizontal' | 'vertical';

  openFile: (filePath: string, content: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateContent: (tabId: string, content: string) => void;
  markSaved: (tabId: string) => void;
  setSplitDirection: (dir: 'none' | 'horizontal' | 'vertical') => void;
};

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    vue: 'vue',
    svelte: 'svelte',
    xml: 'xml',
    svg: 'xml',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    java: 'java',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    dart: 'dart',
  };
  return map[ext] || 'plaintext';
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  splitDirection: 'none',

  openFile: (filePath, content) => {
    const existing = get().tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    const id = crypto.randomUUID();
    const fileName = filePath.split('/').pop() || filePath;
    const tab: OpenTab = {
      id,
      filePath,
      fileName,
      content,
      language: detectLanguage(filePath),
      isDirty: false,
      originalContent: content,
    };

    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: id,
    }));
  },

  closeTab: (tabId) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      const newTabs = s.tabs.filter((t) => t.id !== tabId);
      let newActive = s.activeTabId;
      if (s.activeTabId === tabId) {
        newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
      }
      return { tabs: newTabs, activeTabId: newActive };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateContent: (tabId, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, content, isDirty: content !== t.originalContent }
          : t
      ),
    }));
  },

  markSaved: (tabId) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? { ...t, isDirty: false, originalContent: t.content }
          : t
      ),
    }));
  },

  setSplitDirection: (dir) => set({ splitDirection: dir }),
}));
