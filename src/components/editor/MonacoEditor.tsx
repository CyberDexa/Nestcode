import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore, type OpenTab } from '../../store/editorStore';

// Monaco will be loaded via CDN in production; in dev we'll use a placeholder
// For the full implementation, install monaco-editor and use @monaco-editor/react
let monacoLoaded = false;
let monacoInstance: typeof import('monaco-editor') | null = null;

async function loadMonaco() {
  if (monacoLoaded) return monacoInstance;
  
  // Dynamic import for monaco - will be configured with vite plugin
  try {
    const monaco = await import('monaco-editor');
    monacoInstance = monaco;
    monacoLoaded = true;

    // Configure dark theme
    monaco.editor.defineTheme('nestcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '555570', fontStyle: 'italic' },
        { token: 'keyword', foreground: '8866FF' },
        { token: 'string', foreground: '00D4AA' },
        { token: 'number', foreground: 'FFB020' },
        { token: 'type', foreground: '4499FF' },
        { token: 'function', foreground: 'EEEEF0' },
        { token: 'variable', foreground: 'EEEEF0' },
        { token: 'constant', foreground: 'FF8833' },
      ],
      colors: {
        'editor.background': '#0F0F17',
        'editor.foreground': '#EEEEF0',
        'editor.lineHighlightBackground': '#1A1A2720',
        'editor.selectionBackground': '#00D4AA25',
        'editor.inactiveSelectionBackground': '#00D4AA15',
        'editorCursor.foreground': '#00D4AA',
        'editorLineNumber.foreground': '#33333F',
        'editorLineNumber.activeForeground': '#8888A0',
        'editorIndentGuide.background': '#1A1A27',
        'editorIndentGuide.activeBackground': '#2A2A37',
        'editor.selectionHighlightBackground': '#00D4AA15',
        'editorBracketMatch.background': '#00D4AA20',
        'editorBracketMatch.border': '#00D4AA40',
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#ffffff10',
        'scrollbarSlider.hoverBackground': '#ffffff20',
        'scrollbarSlider.activeBackground': '#ffffff30',
        'editorWidget.background': '#14141F',
        'editorWidget.border': '#ffffff10',
        'editorSuggestWidget.background': '#14141F',
        'editorSuggestWidget.border': '#ffffff10',
        'editorSuggestWidget.selectedBackground': '#1A1A27',
        'minimap.background': '#0F0F17',
      },
    });

    return monaco;
  } catch {
    return null;
  }
}

export function MonacoEditor({ tab }: { tab: OpenTab }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const { updateContent, markSaved } = useEditorStore();

  const handleSave = useCallback(() => {
    if (!window.nestcode) return;
    const currentTab = useEditorStore.getState().tabs.find((t) => t.id === tab.id);
    if (!currentTab) return;

    window.nestcode.writeFile(currentTab.filePath, currentTab.content).then(() => {
      markSaved(tab.id);
    });
  }, [tab.id, markSaved]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    loadMonaco().then((monaco) => {
      if (disposed || !containerRef.current || !monaco) return;

      const editor = monaco.editor.create(containerRef.current, {
        value: tab.content,
        language: tab.language,
        theme: 'nestcode-dark',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontLigatures: true,
        lineHeight: 22,
        padding: { top: 16, bottom: 16 },
        minimap: { enabled: true, scale: 2, showSlider: 'mouseover' },
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
          useShadows: false,
        },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'gutter',
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
        automaticLayout: true,
        wordWrap: 'off',
        tabSize: 2,
      });

      editor.onDidChangeModelContent(() => {
        const value = editor.getValue();
        updateContent(tab.id, value);
      });

      // Save shortcut
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave);

      editorRef.current = editor;
    });

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [tab.id]);

  // Update content when tab changes (e.g. switching between tabs)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoInstance) return;

    const model = editor.getModel();
    if (model && model.getValue() !== tab.content) {
      model.setValue(tab.content);
    }

    const lang = tab.language;
    if (model) {
      monacoInstance.editor.setModelLanguage(model, lang);
    }
  }, [tab.content, tab.language]);

  // Listen for save-file event from Electron menu
  useEffect(() => {
    if (!window.nestcode) return;
    return window.nestcode.onSaveFile(handleSave);
  }, [handleSave]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: '#0F0F17' }}
    />
  );
}
