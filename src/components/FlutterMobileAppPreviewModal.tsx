import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Play,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  Award,
  Wallet,
  Menu,
  ChevronRight,
  RefreshCw,
  Code2,
  Copy,
  Check,
  Download,
  AlertCircle,
  ExternalLink,
  Sliders,
  Layers
} from 'lucide-react';
import { User } from '../types';

interface FlutterMobileAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const FlutterMobileAppPreviewModal: React.FC<FlutterMobileAppPreviewModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'api'>('preview');
  const [currentScreen, setCurrentScreen] = useState<'home' | 'courses' | 'video' | 'exam' | 'wallet'>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Mobile Dashboard Data fetched from /api/mobile/dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [videoProgress, setVideoProgress] = useState(120);
  const [examAnswers, setExamAnswers] = useState<Record<string, any>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);

  // Fetch real mobile dashboard on modal open
  const fetchMobileDashboard = async () => {
    setIsLoading(true);
    try {
      const studentId = currentUser?.id || 'demo_student_2027';
      const res = await fetch(`/api/mobile/dashboard?studentId=${encodeURIComponent(studentId)}`, {
        headers: { 'x-student-id': studentId }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        if (data.lastLesson) {
          setVideoProgress(data.lastLesson.positionSeconds || 120);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch mobile dashboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMobileDashboard();
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Real-time API: Update Video Progress
  const handleUpdateProgress = async (newPos: number, completed = false) => {
    setVideoProgress(newPos);
    if (!dashboardData?.lastLesson) return;
    try {
      await fetch('/api/mobile/progress/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser?.id || 'demo_student_2027',
          courseId: dashboardData.lastLesson.courseId,
          lessonId: dashboardData.lastLesson.lessonId,
          videoId: dashboardData.lastLesson.videoId,
          positionSeconds: newPos,
          durationSeconds: dashboardData.lastLesson.durationSeconds || 1800,
          completed,
        }),
      });
    } catch {}
  };

  // Real-time API: Submit Exam
  const handleSubmitExam = async () => {
    setIsSubmittingExam(true);
    try {
      const examId = selectedExam?.id || 'exam_unit1_history';
      const courseId = selectedExam?.courseId || dashboardData?.lastLesson?.courseId || 'course-1792304762232';
      const res = await fetch('/api/mobile/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser?.id || 'demo_student_2027',
          examId,
          courseId,
          answers: examAnswers,
          timeSpentSeconds: 145,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setExamResult(result);
        // Refresh dashboard so the score appears on the mobile home screen immediately
        fetchMobileDashboard();
      }
    } catch (e) {
      alert('فشل تسليم الامتحان');
    } finally {
      setIsSubmittingExam(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const lastLesson = dashboardData?.lastLesson;
  const enrolledCourses = dashboardData?.enrolledCourses || [];
  const stats = dashboardData?.stats || { enrolledCoursesCount: 1, completedExamsCount: 1, walletBalance: 50 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">تطبيق الهاتف الذكي (Flutter Android & iOS)</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  واجهة داكنة متصلة بقاعدة البيانات
                </span>
              </div>
              <p className="text-xs text-slate-400">
                تصميم مختلف كلياً عن الويب، يركز على آخر درس توقف عنده الطالب مع مزامنة الدرجات والتقدم في الوقت الفعلي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-800 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>محاكي التطبيق</span>
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'code' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>أكواد Flutter (Dart)</span>
              </button>
              <button
                onClick={() => setActiveTab('api')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'api' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>واجهات الربط (REST APIs)</span>
              </button>
            </div>

            <a
              href="https://raw.githubusercontent.com/hos098sam-jpg/x3bb48b-c76c300b/main/flutter_app.zip"
              target="_blank"
              rel="noopener noreferrer"
              download="qalbalelm_flutter_app.zip"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="تحميل كود تطبيق Flutter بالكامل (ZIP)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تحميل كود التطبيق (ZIP)</span>
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex items-center justify-center">
          
          {/* TAB 1: PHONE PREVIEW SIMULATOR */}
          {activeTab === 'preview' && (
            <div className="w-full max-w-sm h-[720px] bg-[#0A0E17] rounded-[42px] border-[8px] border-slate-800 shadow-2xl overflow-hidden flex flex-col relative select-none">
              
              {/* Phone Status Bar */}
              <div className="h-7 bg-[#0F141C] flex items-center justify-between px-6 text-[10px] text-slate-400 border-b border-slate-800/80">
                <span>9:41</span>
                <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto" />
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* App Top Bar */}
              <div className="h-14 bg-[#0F141C] flex items-center justify-between px-4 border-b border-slate-800/80 z-20">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDrawerOpen(!drawerOpen)}
                    className="p-1.5 rounded-lg bg-slate-800/60 text-emerald-400 hover:bg-slate-800"
                    title="القائمة الجانبية السريعة"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                  <span className="font-black text-sm text-white tracking-tight">منصة المتفلسفة </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={fetchMobileDashboard}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    title="تحديث البيانات"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    2027
                  </span>
                </div>
              </div>

              {/* Quick Side Drawer Overlay */}
              {drawerOpen && (
                <div className="absolute inset-0 z-30 flex">
                  <div className="w-64 h-full bg-[#0F141C] border-l border-slate-800 flex flex-col p-4 animate-in slide-in-from-right duration-200 shadow-2xl">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {currentUser?.name?.[0] || 'ط'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[120px]">{currentUser?.name || 'طالب المنصة'}</p>
                          <p className="text-[10px] text-amber-400 font-medium">الرصيد: {stats.walletBalance} ج.م</p>
                        </div>
                      </div>
                      <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 space-y-1 text-xs">
                      <button
                        onClick={() => { setCurrentScreen('home'); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-right font-medium transition-all ${
                          currentScreen === 'home' ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        <span>الرئيسية (متابعة الدروس)</span>
                      </button>
                      <button
                        onClick={() => { setCurrentScreen('courses'); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-right font-medium transition-all ${
                          currentScreen === 'courses' ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        <span>كورساتي والمحاضرات</span>
                      </button>
                      <button
                        onClick={() => { setCurrentScreen('exam'); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-right font-medium transition-all ${
                          currentScreen === 'exam' ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Award className="w-4 h-4" />
                        <span>الامتحانات والنتائج الفورية</span>
                      </button>
                      <button
                        onClick={() => { setCurrentScreen('wallet'); setDrawerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-right font-medium transition-all ${
                          currentScreen === 'wallet' ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Wallet className="w-4 h-4" />
                        <span>محفظتي وشحن الأكواد</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                      <p className="text-emerald-400 font-bold mb-1">دعم واتساب المعلم</p>
                      <p className="text-[10px]">01040672314</p>
                    </div>
                  </div>
                  <div className="flex-1 bg-black/60" onClick={() => setDrawerOpen(false)} />
                </div>
              )}

              {/* Scrollable Screens Viewport */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                
                {/* 1. HOME SCREEN */}
                {currentScreen === 'home' && (
                  <>
                    {/* Welcome line */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-slate-400">مرحباً بك 👋</p>
                        <p className="text-xs font-bold text-white">{currentUser?.name || 'عزيزي الطالب'}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        الدفعة الرسمية
                      </span>
                    </div>

                    {/* HERO CARD: FOCUS ON LAST RESUMED LESSON (User's primary requirement) */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A2333] to-[#111723] border border-emerald-500/30 p-3.5 shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <RotateCcw className="w-3 h-3" />
                          آخر درس توقفت عنده
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {Math.round(((videoProgress || 120) / (lastLesson?.durationSeconds || 1800)) * 100)}% منجز
                        </span>
                      </div>

                      <p className="text-[11px] text-cyan-400 font-bold">{lastLesson?.subject || 'التاريخ الوطني'}</p>
                      <h4 className="text-xs font-bold text-white mt-0.5 line-clamp-1">
                        {lastLesson?.videoTitle || 'شرح الفصل الأول - أحداث ثورة 1919'}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {lastLesson?.lessonTitle || 'الدرس الأول: العوامل والمقدمات'}
                      </p>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round(((videoProgress || 120) / (lastLesson?.durationSeconds || 1800)) * 100))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
                        <span>{Math.floor(videoProgress / 60)}:{(videoProgress % 60).toString().padStart(2, '0')}</span>
                        <span>{Math.floor((lastLesson?.durationSeconds || 1800) / 60)}:00</span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedVideo(lastLesson || {
                            videoTitle: 'شرح الفصل الأول - أحداث ثورة 1919',
                            courseTitle: 'التاريخ الوطني',
                            lessonTitle: 'الدرس الأول: العوامل والمقدمات',
                            durationSeconds: 1800,
                          });
                          setCurrentScreen('video');
                        }}
                        className="w-full mt-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>استئناف الدرس الآن</span>
                      </button>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-xl bg-[#121824] border border-slate-800 text-center">
                        <p className="text-xs font-black text-emerald-400">{stats.enrolledCoursesCount || 1}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">كورسات مفعلة</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#121824] border border-slate-800 text-center">
                        <p className="text-xs font-black text-cyan-400">{stats.completedExamsCount || 1}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">امتحانات مكتملة</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#121824] border border-slate-800 text-center">
                        <p className="text-xs font-black text-amber-400">{stats.walletBalance || 50} ج.م</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">رصيد المحفظة</p>
                      </div>
                    </div>

                    {/* Enrolled Courses list */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">كورساتي المفعلة</span>
                        <button onClick={() => setCurrentScreen('courses')} className="text-[10px] text-emerald-400">
                          عرض الكل
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(enrolledCourses.length > 0 ? enrolledCourses : [
                          { id: 'c1', title: 'التاريخ الوطني لدفعة 2027', subject: 'تاريخ', lessonsCount: 4 }
                        ]).map((c: any, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setCurrentScreen('courses')}
                            className="p-2.5 rounded-xl bg-[#121824] border border-slate-800 hover:border-emerald-500/40 cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold">
                                📖
                              </div>
                              <div>
                                <p className="text-[11px] font-bold text-white line-clamp-1">{c.title}</p>
                                <p className="text-[9px] text-slate-400">{c.subject} • {c.lessonsCount} دروس</p>
                              </div>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Take Quiz shortcut */}
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-cyan-300">اختبار تجريبي فوري</p>
                        <p className="text-[10px] text-slate-400">حل الاختبار وتظهر نتيجتك في الموقع فوراً</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedExam({
                            id: 'exam_history_unit1',
                            title: 'اختبار الفصل الأول في مادة التاريخ',
                            courseId: 'course-1792304762232',
                            questions: [
                              {
                                id: 'q1',
                                question: 'ما هو الهدف الأساسي من تأليف الوفد المصري برئاسة سعد زغلول عام 1919؟',
                                options: ['السفر إلى باريس لعرض قضية الاستقلال', 'المطالبة بتعيين حكومة جديدة', 'إلغاء الأحكام العرفية فقط', 'تأسيس بنك مصر'],
                                correctAnswer: 'السفر إلى باريس لعرض قضية الاستقلال',
                                points: 10
                              },
                              {
                                id: 'q2',
                                question: 'ترتب على تصريح 28 فبراير 1922 إعلان مصر دولة مستقلة ذات سيادة مع تحفظات أربعة.',
                                options: ['صحيح', 'خطأ'],
                                correctAnswer: 'صحيح',
                                points: 10
                              }
                            ]
                          });
                          setExamResult(null);
                          setCurrentScreen('exam');
                        }}
                        className="px-2.5 py-1 bg-cyan-500 text-black text-[10px] font-bold rounded-lg hover:bg-cyan-400"
                      >
                        بدء الاختبار
                      </button>
                    </div>
                  </>
                )}

                {/* 2. COURSES SCREEN */}
                {currentScreen === 'courses' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentScreen('home')} className="text-slate-400 hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <h4 className="text-xs font-bold text-white">كافة الكورسات والمحاضرات</h4>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#121824] border border-emerald-500/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">تاريخ</span>
                        <span className="text-[10px] font-bold text-cyan-400">مفعل بحسابك</span>
                      </div>
                      <p className="text-xs font-bold text-white mt-1">التاريخ الوطني لدفعة 2027</p>
                      <p className="text-[10px] text-slate-400 mt-1">منهج متكامل وفق أحدث المعايير الوزارية والأسئلة الاستنتاجية.</p>
                      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">3 فيديوهات متوفرة</span>
                        <button
                          onClick={() => {
                            setSelectedVideo({
                              videoTitle: 'شرح الفصل الأول - أحداث ثورة 1919',
                              courseTitle: 'التاريخ الوطني',
                              lessonTitle: 'الدرس الأول',
                              durationSeconds: 1800,
                            });
                            setCurrentScreen('video');
                          }}
                          className="px-2.5 py-1 bg-emerald-500 text-black font-bold rounded-lg"
                        >
                          مشاهدة المحاضرة
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. VIDEO PLAYER SCREEN */}
                {currentScreen === 'video' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentScreen('home')} className="text-slate-400 hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <h4 className="text-xs font-bold text-white truncate">{selectedVideo?.videoTitle || 'مشغل المحاضرة'}</h4>
                    </div>

                    {/* Simulated Player Box */}
                    <div className="w-full h-44 bg-black rounded-2xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400 mb-2 animate-pulse">
                        <Play className="w-6 h-6 fill-emerald-400" />
                      </div>
                      <p className="text-[11px] text-slate-300 font-bold">جارِ التشغيل بجودة HD</p>
                      <p className="text-[9px] text-emerald-400 mt-0.5">موضع المشاهدة يتزامن تلقائياً مع السيرفر</p>

                      {/* Scrub bar */}
                      <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 font-mono">
                          {Math.floor(videoProgress / 60)}:{(videoProgress % 60).toString().padStart(2, '0')}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max={selectedVideo?.durationSeconds || 1800}
                          value={videoProgress}
                          onChange={(e) => handleUpdateProgress(Number(e.target.value))}
                          className="flex-1 h-1 bg-slate-700 accent-emerald-500 rounded-lg cursor-pointer"
                        />
                        <span className="text-[9px] text-slate-400 font-mono">30:00</span>
                      </div>
                    </div>

                    {/* Fast sync buttons to test */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateProgress(videoProgress + 60)}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg text-center"
                      >
                        تقديم 1 دقيقة ومزامنة
                      </button>
                      <button
                        onClick={() => handleUpdateProgress(selectedVideo?.durationSeconds || 1800, true)}
                        className="flex-1 py-1.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-lg text-center border border-emerald-500/30"
                      >
                        إتمام مشاهدة الدرس
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-[#121824] border border-slate-800 text-[11px] space-y-1">
                      <p className="text-white font-bold">{selectedVideo?.videoTitle}</p>
                      <p className="text-slate-400">{selectedVideo?.courseTitle} • {selectedVideo?.lessonTitle}</p>
                    </div>
                  </div>
                )}

                {/* 4. EXAM SCREEN */}
                {currentScreen === 'exam' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentScreen('home')} className="text-slate-400 hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <h4 className="text-xs font-bold text-white truncate">{selectedExam?.title || 'امتحان تفاعلي'}</h4>
                    </div>

                    {examResult ? (
                      <div className="p-4 rounded-2xl bg-[#121824] border border-emerald-500/40 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-bold text-white">تم تصحيح الامتحان وحفظه في لوحة الموقع!</h4>
                        <p className="text-[10px] text-slate-400">
                          الدرجة المحققة: <span className="font-bold text-emerald-400">{examResult.score}</span> من {examResult.totalMarks} ({examResult.percentage}%)
                        </p>
                        <button
                          onClick={() => { setExamResult(null); setCurrentScreen('home'); }}
                          className="w-full py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl"
                        >
                          العودة للرئيسية
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(selectedExam?.questions || []).map((q: any, qIdx: number) => (
                          <div key={q.id || qIdx} className="p-3 rounded-xl bg-[#121824] border border-slate-800 space-y-2">
                            <p className="text-[11px] font-bold text-white">{qIdx + 1}. {q.question}</p>
                            <div className="space-y-1.5">
                              {q.options.map((opt: string, optIdx: number) => {
                                const isSelected = examAnswers[q.id || `q_${qIdx}`] === opt;
                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => setExamAnswers({ ...examAnswers, [q.id || `q_${qIdx}`]: opt })}
                                    className={`w-full text-right p-2 rounded-lg text-[10px] border transition-all ${
                                      isSelected
                                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                                        : 'bg-[#0A0E17] border-slate-800 text-slate-300 hover:bg-slate-800'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <button
                          disabled={isSubmittingExam}
                          onClick={handleSubmitExam}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                          {isSubmittingExam ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          <span>إرسال الإجابات وحفظ النتيجة في لوحة التحكم</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. WALLET SCREEN */}
                {currentScreen === 'wallet' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentScreen('home')} className="text-slate-400 hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <h4 className="text-xs font-bold text-white">محفظة الطالب</h4>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 to-[#121824] border border-amber-500/30 text-center">
                      <p className="text-[10px] text-slate-400">الرصيد المتاح</p>
                      <h3 className="text-xl font-black text-amber-400 mt-1">{stats.walletBalance || 50} ج.م</h3>
                    </div>

                    <div className="p-3 rounded-xl bg-[#121824] border border-slate-800 space-y-2">
                      <p className="text-xs font-bold text-white">شحن كود المحاضرة</p>
                      <input
                        placeholder="أدخل كود الشحن..."
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-lg p-2 text-xs text-white"
                      />
                      <button
                        onClick={() => alert('تم إرسال كود الشحن للمراجعة والإيداع')}
                        className="w-full py-1.5 bg-emerald-500 text-black font-bold text-xs rounded-lg"
                      >
                        تأكيد الشحن
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Navigation Bar */}
              <div className="h-14 bg-[#0F141C] border-t border-slate-800 flex items-center justify-around px-2 text-[10px] text-slate-400 z-20">
                <button
                  onClick={() => setCurrentScreen('home')}
                  className={`flex flex-col items-center gap-0.5 ${currentScreen === 'home' ? 'text-emerald-400 font-bold' : ''}`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>الرئيسية</span>
                </button>
                <button
                  onClick={() => setCurrentScreen('courses')}
                  className={`flex flex-col items-center gap-0.5 ${currentScreen === 'courses' ? 'text-emerald-400 font-bold' : ''}`}
                >
                  <Layers className="w-4 h-4" />
                  <span>الكورسات</span>
                </button>
                <button
                  onClick={() => setCurrentScreen('exam')}
                  className={`flex flex-col items-center gap-0.5 ${currentScreen === 'exam' ? 'text-emerald-400 font-bold' : ''}`}
                >
                  <Award className="w-4 h-4" />
                  <span>الامتحانات</span>
                </button>
                <button
                  onClick={() => setCurrentScreen('wallet')}
                  className={`flex flex-col items-center gap-0.5 ${currentScreen === 'wallet' ? 'text-emerald-400 font-bold' : ''}`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>المحفظة</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: FLUTTER CODE VIEWER */}
          {activeTab === 'code' && (
            <div className="w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400">ملفات مشروع Flutter المنشأ</span>
                  <span className="text-[11px] text-slate-400">المسار: /flutter_app/</span>
                </div>
                <button
                  onClick={() => copyCode(`cd flutter_app\nflutter pub get\nflutter run`)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'تم النسخ!' : 'نسخ أوامر التشغيل'}</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-300 space-y-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <p className="text-emerald-400 font-bold mb-1">// هيكل المشروع المكتمل:</p>
                  <p>flutter_app/</p>
                  <p>├── pubspec.yaml</p>
                  <p>├── README.md (دليل التشغيل والبناء)</p>
                  <p>└── lib/</p>
                  <p>    ├── main.dart (الثيم الداكن والمسارات ودعم اللغة العربية)</p>
                  <p>    ├── config/api_config.dart (عناوين خادم المنصة)</p>
                  <p>    ├── models/student_model.dart (نماذج بيانات الطالب والدروس)</p>
                  <p>    ├── services/api_service.dart (خدمة الاتصال المباشر بالسيرفر)</p>
                  <p>    ├── widgets/quick_drawer.dart (القائمة الجانبية السريعة الداكنة)</p>
                  <p>    └── screens/</p>
                  <p>        ├── home_screen.dart (التركيز على آخر درس توقف عنده الطالب)</p>
                  <p>        ├── login_screen.dart (شاشة تسجيل الدخول وربط الأجهزة)</p>
                  <p>        ├── courses_screen.dart (استعراض الكورسات والمحاضرات)</p>
                  <p>        ├── course_details_screen.dart (تفاصيل الدروس والفيديوهات)</p>
                  <p>        ├── video_player_screen.dart (مشغل الفيديو ومزامنة التقدم)</p>
                  <p>        ├── exam_screen.dart (حل الامتحانات وتصحيحها فورياً)</p>
                  <p>        └── wallet_screen.dart (المحفظة وشحن الأكواد)</p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <p className="text-cyan-400 font-bold mb-1">// أوامر تشغيل وبناء ملف APK:</p>
                  <p className="text-slate-200"># 1. التوجه لمجلد التطبيق</p>
                  <p className="text-emerald-400">cd flutter_app</p>
                  <p className="text-slate-200 mt-2"># 2. تحميل الحزم</p>
                  <p className="text-emerald-400">flutter pub get</p>
                  <p className="text-slate-200 mt-2"># 3. تشغيل على المحاكي أو الهاتف</p>
                  <p className="text-emerald-400">flutter run</p>
                  <p className="text-slate-200 mt-2"># 4. بناء ملف APK النهائي</p>
                  <p className="text-emerald-400">flutter build apk --release</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REST APIS LIST */}
          {activeTab === 'api' && (
            <div className="w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 space-y-3">
              <h4 className="text-sm font-bold text-white">واجهات الربط (REST APIs) المدمجة مع قاعدة بيانات المنصة:</h4>
              
              <div className="space-y-2 overflow-y-auto pr-1">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 mr-2">POST</span>
                    <span className="font-mono text-xs text-white">/api/mobile/login</span>
                    <p className="text-[11px] text-slate-400 mt-1">تسجيل دخول الطالب والتحقق من كلمة المرور وربط الجهاز المعتمد</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">نشط ومفعل</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 mr-2">GET</span>
                    <span className="font-mono text-xs text-white">/api/mobile/dashboard</span>
                    <p className="text-[11px] text-slate-400 mt-1">جلب آخر درس توقف عنده الطالب مع التوقيت والنسبة، والكورسات المفعلة</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">نشط ومفعل</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 mr-2">POST</span>
                    <span className="font-mono text-xs text-white">/api/mobile/progress/update</span>
                    <p className="text-[11px] text-slate-400 mt-1">تحديث موضع ونسبة مشاهدة الفيديو في قاعدة البيانات وسجل الطالب</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">نشط ومفعل</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 mr-2">POST</span>
                    <span className="font-mono text-xs text-white">/api/mobile/exams/submit</span>
                    <p className="text-[11px] text-slate-400 mt-1">تصحيح الامتحان وحفظ النتيجة في لوحة تحكم المعلم وقاعدة بيانات الموقع فوراً</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">نشط ومفعل</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
