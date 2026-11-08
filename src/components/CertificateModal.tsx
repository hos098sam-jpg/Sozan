import React from 'react';
import { Award, Printer, Share2, X, CheckCircle2, Sparkles, ShieldCheck, GraduationCap } from 'lucide-react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentGrade?: string;
  courseTitle: string;
  examTitle?: string;
  scorePercentage: number;
  scoreText?: string;
  instructorName?: string;
  issuedDate?: string;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentGrade = 'المرحلة الثانوية',
  courseTitle,
  examTitle,
  scorePercentage,
  scoreText,
  instructorName = 'د. حسام شحاته',
  issuedDate,
}) => {
  if (!isOpen) return null;

  const formattedDate =
    issuedDate ||
    new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const serialNumber = `QALB-${new Date().getFullYear()}-${Math.abs(
    (studentName + courseTitle).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 1000)
  )}`;

  const shareText = encodeURIComponent(
    `🎓 الحمد لله! حصلت على شهادة تقدير وتفوق بنسبة ${scorePercentage}% في "${
      examTitle || courseTitle
    }" على منصة المتفلسفة  التعليمية 🏆✨`
  );
  const whatsappShareUrl = `https://wa.me/?text=${shareText}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    window.location.origin
  )}&quote=${shareText}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl my-auto">
        {/* Top Action Bar (Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 sm:px-5 shadow-xl print:hidden">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base">شهادة تقدير وتفوق رسمية (PDF جاهزة للطباعة)</h4>
              <p className="text-[11px] text-slate-400 font-bold">
                يمكنك طباعتها أو حفظها بصيغة PDF ومشاركتها مع أصدقائك وولي أمرك
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة / حفظ كـ PDF
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm transition"
            >
              <Share2 className="w-4 h-4" />
              مشاركة واتساب
            </a>

            <a
              href={facebookShareUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm transition"
            >
              فيسبوك
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Luxury Certificate Frame */}
        <div
          id="printable-certificate"
          className="relative bg-[#fffdf7] text-slate-900 rounded-3xl p-4 sm:p-8 shadow-2xl border-8 border-double border-amber-500/80 overflow-hidden print:shadow-none print:rounded-none print:border-4"
        >
          {/* Decorative Corner Ornaments */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-amber-500/15 via-amber-400/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute top-0 left-0 w-36 h-36 bg-gradient-to-br from-emerald-600/15 via-emerald-400/5 to-transparent rounded-br-full pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-36 h-36 bg-gradient-to-tl from-emerald-600/15 via-emerald-400/5 to-transparent rounded-tl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-amber-500/15 via-amber-400/5 to-transparent rounded-tr-full pointer-events-none" />

          {/* Inner Golden Border */}
          <div className="relative border-2 border-amber-500/50 rounded-2xl p-6 sm:p-10 text-center">
            {/* Top Platform Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-amber-500/20 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <h3 className="font-black text-base sm:text-lg text-emerald-900">منصة المتفلسفة  التعليمية</h3>
                  <p className="text-xs font-bold text-slate-500">صرح التفوق العلمي والتميز الأكاديمي</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-800 text-xs font-black">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>وثيقة تفوق معتمدة • {serialNumber}</span>
              </div>
            </div>

            {/* Main Certificate Title */}
            <div className="my-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-white shadow-xl shadow-amber-500/30 mb-3 border-4 border-amber-100">
                <Award className="w-11 h-11" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-800 tracking-tight mb-2">
                شهادة تقدير وتفوق علمي
              </h1>
              <p className="text-sm sm:text-base font-bold text-slate-600">
                تتشرف إدارة <span className="text-emerald-800 font-black">منصة المتفلسفة  التعليمية</span> بمنح هذه الشهادة إلى الطالب/ـة المتفوق/ـة:
              </p>
            </div>

            {/* Student Name Banner */}
            <div className="my-6 py-4 px-6 mx-auto max-w-xl rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50/90 to-amber-50 border-2 border-amber-400/60 shadow-inner">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-wide">
                {studentName}
              </h2>
              {studentGrade && (
                <p className="text-xs sm:text-sm font-black text-amber-800 mt-1">{studentGrade}</p>
              )}
            </div>

            {/* Achievement Details */}
            <p className="text-sm sm:text-lg text-slate-700 font-bold max-w-2xl mx-auto leading-relaxed mb-6">
              وذلك تقديراً لتفوقه/ـا واجتيازه/ـا بنجاح باهر{' '}
              {examTitle ? (
                <>
                  الاختبار التقييمي <span className="text-emerald-800 font-black">«{examTitle}»</span> ضمن كورس{' '}
                </>
              ) : (
                <>متطلبات كورس </>
              )}
              <span className="text-indigo-900 font-black">«{courseTitle}»</span> بتقدير عام ممتاز ونسبة نجاح:
            </p>

            {/* Score Badge */}
            <div className="inline-flex items-center gap-4 bg-emerald-900 text-white px-7 py-3 rounded-2xl shadow-lg mb-8 border-2 border-amber-400">
              <div className="text-right">
                <span className="block text-[11px] text-emerald-200 font-bold">النسبة المئوية المحققة</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-300">{scorePercentage}%</span>
              </div>
              {scoreText && (
                <div className="border-r border-emerald-700 pr-4 text-right">
                  <span className="block text-[11px] text-emerald-200 font-bold">الدرجة الكلية</span>
                  <span className="text-lg sm:text-xl font-black text-white">{scoreText}</span>
                </div>
              )}
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Footer Signatures & Seal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-6 pt-6 border-t-2 border-amber-500/25 text-sm">
              <div className="text-center sm:text-right">
                <p className="text-xs font-bold text-slate-500 mb-1">تاريخ الإصدار والاعتماد</p>
                <p className="font-black text-slate-800">{formattedDate}</p>
              </div>

              {/* Official Gold Seal */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-double border-amber-600 bg-amber-50 flex flex-col items-center justify-center text-amber-800 shadow-inner">
                  <ShieldCheck className="w-7 h-7 text-amber-600" />
                  <span className="text-[10px] font-black leading-tight mt-0.5">ختم المنصة</span>
                  <span className="text-[9px] font-bold text-emerald-800">معتمد رسمياً</span>
                </div>
              </div>

              <div className="text-center sm:text-left">
                <p className="text-xs font-bold text-slate-500 mb-1">المشرف الأكاديمي ومؤسس المنصة</p>
                <p className="font-black text-base text-emerald-900">{instructorName}</p>
                <p className="text-[11px] font-bold text-amber-700">منصة المتفلسفة  التعليمية</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
