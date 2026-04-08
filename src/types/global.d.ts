import type { NestCodeAPI } from '../electron/preload';

declare global {
  interface Window {
    nestcode: NestCodeAPI;
  }
}

export {};
