import { PlatformNotification } from '../types';
import {
  getSavedNotifications,
  saveNotifications,
  INITIAL_NOTIFICATIONS,
  addDeletedNotificationId,
} from '../data/initialData';

export { getSavedNotifications, saveNotifications, INITIAL_NOTIFICATIONS };

/**
 * Plays a pleasant web audio chime on new notification arrival
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Pleasant dual chime (F5 -> A5)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(698.46, now); // F5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {
    // Autoplay restrictions or audio unsupported
  }
}

/**
 * Sends a notification from Admin, saves it to Firebase Firestore and local cache,
 * broadcasts it to all connected users in realtime, and triggers device Web Notification.
 */
export async function broadcastNotification(
  title: string,
  message: string,
  priority: 'normal' | 'urgent' = 'normal',
  target: 'all' | 'students' | 'parents' = 'all'
): Promise<PlatformNotification> {
  const newNotif: PlatformNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    senderName: 'المشرف العام (إدارة المنصة)',
    timestamp: new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    priority,
    target,
    read: false,
  };

  const current = getSavedNotifications();
  const updated = [newNotif, ...current.filter((n) => n.id !== newNotif.id)];
  
  // Persists to Firebase Firestore + localStorage + dispatches event
  saveNotifications(updated);

  // Play auditory feedback
  playNotificationSound();

  // Trigger Device Web Notification if supported and permitted
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/logo.png',
          dir: 'rtl',
          lang: 'ar',
          badge: '/logo.png',
        });
      } catch (err) {
        console.warn('Could not display device notification', err);
      }
    }
  }

  return newNotif;
}

/**
 * Deletes a single notification by id from Firebase Firestore, server disk & local storage
 */
export function deleteNotification(id: string): void {
  addDeletedNotificationId(id);
  const current = getSavedNotifications();
  const updated = current.filter((n) => n.id !== id);
  saveNotifications(updated);
  fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
}

/**
 * Clears all notifications from Firebase Firestore, server disk & local storage
 */
export function clearAllNotifications(): void {
  const current = getSavedNotifications();
  current.forEach((n) => {
    if (n?.id) addDeletedNotificationId(n.id);
  });
  saveNotifications([]);
  fetch('/api/notifications', { method: 'DELETE' }).catch(() => {});
}

/**
 * Requests device notification permissions from user
 */
export async function requestDeviceNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.warn('Error requesting notification permission', e);
    return 'denied';
  }
}
