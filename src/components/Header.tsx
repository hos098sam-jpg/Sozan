import React from 'react';
import { 
  GraduationCap, 
  Sparkles, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  Calendar, 
  HeartHandshake, 
  UserCheck,
  Award,
  Smartphone
} from 'lucide-react';
import { BacBranch, ActiveTab } from '../types';
import { IDENTITY_NOTICE } from '../data/bacData';
import qalbAlElmLogo from '../assets/images/logo_1791663594965.jpg';
import confetti from 'canvas-confetti';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  branch: BacBranch;
  onBranchChange: (branch: BacBranch) => void;
  onShowIdentityModal: () => void;
  onShowAndroidModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  branch,
  onBranchChange,
  onShowIdentityModal,
  onShowAndroidModal,
}) => {
  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#3b82f6', '#10b981', '#a855f7'],
    });
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'tutor', label: 'المساعد والشرح المبسط', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'book_exams', label: 'رفع الكتاب و3 امتحانات لكل درس', icon: <BookOpen className="w-4 h-4" />, badge: 'PDF ذكي' },
    { id: 'summarizer', label: 'التلخيص بدون حشو', icon: <FileText className="w-4 h-4" /> },
    { id: 'exams', label: 'اختبارات وسلالم التصحيح', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'solver', label: 'حل المسائل خطوة بخطوة', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'planner', label: 'الجدول الدراسي', icon: <Calendar className="w-4 h-4" /> },
    { id: 'boost', label: 'الدعم النفسي والتحفيز', icon: <HeartHandshake className="w-4 h-4" />, badge: 'يومي' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-3 gap-3">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div 
              onClick={triggerCelebration}
              className="flex items-center gap-2.5 cursor-pointer group"
              title="اضغط للاحتفال بشهادة البكالوريا 2027!"
            >
              <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md shadow-indigo-200 overflow-hidden border border-indigo-400/30 group-hover:scale-105 transition-transform">
                <img
                  src={qalbAlElmLogo}
                  alt="شعار منصة المتفلسفة  التعليمية"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    منصة <span className="text-amber-500">المتفلسفة</span>
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                    النسخة الرسمية
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  أ/ سوزان كريم الخولى - الفلسفة والمنطق وعلم النفس والاجتماع
                </p>
              </div>
            </div>

            {/* Supervisor identity pill for mobile */}
            <button
              onClick={onShowIdentityModal}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 font-bold hover:bg-indigo-100"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>أ/ سوزان كريم الخولى</span>
            </button>
          </div>

          {/* Center / Right controls */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            
            {/* Branch Switcher (العلمي / الأدبي) */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                onClick={() => onBranchChange('scientific')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center gap-1.5 ${
                  branch === 'scientific'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <span>🧪 الفرع العلمي</span>
              </button>
              <button
                onClick={() => onBranchChange('literary')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center gap-1.5 ${
                  branch === 'literary'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <span>📚 الفرع الأدبي</span>
              </button>
            </div>

            {/* Supervisor Badge - Desktop */}
            <button
              onClick={onShowIdentityModal}
              className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100/70 transition-all shadow-sm"
              title="تعرف على هويتنا ومطور المنصة"
            >
              <Award className="w-4 h-4 text-indigo-600" />
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none">تطوير وإشراف</span>
                <span className="text-xs font-black text-slate-800">
                  {IDENTITY_NOTICE.supervisor}
                </span>
              </div>
            </button>

            {/* Android APK install guide button */}
            <button
              onClick={onShowAndroidModal}
              className="px-3.5 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 transition-all text-xs font-black flex items-center gap-1.5 shadow-sm"
              title="تثبيت التطبيق على الأندرويد وتحميل APK"
            >
              <Smartphone className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span className="hidden sm:inline">تطبيق الأندرويد</span>
            </button>

            {/* Celebration button */}
            <button
              onClick={triggerCelebration}
              className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-all text-xs font-black flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">جرعة تفاؤل</span>
            </button>
          </div>

        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 border-t border-slate-100 no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
};
