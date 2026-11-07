import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Cloud,
  Trash2,
} from 'lucide-react';
import { PlatformNotification } from '../types';
import {
  getSavedNotifications,
  saveNotifications,
  deleteNotification,
  playNotificationSound,
  requestDeviceNotificationPermission,
} from '../utils/notifications';

interface NotificationBellProps {
  onNavigateToForum?: () => void;
  onNavigateToNotifications?: () => void;
  isActive?: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigateToForum,
  onNavigateToNotifications,
  isActive = false,
}) => {
  const [notifications, setNotifications] = useState<PlatformNotification[]>(() => getSavedNotifications());
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('qalb_alam_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync notifications from localStorage and custom events
  useEffect(() => {
    const handleUpdate = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setNotifications(e.detail);
      } else {
        setNotifications(getSavedNotifications());
      }
    };

    window.addEventListener('qalb_alam_notifications_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    } else {
      setPermissionStatus('unsupported');
    }

    return () => {
      window.removeEventListener('qalb_alam_notifications_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleToggleRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('qalb_alam_sound_enabled', String(next));
    } catch {}
    if (next) {
      playNotificationSound();
    }
  };

  const handleEnableDeviceNotifications = async () => {
    const result = await requestDeviceNotificationPermission();
    setPermissionStatus(result);
    if (result === 'granted') {
      playNotificationSound();
      try {
        new Notification('منصة قلب العلم التعليمية', {
          body: 'تم تفعيل إشعارات الجهاز بنجاح! ستصلك التنبيهات الرسمية من المشرف العام فور صدورها.',
          icon: '/logo.png',
          dir: 'rtl',
        });
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef} dir="rtl">
      {/* The Bell Button */}
      <button
        type="button"
        onClick={() => {
          if (onNavigateToNotifications) {
            setIsOpen(false);
            onNavigateToNotifications();
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs relative cursor-pointer ${
          isActive
            ? 'bg-amber-500 border-amber-500 text-slate-950 font-black shadow-md'
            : isOpen
            ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200'
            : unreadCount > 0
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="فتح صفحة الإشعارات والتنبيهات الكاملة"
        aria-label="الإشعارات"
      >
        <div className="relative">
          <Bell
            className={`w-4 h-4 ${
              isActive
                ? 'text-slate-950'
                : unreadCount > 0
                ? 'text-amber-600 dark:text-amber-400 animate-bounce'
                : ''
            }`}
          />
          {unreadCount > 0 && (
            <span
              className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs ${
                isActive ? 'bg-rose-700' : 'bg-rose-600'
              }`}
            >
              {unreadCount > 9 ? '+9' : unreadCount}
            </span>
          )}
        </div>
        <span className={`text-[11px] font-black hidden sm:inline ${isActive ? 'text-slate-950' : ''}`}>
          {unreadCount > 0 ? `${unreadCount} جديد` : 'الإشعارات'}
        </span>
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto right-auto sm:right-0 mt-2 w-[88vw] sm:w-96 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn text-right">
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black text-white">الإشعارات والتنبيهات</h4>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                    <Cloud className="w-2.5 h-2.5" />
                    سحابي مباشر
                  </span>
                </div>
                <p className="text-[10px] text-amber-300 font-medium">منصة قلب العلم لدفعة 2027</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={handleToggleSound}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  soundEnabled
                    ? 'text-amber-400 hover:bg-slate-800'
                    : 'text-slate-500 hover:bg-slate-800'
                }`}
                title={soundEnabled ? 'صوت التنبيهات مفعّل' : 'صوت التنبيهات مكتوم'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>قراءة الكل</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Access to Full Notifications Page */}
          {onNavigateToNotifications && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateToNotifications();
              }}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs border-b border-indigo-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>عرض صفحة الإشعارات المستقلة بالكامل ↗</span>
            </button>
          )}

          {/* Device Notification Activation Banner */}
          {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-900 dark:text-amber-200 font-bold leading-tight">
                  فعّل إشعارات جهازك لتصلك تنبيهات الإدارة فوراً
                </span>
              </div>
              <button
                onClick={handleEnableDeviceNotifications}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] shrink-0 shadow-xs transition-colors cursor-pointer"
              >
                تفعيل الإشعارات 🔔
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-xs font-medium">لا توجد إشعارات حالياً</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleToggleRead(n.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors relative group ${
                    !n.read
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          !n.read ? 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900' : 'bg-transparent'
                        }`}
                      />
                      <span className="text-xs font-black text-slate-900 dark:text-white leading-snug truncate">
                        {n.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {n.priority === 'urgent' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">
                          عاجل
                        </span>
                      )}
                      {n.target && n.target !== 'all' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                          {n.target === 'students' ? 'الطلاب' : 'أولياء الأمور'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(e, n.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                        title="حذف الإشعار"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed pr-3.5">
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pr-3.5">
                    <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                      <ShieldCheck className="w-3 h-3" />
                      {n.senderName}
                    </span>
                    <span>{n.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] gap-2">
            {onNavigateToNotifications ? (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToNotifications();
                }}
                className="text-indigo-600 dark:text-indigo-400 font-black hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>فتح صفحة الإشعارات ↗</span>
              </button>
            ) : (
              <span className="text-slate-500 font-medium text-[10px]">
                إشراف إدارة المنصة
              </span>
            )}
            {onNavigateToForum && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToForum();
                }}
                className="text-slate-600 dark:text-slate-300 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>المنتدى</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
