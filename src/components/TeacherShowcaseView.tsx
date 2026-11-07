import React, { useState } from 'react';
import {
  BookOpen,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Video,
  FileText,
  HelpCircle,
  Users,
  MessageCircle,
  Share2,
  Award,
  ChevronLeft,
  Trash2
} from 'lucide-react';
import { Course, PlatformSettings, User } from '../types';

interface TeacherShowcaseViewProps {
  teacher: User;
  allTeachers: User[];
  courses: Course[];
  currentUser: User | null;
  platformSettings: PlatformSettings;
  onBack: () => void;
  onSelectCourse: (course: Course) => void;
  onSelectTeacher: (teacher: User) => void;
  onDeleteTeacher?: (teacher: User) => void;
}

export const TeacherShowcaseView: React.FC<TeacherShowcaseViewProps> = ({
  teacher,
  allTeachers,
  courses,
  currentUser,
  platformSettings,
  onBack,
  onSelectCourse,
  onSelectTeacher,
  onDeleteTeacher,
}) => {
  const [selectedType, setSelectedType] = useState<'all' | 'integrated' | 'exams_only'>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Filter courses for this specific teacher
  const teacherCourses = courses.filter((c) => {
    if (!c.isPublished) return false;
    const matchesId = c.instructorId && c.instructorId === teacher.id;
    const matchesTeacherName = c.teacherName && c.teacherName.trim() === teacher.name.trim();
    const matchesInstructor = c.instructor && c.instructor.trim() === teacher.name.trim();
    const matchesAccount = teacher.accountNumber && c.instructorId === teacher.accountNumber;
    return matchesId || matchesTeacherName || matchesInstructor || matchesAccount;
  });

  // Filter by type
  const filteredCourses = teacherCourses.filter((course) => {
    const isCourseIntegrated =
      course.courseType === 'integrated' || (course.lessons && course.lessons.length > 0);
    if (selectedType === 'integrated') return isCourseIntegrated;
    if (selectedType === 'exams_only') return !isCourseIntegrated;
    return true;
  });

  // Calculate teacher stats
  const totalLessons = teacherCourses.reduce((acc, c) => acc + (c.lessons?.length || 0), 0);
  const totalVideos = teacherCourses.reduce(
    (acc, c) => acc + (c.lessons?.reduce((sum, l) => sum + (l.videos?.length || 0), 0) || 0),
    0
  );
  const totalPdfs = teacherCourses.reduce(
    (acc, c) => acc + (c.lessons?.reduce((sum, l) => sum + (l.pdfs?.length || 0), 0) || 0),
    0
  );
  const totalExams = teacherCourses.reduce(
    (acc, c) =>
      acc +
      (c.exams?.length || 0) +
      (c.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0),
    0
  );

  const handleShareTeacher = () => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // ignore
    }
  };

  // Other teachers excluding current
  const otherTeachers = allTeachers.filter((t) => t.id !== teacher.id);

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Navigation Breadcrumb & Back */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-indigo-600 font-black text-xs transition-all shadow-xs cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>العودة للصفحة الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={handleShareTeacher}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 font-black text-xs transition-all cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{copiedLink ? 'تم نسخ الرابط! ✓' : 'مشاركة صفحة المعلم'}</span>
        </button>
      </div>

      {/* Teacher Profile Showcase Hero Card */}
      <div className="relative rounded-[36px] overflow-hidden border border-slate-200 bg-white shadow-xl">
        {/* Banner Top Gradient */}
        <div className="h-36 sm:h-44 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-xs font-black px-3 py-1 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{teacher.gender === 'أنثى' ? 'معلمة معتمدة وموثقة بالمنصة' : 'معلم معتمد وموثق بالمنصة'}</span>
            </span>
          </div>
        </div>

        {/* Profile Content Details */}
        <div className="p-6 sm:p-10 pt-0 relative -mt-16 sm:-mt-20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-right">
              {/* Teacher Avatar */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-slate-100 border-4 border-white shadow-xl shrink-0">
                {teacher.avatarUrl ? (
                  <img
                    src={teacher.avatarUrl}
                    alt={teacher.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-400">
                    <Users className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-white" title="معتمد">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Names & Subject Titles */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{teacher.name}</h1>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${teacher.gender === 'أنثى' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                    {teacher.gender === 'أنثى' ? '👩‍🏫 معلمة معتمدة' : '👨‍🏫 معلم معتمد'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-bold text-slate-600">
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800">
                    مادة: {teacher.subject || 'جميع المواد'}
                  </span>
                  {teacher.specialty &&
                    !(teacher.schoolYear?.includes('الابتدائي') || teacher.schoolYear?.includes('الإعدادي')) && (
                    <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                      الشعبة: {teacher.specialty}
                    </span>
                  )}
                  {teacher.schoolYear && (
                    <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200">
                      {teacher.schoolYear}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions (WhatsApp inquiry + Admin Delete) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 shrink-0">
              {currentUser?.role === 'admin' && onDeleteTeacher && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-md shadow-rose-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف المدرس وكورساته 🗑️</span>
                </button>
              )}
              <a
                href={`https://wa.me/201040672314?text=${encodeURIComponent(
                  `السلام عليكم، أود الاستفسار والاشتراك في كورسات ${teacher.gender === 'أنثى' ? 'الأستاذة' : 'الأستاذ'}: ${teacher.name} (${teacher.subject || ''}) على منصة قلب العلم.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-200 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>استفسر واشترك عبر الواتساب</span>
              </a>
            </div>
          </div>

          {confirmDeleteOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-[28px] w-full max-w-md shadow-2xl p-6 space-y-4 text-right">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">تأكيد حذف المدرس وكورساته</h4>
                    <p className="text-xs text-slate-500">سيتم حذف حساب المدرس وجميع كورساته من المنصة نهائياً</p>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900">
                  هل أنت متأكد من حذف حساب <strong>{teacher.name}</strong> وكافة الكورسات الخاصة به ({teacherCourses.length} كورس)؟
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteOpen(false);
                      onDeleteTeacher?.(teacher);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي 🗑️</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Teacher Bio / Philosophy */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-1">
            <span className="font-black text-slate-900 block text-xs">
              {teacher.gender === 'أنثى' ? 'نبذة عن المحتوى الأكاديمي للمعلمة:' : 'نبذة عن المحتوى الأكاديمي للمعلم:'}
            </span>
            <p className="text-slate-600">
              {teacher.gender === 'أنثى' ? 'تقدم الأستاذة' : 'يقدم الأستاذ'} <strong>{teacher.name}</strong> شرحاً منهجياً مبسطاً وتدريباً تفاعلياً مكثفاً لمادة{' '}
              <strong>{teacher.subject || 'التخصص'}</strong> وفق أحدث المعايير الوزارية والأسئلة الاستنتاجية ونظام الامتحانات التسلسلية لجميع المراحل الدراسية.
            </p>
          </div>

          {/* Teacher Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-indigo-950 font-mono">{teacherCourses.length}</div>
                <div className="text-[11px] font-bold text-indigo-700">كورسات منشورة</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-purple-950 font-mono">{totalLessons}</div>
                <div className="text-[11px] font-bold text-purple-700">دروس تفاعلية</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-amber-950 font-mono">{totalVideos}</div>
                <div className="text-[11px] font-bold text-amber-800">فيديو شرح + {totalPdfs} PDF</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-lg font-black text-emerald-950 font-mono">{totalExams}</div>
                <div className="text-[11px] font-bold text-emerald-700">امتحانات تسلسلية</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Courses Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                الكورسات الأكاديمية الخاصة بالمعلم
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              كورسات ومناهج {teacher.name} ({teacherCourses.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              تصفح الكورسات المتكاملة وبنوك الامتحانات المعدة خصيصاً بواسطة المعلم واشترك لبدء التدريب
            </p>
          </div>

          {/* Type Filter Pills */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedType === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({teacherCourses.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('integrated')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                selectedType === 'integrated'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>كورسات متكاملة</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('exams_only')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                selectedType === 'exams_only'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3 h-3" />
              <span>بنوك امتحانات</span>
            </button>
          </div>
        </div>

        {/* Courses Cards Grid */}
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const isCourseIntegrated =
                course.courseType === 'integrated' ||
                (course.lessons && course.lessons.length > 0);
              const lessonsCount = course.lessons?.length || 0;
              const videosCount =
                course.lessons?.reduce((sum, l) => sum + (l.videos?.length || 0), 0) || 0;
              const pdfsCount =
                course.lessons?.reduce((sum, l) => sum + (l.pdfs?.length || 0), 0) || 0;
              const examsCount =
                (course.exams?.length || 0) +
                (course.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0);
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
                  onClick={() => onSelectCourse(course)}
                  className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <img
                        src={course.coverImage}
                        alt={`كورس ${course.title} - ${course.schoolYear}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-start">
                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-900/80 text-white backdrop-blur-md">
                          {course.schoolYear}
                        </span>
                        {course.division &&
                          !(course.schoolYear?.includes('الابتدائي') || course.schoolYear?.includes('الإعدادي')) && (
                          <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                            {course.division}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-black px-2.5 py-0.5 rounded-full text-white ${
                            isCourseIntegrated ? 'bg-purple-600/90' : 'bg-emerald-600/90'
                          }`}
                        >
                          {isCourseIntegrated ? 'شرح متكامل (دروس + فيديوهات + PDF)' : 'بنك امتحانات'}
                        </span>
                      </div>

                      {hasDiscount && (
                        <div className="absolute top-3 left-3">
                          <span className="text-[11px] font-black px-3 py-1 rounded-full bg-rose-600 text-white shadow-lg flex items-center gap-1">
                            🔥 خصم {discountPercent}%
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-3 left-3">
                        {hasDiscount ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/90 backdrop-blur-md text-white shadow-lg border border-white/15">
                            <span className="text-[11px] font-bold text-rose-300 line-through decoration-rose-400 decoration-2">
                              {course.originalPrice} {course.priceCurrency || 'ج.م'}
                            </span>
                            <span className="text-xs font-black text-emerald-400">
                              {course.price === 0 ? 'مجاني بالكامل' : `${course.price} ${course.priceCurrency || 'ج.م'}`}
                            </span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-600 text-white">
                              -{discountPercent}%
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`text-xs font-black px-3 py-1 rounded-full shadow-md ${
                              course.price === 0 ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                            }`}
                          >
                            {course.price === 0 ? 'مجاني بالكامل' : `${course.price} ${course.priceCurrency}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                        <span>{course.subject}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-black">إعداد: {course.teacherName || course.instructor}</span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                        {course.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>

                      {hasDiscount && (
                        <div className="p-2.5 rounded-2xl bg-gradient-to-l from-rose-50 via-amber-50/60 to-emerald-50 border border-rose-200/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400 line-through decoration-rose-500 decoration-2">
                              {course.originalPrice} {course.priceCurrency || 'ج.م'}
                            </span>
                            <span className="text-base font-black text-emerald-700">
                              {course.price === 0 ? 'مجاني' : `${course.price} ${course.priceCurrency || 'ج.م'}`}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black shadow-xs">
                            خصم {discountPercent}% 🔥
                          </span>
                        </div>
                      )}

                      {/* Integrated stats indicators */}
                      {isCourseIntegrated && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            <span>{lessonsCount} دروس</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            <span>{videosCount} فيديو</span>
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>{pdfsCount} PDF</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 pt-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{examsCount} اختبارات وامتحانات</span>
                    </div>

                    <div className="text-xs font-black text-indigo-600 flex items-center gap-1 group-hover:-translate-x-1 transition-transform">
                      <span>دخول وتصفح الكورس</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-[32px] p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">لا توجد كورسات منشورة حالياً لهذا المعلم</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              يقوم المعلم بإعداد المناهج والامتحانات حالياً وسيتم نشرها قريباً، يمكنك الاستفسار ومتابعة التحديثات عبر الواتساب.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-sm"
            >
              العودة لكافة كورسات المنصة
            </button>
          </div>
        )}
      </div>

      {/* Other Accredited Teachers Showcase Section */}
      {otherTeachers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>تصفح باقي معلمي المنصة المعتمدين</span>
              </h3>
              <p className="text-xs text-slate-500">اختر معلماً للاطلاع على صفحته الشخصية ومناهجه</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {otherTeachers.map((other) => {
              const count = courses.filter(
                (c) =>
                  c.instructorId === other.id ||
                  c.teacherName === other.name ||
                  c.instructor === other.name
              ).length;

              return (
                <div
                  key={other.id}
                  onClick={() => {
                    onSelectTeacher(other);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white transition-all cursor-pointer group flex items-center gap-3 shadow-2xs hover:shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                    {other.avatarUrl ? (
                      <img
                        src={other.avatarUrl}
                        alt={other.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 truncate">
                      {other.name}
                    </h4>
                    <div className="text-[10px] text-slate-500 font-bold truncate">
                      مادة: {other.subject || 'عام'} • {count} كورسات
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:-translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
