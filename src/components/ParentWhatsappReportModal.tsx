import React, { useState } from 'react';
import { MessageCircle, X, CheckCircle2, Send, Copy, Sparkles, UserCheck } from 'lucide-react';
import { Course, StudentExamSubmission, User } from '../types';

interface ParentWhatsappReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  courses: Course[];
  submissions?: StudentExamSubmission[];
}

export function buildParentWhatsappReportText(
  student: User,
  courses: Course[],
  submissions: StudentExamSubmission[] = [],
  teacherName?: string
): string {
  const enrolledIds = student.enrolledCourseIds || [];
  const enrolledCourses = courses.filter((c) => enrolledIds.includes(String(c.id)));
  const totalLessonsInEnrolled = enrolledCourses.reduce(
    (acc, c) => acc + (Array.isArray(c.lessons) ? c.lessons.length : 0),
    0
  );
  const completedLessonsCount =
    student.completedLessonsIds?.length ||
    Object.keys(student.completedVideos || {}).length ||
    student.watchedVideos ||
    0;
  const studentSubs = submissions.filter(
    (s) =>
      String(s.studentId) === String(student.id) ||
      (student.phone && s.studentPhone === student.phone)
  );

  const recentExamsSummary =
    studentSubs.length > 0
      ? studentSubs
          .slice(0, 4)
          .map(
            (s) =>
              `• ${s.examTitle}: ${s.totalScore ?? s.score ?? 0}/${s.maxScore ?? s.totalPoints ?? 100} (${s.percentage}%) - ${
                s.passed || (s.percentage ?? 0) >= 60 ? 'ناجح ✅' : 'يحتاج مراجعة ⚠️'
              }`
          )
          .join('\n')
      : student.examResults && Object.keys(student.examResults).length > 0
      ? Object.values(student.examResults)
          .slice(0, 4)
          .map(
            (r) =>
              `• ${r.examTitle || 'امتحان إلكتروني'}: ${r.score}/${r.maxScore} (${r.percentage}%) - ${
                r.passed ? 'ناجح ✅' : 'يحتاج مراجعة ⚠️'
              }`
          )
          .join('\n')
      : student.completedExams && student.completedExams > 0
      ? `• اجتاز ${student.completedExams} اختبارات إلكترونية بمتوسط تقييم ممتاز.`
      : '• لم يؤدِّ اختبارات إلكترونية مؤخراً.';

  const coursesListText =
    enrolledCourses.length > 0
      ? enrolledCourses.map((c) => `📘 ${c.title}`).join('\n')
      : 'لم يتم تفعيل كورسات حالياً';

  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const signOff = teacherName
    ? `*الأستاذ / ${teacherName} - منصة المتفلسفة  التعليمية*`
    : `*إدارة منصة المتفلسفة  التعليمية - أ. حسام شحاته*`;

  return `السلام عليكم ورحمة الله وبركاته 🌿
تحية طيبة لولي أمر الطالب/ـة: *${student.name}* (${student.schoolYear || student.grade || 'المرحلة الثانوية'})
نرسل لحضرتكم تقرير المتابعة العلمية من *منصة المتفلسفة  التعليمية* بتاريخ (${today}):

📊 *أولاً: الكورسات المشترك بها الطالب:*
${coursesListText}

🎬 *ثانياً: متابعة حضور ومشاهدة الحصص:*
• عدد الحصص التي شاهدها الطالب: *${completedLessonsCount}* من إجمالي *${Math.max(
    totalLessonsInEnrolled,
    completedLessonsCount
  )}* حصة

📝 *ثالثاً: نتائج الامتحانات الإلكترونية الأخيرة:*
${recentExamsSummary}

نشكر اهتمامكم الدائم بمتابعة مستوى الطالب، ونتمنى له دوام التفوق والنجاح الباهر بإذن الله 🏆
${signOff}`;
}

export function formatEgyptianPhoneForWhatsapp(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return `2${digits}`;
  return `20${digits}`;
}

/**
 * Generates a direct Click-to-Chat WhatsApp link (https://wa.me/...) that opens
 * the teacher's own WhatsApp directly inside the parent's phone chat with the organized report ready to send.
 */
export function buildDirectParentWhatsappUrl(
  student: User,
  courses: Course[],
  submissions: StudentExamSubmission[] = [],
  teacherName?: string
): string {
  const rawParentPhone =
    student.parentPhone || student.fatherPhone || student.motherPhone || student.phone || '';
  const formattedPhone = formatEgyptianPhoneForWhatsapp(rawParentPhone);
  const reportText = buildParentWhatsappReportText(student, courses, submissions, teacherName);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(reportText)}`;
}

export const ParentWhatsappReportModal: React.FC<ParentWhatsappReportModalProps> = ({
  isOpen,
  onClose,
  student,
  courses,
  submissions = [],
}) => {
  if (!isOpen || !student) return null;

  const defaultMessage = buildParentWhatsappReportText(student, courses, submissions);
  const [customMessage, setCustomMessage] = useState(defaultMessage);
  const [parentPhone, setParentPhone] = useState(student.parentPhone || student.phone || '');
  const [copied, setCopied] = useState(false);

  const formattedWhatsappPhone = formatEgyptianPhoneForWhatsapp(parentPhone);
  const whatsappUrl = `https://wa.me/${formattedWhatsappPhone}?text=${encodeURIComponent(customMessage)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl space-y-4 my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                إرسال تقرير متابعة ولي الأمر عبر واتساب
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                الطالب: <span className="text-emerald-300">{student.name}</span> • {student.grade}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
            <label className="block text-[11px] font-black text-emerald-400 mb-1">
              رقم واتساب ولي الأمر المستهدف
            </label>
            <input
              type="text"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="010XXXXXXXX"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-black text-white dir-ltr"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-2.5">
            <UserCheck className="w-8 h-8 text-indigo-400 shrink-0" />
            <div className="text-xs font-bold">
              <span className="block text-slate-400">الحصص المشاهدة والامتحانات</span>
              <span className="text-white font-black">
                {student.completedLessonsIds?.length || student.watchedVideos || 0} حصة •{' '}
                {student.completedExams || 0} امتحان
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              نص التقرير المنسق الجاهز للإرسال (يمكنك التعديل عليه قبل الإرسال):
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-black text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'تم النسخ!' : 'نسخ التقرير'}
            </button>
          </div>
          <textarea
            rows={10}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs sm:text-sm text-slate-200 font-bold leading-relaxed focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black text-slate-300 cursor-pointer"
          >
            إغلاق
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black px-6 py-3 rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition"
          >
            <Send className="w-4 h-4" />
            إرسال التقرير لولي الأمر عبر واتساب الآن
          </a>
        </div>
      </div>
    </div>
  );
};
