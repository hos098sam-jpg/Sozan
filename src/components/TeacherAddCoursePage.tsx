import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Plus,
  Save,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Layers,
  GraduationCap
} from 'lucide-react';
import { Course, CourseType, SchoolYearGrade, User, AppView } from '../types';
import { compressImageFile } from '../utils/imageUtils';
import { CourseLessonManagerModal } from './CourseLessonManagerModal';
import { saveCourses } from '../data/initialData';

interface TeacherAddCoursePageProps {
  currentTeacher: User;
  allCourses: Course[];
  editingCourseId?: string | null;
  onUpdateCourses: (courses: Course[]) => void;
  onNavigate: (view: AppView) => void;
}

export const TeacherAddCoursePage: React.FC<TeacherAddCoursePageProps> = ({
  currentTeacher,
  allCourses,
  editingCourseId,
  onUpdateCourses,
  onNavigate,
}) => {
  const teacherSubject = currentTeacher.subject || 'مادة عامة';
  const teacherSpecialty = currentTeacher.specialty || 'عام لجميع الشعب';

  // Find target course if editing
  const existingCourse = editingCourseId
    ? allCourses.find((c) => c.id === editingCourseId)
    : null;

  // Security check: teacher cannot edit courses of another teacher!
  const isOwner = !existingCourse ||
    existingCourse.instructorId === currentTeacher.id ||
    existingCourse.instructor === currentTeacher.name ||
    existingCourse.teacherName === currentTeacher.name;

  // Form states
  const [courseTitle, setCourseTitle] = useState(existingCourse?.title || '');
  const [courseType, setCourseType] = useState<CourseType>(existingCourse?.courseType || 'integrated');
  const [courseYear, setCourseYear] = useState<SchoolYearGrade>(existingCourse?.schoolYear as SchoolYearGrade || 'الصف الأول الثانوي');
  const [courseDivision, setCourseDivision] = useState<string>(existingCourse?.division || teacherSpecialty);
  const [coursePrice, setCoursePrice] = useState<number>(existingCourse?.price || 0);
  const [coursePaymentPhone, setCoursePaymentPhone] = useState<string>(existingCourse?.paymentPhone || '');
  const [coursePaymentQrCode, setCoursePaymentQrCode] = useState<string>(existingCourse?.paymentQrCode || '');
  const [courseDescription, setCourseDescription] = useState(existingCourse?.description || '');
  const [courseCoverImage, setCourseCoverImage] = useState(
    existingCourse?.coverImage ||
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop'
  );

  const [managingLessonsCourse, setManagingLessonsCourse] = useState<Course | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 1000, 0.75)
      .then((compressed) => {
        if (compressed) setCourseCoverImage(compressed);
      })
      .catch(() => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setCourseCoverImage(reader.result);
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const handleQrCodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 800, 0.8)
      .then((compressed) => {
        if (compressed) setCoursePaymentQrCode(compressed);
      })
      .catch(() => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setCoursePaymentQrCode(reader.result);
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      showToast('غير مصرح لك بتعديل كورس تابع لمعلم آخر!', 'error');
      return;
    }
    if (!courseTitle.trim()) {
      showToast('يرجى إدخال اسم الكورس', 'error');
      return;
    }

    const isPrimaryOrPrep = courseYear.includes('الابتدائي') || courseYear.includes('الإعدادي');
    const effectiveDivision = isPrimaryOrPrep
      ? ''
      : teacherSpecialty && teacherSpecialty !== 'عام لجميع الشعب'
      ? teacherSpecialty
      : courseDivision;

    if (existingCourse) {
      // Update existing course owned by teacher
      const updated = allCourses.map((c) =>
        c.id === existingCourse.id
          ? {
              ...c,
              title: courseTitle.trim(),
              courseType,
              schoolYear: courseYear,
              division: effectiveDivision,
              price: Number(coursePrice) || 0,
              paymentPhone: coursePaymentPhone.trim() || undefined,
              paymentQrCode: coursePaymentQrCode || undefined,
              description: courseDescription.trim(),
              coverImage: courseCoverImage,
              subject: teacherSubject, // Enforce teacher's subject
            }
          : c
      );
      onUpdateCourses(updated);
      saveCourses(updated);
      showToast('تم تحديث بيانات الكورس بنجاح ✅');
      setTimeout(() => onNavigate('teacher_dashboard'), 1000);
    } else {
      // Create new course for this teacher
      const newCourse: Course = {
        id: `course_${Date.now()}`,
        title: courseTitle.trim(),
        courseType,
        schoolYear: courseYear,
        division: effectiveDivision,
        price: Number(coursePrice) || 0,
        priceCurrency: 'ج.م',
        paymentPhone: coursePaymentPhone.trim() || undefined,
        paymentQrCode: coursePaymentQrCode || undefined,
        description: courseDescription.trim(),
        instructor: currentTeacher.name,
        instructorId: currentTeacher.id,
        teacherName: currentTeacher.name,
        teacherSubject: teacherSubject,
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
      onUpdateCourses(updated);
      saveCourses(updated);
      showToast('تم إنشاء الكورس بنجاح! سيتم نقلك لإدارة الدروس 🚀');
      setTimeout(() => {
        setManagingLessonsCourse(newCourse);
      }, 700);
    }
  };

  // If unauthorized to edit this course
  if (existingCourse && !isOwner) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center animate-fadeIn" dir="rtl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 shadow-xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            غير متاح تعديل هذا الكورس
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            هذا الكورس مسجل باسم معلم آخر. وفقاً لصلاحيات المدرسين، يمكنك فقط تعديل وإضافة الكورسات الخاصة بك.
          </p>
          <button
            onClick={() => onNavigate('teacher_dashboard')}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md cursor-pointer"
          >
            العودة إلى لوحة تحكم المعلم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn pb-16" dir="rtl">
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

      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('teacher_dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-black text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للوحة المعلم</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            المادة المعتمدة: {teacherSubject}
          </span>
        </div>
      </div>

      {/* Main Full Page Form Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[36px] p-6 sm:p-10 shadow-xl space-y-8">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {existingCourse ? `تعديل الكورس: ${existingCourse.title}` : 'إضافة كورس تعليمي جديد (صفحة كاملة)'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                الكورس سيظهر للطلاب تحت إشراف وتدريس الأستاذ: <b>{currentTeacher.name}</b>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveCourse} className="space-y-6">
          {/* Row 1: Course Title */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              عنوان الكورس التعليمي *
            </label>
            <input
              type="text"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="مثال: كورس الشرح والمراجعة في مادة الفلسفة — الصف الأول الثانوي"
              required
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          {/* Row 2: Course Type & Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                نوع المحتوى
              </label>
              <select
                value={courseType}
                onChange={(e) => setCourseType(e.target.value as CourseType)}
                className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
              >
                <option value="integrated">كورس متكامل (فيديوهات + ملازم PDF + امتحانات)</option>
                <option value="exams_only">امتحانات ومراجعات فقط</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                الصف الدراسي
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
                className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500 text-right"
              >
                <option value="الصف الأول الثانوي">الصف الأول الثانوي — مادة الفلسفة</option>
              </select>
            </div>
          </div>

          {/* Row 3: Division (Only for Secondary Stage) & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!(courseYear.includes('الابتدائي') || courseYear.includes('الإعدادي')) && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  {courseYear.includes('الثالث الثانوي') ? 'الشعبة (تالتة ثانوي)' : 'الشعبة (المرحلة الثانوية)'}
                </label>
                {teacherSpecialty && teacherSpecialty !== 'عام لجميع الشعب' ? (
                  <input
                    type="text"
                    value={teacherSpecialty}
                    disabled
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold text-right disabled:opacity-75"
                  />
                ) : courseYear.includes('الثالث الثانوي') ? (
                  <select
                    value={courseDivision}
                    onChange={(e) => setCourseDivision(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold text-right"
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
                    className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold text-right"
                  >
                    <option value="بكالوريا">بكالوريا</option>
                    <option value="عام">عام</option>
                    <option value="أزهر">أزهر</option>
                    <option value="عام لجميع الشعب">عام لجميع الشعب</option>
                  </select>
                )}
                <p className="text-[11px] text-slate-400">
                  {teacherSpecialty && teacherSpecialty !== 'عام لجميع الشعب' ? 'مقيد بتخصص حساب المعلم المعتمد.' : 'اختر الشعبة المناسبة للمرحلة الثانوية.'}
                </p>
              </div>
            )}

            <div className={`space-y-2 ${(courseYear.includes('الابتدائي') || courseYear.includes('الإعدادي')) ? 'sm:col-span-2' : ''}`}>
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                سعر الاشتراك (0 = مجاني بالكامل)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={coursePrice}
                  onChange={(e) => setCoursePrice(Number(e.target.value))}
                  className="w-full p-3.5 pl-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-bold text-right"
                />
                <span className="absolute left-4 top-3.5 text-xs text-slate-400 font-black">ج.م</span>
              </div>
            </div>
          </div>

          {/* Row 3.5: Payment Phone & Wallet QR Barcode (for paid courses) */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                💳 بيانات استلام الاشتراكات لهذا الكورس (رقم المحفظة أو باركود QR Code)
              </h4>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-indigo-100">
                اختياري - يظهر للطالب عند الاشتراك
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  رقم استلام الاشتراكات (فودافون كاش / محفظة إلكترونية / إنستا باي)
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={coursePaymentPhone}
                  onChange={(e) => setCoursePaymentPhone(e.target.value)}
                  placeholder="مثال: 01040672314"
                  className="w-full p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-black font-mono text-left"
                />
                <p className="text-[10px] text-slate-500">
                  في حال تركه فارغاً سيظهر رقم المحفظة الافتراضي للمنصة تلقائياً.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  صورة باركود المحفظة (QR Code) للمسح السريع
                </label>
                <div className="flex items-center gap-3">
                  {coursePaymentQrCode ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white border border-indigo-200 shrink-0 p-1">
                      <img
                        src={coursePaymentQrCode}
                        alt="QR Code"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setCoursePaymentQrCode('')}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center font-black"
                        title="حذف صورة الباركود"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrCodeUpload}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-white file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      ارفع صورة الباركود (QR) الخاص بمحفظتك أو إنستا باي ليقوم الطالب بمسحه مباشرة.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Description */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              وصف الكورس وما يتعلمه الطالب
            </label>
            <textarea
              rows={4}
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              placeholder="اكتب نبذة مختصرة عن الدروس والوحدات التي يتضمنها الكورس..."
              className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold text-right"
            />
          </div>

          {/* Row 5: Cover Image */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              صورة غلاف الكورس
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48 h-32 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                <img
                  src={courseCoverImage}
                  alt="غلاف الكورس"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-2 w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  يمكنك رفع صورة من جهازك، أو استخدام الصورة الافتراضية.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="flex-1 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>{existingCourse ? 'حفظ التعديلات' : 'إنشاء الكورس والبدء في إضافة الدروس 🚀'}</span>
            </button>

            {existingCourse && (
              <button
                type="button"
                onClick={() => setManagingLessonsCourse(existingCourse)}
                className="py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>إدارة فهرس الدروس والفيديوهات ({existingCourse.lessons?.length || 0})</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lesson Manager Modal if open */}
      {managingLessonsCourse && (
        <CourseLessonManagerModal
          isOpen={true}
          course={managingLessonsCourse}
          onClose={() => {
            setManagingLessonsCourse(null);
            onNavigate('teacher_dashboard');
          }}
          onSaveCourse={(updatedCourse) => {
            const exists = allCourses.some((c) => c.id === updatedCourse.id);
            const updated = exists
              ? allCourses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
              : [updatedCourse, ...allCourses];
            onUpdateCourses(updated);
            saveCourses(updated);
            setManagingLessonsCourse(updatedCourse);
            showToast('تم حفظ تحديثات الدروس والامتحانات بنجاح ✅');
          }}
        />
      )}
    </div>
  );
};

export default TeacherAddCoursePage;
