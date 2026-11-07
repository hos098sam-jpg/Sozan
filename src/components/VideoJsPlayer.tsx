import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-youtube';
import { ShieldCheck, Lock, Sparkles, AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import type { User } from '../types';

export interface VideoJsPlayerProps {
  lessonId?: string;
  initialTitle?: string;
  initialToken?: string;
  currentUser?: User | null;
  onEnded?: () => void;
  className?: string;
}

export const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  lessonId = '102',
  initialTitle,
  initialToken,
  currentUser,
  onEnded,
  className = '',
}) => {
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [lessonTitle, setLessonTitle] = useState<string>(
    initialTitle || 'جاري تحميل عنوان الدرس...'
  );
  const [secureToken, setSecureToken] = useState<string | null>(initialToken || null);
  const [loading, setLoading] = useState<boolean>(!initialToken);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [blockedMessage, setBlockedMessage] = useState<string>('');
  const [watermarkPos, setWatermarkPos] = useState<{ top: number; left: number }>({ top: 20, left: 20 });
  const [isNetworkWeakOrOffline, setIsNetworkWeakOrOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerNetworkBlackout = () => {
    setIsNetworkWeakOrOffline(true);
    setError(null);
    setLoading(false);
    if (playerRef.current && !playerRef.current.isDisposed?.()) {
      try {
        playerRef.current.pause?.();
      } catch {}
    }
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
  };

  useEffect(() => {
    const handleOffline = () => triggerNetworkBlackout();
    const handleOnline = () => clearNetworkBlackoutAndResume();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  // Student phone watermark & anti-tamper watchdog
  const watermarkText = currentUser?.phone || '01040672314';
  const watermarkNodeRef = useRef<HTMLDivElement | null>(null);
  const [watermarkRebuildSeed, setWatermarkRebuildSeed] = useState<number>(0);

  // Dynamic moving watermark
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkPos({
        top: Math.floor(Math.random() * 70) + 10,
        left: Math.floor(Math.random() * 65) + 10,
      });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Active Anti-Tamper Watermark Watchdog (prevents DevTools deletion or display:none)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading || isBlocked) return;

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
        if (playerRef.current && !playerRef.current.isDisposed?.()) {
          try {
            playerRef.current.pause?.();
          } catch {}
        }
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
  }, [watermarkRebuildSeed, loading, isBlocked]);

  // Fetch secure token & lesson data from backend if not provided
  const fetchVideoData = async () => {
    setLoading(true);
    setError(null);
    setIsBlocked(false);

    try {
      // First verify access via video-auth
      const authRes = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/video-auth?studentId=${encodeURIComponent(currentUser?.id || '')}`);
      const authData = await authRes.json();

      if (authData.status === 'blocked') {
        setIsBlocked(true);
        setBlockedMessage(authData.message || 'عذراً، هذا الفيديو متاح للمشتركين فقط. يرجى تفعيل اشتراكك.');
        setLoading(false);
        return;
      }

      // Fetch secure lesson payload
      const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/secure-video?studentId=${encodeURIComponent(currentUser?.id || '')}`);
      if (!res.ok) {
        throw new Error('فشل جلب بيانات الدرس من الخادم');
      }
      const data = await res.json();
      setLessonTitle(data.lessonTitle || initialTitle || 'الدرس الأول: بنية البيانات وخوارزميات البحث');
      setSecureToken(data.secureToken || authData.secureToken || 'ZFF3NHc5V2dYY1E=');
      setLoading(false);
    } catch (err: any) {
      console.warn('[VideoJsPlayer Notice]:', err);
      if (initialToken) {
        setSecureToken(initialToken);
        setLessonTitle(initialTitle || 'الدرس الأول: بنية البيانات وخوارزميات البحث');
      } else {
        setSecureToken('ZFF3NHc5V2dYY1E=');
        setLessonTitle('الدرس الأول: بنية البيانات وخوارزميات البحث');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideoData();
  }, [lessonId, currentUser?.id]);

  // Anti-tamper protections (prevent contextmenu & F12 / DevTools shortcuts)
  useEffect(() => {
    const container = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    if (container) {
      container.addEventListener('contextmenu', handleContextMenu, { capture: true });
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  // Initialize Video.js Player when secureToken is ready
  useEffect(() => {
    if (!secureToken || isBlocked) return;

    let targetVideoId = '';
    try {
      targetVideoId = atob(secureToken.trim());
    } catch (e) {
      console.error('Failed to decode Base64 video token:', e);
      targetVideoId = 'dQw4w9WgXcQ';
    }

    if (!targetVideoId) return;

    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;

    // Clean previous player
    if (playerRef.current && !playerRef.current.isDisposed()) {
      try {
        playerRef.current.dispose();
      } catch {}
      playerRef.current = null;
    }
    wrapper.innerHTML = '';

    // Create fresh video-js element inside wrapper
    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-default-skin', 'vjs-big-play-centered', 'w-full', 'h-full');
    videoElement.setAttribute('playsinline', 'true');
    wrapper.appendChild(videoElement);

    let player: any = null;
    try {
      player = (playerRef.current = videojs(
        videoElement,
        {
          techOrder: ['youtube'],
          autoplay: false,
          controls: true,
          preload: 'auto',
          fluid: true,
          responsive: true,
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
          youtube: {
            ytControls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
          },
        },
        () => {
          player.src({
            type: 'video/youtube',
            src: `https://www.youtube.com/watch?v=${targetVideoId}`,
          });
        }
      ));

      player.on('ended', () => {
        onEnded?.();
      });

      player.on('waiting', () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          triggerNetworkBlackout();
          return;
        }
        if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
        stallTimerRef.current = setTimeout(() => {
          triggerNetworkBlackout();
        }, 1800);
      });

      player.on('playing', () => {
        if (stallTimerRef.current) {
          clearTimeout(stallTimerRef.current);
          stallTimerRef.current = null;
        }
      });

      player.on('error', () => {
        triggerNetworkBlackout();
      });
    } catch (e: any) {
      console.warn('Video.js init notice:', e);
      setError('تعذر تهيئة مشغل Video.js');
    }

    return () => {
      if (player && !player.isDisposed()) {
        try {
          player.dispose();
        } catch {}
        playerRef.current = null;
      }
      if (wrapper) {
        wrapper.innerHTML = '';
      }
    };
  }, [secureToken, isBlocked]);

  return (
    <div
      ref={containerRef}
      className={`video-container relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl select-none ${className}`}
      dir="rtl"
    >
      {/* Lesson Header */}
      <div className="lesson-header flex items-center justify-between px-5 py-3.5 bg-slate-850/90 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="lesson-title text-base sm:text-lg font-bold text-white tracking-wide" id="lesson-title">
            {lessonTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>مشغل Video.js المشفر 🔒</span>
          </span>
        </div>
      </div>

      {/* Main Video Wrapper */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
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

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-white p-6">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-300 animate-pulse">
              جاري فك تشفير توكن الفيديو وتجهيز مشغل Video.js...
            </p>
          </div>
        )}

        {/* Subscription Blocked Overlay */}
        {isBlocked && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/95 text-slate-200 p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Lock className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">محتوى خاص بالمشتركين 🔒</h4>
            <div className="error-msg max-w-md w-full bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs sm:text-sm p-4 rounded-xl leading-relaxed">
              {blockedMessage}
            </div>
            <button
              type="button"
              onClick={() => {
                const target = document.getElementById('subscriptions-section') || document.getElementById('pricing');
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.hash = '#subscription';
                }
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>تفعيل الاشتراك الآن</span>
            </button>
          </div>
        )}

        {/* Error Overlay */}
        {error && !loading && !isBlocked && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-slate-200 p-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
            <p className="text-sm text-slate-300 mb-3">{error}</p>
            <button
              onClick={fetchVideoData}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        )}

        {/* Video.js Element */}
        <div data-vjs-player ref={videoWrapperRef} className="w-full h-full aspect-video flex items-center justify-center [&_.video-js]:!w-full [&_.video-js]:!h-full" />

        {/* Dynamic Anti-Leaking Watermark (Self-Healing Anti-Tamper Node) */}
        <div
          key={`vjs_wm_${watermarkRebuildSeed}`}
          ref={watermarkNodeRef}
          className="pointer-events-none absolute z-25 transition-all duration-1000 ease-in-out select-none opacity-40 hover:opacity-30 text-[11px] sm:text-xs font-mono font-bold text-slate-300 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10"
          style={{ top: `${watermarkPos.top}%`, left: `${watermarkPos.left}%` }}
        >
          {watermarkText}
        </div>
      </div>
    </div>
  );
};

export default VideoJsPlayer;
