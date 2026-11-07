import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Search,
  Filter,
  ArrowRight,
  Award,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  MessageCircle,
  FileCheck,
  Star,
  Users
} from 'lucide-react';
import { Course, User, AppView } from '../types';

interface TeacherStudentProgressPageProps {
  currentTeacher: User;
  allCourses: Course[];
  allStudents: User[];
  onNavigate: (view: AppView) => void;
}

export const TeacherStudentProgressPage: React.FC<TeacherStudentProgressPageProps> = ({
  currentTeacher,
  allCourses,
  allStudents,
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

  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'excellent' | 'very_good' | 'average' | 'needs_attention'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Enrolled students
  const enrolledStudents = useMemo(() => {
    return allStudents.filter((student) => {
      if (student.role === 'teacher' || student.role === 'admin') return false;
      const enrolled = student.enrolledCourseIds || [];
      return enrolled.some((id) => myCourseIds.has(id));
    });
  }, [allStudents, myCourseIds]);

  // Calculate detailed progress stats for each student
  const studentProgressList = useMemo(() => {
    return enrolledStudents.map((student) => {
      // Courses enrolled in for this teacher
      const enrolledInTeacher = myCourses.filter((c) =>
        (student.enrolledCourseIds || []).includes(c.id)
      );

      // Total videos in these courses
      let totalVideosCount = 0;
      let completedVideosCount = 0;
      enrolledInTeacher.forEach((course) => {
        (course.lessons || []).forEach((lesson) => {
          (lesson.videos || []).forEach((vid) => {
            totalVideosCount += 1;
            if (student.completedVideos?.[vid.id]) {
              completedVideosCount += 1;
            }
          });
        });
      });

      // Video completion percentage
      const videoPercentage = totalVideosCount > 0
        ? Math.round((completedVideosCount / totalVideosCount) * 100)
        : 100;

      // Exam results in teacher's courses
      const examEntries = Object.entries(student.examResults || {});
      const relevantExams: {
        examTitle: string;
        score: number;
        maxScore: number;
        percentage: number;
        passed: boolean;
        submittedAt?: string;
        durationTakenFormatted?: string;
      }[] = [];
      let totalExamPercentage = 0;

      enrolledInTeacher.forEach((course) => {
        (course.exams || []).forEach((exam) => {
          if (student.examResults?.[exam.id]) {
            const res = student.examResults[exam.id];
            relevantExams.push({
              examTitle: exam.title,
              score: res.score,
              maxScore: res.maxScore,
              percentage: res.percentage,
              passed: res.passed,
              submittedAt: res.submittedAt || res.completedAt,
              durationTakenFormatted: res.durationTakenFormatted,
            });
            totalExamPercentage += res.percentage;
          }
        });
        (course.lessons || []).forEach((lesson) => {
          (lesson.exams || []).forEach((exam) => {
            if (student.examResults?.[exam.id]) {
              const res = student.examResults[exam.id];
              relevantExams.push({
                examTitle: exam.title,
                score: res.score,
                maxScore: res.maxScore,
                percentage: res.percentage,
                passed: res.passed,
                submittedAt: res.submittedAt || res.completedAt,
                durationTakenFormatted: res.durationTakenFormatted,
              });
              totalExamPercentage += res.percentage;
            }
          });
        });
      });

      const averageExamScore = relevantExams.length > 0
        ? Math.round(totalExamPercentage / relevantExams.length)
        : videoPercentage;

      // Overall composite score (60% exams, 40% videos)
      const overallScore = Math.round(averageExamScore * 0.6 + videoPercentage * 0.4);

      // Determine level badge
      let level: 'excellent' | 'very_good' | 'average' | 'needs_attention' = 'average';
      let levelLabel = 'مستوى متوسط 👍';
      let levelColor = 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-300';

      if (overallScore >= 90) {
        level = 'excellent';
        levelLabel = 'مستوى متميز 🏆';
        levelColor = 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:text-amber-300';
      } else if (overallScore >= 75) {
        level = 'very_good';
        levelLabel = 'مستوى جيد جداً 🌟';
        levelColor = 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300';
      } else if (overallScore >= 60) {
        level = 'average';
        levelLabel = 'مستوى متوسط 👍';
        levelColor = 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300';
      } else {
        level = 'needs_attention';
        levelLabel = 'يحتاج متابعة وتنبيه ⚠️';
        levelColor = 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950 dark:text-rose-300';
      }

      return {
        student,
        enrolledInTeacher,
        totalVideosCount,
        completedVideosCount,
        videoPercentage,
        relevantExams,
        averageExamScore,
        overallScore,
        level,
        levelLabel,
        levelColor,
      };
    });
  }, [enrolledStudents, myCourses]);

  // Filtered by course and level
  const filteredList = useMemo(() => {
    return studentProgressList.filter((item) => {
      // Course filter
      if (selectedCourseId !== 'all') {
        const isInCourse = item.enrolledInTeacher.some((c) => c.id === selectedCourseId);
        if (!isInCourse) return false;
      }

      // Level filter
      if (levelFilter !== 'all' && item.level !== levelFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.student.name?.toLowerCase().includes(q);
        const matchesPhone = item.student.phone?.includes(q);
        if (!matchesName && !matchesPhone) return false;
      }

      return true;
    });
  }, [studentProgressList, selectedCourseId, levelFilter, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16" dir="rtl">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('teacher_dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-black text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للوحة المعلم</span>
        </button>

        <button
          onClick={() => onNavigate('teacher_students')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black cursor-pointer hover:bg-indigo-100 transition-all"
        >
          <Users className="w-4 h-4" />
          <span>قائمة وأسماء الطلاب المشتركين</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="rounded-[32px] bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-white shrink-0 shadow-lg">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                متابعة تقدم ومستوى الطلاب (صفحة كاملة)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              مستوى الطلاب ونسب المشاهدة والامتحانات
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              تابع إنجاز كل طالب في كورساتك الخاصة، واكتشف من يحتاج دعماً إضافياً.
            </p>
          </div>
        </div>

        {/* Level Stats Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
            <p className="text-[10px] text-slate-400 font-bold">إجمالي الخاضعين للمتابعة</p>
            <p className="text-lg font-black text-white">{studentProgressList.length}</p>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-center">
            <p className="text-[10px] text-emerald-300 font-bold">متميز / جيد جداً</p>
            <p className="text-lg font-black text-emerald-200">
              {studentProgressList.filter((s) => s.level === 'excellent' || s.level === 'very_good').length}
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-rose-500/20 backdrop-blur-md border border-rose-400/30 text-center">
            <p className="text-[10px] text-rose-300 font-bold">يحتاج متابعة</p>
            <p className="text-lg font-black text-rose-200">
              {studentProgressList.filter((s) => s.level === 'needs_attention').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute top-3.5 right-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو رقم الهاتف..."
              className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 text-right"
            />
          </div>

          {/* Course filter */}
          <div className="md:col-span-4">
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

          {/* Level filter */}
          <div className="md:col-span-3">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 text-right"
            >
              <option value="all">جميع المستويات</option>
              <option value="excellent">مستوى متميز 🏆 (90%+)</option>
              <option value="very_good">مستوى جيد جداً 🌟 (75-89%)</option>
              <option value="average">مستوى متوسط 👍 (60-74%)</option>
              <option value="needs_attention">يحتاج متابعة ⚠️ (&lt;60%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Progress Cards */}
      {filteredList.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            لا توجد بيانات تقدم مطابقة للبحث
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            تأكد من اختيار الكورس الصحيح أو إعادة ضبط الفلاتر.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => {
            const student = item.student;
            const rawParentPhone =
              student.parentPhone || student.fatherPhone || student.motherPhone || student.phone || '';
            const cleanParentPhone = rawParentPhone.replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '');
            const examsLines =
              item.relevantExams.length > 0
                ? item.relevantExams
                    .slice(0, 4)
                    .map(
                      (ex) =>
                        `• ${ex.examTitle}: ${ex.score}/${ex.maxScore} (${ex.percentage}%) - ${
                          ex.passed ? 'ناجح ✅' : 'يحتاج مراجعة ⚠️'
                        }`
                    )
                    .join('\n')
                : '• لم يتم تسليم امتحانات إلكترونية بعد';
            const reportMessage = `السلام عليكم ورحمة الله وبركاته 🌿\nتحية طيبة لولي أمر الطالب/ـة: *${student.name}* (${student.schoolYear || 'المرحلة الثانوية'})\nنرسل لحضرتكم تقرير المتابعة العلمية من *منصة قلب العلم التعليمية*:\n\n🎬 *نسبة إنجاز ومشاهدة الحصص:* ${item.videoPercentage}% (${item.completedVideosCount} من ${item.totalVideosCount} حصة)\n📊 *متوسط درجات الامتحانات:* ${item.averageExamScore}%\n🌟 *التقييم العام للطالب:* ${item.levelLabel}\n\n📝 *تفاصيل الامتحانات المسلمة:*\n${examsLines}\n\nمع خالص تمنياتنا بدوام التفوق والنجاح 🏆\n*الأستاذ / ${currentTeacher.name} - منصة قلب العلم التعليمية*`;
            const waUrl = `https://wa.me/20${cleanParentPhone}?text=${encodeURIComponent(reportMessage)}`;

            return (
              <div
                key={student.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 shadow-xs hover:shadow-md transition-all space-y-5"
              >
                {/* Header: Student Name, Level Badge, and Overall Score */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-base shrink-0 shadow-inner">
                      {student.name ? student.name.charAt(0) : 'ط'}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {student.name || 'طالب منصة قلب العلم'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        هاتف الطالب: <span className="font-mono">{student.phone}</span>
                        {rawParentPhone && rawParentPhone !== student.phone ? (
                          <> • هاتف ولي الأمر: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{rawParentPhone}</span></>
                        ) : null}{' '}
                        • {student.schoolYear || 'الصف الثالث الثانوي'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <span
                      className={`text-xs font-black px-3.5 py-1.5 rounded-full border ${item.levelColor}`}
                    >
                      {item.levelLabel}
                    </span>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold">النسبة الإجمالية</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                        {item.overallScore}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bars: Videos & Exams */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                  {/* Videos Watched */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>نسبة مشاهدة الفيديوهات والدروس</span>
                      </span>
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {item.videoPercentage}% ({item.completedVideosCount} من {item.totalVideosCount})
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${item.videoPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Exam Performance */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>متوسط درجات الامتحانات والواجبات</span>
                      </span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {item.averageExamScore}% ({item.relevantExams.length} امتحان تم تسليمه)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.averageExamScore >= 75
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                            : item.averageExamScore >= 60
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-rose-600 to-rose-400'
                        }`}
                        style={{ width: `${item.averageExamScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Exams List Badges if any */}
                {item.relevantExams.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-500">تفاصيل الامتحانات المسلمة:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {item.relevantExams.map((ex, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {ex.examTitle}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                                {ex.score}/{ex.maxScore}
                              </span>
                              <span
                                className={`font-mono font-black px-1.5 py-0.5 rounded ${
                                  ex.passed
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}
                              >
                                {ex.percentage}%
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                            <span>
                              زمن التسليم: <b className="text-slate-800 dark:text-slate-200">{ex.submittedAt || 'تم التسليم'}</b>
                            </span>
                            <span>
                              الوقت المستغرق: <b className="text-amber-700 dark:text-amber-400">{ex.durationTakenFormatted || 'أقل من دقيقة'}</b>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Action: Direct Click-to-Chat to Parent's WhatsApp */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    يفتح واتساب المدرس مباشرة في محادثة ولي الأمر برسالة جاهزة ومنظمة:
                  </span>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>متابعة ولي الأمر (إرسال التقرير الجاهز) 📲</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeacherStudentProgressPage;
