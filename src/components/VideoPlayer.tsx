import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Tv2,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Zap,
  WifiOff
} from 'lucide-react';
import type { User } from '../types';
import { getIdTokenFromAuth } from '../auth';
import { createClientVideoTicket } from '../utils/mediaUtils';

export interface VideoPlayerProps {
  /** Unique ID of the video in Firestore or lesson */
  videoId: string;
  /** Title of the video or lesson */
  title?: string;
  /** Optional fallback / direct URL for TeraBox or MP4 */
  fallbackUrl?: string;
  /** Optional thumbnail poster image */
  poster?: string;
  /** Current logged in user (for dynamic student watermark) */
  currentUser?: User | null;
  /** Custom CSS classes */
  className?: string;
  /** Callback fired when video playback ends */
  onEnded?: () => void;
  /** Automatically play video once loaded */
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  fallbackUrl,
  poster,
  currentUser,
  className = '',
  onEnded,
  autoPlay = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Streaming & playback states
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamMode, setStreamMode] = useState<'proxy' | 'direct'>('proxy');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Player controls state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);

  // Anti-piracy feedback alert state
  const [showContextMenuAlert, setShowContextMenuAlert] = useState<boolean>(false);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerProtectionAlert = () => {
    setShowContextMenuAlert(true);
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    alertTimeoutRef.current = setTimeout(() => {
      setShowContextMenuAlert(false);
    }, 2800);
  };

  // Network interruption & weak internet protection state
  const [isNetworkWeakOrOffline, setIsNetworkWeakOrOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerNetworkBlackout = () => {
    setIsNetworkWeakOrOffline(true);
    setError(null);
    setIsLoading(false);
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    setIsPlaying(false);
  };

  const clearNetworkBlackoutAndResume = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      triggerNetworkBlackout();
      return;
    }
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 2500);
      await fetch(`/manifest.json?_netcheck=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(tid);
    } catch {
      triggerNetworkBlackout();
      return;
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setIsNetworkWeakOrOffline(false);
    setError(null);
  };

  useEffect(() => {
    const handleOffline = () => triggerNetworkBlackout();
    const handleOnline = () => clearNetworkBlackoutAndResume();
    const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
    const handleConnectionChange = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        triggerNetworkBlackout();
        return;
      }
      if (conn && (conn.downlink === 0 || conn.effectiveType === 'slow-2g' || (typeof conn.downlink === 'number' && conn.downlink < 0.15) || (typeof conn.rtt === 'number' && conn.rtt > 3000))) {
        triggerNetworkBlackout();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', handleConnectionChange);
      }
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  // Anti-piracy dynamic watermark coordinates & anti-tamper watchdog state
  const [watermarkPos, setWatermarkPos] = useState<{ top: number; left: number }>({ top: 20, left: 20 });
  const watermarkNodeRef = useRef<HTMLDivElement | null>(null);
  const [watermarkRebuildSeed, setWatermarkRebuildSeed] = useState<number>(0);

  // --------------------------------------------------------------------------
  // 1. Dynamic Moving Student Watermark (Anti-Screen Recording)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const randomizePosition = () => {
      const top = Math.floor(Math.random() * 65) + 12;
      const left = Math.floor(Math.random() * 60) + 10;
      setWatermarkPos({ top, left });
    };

    const timer = setInterval(randomizePosition, 8000);
    return () => clearInterval(timer);
  }, []);

  // Active Anti-Tamper Watermark Watchdog (prevents DevTools deletion or display:none)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isLoading || error || !streamUrl) return;

    let isRecovering = false;
    const verifyWatermark = () => {
      if (isRecovering) return;
      const host = containerRef.current;
      const wm = watermarkNodeRef.current;
      if (!host) return;

      let tampered = false;
      if (!wm || !host.contains(wm)) {
        tampered = true;
      } else {
        const style = window.getComputedStyle(wm);
        const opacity = parseFloat(style.opacity || '1');
        const rect = wm.getBoundingClientRect();
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.visibility === 'collapse' ||
          opacity < 0.15 ||
          (style.clipPath && style.clipPath !== 'none') ||
          style.transform.includes('0, 0') ||
          rect.width < 25 ||
          rect.height < 10
        ) {
          tampered = true;
        }
      }

      if (tampered) {
        isRecovering = true;
        if (videoRef.current && !videoRef.current.paused) {
          try {
            videoRef.current.pause();
          } catch {}
        }
        setIsPlaying(false);
        triggerProtectionAlert();
        setWatermarkRebuildSeed((s) => s + 1);
        setTimeout(() => {
          isRecovering = false;
        }, 250);
      }
    };

    const observer = new MutationObserver(verifyWatermark);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'id'],
    });
    const interval = setInterval(verifyWatermark, 350);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [watermarkRebuildSeed, isLoading, error, streamUrl]);

  // --------------------------------------------------------------------------
  // 2. Fullscreen tracking & Anti-Inspection / Contextmenu blocker
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerProtectionAlert();
      return false;
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtectionAlert();
        return false;
      }
    };

    if (container) {
      container.addEventListener('contextmenu', handleContextMenu, { capture: true });
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeydown, { capture: true });

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeydown, { capture: true });
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  // Close speed menu when clicking outside
  useEffect(() => {
    if (!showSpeedMenu) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.relative')) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showSpeedMenu]);

  // --------------------------------------------------------------------------
  // 3. Resolve Video Stream URL (Proxy first, with resilient token/fallback)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function initializeStream() {
      setIsLoading(true);
      setError(null);

      try {
        if (!videoId && !fallbackUrl) {
          throw new Error('معرف الفيديو أو الرابط غير متوفر.');
        }

        // Build token for secure proxy
        let token = await getIdTokenFromAuth();
        if (!token && currentUser?.id) {
          token = `local-${currentUser.id}`;
        }
        if (!token) {
          token = 'guest-student-session';
        }

        // Generate zero-leak encrypted/obfuscated stream ticket
        const streamTicket = createClientVideoTicket(videoId || 'direct-stream', fallbackUrl || '', currentUser?.id);
        const secureEndpoint = `/api/video/stream/${encodeURIComponent(streamTicket)}?token=${encodeURIComponent(token)}`;

        if (isMounted) {
          setStreamUrl(secureEndpoint);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Stream setup notice:', err);
          setError(err.message || 'فشل تجهيز مسار تشغيل الفيديو المحمي.');
          setIsLoading(false);
        }
      }
    }

    initializeStream();

    return () => {
      isMounted = false;
    };
  }, [videoId, fallbackUrl, retryKey, streamMode, currentUser]);

  // --------------------------------------------------------------------------
  // 4. Video Event Handlers
  // --------------------------------------------------------------------------
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setIsLoading(false);
      setError(null);
      if (autoPlay) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (onEnded) onEnded();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    e.stopPropagation();
    console.error('HTML5 Video error occurred for encrypted stream source');
    triggerNetworkBlackout();
  };

  const handleVideoWaitingOrStalled = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      triggerNetworkBlackout();
      return;
    }
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && videoRef.current.readyState < 3) {
        triggerNetworkBlackout();
      }
    }, 1600);
  };

  const handleVideoPlaying = () => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setIsPlaying(true);
  };

  // --------------------------------------------------------------------------
  // 5. Controls Actions
  // --------------------------------------------------------------------------
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Play prevented:', err);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const skipSeconds = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const studentWatermarkText = currentUser
    ? `${currentUser.name} • ${currentUser.phone || currentUser.id?.slice(0, 8)}`
    : 'منصة المتفلسفة  (جلسة دراسية مشفرة)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      ref={containerRef}
      className={`bg-slate-950 border border-slate-800/90 rounded-2xl md:rounded-3xl p-3 sm:p-4.5 shadow-2xl select-none relative overflow-hidden space-y-3 ${
        isFullscreen ? 'w-screen h-screen flex flex-col justify-center rounded-none p-0 border-0 m-0' : className
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerProtectionAlert();
        return false;
      }}
      onCopy={(e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerProtectionAlert();
      }}
    >
      {/* Top Header Information & Security Shield Badge */}
      {!isFullscreen && (
        <div className="flex items-center justify-between gap-3 text-xs border-b border-slate-800/80 pb-3 px-1">
          <div className="flex items-center gap-2 text-slate-300 font-bold truncate">
            <Tv2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">{title || 'بث الشرح التعليمي المباشر'}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/80 text-amber-400 border border-amber-800/60 rounded-full font-bold text-[10px]">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>منع التحميل والنسخ</span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full font-bold text-[10px]">
              <CheckCircle2 className="w-3 h-3" />
              <span>مشغل محمي 2027</span>
            </span>
          </div>
        </div>
      )}

      {/* Main Video Stage */}
      <div className={`relative aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-black flex items-center justify-center group shadow-inner ${
        isFullscreen ? 'h-full rounded-none aspect-auto' : ''
      }`}>
        {/* Anti-Piracy / Download Prevention Security Alert Toast */}
        {showContextMenuAlert && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-none bg-black/75 backdrop-blur-xs transition-all duration-200 animate-in fade-in zoom-in-95">
            <div className="max-w-md w-full bg-slate-950/95 border border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl flex items-center gap-3.5 text-right rtl shadow-amber-500/10">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-amber-300 text-sm font-black flex items-center gap-1.5">
                  <span>تم تعطيل النقر بزر الماوس الأيمن</span>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                </h4>
                <p className="text-slate-300 text-xs mt-1 leading-relaxed font-medium">
                  تحميل الفيديو أو نسخ الرابط المباشر محظور لحماية المحتوى التعليمي وحقوق الملكية الفكرية لمنصة المتفلسفة .
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SOLID BLACK SCREEN OVERLAY ON INTERNET DISCONNECTION OR WEAKNESS */}
        {isNetworkWeakOrOffline && (
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-[99999] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
              <WifiOff className="w-8 h-8 animate-pulse" />
            </div>
            <p className="text-white text-base sm:text-xl font-black tracking-wide max-w-lg leading-relaxed mb-5">
              في مشكلة في النت يا بطل اتاكد من سرعة النت
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearNetworkBlackoutAndResume();
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة واستئناف الفيديو</span>
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-slate-300 text-sm font-bold">جاري تحميل المحاضرة وتأمين البث...</p>
            <span className="text-slate-500 text-xs">يرجى الانتظار ثوانٍ معدودة</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3.5 p-6 text-center max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/70 flex items-center justify-center text-rose-400 shadow-md">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-slate-200 text-sm font-black">تعذر تشغيل الفيديو</h4>
              <p className="text-rose-300/90 text-xs font-medium leading-relaxed">{error}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setRetryKey((k) => k + 1);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-xs font-black rounded-xl shadow-lg cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          </div>
        ) : streamUrl ? (
          <div className="w-full h-full relative group">
            {/* HTML5 Video Element */}
            <video
              ref={videoRef}
              src={streamUrl}
              poster={poster}
              className="w-full h-full object-contain cursor-pointer"
              playsInline
              onClick={togglePlay}
              onPlay={handleVideoPlaying}
              onPlaying={handleVideoPlaying}
              onWaiting={handleVideoWaitingOrStalled}
              onStalled={handleVideoWaitingOrStalled}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              controlsList="nodownload nofullscreen noremoteplayback"
              disablePictureInPicture
            />

            {/* Dynamic Anti-Piracy Floating Watermark (Self-Healing Anti-Tamper Node) */}
            <div
              key={`vp_wm_${watermarkRebuildSeed}`}
              ref={watermarkNodeRef}
              style={{
                top: `${watermarkPos.top}%`,
                left: `${watermarkPos.left}%`,
                transition: 'top 2s ease, left 2s ease',
              }}
              className="absolute pointer-events-none z-30 select-none opacity-35 hover:opacity-45 transition-opacity bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10 text-[10px] font-mono text-white/90 shadow-md flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{studentWatermarkText}</span>
            </div>

            {/* Central Play Button Overlay when paused */}
            {!isPlaying && !isLoading && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center cursor-pointer shadow-2xl backdrop-blur-xs transition-all z-20"
              >
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            )}

            {/* Custom Modern Video Control Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 sm:p-4 z-30 opacity-95 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-2 overflow-visible">
              {/* Progress Bar / Timeline (يتحرك من اتجاه زرار التكبير ناحية زرار التشغيل عكس الوضع السابق) */}
              <div className="relative flex items-center w-full h-4 group/scrub" dir="ltr">
                <div className="w-full h-1.5 group-hover/scrub:h-2.5 bg-slate-700/80 rounded-lg overflow-hidden relative transition-all pointer-events-none">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-lg transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 100)) * 100))}%` }}
                  />
                </div>
                <input
                  type="range"
                  dir="ltr"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 shadow-md pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform group-hover/scrub:scale-125"
                  style={{ left: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 100)) * 100))}%` }}
                />
              </div>

              {/* Bottom Controls Row */}
              <div dir="rtl" className="flex items-center justify-between gap-2 text-white text-xs">
                <div className="flex items-center gap-3">
                  {/* Play / Pause */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-1.5 hover:text-indigo-400 transition-colors cursor-pointer"
                    title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>

                  {/* Skip -10s */}
                  <button
                    type="button"
                    onClick={() => skipSeconds(-10)}
                    className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="تأخير 10 ثوانٍ"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Skip +10s */}
                  <button
                    type="button"
                    onClick={() => skipSeconds(10)}
                    className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="تقديم 10 ثوانٍ"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Volume Controls */}
                  <div className="flex items-center gap-1.5 group/vol">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-14 sm:w-18 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                    />
                  </div>

                  {/* Time Counters */}
                  <div className="text-[11px] font-mono text-slate-300">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 relative">
                  {/* Speed Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSpeedMenu(!showSpeedMenu);
                      }}
                      className="px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 cursor-pointer shadow-xs active:scale-95"
                      title="سرعة التشغيل"
                    >
                      {playbackSpeed}x
                    </button>

                    {showSpeedMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-full mb-2.5 left-0 rtl:left-0 rtl:right-auto ltr:right-0 ltr:left-auto bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 z-50 min-w-[85px] max-h-[160px] sm:max-h-[200px] overflow-y-auto overscroll-contain pointer-events-auto"
                      >
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              changeSpeed(s);
                            }}
                            className={`px-2 py-1 rounded text-center text-xs font-bold transition-colors cursor-pointer ${
                              playbackSpeed === s ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fullscreen Button */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Educational Quality & Protection Notice */}
      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 px-1 text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>بث محمي لمنصة المتفلسفة  التعليمية لدفعة 2027 • علامة مائية مضمنة تلقائياً.</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>جلسة مؤمنة</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VideoPlayer;
