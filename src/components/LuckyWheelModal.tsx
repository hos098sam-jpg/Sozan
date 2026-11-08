import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Sparkles,
  Trophy,
  Gift,
  RotateCw,
  Award,
  Users,
  CheckCircle2,
  Share2,
  MessageCircle,
  Bell,
  SlidersHorizontal,
  ChevronDown,
  Percent,
  Check,
  Calendar,
  Phone,
  School,
  MapPin,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, StudentExamSubmission, Course, PlatformSettings } from '../types';
import {
  calculateStudentStats,
  normalizeGrade,
  OFFICIAL_SCHOOL_GRADES,
  playWheelTickSound,
  playWinnerFanfareSound,
  StudentStats
} from '../utils/studentStats';
import { broadcastNotification } from '../utils/notifications';

interface LuckyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: User[];
  submissions?: StudentExamSubmission[];
  courses?: Course[];
  platformSettings: PlatformSettings;
  initialGrade?: string;
  onWinnerAnnounced?: (winner: User, prize: string) => void;
}

export interface LuckyWinnerRecord {
  id: string;
  winnerName: string;
  winnerPhone: string;
  winnerGrade: string;
  prize: string;
  wonAt: string;
  totalScore: number;
  averagePercentage: number;
}

const STORAGE_WINNERS_KEY = 'qalb_alam_lucky_wheel_winners';

const PRESET_PRIZES = [
  'كورس مجاني بالكامل 🎁',
  'اشتراك شهر مجاناً 🎟️',
  'مكافأة تفوق نقدية (500 جنيه) 💰',
  'شهادة تقدير وجائزة عينية فخمة 📜',
  'كود تفعيل امتحانات VIP 🌟',
  'كارت شحن رصيد هدية 📱',
];

const WHEEL_PALETTE = [
  '#4f46e5', // indigo-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0d9488', // teal-600
  '#ea580c', // orange-600
  '#0284c7', // sky-600
  '#db2777', // pink-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
];

