import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore, type OpenTab } from '../../store/editorStore';
import { useLayoutStore } from '../../store/layoutStore';

let monacoLoaded = false;
let monacoInstance: typeof import('monaco-editor') | null = null;

async function loadMonaco() {
  if (monacoLoaded) return monacoInstance;
  try {
    const monaco = await import('monaco-editor');
    monacoInstance = monaco;
    monacoLoaded = true;

    // ── Dark theme ─────────────────────────────────────────────────────────
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
        'editorIndentGuide.background1': '#1A1A27',
        'editorIndentGuide.activeBackground1': '#2A2A37',
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

    // ── Light theme ────────────────────────────────────────────────────────
    monaco.editor.defineTheme('nestcode-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7A7A99', fontStyle: 'italic' },
        { token: 'keyword', foreground: '6644DD' },
        { token: 'string', foreground: '007A62' },
        { token: 'number', foreground: 'B06000' },
        { token: 'type', foreground: '2266CC' },
        { token: 'function', foreground: '1A1A2A' },
        { token: 'variable', foreground: '1A1A2A' },
        { token: 'constant', foreground: 'CC5500' },
      ],
      colors: {
        'editor.background': '#F8F8FC',
        'editor.foreground': '#1A1A2A',
        'editor.lineHighlightBackground': '#D8D8E820',
        'editor.selectionBackground': '#00A88040',
        'editor.inactiveSelectionBackground': '#00A88020',
        'editorCursor.foreground': '#009E80',
        'editorLineNumber.foreground': '#B8B8C8',
        'editorLineNumber.activeForeground': '#7A7A99',
        'editorIndentGuide.background1': '#D8D8E8',
        'editorIndentGuide.activeBackground1': '#C4C4D0',
        'editor.selectionHighlightBackground': '#00A88020',
        'editorBracketMatch.background': '#00A88025',
        'editorBracketMatch.border': '#00A88050',
        'scrollbarSlider.background': '#00000010',
        'scrollbarSlider.hoverBackground': '#00000018',
        'scrollbarSlider.activeBackground': '#00000025',
        'editorWidget.background': '#EAEAF2',
        'editorWidget.border': '#00000010',
        'editorSuggestWidget.background': '#EAEAF2',
        'editorSuggestWidget.border': '#00000010',
        'editorSuggestWidget.selectedBackground': '#D8D8E8',
        'minimap.background': '#F8F8FC',
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
  const { theme, editorSettings } = useLayoutStore();
  const monacoTheme = theme === 'light' ? 'nestcode-light' : 'nestcode-dark';

  const handleSave = useCallback(() => {
    if (!window.nestcode) return;
    const currentTab = useEditorStore.getState().tabs.find((t) => t.id === tab.id);
    if (!currentTab) return;
    window.nestcode.writeFile(currentTab.filePath, currentTab.content).then(() => {
      markSaved(tab.id);
    });
  }, [tab.id, markSaved]);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    loadMonaco().then((monaco) => {
      if (disposed || !containerRef.current || !monaco) return;

      const editor = monaco.editor.create(containerRef.current, {
        value: tab.content,
        language: tab.language,
        theme: monacoTheme,
        fontSize: editorSettings.fontSize,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontLigatures: true,
        lineHeight: 22,
        padding: { top: 16, bottom: 16 },
        minimap: { enabled: editorSettings.minimap, scale: 2, showSlider: 'mouseover' },
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        renderLineHighlight: 'gutter',
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        automaticLayout: true,
        wordWrap: editorSettings.wordWrap ? 'on' : 'off',
        tabSize: editorSettings.tabSize,
      });

      editor.onDidChangeModelContent(() => {
        updateContent(tab.id, editor.getValue());
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave);
      editorRef.current = editor;
    });

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id]);

  // Update content when switching tabs
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoInstance) return;
    const model = editor.getModel();
    if (model && model.getValue() !== tab.content) model.setValue(tab.content);
    if (model) monacoInstance.editor.setModelLanguage(model, tab.language);
  }, [tab.content, tab.language]);

  // Live-update editor settings
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize: editorSettings.fontSize,
      tabSize: editorSettings.tabSize,
      wordWrap: editorSettings.wordWrap ? 'on' : 'off',
      minimap: { enabled: editorSettings.minimap },
    });
  }, [editorSettings]);

  // Live-update theme
  useEffect(() => {
    if (!monacoInstance) return;
    monacoInstance.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Listen for save-file event from Electron menu
  useEffect(() => {
    if (!window.nestcode) return;
    return window.nestcode.onSaveFile(handleSave);
  }, [handleSave]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: 'var(--monaco-bg)' }}
    />
  );
}
