import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Clock,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Medal,
  Flame,
  Star,
  Zap,
  Check,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Competition, CompetitionParticipant, User } from '../types';

interface CompetitionTakeViewProps {
  competition: Competition;
  currentUser: User | null;
  onBack: () => void;
  onCompetitionSubmitted: (updatedCompetition: Competition) => void;
  onOpenAuth: () => void;
}

export const CompetitionTakeView: React.FC<CompetitionTakeViewProps> = ({
  competition,
  currentUser,
  onBack,
  onCompetitionSubmitted,
  onOpenAuth,
}) => {
  const totalSeconds = (competition.durationMinutes || 15) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [timerActive, setTimerActive] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    percentage: number;
    rank: number;
  } | null>(null);

  // Timer countdown
  useEffect(() => {
    if (!currentUser || !timerActive || secondsRemaining <= 0 || result) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, secondsRemaining, result]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    if (result || isSubmitting) return;
    setIsSubmitting(true);

    let score = 0;
    let maxScore = 0;

    competition.questions.forEach((q) => {
      maxScore += q.marks;
      if (answers[q.id] !== undefined && answers[q.id] === q.correctOptionIndex) {
        score += q.marks;
      }
    });

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const timeTaken = totalSeconds - secondsRemaining;

    // Create participant entry
    const participantName = currentUser ? currentUser.name : 'طالب متفوق';
    const participantPhone = currentUser ? currentUser.phone : '010XXXXXXXX';
    const participantYear = currentUser ? currentUser.schoolYear : competition.schoolYear;

    const newParticipant: CompetitionParticipant = {
      studentId: currentUser ? currentUser.id : `guest-${Date.now()}`,
      studentName: participantName,
      studentPhone: participantPhone,
      schoolYear: participantYear,
      score,
      maxScore,
      percentage,
      timeTakenSeconds: timeTaken,
      submittedAt: 'الآن',
    };

    // Sort leaderboard by score descending, then by time taken ascending
    const newLeaderboard = [...(competition.leaderboard || []), newParticipant].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeTakenSeconds - b.timeTakenSeconds;
    });

    const myRank = newLeaderboard.findIndex((p) => p.studentId === newParticipant.studentId) + 1;

    const updatedCompetition: Competition = {
      ...competition,
      participantsCount: (competition.participantsCount || 0) + 1,
      leaderboard: newLeaderboard,
    };

    setResult({
      score,
      maxScore,
      percentage,
      rank: myRank > 0 ? myRank : 1,
    });
    setTimerActive(false);
    setIsSubmitting(false);

    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
    });

    onCompetitionSubmitted(updatedCompetition);
  };

  // Locked state: strictly require login to take competitions
  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 sm:p-12 bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-600 rounded-[36px] text-center space-y-6 shadow-xl animate-fadeIn">
        <div className="w-16 h-16 rounded-3xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            خوض المسابقات مقصور على الطلاب المسجلين
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
            للمشاركة في مسابقة «{competition.title}» وحساب درجتك وسرعتك في التنافس على لوحة الشرف الرسمية لدفعة 2027، يرجى تسجيل الدخول أولاً.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>تسجيل الدخول / إنشاء حساب</span>
          </button>
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-sm transition-all"
          >
            العودة للمسابقات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Sticky Bar */}
      <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-20 z-30 backdrop-blur-md bg-white/95">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-amber-900 px-2.5 py-0.5 bg-amber-100 rounded-full border border-amber-200">
              مسابقة رسمية مجانية
            </span>
            <span className="text-xs text-slate-500 font-bold">{competition.schoolYear}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">{competition.title}</h2>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {!result && (
            <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 font-mono font-black text-sm border shadow-xs ${
              secondsRemaining < 120
                ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}>
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>
          )}

          <button
            onClick={onBack}
            className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>خروج من المسابقة</span>
          </button>
        </div>
      </div>

      {/* Result & Rank Banner */}
      {result && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-900 border border-amber-300 rounded-[32px] p-6 sm:p-8 text-white shadow-xl space-y-4 animate-fadeIn">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white text-slate-950 flex flex-col items-center justify-center font-black shadow-lg">
                <span className="text-xs text-slate-500 font-bold">ترتيبك</span>
                <span className="text-xl text-amber-600">#{result.rank}</span>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>لوحة شرف الأوائل في مسابقة الجمهورية</span>
                </div>
                <h3 className="text-2xl font-black text-white">
                  أحسنت! حققت {result.percentage}% في المسابقة
                </h3>
                <p className="text-xs text-amber-100">
                  حصلت على <b>{result.score}</b> من <b>{result.maxScore}</b> نقطة • الترتيب الحالي بين المشاركين: <b>#{result.rank}</b>
                </p>
              </div>
            </div>

            <button
              onClick={onBack}
              className="px-6 py-3.5 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm hover:bg-slate-100 transition-all shadow-md"
            >
              العودة للوحة الشرف والمسابقات
            </button>
          </div>
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-6">
        {competition.questions.map((q, idx) => {
          const selected = answers[q.id];
          const isCorrect = selected === q.correctOptionIndex;

          return (
            <div
              key={q.id || idx}
              className={`bg-white border rounded-[30px] p-6 sm:p-8 shadow-xs space-y-4 transition-all ${
                result
                  ? isCorrect
                    ? 'border-emerald-300 ring-2 ring-emerald-50'
                    : 'border-rose-300 ring-2 ring-rose-50'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-900 font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-400">({q.marks} نقطة)</span>
                </div>

                {result && (
                  <div>
                    {isCorrect ? (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>إجابة صحيحة</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-black rounded-full border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>إجابة خاطئة</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                {q.questionText}
              </p>

              {q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {q.options.map((opt, optIdx) => {
                    const isOptionSelected = selected === optIdx;
                    const isCorrectOpt = q.correctOptionIndex === optIdx;

                    let style = 'border-slate-200 hover:border-amber-400 hover:bg-slate-50 text-slate-800';

                    if (result) {
                      if (isCorrectOpt) {
                        style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-black';
                      } else if (isOptionSelected && !isCorrectOpt) {
                        style = 'border-rose-400 bg-rose-50 text-rose-950 line-through';
                      } else {
                        style = 'border-slate-200 opacity-60 text-slate-500';
                      }
                    } else if (isOptionSelected) {
                      style = 'border-amber-500 bg-amber-50 text-amber-950 font-black ring-2 ring-amber-400/20';
                    }

                    return (
                      <div
                        key={optIdx}
                        onClick={() => {
                          if (!result) {
                            setAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                          }
                        }}
                        className={`p-4 rounded-2xl border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${style}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-white/80 border border-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                            {['أ', 'ب', 'ج', 'د'][optIdx]}
                          </span>
                          <span>{opt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {result && (
                <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                  <span className="font-black text-slate-900 block">💡 التعليل النموذجي:</span>
                  <p>{q.modelAnswer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!result && (
        <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            تمت الإجابة على <b>{Object.keys(answers).length}</b> من أصل <b>{competition.questions.length}</b> أسئلة.
          </div>

          <button
            onClick={handleFinish}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md shadow-amber-200 transition-all flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            <span>تسليم الإجابات وإعلان الترتيب الفوري</span>
          </button>
        </div>
      )}
    </div>
  );
};
