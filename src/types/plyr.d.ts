declare module 'plyr' {
  export interface PlyrOptions {
    controls?: string[];
    settings?: string[];
    autoplay?: boolean;
    seekTime?: number;
    volume?: number;
    muted?: boolean;
    clickToPlay?: boolean;
    disableContextMenu?: boolean;
    hideControls?: boolean;
    resetOnEnd?: boolean;
    keyboard?: { focused?: boolean; global?: boolean };
    tooltips?: { controls?: boolean; seek?: boolean };
    captions?: { active?: boolean; language?: string; update?: boolean };
    fullscreen?: { enabled?: boolean; fallback?: boolean; iosNative?: boolean };
    storage?: { enabled?: boolean; key?: string };
    speed?: { selected?: number; options?: number[] };
    quality?: { default?: number; options?: number[]; forced?: boolean; onChange?: (newQuality: number) => void };
    i18n?: Record<string, string>;
    [key: string]: any;
  }

  export interface PlyrSource {
    type: 'video' | 'audio';
    title?: string;
    sources: Array<{
      src: string;
      type?: string;
      size?: number;
    }>;
    poster?: string;
    tracks?: Array<{
      kind: string;
      label: string;
      src: string;
      srcLang: string;
      default?: boolean;
    }>;
  }

  export default class Plyr {
    constructor(target: HTMLElement | string, options?: PlyrOptions);
    source: PlyrSource;
    playing: boolean;
    paused: boolean;
    stopped: boolean;
    ended: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    speed: number;
    quality: number;
    fullscreen: {
      readonly active: boolean;
      enter(): Promise<void>;
      exit(): Promise<void>;
      toggle(): Promise<void>;
    };
    play(): Promise<void>;
    pause(): void;
    togglePlay(toggle?: boolean): boolean;
    restart(): void;
    rewind(seekTime?: number): void;
    forward(seekTime?: number): void;
    destroy(): void;
    on(event: string, callback: (event: CustomEvent) => void): void;
    once(event: string, callback: (event: CustomEvent) => void): void;
    off(event: string, callback: (event: CustomEvent) => void): void;
  }
}
