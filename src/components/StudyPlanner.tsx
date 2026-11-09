import React, { useState } from 'react';
import { 
  Calendar, 
  Sparkles, 
  Copy, 
  Check, 
  Award, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { BacBranch } from '../types';
import ReactMarkdown from 'react-markdown';

interface StudyPlannerProps {
  branch: BacBranch;
}

export const StudyPlanner: React.FC<StudyPlannerProps> = ({ branch }) => {
  const [hoursPerDay, setHoursPerDay] = useState('6 ساعات');
  const [focusSubjects, setFocusSubjects] = useState(
    branch === 'scientific'
      ? 'الرياضيات والفيزياء والفلسفة والمنطق واللغات'
      : 'الفلسفة واللغة العربية والتاريخ واللغات'
  );
  const [weeks, setWeeks] = useState('أسبوع واحد نموذجي');
  const [planContent, setPlanContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreatePlan = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setPlanContent(null);

    try {
      const res = await fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي',
          hoursPerDay,
          focusSubjects,
          weeks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تصميم الجدول الدراسي.');
      }

      setPlanContent(data.plan);
    } catch (err: any) {
      console.error('Study plan error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!planContent) return;
    navigator.clipboard.writeText(planContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black">
              <Calendar className="w-3.5 h-3.5" />
              <span>تنظيم الوقت بطريقة واقعية</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              منظم الجدول الدراسي لبكالوريا 2027
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              صمم جدولك الأسبوعي المخصص وفق ساعات دراستك الفعلية والمواد التي تريد إعطاءها أولوية، مع أوقات للراحة وحل الدورات.
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-indigo-700 font-black">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>إشراف إدارة المنصة</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>ساعات الدراسة اليومية المتاحة:</span>
            </label>
            <select
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="4 ساعات (متوازن وبدون إرهاق)">4 ساعات (متوازن وبدون إرهاق)</option>
              <option value="6 ساعات (المعدل الذهبي للبكالوريا)">6 ساعات (المعدل الذهبي للبكالوريا)</option>
              <option value="8 ساعات (تكثيف ومراجعة مكثفة)">8 ساعات (تكثيف ومراجعة مكثفة)</option>
              <option value="10 ساعات (معسكر ما قبل الامتحان)">10 ساعات (معسكر ما قبل الامتحان)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>المواد التي تحتاج التركيز عليها:</span>
            </label>
            <input
              type="text"
              value={focusSubjects}
              onChange={(e) => setFocusSubjects(e.target.value)}
              placeholder="مثال: الرياضيات والفيزياء، أو اللغة العربية والفلسفة..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 block">نطاق الجدول المطلوب:</label>
            <select
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="أسبوع واحد نموذجي">أسبوع واحد نموذجي (جدول متكرر)</option>
              <option value="خطة شهرية شاملة">خطة شهرية شاملة</option>
              <option value="خطة مراجعة دورات امتحانية">خطة مراجعة دورات امتحانية</option>
            </select>
          </div>

        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleCreatePlan}
            disabled={isLoading}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm sm:text-base shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isLoading ? 'جاري تصميم جدول دراسي ذكي...' : 'تصميم الجدول الآن'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {planContent && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-5 animate-fadeIn">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                  جدول دراسي معتمد
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي'} | {hoursPerDay}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                خطتك الدراسية المخصصة
              </h3>
            </div>

            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ الجدول</span>
                </>
              )}
            </button>
          </div>

          <div className="markdown-body text-slate-800 text-sm sm:text-base leading-relaxed space-y-3">
            <ReactMarkdown>{planContent}</ReactMarkdown>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>نصائح وجدول مصمم لتحقيق التوازن بين المذاكرة وحل الدورات والراحة</span>
            </div>
            <span className="text-indigo-600 font-bold">
              إشراف: إدارة المنصة
            </span>
          </div>

        </div>
      )}

    </div>
  );
};
