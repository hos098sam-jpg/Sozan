import React, { useState, useMemo } from 'react';
import {
  User as UserIcon,
  Phone,
  Calendar,
  Award,
  ShieldCheck,
  CheckCircle2,
  Users,
  Eye,
  BookOpen,
  Clock,
  FileText,
  MessageCircle,
  GraduationCap,
  MapPin,
  Building,
  ExternalLink,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Sparkles,
  ArrowUpRight,
  Filter,
  Layers,
  Flame,
  Target,
  AlertCircle,
  HelpCircle,
  Check,
  RotateCcw,
  KeyRound,
  X,
  Lock,
  Plus,
  Edit,
  Trash2,
  Settings,
  Upload,
  Smartphone,
  Wallet,
  Key,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from '../utils/rechartsShim';
import { User, Course, AppView, PlatformSettings, SchoolYearGrade, CourseType } from '../types';
import { getSavedSubmissions, getSavedUsers, saveUsers, saveCurrentUser, saveCourses, deleteCourseFromServer, redeemStudentWalletCode } from '../data/initialData';
import { CourseLessonManagerModal } from './CourseLessonManagerModal';
import { 
  requestWhatsAppParentOtp, 
  verifyWhatsAppParentOtp, 
  updateStudentGuardianVerificationInFirestore 
} from '../auth';

// Custom Interactive Tooltip for Recharts Progression Chart
const CustomProgressionTooltip: React.FC<any> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    if (!item) return null;
    return (
      <div className="bg-slate-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-indigo-500/40 shadow-2xl text-xs space-y-2 min-w-[220px]" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
          <span className="font-black text-indigo-300 text-xs truncate max-w-[150px]">
            {item.displayTitle || item.examTitle || item.name}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${item.passed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
            {item.passed ? 'اجتياز بنجاح ✅' : 'يحتاج إعادة ⚠️'}
          </span>
        </div>
        {item.courseTitle && (
          <div className="text-slate-300 text-[11px] flex items-center justify-between">
            <span className="text-slate-400">المقرر:</span>
            <span className="font-bold text-slate-200 truncate max-w-[130px]">{item.courseTitle}</span>
          </div>
        )}
        <div className="text-slate-300 text-[11px] flex items-center justify-between">
          <span className="text-slate-400">الدرجة الفعلية:</span>
          <span className="font-black text-amber-400 font-mono text-xs">{item.score} من {item.maxScore}</span>
        </div>
        <div className="text-slate-300 text-[11px] flex items-center justify-between">
          <span className="text-slate-400">النسبة المئوية:</span>
          <span className="font-black text-emerald-400 font-mono text-sm">{item.percentage}%</span>
        </div>
        {item.delta !== undefined && (
          <div className="text-slate-300 text-[11px] flex items-center justify-between">
            <span className="text-slate-400">التغير عن السابق:</span>
            <span className={`font-black font-mono text-xs ${item.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {item.delta >= 0 ? `+${item.delta}% ↗` : `${item.delta}% ↘`}
            </span>
          </div>
        )}
        {item.date && (
          <div className="text-slate-400 text-[10px] pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
            <span>تاريخ التسليم:</span>
            <span className="font-mono">{item.date}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

interface MyAccountViewProps {
  currentUser: User | null;
  allCourses: Course[];
  onNavigate?: (view: AppView) => void;
  onLogout: () => void;
  onOpenAuth?: (mode?: 'login' | 'signup' | 'parent') => void;
  onUpdateUser?: (updatedUser: User) => void;
  onUpdateCourses?: (newCourses: Course[]) => void;
  platformSettings?: PlatformSettings;
}

export const MyAccountView: React.FC<MyAccountViewProps> = ({
  currentUser,
  allCourses,
  onNavigate,
  onLogout,
  onOpenAuth,
  onUpdateUser,
  onUpdateCourses,
  platformSettings,
}) => {
  const [progressionChartType, setProgressionChartType] = useState<'area' | 'composed' | 'bar'>('area');
  const [progressionMetricMode, setProgressionMetricMode] = useState<'percentage' | 'score'>('percentage');
  const [selectedProgressionSubject, setSelectedProgressionSubject] = useState<string>('all');
  const [showProgressionSample, setShowProgressionSample] = useState<boolean>(false);

  // Guardian WhatsApp Verification Modal States
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyPhone, setVerifyPhone] = useState(
    currentUser?.parentPhone || currentUser?.fatherPhone || currentUser?.motherPhone || ''
  );
  const [verifySessionId, setVerifySessionId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyStep, setVerifyStep] = useState<'request' | 'verify'>('request');
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  const [verifyMaskedPhone, setVerifyMaskedPhone] = useState('');
  const [verifyDirectUrl, setVerifyDirectUrl] = useState('');
  const [verifySimulatedOtp, setVerifySimulatedOtp] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [isVerifySubmitting, setIsVerifySubmitting] = useState(false);

  // Student Wallet Recharge States
  const [walletCodeInput, setWalletCodeInput] = useState('');
  const [isRedeemingWallet, setIsRedeemingWallet] = useState(false);
  const [walletFeedback, setWalletFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [localWalletBalance, setLocalWalletBalance] = useState<number>(currentUser?.walletBalance || 0);
  const [localWalletTxs, setLocalWalletTxs] = useState(currentUser?.walletTransactions || []);

  React.useEffect(() => {
    setLocalWalletBalance(currentUser?.walletBalance || 0);
    setLocalWalletTxs(currentUser?.walletTransactions || []);
  }, [currentUser?.walletBalance, currentUser?.walletTransactions]);

  const handleRedeemWalletCodeInAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
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
        setWalletFeedback({ text: res.error || 'كود الشحن غير صحيح أو تم استخدامه.', type: 'error' });
      }
    } catch {
      setWalletFeedback({ text: 'حدث خطأ أثناء شحن الكود.', type: 'error' });
    } finally {
      setIsRedeemingWallet(false);
    }
  };

  // Cooldown timer effect
  React.useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerifyCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown]);

  const handleOpenVerifyModal = () => {
    setVerifyPhone(currentUser?.parentPhone || currentUser?.fatherPhone || currentUser?.motherPhone || '');
    setVerifyStep('request');
    setVerifyError(null);
    setVerifySuccess(null);
    setVerifyCode('');
    setIsVerifyModalOpen(true);
  };

  const handleSendVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setVerifyError(null);
    setVerifySuccess(null);

    const clean = verifyPhone.trim().replace(/\s+/g, '');
    if (!clean) {
      setVerifyError('الرجاء إدخال رقم هاتف ولي الأمر (واتساب).');
      return;
    }

    setIsVerifySubmitting(true);
    try {
      const res = await requestWhatsAppParentOtp(clean, {
        studentId: currentUser?.id,
        studentPhone: currentUser?.phone,
        studentName: currentUser?.name,
      });

      setVerifySessionId(res.sessionId);
      setVerifyMaskedPhone(res.phoneMasked || clean);
      setVerifyCooldown(res.cooldownSeconds || 60);
      setVerifyDirectUrl(res.directWhatsAppUrl || '');
      setVerifySimulatedOtp(res.simulatedOtp || '');
      setVerifyStep('verify');
      setVerifySuccess(res.message || 'تم إرسال رمز التحقق الخاص إلى واتساب ولي الأمر بنجاح.');
    } catch (err: any) {
      setVerifyError(err?.message || 'تعذر إرسال كود التحقق إلى واتساب ولي الأمر.');
    } finally {
      setIsVerifySubmitting(false);
    }
  };

  const handleConfirmVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setVerifySuccess(null);

    const cleanCode = verifyCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setVerifyError('يرجى كتابة رمز التحقق المكون من 6 أرقام المرسل عبر واتساب.');
      return;
    }

    setIsVerifySubmitting(true);
    try {
      await verifyWhatsAppParentOtp(verifySessionId, cleanCode, currentUser || undefined);

      const verifiedTimestamp = new Date().toISOString();
      const updatedUser: User = {
        ...currentUser!,
        parentPhone: verifyPhone,
        guardianVerified: true,
        guardianVerifiedPhone: verifyPhone,
        guardianVerifiedAt: verifiedTimestamp,
      };

      if (currentUser?.id) {
        updateStudentGuardianVerificationInFirestore(currentUser.id, verifyPhone).catch(() => {});
      }

      const allUsers = getSavedUsers();
      saveUsers(allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      saveCurrentUser(updatedUser);

      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }

      setVerifySuccess('تم التحقق بنجاح من ولي الأمر وحفظ بيانات الطالب وتفعيل التوثيق الأبوي!');
      setTimeout(() => {
        setIsVerifyModalOpen(false); // ويخفي صفحته ولي الامر
      }, 900);
    } catch (err: any) {
      setVerifyError(err?.message || 'رمز التحقق غير صحيح، يرجى التأكد من الرمز المرسل عبر واتساب.');
    } finally {
      setIsVerifySubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-md mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto font-black">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">يرجى تسجيل الدخول لعرض الحساب</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          سجل دخولك الآن لعرض ملفك الشخصي، ولوحة إحصائيات تقدمك الأكاديمي، وتقرير درجاتك لولي الأمر.
        </p>
        <button
          onClick={() => onOpenAuth && onOpenAuth('login')}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs inline-flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>تسجيل الدخول الآن</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Exam stats calculations
  const examResults = currentUser.examResults || {};
  const examEntries = Object.entries(examResults);
  const totalExamsTaken = examEntries.length;

  const totalPercentage = totalExamsTaken > 0
    ? Math.round(examEntries.reduce((sum, [, res]) => sum + (res.percentage || 0), 0) / totalExamsTaken)
    : 0;

  const passedCount = examEntries.filter(([, res]) => res.passed).length;

  // Enrolled courses (only actually enrolled or free courses)
  const enrolledCourses = allCourses.filter(
    (c) => currentUser.enrolledCourseIds?.includes(c.id) || c.price === 0
  );

  // 1. Chart Data: Course Completion Breakdown
  const courseCompletionData = enrolledCourses.slice(0, 6).map((c) => {
    const examsInCourse = (c.exams?.length || 0) + (c.lessons?.reduce((acc, l) => acc + (l.exams?.length || 0), 0) || 0);
    // Count passed
    const passedExams = (c.exams || []).filter((ex) => examResults[ex.id]?.passed).length;
    const completionPct = examsInCourse > 0 ? Math.round((passedExams / examsInCourse) * 100) : 0;

    return {
      name: c.title.length > 15 ? c.title.substring(0, 15) + '...' : c.title,
      fullTitle: c.title,
      إجمالي_الامتحانات: examsInCourse,
      المجتاز_بنجاح: passedExams,
      نسبة_الإنجاز: completionPct,
    };
  });

  // =========================================================================
  // RECHARTS PROGRESSION ENGINE: EXAM SCORES DEVELOPMENT
  // =========================================================================
  // 1. Build an exam info lookup from allCourses
  const examMetadataMap = useMemo(() => {
    const map = new Map<string, { examTitle: string; courseTitle: string; subject: string; passingPercentage: number }>();
    allCourses.forEach((course) => {
      (course.exams || []).forEach((ex) => {
        map.set(ex.id, {
          examTitle: ex.title || 'امتحان مقرر',
          courseTitle: course.title,
          subject: course.subject || course.title,
          passingPercentage: ex.passingPercentage || 60,
        });
      });
      (course.lessons || []).forEach((lesson) => {
        (lesson.exams || []).forEach((ex) => {
          map.set(ex.id, {
            examTitle: ex.title || `${lesson.title} - امتحان`,
            courseTitle: course.title,
            subject: course.subject || course.title,
            passingPercentage: ex.passingPercentage || 60,
          });
        });
      });
    });
    return map;
  }, [allCourses]);

  // 2. Extract submissions for current student
  const studentSubmissions = useMemo(() => {
    try {
      const allSubs = getSavedSubmissions();
      return allSubs.filter(
        (s) => s.studentId === currentUser.id || (currentUser.phone && s.studentPhone === currentUser.phone)
      );
    } catch {
      return [];
    }
  }, [currentUser.id, currentUser.phone]);

  // 3. Real Progression Items from User's Account
  interface ExamProgressionItem {
    id: string;
    index: number;
    shortName: string;
    examTitle: string;
    courseTitle: string;
    subject: string;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    date: string;
    delta?: number;
  }

  const realProgressionItems = useMemo(() => {
    const items: ExamProgressionItem[] = [];

    // From currentUser.examResults
    examEntries.forEach(([examId, res], idx) => {
      const meta = examMetadataMap.get(examId);
      const sub = studentSubmissions.find((s) => s.examId === examId);
      const examTitle = sub?.examTitle || meta?.examTitle || `امتحان #${idx + 1}`;
      const courseTitle = sub?.courseTitle || meta?.courseTitle || 'مقرر دراسي';
      const subject = meta?.subject || 'مقرر عام';
      const date = res.submittedAt || res.completedAt || sub?.submittedAt || `2026-09-${String(idx + 1).padStart(2, '0')}`;
      const score = res.score ?? 0;
      const maxScore = res.maxScore ?? 100;
      const percentage = res.percentage ?? (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
      const passed = res.passed ?? (percentage >= 60);

      items.push({
        id: examId,
        index: idx + 1,
        shortName: `اختبار ${idx + 1}`,
        examTitle,
        courseTitle,
        subject,
        score,
        maxScore,
        percentage,
        passed,
        date,
      });
    });

    // Submissions not in examEntries
    studentSubmissions.forEach((sub, subIdx) => {
      if (!items.some((it) => it.id === sub.examId)) {
        const meta = examMetadataMap.get(sub.examId);
        const examTitle = sub.examTitle || meta?.examTitle || `امتحان #${items.length + 1}`;
        const courseTitle = sub.courseTitle || meta?.courseTitle || 'مقرر دراسي';
        const subject = meta?.subject || 'مقرر عام';
        const score = sub.totalScore ?? 0;
        const maxScore = sub.maxScore ?? 100;
        const percentage = sub.percentage ?? (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
        const passed = sub.passed ?? (percentage >= 60);

        items.push({
          id: sub.submissionId ? `${sub.submissionId}-${subIdx}` : `${sub.examId || 'sub'}-${subIdx}`,
          index: items.length + 1,
          shortName: `اختبار ${items.length + 1}`,
          examTitle,
          courseTitle,
          subject,
          score,
          maxScore,
          percentage,
          passed,
          date: sub.submittedAt || '2026-09-10',
        });
      }
    });

    // Sort chronologically
    items.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate progression delta
    return items.map((item, i) => {
      const prev = items[i - 1];
      const delta = prev !== undefined ? item.percentage - prev.percentage : undefined;
      return {
        ...item,
        index: i + 1,
        shortName: `اختبار ${i + 1}`,
        delta,
      };
    });
  }, [examEntries, examMetadataMap, studentSubmissions]);

  // Sample progression items for demonstration when student is new
  const sampleProgressionItems: ExamProgressionItem[] = useMemo(() => [
    {
      id: 'demo-1',
      index: 1,
      shortName: 'اختبار 1',
      examTitle: 'اختبار تشخيصي تمهيدي للمستوى',
      courseTitle: 'الفيزياء الكهربية للثانوية',
      subject: 'الفيزياء',
      score: 14,
      maxScore: 20,
      percentage: 70,
      passed: true,
      date: '2026-09-01',
    },
    {
      id: 'demo-2',
      index: 2,
      shortName: 'اختبار 2',
      examTitle: 'امتحان قانون كيرشوف وقوانين الدوائر',
      courseTitle: 'الفيزياء الكهربية للثانوية',
      subject: 'الفيزياء',
      score: 16,
      maxScore: 20,
      percentage: 80,
      passed: true,
      date: '2026-09-03',
      delta: 10,
    },
    {
      id: 'demo-3',
      index: 3,
      shortName: 'اختبار 3',
      examTitle: 'امتحان الكيمياء العضوية - الهيدروكربونات',
      courseTitle: 'كيمياء الثانوية العامة',
      subject: 'الكيمياء',
      score: 22,
      maxScore: 30,
      percentage: 73,
      passed: true,
      date: '2026-09-05',
      delta: -7,
    },
    {
      id: 'demo-4',
      index: 4,
      shortName: 'اختبار 4',
      examTitle: 'امتحان شامل: التأثير المغناطيسي وأجهزة القياس',
      courseTitle: 'الفيزياء الكهربية للثانوية',
      subject: 'الفيزياء',
      score: 44,
      maxScore: 50,
      percentage: 88,
      passed: true,
      date: '2026-09-08',
      delta: 15,
    },
    {
      id: 'demo-5',
      index: 5,
      shortName: 'اختبار 5',
      examTitle: 'اختبار المحاكاة الوزارية التجريبي لدفعة 2027',
      courseTitle: 'المراجعة الشاملة لدفعة 2027',
      subject: 'الفيزياء',
      score: 57,
      maxScore: 60,
      percentage: 95,
      passed: true,
      date: '2026-09-10',
      delta: 7,
    },
  ], []);

  // Only show sample data if the user explicitly clicks the sample preview button
  const isDisplayingSample = showProgressionSample;

  // Active items: real exams by default (empty array when student has 0 exams)
  const activeProgressionItems = useMemo(() => {
    const raw = showProgressionSample ? sampleProgressionItems : realProgressionItems;

    if (selectedProgressionSubject === 'all') return raw;
    return raw.filter((item) => item.subject === selectedProgressionSubject);
  }, [realProgressionItems, showProgressionSample, sampleProgressionItems, selectedProgressionSubject]);

  // Available subjects for filtering
  const availableProgressionSubjects = useMemo(() => {
    const source = showProgressionSample ? sampleProgressionItems : realProgressionItems;
    const subjects = new Set(source.map((item) => item.subject));
    return Array.from(subjects).filter(Boolean);
  }, [realProgressionItems, showProgressionSample, sampleProgressionItems]);

  // Key KPI metrics on active data
  const progressionStats = useMemo(() => {
    if (activeProgressionItems.length === 0) {
      return { peak: 0, lowest: 0, avg: 0, delta: 0, passedCount: 0, passRate: 0 };
    }
    const percentages = activeProgressionItems.map((d) => d.percentage);
    const peak = Math.max(...percentages);
    const lowest = Math.min(...percentages);
    const avg = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    const first = activeProgressionItems[0].percentage;
    const last = activeProgressionItems[activeProgressionItems.length - 1].percentage;
    const delta = activeProgressionItems.length > 1 ? last - first : 0;
    const passed = activeProgressionItems.filter((d) => d.passed).length;
    const passRate = Math.round((passed / activeProgressionItems.length) * 100);

    return { peak, lowest, avg, delta, passedCount: passed, passRate };
  }, [activeProgressionItems]);

  // Recharts formatted data
  const rechartsProgressionData = useMemo(() => {
    return activeProgressionItems.map((item) => ({
      ...item,
      name: item.shortName,
      displayTitle: item.examTitle,
      النسبة_المئوية: item.percentage,
      الدرجة_المحققة: item.score,
      الدرجة_القصوى: item.maxScore,
    }));
  }, [activeProgressionItems]);

  // Legacy fallback for other sections
  const examProgressionData = rechartsProgressionData;

  // 3. Chart Data: Performance Tier Distribution
  let excellentCount = 0; // >= 85
  let veryGoodCount = 0;  // 75-84
  let passCount = 0;      // 60-74
  let needsPracticeCount = 0; // < 60

  const distributionSource = showProgressionSample ? sampleProgressionItems : realProgressionItems;
  distributionSource.forEach((res) => {
    const pct = res.percentage || 0;
    if (pct >= 85) excellentCount++;
    else if (pct >= 75) veryGoodCount++;
    else if (pct >= 60) passCount++;
    else needsPracticeCount++;
  });

  const performancePieData = [
    { name: 'ممتاز (85%+)', value: excellentCount, color: '#10b981' },
    { name: 'جيد جداً (75-84%)', value: veryGoodCount, color: '#6366f1' },
    { name: 'ناجح (60-74%)', value: passCount, color: '#f59e0b' },
    { name: 'يحتاج تدريب (<60%)', value: needsPracticeCount, color: '#f43f5e' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Account Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center ring-4 ring-white/10 shadow-lg shrink-0">
              {currentUser.role === 'admin' ? (
                <ShieldCheck className="w-10 h-10 text-amber-400" />
              ) : currentUser.role === 'parent' ? (
                <Users className="w-10 h-10 text-amber-300" />
              ) : (
                (
                  (currentUser.name && currentUser.name !== 'مستخدم منصة قلب العلم'
                    ? currentUser.name
                    : [currentUser.firstName, currentUser.secondName, currentUser.thirdName, currentUser.lastName]
                        .filter(Boolean)
                        .join(' ')) || 'ط'
                ).charAt(0)
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {(currentUser.name && currentUser.name !== 'مستخدم منصة قلب العلم'
                    ? currentUser.name
                    : [currentUser.firstName, currentUser.secondName, currentUser.thirdName, currentUser.lastName]
                        .filter(Boolean)
                        .join(' ')) || 'طالب المنصة'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>حساب مفعل رسمياً</span>
                </span>
                {currentUser.role === 'admin' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                    المشرف العام
                  </span>
                )}
              </div>

              <p className="text-xs text-indigo-200 font-medium">
                {currentUser.schoolYear} • دفعة 2027 تحت إشراف إدارة المنصة
              </p>

              <div className="flex items-center gap-3 text-[11px] text-slate-300 pt-1">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-indigo-400" />
                  {currentUser.phone}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  تاريخ الانضمام: {currentUser.registeredAt || '2026'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate && onNavigate('my_courses')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-colors shadow-xs cursor-pointer"
            >
              كورساتي الحالية 📚
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-rose-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
          {/* Single-Device Protection & Bound Device Info Card */}
          {currentUser.role === 'student' && (
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      أمان الحساب والجهاز المعتمد
                    </h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      جلسة واحدة نشطة
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    الجهاز المقترن حالياً:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {currentUser.currentDeviceName || 'جهاز هذا المتصفح المعتمد'}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                {(() => {
                  const recentSwitches = (currentUser.deviceChangesHistory || []).filter(
                    (c, idx) =>
                      (c.isChange === true || c.type === 'device_change' || idx > 0) &&
                      Date.now() - new Date(c.changedAt).getTime() < 30 * 24 * 60 * 60 * 1000
                  );
                  const count = recentSwitches.length;
                  const remaining = Math.max(0, 2 - count);
                  return (
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                        تغيير الجهاز هذا الشهر:
                      </span>
                      <span className={`font-mono font-black text-xs ${count >= 2 ? 'text-rose-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {count}/2 مرات (متبقي {remaining})
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Quick Academic Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">الكورسات المشترك بها</div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {enrolledCourses.length} كورس
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">الامتحانات المنجزة</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totalExamsTaken} امتحان
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">متوسط الدرجات</div>
              <div className="text-xl sm:text-2xl font-black text-amber-500">
                {totalPercentage}%
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">امتحانات تم اجتيازها</div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                {passedCount} ناجح
              </div>
            </div>
          </div>

          {/* Student Electronic Wallet & Recharge Code Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-l from-amber-50 via-yellow-50/60 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-2 border-amber-200 dark:border-amber-500/40 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900 dark:text-white">
                    محفظتي الإلكترونية بالمنصة 💰
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                    اشحن رصيدك بكود شحن من الإدارة أو اطلب شحن حسابك مباشرة من الإدارة لشراء أي كورس فوراً
                  </p>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-950 border-2 border-amber-300 dark:border-amber-500/50 text-center shrink-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">رصيد محفظتك الحالي</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                  {localWalletBalance} ج.م
                </span>
              </div>
            </div>

            <form onSubmit={handleRedeemWalletCodeInAccount} className="flex flex-col sm:flex-row gap-2.5">
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
                <span>شحن المحفظة بالكود ⚡</span>
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
                  سجل معاملات محفظتك:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {localWalletTxs.slice(0, 6).map((tx) => (
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

          {/* ===================================================================== */}
          {/* RECHARTS STATISTICAL DASHBOARD (لوحة الإحصائيات والرسوم البيانية) */}
          {/* ===================================================================== */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  لوحة التحليل البياني والإحصاءات التعليمية للطالب 📈
                </h3>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                مدعومة بمكتبة Recharts التفاعلية
              </span>
            </div>

            {/* Grid for Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* ========================================================= */}
              {/* EXAM SCORES PROGRESSION CHART (RECHARTS) */}
              {/* ========================================================= */}
              <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <h4 className="font-black text-base text-slate-900 dark:text-white">
                        مخطط تطور درجات الطالب في الاختبارات المختلفة 📈
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تحليل بياني تفاعلي باستخدام مكتبة Recharts لتتبع مسار درجات الطالب والتحسن الأكاديمي عبر مختلف الاختبارات
                    </p>
                  </div>

                  {/* Chart Controls Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Type Toggle (Area / Composed / Bar) */}
                    <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
                      <button
                        onClick={() => setProgressionChartType('area')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          progressionChartType === 'area'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        منحنى التطور (Area)
                      </button>
                      <button
                        onClick={() => setProgressionChartType('composed')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          progressionChartType === 'composed'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        مخطط مدمج (Composed)
                      </button>
                      <button
                        onClick={() => setProgressionChartType('bar')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          progressionChartType === 'bar'
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        أعمدة مقارنة (Bar)
                      </button>
                    </div>

                    {/* Metric Mode Toggle (% vs Score) */}
                    <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
                      <button
                        onClick={() => setProgressionMetricMode('percentage')}
                        className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                          progressionMetricMode === 'percentage'
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        النسبة %
                      </button>
                      <button
                        onClick={() => setProgressionMetricMode('score')}
                        className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                          progressionMetricMode === 'score'
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        الدرجة الفعلية
                      </button>
                    </div>

                    {/* Demo / Sample Toggle */}
                    {realProgressionItems.length === 0 ? (
                      <button
                        onClick={() => setShowProgressionSample(!showProgressionSample)}
                        className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{showProgressionSample ? 'إخفاء المعاينة التوضيحية' : 'معاينة نموذج التطور'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowProgressionSample(!showProgressionSample)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                          showProgressionSample
                            ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{showProgressionSample ? 'العودة لبياناتي الفعلية' : 'نموذج دفعة 2027'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Notice when sample demo is displayed */}
                {isDisplayingSample && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        <strong>معاينة نموذج التطور الأكاديمي لدفعة 2027:</strong> هذا المخطط يوضح كيفية رصد وتتبع تطور درجاتك تلقائياً عند خوض الامتحانات التتابعية للكورسات.
                      </span>
                    </div>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('courses')}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-xs shrink-0 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                      >
                        <span>خُض أول اختبار الآن</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Subject Filter Pills (if multiple subjects exist) */}
                {availableProgressionSubjects.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                      <Filter className="w-3.5 h-3.5" />
                      <span>تصفية بالمادة:</span>
                    </span>
                    <button
                      onClick={() => setSelectedProgressionSubject('all')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        selectedProgressionSubject === 'all'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      جميع المواد ({activeProgressionItems.length})
                    </button>
                    {availableProgressionSubjects.map((subj) => (
                      <button
                        key={subj}
                        onClick={() => setSelectedProgressionSubject(subj)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          selectedProgressionSubject === subj
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                )}

                {/* KPI Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">أعلى درجة محققة 🏆</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {progressionStats.peak}%
                      </span>
                      {activeProgressionItems.length > 0 && (
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-md">
                          {progressionStats.peak >= 85 ? 'ممتاز' : progressionStats.peak >= 60 ? 'ناجح' : 'قيد التحسن'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">المعدل العام للدرجات 📊</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {progressionStats.avg}%
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        من {activeProgressionItems.length} اختبار
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">معدل التطور والتحسن 📈</div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-2xl font-black font-mono ${
                          progressionStats.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {progressionStats.delta >= 0 ? `+${progressionStats.delta}%` : `${progressionStats.delta}%`}
                      </span>
                      {progressionStats.delta >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">نسبة اجتياز الاختبارات ✅</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                        {progressionStats.passRate}%
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        ({progressionStats.passedCount} ناجح)
                      </span>
                    </div>
                  </div>
                </div>

                {/* THE RECHARTS CANVAS */}
                {rechartsProgressionData.length === 0 ? (
                  <div className="h-60 w-full rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <BarChart3 className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                      لا توجد امتحانات مسجلة في حسابك حتى الآن
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                      ستظهر درجاتك الحقيقية ومنحنى تطور مستواك هنا فور أداء وتسليم أول امتحان في الكورسات المشترك بها.
                    </p>
                  </div>
                ) : (
                <div className="h-72 sm:h-80 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    {progressionChartType === 'area' ? (
                      <AreaChart
                        data={rechartsProgressionData}
                        margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="examProgressionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.85} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          domain={progressionMetricMode === 'percentage' ? [0, 100] : ['dataMin - 5', 'dataMax + 5']}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                          unit={progressionMetricMode === 'percentage' ? '%' : ''}
                        />
                        <Tooltip content={<CustomProgressionTooltip />} />
                        {progressionMetricMode === 'percentage' && (
                          <>
                            <ReferenceLine
                              y={60}
                              stroke="#f59e0b"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{ value: 'حد النجاح (60%)', fill: '#d97706', fontSize: 10, position: 'insideTopRight' }}
                            />
                            <ReferenceLine
                              y={85}
                              stroke="#10b981"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{ value: 'مرتبة الامتياز (85%)', fill: '#059669', fontSize: 10, position: 'insideTopRight' }}
                            />
                          </>
                        )}
                        <Area
                          type="monotone"
                          dataKey={progressionMetricMode === 'percentage' ? 'النسبة_المئوية' : 'الدرجة_المحققة'}
                          name={progressionMetricMode === 'percentage' ? 'النسبة المئوية' : 'الدرجة المحققة'}
                          stroke="#4f46e5"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#examProgressionGradient)"
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#4f46e5' }}
                          activeDot={{ r: 7, strokeWidth: 2, fill: '#4f46e5', stroke: '#fff' }}
                        />
                      </AreaChart>
                    ) : progressionChartType === 'composed' ? (
                      <ComposedChart
                        data={rechartsProgressionData}
                        margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                          unit="%"
                        />
                        <Tooltip content={<CustomProgressionTooltip />} />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <ReferenceLine
                          y={60}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{ value: 'حد النجاح (60%)', fill: '#d97706', fontSize: 10, position: 'insideTopRight' }}
                        />
                        <ReferenceLine
                          y={85}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{ value: 'الامتياز (85%)', fill: '#059669', fontSize: 10, position: 'insideTopRight' }}
                        />
                        <Bar
                          dataKey="النسبة_المئوية"
                          name="النسبة المئوية (%)"
                          fill="#818cf8"
                          radius={[6, 6, 0, 0]}
                          barSize={28}
                        />
                        <Line
                          type="monotone"
                          dataKey="النسبة_المئوية"
                          name="منحنى التطور"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 5, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }}
                          activeDot={{ r: 8 }}
                        />
                      </ComposedChart>
                    ) : (
                      <BarChart
                        data={rechartsProgressionData}
                        margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis
                          domain={progressionMetricMode === 'percentage' ? [0, 100] : ['dataMin - 5', 'dataMax + 5']}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                          unit={progressionMetricMode === 'percentage' ? '%' : ''}
                        />
                        <Tooltip content={<CustomProgressionTooltip />} />
                        {progressionMetricMode === 'percentage' && (
                          <ReferenceLine
                            y={60}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ value: 'حد النجاح 60%', fill: '#d97706', fontSize: 10, position: 'insideTopRight' }}
                          />
                        )}
                        <Bar
                          dataKey={progressionMetricMode === 'percentage' ? 'النسبة_المئوية' : 'الدرجة_المحققة'}
                          name={progressionMetricMode === 'percentage' ? 'النسبة المئوية' : 'الدرجة المحققة'}
                          radius={[6, 6, 0, 0]}
                          barSize={32}
                        >
                          {rechartsProgressionData.map((entry, index) => {
                            const pct = entry.النسبة_المئوية;
                            const color = pct >= 85 ? '#10b981' : pct >= 75 ? '#6366f1' : pct >= 60 ? '#f59e0b' : '#f43f5e';
                            return <Cell key={`bar-cell-${index}`} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
                )}

                {/* Exam Breakdown List / Cards */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-600" />
                      <span>تفاصيل الاختبارات ومسار التطور الزمني</span>
                    </h5>
                    <span className="text-[10px] text-slate-400 font-medium">
                      مرتبة حسب التسلسل الزمني للاختبارات
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeProgressionItems.map((test, testIdx) => {
                      const pctColor =
                        test.percentage >= 85
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200'
                          : test.percentage >= 75
                          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200'
                          : test.percentage >= 60
                          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200'
                          : 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-200';

                      return (
                        <div
                          key={`${test.id}-${testIdx}`}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between gap-2.5 hover:shadow-xs transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  #{test.index}
                                </span>
                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                                  {test.examTitle}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                                {test.courseTitle} ({test.subject})
                              </span>
                            </div>

                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black border shrink-0 ${pctColor}`}>
                              {test.percentage}%
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  test.percentage >= 85
                                    ? 'bg-emerald-500'
                                    : test.percentage >= 75
                                    ? 'bg-indigo-600'
                                    : test.percentage >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, test.percentage))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              <span>
                                الدرجة: <strong className="text-slate-800 dark:text-slate-200">{test.score}</strong> / {test.maxScore}
                              </span>

                              {test.delta !== undefined ? (
                                <span
                                  className={`font-black flex items-center gap-0.5 ${
                                    test.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {test.delta >= 0 ? `+${test.delta}%` : `${test.delta}%`}
                                  {test.delta >= 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400">الاختبار الأول</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chart 2: Performance Levels Distribution (PieChart) */}
              <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    <span>توزيع مستويات الأداء في الامتحانات</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    نسبة الامتحانات المقسمة بحسب التقدير
                  </p>
                </div>

                <div className="h-52 w-full">
                  {performancePieData.length === 0 ? (
                    <div className="h-full w-full rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-4">
                      <PieChartIcon className="w-8 h-8 text-slate-400 mb-1.5" />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        لا توجد تقييمات مسجلة بعد
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        يتم حساب التوزيع تلقائياً بعد أداء الامتحانات
                      </span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={performancePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {performancePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '12px',
                            direction: 'rtl',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Legend Chips */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>ممتاز (85%+)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>جيد جداً (75%+)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>ناجح (60%+)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>يحتاج تدريب</span>
                  </div>
                </div>
              </div>

              {/* Chart 3: Course Progress Breakdown (BarChart) */}
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      <span>مقارنة التقدم والامتحانات المجتازة في الكورسات المشترك بها</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      مقارنة بين إجمالي الامتحانات المقررة والامتحانات التي تم اجتيازها بنجاح في كل مادة
                    </p>
                  </div>
                </div>

                {courseCompletionData.length > 0 ? (
                  <div className="h-64 sm:h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={courseCompletionData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          interval={0}
                          angle={-10}
                          textAnchor="end"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '12px',
                            direction: 'rtl',
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          verticalAlign="bottom"
                        />
                        <Bar
                          dataKey="إجمالي_الامتحانات"
                          fill="#cbd5e1"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="المجتاز_بنجاح"
                          fill="#10b981"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    لا توجد كورسات مضافة بعد لحسابك لعرض رسم المقارنة البياني.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Student Profile Data Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-indigo-600" />
              <span>بيانات الطالب واستمارة التسجيل الرسمية 2027</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">الاسم الكامل:</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">{currentUser.name}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">رقم هاتف الطالب:</span>
                <span className="font-black font-mono text-slate-900 dark:text-white" dir="ltr">{currentUser.phone}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">رقم ولي الأمر (الأب / الأم):</span>
                <span className="font-black font-mono text-amber-600 dark:text-amber-400" dir="ltr">{currentUser.parentPhone || currentUser.fatherPhone || 'غير محدد'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">الصف الدراسي:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{currentUser.schoolYear}</span>
              </div>

              {!(currentUser.schoolYear?.includes('الابتدائي') || currentUser.schoolYear?.includes('الإعدادي')) &&
                (currentUser.division || currentUser.educationSystem) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">الشعبة / نظام المرحلة الثانوية:</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">
                    {currentUser.division || currentUser.educationSystem}
                  </span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">المحافظة:</span>
                <span className="font-black text-slate-900 dark:text-white">{currentUser.governorate || 'القاهرة'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">المدرسة ونظام التعليم:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {currentUser.schoolName || (currentUser.schoolYear?.includes('الابتدائي') ? 'مدرسة ابتدائية' : currentUser.schoolYear?.includes('الإعدادي') ? 'مدرسة إعدادية' : 'مدرسة ثانوية')} ({currentUser.educationSystem || 'عام'})
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">حالة الحساب في المنصة:</span>
                <span className="font-black text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>نشط ومعتمد رسمياً</span>
                </span>
              </div>

              {/* Guardian WhatsApp Verification Row */}
              <div className="md:col-span-2 p-4 rounded-2xl bg-indigo-50/70 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                      <span>توثيق وحفظ بيانات الطالب مع ولي الأمر عبر الواتساب</span>
                      {currentUser.guardianVerified ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black border border-emerald-300">
                          موثق بنجاح ✅
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-black border border-amber-300">
                          بانتظار التحقق ⚠️
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      {currentUser.guardianVerified
                        ? `تم تأكيد رقم ولي الأمر (${currentUser.guardianVerifiedPhone || currentUser.parentPhone}) وتوثيق بيانات الطالب برمز واتساب خاص.`
                        : 'يتم إرسال رمز تحقق خاص إلى واتساب ولي الأمر لتأكيد البيانات وتفعيل المتابعة الأبوية وإخفاء شاشة التحقق.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleOpenVerifyModal}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{currentUser.guardianVerified ? 'تحديث وتأكيد رقم ولي الأمر' : 'توثيق الحساب برمز واتساب الآن 📲'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* ======================================================== */}
      {/* GUARDIAN WHATSAPP VERIFICATION MODAL */}
      {/* ======================================================== */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-lg shadow-2xl p-6 sm:p-7 relative space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    توثيق بيانات الطالب برمز واتساب لولي الأمر
                  </h3>
                  <p className="text-[11px] text-slate-500">حفظ وتأكيد الربط الأبوي الرسمي 2027</p>
                </div>
              </div>

              <button
                onClick={() => setIsVerifyModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error / Success Alerts */}
            {verifyError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
            {verifySuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{verifySuccess}</span>
              </div>
            )}

            {verifyStep === 'request' ? (
              <form onSubmit={handleSendVerifyOtp} className="space-y-4 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 text-xs space-y-1.5">
                  <p className="text-emerald-900 dark:text-emerald-300 font-medium leading-relaxed">
                    سترسل المنصة رمز تحقق خاص (OTP) إلى واتساب ولي الأمر لحفظ وتوثيق بيانات الطالب <strong>({currentUser.name})</strong>، وعند إدخال الرمز وتطبيقه يتم إخفاء هذه النافذة فوراً وتأكيد الحساب.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    رقم هاتف ولي الأمر (واتساب):
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={verifyPhone}
                      onChange={(e) => setVerifyPhone(e.target.value)}
                      placeholder="010XXXXXXXX أو 011XXXXXXXX"
                      className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-left bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                    />
                    <Phone className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsVerifyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifySubmitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    {isVerifySubmitting ? (
                      <span>جاري الإرسال...</span>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" />
                        <span>إرسال رمز التحقق لواتساب ولي الأمر 💬</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmVerifyOtp} className="space-y-4 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 text-xs space-y-1 text-right">
                  <div className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>تم إرسال رمز التحقق لواتساب ولي الأمر بنجاح!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300">
                    الرمز أُرسل إلى: <strong className="font-mono" dir="ltr">{verifyMaskedPhone}</strong>
                  </p>
                </div>

                {verifyDirectUrl && (
                  <a
                    href={verifyDirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4 fill-white/20" />
                    <span>فتح محادثة واتساب لرؤية الرمز مباشرة 💬</span>
                  </a>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    أدخل رمز التحقق (OTP) المكون من 6 أرقام:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full pl-4 pr-10 py-3 rounded-2xl border-2 border-emerald-500 text-center tracking-[0.5em] text-lg font-black font-mono focus:outline-none focus:ring-4 focus:ring-emerald-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      dir="ltr"
                      autoFocus
                    />
                    <KeyRound className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    disabled={verifyCooldown > 0 || isVerifySubmitting}
                    onClick={handleSendVerifyOtp}
                    className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {verifyCooldown > 0
                        ? `إعادة الإرسال بعد (${verifyCooldown} ثانية)`
                        : 'إعادة إرسال الرمز'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyStep('request')}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer"
                  >
                    ← تغيير الرقم
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isVerifySubmitting || verifyCode.length < 4}
                  className="w-full py-3.5 rounded-2xl text-slate-950 font-black text-sm bg-emerald-400 hover:bg-emerald-500 active:scale-[0.99] shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isVerifySubmitting ? (
                    <span>جاري تطبيق الرمز...</span>
                  ) : (
                    <>
                      <span>تطبيق الرمز وحفظ وتوثيق بيانات الطالب 🚀</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
