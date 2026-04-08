import { create } from 'zustand';

type SidebarPanel = 'explorer' | 'git' | 'search' | 'settings';
type BottomPanel = 'terminal' | 'problems' | 'output';

type LayoutStore = {
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  chatPanelOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanel: BottomPanel;
  sidebarWidth: number;
  chatWidth: number;
  bottomHeight: number;

  toggleSidebar: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  toggleChatPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanel: (panel: BottomPanel) => void;
  setSidebarWidth: (w: number) => void;
  setChatWidth: (w: number) => void;
  setBottomHeight: (h: number) => void;
};

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarOpen: true,
  sidebarPanel: 'explorer',
  chatPanelOpen: true,
  bottomPanelOpen: true,
  bottomPanel: 'terminal',
  sidebarWidth: 260,
  chatWidth: 360,
  bottomHeight: 220,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarPanel: (panel) =>
    set((s) => ({
      sidebarPanel: panel,
      sidebarOpen: s.sidebarPanel === panel ? !s.sidebarOpen : true,
    })),
  toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  setBottomPanel: (panel) =>
    set((s) => ({
      bottomPanel: panel,
      bottomPanelOpen: s.bottomPanel === panel ? !s.bottomPanelOpen : true,
    })),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(180, Math.min(500, w)) }),
  setChatWidth: (w) => set({ chatWidth: Math.max(280, Math.min(600, w)) }),
  setBottomHeight: (h) => set({ bottomHeight: Math.max(120, Math.min(500, h)) }),
}));
