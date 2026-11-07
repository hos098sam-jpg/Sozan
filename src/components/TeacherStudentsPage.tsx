import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  ArrowRight,
  Phone,
  MessageCircle,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Calendar,
  School,
  MapPin,
  Sparkles,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { Course, User, AppView } from '../types';
import { ParentWhatsappReportModal, buildDirectParentWhatsappUrl } from './ParentWhatsappReportModal';
import { getSavedSubmissions } from '../data/initialData';

interface TeacherStudentsPageProps {
  currentTeacher: User;
  allCourses: Course[];
  allStudents: User[];
  onNavigate: (view: AppView) => void;
}

export const TeacherStudentsPage: React.FC<TeacherStudentsPageProps> = ({
  currentTeacher,
  allCourses,
  allStudents,
  onNavigate,
}) => {
  // Only courses owned by this teacher
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

  // States
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'ذكر' | 'أنثى'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportStudent, setReportStudent] = useState<User | null>(null);
  const allSubmissions = useMemo(() => getSavedSubmissions(), []);

  // Find enrolled students in this teacher's courses
  const enrolledStudents = useMemo(() => {
    return allStudents.filter((student) => {
      if (student.role === 'teacher' || student.role === 'admin') return false;
      const enrolled = student.enrolledCourseIds || [];
      return enrolled.some((id) => myCourseIds.has(id));
    });
  }, [allStudents, myCourseIds]);

  // Filter students by selected course, gender, and search query
  const filteredStudents = useMemo(() => {
    return enrolledStudents.filter((student) => {
      const enrolled = student.enrolledCourseIds || [];

      // Course filter
      if (selectedCourseId !== 'all' && !enrolled.includes(selectedCourseId)) {
        return false;
      }

      // Gender filter
      if (genderFilter !== 'all' && student.gender !== genderFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = student.name?.toLowerCase().includes(q);
        const matchesPhone = student.phone?.includes(q);
        const matchesParentPhone = student.parentPhone?.includes(q) || student.fatherPhone?.includes(q);
        const matchesSchool = student.schoolName?.toLowerCase().includes(q);
        const matchesGov = student.governorate?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesParentPhone && !matchesSchool && !matchesGov) {
          return false;
        }
      }

      return true;
    });
  }, [enrolledStudents, selectedCourseId, genderFilter, searchQuery]);

  // Student counts
  const totalEnrolledCount = enrolledStudents.length;
  const boysCount = enrolledStudents.filter((s) => s.gender === 'ذكر' || !s.gender).length;
  const girlsCount = enrolledStudents.filter((s) => s.gender === 'أنثى').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16" dir="rtl">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('teacher_dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-black text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للوحة المعلم</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('teacher_progress')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black cursor-pointer hover:bg-indigo-100 transition-all"
          >
            <span>متابعة تقدم ومستوى الطلاب 📊</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="rounded-[32px] bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-white shrink-0 shadow-lg">
            <Users className="w-8 h-8 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                سجل الطلاب المعتمدين (صفحة كاملة)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              الطلاب والطالبات المشتركين في كورساتي
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              إشراف وتدريس: الأستاذ <b>{currentTeacher.name}</b> • مادة:{' '}
              <b>{currentTeacher.subject || 'مادة عامة'}</b>
            </p>
          </div>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
            <p className="text-[10px] text-slate-400 font-bold">إجمالي الطلاب</p>
            <p className="text-xl font-black text-white">{totalEnrolledCount}</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-blue-500/20 backdrop-blur-md border border-blue-400/30 text-center">
            <p className="text-[10px] text-blue-300 font-bold">بنين (طلاب)</p>
            <p className="text-xl font-black text-blue-200">{boysCount}</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-rose-500/20 backdrop-blur-md border border-rose-400/30 text-center">
            <p className="text-[10px] text-rose-300 font-bold">بنات (طالبات)</p>
            <p className="text-xl font-black text-rose-200">{girlsCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute top-3.5 right-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم هاتف الطالب، أو رقم ولي الأمر..."
              className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          {/* Course Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 text-right"
            >
              <option value="all">كافة الكورسات الخاصة بي ({myCourses.length})</option>
              {myCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div className="md:col-span-3 flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setGenderFilter('all')}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                genderFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setGenderFilter('ذكر')}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                genderFilter === 'ذكر'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              بنين ({boysCount})
            </button>
            <button
              onClick={() => setGenderFilter('أنثى')}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                genderFilter === 'أنثى'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              بنات ({girlsCount})
            </button>
          </div>
        </div>
      </div>

      {/* Students List Display */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            لا يوجد طلاب مطابقين للبحث حالياً
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            بمجرد اشتراك الطلاب في كورساتك، ستظهر أسماؤهم وأرقام هواتفهم وتفاصيل اشتراكهم هنا تلقائياً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const isFemale = student.gender === 'أنثى';
            const studentCourses = myCourses.filter((c) =>
              (student.enrolledCourseIds || []).includes(c.id)
            );

            const whatsappUrl = `https://wa.me/2${(student.phone || '').replace(/\D/g, '').replace(/^2/, '')}`;
            const directParentFollowUpUrl = buildDirectParentWhatsappUrl(
              student,
              myCourses.length > 0 ? myCourses : allCourses,
              allSubmissions,
              currentTeacher.name
            );

            return (
              <div
                key={student.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Row: Name and Gender */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                          isFemale
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {student.name ? student.name.charAt(0) : 'ط'}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                          {student.name || 'طالب منصة قلب العلم'}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isFemale
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            }`}
                          >
                            {isFemale ? 'طالبة (بنات)' : 'طالب (بنين)'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {student.schoolYear || 'الصف الثالث الثانوي'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 font-medium">هاتف الطالب:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                        {student.phone}
                      </span>
                    </div>

                    {student.parentPhone && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-medium">هاتف ولي الأمر:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          {student.parentPhone}
                        </span>
                      </div>
                    )}

                    {student.schoolName && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-medium">المدرسة:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {student.schoolName}
                        </span>
                      </div>
                    )}

                    {student.governorate && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-medium">المحافظة:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {student.governorate}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Enrolled Courses Badges */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold">الكورسات المشترك بها:</p>
                    <div className="flex flex-wrap gap-1">
                      {studentCourses.map((c) => (
                        <span
                          key={c.id}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate max-w-[180px]"
                        >
                          {c.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom WhatsApp Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <a
                    href={directParentFollowUpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                    title="فتح واتساب المدرس مباشرة داخل محادثة ولي الأمر برسالة التقرير المنظمة والجاهزة للإرسال"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>📲 متابعة ولي الأمر (فتح شات ولي الأمر برسالة جاهزة)</span>
                  </a>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>مراسلة الطالب</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ParentWhatsappReportModal
        isOpen={Boolean(reportStudent)}
        onClose={() => setReportStudent(null)}
        student={reportStudent}
        courses={allCourses}
        submissions={allSubmissions}
      />
    </div>
  );
};

export default TeacherStudentsPage;
