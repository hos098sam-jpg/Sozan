import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Award,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Clock,
  ChevronLeft,
  Play,
  FileText,
  BarChart3,
  Calendar,
  Sparkles,
  ArrowRight,
  Printer,
  Share2,
  Trophy,
  Target,
  Tablet,
  ShieldCheck,
  Percent,
  RefreshCw,
  ExternalLink,
  Wallet,
  Key,
  Loader2
} from 'lucide-react';
import { Course, User, CourseExam, AppView } from '../types';
import { redeemStudentWalletCode } from '../data/initialData';

interface StudentDashboardProps {
  currentUser: User;
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onNavigate: (view: AppView) => void;
  onTakeExam?: (exam: CourseExam, course: Course) => void;
  onUpdateUser?: (user: User) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  courses,
  onSelectCourse,
  onNavigate,
  onTakeExam,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'exams' | 'certificates'>('overview');
  const [selectedCertificateCourse, setSelectedCertificateCourse] = useState<Course | null>(null);
  const [walletCodeInput, setWalletCodeInput] = useState('');
  const [isRedeemingWallet, setIsRedeemingWallet] = useState(false);
  const [walletFeedback, setWalletFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(currentUser.walletBalance || 0);
  const [localWalletTxs, setLocalWalletTxs] = useState(currentUser.walletTransactions || []);

  // Referral System State ("ادعُ صديقك واشحن محفظتك")
  const myReferralCode = useMemo(() => {
    if (currentUser.referralCode && currentUser.referralCode.trim().length >= 5) {
      return currentUser.referralCode.trim().toUpperCase();
    }
    const cleanId = String(currentUser.id || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-4)
      .toUpperCase();
    const phoneTail = String(currentUser.phone || '99')
      .replace(/\D/g, '')
      .slice(-2);
    return `QALB-${cleanId || 'ST'}${phoneTail || '25'}`;
  }, [currentUser.referralCode, currentUser.id, currentUser.phone]);

  const [friendReferralInput, setFriendReferralInput] = useState('');
  const [isRedeemingReferral, setIsRedeemingReferral] = useState(false);
  const [referralFeedback, setReferralFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  const handleRedeemFriendReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendReferralInput.trim()) return;
    setIsRedeemingReferral(true);
    setReferralFeedback(null);
    try {
      const res = await fetch('/api/referral/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          referralCode: friendReferralInput.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReferralFeedback({ text: data.error || 'تعذر تفعيل كود الدعوة.', type: 'error' });
      } else {
        setFriendReferralInput('');
        if (data.studentUser) {
          setLocalWalletBalance(data.studentUser.walletBalance || 0);
          setLocalWalletTxs(data.studentUser.walletTransactions || []);
          onUpdateUser?.(data.studentUser);
        }
        setReferralFeedback({
          text: data.message || 'تم تفعيل كود الدعوة وإضافة المكافأة لمحفظتك بنجاح! 🎉',
          type: 'success',
        });
      }
    } catch {
      setReferralFeedback({ text: 'حدث خطأ في الاتصال بالخادم.', type: 'error' });
    } finally {
      setIsRedeemingReferral(false);
    }
  };

  React.useEffect(() => {
    setLocalWalletBalance(currentUser.walletBalance || 0);
    setLocalWalletTxs(currentUser.walletTransactions || []);
  }, [currentUser.walletBalance, currentUser.walletTransactions]);

