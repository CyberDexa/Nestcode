import { useFileStore } from '../store/fileStore';

export function TitleBar() {
  const rootName = useFileStore((s) => s.rootName);

  return (
    <div className="titlebar-drag h-[38px] flex items-center justify-center bg-surface-0 border-b border-border-subtle relative select-none flex-shrink-0">
      {/* macOS traffic lights space */}
      <div className="absolute left-0 top-0 w-[78px] h-full" />

      {/* Center: project name */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-nest" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-xs font-medium text-text-secondary tracking-wide">
          {rootName || 'NestCode'}
        </span>
      </div>
    </div>
  );
}
