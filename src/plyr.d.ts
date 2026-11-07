declare module 'plyr' {
  export interface PlyrOptions {
    controls?: string[];
    settings?: string[];
    keyboard?: { focused?: boolean; global?: boolean };
    seekTime?: number;
    volume?: number;
    muted?: boolean;
    autoplay?: boolean;
    loop?: { active: boolean };
    speed?: { selected: number; options: number[] };
    tooltips?: { controls?: boolean; seek?: boolean };
    captions?: { active?: boolean; language?: string; update?: boolean };
    fullscreen?: { enabled?: boolean; fallback?: boolean; iosNative?: boolean };
    storage?: { enabled?: boolean; key?: string };
    [key: string]: any;
  }

  export default class Plyr {
    constructor(target: HTMLElement | string, options?: PlyrOptions);
    destroy(): void;
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    restart(): void;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    speed: number;
    source: any;
    elements: any;
    on(event: string, callback: (event: any) => void): void;
    off(event: string, callback: (event: any) => void): void;
  }
}
