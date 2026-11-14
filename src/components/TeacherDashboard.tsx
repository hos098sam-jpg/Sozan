import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  FileEdit,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  LogOut,
  Image,
  Clock,
  Layers,
  HelpCircle,
  Award,
  AlertCircle,
  Eye,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { Course, CourseType, CourseExam, ExamQuestion, User, SchoolYearGrade, AppView } from '../types';
import { CourseLessonManagerModal } from './CourseLessonManagerModal';
import { saveCourses, saveExamToStore, deleteCourseFromServer, addDeletedCourseId } from '../data/initialData';
import { compressImageFile } from '../utils/imageUtils';

interface TeacherDashboardProps {
  currentTeacher: User;
  allCourses: Course[];
  onUpdateCourses: (updatedCourses: Course[]) => void;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentTeacher,
  allCourses,
  onUpdateCourses,
  onNavigate,
  onLogout,
}) => {
  const teacherSubject = 'الفلسفة';
  const teacherSpecialty = currentTeacher.specialty || 'عام لجميع الشعب';

  // Teacher's courses (filtered to only those created by or assigned to this teacher)
  const myCourses = allCourses.filter(
    (c) =>
      c.instructorId === currentTeacher.id ||
      c.instructor === currentTeacher.name ||
      c.teacherName === currentTeacher.name
  );

  // States
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Form states for adding/editing course
  const [courseTitle, setCourseTitle] = useState('');
  const [courseType, setCourseType] = useState<CourseType>('integrated');
  const [courseYear, setCourseYear] = useState<SchoolYearGrade>('الصف الأول الثانوي');
  const [courseDivision, setCourseDivision] = useState<string>(teacherSpecialty);
  const [coursePrice, setCoursePrice] = useState<number>(0);
  const [courseDescription, setCourseDescription] = useState('');
  const [courseCoverImage, setCourseCoverImage] = useState(
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop'
  );
  const [managingLessonsCourse, setManagingLessonsCourse] = useState<Course | null>(null);

  // Active Exam Builder state for a course
  const [selectedCourseForExam, setSelectedCourseForExam] = useState<Course | null>(null);
  const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examLessonTitle, setExamLessonTitle] = useState('');
  const [examDuration, setExamDuration] = useState(30);
  const [examPassing, setExamPassing] = useState(60);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);

  // Feedback Toast
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Image Upload Helper
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 1000, 0.75).then((compressed) => {
      if (compressed) setter(compressed);
    }).catch(() => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setter(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // --- Teacher Course Discount ("تنزيل خصم على الكورس بعد إضافته") ---
  const [discountModalCourse, setDiscountModalCourse] = useState<Course | null>(null);
  const [discountBasePrice, setDiscountBasePrice] = useState<number>(0);
  const [discountPercentInput, setDiscountPercentInput] = useState<number>(25);
  const [discountNewPriceInput, setDiscountNewPriceInput] = useState<number>(0);

  const handleOpenCourseDiscountModal = (course: Course) => {
    const currentPrice = Math.max(0, Number(course.price) || 0);
    const existingOriginal = Math.max(0, Number(course.originalPrice) || 0);
    const hasExistingDiscount = existingOriginal > currentPrice && existingOriginal > 0;
    const base = hasExistingDiscount ? existingOriginal : currentPrice;
    const defaultPct = hasExistingDiscount
      ? Math.max(1, Math.min(99, Number(course.discountPercentage) || Math.round(((base - currentPrice) / base) * 100)))
      : 25;
    const calculatedNew = hasExistingDiscount
      ? currentPrice
      : Math.max(0, Math.round(base * (1 - defaultPct / 100)));

    setDiscountModalCourse(course);
    setDiscountBasePrice(base);
    setDiscountPercentInput(defaultPct);
    setDiscountNewPriceInput(calculatedNew);
  };

  const handleDiscountPercentChange = (pctValue: number, customBase?: number) => {
    const base = customBase !== undefined ? customBase : discountBasePrice;
    const clampedPct = Math.max(0, Math.min(100, Number(pctValue) || 0));
    setDiscountPercentInput(clampedPct);
    const newPrice = Math.max(0, Math.round(base * (1 - clampedPct / 100)));
    setDiscountNewPriceInput(newPrice);
  };

  const handleDiscountNewPriceChange = (newPriceValue: number, customBase?: number) => {
    const base = customBase !== undefined ? customBase : discountBasePrice;
    const validNew = Math.max(0, Number(newPriceValue) || 0);
    setDiscountNewPriceInput(validNew);
    if (base > 0 && validNew < base) {
      const pct = Math.max(1, Math.min(100, Math.round(((base - validNew) / base) * 100)));
      setDiscountPercentInput(pct);
    } else {
      setDiscountPercentInput(0);
    }
  };

  const handleSaveCourseDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountModalCourse) return;
    const base = Math.max(0, Number(discountBasePrice) || 0);
    const newPrice = Math.max(0, Number(discountNewPriceInput) || 0);

    if (base <= 0) {
      showFeedback('يرجى تحديد السعر الأصلي للكورس أولاً (أكبر من صفر) لتنزيل خصم عليه', 'error');
      return;
    }
    if (newPrice >= base) {
      showFeedback('يجب أن يكون السعر الجديد بعد الخصم أقل من السعر القديم للكورس', 'error');
      return;
    }

    const finalPercent = Math.max(1, Math.min(100, Math.round(((base - newPrice) / base) * 100)));
    const updated = allCourses.map((c) =>
      c.id === discountModalCourse.id
        ? {
            ...c,
            originalPrice: base,
            price: newPrice,
            discountPercentage: finalPercent,
          }
        : c
    );

    onUpdateCourses(updated);
    setDiscountModalCourse(null);
    showFeedback(
      `تم تنزيل خصم (${finalPercent}%) على كورس "${discountModalCourse.title}"! يظهر للطلاب السعر القديم (${base} ج.م) مشطوباً والسعر الجديد (${newPrice} ج.م) 🔥✅`
    );
  };

  const handleRemoveCourseDiscount = (course: Course) => {
    const restoredPrice =
      course.originalPrice && course.originalPrice > course.price ? course.originalPrice : course.price;
    const updated = allCourses.map((c) =>
      c.id === course.id
        ? {
            ...c,
            price: restoredPrice,
            originalPrice: undefined,
            discountPercentage: undefined,
          }
        : c
    );
    onUpdateCourses(updated);
    setDiscountModalCourse(null);
    showFeedback(`تم إلغاء الخصم على كورس "${course.title}" وإرجاع السعر الأصلي (${restoredPrice} ج.م) بنجاح.`);
  };

  // Open Course Modal for Add
  const handleOpenAddCourse = () => {
    setEditingCourse(null);
    setCourseTitle('');
    setCourseType('integrated');
    setCourseYear('الصف الأول الثانوي');
    setCourseDivision(teacherSpecialty);
    setCoursePrice(0);
    setCourseDescription('');
    setCourseCoverImage(
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop'
    );
    setIsAddCourseModalOpen(true);
  };

  // Open Course Modal for Edit
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

  // Save / Update Course
  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) {
      showFeedback('يرجى كتابة اسم الكورس', 'error');
      return;
    }

    // Enforce division rules (No division for Primary & Prep)
    const isPrimaryOrPrep = courseYear.includes('الابتدائي') || courseYear.includes('الإعدادي');
    const effectiveDivision = isPrimaryOrPrep
      ? ''
      : courseDivision || (courseYear.includes('الثالث الثانوي') ? 'علمي علوم' : 'بكالوريا');

    if (editingCourse) {
      // Update existing
      const newNumericPrice = Number(coursePrice) || 0;
      const updated = allCourses.map((c) => {
        if (c.id !== editingCourse.id) return c;
        const keepDiscount = c.originalPrice && c.originalPrice > newNumericPrice && newNumericPrice >= 0;
        const recalcPercent =
          keepDiscount && c.originalPrice
            ? Math.max(1, Math.min(100, Math.round(((c.originalPrice - newNumericPrice) / c.originalPrice) * 100)))
            : undefined;
        return {
          ...c,
          title: courseTitle.trim(),
          courseType: courseType,
          schoolYear: courseYear,
          division: effectiveDivision,
          price: newNumericPrice,
          originalPrice: keepDiscount ? c.originalPrice : undefined,
          discountPercentage: keepDiscount ? recalcPercent : undefined,
          description: courseDescription.trim(),
          coverImage: courseCoverImage,
          subject: teacherSubject, // Locked to teacher subject
        };
      });
      onUpdateCourses(updated);
      showFeedback('تم تحديث بيانات الكورس بنجاح ✅');
    } else {
      // Create new
      const newCourse: Course = {
        id: `course-teacher-${Date.now()}`,
        title: courseTitle.trim(),
        courseType: courseType,
        schoolYear: courseYear,
        division: effectiveDivision,
        price: Number(coursePrice) || 0,
        priceCurrency: 'ج.م',
        description: courseDescription.trim(),
        instructor: currentTeacher.name,
        instructorId: currentTeacher.id,
        teacherName: currentTeacher.name,
        teacherSubject: teacherSubject,
        subject: teacherSubject, // Strictly restricted to teacher subject
        branch: 'scientific',
        isLocked: false,
        lessons: [],
        exams: [],
        isPublished: true,
        createdAt: new Date().toISOString().split('T')[0],
        coverImage: courseCoverImage,
      };

      onUpdateCourses([newCourse, ...allCourses]);
      showFeedback('تمت إضافة الكورس بنجاح وسيظهر بلوحة الإدارة وللطلاب ✅');
    }

    setIsAddCourseModalOpen(false);
  };

  // Delete Course
  const handleDeleteCourse = (courseId: string, title: string) => {
    if (window.confirm(`هل أنت متأكد من رغبتك في حذف الكورس: "${title}"؟`)) {
      addDeletedCourseId(courseId);
      const updated = allCourses.filter((c) => c.id !== courseId);
      onUpdateCourses(updated);
      saveCourses(updated);
      deleteCourseFromServer(courseId).catch(() => {});
      showFeedback('تم حذف الكورس بنجاح', 'error');
    }
  };

  // Add Question Draft to Exam
  const handleAddQuestionToExam = (type: 'mcq' | 'essay') => {
    const newQ: ExamQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type,
      questionText: '',
      marks: type === 'mcq' ? 10 : 20,
      options: type === 'mcq' ? ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'] : [],
      correctOptionIndex: 0,
      modelAnswer: type === 'essay' ? 'الإجابة النموذجية المعتمدة...' : '',
    };
    setExamQuestions([...examQuestions, newQ]);
  };

  // Save Exam to Selected Course
  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForExam) return;
    if (!examTitle.trim() || !examLessonTitle.trim()) {
      showFeedback('يرجى كتابة عنوان الامتحان واسم الحصة / الدرس', 'error');
      return;
    }
    if (examQuestions.length === 0) {
      showFeedback('يرجى إضافة سؤال واحد على الأقل للامتحان', 'error');
      return;
    }

    const newExam: CourseExam = {
      id: `exam-${Date.now()}`,
      courseId: selectedCourseForExam.id,
      title: examTitle.trim(),
      lessonTitle: examLessonTitle.trim(),
      order: (selectedCourseForExam.exams?.length || 0) + 1,
      durationMinutes: Number(examDuration) || 30,
      passingPercentage: Number(examPassing) || 60,
      isPublished: true,
      questions: examQuestions,
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedCourses = allCourses.map((c) => {
      if (c.id === selectedCourseForExam.id) {
        return {
          ...c,
          exams: [...(c.exams || []), newExam],
        };
      }
      return c;
    });

    onUpdateCourses(updatedCourses);
    saveCourses(updatedCourses);
    saveExamToStore(newExam, selectedCourseForExam.id);
    showFeedback(`تمت إضافة الامتحان "${newExam.title}" وحفظه محلياً وسحابياً بنجاح ✅`);
    setIsAddExamModalOpen(false);
    setSelectedCourseForExam(null);
    setExamQuestions([]);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16" dir="rtl">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 transition-all ${
            feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Teacher Profile Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              {currentTeacher.avatarUrl ? (
                <img
                  src={currentTeacher.avatarUrl}
                  alt={currentTeacher.name}
                  referrerPolicy="no-referrer"
                  className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl object-cover ring-4 ring-amber-400 shadow-xl"
                />
              ) : (
                <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-indigo-600 text-white font-black text-3xl flex items-center justify-center ring-4 ring-amber-400 shadow-xl">
                  {(currentTeacher?.name || 'م').charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -left-1 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] shadow-sm">
                {currentTeacher.gender === 'female' ? 'معلمة معتمدة' : 'معلم معتمد'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {currentTeacher.gender === 'female' ? 'أستاذة /' : 'أ.'} {currentTeacher?.name || 'المعلم'}
                </h1>
                <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                  {currentTeacher.gender === 'female' ? 'معلمة مادة:' : 'معلم مادة:'} {teacherSubject}
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium">
                التخصص المصرح به: <span className="font-bold text-white">{teacherSpecialty}</span>
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                رقم الحساب الأكاديمي: {currentTeacher.accountNumber || currentTeacher.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleOpenAddCourse}
              className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة كورس جديد في تخصصي</span>
            </button>
            <button
              onClick={() => onNavigate('home')}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs transition-all flex items-center gap-1.5"
            >
              <span>الرئيسية</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-3 rounded-2xl bg-rose-600/80 hover:bg-rose-600 text-white font-black text-xs transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Security / Scope Reminder */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            صلاحياتك محددة ومقيدة بإضافة وإدارة الكورسات التابعة لمادة <strong className="text-amber-300">({teacherSubject})</strong> وتخصص <strong className="text-amber-300">({teacherSpecialty})</strong>. تظهر الكورسات تلقائياً في صفحة الإدارة العامة للكنترول والمشرف العام.
          </span>
        </div>
      </div>

      {/* Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              كورساتي التعليمية المرفوعة ({myCourses.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            تخصصك: {teacherSubject} ({teacherSpecialty})
          </span>
        </div>

        {myCourses.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                لم تقم بإضافة أي كورسات لمادة {teacherSubject} حتى الآن
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                اضغط على زر "إضافة كورس جديد في تخصصي" لإنشاء أول كورس وإرفاق الامتحانات الإلكترونية والمقالية المتسلسلة لطلابك.
              </p>
            </div>
            <button
              onClick={handleOpenAddCourse}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول كورس لمادة {teacherSubject}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCourses.map((course) => {
              const hasDiscount =
                typeof course.originalPrice === 'number' &&
                course.originalPrice > course.price &&
                course.originalPrice > 0;
              const discountPercent = hasDiscount
                ? course.discountPercentage && course.discountPercentage > 0
                  ? Math.round(course.discountPercentage)
                  : Math.round(((course.originalPrice! - course.price) / course.originalPrice!) * 100)
                : 0;

              return (
                <div
                  key={course.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs hover:shadow-xl transition-all p-5 flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={course.coverImage}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-md">
                          {course.schoolYear}
                        </span>
                        {course.division && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                            {course.division}
                          </span>
                        )}
                      </div>
                      {hasDiscount && (
                        <div className="absolute top-2.5 left-2.5">
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-600 text-white shadow-lg flex items-center gap-1">
                            🔥 خصم {discountPercent}%
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-2.5 left-2.5">
                        {hasDiscount ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 backdrop-blur-md text-white shadow-md border border-white/15">
                            <span className="text-[10px] font-bold text-rose-300 line-through decoration-rose-400 decoration-2">
                              {course.originalPrice} ج.م
                            </span>
                            <span className="text-xs font-black text-emerald-400">
                              {course.price === 0 ? 'مجاني' : `${course.price} ج.م`}
                            </span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white">
                              -{discountPercent}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-md">
                            {course.price === 0 ? 'مجاني' : `${course.price} ${course.priceCurrency}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                      {course.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {course.description || 'كورس تعليمي متكامل يحتوي على شرح وامتحانات متتالية.'}
                    </p>

                    {hasDiscount && (
                      <div className="p-2.5 rounded-xl bg-gradient-to-l from-rose-50 via-amber-50/60 to-emerald-50 border border-rose-200/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-400 line-through decoration-rose-500 decoration-2">
                            {course.originalPrice} ج.م
                          </span>
                          <span className="text-sm font-black text-emerald-700">
                            {course.price === 0 ? 'مجاني' : `${course.price} ج.م`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black">
                          خصم {discountPercent}% للطلاب 🔥
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40">
                        {course.courseType === 'exams_only' ? 'بنك امتحانات فقط' : 'شرح متكامل (دروس + وسائط)'}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {course.lessons?.length || 0} دروس
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {course.lessons?.reduce((acc, l) => acc + (l.videos?.length || 0), 0) || 0} فيديو
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        {course.lessons?.reduce((acc, l) => acc + (l.pdfs?.length || 0), 0) || 0} PDF
                      </span>
                    </div>

                    <div className="text-xs text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <span>الامتحانات التسلسلية:</span>
                      <span className="font-mono">{course.exams?.length || 0} امتحانات مرتبطة</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <button
                      onClick={() => setManagingLessonsCourse(course)}
                      className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>إدارة الدروس والفيديوهات والـ PDF 🎥</span>
                    </button>

                    {/* Button to apply or edit course discount after adding the course */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenCourseDiscountModal(course)}
                        className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                          hasDiscount
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        }`}
                      >
                        <span>🏷️</span>
                        <span>
                          {hasDiscount
                            ? `تعديل الخصم الحالي (${discountPercent}%)`
                            : 'تنزيل خصم على الكورس %'}
                        </span>
                      </button>
                      {hasDiscount && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCourseDiscount(course)}
                          className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-[11px] transition-all cursor-pointer shrink-0"
                          title="إلغاء الخصم وإرجاع السعر الأصلي"
                        >
                          إلغاء الخصم
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedCourseForExam(course);
                          setExamTitle('');
                          setExamLessonTitle('');
                          setExamDuration(30);
                          setExamPassing(60);
                          setExamQuestions([]);
                          setIsAddExamModalOpen(true);
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة امتحان للكورس</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditCourse(course)}
                        className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="تعديل بيانات الكورس"
                      >
                        <FileEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id, course.title)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                        title="حذف الكورس"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: APPLY DISCOUNT AFTER ADDING COURSE ("تنزيل خصم على الكورس") */}
      {/* ========================================================================= */}
      {discountModalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🏷️</span>
                  <span>تنزيل خصم على الكورس للطلاب</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  يظهر للطلاب في صفحة الكورسات السعر القديم مشطوباً عليه وبجانبه السعر الجديد ونسبة الخصم بالمية (%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiscountModalCourse(null)}
                className="text-slate-400 hover:text-slate-600 font-black text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">الكورس المختار:</span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">{discountModalCourse.title}</h4>
                <span className="text-[11px] text-indigo-600 font-bold">
                  {discountModalCourse.schoolYear} • {discountModalCourse.subject}
                </span>
              </div>
              <div className="text-left shrink-0">
                <span className="text-[10px] font-bold text-slate-400 block">السعر الحالي:</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{discountModalCourse.price} ج.م</span>
              </div>
            </div>

            <form onSubmit={handleSaveCourseDiscount} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                  1. السعر القديم (الأصلي قبل الخصم - سيظهر مشطوباً عليه) بالجنيه:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={discountBasePrice}
                  onChange={(e) => {
                    const newBase = Math.max(0, Number(e.target.value) || 0);
                    setDiscountBasePrice(newBase);
                    handleDiscountPercentChange(discountPercentInput, newBase);
                  }}
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-black font-mono bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                  2. اختر أو اكتب نسبة الخصم بالمية (%):
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {[10, 15, 20, 25, 30, 40, 50, 60, 75].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleDiscountPercentChange(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        discountPercentInput === preset
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200'
                      }`}
                    >
                      خصم {preset}%
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={discountPercentInput}
                    onChange={(e) => handleDiscountPercentChange(Number(e.target.value))}
                    className="w-full p-3 pl-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-black font-mono focus:border-rose-500 outline-none"
                  />
                  <span className="absolute left-4 top-3 text-sm font-black text-rose-600">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">
                  3. السعر الجديد بعد الخصم (المبلغ المطلوب من الطالب بالجنيه):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={discountNewPriceInput}
                    onChange={(e) => handleDiscountNewPriceChange(Number(e.target.value))}
                    className="w-full p-3 pl-14 rounded-2xl border-2 border-emerald-500/70 bg-emerald-50/30 dark:bg-emerald-950/30 text-sm font-black font-mono text-emerald-900 dark:text-emerald-200 focus:border-emerald-600 outline-none"
                  />
                  <span className="absolute left-4 top-3 text-xs font-black text-emerald-700">ج.م</span>
                </div>
              </div>

              {discountBasePrice > 0 && discountNewPriceInput < discountBasePrice && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5 border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    👀 معاينة ظهور الخصم للطلاب في صفحة الكورسات:
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-950/90 p-3 rounded-xl border border-white/10">
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-rose-400 line-through decoration-rose-500 decoration-2">
                        {discountBasePrice} ج.م
                      </span>
                      <span className="text-xl font-black text-emerald-400">
                        {discountNewPriceInput === 0 ? 'مجاني بالكامل' : `${discountNewPriceInput} ج.م`}
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black shadow-sm">
                      🔥 خصم {Math.round(((discountBasePrice - discountNewPriceInput) / discountBasePrice) * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300 font-bold">
                    يوفر الطالب في هذا الكورس: {discountBasePrice - discountNewPriceInput} ج.م
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                {discountModalCourse.originalPrice &&
                discountModalCourse.originalPrice > discountModalCourse.price ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveCourseDiscount(discountModalCourse)}
                    className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs transition-all cursor-pointer"
                  >
                    إلغاء الخصم نهائياً
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountModalCourse(null)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs cursor-pointer"
                  >
                    إغلاق
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-200 transition-all cursor-pointer"
                  >
                    حفظ وتطبيق الخصم للطلاب الآن 🔥
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT COURSE IN TEACHER SPECIALTY */}
      {/* ========================================================================= */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <span>{editingCourse ? 'تعديل الكورس' : 'إضافة كورس جديد في تخصصك'}</span>
              </h3>
              <button
                onClick={() => setIsAddCourseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الكورس (Title):
                </label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder={`مثال: كورس ${teacherSubject} - الباب الأول لدفعة 2027`}
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Locked Subject Notification */}
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">مادة الكورس:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-indigo-100 dark:border-indigo-900">
                  {teacherSubject} (مقيدة بتخصصك)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نوع الكورس الأكاديمي:
                </label>
                <select
                  value={courseType}
                  onChange={(e) => setCourseType(e.target.value as CourseType)}
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="integrated">كورس متكامل (شرح + دروس + فيديوهات لا نهائية + PDF + امتحانات) 🎥📄📝</option>
                  <option value="exams_only">كورس بنك امتحانات فقط (امتحانات تسلسلية مشروطة) 📝</option>
                  <option value="revision">كورس مراجعات نهائية مكثفة ⚡</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={(courseYear.includes('الابتدائي') || courseYear.includes('الإعدادي')) ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    السنة الدراسية:
                  </label>
                  <select
                    value={courseYear}
                    onChange={(e) => {
                      const newGrade = e.target.value as SchoolYearGrade;
                      setCourseYear(newGrade);
                      if (newGrade.includes('الابتدائي') || newGrade.includes('الإعدادي')) {
                        setCourseDivision('');
                      } else if (newGrade.includes('الثالث الثانوي')) {
                        setCourseDivision('علمي علوم');
                      } else {
                        setCourseDivision('بكالوريا');
                      }
                    }}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="الصف الأول الثانوي">الصف الأول الثانوي — مادة الفلسفة</option>
                  </select>
                </div>

                {!(courseYear.includes('الابتدائي') || courseYear.includes('الإعدادي')) && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {courseYear.includes('الثالث الثانوي') ? 'الشعبة (تالتة ثانوي):' : 'الشعبة (المرحلة الثانوية):'}
                    </label>
                    {courseYear.includes('الثالث الثانوي') ? (
                      <select
                        value={courseDivision}
                        onChange={(e) => setCourseDivision(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="علمي علوم">علمي علوم</option>
                        <option value="علمي رياضة">علمي رياضة</option>
                        <option value="شعبة أدبي">شعبة أدبي</option>
                        <option value="بكالوريا">بكالوريا</option>
                        <option value="عام">عام</option>
                        <option value="أزهر">أزهر</option>
                        <option value="عام لجميع الشعب">عام لجميع الشعب</option>
                      </select>
                    ) : (
                      <select
                        value={courseDivision}
                        onChange={(e) => setCourseDivision(e.target.value)}
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="بكالوريا">بكالوريا</option>
                        <option value="عام">عام</option>
                        <option value="أزهر">أزهر</option>
                        <option value="عام لجميع الشعب">عام لجميع الشعب</option>
                      </select>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  سعر الاشتراك (ج.م) - ضع 0 إذا كان مجانياً:
                </label>
                <input
                  type="number"
                  min="0"
                  value={coursePrice}
                  onChange={(e) => setCoursePrice(Number(e.target.value))}
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف الكورس:
                </label>
                <textarea
                  rows={3}
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  placeholder="وصف مختصر لمحتويات الحصص وأهداف الكورس..."
                  className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Cover Image Upload / Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  صورة غلاف الكورس:
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <img src={courseCoverImage} alt="cover" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="cursor-pointer px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-2">
                      <Image className="w-3.5 h-3.5" />
                      <span>رفع صورة من جهازك</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, setCourseCoverImage)}
                      />
                    </label>
                    <p className="text-[10px] text-slate-400">يفضل صورة أفقية ذات جودة عالية</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCourseModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md"
                >
                  {editingCourse ? 'حفظ التعديلات' : 'إضافة الكورس الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD SEQUENTIAL EXAM TO COURSE */}
      {/* ========================================================================= */}
      {isAddExamModalOpen && selectedCourseForExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>إضافة امتحان إلكتروني/مقالي للكورس</span>
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  الكورس: {selectedCourseForExam.title}
                </p>
              </div>
              <button
                onClick={() => setIsAddExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان الامتحان:
                  </label>
                  <input
                    type="text"
                    required
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="مثال: امتحان الحصة الأولى - القياس الفيزيائي"
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الدرس / الحصة المرتبطة:
                  </label>
                  <input
                    type="text"
                    required
                    value={examLessonTitle}
                    onChange={(e) => setExamLessonTitle(e.target.value)}
                    placeholder="مثال: الحصة 1: أساسيات المنهج"
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    مدة الامتحان (بالدقائق):
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={examDuration}
                    onChange={(e) => setExamDuration(Number(e.target.value))}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نسبة النجاح % المطلوبة لفتح الحصة التالية:
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={examPassing}
                    onChange={(e) => setExamPassing(Number(e.target.value))}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    الأسئلة المضافة ({examQuestions.length}):
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToExam('mcq')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ سؤال اختيار من متعدد (MCQ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestionToExam('essay')}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ سؤال مقالي للتصحيح</span>
                    </button>
                  </div>
                </div>

                {examQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        سؤال {idx + 1} ({q.type === 'mcq' ? 'اختيار من متعدد' : 'سؤال مقالي'})
                      </span>
                      <button
                        type="button"
                        onClick={() => setExamQuestions(examQuestions.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={(e) => {
                        const updated = [...examQuestions];
                        updated[idx].questionText = e.target.value;
                        setExamQuestions(updated);
                      }}
                      placeholder="اكتب نص السؤال هنا..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />

                    {q.type === 'mcq' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctOptionIndex === optIdx}
                              onChange={() => {
                                const updated = [...examQuestions];
                                updated[idx].correctOptionIndex = optIdx;
                                setExamQuestions(updated);
                              }}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const updated = [...examQuestions];
                                updated[idx].options[optIdx] = e.target.value;
                                setExamQuestions(updated);
                              }}
                              className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddExamModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md"
                >
                  حفظ ونشر الامتحان
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Managing Course Lessons, Infinite Videos, PDFs, and Exams */}
      {managingLessonsCourse && (
        <CourseLessonManagerModal
          course={managingLessonsCourse}
          isOpen={true}
          onClose={() => setManagingLessonsCourse(null)}
          onSaveCourse={(updatedCourse) => {
            const exists = allCourses.some((c) => c.id === updatedCourse.id);
            const updated = exists
              ? allCourses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
              : [updatedCourse, ...allCourses];
            onUpdateCourses(updated);
            saveCourses(updated);
            setManagingLessonsCourse(updatedCourse);
            showFeedback(`تم حفظ وتحديث محتوى دروس كورس (${updatedCourse.title}) بنجاح! 🌟`);
          }}
        />
      )}
    </div>
  );
};
