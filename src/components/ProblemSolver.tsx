import React, { useState } from 'react';
import { 
  HelpCircle, 
  Sparkles, 
  Copy, 
  Check, 
  Calculator, 
  Award, 
  AlertCircle, 
  CheckCircle2,
  Lightbulb
} from 'lucide-react';
import { BacBranch } from '../types';
import { BAC_SUBJECTS } from '../data/bacData';
import ReactMarkdown from 'react-markdown';

interface ProblemSolverProps {
  branch: BacBranch;
}

export const ProblemSolver: React.FC<ProblemSolverProps> = ({ branch }) => {
  const availableSubjects = BAC_SUBJECTS.filter(
    (s) => s.branch === branch || s.branch === 'both'
  );

  const [selectedSubject, setSelectedSubject] = useState<string>(
    availableSubjects[0]?.id || 'math'
  );
  const [problemText, setProblemText] = useState('');
  const [solution, setSolution] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSolve = async () => {
    if (!problemText.trim() || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSolution(null);

    const subjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);
    const subjectName = subjectObj ? subjectObj.name : selectedSubject;

    try {
      const res = await fetch('/api/solve-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemText,
          subject: subjectName,
          branch: branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حل المسألة.');
      }

      setSolution(data.solution);
    } catch (err: any) {
      console.error('Solve error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بخادم الحل.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleProblems = [
    {
      title: 'نواس مرن (حساب الدور وطاقة الاهتزاز)',
      subject: 'physics',
      text: 'نواس مرن يتألف من نابض أفقي مرن ثابت صلابته k=100 N/m وجسم كتلته m=0.4 kg يهتز بسعة Xmax=0.1 m. احسب الدور الخاص T0، واكتب التابع الزمني للمطال بفرض شروط البدء t=0 في المطال الأعظمي الموجب.',
    },
    {
      title: 'نهاية تابع كسري (إزالة عدم التعيين)',
      subject: 'math',
      text: 'احسب نهاية التابع f(x) = (x^2 - 4) / (x - 2) عندما x تسعى إلى 2، ثم ادرس استمراره عند x=2.',
    },
    {
      title: 'حساب درجة حموضة محلول (pH)',
      subject: 'chemistry',
      text: 'محلول لحمض كلور الماء HCl تركيزه C=0.01 mol/L، احسب درجة حموضة المحلول pH، وإذا مددناه بالماء المقطر 100 مرة كم يصبح الـ pH الجديد؟',
    },
  ];

  const currentSubjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black">
              <Calculator className="w-3.5 h-3.5" />
              <span>حل المسائل والتمارين المعقدة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              المساعد الذكي لحل مسائل البكالوريا
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              اكتب نص المسألة أو التمرين (رياضيات، فيزياء، كيمياء، أو علوم)، وسنقدم لك <strong className="text-slate-900">المعطيات، القانون المستخدم، خطوات الحل التفصيلية، والتنبيه الامتحاني</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-indigo-700 font-black">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>إشراف إدارة المنصة</span>
          </div>
        </div>
      </div>

      {/* Input Form Card */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-800 block">اختر المادة:</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
          >
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Problem textarea */}
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span>نص المسألة أو السؤال بالكامل:</span>
          </label>
          <textarea
            rows={5}
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            placeholder="انسخ نص المسألة أو اكتب السؤال هنا مع الأرقام والمعطيات بوضوح..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed font-medium"
          />
        </div>

        {/* Sample problem chips */}
        <div className="space-y-2">
          <span className="text-xs font-black text-slate-500 block">
            أو جرب حل مسألة نموذجية من بكالوريا 2027:
          </span>
          <div className="flex flex-wrap gap-2">
            {sampleProblems.map((sp, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedSubject(sp.subject);
                  setProblemText(sp.text);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-xs text-slate-700 font-bold transition-colors text-right"
              >
                {sp.title}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSolve}
            disabled={!problemText.trim() || isLoading}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm sm:text-base shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isLoading ? 'جاري تحليل المسألة وحلها بالتفصيل...' : 'حل المسألة خطوة بخطوة'}</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Solution Output */}
      {solution && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-5 animate-fadeIn">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                  حل تفصيلي معتمد
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {currentSubjectObj?.name} | {branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                الخطوات الكاملة للحل النموذجي
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
                  <span>نسخ الحل التفصيلي</span>
                </>
              )}
            </button>
          </div>

          <div className="markdown-body text-slate-800 text-sm sm:text-base leading-relaxed space-y-3">
            <ReactMarkdown>{solution}</ReactMarkdown>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>خطوات مطابقة لسلم تصحيح البكالوريا الرسمية 2027</span>
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
