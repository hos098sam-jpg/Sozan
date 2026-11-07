import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Clock,
  Award,
  Users,
  ArrowLeft,
  Sparkles,
  Flame,
  Star,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Competition, User } from '../types';

interface CompetitionsViewProps {
  competitions: Competition[];
  currentUser: User | null;
  onSelectCompetition: (competition: Competition) => void;
  onOpenAuth: () => void;
}

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({
  competitions,
  currentUser,
  onSelectCompetition,
  onOpenAuth,
}) => {
  const isStudent = currentUser && currentUser.role === 'student';
  const isApprovedStudent = isStudent && (currentUser.status === 'active' || currentUser.status === 'approved' || !currentUser.status);

  // Grade matching helper
  const matchesStudentGrade = (compYear: string, studentYear: string) => {
    if (!studentYear) return true;
    if (compYear === studentYear) return true;
    if (compYear.includes('جميع') || studentYear.includes(compYear) || compYear.includes(studentYear)) return true;

    if (studentYear.includes('الأول الابتدائي') && compYear.includes('الأول الابتدائي')) return true;
    if (studentYear.includes('الثاني الابتدائي') && compYear.includes('الثاني الابتدائي')) return true;
    if (studentYear.includes('الثالث الابتدائي') && compYear.includes('الثالث الابتدائي')) return true;
    if (studentYear.includes('الرابع الابتدائي') && compYear.includes('الرابع الابتدائي')) return true;
    if (studentYear.includes('الخامس الابتدائي') && compYear.includes('الخامس الابتدائي')) return true;
    if (studentYear.includes('السادس الابتدائي') && compYear.includes('السادس الابتدائي')) return true;
    
    if (studentYear.includes('الأول الإعدادي') && compYear.includes('الأول الإعدادي')) return true;
    if (studentYear.includes('الثاني الإعدادي') && compYear.includes('الثاني الإعدادي')) return true;
    if (studentYear.includes('الثالث الإعدادي') && compYear.includes('الثالث الإعدادي')) return true;
    
    if (studentYear.includes('الأول الثانوي') && compYear.includes('الأول الثانوي')) return true;
    if (studentYear.includes('الثاني الثانوي') && compYear.includes('الثاني الثانوي')) return true;
    if (studentYear.includes('الثالث الثانوي') && (compYear.includes('الثالث الثانوي') || compYear.includes('بكالوريا'))) return true;

    return false;
  };

  const publishedCompetitions = competitions.filter((c) => {
    if (!c.isPublished) return false;
    if (isApprovedStudent && currentUser?.schoolYear) {
      return matchesStudentGrade(c.schoolYear, currentUser.schoolYear);
    }
    return true;
  });

  const [selectedComp, setSelectedComp] = useState<Competition | null>(
    publishedCompetitions[0] || competitions[0] || null
  );

  useEffect(() => {
    if (!selectedComp || !publishedCompetitions.some((c) => c.id === selectedComp.id)) {
      setSelectedComp(publishedCompetitions[0] || competitions[0] || null);
    }
  }, [competitions, publishedCompetitions]);

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-900 border border-amber-300 rounded-[36px] p-6 sm:p-10 text-white shadow-lg space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400 text-slate-950 rounded-full text-xs font-black">
          <Flame className="w-4 h-4 text-rose-700 fill-rose-700" />
          <span>دوري المسابقات التنافسية الرسمية (مجاني لجميع الطلاب)</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
          مسابقات التفوق ولوحة الشرف الكبرى 2027
        </h1>

        <p className="text-xs sm:text-sm text-amber-100 max-w-2xl leading-relaxed">
          شارك في التحديات الأسبوعية المباشرة واختبر سرعتك ودقتك في الإجابة على أسئلة المستويات العليا. تنافس مع زملائك على صدارة الجمهورية والوطن العربي واحصل على أوسمة التميز.
        </p>
      </div>

      {/* Guest Lock Notice (المسابقات مقفلة وتتطلب تسجيل الدخول) */}
      {!currentUser && (
        <div className="p-5 rounded-[28px] bg-amber-50/90 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-600 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3.5 text-right">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                المسابقات مقفلة وتتطلب تسجيل الدخول
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                لحساب درجتك بدقة والمنافسة على صدارة لوحة الشرف الرسمية لدفعة 2027، يجب تسجيل الدخول إلى حسابك أولاً.
              </div>
            </div>
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>تسجيل الدخول لخوض المسابقة 🔒</span>
          </button>
        </div>
      )}

      {/* Main Grid: Competitions List & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Active Competitions Cards */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>المسابقات المتاحة الآن:</span>
          </h3>

          {publishedCompetitions.length > 0 ? (
            <div className="space-y-4">
              {publishedCompetitions.map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => setSelectedComp(comp)}
                  className={`bg-white border rounded-[30px] p-6 sm:p-7 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-4 ${
                    selectedComp?.id === comp.id
                      ? 'border-amber-400 ring-2 ring-amber-400/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                          مسابقة مجانية
                        </span>
                        <span className="text-xs text-slate-500 font-bold">{comp.schoolYear}</span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-slate-900">{comp.title}</h4>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!currentUser) {
                          onOpenAuth();
                          return;
                        }
                        onSelectCompetition(comp);
                      }}
                      className={`px-5 sm:px-6 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 shrink-0 ${
                        !currentUser
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 shadow-xs'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-200'
                      }`}
                    >
                      {!currentUser ? (
                        <>
                          <Lock className="w-4 h-4 text-amber-800" />
                          <span>سجّل لخوض المسابقة 🔒</span>
                        </>
                      ) : (
                        <>
                          <span>خوض المسابقة</span>
                          <ArrowLeft className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {comp.description}
                  </p>

                  {comp.prizeInfo && (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs font-black text-amber-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>الجوائز والمكافآت: {comp.prizeInfo}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>المدة: {comp.durationMinutes} دقيقة</span>
                    </span>
                    <span>•</span>
                    <span>{comp.questions.length} أسئلة اختيارية</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-indigo-600 font-bold">
                      <Users className="w-3.5 h-3.5" />
                      <span>{comp.participantsCount || comp.leaderboard.length} طالب شاركوا</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-[30px] p-8 space-y-3">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-base font-black text-slate-800">لا توجد مسابقات معلنة حالياً</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                ترقبوا إطلاق أولمبياد ومسابقات التفوق الرسمية لدفعة 2027 قريباً بإشراف إدارة المنصة.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Live Leaderboard (لوحة الشرف) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                  <Medal className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">لوحة شرف الأوائل</h3>
                  <p className="text-[10px] text-slate-500 font-medium">أعلى الدرجات والأسرع وقتاً</p>
                </div>
              </div>
            </div>

            {/* Leaderboard List */}
            {selectedComp ? (
              <>
                <div className="space-y-3">
                  {selectedComp.leaderboard && selectedComp.leaderboard.length > 0 ? (
                    selectedComp.leaderboard.slice(0, 10).map((participant, index) => {
                      const isTop1 = index === 0;
                      const isTop2 = index === 1;
                      const isTop3 = index === 2;

                      return (
                        <div
                          key={participant.studentId || index}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                            isTop1
                              ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                              : isTop2
                              ? 'bg-slate-50/90 border-slate-300'
                              : isTop3
                              ? 'bg-orange-50/60 border-orange-200'
                              : 'bg-white border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                              isTop1
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : isTop2
                                ? 'bg-slate-300 text-slate-900'
                                : isTop3
                                ? 'bg-orange-300 text-slate-950'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {index + 1}
                            </div>

                            <div>
                              <div className="text-xs font-black text-slate-900 flex items-center gap-1">
                                <span>{participant.studentName}</span>
                                {isTop1 && <span className="text-[10px]">👑</span>}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {participant.schoolYear}
                              </div>
                            </div>
                          </div>

                          <div className="text-left">
                            <div className="text-xs font-black text-indigo-700 font-mono">
                              {participant.score}/{participant.maxScore}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {Math.floor(participant.timeTakenSeconds / 60)} د و {participant.timeTakenSeconds % 60} ث
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400">
                      لا توجد مشاركات مسجلة بعد. كن أول المنافسين!
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectCompetition(selectedComp)}
                  className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
                >
                  <span>انضم للمنافسة الآن</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="text-center py-10 text-xs text-slate-400 space-y-2">
                <Medal className="w-8 h-8 text-slate-300 mx-auto" />
                <p>ستظهر لوحة الشرف وأوائل الجمهورية عند إطلاق المسابقة الرسمية.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
