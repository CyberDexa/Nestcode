import type { NestCodeAPI } from '../electron/preload';

declare global {
  interface Window {
    nestcode: NestCodeAPI & {
      newWindow: () => Promise<void>;
      openclawResetSession: () => Promise<string>;
      getTerminalBuffer: (id?: string) => Promise<string>;
      terminalExec: (command: string, cwd?: string) => Promise<string>;
      onOpenClawToolEvent: (cb: (event: string, payload: unknown) => void) => () => void;
    };
  }
}

export {};
