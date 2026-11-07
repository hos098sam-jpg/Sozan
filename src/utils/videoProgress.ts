// Video Progress & Resume Playback Helper for Qalb Al-Elm Platform

export interface VideoProgressRecord {
  currentTime: number;
  duration: number;
  percentage: number;
  lastUpdated: number;
  completed?: boolean;
}

const STORAGE_PREFIX = 'qalbalelm_video_progress_';

function getStorageKey(videoId: any, userId?: any): string {
  const rawVid =
    typeof videoId === 'string'
      ? videoId
      : videoId && typeof videoId === 'object'
      ? String(videoId.url || videoId.id || 'unknown')
      : String(videoId || 'unknown');
  const rawUid = typeof userId === 'string' ? userId : String(userId || 'guest');
  const cleanVid = (rawVid || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanUid = (rawUid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${STORAGE_PREFIX}${cleanUid}_${cleanVid}`;
}

export function getVideoProgress(videoId: string, userId?: string): VideoProgressRecord {
  if (!videoId) {
    return { currentTime: 0, duration: 0, percentage: 0, lastUpdated: 0, completed: false };
  }
  try {
    const key = getStorageKey(videoId, userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      return { currentTime: 0, duration: 0, percentage: 0, lastUpdated: 0, completed: false };
    }
    const parsed = JSON.parse(raw);
    const currentTime = Number(parsed.currentTime) || 0;
    const duration = Number(parsed.duration) || 0;
    const percentage = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : (Number(parsed.percentage) || 0);
    const completed = Boolean(parsed.completed || percentage >= 90);
    return {
      currentTime,
      duration,
      percentage,
      lastUpdated: Number(parsed.lastUpdated) || 0,
      completed,
    };
  } catch {
    return { currentTime: 0, duration: 0, percentage: 0, lastUpdated: 0, completed: false };
  }
}

export function saveVideoProgress(
  videoId: string,
  currentTime: number,
  duration: number,
  userId?: string,
  isEnded?: boolean
): void {
  if (!videoId || currentTime < 0) return;
  try {
    const key = getStorageKey(videoId, userId);
    const validDuration = duration > 0 ? duration : 0;
    const percentage = validDuration > 0
      ? Math.min(100, Math.round((currentTime / validDuration) * 100))
      : 0;
    const completed = Boolean(isEnded || percentage >= 90);

    const record: VideoProgressRecord = {
      currentTime: Math.floor(currentTime),
      duration: Math.floor(validDuration),
      percentage: completed ? 100 : percentage,
      lastUpdated: Date.now(),
      completed,
    };

    localStorage.setItem(key, JSON.stringify(record));

    // Dispatch custom event for real-time reactive UI update in CourseDetailView
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('video-progress-updated', {
          detail: { videoId, userId, record },
        })
      );
    }
  } catch {}
}

export function clearVideoProgress(videoId: string, userId?: string): void {
  if (!videoId) return;
  try {
    const key = getStorageKey(videoId, userId);
    localStorage.removeItem(key);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('video-progress-updated', {
          detail: { videoId, userId, record: { currentTime: 0, duration: 0, percentage: 0, lastUpdated: Date.now() } },
        })
      );
    }
  } catch {}
}

export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
