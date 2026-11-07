import React, { useMemo, useState } from 'react';
import {
  Users,
  BookOpen,
  Trophy,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  Flame,
  Target,
  ArrowUpRight,
  Filter,
  GraduationCap,
  Calendar,
  Zap,
  Activity,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import type { Course, Competition, User, StudentExamSubmission } from '../types';

interface AdminAnalyticsDashboardProps {
  students: User[];
  courses: Course[];
  competitions: Competition[];
  submissions: StudentExamSubmission[];
  onNavigateTab?: (tab: 'students' | 'courses' | 'competitions') => void;
}

// Colors for Charts
const GRADE_COLORS = ['#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const STATUS_COLORS = {
  active: '#10b981',
  pending: '#f59e0b',
  rejected: '#f43f5e',
  teachers: '#6366f1',
};
const COURSE_TYPE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6'];

// Custom Tooltip for Recharts with RTL support
const CustomAnalyticsTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-1.5 min-w-[180px]" dir="rtl">
        <div className="font-black text-amber-300 border-b border-slate-700 pb-1.5 mb-1.5 truncate">
          {label}
        </div>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-slate-300 font-medium text-[11px]">{entry.name}:</span>
            </div>
            <span className="font-black font-mono text-xs text-white">
              {entry.value !== undefined ? (typeof entry.value === 'number' ? entry.value.toLocaleString('ar-EG') : entry.value) : '-'}
              {entry.unit ? ` ${entry.unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  students,
  courses,
  competitions,
  submissions,
  onNavigateTab,
}) => {
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // --- 1. Student Calculations ---
  const registeredStudents = useMemo(() => {
    return students.filter((s) => s.role === 'student' || !s.role);
  }, [students]);

  const activeStudents = useMemo(() => {
    return registeredStudents.filter((s) => s.status === 'active' || s.status === 'approved' || !s.status);
  }, [registeredStudents]);

  const pendingStudents = useMemo(() => {
    return registeredStudents.filter((s) => s.status === 'pending');
  }, [registeredStudents]);

  const totalTeachers = useMemo(() => {
    return students.filter((s) => s.role === 'teacher').length;
  }, [students]);

  // Students by Grade
  const gradeDistribution = useMemo(() => {
    const gradesMap: Record<string, { total: number; active: number }> = {
      'الصف الثالث الثانوي': { total: 0, active: 0 },
      'الصف الثاني الثانوي': { total: 0, active: 0 },
      'الصف الأول الثانوي': { total: 0, active: 0 },
      'الصف الثالث الإعدادي': { total: 0, active: 0 },
      'الصف الثاني الإعدادي': { total: 0, active: 0 },
      'الصف الأول الإعدادي': { total: 0, active: 0 },
      'صفوف أخرى': { total: 0, active: 0 },
    };

    registeredStudents.forEach((st) => {
      const year = st.schoolYear?.trim() || '';
      let matchedKey = 'صفوف أخرى';
      for (const k of Object.keys(gradesMap)) {
        if (k !== 'صفوف أخرى' && year.includes(k.replace('الصف ', ''))) {
          matchedKey = k;
          break;
        }
      }
      gradesMap[matchedKey].total += 1;
      if (st.status === 'active' || st.status === 'approved' || !st.status) {
        gradesMap[matchedKey].active += 1;
      }
    });

    return Object.entries(gradesMap).map(([grade, data]) => ({
      name: grade.replace('الصف ', ''),
      fullName: grade,
      'إجمالي الطلاب': data.total,
      'الطلاب النشطين': data.active,
    }));
  }, [registeredStudents]);

  // User Status Breakdown (Pie)
  const userStatusPieData = useMemo(() => {
    return [
      { name: 'طلاب مفعلين', value: activeStudents.length, color: STATUS_COLORS.active },
      { name: 'قيد المراجعة', value: pendingStudents.length, color: STATUS_COLORS.pending },
      { name: 'معلمون معتمدون', value: totalTeachers, color: STATUS_COLORS.teachers },
    ].filter((item) => item.value > 0);
  }, [activeStudents, pendingStudents, totalTeachers]);

  // --- 2. Courses Calculations ---
  const activeCourses = useMemo(() => {
    return courses.filter((c) => c.isPublished);
  }, [courses]);

  const freeCourses = useMemo(() => {
    return activeCourses.filter((c) => !c.price || Number(c.price) === 0);
  }, [activeCourses]);

  const paidCourses = useMemo(() => {
    return activeCourses.filter((c) => Number(c.price) > 0);
  }, [activeCourses]);

  const totalLessonsCount = useMemo(() => {
    return courses.reduce((sum, c) => sum + (c.lessons?.length || 0), 0);
  }, [courses]);

  const totalExamsCount = useMemo(() => {
    return courses.reduce(
      (sum, c) =>
        sum +
        (c.exams?.length || 0) +
        (c.lessons?.reduce((lSum, l) => lSum + (l.exams?.length || 0), 0) || 0),
      0
    );
  }, [courses]);

  // Courses by Subject Distribution
  const courseSubjectData = useMemo(() => {
    const map: Record<string, { count: number; lessons: number; exams: number }> = {};
    activeCourses.forEach((c) => {
      const sub = c.subject || 'مادة عامة';
      if (!map[sub]) map[sub] = { count: 0, lessons: 0, exams: 0 };
      map[sub].count += 1;
      map[sub].lessons += c.lessons?.length || 0;
      map[sub].exams += (c.exams?.length || 0) + (c.lessons?.reduce((s, l) => s + (l.exams?.length || 0), 0) || 0);
    });

    return Object.entries(map)
      .map(([subject, data]) => ({
        subject,
        'عدد الكورسات': data.count,
        'إجمالي الدروس': data.lessons,
        'إجمالي الامتحانات': data.exams,
      }))
      .sort((a, b) => b['عدد الكورسات'] - a['عدد الكورسات'])
      .slice(0, 7);
  }, [activeCourses]);

  // Course Pricing Type (Pie)
  const coursePricingPieData = useMemo(() => {
    return [
      { name: 'كورسات مجانية', value: freeCourses.length, color: '#10b981' },
      { name: 'كورسات باشتراك (مدفوعة)', value: paidCourses.length, color: '#6366f1' },
      { name: 'مسودات غير منشورة', value: courses.length - activeCourses.length, color: '#94a3b8' },
    ].filter((item) => item.value > 0);
  }, [freeCourses, paidCourses, courses, activeCourses]);

  // --- 3. Competitions Calculations & Engagement Rate ---
  const activeCompetitions = useMemo(() => {
    return competitions.filter((c) => c.isPublished);
  }, [competitions]);

  // Total unique participants across all competitions
  const competitionStats = useMemo(() => {
    const uniqueStudentIds = new Set<string>();
    let totalSubmissionsCount = 0;
    let totalScoreSum = 0;
    let totalScoreCount = 0;

    competitions.forEach((comp) => {
      const leaderboard = comp.leaderboard || [];
      totalSubmissionsCount += leaderboard.length;
      leaderboard.forEach((p) => {
        if (p.studentId || p.studentPhone) {
          uniqueStudentIds.add(p.studentId || p.studentPhone);
        }
        if (p.percentage !== undefined) {
          totalScoreSum += p.percentage;
          totalScoreCount += 1;
        }
      });
    });

    // Also include any submissions marked as competition
    submissions.forEach((sub) => {
      if (sub.isCompetition || sub.competitionId) {
        if (sub.studentId || sub.studentPhone) {
          uniqueStudentIds.add(sub.studentId || sub.studentPhone);
        }
      }
    });

    const uniqueParticipantsCount = uniqueStudentIds.size;
    const overallParticipationRate =
      registeredStudents.length > 0
        ? Math.min(100, Math.round((uniqueParticipantsCount / registeredStudents.length) * 100))
        : 0;

    const avgScore = totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : 0;

    return {
      uniqueParticipantsCount,
      totalSubmissionsCount,
      overallParticipationRate,
      avgScore,
    };
  }, [competitions, submissions, registeredStudents]);

  // Per-Competition Engagement Data for Chart
  const competitionChartData = useMemo(() => {
    return competitions.map((comp) => {
      const participants = comp.leaderboard?.length || comp.participantsCount || 0;
      // Calculate target students count
      const targetGradeStudents = registeredStudents.filter((s) => {
        if (!comp.schoolYear || comp.schoolYear === 'الكل') return true;
        return s.schoolYear?.includes(comp.schoolYear.replace('الصف ', '')) || comp.schoolYear.includes(s.schoolYear || '');
      }).length || registeredStudents.length;

      const rate = targetGradeStudents > 0 ? Math.min(100, Math.round((participants / targetGradeStudents) * 100)) : 0;

      const avgPercent =
        comp.leaderboard && comp.leaderboard.length > 0
          ? Math.round(comp.leaderboard.reduce((acc, p) => acc + (p.percentage || 0), 0) / comp.leaderboard.length)
          : 0;

      return {
        id: comp.id,
        title: comp.title.length > 20 ? comp.title.substring(0, 18) + '...' : comp.title,
        fullTitle: comp.title,
        grade: comp.schoolYear,
        'عدد المتسابقين': participants,
        'نسبة الإقبال %': rate,
        'متوسط الدرجات %': avgPercent,
      };
    });
  }, [competitions, registeredStudents]);

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-[32px] border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-black border border-indigo-500/30">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>لوحة التحليلات والإحصائيات الحية للدفعة المعتمدة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <span>إحصائيات المنصة والأداء العام</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                تحديث فوري
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              متابعة دقيقة لنمو قاعدة الطلاب، توزيع الكورسات والامتحانات المفعلة، ومعدلات إقبال وتفاعل المتسابقين.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigateTab && (
              <>
                <button
                  onClick={() => onNavigateTab('students')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all flex items-center gap-1.5 border border-white/10"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-300" />
                  <span>إدارة الطلاب</span>
                </button>
                <button
                  onClick={() => onNavigateTab('courses')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all flex items-center gap-1.5 border border-white/10"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
                  <span>إدارة الكورسات</span>
                </button>
                <button
                  onClick={() => onNavigateTab('competitions')}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-400/20"
                >
                  <Trophy className="w-3.5 h-3.5 text-slate-950" />
                  <span>المسابقات</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3 PRIMARY KPI CARDS (المؤشرات الثلاثة المطلوبة) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: عدد الطلاب المسجلين */}
        <div className="bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                قاعدة الطلاب
              </span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">
                {registeredStudents.length.toLocaleString('ar-EG')}
              </div>
              <h3 className="text-sm font-black text-slate-700 mt-1">
                إجمالي الطلاب المسجلين
              </h3>
            </div>

            {/* Sub-breakdown */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100">
                <div className="text-[10px] font-bold text-emerald-800">حسابات نشطة ومفعلة</div>
                <div className="text-base font-black text-emerald-700 font-mono mt-0.5">
                  {activeStudents.length.toLocaleString('ar-EG')}
                </div>
              </div>
              <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-100">
                <div className="text-[10px] font-bold text-amber-800">قيد المراجعة</div>
                <div className="text-base font-black text-amber-700 font-mono mt-0.5">
                  {pendingStudents.length.toLocaleString('ar-EG')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: إجمالي الكورسات المفعلة */}
        <div className="bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                المناهج المعتمدة
              </span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">
                {activeCourses.length.toLocaleString('ar-EG')}
              </div>
              <h3 className="text-sm font-black text-slate-700 mt-1">
                إجمالي الكورسات المفعلة (المنشورة)
              </h3>
            </div>

            {/* Sub-breakdown */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100">
                <div className="text-[10px] font-bold text-indigo-800">كورسات مجانية / اشتراك</div>
                <div className="text-base font-black text-indigo-700 font-mono mt-0.5">
                  {freeCourses.length} / {paidCourses.length}
                </div>
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-700">امتحانات تسلسلية</div>
                <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                  {totalExamsCount.toLocaleString('ar-EG')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: نسبة الإقبال على المسابقات */}
        <div className="bg-white border-2 border-amber-200 hover:border-amber-400 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
                <Trophy className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-600 fill-rose-600" />
                <span>التفاعل التنافسي</span>
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">
                  {competitionStats.overallParticipationRate}%
                </span>
                <span className="text-xs font-bold text-slate-500">
                  معدل التفاعل العام
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-700 mt-1">
                نسبة الإقبال على المسابقات
              </h3>
            </div>

            {/* Sub-breakdown */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
                <div className="text-[10px] font-bold text-amber-900">إجمالي المتسابقين</div>
                <div className="text-base font-black text-amber-800 font-mono mt-0.5">
                  {competitionStats.uniqueParticipantsCount.toLocaleString('ar-EG')} طالب
                </div>
              </div>
              <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100">
                <div className="text-[10px] font-bold text-emerald-800">متوسط درجات الطلاب</div>
                <div className="text-base font-black text-emerald-700 font-mono mt-0.5">
                  {competitionStats.avgScore}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECHARTS SECTION 1: COMPETITION ENGAGEMENT & PARTICIPATION (مخطط الإقبال) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trophy className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-black text-slate-900">
                معدلات الإقبال والمشاركة في المسابقات التنافسية
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              مقارنة بين عدد المتسابقين الفعلي، نسبة الإقبال التقديرية، ومتوسط أداء الطلاب لكل مسابقة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              <span>{competitions.length} مسابقات نشطة</span>
            </span>
          </div>
        </div>

        {competitionChartData.length > 0 ? (
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={competitionChartData}
                margin={{ top: 20, right: 25, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="title"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: '#f59e0b', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#fef3c7' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '12px', fontSize: '12px', fontWeight: 700 }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="عدد المتسابقين"
                  fill="#6366f1"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={45}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="نسبة الإقبال %"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="متوسط الدرجات %"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Trophy className="w-10 h-10 mx-auto text-slate-300" />
            <div className="text-sm font-black">لا توجد بيانات مسابقات مسجلة حالياً</div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RECHARTS SECTION 2: STUDENTS BY GRADE & COURSES BY SUBJECT (2 CHARTS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: توزيع الطلاب حسب المراحل الدراسية */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  توزيع الطلاب حسب المراحل الدراسية
                </h3>
                <p className="text-[11px] text-slate-500">إجمالي المسجلين والنشطين بكل صف دراسي</p>
              </div>
            </div>
            <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
              {registeredStudents.length} طالب
            </span>
          </div>

          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={gradeDistribution}
                margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontWeight: 700 }} />
                <Bar
                  dataKey="إجمالي الطلاب"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="الطلاب النشطين"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: الكورسات المفعلة حسب المواد الدراسية */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  الكورسات والمحتوى حسب المادة
                </h3>
                <p className="text-[11px] text-slate-500">حجم الدروس والامتحانات المتوفرة بكل مادة</p>
              </div>
            </div>
            <span className="text-xs font-black font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">
              {activeCourses.length} كورس مفعل
            </span>
          </div>

          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={courseSubjectData}
                margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="subject"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontWeight: 700 }} />
                <Bar
                  dataKey="عدد الكورسات"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="إجمالي الدروس"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="إجمالي الامتحانات"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECHARTS SECTION 3: PIE CHARTS (حالة الحسابات + تصنيف الكورسات) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie 1: حالة الحسابات */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>توزيع حالة حسابات المنصة</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-500">
              إجمالي {students.length} مستخدم
            </span>
          </div>

          <div className="h-60 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={userStatusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {userStatusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <div className="font-black text-base font-mono">{activeStudents.length}</div>
              <div className="text-[10px] font-bold">مفعلين</div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-100">
              <div className="font-black text-base font-mono">{pendingStudents.length}</div>
              <div className="text-[10px] font-bold">قيد المراجعة</div>
            </div>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-100">
              <div className="font-black text-base font-mono">{totalTeachers}</div>
              <div className="text-[10px] font-bold">معلمون</div>
            </div>
          </div>
        </div>

        {/* Pie 2: تصنيف الكورسات */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>تصنيف وحالة الكورسات</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-500">
              إجمالي {courses.length} كورس
            </span>
          </div>

          <div className="h-60 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={coursePricingPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {coursePricingPieData.map((entry, index) => (
                    <Cell key={`cell-course-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomAnalyticsTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <div className="font-black text-base font-mono">{freeCourses.length}</div>
              <div className="text-[10px] font-bold">مجانية</div>
            </div>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-100">
              <div className="font-black text-base font-mono">{paidCourses.length}</div>
              <div className="text-[10px] font-bold">مدفوعة</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <div className="font-black text-base font-mono">{courses.length - activeCourses.length}</div>
              <div className="text-[10px] font-bold">مسودات</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPETITION DETAILED PARTICIPATION TABLE */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>جدول تفاصيل إقبال ومشاركة الطلاب في المسابقات</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              بيانات المتسابقين، أعلى الدرجات المحققة، ونسب الإقبال لكل مسابقة معتمدة.
            </p>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('competitions')}
              className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black transition-colors self-start sm:self-auto cursor-pointer"
            >
              إدارة المسابقات الكاملة ↗
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-black">
                <th className="py-3 px-4">اسم المسابقة</th>
                <th className="py-3 px-4">المرحلة الدراسية</th>
                <th className="py-3 px-4">عدد المتسابقين</th>
                <th className="py-3 px-4">نسبة الإقبال</th>
                <th className="py-3 px-4">متوسط النتيجة</th>
                <th className="py-3 px-4">أعلى متسابق (المركز الأول)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {competitions.map((comp) => {
                const leaderboard = comp.leaderboard || [];
                const topStudent = leaderboard[0];
                const targetStudentsCount = registeredStudents.filter((s) => {
                  if (!comp.schoolYear || comp.schoolYear === 'الكل') return true;
                  return s.schoolYear?.includes(comp.schoolYear.replace('الصف ', '')) || comp.schoolYear.includes(s.schoolYear || '');
                }).length || registeredStudents.length;

                const rate = targetStudentsCount > 0 ? Math.min(100, Math.round((leaderboard.length / targetStudentsCount) * 100)) : 0;
                const avgPercent = leaderboard.length > 0
                  ? Math.round(leaderboard.reduce((acc, p) => acc + (p.percentage || 0), 0) / leaderboard.length)
                  : 0;

                return (
                  <tr key={comp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{comp.title}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold">
                        {comp.schoolYear}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black font-mono text-indigo-600">
                      {leaderboard.length} متسابق
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="font-black font-mono text-[11px] text-amber-700">{rate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                      {avgPercent}%
                    </td>
                    <td className="py-3 px-4">
                      {topStudent ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] flex items-center justify-center font-black">
                            1
                          </span>
                          <span>{topStudent.studentName}</span>
                          <span className="font-mono text-amber-600 text-[11px]">({topStudent.percentage}%)</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">لا يوجد مشاركون بعد</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
