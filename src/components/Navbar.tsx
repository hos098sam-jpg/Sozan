import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  GraduationCap,
  Trophy,
  ShieldCheck,
  User as UserIcon,
  LogIn,
  LogOut,
  Menu,
  X,
  Phone,
  Users,
  Sun,
  Moon,
  UserPlus,
  MessageCircle,
  ExternalLink,
  Facebook,
  ChevronLeft,
  BookmarkCheck,
  MessageSquare,
  Bell,
  Smartphone
} from 'lucide-react';
import { User, AppView, PlatformSettings } from '../types';
import { Logo } from './Logo';
import qalbAlElmLogo from '../assets/images/qalb_alelm_official_logo_1791663594965.jpg';
import { TikTokIcon } from './TikTokIcon';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenAuth: (mode?: 'login' | 'signup' | 'parent') => void;
  platformSettings: PlatformSettings;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenFlutterApp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onLogout,
  onOpenAuth,
  platformSettings,
  theme = 'light',
  onToggleTheme,
  onOpenFlutterApp,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Lock body scroll and listen for Escape key when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setDrawerOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [drawerOpen]);

  // Desktop links: changes dynamically when logged in
  const teacherNavLinks: { id: AppView; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'الرئيسية', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'teacher_dashboard', label: 'لوحة المعلم والكورسات', icon: <BookOpen className="w-4 h-4" />, badge: 'إدارتي' },
    { id: 'courses', label: 'كافة الكورسات', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'forum', label: 'المنتدى', icon: <MessageSquare className="w-4 h-4" />, badge: 'تفاعلي' },
    { id: 'my_account', label: 'حسابي', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const loggedInNavLinks: { id: AppView; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'الرئيسية', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'courses', label: 'الكورسات', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'my_courses', label: 'كورساتي الحالية', icon: <BookmarkCheck className="w-4 h-4" />, badge: 'مفعل' },
    { id: 'forum', label: 'المنتدى', icon: <MessageSquare className="w-4 h-4" />, badge: 'تفاعلي' },
    { id: 'my_account', label: 'حسابي', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const loggedOutNavLinks: { id: AppView; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'home', label: 'الرئيسية', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'courses', label: 'الكورسات والامتحانات', icon: <BookOpen className="w-4 h-4" />, badge: 'تسلسلي' },
    { id: 'competitions', label: 'المسابقات والجوائز', icon: <Trophy className="w-4 h-4" />, badge: 'مجاني' },
  ];

  const navLinks = currentUser?.role === 'teacher' ? teacherNavLinks : currentUser ? loggedInNavLinks : loggedOutNavLinks;

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Brand & Logo */}
        <div
          onClick={() => onNavigate('home')}
          className="cursor-pointer select-none min-w-0 shrink"
        >
          <Logo size="sm" className="sm:hidden" />
          <Logo size="md" className="hidden sm:flex" />
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = currentView === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 relative ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
                {link.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                    link.badge === 'مجاني' || link.badge === 'مفعل'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                      : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300'
                  }`}>
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Student Dashboard Direct Tab Link */}
          {currentUser?.role === 'student' && (
            <button
              onClick={() => onNavigate('student_dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 mr-1 ${
                currentView === 'student_dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>لوحة تحكمي 📊</span>
            </button>
          )}

          {/* Parent Portal Tab Link if user is parent */}
          {currentUser?.role === 'parent' && (
            <button
              onClick={() => onNavigate('parent_portal')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 mr-1 ${
                currentView === 'parent_portal'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-300 dark:border-amber-700'
              }`}
            >
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>بوابة ولي الأمر 👨‍👧</span>
            </button>
          )}

          {/* Admin Direct Tab Link (Only for Admin role) */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 mr-1 ${
                currentView === 'admin'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة الكنترول والإدارة</span>
            </button>
          )}
        </nav>

        {/* Top Controls: Notification Bell + Dark/Light Mode Toggle + User Status + 3-Bars Menu Button */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Official Notification Bell - Next to Theme Toggle */}
          <NotificationBell
            onNavigateToForum={() => onNavigate('forum')}
            onNavigateToNotifications={() => onNavigate('notifications')}
            isActive={currentView === 'notifications'}
          />

          {/* Dark / Light Mode Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-2xs shrink-0"
              title={theme === 'dark' ? 'التحويل للوضع الفاتح (النهاري)' : 'التحويل للوضع الداكن (الليلي)'}
              aria-label="تبديل الوضع الداكن والفاتح"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px] font-black hidden md:inline text-amber-300">الوضع الفاتح</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                  <span className="text-[11px] font-black hidden md:inline text-slate-700">الوضع الداكن</span>
                </>
              )}
            </button>
          )}

          {/* Logged in User Quick Badge */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all text-right"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-500 text-white'
                    : currentUser.role === 'parent'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-indigo-600 text-white'
                }`}>
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : currentUser.role === 'parent' ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    (currentUser.name || 'ط').charAt(0)
                  )}
                </div>
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                    <span>{(currentUser.name || 'المستخدم').split(' ')[0]}</span>
                    {currentUser.role === 'admin' && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 rounded font-black">المشرف العام</span>
                    )}
                    {currentUser.role === 'parent' && (
                      <span className="text-[10px] bg-amber-300 text-slate-950 px-1.5 rounded font-black">ولي أمر</span>
                    )}
                  </div>
                </div>
              </button>

              {userDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-fadeIn space-y-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{currentUser.name || 'مستخدم المنصة'}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {currentUser.role === 'parent' ? 'هاتف ولي الأمر:' : 'هاتف الطالب:'} {currentUser.phone}
                    </p>
                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold mt-1 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md inline-block">
                      {currentUser.role === 'parent' ? 'بوابة أولياء الأمور 2027' : currentUser.schoolYear}
                    </div>
                  </div>

                  {currentUser.role === 'student' && (
                    <button
                      onClick={() => {
                        onNavigate('student_dashboard');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 flex items-center justify-between border border-indigo-200 dark:border-indigo-800"
                    >
                      <span>لوحة تحكم الطالب (الدرجات والشهادات) 📊</span>
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onNavigate('my_account');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 flex items-center justify-between"
                  >
                    <span>حسابي ومعلومات الحساب</span>
                    <UserIcon className="w-4 h-4 text-indigo-600" />
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('my_courses');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 flex items-center justify-between"
                  >
                    <span>كورساتي الحالية</span>
                    <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('forum');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 flex items-center justify-between"
                  >
                    <span>المنتدى التعليمي</span>
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('notifications');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center justify-between border border-amber-200/60 dark:border-amber-800/60"
                  >
                    <span>مركز الإشعارات والتنبيهات</span>
                    <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </button>

                  {currentUser.role === 'teacher' && (
                    <>
                      <button
                        onClick={() => {
                          onNavigate('teacher_dashboard');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-indigo-950 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 flex items-center justify-between"
                      >
                        <span>لوحة المعلم والكورسات 👨‍🏫</span>
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                      </button>
                      <button
                        onClick={() => {
                          onNavigate('teacher_profile');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-emerald-950 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 flex items-center justify-between"
                      >
                        <span>صفحتي العامة للطلاب 👁️</span>
                        <GraduationCap className="w-4 h-4 text-emerald-600" />
                      </button>
                    </>
                  )}

                  {currentUser.role === 'parent' && (
                    <button
                      onClick={() => {
                        onNavigate('parent_portal');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-amber-950 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 flex items-center justify-between"
                    >
                      <span>عرض تقرير درجات الطالب</span>
                      <Users className="w-4 h-4" />
                    </button>
                  )}

                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-black text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 flex items-center justify-between"
                    >
                      <span>الدخول للوحة الإدارة</span>
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onLogout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-between transition-colors"
                  >
                    <span>تسجيل الخروج</span>
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Guest Quick Login & Signup Buttons (Always visible on school tablets and mobile) */}
          {!currentUser && (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] sm:text-xs transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="تسجيل الدخول"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>دخول</span>
              </button>

              <button
                onClick={() => onOpenAuth('signup')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="إنشاء حساب طالب جديد"
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>حساب جديد</span>
              </button>
            </div>
          )}


          {/* 3-Bars Hamburger Button (زرار الـ ٣ شرطات - ظاهر للكل ويفتح كل الخانات لوحديها) */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="px-2.5 sm:px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/90 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-900 dark:text-indigo-200 font-black text-xs flex items-center gap-1.5 sm:gap-2 transition-all shadow-xs shrink-0 cursor-pointer"
            title="القائمة (٣ شرطات)"
            aria-label="القائمة الجانبية"
          >
            <Menu className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">القائمة</span>
          </button>
        </div>
      </div>

      {/* 3-Bars Side Drawer (القائمة الجانبية - تتغير كلياً بعد تسجيل الدخول حسب طلب المستخدم) */}
      {drawerOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999]" dir="rtl">
          {/* Backdrop with dark blur - Click to close */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Body - Anchored to the Right */}
          <aside
            className="fixed inset-y-0 right-0 w-[46vw] sm:w-[320px] max-w-[48vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-y-auto flex flex-col justify-between p-3 sm:p-5 text-right transition-transform duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="القائمة الجانبية"
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white border border-indigo-400/40 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                    <img
                      src={qalbAlElmLogo}
                      alt="شعار منصة المتفلسفة "
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm">
                      {currentUser ? 'قائمة الحساب والمنصة' : 'القائمة وبوابات الدخول'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      منصة المتفلسفة  التعليمية 2027
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onToggleTheme && (
                    <button
                      onClick={onToggleTheme}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="تبديل الوضع"
                    >
                      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* STATE 1: USER IS LOGGED IN (المطلوب نصاً: تختفي بوابات التسجيل وتظهر العناصر الخمسة) */}
              {/* ========================================================================= */}
              {currentUser ? (
                <div className="space-y-4">
                  {/* User Profile Badge */}
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                          currentUser.role === 'admin'
                            ? 'bg-amber-500 text-slate-950'
                            : currentUser.role === 'parent'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-indigo-600 text-white'
                        }`}>
                          {currentUser.role === 'admin' ? (
                            <ShieldCheck className="w-5 h-5" />
                          ) : currentUser.role === 'parent' ? (
                            <Users className="w-5 h-5" />
                          ) : (
                            (currentUser.name || 'ط').charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">{currentUser.name || 'مستخدم المنصة'}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{currentUser.phone}</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full font-bold">
                        {currentUser.role === 'admin' ? 'المشرف العام' : currentUser.role === 'parent' ? 'ولي أمر' : 'طالب مسجل'}
                      </span>
                    </div>

                    {currentUser.role === 'parent' && (
                      <button
                        onClick={() => {
                          onNavigate('parent_portal');
                          setDrawerOpen(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-between transition-colors"
                      >
                        <span>الانتقال لكشف درجات الطالب</span>
                        <Users className="w-4 h-4" />
                      </button>
                    )}

                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => {
                          onNavigate('admin');
                          setDrawerOpen(false);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-between transition-colors shadow-xs"
                      >
                        <span>الانتقال للوحة الكنترول والإدارة المركزية</span>
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* THE EXACT 5 ITEMS REQUESTED BY THE USER */}
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      أقسام المنصة الرئيسية
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {/* 1. الرئيسية */}
                      <button
                        onClick={() => {
                          onNavigate('home');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'home'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <GraduationCap className={`w-5 h-5 ${currentView === 'home' ? 'text-white' : 'text-indigo-600'}`} />
                          <span className="text-sm">الرئيسية</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 opacity-70" />
                      </button>

                      {/* لوحة تحكم الطالب الشاملة */}
                      {currentUser.role === 'student' && (
                        <button
                          onClick={() => {
                            onNavigate('student_dashboard');
                            setDrawerOpen(false);
                          }}
                          className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                            currentView === 'student_dashboard'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <GraduationCap className={`w-5 h-5 ${currentView === 'student_dashboard' ? 'text-white' : 'text-indigo-600'}`} />
                            <span className="text-sm font-black">لوحة تحكم الطالب (الدرجات والشهادات)</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950">
                            📊 لوحتي
                          </span>
                        </button>
                      )}

                      {/* 2. الكورسات */}
                      <button
                        onClick={() => {
                          onNavigate('courses');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'courses'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className={`w-5 h-5 ${currentView === 'courses' ? 'text-white' : 'text-indigo-600'}`} />
                          <span className="text-sm">الكورسات</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 opacity-70" />
                      </button>

                      {/* 3. كورساتي الحالية */}
                      <button
                        onClick={() => {
                          onNavigate('my_courses');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'my_courses'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <BookmarkCheck className={`w-5 h-5 ${currentView === 'my_courses' ? 'text-white' : 'text-emerald-500'}`} />
                          <span className="text-sm">كورساتي الحالية</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          currentView === 'my_courses' ? 'bg-indigo-800 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        }`}>
                          مفعل
                        </span>
                      </button>

                      {/* 4. المنتدى */}
                      <button
                        onClick={() => {
                          onNavigate('forum');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'forum'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className={`w-5 h-5 ${currentView === 'forum' ? 'text-white' : 'text-amber-500'}`} />
                          <span className="text-sm">المنتدى</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          currentView === 'forum' ? 'bg-indigo-800 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                        }`}>
                          تفاعلي 💬
                        </span>
                      </button>

                      {/* 5. حسابي */}
                      <button
                        onClick={() => {
                          onNavigate('my_account');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'my_account'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserIcon className={`w-5 h-5 ${currentView === 'my_account' ? 'text-white' : 'text-indigo-600'}`} />
                          <span className="text-sm">حسابي</span>
                        </div>
                        <ChevronLeft className="w-4 h-4 opacity-70" />
                      </button>

                      {/* 6. مركز الإشعارات المستقلة */}
                      <button
                        onClick={() => {
                          onNavigate('notifications');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'notifications'
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : 'bg-amber-50/60 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 border border-amber-200/50 dark:border-amber-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Bell className={`w-5 h-5 ${currentView === 'notifications' ? 'text-slate-950' : 'text-amber-600'}`} />
                          <span className="text-sm">صفحة الإشعارات والتنبيهات</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          صفحة كاملة 📢
                        </span>
                      </button>


                      {/* 6. لوحة المعلم والكورسات (إذا كان الحساب لمعلم) */}
                      {currentUser.role === 'teacher' && (
                        <>
                          <button
                            onClick={() => {
                              onNavigate('teacher_dashboard');
                              setDrawerOpen(false);
                            }}
                            className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                              currentView === 'teacher_dashboard'
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                              <span className="text-sm">لوحة المعلم والكورسات 👨‍🏫</span>
                            </div>
                            <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                              إدارتي
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              onNavigate('teacher_profile');
                              setDrawerOpen(false);
                            }}
                            className={`w-full p-3.5 rounded-2xl text-xs font-black flex items-center justify-between transition-all ${
                              currentView === 'teacher_profile'
                                ? 'bg-emerald-600 text-white shadow-md font-black'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-sm">صفحتي العامة للطلاب 👁️</span>
                            </div>
                            <span className="text-[10px] bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full font-black">
                              معاينة
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        onLogout();
                        setDrawerOpen(false);
                      }}
                      className="w-full py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-black flex items-center justify-between hover:bg-rose-100 transition-colors"
                    >
                      <span>تسجيل الخروج من الحساب</span>
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* STATE 2: USER IS NOT LOGGED IN (تظهر بوابات التسجيل الثلاث) */
                /* ========================================================================= */
                <div className="space-y-3">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    بوابات الدخول والتسجيل بالمنصة
                  </div>

                  {/* بوابات الدخول والتسجيل بالتصميم الجديد (Dark Neon Glassmorphic Style) */}
                  <div className="p-4 sm:p-5 rounded-3xl bg-[#070e24] border border-blue-500/40 shadow-2xl shadow-blue-900/20 space-y-4 relative overflow-hidden text-white">
                    {/* Ambient Neon Glow */}
                    <div className="absolute -top-12 -left-12 w-36 h-36 bg-blue-600/25 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-indigo-600/25 rounded-full blur-2xl pointer-events-none" />

                    {/* Top Neon Brand Header */}
                    <div className="relative z-10 flex items-center gap-3 pb-3 border-b border-blue-500/20">
                      <div className="w-11 h-11 rounded-full bg-white border border-blue-400/50 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 overflow-hidden">
                        <img
                          src={qalbAlElmLogo}
                          alt="شعار منصة المتفلسفة "
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white tracking-wide">
                          بوابة الدخول والتسجيل
                        </h4>
                        <p className="text-[11px] text-blue-300/90 font-bold">
                          مرحباً بك في منصة المتفلسفة  💙
                        </p>
                      </div>
                    </div>

                    {/* New Style Action Buttons */}
                    <div className="relative z-10 space-y-2.5">
                      {/* 1. Student / Teacher Login */}
                      <button
                        onClick={() => {
                          setDrawerOpen(false);
                          onOpenAuth('login');
                        }}
                        className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                            <LogIn className="w-4 h-4 text-white" />
                          </div>
                          <div className="text-right">
                            <span className="font-black text-xs sm:text-sm block">
                              تسجيل الدخول للحساب
                            </span>
                            <span className="text-[10px] text-blue-100/90 font-medium block">
                              برقم الهاتف وكلمة المرور
                            </span>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-blue-100 group-hover:-translate-x-1 transition-transform" />
                      </button>

                      {/* 2. Create New Student Account */}
                      <button
                        onClick={() => {
                          setDrawerOpen(false);
                          onOpenAuth('signup');
                        }}
                        className="w-full p-3.5 rounded-2xl bg-[#0d1c44] hover:bg-[#13275e] border border-blue-500/40 text-white shadow-md transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                            <UserPlus className="w-4 h-4 text-emerald-300" />
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs sm:text-sm">
                                إنشاء حساب طالب جديد
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-black">
                                2027
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-300 font-medium block">
                              انضم الآن واستكشف الكورسات والامتحانات
                            </span>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-blue-300 group-hover:-translate-x-1 transition-transform" />
                      </button>

                      {/* 3. Parent Portal */}
                      <button
                        onClick={() => {
                          setDrawerOpen(false);
                          onOpenAuth('parent');
                        }}
                        className="w-full p-3.5 rounded-2xl bg-[#0d1c44]/90 hover:bg-[#13275e] border border-amber-400/40 text-white shadow-md transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-amber-300" />
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs sm:text-sm text-amber-200">
                                بوابة متابعة ولي الأمر
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black">
                                بالرقم فقط
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-300 font-medium block">
                              التقرير الشامل لدرجات وحضور الطالب
                            </span>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-amber-300 group-hover:-translate-x-1 transition-transform" />
                      </button>

                    </div>
                  </div>

                  {/* أقسام المنصة للزائر */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      أقسام المنصة التعليمية
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {loggedOutNavLinks.map((link) => (
                        <button
                          key={link.id}
                          onClick={() => {
                            onNavigate(link.id);
                            setDrawerOpen(false);
                          }}
                          className={`w-full p-3 rounded-xl text-xs font-black flex items-center justify-between transition-all ${
                            currentView === link.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {link.icon}
                            <span>{link.label}</span>
                          </div>
                          {link.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold">
                              {link.badge}
                            </span>
                          )}
                        </button>
                      ))}

                      {/* زر الإشعارات للزائر */}
                      <button
                        onClick={() => {
                          onNavigate('notifications');
                          setDrawerOpen(false);
                        }}
                        className={`w-full p-3 rounded-xl text-xs font-black flex items-center justify-between transition-all ${
                          currentView === 'notifications'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className={`w-4 h-4 ${currentView === 'notifications' ? 'text-slate-950' : 'text-amber-500'}`} />
                          <span>مركز الإشعارات والتنبيهات الرسمية</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                          مباشر 📢
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION: DIRECT CONTACT & SOCIAL ACCOUNTS (واتساب وفيسبوك) */}
            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-black text-slate-500 dark:text-slate-400">
                قنوات التواصل والسوشيال ميديا
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Facebook Official Page Link */}
                <a
                  href="https://www.facebook.com/profile.php?id=61594492453139"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors text-center"
                >
                  <Facebook className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>فيسبوك: المتفلسفة </span>
                </a>

                {/* TikTok Link */}
                <a
                  href="https://www.tiktok.com/@qalbalelm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors text-center"
                  title="تيك توك: المتفلسفة "
                >
                  <TikTokIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>تيك توك: المتفلسفة </span>
                </a>

                {/* Facebook Group Link */}
                <a
                  href="https://www.facebook.com/share/g/1KcP6KBSRC/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors text-center"
                  title="جروب طلاب المتفلسفة "
                >
                  <Facebook className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>جروب طلاب المتفلسفة </span>
                </a>

                {/* WhatsApp Link */}
                <a
                  href="https://wa.me/201040672314"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors text-center"
                  title="الدعم الفني للمنصة"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>الدعم الفني للمنصة</span>
                </a>
              </div>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </header>
  );
};

