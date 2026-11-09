import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Lock,
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Video,
  FileText,
  HelpCircle
} from 'lucide-react';
import { Course, SchoolYearGrade, User } from '../types';
import {
  saveCurrentUser,
  saveUsers,
  getSavedUsers,
  saveStudentEnrolledCourse
} from '../data/initialData';
import { enrollStudentInCourseInFirestore } from '../auth';
import { CourseBundlesSection } from './CourseBundlesSection';

interface CoursesViewProps {
  courses: Course[];
  currentUser: User | null;
  teachers?: User[];
  onSelectCourse: (course: Course) => void;
  onSelectTeacher?: (teacher: User) => void;
  onUpdateUser?: (user: User) => void;
  onOpenAuth?: () => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  courses,
  currentUser,
  teachers = [],
  onSelectCourse,
  onSelectTeacher,
  onUpdateUser,
  onOpenAuth,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'integrated' | 'exams_only'>('all');

  const isStudent = currentUser && currentUser.role === 'student';
  const isApprovedStudent = isStudent && (currentUser.status === 'active' || currentUser.status === 'approved' || !currentUser.status);

  // Grade matching helper
  const matchesStudentGrade = (courseYear: string, studentYear: string) => {
    if (!studentYear) return true;
    if (courseYear === studentYear) return true;
    if (studentYear.includes(courseYear) || courseYear.includes(studentYear)) return true;

    if (studentYear.includes('الأول الابتدائي') && courseYear.includes('الأول الابتدائي')) return true;
    if (studentYear.includes('الثاني الابتدائي') && courseYear.includes('الثاني الابتدائي')) return true;
    if (studentYear.includes('الثالث الابتدائي') && courseYear.includes('الثالث الابتدائي')) return true;
    if (studentYear.includes('الرابع الابتدائي') && courseYear.includes('الرابع الابتدائي')) return true;
    if (studentYear.includes('الخامس الابتدائي') && courseYear.includes('الخامس الابتدائي')) return true;
    if (studentYear.includes('السادس الابتدائي') && courseYear.includes('السادس الابتدائي')) return true;
    
    if (studentYear.includes('الأول الإعدادي') && courseYear.includes('الأول الإعدادي')) return true;
    if (studentYear.includes('الثاني الإعدادي') && courseYear.includes('الثاني الإعدادي')) return true;
    if (studentYear.includes('الثالث الإعدادي') && courseYear.includes('الثالث الإعدادي')) return true;
    
    if (studentYear.includes('الأول الثانوي') && courseYear.includes('الأول الثانوي')) return true;
    if (studentYear.includes('الثاني الثانوي') && courseYear.includes('الثاني الثانوي')) return true;
    if (studentYear.includes('الثالث الثانوي') && (courseYear.includes('الثالث الثانوي') || courseYear.includes('بكالوريا'))) return true;

    return false;
  };

  // Published courses: show all published courses (isPublished !== false)
  const publishedCourses = courses.filter((c) => c.isPublished !== false);

  // Extract unique subjects
  const subjects = Array.from(new Set(publishedCourses.map((c) => c.subject).filter(Boolean)));

