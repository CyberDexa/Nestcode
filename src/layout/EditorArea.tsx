import { useEditorStore } from '../store/editorStore';
import { EditorTabs } from '../components/editor/EditorTabs';
import { MonacoEditor } from '../components/editor/MonacoEditor';

export function EditorArea() {
  const { tabs, activeTabId } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (tabs.length === 0) {
    return <WelcomeScreen />;
  }

  return (
    <div className="h-full flex flex-col bg-surface-0">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        {activeTab && <MonacoEditor tab={activeTab} />}
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="h-full flex items-center justify-center bg-surface-0">
      <div className="text-center max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nest/20 to-nest/5 border border-nest/20 flex items-center justify-center shadow-glow">
            <svg className="w-10 h-10 text-nest" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-display font-semibold text-text-primary mb-2">
          NestCode
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          AI-native IDE powered by OpenClaw
        </p>

        {/* Keyboard shortcuts */}
        <div className="space-y-3 text-left">
          <ShortcutRow keys="⌘ O" label="Open Folder" />
          <ShortcutRow keys="⌘ N" label="New File" />
          <ShortcutRow keys="⌘ J" label="Toggle Terminal" />
          <ShortcutRow keys="⌘ B" label="Toggle Sidebar" />
          <ShortcutRow keys="⌘ L" label="Chat with OpenClaw" />
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-surface-2 transition-colors group">
      <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
      <kbd className="text-2xs font-mono text-text-muted bg-surface-3 border border-border-subtle px-2 py-0.5 rounded">
        {keys}
      </kbd>
    </div>
  );
}