  const handleRedeemWalletCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletCodeInput.trim()) {
      setWalletFeedback({ text: 'يرجى إدخال كود شحن المحفظة.', type: 'error' });
      return;
    }
    setIsRedeemingWallet(true);
    setWalletFeedback(null);
    try {
      const res = await redeemStudentWalletCode(walletCodeInput, {
        ...currentUser,
        walletBalance: localWalletBalance,
        walletTransactions: localWalletTxs,
      });
      if (res.success && res.updatedUser) {
        setWalletCodeInput('');
        setLocalWalletBalance(res.updatedUser.walletBalance || 0);
        setLocalWalletTxs(res.updatedUser.walletTransactions || []);
        setWalletFeedback({
          text: res.message || `تم شحن محفظتك بمبلغ ${res.amount} ج.م بنجاح! 🎉`,
          type: 'success',
        });
        if (onUpdateUser) onUpdateUser(res.updatedUser);
      } else {
        setWalletFeedback({ text: res.error || 'كود الشحن غير صحيح أو مستخدم مسبقاً.', type: 'error' });
      }
    } catch {
      setWalletFeedback({ text: 'حدث خطأ أثناء شحن الكود.', type: 'error' });
    } finally {
      setIsRedeemingWallet(false);
    }
  };

  // Student Enrolled Courses
  const enrolledCourseIds = currentUser.enrolledCourseIds || [];
  const enrolledCourses = useMemo(() => {
    return courses.filter((c) => enrolledCourseIds.includes(c.id));
  }, [courses, enrolledCourseIds]);

  // Exam Results Record
  const examResults = currentUser.examResults || {};
  const examResultsList = useMemo(() => {
    return Object.entries(examResults).map(([examId, res]) => ({
      examId,
      ...res,
    }));
  }, [examResults]);

  // Total passed exams count and calculations
  const totalExamsTaken = examResultsList.length;
  const passedExams = examResultsList.filter((e) => e.passed || e.percentage >= 60);
  const averageScore = totalExamsTaken > 0
    ? Math.round(examResultsList.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / totalExamsTaken)
    : 0;

  // Completed Lessons Count
  const completedVideosMap = currentUser.completedVideos || {};
  const completedLessonsCount = Object.keys(completedVideosMap).filter((k) => completedVideosMap[k]).length;

  // Calculate Course Progress Percentages
  const coursesProgress = useMemo(() => {
    return courses.map((course) => {
      const lessons = course.lessons || [];
      const exams = course.exams || [];
      let totalItems = lessons.length + exams.length;
      if (totalItems === 0) totalItems = 1;

      let completedItems = 0;
      lessons.forEach((l) => {
        if (completedVideosMap[l.id] || (l.videos && l.videos.some((v) => completedVideosMap[v.id]))) {
          completedItems += 1;
        }
      });
      exams.forEach((e) => {
        if (examResults[e.id]?.passed || (examResults[e.id]?.percentage || 0) >= 60) {
          completedItems += 1;
        }
      });

      const percentage = Math.min(100, Math.round((completedItems / totalItems) * 100));
      const isEnrolled = enrolledCourseIds.includes(course.id) || course.price === 0;
      const isEligibleForCert = percentage >= 60 || (exams.length > 0 && exams.some((e) => examResults[e.id]?.passed));

      return {
        course,
        percentage,
        isEnrolled,
        isEligibleForCert,
        totalLessons: lessons.length,
        totalExams: exams.length,
      };
    });
  }, [courses, completedVideosMap, examResults, enrolledCourseIds]);

  // Courses eligible for certificates
  const certifiedCourses = useMemo(() => {
    return coursesProgress.filter((cp) => cp.isEligibleForCert).map((cp) => cp.course);
  }, [coursesProgress]);

  // Student Full Display Name
  const studentDisplayName =
    (currentUser.name && currentUser.name !== 'مستخدم منصة قلب العلم' ? currentUser.name : '') ||
    `${currentUser.firstName || ''} ${currentUser.secondName || ''} ${currentUser.thirdName || ''} ${currentUser.lastName || ''}`.trim() ||
    'طالب المنصة المتميز';

  const handlePrintCertificate = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      {/* Student Welcome Hero Card */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 border border-indigo-700/40 p-6 sm:p-10 text-white shadow-2xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none translate-x-1/3 translate-y-1/3"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>حساب طالب معتمد ونشط</span>
              </span>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-indigo-200 border border-white/15 flex items-center gap-1">
                <Tablet className="w-3.5 h-3.5 text-emerald-400" />
                <span>متوافق تماماً مع تابلت المدرسة 📱</span>
              </span>

              {currentUser.schoolYear && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {currentUser.schoolYear}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>أهلاً بك، {studentDisplayName}</span>
              <Sparkles className="w-7 h-7 text-amber-400 animate-pulse shrink-0" />
            </h1>

            <p className="text-indigo-200 text-xs sm:text-sm leading-relaxed">
              هذه لوحة تحكمك التعليمية الشاملة: تابع تقدمك في المناهج، اختبر مهاراتك في الامتحانات الإلكترونية التتابعية، واحصل على شهادات التفوق والتميز فور اجتياز الاختبارات.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={() => onNavigate('courses')}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>تصفح الكورسات والمناهج</span>
            </button>

            <button
              onClick={() => setActiveTab('certificates')}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Award className="w-4 h-4 text-amber-300" />
              <span>شهاداتي المكتسبة ({certifiedCourses.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Enrolled Courses */}
        <div className="p-5 sm:p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {enrolledCourses.length || coursesProgress.filter(c => c.isEnrolled).length}
            </div>
            <div className="text-xs text-slate-500 font-bold mt-0.5">الدورات والمناهج النشطة</div>
          </div>
        </div>

        {/* Card 2: Exams Passed */}
        <div className="p-5 sm:p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {passedExams.length}
            </div>
            <div className="text-xs text-slate-500 font-bold mt-0.5">امتحانات تم اجتيازها بنجاح</div>
          </div>
        </div>

        {/* Card 3: Average Score */}
        <div className="p-5 sm:p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono flex items-center gap-1">
              <span>{totalExamsTaken > 0 ? averageScore : 0}</span>
              <span className="text-sm font-sans">%</span>
            </div>
            <div className="text-xs text-slate-500 font-bold mt-0.5">معدل التحصيل والدرجات</div>
          </div>
        </div>

        {/* Card 4: Certificates Earned */}
        <div className="p-5 sm:p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {certifiedCourses.length}
            </div>
            <div className="text-xs text-slate-500 font-bold mt-0.5">شهادات تفوق وإتمام</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto scrollbar-none text-xs sm:text-sm font-bold">
        {[
          { id: 'overview', label: '📊 ملخص الأداء والرسوم البيانية' },
          { id: 'courses', label: `📚 كورساتي (${courses.length})` },
          { id: 'exams', label: `📝 نتائج الامتحانات (${examResultsList.length})` },
          { id: 'certificates', label: `🏆 الشهادات والتكريم (${certifiedCourses.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Academic Progress & Exam Scores Trend (SVG Bar/Line Chart) */}
            <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      مخطط درجات الامتحانات والتقييم 📈
                    </h3>
                    <p className="text-[11px] text-slate-500">رصد تطور درجات الطالب بالنسبة المئوية</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg">
                  حد النجاح: 60%
                </span>
              </div>

              {/* Visual SVG Progress Chart */}
              <div className="pt-4 pb-2">
                {examResultsList.length === 0 ? (
                  <div className="h-52 w-full rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-4">
                    <BarChart3 className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                      لم تقم بأداء أي امتحان حتى الآن
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      تظهر هنا درجاتك الفعلية فور تسليم الامتحانات الإلكترونية
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-52 w-full flex items-end justify-between gap-3 px-2 border-b border-slate-200 dark:border-slate-800 relative">
                      {/* Guideline at 60% */}
                      <div className="absolute w-full border-b border-dashed border-emerald-400/60 top-[40%] left-0 z-0">
                        <span className="text-[10px] text-emerald-600 font-bold absolute right-1 -top-4 bg-white/80 dark:bg-slate-900/80 px-1 rounded">
                          60% درجة الاجتياز
                        </span>
                      </div>

                      {examResultsList.slice(0, 6).map((item, idx) => {
                        const pct = Math.max(5, Math.min(100, item.percentage ?? 0));
                        const isSuccess = pct >= 60;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 z-10 h-full justify-end group">
                            <span className="text-[11px] font-black font-mono text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform">
                              {item.percentage ?? 0}%
                            </span>
                            <div
                              style={{ height: `${pct}%` }}
                              className={`w-full max-w-[48px] rounded-t-xl transition-all duration-500 ${
                                isSuccess
                                  ? 'bg-gradient-to-t from-indigo-600 to-emerald-500 group-hover:from-indigo-500 group-hover:to-emerald-400 shadow-md'
                                  : 'bg-gradient-to-t from-rose-600 to-amber-500'
                              }`}
                            ></div>
                            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[65px] text-center">
                              اختبار {idx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold pt-2 px-1">
                      <span>البداية</span>
                      <span>التقدم الأكاديمي</span>
                      <span>أحدث اختبار</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Chart 2: Course Progress Mastery */}
            <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      معدل إنجاز الكورسات والمناهج 🎯
                    </h3>
                    <p className="text-[11px] text-slate-500">نسبة مشاهدة الدروس وحل بنوك الأسئلة</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {coursesProgress.slice(0, 4).map(({ course, percentage, totalLessons, totalExams }) => (
                  <div key={course.id} className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                        {course.title}
                      </span>
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(5, percentage)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span>{totalLessons} درس تفاعلي</span>
                      <span>{totalExams} اختبار إلكتروني</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Student Electronic Wallet & Recharge Code Section */}
          <div className="p-6 rounded-[28px] bg-gradient-to-l from-amber-50 via-yellow-50/70 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-2 border-amber-200 dark:border-amber-500/40 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    محفظتك الإلكترونية بالمنصة 💰
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                    اشحن محفظتك باستخدام كود شحن من الإدارة، واستخدم رصيدك للاشتراك الفوري في أي كورس بضغطة زر
                  </p>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-950 border-2 border-amber-300 dark:border-amber-500/50 text-center shrink-0 shadow-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">رصيد محفظتك الحالي</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                  {localWalletBalance} ج.م
                </span>
              </div>
            </div>

            <form onSubmit={handleRedeemWalletCode} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                dir="ltr"
                value={walletCodeInput}
                onChange={(e) => setWalletCodeInput(e.target.value.toUpperCase())}
                placeholder="أدخل كود شحن المحفظة هنا (مثال: WLT-100-...)"
                className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-amber-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-black font-mono tracking-wider text-right focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={isRedeemingWallet}
                className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isRedeemingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                <span>شحن المحفظة الآن ⚡</span>
              </button>
            </form>

            {walletFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs font-black border ${
                  walletFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
                }`}
              >
                {walletFeedback.text}
              </div>
            )}

            {localWalletTxs.length > 0 && (
              <div className="pt-2 border-t border-amber-200/60 dark:border-slate-800 space-y-1.5">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                  آخر حركات المحفظة:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {localWalletTxs.slice(0, 4).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs bg-white/90 dark:bg-slate-950/70 px-3 py-2 rounded-xl border border-amber-100 dark:border-slate-800"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{tx.description}</span>
                      <span
                        className={`font-mono font-black shrink-0 mr-2 ${
                          tx.type === 'course_purchase' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {tx.type === 'course_purchase' ? `-${tx.amount}` : `+${tx.amount}`} ج.م
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Referral System Card (نظام ادعُ صديقك واشحن محفظتك) */}
          <div className="p-6 rounded-[28px] bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white border border-indigo-500/40 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>نظام المكافآت والدعوات • شحن مجاني للمحفظة 🎁</span>
                </div>
                <h4 className="text-lg sm:text-xl font-black text-white">
                  ادعُ صديقك واشحن محفظتك مجاناً!
                </h4>
                <p className="text-xs sm:text-sm text-indigo-200 font-bold leading-relaxed max-w-2xl">
                  شارك كود الدعوة الخاص بك مع أصدقائك؛ عند تفعيل صديقك للكود يحصل هو على{' '}
                  <span className="text-emerald-400 font-black">15 ج.م</span> هدية ترحيبية في محفظته، وتحصل أنت فوراً على{' '}
                  <span className="text-amber-400 font-black">25 ج.م</span> رصيد في محفظتك!
                </p>
              </div>

              {/* Student Personal Referral Code Box */}
              <div className="bg-slate-950/90 border-2 border-amber-400/60 rounded-2xl p-4 flex flex-col items-center gap-2 shrink-0 min-w-[230px]">
                <span className="text-[11px] font-black text-amber-300">كود الدعوة الخاص بك:</span>
                <span className="text-xl font-black font-mono tracking-widest text-white select-all">
                  {myReferralCode}
                </span>
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(myReferralCode);
                      setCopiedReferral(true);
                      setTimeout(() => setCopiedReferral(false), 2000);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer"
                  >
                    {copiedReferral ? 'تم النسخ ✓' : 'نسخ الكود'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `🎁 اشترك معي في منصة قلب العلم التعليمية واستخدم كود الدعوة الخاص بي (${myReferralCode}) لتحصل على 15 ج.م رصيد هدية فورية في محفظتك!`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>واتساب</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Redeem a Friend's Referral Code */}
            <div className="pt-4 border-t border-indigo-800/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-indigo-200">
                {currentUser.redeemedReferralCode ? (
                  <span className="text-emerald-400 font-black">
                    ✅ لقد قمت بتفعيل كود دعوة صديق مسبقاً ({currentUser.redeemedReferralCode}) وحصلت على المكافأة!
                  </span>
                ) : (
                  <span>هل لديك كود دعوة من صديقك؟ أدخله هنا لتحصل على 15 ج.م في محفظتك فوراً:</span>
                )}
              </div>

              {!currentUser.redeemedReferralCode && (
                <form onSubmit={handleRedeemFriendReferral} className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={friendReferralInput}
                    onChange={(e) => setFriendReferralInput(e.target.value.toUpperCase())}
                    placeholder="QALB-XXXX"
                    className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-white text-xs font-black font-mono tracking-wider w-40 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={isRedeemingReferral || !friendReferralInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black transition cursor-pointer shrink-0"
                  >
                    {isRedeemingReferral ? 'جاري التفعيل...' : 'تفعيل واستلام 15 ج.م'}
                  </button>
                </form>
              )}
            </div>

            {referralFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-black border ${
                  referralFeedback.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                }`}
              >
                {referralFeedback.text}
              </div>
            )}
          </div>

          {/* Quick Action: Continue Studying */}
          <div className="p-6 rounded-[28px] bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-900 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
                <Trophy className="w-6 h-6 text-amber-300" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-base sm:text-lg">جاهز للمحاضرة أو الاختبار القادم؟</h4>
                <p className="text-xs text-white/90">
                  استكمل دراستك الآن واجتز الامتحانات لفتح الدروس المقفلة وحصد شهادات التفوق الرسمية.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('courses')}
              className="px-6 py-3 rounded-2xl bg-white text-emerald-950 hover:bg-emerald-50 font-black text-xs sm:text-sm transition-all shadow-md cursor-pointer shrink-0 active:scale-95 flex items-center gap-2"
            >
              <span>متابعة الدراسة الآن</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: MY COURSES */}
      {activeTab === 'courses' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              الكورسات المتاحة والمشترك بها ({courses.length})
            </h3>
            <button
              onClick={() => onNavigate('courses')}
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <span>عرض جميع الكورسات</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const progressObj = coursesProgress.find((cp) => cp.course.id === course.id);
              const progress = progressObj?.percentage || 0;
              const isEnrolled = progressObj?.isEnrolled;

              return (
                <div
                  key={course.id}
                  className="p-5 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-400 transition-all flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-100">
                      <img
                        src={course.coverImage}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-2.5 right-2.5 px-3 py-1 rounded-full text-[10px] font-black bg-slate-950/80 text-white backdrop-blur-xs">
                        {course.schoolYear}
                      </span>
                      {isEnrolled && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                          مشترك ✅
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1">
                        {course.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {course.description}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">نسبة التقدم:</span>
                        <span className="font-mono text-indigo-600 font-black">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCourse(course)}
                    className="w-full py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>فتح الكورس والدروس</span>
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EXAM RESULTS */}
      {activeTab === 'exams' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              سجل نتائج الامتحانات والاختبارات التتابعية
            </h3>
            <span className="text-xs font-bold text-slate-500">
              إجمالي الامتحانات المسجلة: {examResultsList.length}
            </span>
          </div>

          {examResultsList.length === 0 ? (
            <div className="p-10 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                لم تقم بأداء أي امتحان إلكتروني حتى الآن
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ابدأ بحل امتحانات المحاضرات من داخل الكورسات لتسجيل نتائجك واكتساب شهادات التفوق.
              </p>
              <button
                onClick={() => onNavigate('courses')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer"
              >
                الدخول للامتحانات المتاحة
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {examResultsList.map((res, idx) => {
                const isUnderReview = res.status === 'under_review';
                const isPassed = !isUnderReview && (res.passed || res.percentage >= 60);
                return (
                  <div
                    key={res.examId || idx}
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isUnderReview
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : isPassed
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}
                      >
                        {isUnderReview ? (
                          <Clock className="w-5 h-5" />
                        ) : isPassed ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Percent className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-900 dark:text-white">
                          امتحان إلكتروني: {res.examId}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>التاريخ: {res.completedAt || res.submittedAt || 'مكتمل حديثاً'}</span>
                          <span>•</span>
                          <span
                            className={
                              isUnderReview
                                ? 'text-amber-600 font-black'
                                : isPassed
                                ? 'text-emerald-600 font-bold'
                                : 'text-rose-600 font-bold'
                            }
                          >
                            {isUnderReview
                              ? 'قيد التصحيح (بانتظار المدرس) ⏳'
                              : isPassed
                              ? 'ناجح بامتياز ✅'
                              : 'بحاجة لإعادة المحاولة ⚠️'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left sm:text-right">
                        {isUnderReview ? (
                          <div className="text-xs font-black px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            قيد التصحيح ⏳
                          </div>
                        ) : (
                          <>
                            <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                              {res.score} / {res.maxScore || 10}
                            </div>
                            <div className="text-xs font-bold text-indigo-600 font-mono">
                              {res.percentage}%
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CERTIFICATES & HONORS */}
      {activeTab === 'certificates' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                شهادات التفوق والإتمام الأكاديمي 🏆
              </h3>
              <p className="text-xs text-slate-500">
                تمنح هذه الشهادات الرسمية للطالب فور اجتياز امتحانات الكورس بنسبة 60% فأكثر.
              </p>
            </div>
          </div>

          {certifiedCourses.length === 0 ? (
            <div className="p-10 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <Award className="w-12 h-12 text-amber-300 mx-auto" />
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                لا توجد شهادات مكتسبة بعد
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                اجتز امتحانات أي كورس بنجاح للحصول فوراً على شهادة التفوق المعتمدة باسمك وبياناتك الرسمية.
              </p>
              <button
                onClick={() => onNavigate('courses')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer"
              >
                الدخول للكورسات والامتحانات الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certifiedCourses.map((course) => (
                <div
                  key={course.id}
                  className="p-6 rounded-[28px] bg-gradient-to-br from-amber-500/10 via-indigo-900/10 to-slate-900 border border-amber-300/40 dark:border-amber-500/30 shadow-md space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-6 h-6 text-amber-500" />
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                        شهادة إتمام وتفوق رسمية
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">معتمدة رقمياً</span>
                  </div>

                  <div>
                    <h4 className="font-black text-base text-slate-900 dark:text-white">
                      {course.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      مُنحت للطالب: <strong className="text-slate-800 dark:text-slate-200">{studentDisplayName}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setSelectedCertificateCourse(course)}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>عرض الشهادة كاملة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Certificate Modal View & Print Preview */}
          {selectedCertificateCourse && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white text-slate-950 rounded-[32px] max-w-3xl w-full p-8 sm:p-12 shadow-2xl relative border-4 border-amber-400 print:border-none print:m-0 print:p-6 print:shadow-none">
                {/* Close Button */}
                <button
                  onClick={() => setSelectedCertificateCourse(null)}
                  className="absolute top-4 left-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer print:hidden"
                >
                  ✕
                </button>

                {/* Certificate Printable Canvas */}
                <div className="text-center space-y-6 py-4">
                  <div className="flex items-center justify-center gap-2 text-amber-500">
                    <Award className="w-12 h-12" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xs uppercase tracking-widest font-black text-slate-400">
                      جمهورية مصر العربية • منصة قلب العلم التعليمية
                    </h2>
                    <h1 className="text-2xl sm:text-3xl font-black text-indigo-950">
                      شهادة تفوق وإتمام دورة تعليمية
                    </h1>
                  </div>

                  <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                    تشهد إدارة منصة قلب العلم التعليمية بأن الطالب/ـة:
                  </p>

                  <div className="py-2 border-b-2 border-indigo-200 max-w-md mx-auto">
                    <span className="text-xl sm:text-2xl font-black text-indigo-900">
                      {studentDisplayName}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    قد اجتاز بنجاح وتفوق امتحانات المحاضرات والتطبيقات التفاعلية المخصصة لكورس:
                  </p>

                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 max-w-md mx-auto font-black text-indigo-950 text-base">
                    {selectedCertificateCourse.title}
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-100 max-w-lg mx-auto text-xs text-slate-500 font-bold">
                    <div className="text-right">
                      <div>المرحلة: {selectedCertificateCourse.schoolYear}</div>
                      <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-black text-slate-900">المشرف العام وإدارة المنصة</div>
                      <div className="text-emerald-600">اعتماد رقمي رسمي ✅</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex items-center justify-center gap-3 print:hidden">
                  <button
                    onClick={handlePrintCertificate}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة / حفظ كملف PDF</span>
                  </button>
                  <button
                    onClick={() => setSelectedCertificateCourse(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
