import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Save,
  BookOpen,
  User as UserIcon,
  Sparkles,
  HelpCircle,
  FileText,
  Image as ImageIcon,
  Check,
  Clock,
  Eye
} from 'lucide-react';
import { Course, EssayGradingResult, StudentExamSubmission, User, AppView } from '../types';
import { getSavedSubmissions, saveSubmissions, saveUsers } from '../data/initialData';
import { getFirebaseIdToken } from '../auth';
import { compressImageFile } from '../utils/imageUtils';

interface TeacherEssayGradingPageProps {
  currentTeacher: User;
  allCourses: Course[];
  allStudents: User[];
  onUpdateStudents: (students: User[]) => void;
  onNavigate: (view: AppView) => void;
}

export const TeacherEssayGradingPage: React.FC<TeacherEssayGradingPageProps> = ({
  currentTeacher,
  allCourses,
  allStudents,
  onUpdateStudents,
  onNavigate,
}) => {
  const myCourses = useMemo(
    () =>
      allCourses.filter(
        (c) =>
          c.instructorId === currentTeacher.id ||
          c.instructor === currentTeacher.name ||
          c.teacherName === currentTeacher.name
      ),
    [allCourses, currentTeacher]
  );

  const myCourseIds = useMemo(() => new Set(myCourses.map((c) => c.id)), [myCourses]);

  const [submissions, setSubmissions] = useState<StudentExamSubmission[]>(() => getSavedSubmissions());
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'under_review' | 'graded'>('all');
  const [activeSubmission, setActiveSubmission] = useState<StudentExamSubmission | null>(null);

  // Draft grades for the active submission
  const [draftGrades, setDraftGrades] = useState<Record<string, EssayGradingResult>>({});
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Submissions strictly belonging to courses owned by this teacher
  const visibleSubmissions = useMemo(() => {
    return submissions.filter((sub) => sub.courseId && myCourseIds.has(sub.courseId));
  }, [submissions, myCourseIds]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return visibleSubmissions.filter((sub) => {
      if (selectedCourseId !== 'all' && sub.courseId !== selectedCourseId) return false;
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      return true;
    });
  }, [visibleSubmissions, selectedCourseId, statusFilter]);

  const getStudentName = (sub: StudentExamSubmission) =>
    sub.studentName ||
    allStudents.find((s) => s.id === sub.studentId)?.name ||
    'طالب منصة المتفلسفة ';

  const getCourseTitle = (sub: StudentExamSubmission) =>
    myCourses.find((c) => c.id === sub.courseId)?.title || 'كورس تعليمي';

  // Open submission for review
  const handleOpenReview = (submission: StudentExamSubmission) => {
    const existingDrafts = Object.fromEntries(
      Object.entries(submission.essayGrades || {}).map(([qId, grade]) => [qId, { ...grade }])
    );
    setDraftGrades(existingDrafts);
    setActiveSubmission(submission);
  };

  // Handle model answer image upload
  const handleGradeImageUpload = (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 1000, 0.75).then((compressed) => {
      if (compressed) {
        setDraftGrades((curr) => ({
          ...curr,
          [questionId]: {
            ...(curr[questionId] || {
              questionId,
              awardedMarks: 0,
              maxMarks: 20,
              feedback: '',
              strengths: [],
              missingPoints: [],
              improvementTip: '',
            }),
            modelAnswerImage: compressed,
          },
        }));
      }
    });
  };

  // Save and finalize review
  const handleSaveReview = async () => {
    if (!activeSubmission) return;
    setIsSaving(true);

    try {
      const mcqScore =
        Number((activeSubmission as any).mcqScore) ||
        activeSubmission.totalScore -
          Object.values(activeSubmission.essayGrades || {}).reduce(
            (sum, g) => sum + (g.awardedMarks || 0),
            0
          );

      const essayMarksSum = Object.values(draftGrades).reduce(
        (sum, g) => sum + (g.awardedMarks || 0),
        0
      );

      const totalScore = mcqScore + essayMarksSum;
      const percentage =
        activeSubmission.maxScore > 0
          ? Math.round((totalScore / activeSubmission.maxScore) * 100)
          : 0;

      const updatedSubmission: StudentExamSubmission = {
        ...activeSubmission,
        essayGrades: draftGrades,
        status: 'graded',
        totalScore,
        percentage,
        passed: percentage >= ((activeSubmission as any).passingPercentage || 60),
        reviewedAt: new Date().toLocaleDateString('ar-EG'),
        reviewedBy: currentTeacher.name,
      };

      const updatedList = submissions.map((item) =>
        item.submissionId === activeSubmission.submissionId ? updatedSubmission : item
      );
      setSubmissions(updatedList);
      saveSubmissions(updatedList);

      // Update student's user profile exam results
      if (activeSubmission.studentId) {
        const updatedStudents = allStudents.map((s) =>
          s.id === activeSubmission.studentId
            ? {
                ...s,
                examResults: {
                  ...(s.examResults || {}),
                  [activeSubmission.examId]: {
                    ...(s.examResults?.[activeSubmission.examId] || {}),
                    score: totalScore,
                    maxScore: activeSubmission.maxScore,
                    percentage,
                    passed: percentage >= ((activeSubmission as any).passingPercentage || 60),
                    status: 'graded' as const,
                    completedAt: new Date().toISOString().split('T')[0],
                    startedAt: activeSubmission.startedAt || s.examResults?.[activeSubmission.examId]?.startedAt,
                    submittedAt: activeSubmission.submittedAt || s.examResults?.[activeSubmission.examId]?.submittedAt,
                    durationTakenSeconds: activeSubmission.durationTakenSeconds ?? s.examResults?.[activeSubmission.examId]?.durationTakenSeconds,
                    durationTakenFormatted: activeSubmission.durationTakenFormatted || s.examResults?.[activeSubmission.examId]?.durationTakenFormatted,
                  },
                },
              }
            : s
        );
        onUpdateStudents(updatedStudents);
        saveUsers(updatedStudents);
      }

      // Sync to backend if token available
      try {
        const token = await getFirebaseIdToken();
        await fetch('/api/teacher/grade-essay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            submissionId: activeSubmission.submissionId,
            courseId: activeSubmission.courseId,
            essayGrades: draftGrades,
          }),
        });
      } catch {}

      showToast(`تم اعتماد وتصحيح إجابات الطالب (${getStudentName(activeSubmission)}) بنجاح!`);
      setActiveSubmission(null);
    } catch (err: any) {
      showToast('حدث خطأ أثناء حفظ التصحيح.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16" dir="rtl">
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-black flex items-center gap-2.5 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('teacher_dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-black text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للوحة المعلم</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            بانتظار التصحيح: {visibleSubmissions.filter((s) => s.status === 'under_review').length}
          </span>
        </div>
      </div>

      {/* Header Banner */}
      <div className="rounded-[32px] bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-lg">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                تصحيح الأسئلة المقالية (صفحة كاملة)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              تصحيح إجابات الطلاب وإسناد الدرجات
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              صحح إجابات الطلاب المقالية والخطوات في الكورسات الخاصة بك، وقدّم ملاحظات وتوجيهات بناءة.
            </p>
          </div>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
            <p className="text-[10px] text-slate-400 font-bold">إجمالي الإجابات</p>
            <p className="text-xl font-black text-white">{visibleSubmissions.length}</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-center">
            <p className="text-[10px] text-amber-300 font-bold">قيد المراجعة</p>
            <p className="text-xl font-black text-amber-200">
              {visibleSubmissions.filter((s) => s.status === 'under_review').length}
            </p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-center">
            <p className="text-[10px] text-emerald-300 font-bold">تم التصحيح</p>
            <p className="text-xl font-black text-emerald-200">
              {visibleSubmissions.filter((s) => s.status === 'graded').length}
            </p>
          </div>
        </div>
      </div>

      {/* Main Review Workbench Modal / Full View */}
      {activeSubmission ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[36px] p-6 sm:p-10 shadow-2xl space-y-8 animate-fadeIn">
          {/* Active Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-0.5 rounded-full">
                  {getCourseTitle(activeSubmission)}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                  زمن التسليم: {activeSubmission.submittedAt || (activeSubmission as any).date || 'اليوم'}
                </span>
                {activeSubmission.durationTakenFormatted && (
                  <span className="text-xs text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                    الوقت المستغرق: {activeSubmission.durationTakenFormatted}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>إجابات الطالب: {getStudentName(activeSubmission)}</span>
              </h2>
            </div>

            <button
              onClick={() => setActiveSubmission(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all self-start sm:self-auto cursor-pointer"
            >
              إلغاء والعودة للقائمة
            </button>
          </div>

          {/* Essay Questions List */}
          <div className="space-y-8">
            {(() => {
              const allEssayQuestionIds = Array.from(
                new Set([
                  ...Object.keys(activeSubmission.essayAnswers || {}),
                  ...Object.keys(activeSubmission.essayAnswerImages || {}),
                  ...Object.keys(activeSubmission.essayAnswerAudio || {}),
                  ...Object.keys(activeSubmission.essayGrades || {}),
                ])
              );

              if (allEssayQuestionIds.length === 0) {
                return (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <p className="text-sm font-bold text-slate-500">
                      لا توجد أسئلة مقالية مسجلة في هذا الامتحان، درجات أسئلة الاختيار من متعدد تم احتسابها آلياً.
                    </p>
                  </div>
                );
              }

              return allEssayQuestionIds.map((questionId, idx) => {
                const studentAnswer = activeSubmission.essayAnswers?.[questionId] || '';
                const studentPhoto = activeSubmission.essayAnswerImages?.[questionId];
                const studentAudio = activeSubmission.essayAnswerAudio?.[questionId];
                const draft = draftGrades[questionId] || {
                  questionId,
                  awardedMarks: 0,
                  maxMarks: 20,
                  feedback: '',
                  strengths: [],
                  missingPoints: [],
                  improvementTip: '',
                };

                return (
                  <div
                    key={questionId}
                    className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-6"
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-3 py-1 rounded-full">
                        السؤال المقالي رقم {idx + 1}
                      </span>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                          الدرجة المستحقة:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={draft.maxMarks || 20}
                          value={draft.awardedMarks || 0}
                          onChange={(e) =>
                            setDraftGrades((curr) => ({
                              ...curr,
                              [questionId]: {
                                ...draft,
                                awardedMarks: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-20 p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-400 font-mono text-center font-black text-sm"
                        />
                        <span className="text-xs text-slate-400 font-bold">من {draft.maxMarks || 20}</span>
                      </div>
                    </div>

                    {/* Student Answer Presentation */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                      <h4 className="text-xs font-black text-slate-400">إجابة وخطوات حل الطالب:</h4>
                      <p className="text-sm font-medium text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                        {studentAnswer || 'لم يكتب الطالب إجابة نصية لهذا السؤال.'}
                      </p>

                      {studentPhoto && (
                        <div className="pt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block">
                            📸 صورة ورقة إجابة الطالب بخط اليد:
                          </span>
                          <img
                            src={studentPhoto}
                            alt="صورة إجابة الطالب"
                            className="max-h-72 rounded-xl object-contain border border-slate-200 dark:border-slate-700 bg-slate-50"
                          />
                        </div>
                      )}

                      {studentAudio && (
                        <div className="pt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block">
                            🎙️ التسجيل الصوتي لإجابة الطالب:
                          </span>
                          <audio controls src={studentAudio} className="w-full max-w-md h-9" />
                        </div>
                      )}
                    </div>

                    {/* Feedback and Notes Input */}
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                          ملاحظات وتوجيهات المعلم للطالب:
                        </label>
                        <textarea
                          rows={2}
                          value={draft.feedback || ''}
                          onChange={(e) =>
                            setDraftGrades((curr) => ({
                              ...curr,
                              [questionId]: {
                                ...draft,
                                feedback: e.target.value,
                              },
                            }))
                          }
                          placeholder="اكتب تعليقك وتوجيهك للطالب..."
                          className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-right"
                        />
                      </div>

                      {/* Model Answer Upload */}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                          صورة نموذج الإجابة أو تصحيح الخطوات (اختياري):
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleGradeImageUpload(questionId, e)}
                            className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700"
                          />
                          {draft.modelAnswerImage && (
                            <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> تم إرفاق الصورة
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleSaveReview}
              disabled={isSaving}
              className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{isSaving ? 'جارٍ حفظ واعتماد النتيجة...' : 'اعتماد الدرجات وإرسال النتيجة للطالب 🚀'}</span>
            </button>

            <button
              onClick={() => setActiveSubmission(null)}
              className="py-4 px-6 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-black text-xs transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        /* Submissions List View */
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white text-right"
              >
                <option value="all">كافة الكورسات الخاصة بي ({myCourses.length})</option>
                {myCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                الكل ({visibleSubmissions.length})
              </button>
              <button
                onClick={() => setStatusFilter('under_review')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'under_review'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                قيد المراجعة ({visibleSubmissions.filter((s) => s.status === 'under_review').length})
              </button>
              <button
                onClick={() => setStatusFilter('graded')}
                className={`px-3 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'graded'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                تم التصحيح ({visibleSubmissions.filter((s) => s.status === 'graded').length})
              </button>
            </div>
          </div>

          {/* Submissions Cards */}
          {filteredSubmissions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <ClipboardCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                لا توجد إجابات بانتظار التصحيح حالياً
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                عند قيام أي طالب بإنهاء امتحان يتضمن أسئلة مقالية في كورساتك، سيظهر إشعاره وتسليمه هنا فوراً لتصحيحه.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSubmissions.map((sub) => {
                const isUnderReview = sub.status === 'under_review';
                const course = myCourses.find((c) => c.id === sub.courseId);

                return (
                  <div
                    key={sub.submissionId}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-sm shrink-0">
                            {getStudentName(sub).charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {getStudentName(sub)}
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {course?.title || 'كورس تعليمي'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-black px-3 py-1 rounded-full ${
                            isUnderReview
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {isUnderReview ? 'قيد المراجعة ⏳' : 'تم الاعتماد ✅'}
                        </span>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold">درجة الطالب:</span>
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {sub.totalScore} / {sub.maxScore} ({sub.percentage}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-bold">زمن التسليم:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {sub.submittedAt || 'تم التسليم'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-bold">الوقت المستغرق:</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            {sub.durationTakenFormatted || 'أقل من دقيقة'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenReview(sub)}
                      className={`w-full py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                        isUnderReview
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{isUnderReview ? 'بدء تصحيح الإجابة الآن ✍️' : 'مراجعة وتعديل التصحيح 👁️'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherEssayGradingPage;
