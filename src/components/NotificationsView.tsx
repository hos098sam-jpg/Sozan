import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Smartphone,
  ShieldCheck,
  Trash2,
  ArrowRight,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  GraduationCap,
  Users,
  Sparkles,
  RefreshCw,
  Send,
} from 'lucide-react';
import { PlatformNotification, User, PlatformSettings } from '../types';
import {
  getSavedNotifications,
  saveNotifications,
  deleteNotification,
  clearAllNotifications,
  playNotificationSound,
  requestDeviceNotificationPermission,
} from '../utils/notifications';

interface NotificationsViewProps {
  currentUser: User | null;
  platformSettings: PlatformSettings;
  onNavigateHome: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToCourses?: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  currentUser,
  platformSettings,
  onNavigateHome,
  onNavigateToAdmin,
  onNavigateToCourses,
}) => {
  const [notifications, setNotifications] = useState<PlatformNotification[]>(() => getSavedNotifications());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'urgent' | 'students' | 'parents' | 'general'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('qalb_alam_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync notifications with real-time cloud and local storage events
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const urgentCount = notifications.filter((n) => n.priority === 'urgent').length;

  const handleToggleRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الإشعار؟')) {
      deleteNotification(id);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع الإشعارات من السحابة؟')) {
      clearAllNotifications();
      setNotifications([]);
    }
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

  const handleTestSound = () => {
    playNotificationSound();
  };

  const handleEnableDeviceNotifications = async () => {
    const result = await requestDeviceNotificationPermission();
    setPermissionStatus(result);
    if (result === 'granted') {
      playNotificationSound();
      try {
        new Notification('منصة قلب العلم التعليمية', {
          body: 'تم تفعيل إشعارات جهازك بنجاح! ستصلك التنبيهات الرسمية من المشرف العام فور صدورها.',
          icon: '/logo.png',
          dir: 'rtl',
        });
      } catch (e) {}
    }
  };

  const handleCopyNotification = (item: PlatformNotification) => {
    const textToCopy = `📢 [${item.title}]\n${item.message}\n\nبواسطة: ${item.senderName} (${item.timestamp}) - منصة قلب العلم`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  };

  const handleShareNotification = (item: PlatformNotification) => {
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: `${item.title}\n\n${item.message}\n\nمنصة قلب العلم التعليمية 2027`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyNotification(item);
    }
  };

  // Filtered list
  const filteredNotifications = notifications.filter((notif) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = notif.title.toLowerCase().includes(q);
      const matchMsg = notif.message.toLowerCase().includes(q);
      const matchSender = notif.senderName.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchSender) return false;
    }

    // Category filter
    if (selectedFilter === 'unread') return !notif.read;
    if (selectedFilter === 'urgent') return notif.priority === 'urgent';
    if (selectedFilter === 'students') return notif.target === 'students';
    if (selectedFilter === 'parents') return notif.target === 'parents';
    if (selectedFilter === 'general') return !notif.target || notif.target === 'all';

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-200" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        </div>

        {/* Hero Header Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
                <Bell className="w-3.5 h-3.5" />
                <span>مركز الإشعارات والتنبيهات الرسمية</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                التنبيهات والقرارات الإدارية الفورية 📢
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                تابع جميع الإعلانات، مواعيد الامتحانات التتابعية، المحاضرات الجديدة، ومواعيد البث المباشر. جميع التنبيهات موثقة ومعتمدة من المشرف العام <b>إدارة المنصة</b>.
              </p>
            </div>

            {/* Quick Actions in Hero */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {currentUser?.role === 'admin' && onNavigateToAdmin && (
                <button
                  onClick={onNavigateToAdmin}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>بث إشعار جديد (للأدمن)</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleSound}
                className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  soundEnabled
                    ? 'bg-slate-800/90 border-slate-700 text-amber-300 hover:bg-slate-700'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
                title={soundEnabled ? 'صوت التنبيهات مفعّل' : 'صوت التنبيهات مكتوم'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{soundEnabled ? 'الصوت مفعّل' : 'مكتوم'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestSound}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                title="تجربة رنة التنبيه اللطيفة"
              >
                🔔 تجربة الرنة
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي الإشعارات</span>
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {notifications.length}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">غير مقروءة</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {unreadCount}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">عاجل وهام</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {urgentCount}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إشعارات الجهاز</span>
              <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-2">
              {permissionStatus === 'granted' ? 'مفعلة بنجاح ✅' : 'غير مفعلة ⚠️'}
            </p>
          </div>
        </div>

        {/* Device Push Notification Banner if not granted */}
        {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                  هل ترغب في استقبال التنبيهات الرسمية على جهازك مباشرة؟
                </h3>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium mt-0.5">
                  فعّل الإشعارات لتصلك قرارات المشرف العام ومواعيد الامتحانات حتى وإن لم تكن فاتحاً للموقع.
                </p>
              </div>
            </div>
            <button
              onClick={handleEnableDeviceNotifications}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              تفعيل إشعارات الجهاز 🔔
            </button>
          </div>
        )}

        {/* Controls Bar: Search & Filter Tabs */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في عناوين الإشعارات، النصوص، أو أسماء المرسلين..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-hidden transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Mass actions */}
            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تحديد الكل كمقروء</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                  title="مسح كافة الإشعارات"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">مسح السجل</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setSelectedFilter('unread')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                selectedFilter === 'unread'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              غير مقروء ({unreadCount})
            </button>
            <button
              onClick={() => setSelectedFilter('urgent')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                selectedFilter === 'urgent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              عاجل وهام 🚨 ({urgentCount})
            </button>
            <button
              onClick={() => setSelectedFilter('students')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                selectedFilter === 'students'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              للطلاب 🎓
            </button>
            <button
              onClick={() => setSelectedFilter('parents')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                selectedFilter === 'parents'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              لأولياء الأمور 👨‍👧
            </button>
            <button
              onClick={() => setSelectedFilter('general')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                selectedFilter === 'general'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              عام للجميع 📢
            </button>
          </div>
        </div>

        {/* Notifications Feed List */}
        <div className="space-y-3.5">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Bell className="w-8 h-8 opacity-40" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
                لا توجد إشعارات مطابقة
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                لم يتم العثور على أي تنبيهات ضمن التصنيف الحالي أو البحث المطلوب. ستظهر هنا كافة التنبيهات فور إرسالها من إدارة المنصة.
              </p>
              {selectedFilter !== 'all' && (
                <button
                  onClick={() => {
                    setSelectedFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                >
                  عرض جميع الإشعارات
                </button>
              )}
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`p-5 rounded-3xl border transition-all relative ${
                  !item.read
                    ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800/80 shadow-md ring-1 ring-amber-300/50 dark:ring-amber-900/30'
                    : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Title & Badges */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!item.read && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          جديد
                        </span>
                      )}

                      {item.priority === 'urgent' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-200 dark:border-rose-800">
                          <AlertTriangle className="w-3 h-3" />
                          عاجل وهام
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                        {item.target === 'students' ? (
                          <>
                            <GraduationCap className="w-3 h-3" />
                            <span>موجّه للطلاب</span>
                          </>
                        ) : item.target === 'parents' ? (
                          <>
                            <Users className="w-3 h-3" />
                            <span>موجّه لأولياء الأمور</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>إعلان عام للجميع</span>
                          </>
                        )}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h2>
                  </div>

                  {/* Top card actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => handleToggleRead(item.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        item.read
                          ? 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                      }`}
                      title={item.read ? 'تحديد كغير مقروء' : 'تحديد كمقروء'}
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{item.read ? 'مقروء' : 'تمييز كمقروء'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyNotification(item)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="نسخ نص الإشعار"
                    >
                      {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareNotification(item)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="مشاركة الإشعار"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      title="حذف هذا الإشعار"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="mt-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-line bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {item.message}
                </div>

                {/* Card Footer: Sender & Date */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-3 mt-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>المصدر: {item.senderName}</span>
                  </div>

                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {item.timestamp}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Banner */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
          منصة قلب العلم التعليمية • إشراف عام: {platformSettings?.supervisorName || 'إدارة المنصة'}
        </div>
      </div>
    </div>
  );
};