export const LuckyWheelModal: React.FC<LuckyWheelModalProps> = ({
  isOpen,
  onClose,
  students,
  submissions = [],
  courses = [],
  platformSettings,
  initialGrade = 'all',
  onWinnerAnnounced,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>(initialGrade);
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'with_exams' | 'high_scorers' | 'active_only'>('all');
  const [prize, setPrize] = useState<string>(PRESET_PRIZES[0]);
  const [customPrizeInput, setCustomPrizeInput] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winner, setWinner] = useState<{ user: User; stats: StudentStats; prize: string } | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRotationRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Winners log
  const [winnersHistory, setWinnersHistory] = useState<LuckyWinnerRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_WINNERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const saveWinnerToHistory = (record: LuckyWinnerRecord) => {
    const updated = [record, ...winnersHistory];
    setWinnersHistory(updated);
    try {
      localStorage.setItem(STORAGE_WINNERS_KEY, JSON.stringify(updated));
    } catch {}
  };

  // Sync initialGrade if changed externally
  useEffect(() => {
    if (initialGrade) setSelectedGrade(initialGrade);
  }, [initialGrade]);

  // Candidates for the wheel based on grade and eligibility
  const candidateStudents = useMemo(() => {
    return students.filter((st) => {
      // Must not be teacher or admin
      if (st.role === 'teacher' || st.role === 'admin') return false;

      // Grade match
      if (selectedGrade !== 'all') {
        const studentNormGrade = normalizeGrade(st.schoolYear);
        const selectedNormGrade = normalizeGrade(selectedGrade);
        if (studentNormGrade !== selectedNormGrade && !st.schoolYear?.includes(selectedGrade)) {
          return false;
        }
      }

      // Status check
      const status = st.status || 'active';
      if (eligibilityFilter === 'active_only' && status !== 'active' && status !== 'approved') {
        return false;
      }

      // Stats check
      if (eligibilityFilter === 'with_exams' || eligibilityFilter === 'high_scorers') {
        const stats = calculateStudentStats(st, submissions, courses);
        if (eligibilityFilter === 'with_exams' && stats.totalExamsTaken === 0) return false;
        if (eligibilityFilter === 'high_scorers' && (stats.totalExamsTaken === 0 || stats.averagePercentage < 65)) return false;
      }

      return true;
    });
  }, [students, selectedGrade, eligibilityFilter, submissions, courses]);

  // Slices for the wheel (capped to 24 for visual beauty if too many)
  const wheelSlices = useMemo(() => {
    if (candidateStudents.length === 0) return [];
    if (candidateStudents.length <= 24) return candidateStudents;
    // If more than 24, shuffle/slice representative pool or include all
    return candidateStudents.slice(0, 24);
  }, [candidateStudents]);

  // Draw the wheel on canvas
  const drawWheel = (rotationAngleRad: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 16;

    ctx.clearRect(0, 0, width, height);

    if (wheelSlices.length === 0) {
      // Draw empty placeholder wheel
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 16px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('لا يوجد طلاب مسجلون في هذه المرحلة', centerX, centerY);
      ctx.restore();
      return;
    }

    const numSlices = wheelSlices.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngleRad);

    // Outer wheel rim shadow & glow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 12;

    for (let i = 0; i < numSlices; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = (i + 1) * sliceAngle;
      const color = WHEEL_PALETTE[i % WHEEL_PALETTE.length];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Draw Student Name Text
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      // Scale font based on slices count
      const fontSize = numSlices > 16 ? 11 : numSlices > 10 ? 13 : 15;
      ctx.font = `bold ${fontSize}px Cairo, sans-serif`;

      const studentName = wheelSlices[i].name || 'طالب';
      const shortName = studentName.split(' ').slice(0, 2).join(' ');
      ctx.fillText(shortName, radius - 20, 0);

      ctx.restore();
    }

    // Outer border ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#fbbf24'; // Gold ring
    ctx.stroke();

    ctx.restore();

    // Center Hub (Pin)
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b'; // Dark indigo
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fbbf24'; // Gold
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('كسبت', centerX, centerY - 6);
    ctx.fillText('معانا 🎁', centerX, centerY + 10);
    ctx.restore();

    // Top Pointer (Indicator Arrow at the top: 12 o'clock, pointing downwards)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX - 16, centerY - radius - 10);
    ctx.lineTo(centerX + 16, centerY - radius - 10);
    ctx.lineTo(centerX, centerY - radius + 18);
    ctx.closePath();
    ctx.fillStyle = '#dc2626'; // Bright Red
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  };

  // Redraw when slices or rotation change
  useEffect(() => {
    if (isOpen) {
      drawWheel(currentRotationRef.current);
    }
  }, [isOpen, wheelSlices]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  // Spin the wheel function
  const handleSpinWheel = () => {
    if (isSpinning || wheelSlices.length === 0) return;

    setIsSpinning(true);
    setWinner(null);
    setBroadcastSent(false);

    // Pick a random winner index from the candidates
    const winningIndex = Math.floor(Math.random() * wheelSlices.length);
    const winningStudent = wheelSlices[winningIndex];

    const numSlices = wheelSlices.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    // We want the winner slice center to land directly at the top pointer (angle: -PI/2 or 3*PI/2)
    // Segment i starts at i * sliceAngle, center at (i + 0.5) * sliceAngle
    // Current angle + Target rotation = target position under pointer
    const pointerAngle = (3 * Math.PI) / 2; // top 12 o'clock
    const winningSliceCenter = (winningIndex + 0.5) * sliceAngle;

    // Full rotations for suspense (between 6 and 9 full spins)
    const fullSpins = 6 + Math.floor(Math.random() * 4);
    const totalSpinAngle = fullSpins * 2 * Math.PI + (pointerAngle - winningSliceCenter);

    const startRotation = currentRotationRef.current % (2 * Math.PI);
    const targetRotation = startRotation + totalSpinAngle;
    const durationMs = 4600; // 4.6 seconds of suspense
    const startTime = performance.now();

    let lastTickAngle = startRotation;

    const animateSpin = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease-out cubic easing function for realistic spinning deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentAngle = startRotation + (targetRotation - startRotation) * easeOut;

      currentRotationRef.current = currentAngle;
      drawWheel(currentAngle);

      // Sound tick when passing a slice boundary
      if (Math.abs(currentAngle - lastTickAngle) >= sliceAngle) {
        playWheelTickSound();
        lastTickAngle = currentAngle;
      }

      if (progress < 1) {
        animFrameIdRef.current = requestAnimationFrame(animateSpin);
      } else {
        // Spin finished!
        setIsSpinning(false);
        currentRotationRef.current = targetRotation;
        drawWheel(targetRotation);

        // Triumph sound & confetti
        playWinnerFanfareSound();
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.5 },
        });

        // Compute winner stats and prize
        const finalPrize = customPrizeInput.trim() || prize;
        const stats = calculateStudentStats(winningStudent, submissions, courses);

        const winnerObj = {
          user: winningStudent,
          stats,
          prize: finalPrize,
        };

        setWinner(winnerObj);

        // Save to winners history
        const record: LuckyWinnerRecord = {
          id: 'win_' + Date.now(),
          winnerName: winningStudent.name,
          winnerPhone: winningStudent.phone,
          winnerGrade: winningStudent.schoolYear,
          prize: finalPrize,
          wonAt: new Date().toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          totalScore: stats.totalScore,
          averagePercentage: stats.averagePercentage,
        };
        saveWinnerToHistory(record);

        // Notify parent if callback provided
        onWinnerAnnounced?.(winningStudent, finalPrize);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animateSpin);
  };

  // Broadcast winner to all students via platform notifications
  const handleBroadcastWinner = () => {
    if (!winner) return;
    const finalPrize = customPrizeInput.trim() || prize;
    broadcastNotification(
      `🎉 كسبت معانا! مبروك للطالب ${winner.user.name}`,
      `تم إجراء سحب عجلة الحظ «كسبت معانا» لطلاب (${winner.user.schoolYear})، وفاز الطالب ${winner.user.name} بجائزة: [${finalPrize}]. ألف مبروك ونتمنى التوفيق لجميع الطلاب!`,
      'urgent',
      'all'
    );
    setBroadcastSent(true);
  };

  // WhatsApp link to congratulate winner
  const getWinnerWhatsappLink = () => {
    if (!winner) return '';
    const cleanPhone = (winner.user.phone || '').replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const msg = `ألف مبروك يا ${winner.user.name}! 🏆🎉
يسعدنا في منصة «${platformSettings.platformName}» بإشراف ${platformSettings.supervisorName} أن نبلغك بفوزك معنا في سحب عجلة الحظ «كسبت معانا»!
🎁 جائزتك: ${winner.prize}
مرحلتك: ${winner.user.schoolYear}
درجاتك وإحصائياتك المميزة ساهمت في تميزك معنا. تواصل معنا لتأكيد واستلام الجائزة!`;

    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-400/20">
              🎡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black">عجلة الحظ: كسبت معانا!</h3>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  سحب حصري 🎉
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium">
                سحب عشوائي تفاعلي لتكريم واختيار طالب فائز من طلاب المرحلة المحددة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black transition-all flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">سجل الفائزين ({winnersHistory.length})</span>
            </button>
            <button
              onClick={onClose}
              disabled={isSpinning}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Winners History Drawer */}
          {showHistory && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  <span>سجل الفائزين السابقين في «كسبت معانا»</span>
                </span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs font-bold text-amber-700 hover:underline"
                >
                  إخفاء السجل ✕
                </button>
              </div>

              {winnersHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">لا توجد سحوبات مسجلة بعد، ابدأ السحب الأول الآن!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {winnersHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-slate-700 text-xs space-y-1 shadow-xs"
                    >
                      <div className="font-black text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{item.winnerName}</span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                          {item.wonAt}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">{item.winnerGrade}</div>
                      <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">
                        الجائزة: {item.prize}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grade Selector Tabs (زرار لكل طلاب مرحلة لوحده) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>اختر المرحلة الدراسية لحصر طلابها في العجلة:</span>
              </label>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                المرشحون المؤهلون: {candidateStudents.length} طالب
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedGrade('all')}
                disabled={isSpinning}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                  selectedGrade === 'all'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                جميع المراحل ({students.filter((s) => s.role !== 'teacher' && s.role !== 'admin').length})
              </button>

              {OFFICIAL_SCHOOL_GRADES.map((grade) => {
                const countInGrade = students.filter(
                  (s) => s.role !== 'teacher' && s.role !== 'admin' && normalizeGrade(s.schoolYear) === grade
                ).length;
                const isSelected = normalizeGrade(selectedGrade) === grade || selectedGrade === grade;

                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setSelectedGrade(grade)}
                    disabled={isSpinning}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{grade}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {countInGrade}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Eligibility Filter & Prize Setting Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filter */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                <span>شروط ومعايير دخول السحب:</span>
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEligibilityFilter('all')}
                  disabled={isSpinning}
                  className={`p-2 rounded-xl text-center font-bold border transition-all ${
                    eligibilityFilter === 'all'
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 text-indigo-900 dark:text-indigo-200 font-black'
                      : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600'
                  }`}
                >
                  جميع طلاب المرحلة
                </button>
                <button
                  type="button"
                  onClick={() => setEligibilityFilter('with_exams')}
                  disabled={isSpinning}
                  className={`p-2 rounded-xl text-center font-bold border transition-all ${
                    eligibilityFilter === 'with_exams'
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 text-indigo-900 dark:text-indigo-200 font-black'
                      : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600'
                  }`}
                >
                  الذين خاضوا امتحانات فقط
                </button>
                <button
                  type="button"
                  onClick={() => setEligibilityFilter('high_scorers')}
                  disabled={isSpinning}
                  className={`p-2 rounded-xl text-center font-bold border transition-all ${
                    eligibilityFilter === 'high_scorers'
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 text-indigo-900 dark:text-indigo-200 font-black'
                      : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600'
                  }`}
                >
                  المتفوقون (نسبة ≥ 65%)
                </button>
                <button
                  type="button"
                  onClick={() => setEligibilityFilter('active_only')}
                  disabled={isSpinning}
                  className={`p-2 rounded-xl text-center font-bold border transition-all ${
                    eligibilityFilter === 'active_only'
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 text-indigo-900 dark:text-indigo-200 font-black'
                      : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-600'
                  }`}
                >
                  الحسابات المفعلة فقط
                </button>
              </div>
            </div>

            {/* Prize Selector */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-600" />
                <span>تحديد الجائزة التي سيكسبها الطالب:</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_PRIZES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPrize(p);
                      setCustomPrizeInput('');
                    }}
                    disabled={isSpinning}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      prize === p && !customPrizeInput
                        ? 'bg-amber-100 border-amber-300 text-amber-950 font-black'
                        : 'bg-white dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="أو اكتب جائزة مخصصة هنا..."
                value={customPrizeInput}
                onChange={(e) => setCustomPrizeInput(e.target.value)}
                disabled={isSpinning}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Wheel Stage Area */}
          <div className="flex flex-col items-center justify-center p-4 sm:p-6 rounded-3xl bg-slate-900 text-white shadow-inner relative overflow-hidden">
            {/* Background ambient lighting */}
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl pointer-events-none"></div>

            {/* Canvas Wheel */}
            <div className="relative mb-5">
              <canvas
                ref={canvasRef}
                width={380}
                height={380}
                className="max-w-full w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] rounded-full drop-shadow-2xl transition-transform"
              />
            </div>

            {/* Spin CTA Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleSpinWheel}
                disabled={isSpinning || wheelSlices.length === 0}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <RotateCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'جاري السحب والتدوير...' : '🎡 لِف العجلة وابدأ السحب!'}</span>
              </button>

              <span className="text-[11px] text-slate-400">
                {candidateStudents.length === 0
                  ? 'يرجى اختيار مرحلة بها طلاب'
                  : `يتم السحب بين ${candidateStudents.length} طالب من طلاب ${selectedGrade === 'all' ? 'جميع المراحل' : selectedGrade}`}
              </span>
            </div>
          </div>

          {/* Winner Celebration Card (كسبت معانا!) */}
          {winner && (
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-amber-50 via-amber-100/70 to-emerald-50 dark:from-amber-950/40 dark:via-slate-900 dark:to-emerald-950/40 border-2 border-amber-400 shadow-xl animate-scaleIn space-y-5">
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>🎉 كسبت معانا في منصة المتفلسفة ! 🎉</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">
                  {winner.user.name}
                </h2>
                <div className="text-sm font-bold text-indigo-700 dark:text-indigo-400 flex items-center justify-center gap-2">
                  <span>{winner.user.schoolYear}</span>
                  {winner.user.division && <span>• {winner.user.division}</span>}
                </div>
              </div>

              {/* Prize Banner */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-center shadow-xs">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  الجائزة المستحقة:
                </span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
                  <Gift className="w-5 h-5" />
                  <span>{winner.prize}</span>
                </span>
              </div>

              {/* Winner Account Stats Summary (تجميع الدرجات والإحصائيات) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-500 block">إجمالي الامتحانات</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {winner.stats.totalExamsTaken} امتحان
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-500 block">مجموع الدرجات</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                    {winner.stats.totalScore} / {winner.stats.totalMaxScore || 100}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-500 block">متوسط النسبة</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    %{winner.stats.averagePercentage}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-500 block">التقييم العام</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block truncate">
                    {winner.stats.gradeBadge}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={getWinnerWhatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/30 flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال تهنئة عبر واتساب 📲</span>
                </a>

                <button
                  type="button"
                  onClick={handleBroadcastWinner}
                  disabled={broadcastSent}
                  className={`px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                    broadcastSent
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span>{broadcastSent ? 'تم إرسال إشعار الفوز للمنصة ✓' : 'نشر التهنئة في إشعارات المنصة 📢'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSpinWheel}
                  className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-black text-xs transition-all flex items-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>سحب فائز آخر 🔄</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>منصة المتفلسفة  • برنامج السحوبات والمسابقات الرسمية</div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300 transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