  // Filter courses by search, dropdowns, and course type
  const filteredCourses = publishedCourses.filter((course) => {
    const matchesSearch =
      !searchQuery.trim() ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.instructor && course.instructor.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesYear =
      selectedYear === 'all' ||
      (selectedYear === 'my_grade' && currentUser?.schoolYear && matchesStudentGrade(course.schoolYear, currentUser.schoolYear)) ||
      course.schoolYear === selectedYear ||
      matchesStudentGrade(course.schoolYear, selectedYear);

    const matchesSubject = selectedSubject === 'all' || course.subject === selectedSubject;

    const isCourseIntegrated = course.courseType === 'integrated' || (course.lessons && course.lessons.length > 0);
    const matchesType =
      selectedType === 'all' ||
      (selectedType === 'integrated' && isCourseIntegrated) ||
      (selectedType === 'exams_only' && !isCourseIntegrated);

    const matchesTeacher =
      selectedTeacher === 'all' ||
      course.instructorId === selectedTeacher ||
      (course.teacherName && course.teacherName.trim() === selectedTeacher.trim()) ||
      (course.instructor && course.instructor.trim() === selectedTeacher.trim());

    return matchesSearch && matchesYear && matchesSubject && matchesTeacher && matchesType;
  });

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Student Grade Specific Banner */}
      {isApprovedStudent && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-900 border border-emerald-400/40 rounded-[32px] p-6 sm:p-8 text-white shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-emerald-400 text-slate-950 px-3 py-1 rounded-full">
                حساب معتمد ومفعل ✅
              </span>
              <span className="text-xs font-mono text-emerald-100">
                الصف الدراسي: {currentUser.schoolYear}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear(selectedYear === 'my_grade' ? 'all' : 'my_grade')}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-all cursor-pointer"
              >
                {selectedYear === 'my_grade' ? '🔍 عرض جميع الصفوف والمناهج' : '🎯 تخصيص لصفّي الدراسي فقط'}
              </button>
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            مرحباً بك يا {currentUser.name} 🌟
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-2xl">
            {selectedYear === 'my_grade'
              ? `يتم الآن عرض الكورسات والامتحانات المقررة لصفك الدراسي (${currentUser.schoolYear}).`
              : 'تصفح كافة الكورسات والامتحانات المتاحة على المنصة لجميع الصفوف الدراسية.'}
          </p>
        </div>
      )}

      {/* Catalog Header with Search & Filters (Always visible for all users) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-4">
        {!isApprovedStudent && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900">
                المكتبة الأكاديمية 2027
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              دليل الكورسات المتكاملة وبنوك الامتحانات
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              تصفح الكورسات المتكاملة (دروس فيديو ومذكرات PDF وامتحانات) بالإضافة إلى بنوك الامتحانات التسلسلية المعتمدة لدفعة 2027 تحت إشراف إدارة المنصة.
            </p>
          </>
        )}

        {/* Filters and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الكورس، المادة، أو المدرس..."
              className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>

          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="all">جميع الصفوف والمراحل (1 ابتدائي - 3 ثانوي)</option>
              {isApprovedStudent && <option value="my_grade">🎯 صفي الدراسي ({currentUser?.schoolYear})</option>}
              
              
              <optgroup label="المرحلة الثانوية">
                <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
              </optgroup>
            </select>
          </div>

          <div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="all">جميع المواد الدراسية</option>
              {subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200"
            >
              <option value="all">جميع المعلمين والمشرفين</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.gender === 'أنثى' ? '👩‍🏫 المعلمة:' : '👨‍🏫 المعلم:'} {t.name} ({t.subject || 'عام'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Course Bundles & Discount Packages Section (نظام الباقات والعروض المجمعة) */}
      <CourseBundlesSection
        courses={publishedCourses}
        currentUser={currentUser}
        onSelectCourse={onSelectCourse}
        onBundleSubscribed={(newEnrolledIds, newBalance) => {
          if (!currentUser) return;
          const updatedUser: User = {
            ...currentUser,
            enrolledCourseIds: newEnrolledIds,
            ...(typeof newBalance === 'number' ? { walletBalance: newBalance } : {}),
          };
          saveCurrentUser(updatedUser);
          newEnrolledIds.forEach((cid) => {
            saveStudentEnrolledCourse(currentUser.id, cid);
            enrollStudentInCourseInFirestore(currentUser.id, cid).catch(() => {});
          });
          const allUsers = getSavedUsers();
          if (allUsers.some((u) => u.id === currentUser.id)) {
            saveUsers(allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u)));
          }
          onUpdateUser?.(updatedUser);
        }}
      />

      {/* Courses Search Bar for Student if approved */}
      {isApprovedStudent && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في كورسات صفك الدراسي..."
              className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>

          <div className="w-full sm:w-52">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-bold text-slate-800 shadow-xs"
            >
              <option value="all">جميع المواد</option>
              {subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-52">
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-bold text-slate-800 shadow-xs"
            >
              <option value="all">جميع المعلمين</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.gender === 'أنثى' ? '👩‍🏫' : '👨‍🏫'} {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Courses Cards Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isCourseIntegrated = course.courseType === 'integrated' || (course.lessons && course.lessons.length > 0);
            const lessonsCount = course.lessons?.length || 0;
            const videosCount = course.lessons?.reduce((sum, l) => sum + (l.videos?.length || 0), 0) || 0;
            const pdfsCount = course.lessons?.reduce((sum, l) => sum + (l.pdfs?.length || 0), 0) || 0;
            const examsCount = (course.exams?.length || 0) + (course.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0);
            const hasDiscount = Boolean(
              course.originalPrice && Number(course.originalPrice) > Number(course.price)
            );
            const discountPercent = hasDiscount
              ? course.discountPercentage ||
                Math.round(
                  ((Number(course.originalPrice) - Number(course.price)) /
                    Number(course.originalPrice)) *
                    100
                )
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
                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold shadow-xs">
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

                    {/* Discount Percentage Badge on Top Left */}
                    {hasDiscount && !currentUser?.enrolledCourseIds?.includes(course.id) && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="text-[11px] font-black px-3 py-1 rounded-full bg-rose-600 text-white shadow-lg flex items-center gap-1 animate-pulse">
                          <span>🔥 خصم {discountPercent}%</span>
                        </span>
                      </div>
                    )}

                    {currentUser?.enrolledCourseIds?.includes(course.id) && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>مشترك ✅</span>
                        </span>
                      </div>
                    )}

                    {currentUser?.role === 'teacher' && !currentUser?.enrolledCourseIds?.includes(course.id) && !hasDiscount && (
                      <div className="absolute top-3 left-3 z-10">
                        {course.instructorId === currentUser.id ||
                        course.instructor === currentUser.name ||
                        course.teacherName === currentUser.name ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-600 text-white shadow-md flex items-center gap-1">
                            <span>كورسي الخاص 👨‍🏫</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-900/85 text-amber-300 border border-amber-400/40 shadow-md flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400" />
                            <span>معلم آخر 🔒</span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3">
                      {hasDiscount ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/90 backdrop-blur-md border border-amber-400/50 shadow-lg">
                          <span className="text-[11px] font-bold text-rose-400 line-through decoration-2">
                            {course.originalPrice} {course.priceCurrency}
                          </span>
                          <span className="text-xs font-black text-emerald-400">
                            {course.price === 0 ? 'مجاني' : `${course.price} ${course.priceCurrency}`}
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-600 text-white">
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
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-bold">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-indigo-600 font-black">{course.subject}</span>
                        <span>•</span>
                        <span className="truncate">المعلم: {course.teacherName || course.instructor}</span>
                      </div>
                      {(() => {
                        const matchingTeacher = teachers.find(
                          (t) =>
                            t.id === course.instructorId ||
                            t.name.trim() === (course.teacherName || course.instructor || '').trim() ||
                            (t.accountNumber && t.accountNumber === course.instructorId)
                        );
                        if (matchingTeacher && onSelectTeacher) {
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTeacher(matchingTeacher);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-[10px] font-black shrink-0 transition-all border border-indigo-200 cursor-pointer"
                              title="عرض صفحة هذا المعلم وكورساته الخاصة"
                            >
                              {matchingTeacher.gender === 'أنثى' ? 'صفحة المعلمة 👩‍🏫' : 'صفحة المعلم 👨‍🏫'}
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      {course.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>

                    {/* Prominent Course Price & Discount Box inside Card Body */}
                    {hasDiscount && (
                      <div className="p-3 rounded-2xl bg-gradient-to-l from-rose-50 via-amber-50/60 to-emerald-50 border border-rose-200/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-500">السعر:</span>
                          <span className="text-xs sm:text-sm font-black text-rose-500 line-through decoration-2 font-mono">
                            {course.originalPrice} {course.priceCurrency}
                          </span>
                          <span className="text-sm sm:text-base font-black text-emerald-700 font-mono">
                            {course.price === 0 ? 'مجاني' : `${course.price} ${course.priceCurrency}`}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black shrink-0 shadow-2xs">
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

                  <div>
                    {currentUser?.enrolledCourseIds?.includes(course.id) ? (
                      <span className="text-xs font-black text-emerald-600 flex items-center gap-1 group-hover:-translate-x-1 transition-transform">
                        <span>متابعة الكورس 🎓</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </span>
                    ) : course.price === 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!currentUser) {
                            onOpenAuth?.();
                            return;
                          }
                          const prev = currentUser.enrolledCourseIds || [];
                          const updatedIds = Array.from(new Set([...prev, course.id]));
                          const updatedUser: User = {
                            ...currentUser,
                            enrolledCourseIds: updatedIds,
                          };
                          saveCurrentUser(updatedUser);
                          saveStudentEnrolledCourse(currentUser.id, course.id);
                          enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});
                          const allUsers = getSavedUsers();
                          saveUsers(allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
                          onUpdateUser?.(updatedUser);
                          onSelectCourse(course);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                        title="اشترك في هذا الكورس المجاني فوراً وفتح المحتوى"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>اشترك مجاناً 🎁</span>
                      </button>
                    ) : (
                      <span className="text-xs font-black text-indigo-600 flex items-center gap-1.5 group-hover:-translate-x-1 transition-transform">
                        {hasDiscount ? (
                          <>
                            <span>اشترك الآن</span>
                            <span className="text-rose-400 line-through text-[11px] font-bold">
                              {course.originalPrice} ج.م
                            </span>
                            <span className="text-emerald-600 font-black">
                              ({course.price} ج.م)
                            </span>
                          </>
                        ) : (
                          <span>اشترك الآن ({course.price} ج.م)</span>
                        )}
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-[32px] p-8 space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">
            {courses.length === 0 ? 'لا توجد كورسات مضافة على المنصة حالياً' : 'لا توجد كورسات مطابقة لخيارات البحث'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {courses.length === 0
              ? 'سيتم إضافة الكورسات والمناهج والامتحانات المعتمدة قريباً بواسطة المعلمين والإدارة.'
              : 'جرب تغيير نوع الكورس، المادة، أو السنة الدراسية لعرض النتائج.'}
          </p>
          <button
            onClick={() => {
              setSelectedYear('all');
              setSelectedSubject('all');
              setSelectedTeacher('all');
              setSelectedType('all');
              setSearchQuery('');
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer"
          >
            عرض كافة الكورسات والمناهج المتاحة
          </button>
        </div>
      )}
    </div>
  );
};
