import React from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  UserCheck,
  IdCard,
  Phone,
  School,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  BookOpen,
  Home,
  ArrowUpRight
} from 'lucide-react';
import { User, PlatformSettings } from '../types';
import { getSavedUsers, saveCurrentUser } from '../data/initialData';

interface StudentReviewStatusProps {
  currentUser: User;
  platformSettings: PlatformSettings;
  onRefreshStatus: () => void;
  onLogout: () => void;
  onReSignup: () => void;
  onGoToDashboard?: () => void;
  onNavigateHome?: () => void;
}

export const StudentReviewStatus: React.FC<StudentReviewStatusProps> = ({
  currentUser,
  platformSettings,
  onRefreshStatus,
  onLogout,
  onReSignup,
  onGoToDashboard,
  onNavigateHome,
}) => {
  const isPending = currentUser.status === 'pending';
  const isRejected = currentUser.status === 'rejected';
  const isActive = currentUser.status === 'active';

  // Extract display name
  const studentFullName = currentUser.name || 
    `${currentUser.firstName || ''} ${currentUser.secondName || ''} ${currentUser.thirdName || ''} ${currentUser.lastName || ''}`.trim() ||
    'طالب المنصة';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn py-6">
      {/* Status Hero Card */}
      <div
        className={`rounded-[36px] p-8 sm:p-10 border shadow-lg relative overflow-hidden transition-all ${
          isRejected
            ? 'bg-gradient-to-br from-rose-900 via-rose-950 to-slate-950 text-white border-rose-800 shadow-rose-950/20'
            : 'bg-gradient-to-br from-amber-500 via-amber-600 to-indigo-950 text-white border-amber-400 shadow-amber-500/10'
        }`}
      >
        <div className="relative z-10 space-y-6">
          {/* Header Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black tracking-wide border shadow-sm ${
                isRejected
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-amber-400 text-slate-950 border-amber-300'
              }`}
            >
              {isRejected ? (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>تم رفض طلب إنشاء الحساب</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 animate-spin text-slate-950" />
                  <span>الحساب قيد المراجعة والتدقيق</span>
                </>
              )}
            </div>

            <div className="text-xs text-white/80 font-mono">
              تاريخ تقديم الطلب: {currentUser.registeredAt || new Date().toISOString().split('T')[0]}
            </div>
          </div>

          {/* Main Title & Description */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">
              {isRejected ? (
                <span>عذراً يا {studentFullName} • تم رفض الحساب</span>
              ) : (
                <span>أهلاً بك يا {studentFullName} • طلبك قيد المراجعة</span>
              )}
            </h1>

            <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-2xl">
              {isRejected ? (
                <span>
                  نعتذر منك، لقد تم رفض طلب هذا الحساب من قِبل إدارة المنصة. يرجى إنشاء حساب آخر والتأكد من صحة المعلومات والبيانات المدخلة بدقة.
                </span>
              ) : (
                <span>
                  تم استلام بيانات تسجيلك بنجاح في <b>{platformSettings.platformName}</b>. يتم حالياً مراجعة وتدقيق البيانات من قِبل المشرف العام <b>({platformSettings.supervisorName})</b>. سيتم تفعيل حسابك وإتاحة جميع كورسات وامتحانات صفك الدراسي فور الموافقة.
                </span>
              )}
            </p>

            {isRejected && (
              <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-100 flex items-start gap-3 mt-3 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <div className="font-black text-white text-base">صفحة تنبيه: الحساب تم رفضه</div>
                  <p className="text-rose-200 leading-relaxed">
                    تمت مراجعة بياناتك ورُفض الطلب بسبب عدم دقة البيانات المسجلة. قم بإنشاء حساب آخر وتأكد من صحة المعلومات (الاسم الرباعي كاملاً، ورقم هاتف الطالب، ورقم هاتف ولي الأمر).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isActive && onGoToDashboard && (
              <button
                onClick={onGoToDashboard}
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl transition-all flex items-center gap-2 cursor-pointer animate-pulse"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>حسابك مفعل! التوجه فوراً للوحة التحكم الرئيسية 🚀</span>
              </button>
            )}

            {isRejected ? (
              <button
                onClick={onReSignup}
                className="px-6 py-3.5 rounded-2xl bg-white text-rose-700 hover:bg-rose-50 font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>قم بإنشاء حساب آخر وتأكد من المعلومات 🔄</span>
              </button>
            ) : (
              <button
                onClick={onRefreshStatus}
                className="px-6 py-3.5 rounded-2xl bg-white text-slate-950 hover:bg-amber-100 font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث حالة الحساب والتحقق من القبول 🔄</span>
              </button>
            )}

            {/* Direct App Reload Button */}
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-3.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 border border-white/25 cursor-pointer"
              title="إعادة تحميل التطبيق كاملاً للتحقق من أحدث حالة بالسحابة"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تحميل التطبيق (Reload) 🔄</span>
            </button>

            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 border border-white/20 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية 🏠</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 border border-white/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>

            {platformSettings.contactPhone && (
              <a
                href={`https://wa.me/2${platformSettings.contactPhone.replace(/^0+/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3.5 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-2 mr-auto"
              >
                <MessageSquare className="w-4 h-4" />
                <span>تواصل مع المشرف للتفعيل السريع</span>
              </a>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Student Data Summary Card */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                بيانات التسجيل المسجلة في الطلب
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                هذه هي المعلومات التي تم تقديمها للإدارة لمطابقتها واعتماد الحساب
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-black px-3 py-1 rounded-full border ${
              isRejected
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isRejected ? 'مرفوض' : 'قيد المراجعة'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">الاسم الرباعي الكامل:</span>
            <span className="text-slate-900 font-black text-sm">{studentFullName}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">رقم هاتف الطالب:</span>
            <span className="text-slate-900 font-black font-mono text-sm" dir="ltr">
              {currentUser.phone}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">رقم هاتف الطالب:</span>
            <span className="text-slate-900 font-black font-mono text-sm" dir="ltr">
              {currentUser.phone || '—'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">الصف الدراسي:</span>
            <span className="text-indigo-700 font-black text-sm">{currentUser.schoolYear}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">النظام الدراسي:</span>
            <span className="text-slate-900 font-bold text-sm">
              {currentUser.educationSystem || 'عربي'}
            </span>
          </div>

          {currentUser.division && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-slate-400 font-bold block">الشعبة (الثانوية العامة):</span>
              <span className="text-amber-700 font-black text-sm">{currentUser.division}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">المحافظة:</span>
            <span className="text-slate-900 font-bold text-sm">
              {currentUser.governorate || 'السويس'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">اسم المدرسة:</span>
            <span className="text-slate-900 font-bold text-sm">
              {currentUser.schoolName || '—'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block">هاتف ولي الأمر (الأب / الأم):</span>
            <span className="text-slate-900 font-black font-mono text-sm" dir="ltr">
              {currentUser.parentPhone || currentUser.fatherPhone || currentUser.motherPhone || '—'}
            </span>
          </div>

          {currentUser.parentJob && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-slate-400 font-bold block">وظيفة ولي الأمر:</span>
              <span className="text-slate-900 font-bold text-sm">{currentUser.parentJob}</span>
            </div>
          )}

          {currentUser.religion && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-slate-400 font-bold block">التربية الدينية:</span>
              <span className="text-slate-900 font-bold text-sm">{currentUser.religion}</span>
            </div>
          )}

          {currentUser.gender && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-slate-400 font-bold block">النوع:</span>
              <span className="text-slate-900 font-bold text-sm">{currentUser.gender}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
