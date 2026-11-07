import { User, StudentExamSubmission, Course } from '../types';

export interface ExamStatItem {
  examId: string;
  examTitle: string;
  courseTitle?: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  attemptsCount: number;
  completedAt: string;
  startedAt?: string;
  submittedAt?: string;
  durationTakenSeconds?: number;
  durationTakenFormatted?: string;
}

/**
 * Formats duration in seconds into days, hours, minutes, and seconds in Arabic
 * (بالثانية والدقيقة والساعة واليوم)
 */
export function formatDetailedExamDuration(totalSeconds?: number, fallbackText?: string): string {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    if (fallbackText && fallbackText.includes('ساعة') && fallbackText.includes('يوم')) {
      return fallbackText;
    }
    // Try parsing minutes and seconds from fallback text like "15 دقيقة و 30 ثانية"
    if (fallbackText) {
      const minsMatch = fallbackText.match(/(\d+)\s*دقيق/);
      const secsMatch = fallbackText.match(/(\d+)\s*ثاني/);
      if (minsMatch || secsMatch) {
        const m = minsMatch ? parseInt(minsMatch[1], 10) : 0;
        const s = secsMatch ? parseInt(secsMatch[1], 10) : 0;
        const total = m * 60 + s;
        return formatDetailedExamDuration(total);
      }
      return fallbackText;
    }
    return '0 يوم، 0 ساعة، 0 دقيقة، 0 ثانية';
  }

  const secs = Math.floor(totalSeconds);
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  return `${days} يوم، ${hours} ساعة، ${minutes} دقيقة، ${seconds} ثانية`;
}

/**
 * Formats submission timestamp clearly with day, date, hour, minute, and second
 */
