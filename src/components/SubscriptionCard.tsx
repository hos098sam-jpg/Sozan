import React, { useRef, useState } from 'react';
import { CourseAccessCode } from '../types';
import { Copy, Check, Download, Printer, Lock, Globe, BookOpen, GraduationCap } from 'lucide-react';

interface SubscriptionCardProps {
  accessCode: CourseAccessCode;
  onCopy?: (code: string) => void;
  showActions?: boolean;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  accessCode,
  onCopy,
  showActions = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(accessCode.code);
    setCopied(true);
    if (onCopy) onCopy(accessCode.code);
    setTimeout(() => setCopied(false), 2000);
  };

  // High-Resolution PNG Card Generator using HTML5 Canvas
  const handleDownloadAsImage = () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      // High-resolution 16:9 card (1600 x 900 px)
      canvas.width = 1600;
      canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Base Gradient Background (Soft lilac / lavender with subtle glow)
      const bgGradient = ctx.createRadialGradient(800, 450, 50, 800, 450, 900);
      bgGradient.addColorStop(0, '#eef2ff');
      bgGradient.addColorStop(0.5, '#e0e7ff');
      bgGradient.addColorStop(1, '#c7d2fe');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, 1600, 900);

      // Subtle ambient orbital circles / particles
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.beginPath();
      ctx.arc(140, 180, 12, 0, Math.PI * 2);
      ctx.arc(220, 320, 8, 0, Math.PI * 2);
      ctx.arc(1450, 220, 14, 0, Math.PI * 2);
      ctx.arc(1380, 400, 9, 0, Math.PI * 2);
      ctx.arc(150, 680, 10, 0, Math.PI * 2);
      ctx.arc(1460, 720, 12, 0, Math.PI * 2);
      ctx.fill();

      // Subtle network lines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(140, 180);
      ctx.lineTo(220, 320);
      ctx.lineTo(150, 680);
      ctx.moveTo(1450, 220);
      ctx.lineTo(1380, 400);
      ctx.lineTo(1460, 720);
      ctx.stroke();

      // 2. Inner Card Frame with Rounded Corners & Soft Shadow
      const cardX = 180;
      const cardY = 50;
      const cardW = 1240;
      const cardH = 800;
      const radius = 48;

      ctx.save();
      ctx.shadowColor = 'rgba(30, 41, 59, 0.12)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 16;

      const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      cardGradient.addColorStop(0, '#ffffff');
      cardGradient.addColorStop(1, '#f8fafc');
      ctx.fillStyle = cardGradient;

      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, radius);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // 3. Heart Emblem with Atom, Brain, and Book (Top Center)
      const heartCenterX = 800;
      const heartCenterY = 135;

      // Draw glowing heart shield
      ctx.save();
      ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
      ctx.shadowBlur = 24;

      const heartGrad = ctx.createLinearGradient(740, 85, 860, 185);
      heartGrad.addColorStop(0, '#4f46e5');
      heartGrad.addColorStop(0.5, '#7c3aed');
      heartGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = heartGrad;

      // Heart Path
      ctx.beginPath();
      ctx.moveTo(800, 180);
      ctx.bezierCurveTo(740, 150, 720, 110, 745, 90);
      ctx.bezierCurveTo(775, 70, 800, 100, 800, 115);
      ctx.bezierCurveTo(800, 100, 825, 70, 855, 90);
      ctx.bezierCurveTo(880, 110, 860, 150, 800, 180);
      ctx.fill();

      // White inner glow circle for atom/brain
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(heartCenterX, 130, 24, 0, Math.PI * 2);
      ctx.fill();

      // Mini Atom & Book inside heart
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(heartCenterX, 130, 16, 7, Math.PI / 4, 0, Math.PI * 2);
      ctx.ellipse(heartCenterX, 130, 16, 7, -Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(heartCenterX, 130, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Main Title
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 46px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('كارت اشتراك - المتفلسفة ', 800, 240);

      // 5. Course Pill (اسم الكورس)
      const pillW = 900;
      const pillH = 72;
      const pillX = 800 - pillW / 2;
      const pill1Y = 275;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.roundRect(pillX, pill1Y, pillW, pillH, 36);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Course Pill Text
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = '900 28px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('📖  اسم الكورس:', pillX + pillW - 40, pill1Y + 47);

      ctx.font = '700 28px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.fillStyle = '#334155';
      const courseTitleText = accessCode.courseTitle || 'جميع كورسات المنصة';
      ctx.fillText(courseTitleText, pillX + pillW - 250, pill1Y + 47);

      // 6. Teacher Pill (اسم المدرس)
      const pill2Y = 370;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.roundRect(pillX, pill2Y, pillW, pillH, 36);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Teacher Pill Text
      ctx.font = '900 28px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('🎓  اسم المدرس:', pillX + pillW - 40, pill2Y + 47);

      ctx.font = '700 28px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.fillStyle = '#334155';
      const teacherNameText = accessCode.teacherName || 'إدارة منصة المتفلسفة ';
      ctx.fillText(teacherNameText, pillX + pillW - 250, pill2Y + 47);

      // 7. Gold Dashed Subscription Box
      const goldBoxW = 900;
      const goldBoxH = 210;
      const goldBoxX = 800 - goldBoxW / 2;
      const goldBoxY = 470;

      // Outer Gold Background
      ctx.save();
      const goldGrad = ctx.createLinearGradient(goldBoxX, goldBoxY, goldBoxX, goldBoxY + goldBoxH);
      goldGrad.addColorStop(0, '#fef9ee');
      goldGrad.addColorStop(1, '#fdecc8');
      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.roundRect(goldBoxX, goldBoxY, goldBoxW, goldBoxH, 28);
      ctx.fill();

      // Dashed Border
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.stroke();
      ctx.restore();

      // Header inside Gold Box: "🔒 كود الاشتراك:"
      ctx.font = '900 32px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.fillStyle = '#92400e';
      ctx.textAlign = 'right';
      ctx.fillText('🔒  كود الاشتراك:', goldBoxX + goldBoxW - 45, goldBoxY + 52);

      // Inner Dashed Box for Code Value
      const innerCodeW = 820;
      const innerCodeH = 110;
      const innerCodeX = 800 - innerCodeW / 2;
      const innerCodeY = goldBoxY + 75;

      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.roundRect(innerCodeX, innerCodeY, innerCodeW, innerCodeH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.restore();

      // Code string in large monospace font
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.font = '900 48px "Courier New", monospace, sans-serif';
      ctx.fillStyle = '#78350f';
      ctx.fillText(accessCode.code, 800, innerCodeY + 72);

      // 8. Footer with URL and instructions
      const footerY = 745;
      // Gold thin accent lines
      ctx.save();
      const goldLineGrad = ctx.createLinearGradient(400, footerY - 25, 1200, footerY - 25);
      goldLineGrad.addColorStop(0, 'rgba(217, 119, 6, 0)');
      goldLineGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.5)');
      goldLineGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.strokeStyle = goldLineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(350, footerY - 20);
      ctx.lineTo(1250, footerY - 20);
      ctx.stroke();
      ctx.restore();

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.font = '700 24px "Cairo", "Tajawal", "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('🌐 motafalsifa.vercel.app • ادخل الكود في المنصة لتفعيل اشتراكك فوراً', 800, footerY + 15);

      // Convert canvas to downloadable PNG
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `كارت-اشتراك-قلب-العلم-${accessCode.code}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to export card image:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Visual Rendered Card matching user's exact uploaded design */}
      <div
        ref={cardRef}
        className="w-full max-w-2xl bg-gradient-to-br from-[#edf2fe] via-[#e4ebfd] to-[#d8e3fd] p-5 sm:p-8 rounded-[40px] shadow-xl border border-indigo-100 relative overflow-hidden select-none transition-all duration-300 hover:shadow-2xl"
        dir="rtl"
      >
        {/* Subtle celestial background effects */}
        <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-indigo-400/30 blur-[1px]" />
        <div className="absolute top-16 right-12 w-2 h-2 rounded-full bg-indigo-500/20" />
        <div className="absolute bottom-16 right-10 w-2.5 h-2.5 rounded-full bg-indigo-400/30" />
        <div className="absolute top-12 left-8 w-3.5 h-3.5 rounded-full bg-indigo-500/25" />
        <div className="absolute bottom-12 left-12 w-3 h-3 rounded-full bg-indigo-400/30" />

        {/* Inner Card White Slate */}
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col items-center space-y-5 relative">
          
          {/* Top Heart with Atom, Brain, and Book Logo */}
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-blue-500 p-0.5 shadow-lg shadow-indigo-300/40 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[14px] flex flex-col items-center justify-center p-2 text-indigo-600 relative overflow-hidden">
                <svg
                  viewBox="0 0 24 24"
                  className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600 fill-indigo-50"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-5 h-5 rounded-full border border-indigo-400 border-dashed animate-spin" style={{ animationDuration: '10s' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card Title */}
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 text-center tracking-tight">
            كارت اشتراك - المتفلسفة 
          </h2>

          {/* Fields Stack */}
          <div className="w-full space-y-3">
            {/* Field 1: Course Name */}
            <div className="w-full bg-white border border-slate-200/90 rounded-full px-5 py-3 shadow-xs flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-900 font-black shrink-0">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>اسم الكورس:</span>
              </div>
              <div className="font-bold text-slate-700 truncate text-left" dir="rtl">
                {accessCode.courseTitle || 'جميع كورسات المنصة'}
              </div>
            </div>

            {/* Field 2: Teacher Name */}
            <div className="w-full bg-white border border-slate-200/90 rounded-full px-5 py-3 shadow-xs flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-900 font-black shrink-0">
                <GraduationCap className="w-4 h-4 text-violet-600" />
                <span>اسم المدرس:</span>
              </div>
              <div className="font-bold text-slate-700 truncate text-left" dir="rtl">
                {accessCode.teacherName || 'إدارة منصة المتفلسفة '}
              </div>
            </div>
          </div>

          {/* Field 3: Golden Dashed Code Box */}
          <div className="w-full bg-gradient-to-b from-[#fefbf1] to-[#fdedca] border-2 border-dashed border-amber-500/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3 text-center">
            <div className="flex items-center justify-start gap-2 text-amber-900 font-black text-sm sm:text-base">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-800">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span>كود الاشتراك:</span>
            </div>

            {/* Inner Box with the Code */}
            <div className="w-full bg-white/70 backdrop-blur-xs border border-dashed border-amber-400/80 rounded-2xl py-3.5 px-4 flex items-center justify-center gap-3">
              <span
                className="font-mono font-black text-xl sm:text-2xl text-amber-950 tracking-wider selection:bg-amber-200"
                dir="ltr"
              >
                {accessCode.code}
              </span>

              <button
                onClick={handleCopy}
                className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors shadow-2xs"
                title="نسخ كود الاشتراك"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Card Footer */}
          <div className="w-full pt-3 border-t border-amber-200/80 flex flex-col sm:flex-row items-center justify-center gap-1.5 text-xs text-slate-600 font-bold text-center">
            <div className="flex items-center gap-1.5 text-indigo-900">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-sans">motafalsifa.vercel.app</span>
            </div>
            <span className="hidden sm:inline text-amber-500">•</span>
            <span className="text-slate-700">ادخل الكود في المنصة لتفعيل اشتراكك فوراً</span>
          </div>

          {/* Used Status Badge (if used) */}
          {accessCode.isUsed && (
            <div className="absolute top-4 left-4 bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm">
              تم التفعيل مسبقاً
            </div>
          )}
        </div>
      </div>

      {/* Action Controls for this Card */}
      {showActions && (
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <button
            onClick={handleDownloadAsImage}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'جاري تجهيز الصورة...' : 'تحميل الكارت كصورة PNG'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-black text-xs transition-colors shadow-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ الكود!' : 'نسخ الكود'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
        </div>
      )}
    </div>
  );
};
