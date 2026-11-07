import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Save,
  Users,
  X,
  BookOpen,
  Eye,
  Clock,
  Upload,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  Layers,
  Sparkles,
  Check,
  Video,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import type { AppView, AssistantSpecialty, Course, CourseType, SchoolYearGrade, EssayGradingResult, StudentExamSubmission, User } from '../types';
import { getSavedSubmissions, saveSubmissions, saveUsers, saveCourses, deleteCourseFromServer, addDeletedCourseId } from '../data/initialData';
import { getFirebaseIdToken } from '../auth';
import { compressImageFile } from '../utils/imageUtils';
import { CourseLessonManagerModal } from './CourseLessonManagerModal';
import { TeacherAssistantsModal } from './TeacherAssistantsModal';

interface Props {
  currentTeacher: User;
  allCourses: Course[];
  allStudents: User[];
  onUpdateCourses?: (courses: Course[]) => void;
  onUpdateStudents?: (students: User[]) => void;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  lockedAssistantMode?: AssistantSpecialty;
}

const teacherCourses = (teacher: User, courses: Course[]) =>
  courses.filter(
    (course) =>
      course.instructorId === teacher.id ||
      course.instructor === teacher.name ||
      course.teacherName === teacher.name
  );

export const TeacherPermissionsDashboard: React.FC<Props> = ({
  currentTeacher,
  allCourses,
  allStudents,
  onUpdateCourses,
  onUpdateStudents,
  onNavigate,
  onLogout,
  lockedAssistantMode,
}) => {
  const [submissions, setSubmissions] = useState<StudentExamSubmission[]>(() => getSavedSubmissions());
  const [activeTab, setActiveTab] = useState<'courses' | 'overview' | 'scores' | 'essay'>(() =>
    lockedAssistantMode === 'essay_grading' ? 'essay' : 'courses'
  );
  const [isAssistantsModalOpen, setIsAssistantsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentExamSubmission | null>(null);
  const [draftGrades, setDraftGrades] = useState<Record<string, EssayGradingResult>>({});
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Course Management States
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const teacherSubject = currentTeacher.subject || 'مادة عامة';
  const teacherSpecialty = currentTeacher.specialty || 'عام لجميع الشعب';

  const [courseTitle, setCourseTitle] = useState('');
  const [courseType, setCourseType] = useState<CourseType>('integrated');
  const [courseYear, setCourseYear] = useState<SchoolYearGrade>('الصف الثالث الثانوي');
  const [courseDivision, setCourseDivision] = useState<string>(teacherSpecialty);
  const [coursePrice, setCoursePrice] = useState<number>(0);
  const [courseDescription, setCourseDescription] = useState('');
  const [courseCoverImage, setCourseCoverImage] = useState(
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop'
  );
  const [managingLessonsCourse, setManagingLessonsCourse] = useState<Course | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const courses = useMemo(() => teacherCourses(currentTeacher, allCourses), [currentTeacher, allCourses]);
  const courseIds = useMemo(() => new Set(courses.map((course) => course.id)), [courses]);

  const handleOpenAddCourse = () => {
    setEditingCourse(null);
    setCourseTitle('');
    setCourseType('integrated');
    setCourseYear('الصف الثالث الثانوي');
    setCourseDivision(teacherSpecialty);
    setCoursePrice(0);
    setCourseDescription('');
    setCourseCoverImage(
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop'
    );
    setIsAddCourseModalOpen(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseTitle(course.title);
    setCourseType(course.courseType || 'integrated');
    setCourseYear(course.schoolYear as SchoolYearGrade);
    setCourseDivision(course.division || teacherSpecialty);
    setCoursePrice(course.price);
    setCourseDescription(course.description);
    setCourseCoverImage(course.coverImage);
    setIsAddCourseModalOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) {
      showToast('يرجى إدخال اسم الكورس', 'error');
      return;
    }

    const effectiveDivision =
      teacherSpecialty && teacherSpecialty !== 'عام لجميع الشعب'
        ? teacherSpecialty
        : courseDivision;

    if (editingCourse) {
      const updated = allCourses.map((c) =>
        c.id === editingCourse.id
          ? {
              ...c,
              title: courseTitle.trim(),
              courseType,
              schoolYear: courseYear,
              division: effectiveDivision,
              price: Number(coursePrice) || 0,
              description: courseDescription.trim(),
              coverImage: courseCoverImage,
              subject: teacherSubject,
            }
          : c
      );
      onUpdateCourses?.(updated);
      saveCourses(updated);
      showToast('تم تحديث بيانات الكورس بنجاح ✅');
    } else {
      const newCourse: Course = {
        id: `course-teacher-${Date.now()}`,
        title: courseTitle.trim(),
        courseType,
        schoolYear: courseYear,
        division: effectiveDivision,
        price: Number(coursePrice) || 0,
        priceCurrency: 'ج.م',
        description: courseDescription.trim(),
        instructor: currentTeacher.name,
        instructorId: currentTeacher.id,
        teacherName: currentTeacher.name,
        teacherSubject,
        subject: teacherSubject,
        branch: 'scientific',
        isLocked: false,
        lessons: [],
        exams: [],
        isPublished: true,
        createdAt: new Date().toISOString().split('T')[0],
        coverImage: courseCoverImage,
      };

      const updated = [newCourse, ...allCourses];
      onUpdateCourses?.(updated);
      saveCourses(updated);
      showToast('تم إنشاء الكورس بنجاح وسيظهر للطلاب فوراً ✅');
    }

    setIsAddCourseModalOpen(false);
  };

  const handleDeleteCourse = (courseId: string, title: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الكورس: "${title}"؟`)) {
      addDeletedCourseId(courseId);
      const updated = allCourses.filter((c) => c.id !== courseId);
      onUpdateCourses?.(updated);
      saveCourses(updated);
      deleteCourseFromServer(courseId).catch(() => {});
      showToast('تم حذف الكورس بنجاح', 'error');
    }
  };

  const visibleSubmissions = useMemo(
    () => submissions.filter((submission) => submission.courseId && courseIds.has(submission.courseId)),
    [submissions, courseIds]
  );

  const getStudentName = (submission: StudentExamSubmission) =>
    submission.studentName ||
    allStudents.find((student) => student.id === submission.studentId)?.name ||
    'طالب منصة قلب العلم';

  const getCourse = (submission: StudentExamSubmission) =>
    courses.find((course) => course.id === submission.courseId);

  const enrolledCount = (courseId: string) =>
    allStudents.filter(
      (student) =>
        student.role !== 'teacher' &&
        student.role !== 'admin' &&
        student.enrolledCourseIds?.includes(courseId)
    ).length;

  const openEssayReview = (submission: StudentExamSubmission) => {
    const grades = Object.fromEntries(
      Object.entries(submission.essayGrades || {}).map(([questionId, grade]) => [
        questionId,
        { ...grade },
      ])
    );
    setDraftGrades(grades);
    setSelectedSubmission(submission);
  };

  const handleGradeImageUpload = (questionId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 1000, 0.75).then((compressed) => {
      if (compressed) {
        setDraftGrades((current) => ({
          ...current,
          [questionId]: {
            ...(current[questionId] || {
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

  const saveEssayReview = async () => {
    if (!selectedSubmission) return;
    const mcqScore =
      Number((selectedSubmission as any).mcqScore) ||
      selectedSubmission.totalScore -
        Object.values(selectedSubmission.essayGrades || {}).reduce(
          (sum, grade) => sum + (grade.awardedMarks || 0),
          0
        );
    const totalScore =
      mcqScore +
      Object.values(draftGrades).reduce((sum, grade) => sum + (grade.awardedMarks || 0), 0);
    const percentage =
      selectedSubmission.maxScore > 0 ? Math.round((totalScore / selectedSubmission.maxScore) * 100) : 0;
    const updatedSubmission: StudentExamSubmission = {
      ...selectedSubmission,
      essayGrades: draftGrades,
      status: 'graded',
      totalScore,
      percentage,
      passed: percentage >= ((selectedSubmission as any).passingPercentage || 60),
      reviewedAt: new Date().toLocaleDateString('ar-EG'),
      reviewedBy: currentTeacher.name,
    };

    const updated = submissions.map((item) =>
      item.submissionId === selectedSubmission.submissionId ? updatedSubmission : item
    );
    setSubmissions(updated);
    saveSubmissions(updated);

    if (selectedSubmission.studentId) {
      const updatedStudents = allStudents.map((student) =>
        student.id === selectedSubmission.studentId
          ? {
              ...student,
              examResults: {
                ...(student.examResults || {}),
                [selectedSubmission.examId]: {
                  ...(student.examResults?.[selectedSubmission.examId] || {}),
                  score: totalScore,
                  maxScore: selectedSubmission.maxScore,
                  percentage,
                  passed: percentage >= ((selectedSubmission as any).passingPercentage || 60),
                  status: 'graded' as const,
                  completedAt: new Date().toISOString().split('T')[0],
                },
              },
            }
          : student
      );
      onUpdateStudents?.(updatedStudents);
      saveUsers(updatedStudents);
    }

    try {
      const token = await getFirebaseIdToken();
      await fetch('/api/teacher/grade-essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          submissionId: selectedSubmission.submissionId,
          courseId: selectedSubmission.courseId,
          essayGrades: draftGrades,
        }),
      });
    } catch {
      // Local result already saved
    }

    showToast(`تم اعتماد وتصحيح إجابات الطالب (${getStudentName(selectedSubmission)}) بنجاح!`);
    setSelectedSubmission(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16" dir="rtl">
      {/* Feedback Toast */}
      {toastMsg && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-black flex items-center gap-2.5 animate-bounce ${
            toastMsg.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Banner & Full Teacher Controls (Hidden in Locked Assistant Mode) */}
      {!lockedAssistantMode && (
        <>
          <section className="rounded-[32px] bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-white shrink-0 shadow-lg">
                  <GraduationCap className="w-8 h-8 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                      لوحة تحكم المعلم المعتمد
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black">أهلاً بك، {currentTeacher.name}</h1>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300">
                    المادة: <b>{currentTeacher.subject || 'مادة عامة'}</b> • التخصص:{' '}
                    <b>{currentTeacher.specialty || 'عام لجميع الشعب'}</b>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setIsAssistantsModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md"
                >
                  <Users className="w-4 h-4" />
                  <span>
                    إضافة / إدارة المدرسين المساعدين (
                    {
                      allStudents.filter(
                        (u) =>
                          (u.role === 'assistant' || u.isAssistant) &&
                          (u.assistantForTeacherId === currentTeacher.id ||
                            u.assistantForTeacherName === currentTeacher.name)
                      ).length
                    }
                    )
                  </span>
                </button>
                <button
                  onClick={onLogout}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 font-black text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </section>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold">كورساتي</p>
                <p className="text-2xl font-black text-slate-900">{courses.length}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold">إجمالي الطلاب المشتركين</p>
                <p className="text-2xl font-black text-slate-900">
                  {courses.reduce((sum, course) => sum + enrolledCount(course.id), 0)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold">إجابات الطلاب المستلمة</p>
                <p className="text-2xl font-black text-slate-900">{visibleSubmissions.length}</p>
              </div>
            </div>
          </div>

          {/* Full Page Quick Action Panels Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <button
              onClick={() => onNavigate('teacher_add_course')}
              className="p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-between gap-3 shadow-md shadow-indigo-600/20 cursor-pointer transition-all hover:scale-[1.02] text-right"
            >
              <div>
                <p className="text-xs font-black">إضافة كورس جديد +</p>
                <p className="text-[11px] text-indigo-100 mt-0.5 font-medium">فتح في صفحة كاملة</p>
              </div>
              <Plus className="w-6 h-6 text-indigo-200" />
            </button>

            <button
              onClick={() => setIsAssistantsModalOpen(true)}
              className="p-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-between gap-3 shadow-md shadow-purple-600/20 cursor-pointer transition-all hover:scale-[1.02] text-right"
            >
              <div>
                <p className="text-xs font-black">إضافة مدرسين مساعدين 👨‍💼</p>
                <p className="text-[11px] text-purple-100 mt-0.5 font-medium">تحديد التخصص ورقم الدخول</p>
              </div>
              <Users className="w-6 h-6 text-purple-200" />
            </button>

            <button
              onClick={() => onNavigate('teacher_students')}
              className="p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-between gap-3 shadow-md shadow-emerald-600/20 cursor-pointer transition-all hover:scale-[1.02] text-right"
            >
              <div>
                <p className="text-xs font-black">سجل الطلاب المشتركين 👥</p>
                <p className="text-[11px] text-emerald-100 mt-0.5 font-medium">أسماء الطلاب والطالبات بالكامل</p>
              </div>
              <Users className="w-6 h-6 text-emerald-200" />
            </button>

            <button
              onClick={() => onNavigate('teacher_progress')}
              className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between gap-3 shadow-md shadow-blue-600/20 cursor-pointer transition-all hover:scale-[1.02] text-right"
            >
              <div>
                <p className="text-xs font-black">مستوى وتقدم الطلاب 📊</p>
                <p className="text-[11px] text-blue-100 mt-0.5 font-medium">نسب المشاهدة والامتحانات</p>
              </div>
              <BarChart3 className="w-6 h-6 text-blue-200" />
            </button>

            <button
              onClick={() => onNavigate('teacher_grading')}
              className="p-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-between gap-3 shadow-md shadow-amber-600/20 cursor-pointer transition-all hover:scale-[1.02] text-right"
            >
              <div>
                <p className="text-xs font-black">تصحيح الأسئلة المقالية ✍️</p>
                <p className="text-[11px] text-amber-100 mt-0.5 font-medium">
                  بانتظار المراجعة ({visibleSubmissions.filter((s) => s.status === 'under_review').length})
                </p>
              </div>
              <ClipboardCheck className="w-6 h-6 text-amber-200" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 flex-wrap bg-white p-1.5 rounded-2xl border border-slate-200 w-fit">
            <button
              onClick={() => setActiveTab('courses')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'courses'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>إدارة كورساتي ({courses.length}) 📚</span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نظرة عامة على الكورسات ({courses.length})
            </button>
            <button
              onClick={() => setActiveTab('scores')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'scores'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نتائج وامتحانات الطلاب ({visibleSubmissions.length})
            </button>
            <button
              onClick={() => setActiveTab('essay')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'essay'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>تصحيح الأسئلة المقالية</span>
              {visibleSubmissions.filter((s) => s.status === 'under_review').length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] flex items-center justify-center font-bold">
                  {visibleSubmissions.filter((s) => s.status === 'under_review').length}
                </span>
              )}
            </button>
          </div>
        </>
      )}

      {/* Tab: Courses Management (إدارة وإضافة الكورسات للمدرس) */}
      {activeTab === 'courses' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <span>كورساتي التعليمية المعتمدة ({courses.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                يمكنك إنشاء وتعديل كورساتك وإضافة الدروس والفيديوهات وملفات الـ PDF والامتحانات التفاعلية.
              </p>
            </div>

            <button
              onClick={handleOpenAddCourse}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة كورس جديد +</span>
            </button>
          </div>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="text-[11px] font-black px-3 py-1 rounded-full bg-slate-900/80 text-white backdrop-blur-md">
                        {course.schoolYear}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3">
                      <span className={`text-xs font-black px-3 py-1 rounded-full shadow-md ${
                        course.price === 0 ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                      }`}>
                        {course.price === 0 ? 'مجاني' : `${course.price} ج.م`}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                      <span>{course.subject}</span>
                      <span>•</span>
                      <span>{course.division}</span>
                    </div>

                    <h3 className="text-base font-black text-slate-900 line-clamp-2 leading-snug">
                      {course.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-bold">
                      <div className="flex items-center gap-2">
                        <span>{course.lessons?.length || 0} درس</span>
                        <span>•</span>
                        <span>{course.exams?.length || 0} امتحان</span>
                      </div>
                      <span className="text-emerald-700 font-black">
                        {enrolledCount(course.id)} طالب مشترك
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 space-y-2">
                  <button
                    onClick={() => setManagingLessonsCourse(course)}
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-200/60"
                  >
                    <Layers className="w-4 h-4" />
                    <span>إدارة الدروس والمحتوى (فيديوهات • PDF • امتحانات) 🎬</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditCourse(course)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>تعديل الكورس ✏️</span>
                    </button>

                    <button
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer"
                      title="حذف الكورس"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {courses.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-base font-black text-slate-800">لا توجد كورسات مضافة لك حتى الآن</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  اضغط على زر «إضافة كورس جديد» بالأعلى لإنشاء أول كورس وإضافة دروسك وفيديوهاتك وامتحاناتك.
                </p>
                <button
                  onClick={handleOpenAddCourse}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md cursor-pointer"
                >
                  إضافة أول كورس الآن +
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Courses Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-black text-slate-900 text-base">{course.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {course.subject} • {course.schoolYear}
                  </p>
                </div>
                <span className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-black border border-emerald-100 shrink-0">
                  {enrolledCount(course.id)} طالب مشترك
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 font-bold">
                <span>{course.lessons?.length || 0} درس</span>
                <span>•</span>
                <span>{course.exams?.length || 0} امتحان</span>
              </div>
            </div>
          ))}
          {courses.length === 0 && (
            <div className="col-span-2 p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-bold">
              لا توجد كورسات مسندة إليك حالياً.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Scores Table */}
      {activeTab === 'scores' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-4">اسم الطالب</th>
                <th className="p-4">الكورس</th>
                <th className="p-4">الامتحان</th>
                <th className="p-4">الدرجة</th>
                <th className="p-4">النسبة</th>
                <th className="p-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSubmissions.map((submission, index) => (
                <tr
                  key={submission.submissionId ? `${submission.submissionId}-${index}` : `${submission.examId}-${index}`}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="p-4 font-black text-slate-900">{getStudentName(submission)}</td>
                  <td className="p-4">{submission.courseTitle || getCourse(submission)?.title || '—'}</td>
                  <td className="p-4">{submission.examTitle || '—'}</td>
                  <td className="p-4 font-mono font-black">
                    {submission.totalScore} / {submission.maxScore}
                  </td>
                  <td className="p-4 font-black text-indigo-700">
                    {Math.round(submission.percentage || 0)}%
                  </td>
                  <td className="p-4">
                    {submission.status === 'under_review' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                        بانتظار التصحيح
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        تم التصحيح
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {visibleSubmissions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-bold">
                    لا توجد امتحانات مكتملة حتى الآن.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Essay Reviews */}
      {activeTab === 'essay' && (
        <div className="space-y-3">
          {visibleSubmissions
            .filter(
              (submission) =>
                submission.status === 'under_review' ||
                Object.keys(submission.essayAnswers || {}).length > 0 ||
                Object.keys(submission.essayAnswerImages || {}).length > 0 ||
                Object.keys(submission.essayGrades || {}).length > 0
            )
            .map((submission, index) => (
              <div
                key={submission.submissionId ? `${submission.submissionId}-${index}` : `${submission.examId}-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div>
                  <h3 className="font-black text-slate-900 text-sm">{getStudentName(submission)}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {submission.courseTitle} • {submission.examTitle} •{' '}
                    <span className="font-bold text-indigo-600">
                      {submission.status === 'graded' ? 'تم التصحيح ✅' : 'قيد التصحيح (بانتظار مراجعة المدرس) ⏳'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => openEssayReview(submission)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>{submission.status === 'graded' ? 'تعديل الدرجات' : 'تصحيح الإجابات الآن'}</span>
                </button>
              </div>
            ))}
          {visibleSubmissions.filter(
            (s) =>
              s.status === 'under_review' ||
              Object.keys(s.essayAnswers || {}).length > 0 ||
              Object.keys(s.essayAnswerImages || {}).length > 0 ||
              Object.keys(s.essayGrades || {}).length > 0
          ).length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 font-bold bg-white">
              لا توجد أسئلة مقالية بحاجة إلى التصحيح حالياً.
            </div>
          )}
        </div>
      )}

      {/* Modal: Essay Grading */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-black text-lg text-slate-900">
                  تصحيح إجابات: {getStudentName(selectedSubmission)}
                </h2>
                <p className="text-xs text-slate-500">{selectedSubmission.examTitle}</p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {Array.from(
              new Set([
                ...Object.keys(selectedSubmission.essayAnswers || {}),
                ...Object.keys(selectedSubmission.essayAnswerImages || {}),
                ...Object.keys(selectedSubmission.essayAnswerAudio || {}),
                ...Object.keys(selectedSubmission.essayGrades || {}),
              ])
            ).map((questionId) => {
              const answer = selectedSubmission.essayAnswers?.[questionId] || '';
              const grade: any = draftGrades[questionId] || {
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
                  className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3"
                >
                  <p className="text-xs font-bold text-slate-500">نص إجابة الطالب:</p>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap bg-white p-3 rounded-xl border border-slate-100 leading-relaxed font-medium">
                    {answer || 'لم يكتب الطالب إجابة نصية.'}
                  </p>

                  {/* Student uploaded handwriting photo */}
                  {selectedSubmission.essayAnswerImages?.[questionId] && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-500">صورة خط اليد المرفقة:</span>
                      <img
                        src={selectedSubmission.essayAnswerImages[questionId]}
                        alt="إجابة الطالب بخط اليد"
                        className="max-h-56 w-full rounded-xl object-contain bg-white border border-slate-200"
                      />
                    </div>
                  )}

                  {/* Student voice recording */}
                  {selectedSubmission.essayAnswerAudio?.[questionId] && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-indigo-700">التسجيل الصوتي لإجابة الطالب:</span>
                      <audio
                        controls
                        src={selectedSubmission.essayAnswerAudio[questionId]}
                        className="w-full"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="text-xs font-bold text-slate-700">
                      الدرجة المستحقة:
                      <input
                        type="number"
                        min={0}
                        max={grade.maxMarks || 20}
                        value={grade.awardedMarks || 0}
                        onChange={(e) =>
                          setDraftGrades({
                            ...draftGrades,
                            [questionId]: { ...grade, awardedMarks: Number(e.target.value) },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-900 bg-white"
                      />
                    </label>
                    <label className="text-xs font-bold text-slate-700">
                      الدرجة القصوى:
                      <input
                        type="number"
                        min={1}
                        value={grade.maxMarks || 20}
                        onChange={(e) =>
                          setDraftGrades({
                            ...draftGrades,
                            [questionId]: { ...grade, maxMarks: Number(e.target.value) },
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-bold text-slate-900 bg-white"
                      />
                    </label>
                  </div>

                  <label className="text-xs font-bold block text-slate-700">
                    ملاحظات وتعليق المعلم على الإجابة:
                    <textarea
                      value={grade.feedback || ''}
                      onChange={(e) =>
                        setDraftGrades({
                          ...draftGrades,
                          [questionId]: { ...grade, feedback: e.target.value },
                        })
                      }
                      placeholder="اكتب ملاحظاتك التوجيهية للطالب..."
                      className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 bg-white min-h-[70px]"
                    />
                  </label>

                  {/* Model answer image upload */}
                  <label className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 cursor-pointer hover:bg-indigo-50 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>إرفاق صورة نموذج الإجابة الصحيحة للطالب</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleGradeImageUpload(questionId, e)}
                    />
                  </label>
                  {grade.modelAnswerImage && (
                    <img
                      src={grade.modelAnswerImage}
                      alt="نموذج الإجابة"
                      className="max-h-40 w-full rounded-xl object-contain bg-white border border-indigo-100"
                    />
                  )}
                </div>
              );
            })}

            <button
              onClick={saveEssayReview}
              className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Save className="w-4 h-4" />
              <span>حفظ واعتماد التصحيح النهائي</span>
            </button>
          </div>
        </div>
      )}

      {/* Course Lesson & Content Manager Modal */}
      {managingLessonsCourse && (
        <CourseLessonManagerModal
          isOpen={Boolean(managingLessonsCourse)}
          course={managingLessonsCourse}
          onClose={() => setManagingLessonsCourse(null)}
          onSaveCourse={(updatedCourse) => {
            const exists = allCourses.some((c) => c.id === updatedCourse.id);
            const updated = exists
              ? allCourses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
              : [updatedCourse, ...allCourses];
            onUpdateCourses?.(updated);
            saveCourses(updated);
            setManagingLessonsCourse(updatedCourse);
            showToast('تم حفظ وتحديث الدروس والمحتوى بنجاح ✅');
          }}
        />
      )}

      {/* Add / Edit Course Modal for Teacher */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingCourse ? 'تعديل بيانات الكورس' : 'إنشاء كورس تعليمي جديد'}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    مادة: {teacherSubject} • التخصص: {teacherSpecialty}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsAddCourseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1">اسم الكورس *:</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="مثال: كورس الفيزياء الحديثة - الفصل الخامس"
                  className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">نوع الكورس:</label>
                  <select
                    value={courseType}
                    onChange={(e) => setCourseType(e.target.value as CourseType)}
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs bg-white font-bold"
                  >
                    <option value="integrated">كورس متكامل (شرح + مذكرات + امتحانات) 🎥📄</option>
                    <option value="exams_only">كورس بنك امتحانات فقط 📝</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1">السنة الدراسية:</label>
                  <select
                    value={courseYear}
                    onChange={(e) => setCourseYear(e.target.value as SchoolYearGrade)}
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs bg-white font-bold"
                  >
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                    <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                    <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">سعر الكورس (ج.م):</label>
                  <input
                    type="number"
                    min={0}
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value))}
                    placeholder="0 = كورس مجاني"
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">0 = مجاني لجميع الطلاب</span>
                </div>

                <div>
                  <label className="block mb-1">الشعبة / التخصص:</label>
                  <input
                    type="text"
                    value={courseDivision}
                    onChange={(e) => setCourseDivision(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1">وصف الكورس ومحتواه:</label>
                <textarea
                  rows={3}
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  placeholder="اكتب نبذة توضيحية للطلاب عن هذا الكورس..."
                  className="w-full p-3 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block mb-1">صورة غلاف الكورس:</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={courseCoverImage}
                    onChange={(e) => setCourseCoverImage(e.target.value)}
                    placeholder="رابط الصورة (URL)"
                    className="flex-1 p-3 rounded-2xl border border-slate-200 text-xs font-mono"
                  />
                  <label className="px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>رفع صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImageFile(file, 1000, 0.75).then((compressed) => {
                            if (compressed) setCourseCoverImage(compressed);
                          });
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCourseModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                >
                  {editingCourse ? 'حفظ التعديلات' : 'إنشاء الكورس'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teaching Assistants Management Modal */}
      {isAssistantsModalOpen && (
        <TeacherAssistantsModal
          isOpen={isAssistantsModalOpen}
          teacher={currentTeacher}
          allUsers={allStudents}
          onUpdateUsers={(updated) => onUpdateStudents?.(updated)}
          onClose={() => setIsAssistantsModalOpen(false)}
        />
      )}
    </div>
  );
};