export function formatDetailedSubmissionDate(dateStr?: string): string {
  if (!dateStr) return 'غير مسجل';
  // If already formatted with time and date in parentheses, return it
  if (dateStr.includes('(') && dateStr.includes(':')) return dateStr;
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const dayName = parsed.toLocaleDateString('ar-EG', { weekday: 'long' });
      const datePart = parsed.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
      const timePart = parsed.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${dayName} ${datePart} - الساعة ${timePart}`;
    }
  } catch {}
  return dateStr;
}

export interface StudentStats {
  totalExamsTaken: number;
  totalScore: number;
  totalMaxScore: number;
  averagePercentage: number;
  passedExamsCount: number;
  failedExamsCount: number;
  passRate: number;
  gradeBadge: string;
  gradeBadgeColor: string;
  examsList: ExamStatItem[];
}

export interface GradeAggregateStats {
  gradeName: string;
  totalStudents: number;
  activeStudents: number;
  loggedInStudents: number;
  totalExamsTaken: number;
  totalScoreEarned: number;
  totalMaxScorePossible: number;
  gradeAveragePercentage: number;
  overallPassRate: number;
  topStudents: Array<{
    student: User;
    stats: StudentStats;
  }>;
}

export const OFFICIAL_SCHOOL_GRADES = [
  'الصف الأول الابتدائي',
  'الصف الثاني الابتدائي',
  'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
] as const;

/**
 * Checks whether a grade is Primary (المرحلة الابتدائية) or Prep (المرحلة الإعدادية)
 * where there is NO division (بدون شعبة)
 */
export function isPrimaryOrPrepGrade(gradeStr: string | undefined): boolean {
  if (!gradeStr) return false;
  return gradeStr.includes('الابتدائي') || gradeStr.includes('الإعدادي') || gradeStr.includes('ابتدائي') || gradeStr.includes('إعدادي') || gradeStr.includes('اعدادي');
}

/**
 * Checks whether a grade is in the Secondary stage (المرحلة الثانوية)
 */
export function isSecondaryGrade(gradeStr: string | undefined): boolean {
  if (!gradeStr) return false;
  return gradeStr.includes('الثانوي') || gradeStr.includes('ثانوي') || gradeStr.includes('بكالوريا');
}

/**
 * Checks whether a grade is 3rd Secondary (الصف الثالث الثانوي)
 */
export function isThirdSecondaryGrade(gradeStr: string | undefined): boolean {
  if (!gradeStr) return false;
  return gradeStr.includes('الثالث الثانوي') || gradeStr.includes('3 ثانوي') || gradeStr.includes('تالتة ثانوي') || gradeStr.includes('ثالثة ثانوي') || gradeStr.includes('بكالوريا');
}

/**
 * Returns the allowed division options for a given school grade:
 * - Primary & Prep: [] (No division)
 * - 1st & 2nd Secondary: ['بكالوريا', 'عام', 'أزهر']
 * - 3rd Secondary: ['علمي علوم', 'علمي رياضة', 'شعبة أدبي', 'بكالوريا', 'عام', 'أزهر']
 */
export function getDivisionsForGrade(gradeStr: string | undefined, includeGeneralForCourses = false): string[] {
  if (!gradeStr || isPrimaryOrPrepGrade(gradeStr)) {
    return [];
  }
  if (isThirdSecondaryGrade(gradeStr)) {
    const base = [
      'علمي علوم',
      'علمي رياضة',
      'شعبة أدبي',
      'بكالوريا',
      'عام',
      'أزهر',
    ];
    return includeGeneralForCourses ? ['عام لجميع الشعب', ...base] : base;
  }
  if (isSecondaryGrade(gradeStr)) {
    const base = ['بكالوريا', 'عام', 'أزهر'];
    return includeGeneralForCourses ? ['عام لجميع الشعب', ...base] : base;
  }
  return [];
}

/**
 * Normalizes grade strings to match standard categories even with minor variations
 */
export function normalizeGrade(gradeStr: string | undefined): string {
  if (!gradeStr) return 'غير محدد';
  const trimmed = gradeStr.trim();
  if (trimmed.includes('الأول الابتدائي') || trimmed.includes('1 ابتدائي') || trimmed.includes('اولى ابتدائي') || trimmed.includes('أولى ابتدائي')) return 'الصف الأول الابتدائي';
  if (trimmed.includes('الثاني الابتدائي') || trimmed.includes('2 ابتدائي') || trimmed.includes('تانية ابتدائي') || trimmed.includes('ثانية ابتدائي')) return 'الصف الثاني الابتدائي';
  if (trimmed.includes('الثالث الابتدائي') || trimmed.includes('3 ابتدائي') || trimmed.includes('تالتة ابتدائي') || trimmed.includes('ثالثة ابتدائي')) return 'الصف الثالث الابتدائي';
  if (trimmed.includes('الرابع الابتدائي') || trimmed.includes('4 ابتدائي') || trimmed.includes('رابعة ابتدائي')) return 'الصف الرابع الابتدائي';
  if (trimmed.includes('الخامس الابتدائي') || trimmed.includes('5 ابتدائي') || trimmed.includes('خامسة ابتدائي')) return 'الصف الخامس الابتدائي';
  if (trimmed.includes('السادس الابتدائي') || trimmed.includes('6 ابتدائي') || trimmed.includes('سادسة ابتدائي') || trimmed.includes('ستة ابتدائي')) return 'الصف السادس الابتدائي';
  if (trimmed.includes('الأول الإعدادي') || trimmed.includes('1 إعدادي') || trimmed.includes('اولى اعدادي') || trimmed.includes('أولى إعدادي')) return 'الصف الأول الإعدادي';
  if (trimmed.includes('الثاني الإعدادي') || trimmed.includes('2 إعدادي') || trimmed.includes('تانية اعدادي') || trimmed.includes('ثانية إعدادي')) return 'الصف الثاني الإعدادي';
  if (trimmed.includes('الثالث الإعدادي') || trimmed.includes('3 إعدادي') || trimmed.includes('تالتة اعدادي') || trimmed.includes('ثالثة إعدادي') || trimmed.includes('الشهادة الإعدادية')) return 'الصف الثالث الإعدادي';
  if (trimmed.includes('الأول الثانوي') || trimmed.includes('1 ثانوي') || trimmed.includes('اولى ثانوي') || trimmed.includes('أولى ثانوي')) return 'الصف الأول الثانوي';
  if (trimmed.includes('الثاني الثانوي') || trimmed.includes('2 ثانوي') || trimmed.includes('تانية ثانوي') || trimmed.includes('ثانية ثانوي')) return 'الصف الثاني الثانوي';
  if (trimmed.includes('الثالث الثانوي') || trimmed.includes('3 ثانوي') || trimmed.includes('تالتة ثانوي') || trimmed.includes('ثالثة ثانوي') || trimmed.includes('الثانوية العامة') || trimmed.includes('بكالوريا')) return 'الصف الثالث الثانوي';
  return trimmed;
}

/**
 * Calculates aggregate score, exam stats, and percentage for a student account
 * Merges data from student.examResults and submissions table for maximum accuracy
 */
export function calculateStudentStats(
  student: User,
  allSubmissions: StudentExamSubmission[] = [],
  courses: Course[] = []
): StudentStats {
  const examMap = new Map<string, ExamStatItem>();

  // 1. Process student.examResults (built-in record)
  if (student.examResults && typeof student.examResults === 'object') {
    Object.entries(student.examResults).forEach(([examId, res]) => {
      if (!res) return;
      const score = Number(res.score) || 0;
      const maxScore = Number(res.maxScore) || 100;
      const percentage = Number(res.percentage) || (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
      const passed = typeof res.passed === 'boolean' ? res.passed : percentage >= 60;
      const attemptsCount = Number(res.attemptsCount) || 1;
      const completedAt = res.completedAt || res.submittedAt || '';

      examMap.set(examId, {
        examId,
        examTitle: 'امتحان مقرر',
        score,
        maxScore,
        percentage,
        passed,
        attemptsCount,
        completedAt,
        startedAt: res.startedAt,
        submittedAt: res.submittedAt || res.completedAt,
        durationTakenSeconds: (res as any).durationTakenSeconds,
        durationTakenFormatted: res.durationTakenFormatted,
      });
    });
  }

  // 2. Process allSubmissions matching this student
  const studentCleanPhone = (student.phone || '').replace(/\D/g, '');
  allSubmissions.forEach((sub) => {
    const subCleanPhone = (sub.studentPhone || '').replace(/\D/g, '');
    const isMatchingStudent =
      (sub.studentId && sub.studentId === student.id) ||
      (studentCleanPhone && subCleanPhone && studentCleanPhone === subCleanPhone) ||
      (sub.studentName && student.name && sub.studentName.trim() === student.name.trim());

    if (!isMatchingStudent || !sub.examId) return;

    const subScore = Number(sub.totalScore) || 0;
    const subMax = Number(sub.maxScore) || 100;
    const subPct = Number(sub.percentage) || (subMax > 0 ? Math.round((subScore / subMax) * 100) : 0);
    const subPassed = typeof sub.passed === 'boolean' ? sub.passed : subPct >= 60;

    const existing = examMap.get(sub.examId);
    if (!existing) {
      examMap.set(sub.examId, {
        examId: sub.examId,
        examTitle: sub.examTitle || 'امتحان مقرر',
        courseTitle: sub.courseTitle,
        score: subScore,
        maxScore: subMax,
        percentage: subPct,
        passed: subPassed,
        attemptsCount: Number(sub.attemptNumber) || 1,
        completedAt: sub.submittedAt || '',
        startedAt: sub.startedAt,
        submittedAt: sub.submittedAt,
        durationTakenSeconds: sub.durationTakenSeconds,
        durationTakenFormatted: sub.durationTakenFormatted,
      });
    } else {
      // Keep best score or latest
      if (subScore > existing.score || !existing.completedAt) {
        existing.score = Math.max(existing.score, subScore);
        existing.maxScore = Math.max(existing.maxScore, subMax);
        existing.percentage = Math.max(existing.percentage, subPct);
        existing.passed = existing.passed || subPassed;
        if (sub.examTitle && existing.examTitle === 'امتحان مقرر') {
          existing.examTitle = sub.examTitle;
        }
        if (sub.courseTitle) {
          existing.courseTitle = sub.courseTitle;
        }
        if (sub.submittedAt) {
          existing.completedAt = sub.submittedAt;
          existing.submittedAt = sub.submittedAt;
        }
        if (sub.startedAt) {
          existing.startedAt = sub.startedAt;
        }
        if (sub.durationTakenSeconds !== undefined) {
          existing.durationTakenSeconds = sub.durationTakenSeconds;
        }
        if (sub.durationTakenFormatted) {
          existing.durationTakenFormatted = sub.durationTakenFormatted;
        }
      }
      existing.attemptsCount = Math.max(existing.attemptsCount, Number(sub.attemptNumber) || 1);
    }
  });

  // 3. Resolve exam titles and course titles from courses if available
  if (courses.length > 0) {
    courses.forEach((course) => {
      (course.exams || []).forEach((ex) => {
        const item = examMap.get(ex.id);
        if (item) {
          item.examTitle = ex.title || item.examTitle;
          item.courseTitle = item.courseTitle || course.title;
        }
      });
      (course.lessons || []).forEach((lesson) => {
        (lesson.exams || []).forEach((ex) => {
          const item = examMap.get(ex.id);
          if (item) {
            item.examTitle = ex.title || item.examTitle;
            item.courseTitle = item.courseTitle || `${course.title} - ${lesson.title}`;
          }
        });
      });
    });
  }

  const examsList = Array.from(examMap.values());
  const totalExamsTaken = examsList.length;
  const totalScore = examsList.reduce((sum, item) => sum + item.score, 0);
  const totalMaxScore = examsList.reduce((sum, item) => sum + item.maxScore, 0);

  const averagePercentage =
    totalMaxScore > 0
      ? Math.round((totalScore / totalMaxScore) * 100)
      : totalExamsTaken > 0
      ? Math.round(examsList.reduce((sum, item) => sum + item.percentage, 0) / totalExamsTaken)
      : 0;

  const passedExamsCount = examsList.filter((item) => item.passed).length;
  const failedExamsCount = totalExamsTaken - passedExamsCount;
  const passRate = totalExamsTaken > 0 ? Math.round((passedExamsCount / totalExamsTaken) * 100) : 0;

  let gradeBadge = 'لم يؤدِ امتحانات بعد ⏳';
  let gradeBadgeColor = 'bg-slate-100 text-slate-600 border-slate-200';

  if (totalExamsTaken > 0) {
    if (averagePercentage >= 90) {
      gradeBadge = 'ممتاز مع مرتبة الشرف 🏆';
      gradeBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
    } else if (averagePercentage >= 80) {
      gradeBadge = 'ممتاز 🌟';
      gradeBadgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    } else if (averagePercentage >= 70) {
      gradeBadge = 'جيد جداً 👍';
      gradeBadgeColor = 'bg-indigo-100 text-indigo-900 border-indigo-300';
    } else if (averagePercentage >= 60) {
      gradeBadge = 'جيد 📘';
      gradeBadgeColor = 'bg-sky-100 text-sky-900 border-sky-300';
    } else if (averagePercentage >= 50) {
      gradeBadge = 'مقبول ⚠️';
      gradeBadgeColor = 'bg-orange-100 text-orange-900 border-orange-300';
    } else {
      gradeBadge = 'يحتاج متابعة وتكثيف 🔴';
      gradeBadgeColor = 'bg-rose-100 text-rose-900 border-rose-300';
    }
  }

  return {
    totalExamsTaken,
    totalScore,
    totalMaxScore,
    averagePercentage,
    passedExamsCount,
    failedExamsCount,
    passRate,
    gradeBadge,
    gradeBadgeColor,
    examsList,
  };
}

/**
 * Aggregates statistics for an entire grade / educational stage
 */
export function calculateGradeAggregateStats(
  gradeName: string,
  studentsInGrade: User[],
  allSubmissions: StudentExamSubmission[] = [],
  courses: Course[] = []
): GradeAggregateStats {
  const totalStudents = studentsInGrade.length;
  const activeStudents = studentsInGrade.filter((s) => (s.status || 'active') === 'active').length;
  const loggedInStudents = studentsInGrade.filter((s) => s.activeSessionId).length;

  const scoredStudents = studentsInGrade.map((student) => ({
    student,
    stats: calculateStudentStats(student, allSubmissions, courses),
  }));

  // Sort descending by total score and average percentage
  scoredStudents.sort((a, b) => {
    if (b.stats.totalScore !== a.stats.totalScore) {
      return b.stats.totalScore - a.stats.totalScore;
    }
    return b.stats.averagePercentage - a.stats.averagePercentage;
  });

  const totalExamsTaken = scoredStudents.reduce((sum, s) => sum + s.stats.totalExamsTaken, 0);
  const totalScoreEarned = scoredStudents.reduce((sum, s) => sum + s.stats.totalScore, 0);
  const totalMaxScorePossible = scoredStudents.reduce((sum, s) => sum + s.stats.totalMaxScore, 0);

  const studentsWithExams = scoredStudents.filter((s) => s.stats.totalExamsTaken > 0);
  const gradeAveragePercentage =
    totalMaxScorePossible > 0
      ? Math.round((totalScoreEarned / totalMaxScorePossible) * 100)
      : studentsWithExams.length > 0
      ? Math.round(
          studentsWithExams.reduce((sum, s) => sum + s.stats.averagePercentage, 0) / studentsWithExams.length
        )
      : 0;

  const totalPassed = scoredStudents.reduce((sum, s) => sum + s.stats.passedExamsCount, 0);
  const overallPassRate = totalExamsTaken > 0 ? Math.round((totalPassed / totalExamsTaken) * 100) : 0;

  return {
    gradeName,
    totalStudents,
    activeStudents,
    loggedInStudents,
    totalExamsTaken,
    totalScoreEarned,
    totalMaxScorePossible,
    gradeAveragePercentage,
    overallPassRate,
    topStudents: scoredStudents.slice(0, 5),
  };
}

/**
 * Web Audio sound effects for the Lucky Wheel
 */
let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playWheelTickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {}
}

export function playWinnerFanfareSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.55);
    });
  } catch {}
}
