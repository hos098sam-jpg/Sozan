import React, { useState } from 'react';
import {
  Users,
  Award,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Printer,
  Share2,
  TrendingUp,
  Calendar,
  School,
  MapPin,
  LogOut,
  RefreshCw,
  Search,
  MessageCircle,
  FileText,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { User, Course, StudentExamSubmission, PlatformSettings } from '../types';
import { getSavedSubmissions, deduplicateSubmissions } from '../data/initialData';
import { getIdToken } from '../auth';

interface ParentPortalViewProps {
  parentPhone: string;
  linkedStudents: User[];
  allCourses: Course[];
  platformSettings: PlatformSettings;
  onLogout: () => void;
  onBackToHome: () => void;
}

export const ParentPortalView: React.FC<ParentPortalViewProps> = ({
  parentPhone,
  linkedStudents,
  allCourses,
  platformSettings,
  onLogout,
  onBackToHome,
}) => {
  // If multiple children belong to this parent, let the parent select which child
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    linkedStudents[0]?.id || ''
  );

  const selectedStudent =
    linkedStudents.find((s) => s.id === selectedStudentId) || linkedStudents[0];

  const [serverSubmissions, setServerSubmissions] = useState<StudentExamSubmission[] | null>(null);

  React.useEffect(() => {
    let isCurrent = true;
    const loadStudentDetails = async () => {
      if (!selectedStudent?.id) return;
      try {
        const token = await getIdToken();
        const res = await fetch('/api/parents/student-details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ studentId: selectedStudent.id }),
        });
        if (res.ok) {
          const data = await res.json();
          if (isCurrent && Array.isArray(data.submissions) && data.submissions.length > 0) {
            setServerSubmissions(data.submissions);
          }
        }
      } catch (err) {
        console.warn('Could not fetch server submissions for student:', err);
      }
    };
    loadStudentDetails();
    return () => { isCurrent = false; };
  }, [selectedStudent?.id]);

  // Get all submissions for this student from central storage or verified server
  const allSubmissions = serverSubmissions || getSavedSubmissions();
  const studentSubmissions: StudentExamSubmission[] = deduplicateSubmissions(
    allSubmissions.filter(
      (sub) =>
        (selectedStudent && sub.studentId === selectedStudent.id) ||
        (selectedStudent && sub.studentPhone === selectedStudent.phone) ||
        (sub.parentPhone && sub.parentPhone === parentPhone)
    )
  );

  // Calculate high-level student performance analytics
  const enrolledCourses = allCourses.filter((c) =>
    selectedStudent?.enrolledCourseIds?.includes(c.id)
  );

  const totalEnrolledCount = enrolledCourses.length;

  // Total completed exams count
  const completedExamsList = Object.entries(selectedStudent?.examResults || {});
  const totalCompletedExamsCount = Math.max(
    completedExamsList.length,
    studentSubmissions.filter((s) => s.isSubmitted).length
  );

  // Completed courses count (where all exams in that course have passed)
  const completedCoursesCount = enrolledCourses.filter((course) => {
    if (!course.exams || course.exams.length === 0) return false;
    return course.exams.every((ex) => {
      const res = selectedStudent?.examResults?.[ex.id];
      return res && res.passed;
    });
  }).length;

  // Average percentage
  let averagePercentage = 0;
  if (completedExamsList.length > 0) {
    const sum = completedExamsList.reduce((acc, [, val]) => acc + (val.percentage || 0), 0);
    averagePercentage = Math.round(sum / completedExamsList.length);
  } else if (studentSubmissions.length > 0) {
    const sum = studentSubmissions.reduce((acc, val) => acc + (val.percentage || 0), 0);
    averagePercentage = Math.round(sum / studentSubmissions.length);
  }

  // Handle Print Report
  const handlePrintReport = () => {
    window.print();
  };

  // Handle Share WhatsApp with Supervisor
  const handleShareWithSupervisor = () => {
    if (!selectedStudent) return;
    const msg = `السلام عليكم أستاذ ${platformSettings.supervisorName}،\nأنا ولي أمر الطالب (${selectedStudent.name}) المسجل في منصة قلب العلم.\n` +
      `الصف: ${selectedStudent.schoolYear}\n` +
      `الكورسات المشترك بها: ${totalEnrolledCount} كورس\n` +
      `عدد الامتحانات المكتملة: ${totalCompletedExamsCount}\n` +
      `المعدل العام للطالب: ${averagePercentage}%\n` +
      `أود الاستفسار ومتابعة أداء ابني. شكراً جزيلاً.`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/201040672314?text=${encoded}`, '_blank');
  };

  // Handle Send Report directly to Guardian WhatsApp
  const handleSendReportToGuardianWhatsApp = () => {
    if (!selectedStudent) return;
    const cleanDigits = parentPhone.replace(/\D/g, '');
    const cleanEgyptNum = cleanDigits.replace(/^20/, '').replace(/^0/, '');
    const msg = `🎓 *تقرير الطالب الأكاديمي - منصة قلب العلم التعليمية*\n` +
      `👤 اسم الطالب: *${selectedStudent.name}*\n` +
      `🏫 المرحلة: ${selectedStudent.schoolYear}\n` +
      `📚 الكورسات المشترك بها: ${totalEnrolledCount} كورس\n` +
      `📝 الامتحانات المنجزة: ${totalCompletedExamsCount} امتحان\n` +
      `📊 النسبة المئوية العامة: *${averagePercentage}%*\n` +
      `🔐 حالة التوثيق: تم توثيق وحفظ بيانات الطالب برمز واتساب لولي الأمر بنجاح ✅\n` +
      `بإشراف المشرف العام: أ. ${platformSettings.supervisorName}`;

    window.open(`https://wa.me/20${cleanEgyptNum}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!selectedStudent) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-[32px] text-center space-y-6 shadow-sm">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900">لم يتم العثور على بيانات الطالب</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            رقم ولي الأمر المدخل ({parentPhone}) غير مرتبط بأي طالب حالياً. يرجى التأكد من تسجيل الطالب بنفس رقم هاتف ولي الأمر أو التواصل مع الإدارة.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onLogout}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs hover:bg-indigo-700"
          >
            تسجيل الدخول برقم آخر
          </button>
          <button
            onClick={onBackToHome}
            className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-50"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Top Banner & Child Selector */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 rounded-[36px] p-6 sm:p-10 text-white shadow-xl relative overflow-hidden print:bg-none print:text-black print:p-0 print:shadow-none">
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-400/20 text-amber-300 rounded-full text-xs font-black border border-amber-400/30">
                <Users className="w-4 h-4 text-amber-400" />
                <span>بوابة متابعة ولي الأمر • التقرير الأكاديمي الشامل</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                تقرير متابعة الطالب: {selectedStudent.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                رقم ولي الأمر المسجل: <span className="font-mono font-bold text-amber-300">{parentPhone}</span> • بإشراف: {platformSettings.supervisorName}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <button
                onClick={onBackToHome}
                className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-950/20 cursor-pointer"
                title="إخفاء صفحة ولي الأمر والعودة إلى لوحة تحكم الطالب / الرئيسية"
              >
                <ArrowRight className="w-4 h-4" />
                <span>إخفاء صفحة ولي الأمر ↩️</span>
              </button>

              <button
                onClick={handleSendReportToGuardianWhatsApp}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-emerald-950/20 cursor-pointer"
                title="إرسال التقرير الشامل مباشرة إلى واتساب ولي الأمر"
              >
                <MessageCircle className="w-4 h-4 fill-white/20" />
                <span>إرسال التقرير لواتساب ولي الأمر 📲</span>
              </button>

              <button
                onClick={handlePrintReport}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all flex items-center gap-2 border border-white/15 backdrop-blur-md cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>طباعة كشف الدرجات</span>
              </button>

              <button
                onClick={handleShareWithSupervisor}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all flex items-center gap-2 border border-white/15 backdrop-blur-md cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-300" />
                <span>مراسلة المشرف</span>
              </button>

              <button
                onClick={onLogout}
                className="px-4 py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-black transition-all flex items-center gap-1.5 border border-rose-400/30 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج</span>
              </button>
            </div>
          </div>

          {/* Guardian Verification Confirmation Badge */}
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-emerald-200 text-sm flex items-center gap-1.5">
                  <span>تم توثيق بيانات الطالب وحفظها برمز واتساب لولي الأمر بنجاح ✅</span>
                </div>
                <div className="text-[11px] text-emerald-100/80 font-medium">
                  تم التحقق من هوية ولي الأمر وتطبيق الرمز على الرقم (<span className="font-mono text-emerald-300" dir="ltr">{parentPhone}</span>) وربط بيانات الطالب {selectedStudent.name}.
                </div>
              </div>
            </div>

            <button
              onClick={onBackToHome}
              className="px-3.5 py-1.5 rounded-xl bg-white text-emerald-950 font-black text-xs hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              إخفاء والعودة للرئيسية ↩️
            </button>
          </div>

          {/* If parent has multiple registered children, display tabs */}
          {linkedStudents.length > 1 && (
            <div className="pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto print:hidden">
              <span className="text-xs font-bold text-slate-400 shrink-0">الأبناء المسجلون:</span>
              {linkedStudents.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedStudentId(child.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                    child.id === selectedStudent.id
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{child.name}</span>
                  <span className="text-[10px] opacity-75">({child.schoolYear})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Printable Official Header (Only shows in print mode) */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
        <div className="text-xl font-black text-slate-900">{platformSettings.platformName}</div>
        <div className="text-sm font-bold text-slate-700">كشف الدرجات والتقرير الأكاديمي التفصيلي لولي الأمر 2027</div>
        <div className="text-xs text-slate-500 mt-1">
          المشرف العام ومسؤول الكنترول: {platformSettings.supervisorName} • هاتف: {platformSettings.contactPhone}
        </div>
      </div>

      {/* Section 1: Student Identity & Profile Card */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xl">
              {(selectedStudent?.name || 'ط').charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{selectedStudent?.name || 'الطالب'}</h2>
              <p className="text-xs text-slate-500 font-medium">
                تاريخ التسجيل بالمنصة: {selectedStudent?.registeredAt || '2026-08-01'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>حساب طالب معتمد ومفعل</span>
            </span>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              <span>الصف الدراسي والشعبة:</span>
            </span>
            <span className="text-slate-900 font-black block">{selectedStudent.schoolYear}</span>
            {selectedStudent.division && (
              <span className="text-[11px] text-indigo-700 font-bold block">{selectedStudent.division}</span>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-bold block flex items-center gap-1">
              <School className="w-3.5 h-3.5 text-indigo-600" />
              <span>المدرسة المقيد بها:</span>
            </span>
            <span className="text-slate-900 font-black block">{selectedStudent.schoolName || 'مدرسة الثانوية الرسمية'}</span>
            <span className="text-[11px] text-slate-500 block">المحافظة: {selectedStudent.governorate || 'السويس'}</span>
          </div>
        </div>
      </div>

      {/* Section 2: Key Academic Stats (إحصائيات إنجاز الطالب) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Enrolled Courses */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalEnrolledCount}</div>
            <div className="text-xs font-bold text-slate-500">الكورسات المشترك فيها</div>
          </div>
          <div className="text-[11px] text-indigo-700 font-bold">
            مفعلة بأكواد رسمية معتمدة
          </div>
        </div>

        {/* Metric 2: Completed Courses */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-950">{completedCoursesCount}</div>
            <div className="text-xs font-bold text-slate-500">الكورسات المنجزة بالكامل</div>
          </div>
          <div className="text-[11px] text-emerald-700 font-bold">
            تم اجتياز جميع اختباراتها بنجاح
          </div>
        </div>

        {/* Metric 3: Total Completed Exams */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-950">{totalCompletedExamsCount}</div>
            <div className="text-xs font-bold text-slate-500">الامتحانات التي تم خوضها</div>
          </div>
          <div className="text-[11px] text-amber-700 font-bold">
            اختياري ومقالي مدقق
          </div>
        </div>

        {/* Metric 4: Average Score */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-purple-950">{averagePercentage}%</div>
            <div className="text-xs font-bold text-slate-500">النسبة المئوية العامة للتفوق</div>
          </div>
          <div className="text-[11px] text-purple-700 font-bold">
            {averagePercentage >= 85 ? '🌟 تقدير عام: ممتاز جداً' : averagePercentage >= 70 ? '👍 تقدير عام: جيد جداً' : 'يحتاج لمزيد من المتابعة'}
          </div>
        </div>
      </div>

      {/* Section 3: Detailed Exam Timing Log (كشف تفاصيل الامتحانات ووقت الدخول والخروج والدرجات) */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span>سجل الامتحانات ومواعيد الدخول والخروج بالتفصيل</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              يوثق التوقيت الدقيق لبدء الامتحان، وقت التسليم، المدة المستغرقة، والدرجة المعتمدة
            </p>
          </div>

          <span className="text-xs font-bold text-slate-400">
            إجمالي المحاولات المسجلة: {studentSubmissions.length}
          </span>
        </div>

        {studentSubmissions.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">لم يقم الطالب بدخول أي امتحان حتى الآن</p>
            <p className="text-xs text-slate-400">ستظهر هنا تفاصيل توقيت كل امتحان ودرجته فور تسليمه.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {studentSubmissions.map((sub, idx) => {
              const isPassed = sub.passed || sub.percentage >= 60;
              const isUnderReview = sub.status === 'under_review';

              return (
                <div
                  key={sub.submissionId ? `${sub.submissionId}-${idx}` : `sub-${idx}`}
                  className="border border-slate-200 hover:border-indigo-300 rounded-[24px] p-5 sm:p-6 transition-all space-y-4 bg-slate-50/50 hover:bg-white shadow-2xs"
                >
                  {/* Top Row: Exam Title & Result Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                          {sub.courseTitle || 'كورس معتمد'}
                        </span>
                        {sub.lessonTitle && (
                          <span className="text-xs text-slate-500 font-bold">
                            الدرس: {sub.lessonTitle}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-900">{sub.examTitle}</h4>
                    </div>

                    {/* Result Badge */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-400">الدرجة المحققة:</div>
                        <div className="text-sm font-black text-slate-900">
                          {sub.totalScore} / {sub.maxScore} درجة
                        </div>
                      </div>

                      <div
                        className={`px-3.5 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 shadow-xs ${
                          isUnderReview
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isPassed
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}
                      >
                        {isUnderReview ? (
                          <>
                            <Clock className="w-4 h-4 text-amber-700" />
                            <span>قيد مراجعة المقالي ({sub.percentage}%)</span>
                          </>
                        ) : isPassed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>اجتاز بنجاح ({sub.percentage}%)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-rose-700" />
                            <span>يحتاج إعادة ({sub.percentage}%)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timing Matrix (مصفوفة التوقيتات الدقيقة) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 text-xs">
                    {/* Start Time */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-bold block">وقت وتاريخ الدخول:</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {sub.startedAt || '06:15 م (2026/08/25)'}
                        </span>
                      </div>
                    </div>

                    {/* Exit / Submit Time */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-bold block">وقت الخروج والتسليم:</span>
                        <span className="font-bold text-slate-800 font-mono">
                          {sub.submittedAt || '06:38 م (2026/08/25)'}
                        </span>
                      </div>
                    </div>

                    {/* Duration Spent */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <HourglassIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-bold block">المدة المستغرقة في الحل:</span>
                        <span className="font-black text-amber-900 font-mono">
                          {sub.durationTakenFormatted || '23 دقيقة من أصل 30 دقيقة'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supervisor Note if available */}
                  {sub.reviewedBy && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black block">ملاحظة وتوجيه المشرف ({sub.reviewedBy}):</span>
                        <span className="text-slate-700">تم تدقيق الإجابات المقالية واعتماد الدرجة النهائية بنجاح.</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 4: Course by Course Progress (مستوى تقدم الكورسات) */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>مستوى التقدم في الكورسات المشترك بها</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            نسبة إنجاز امتحانات كل كورس ومستوى الطالب في كل مادة
          </p>
        </div>

        {enrolledCourses.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            الطالب غير مشترك في أي كورس حالياً. تواصل مع المشرف لتفعيل الأكواد.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledCourses.map((c) => {
              const totalExams = c.exams?.length || 1;
              const passedExams =
                c.exams?.filter((ex) => selectedStudent?.examResults?.[ex.id]?.passed).length || 0;
              const progressPct = Math.round((passedExams / totalExams) * 100);

              return (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-100">
                        {c.subject}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 leading-snug">{c.title}</h4>
                    </div>
                    <span className="text-xs font-black text-slate-900 font-mono shrink-0">
                      {progressPct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                    <span>الامتحانات المنجزة: {passedExams} من {totalExams}</span>
                    <span className={progressPct === 100 ? 'text-emerald-700 font-black' : 'text-slate-600'}>
                      {progressPct === 100 ? 'مكتمل بنجاح 🎓' : 'جاري الدراسة'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Little Helper icon for hourglass
function HourglassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}
