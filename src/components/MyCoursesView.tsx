import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  PlayCircle,
  Award,
  Clock,
  ArrowLeft,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Lock,
  Layers,
  HelpCircle,
  BookmarkCheck
} from 'lucide-react';
import { Course, User, AppView } from '../types';

interface MyCoursesViewProps {
  currentUser: User | null;
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onNavigate: (view: AppView) => void;
  onOpenAuth: (mode?: 'login' | 'signup' | 'parent') => void;
}

export const MyCoursesView: React.FC<MyCoursesViewProps> = ({
  currentUser,
  courses,
  onSelectCourse,
  onNavigate,
  onOpenAuth,
}) => {
  if (!currentUser) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-md mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto font-black">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">يرجى تسجيل الدخول أولاً</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          سجل دخولك كطالب للاطلاع على الكورسات التي تشترك بها ومتابعة الحصص والامتحانات التتابعية.
        </p>
        <button
          onClick={() => onOpenAuth('login')}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs inline-flex items-center gap-2 cursor-pointer"
        >
          <span>تسجيل دخول الطالب الآن</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const enrolledCourseIds = currentUser.enrolledCourseIds || [];
  
  // Directly enrolled courses (confirmed via code, admin, or free enrollment)
  const directlyEnrolledCourses = courses.filter((c) => enrolledCourseIds.includes(c.id));
  
  // All courses relevant to the student's academic year or free
  const academicYearCourses = courses.filter(
    (c) => c.schoolYear === currentUser.schoolYear || c.price === 0
  );

  const [activeTab, setActiveTab] = useState<'enrolled' | 'all'>(
    directlyEnrolledCourses.length > 0 ? 'enrolled' : 'all'
  );

  const displayedCourses = activeTab === 'enrolled' ? directlyEnrolledCourses : academicYearCourses;

  // Calculate student statistics
  const totalEnrolled = directlyEnrolledCourses.length;
  let totalExamsCount = 0;
  let totalPassedExams = 0;

  directlyEnrolledCourses.forEach((c) => {
    const cExams = (c.exams?.length || 0) + (c.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0);
    totalExamsCount += cExams;
    
    c.exams?.forEach((ex) => {
      if (currentUser?.examResults?.[ex.id]?.passed) totalPassedExams++;
    });
    c.lessons?.forEach((l) => {
      l.exams?.forEach((ex) => {
        if (currentUser?.examResults?.[ex.id]?.passed) totalPassedExams++;
      });
    });
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                خطة المتابعة والمقررات 2027
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                الطالب: {currentUser.name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              كورساتي المحفوظة والمشترك بها 🎓
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              تحتفظ المنصة بجميع الكورسات والمقررات التي قمت بالاشتراك بها وتفعيلها. جميع الدروس والامتحانات مفتوحة لك بشكل دائم.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('courses')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs flex items-center gap-2 transition-all border border-white/10 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>دليل جميع الكورسات</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-300 block font-medium">الكورسات المشترك بها</span>
              <span className="text-lg font-black text-white">{totalEnrolled} كورس مفعل</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-300 block font-medium">الامتحانات المجتازة</span>
              <span className="text-lg font-black text-white">{totalPassedExams} امتحان</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-300 block font-medium">السنة الدراسية</span>
              <span className="text-sm font-black text-white truncate">{currentUser.schoolYear}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs / Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('enrolled')}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'enrolled'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>الكورسات المشترك بها رسميًا ({directlyEnrolledCourses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>جميع مقررات صفي الدراسي ({academicYearCourses.length})</span>
          </button>
        </div>
      </div>

      {/* Courses Listing */}
      {displayedCourses.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto">
          <GraduationCap className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="font-black text-slate-900 dark:text-white text-base">
            {activeTab === 'enrolled'
              ? 'لم تشترك في أي كورس بعد'
              : 'لا توجد كورسات متاحة لصفك الدراسي حالياً'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {activeTab === 'enrolled'
              ? 'عند إدخال كود تفعيل الكورس أو فتح أي كورس مجاني، سيتم حفظه وتثبيته في حسابك تلقائياً لتستطيع استئناف المذاكرة وحل الامتحانات في أي وقت.'
              : 'يمكنك استعراض دليل الكورسات الشامل للاطلاع على كافة المواد المتاحة.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('courses')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>تصفح دليل الكورسات والاشتراك</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedCourses.map((course) => {
            const isDirectlyEnrolled = enrolledCourseIds.includes(course.id);
            const isFree = course.price === 0;
            const examsCount =
              (course.exams?.length || 0) +
              (course.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0);

            let passedExamsCount = 0;
            course.exams?.forEach((ex) => {
              if (currentUser?.examResults?.[ex.id]?.passed) passedExamsCount++;
            });
            course.lessons?.forEach((l) => {
              l.exams?.forEach((ex) => {
                if (currentUser?.examResults?.[ex.id]?.passed) passedExamsCount++;
              });
            });

            const progress = examsCount > 0 ? Math.round((passedExamsCount / examsCount) * 100) : 0;

            return (
              <div
                key={course.id}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-xl transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Thumbnail / Header */}
                  <div className="relative h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {course.coverImage ? (
                      <img
                        src={course.coverImage}
                        alt={course.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900 text-white font-black text-lg p-4 text-center">
                        {course.title}
                      </div>
                    )}

                    {/* Enrolled Badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {isDirectlyEnrolled ? (
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>مشترك ومفعّل ✅</span>
                        </span>
                      ) : isFree ? (
                        <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>كورس مجاني 🎁</span>
                        </span>
                      ) : (
                        <span className="bg-slate-900/80 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>يتطلب كود تفعيل</span>
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-500/30">
                      {course.subject || 'مادة دراسية'}
                    </div>

                    <div className="absolute bottom-3 right-3">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                        {course.schoolYear}
                      </span>
                    </div>
                  </div>

                  {/* Body Details */}
                  <div className="p-5 space-y-3">
                    <h3 className="font-black text-base text-slate-900 dark:text-white leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {course.description || 'كورس شامل يحتوي على محاضرات تفاعلية وامتحانات متتالية.'}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500 dark:text-slate-400">إنجاز الامتحانات</span>
                        <span className="text-indigo-600 dark:text-indigo-400">
                          {passedExamsCount} من {examsCount} امتحان مجتاز ({progress}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(progress > 0 ? 5 : 0, progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0">
                  <button
                    onClick={() => onSelectCourse(course)}
                    className={`w-full py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                      isDirectlyEnrolled || isFree
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    }`}
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>
                      {isDirectlyEnrolled
                        ? 'متابعة الكورس والامتحانات'
                        : isFree
                        ? 'دخول وتثبيت الكورس المجاني'
                        : 'تفعيل الاشتراك بالكود'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
