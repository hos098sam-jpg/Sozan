import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Copy, 
  Check, 
  FileText, 
  Award, 
  Lightbulb, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { BacBranch, SubjectInfo } from '../types';
import { BAC_SUBJECTS } from '../data/bacData';
import ReactMarkdown from 'react-markdown';

interface LessonSummarizerProps {
  branch: BacBranch;
}

export const LessonSummarizer: React.FC<LessonSummarizerProps> = ({ branch }) => {
  const availableSubjects = BAC_SUBJECTS.filter(
    (s) => s.branch === branch || s.branch === 'both'
  );

  const [selectedSubject, setSelectedSubject] = useState<string>(
    availableSubjects[0]?.id || 'math'
  );
  const [topicInput, setTopicInput] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSummarize = async () => {
    if (!topicInput.trim() || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    setSummary(null);

    const subjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);
    const subjectName = subjectObj ? subjectObj.name : selectedSubject;

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicInput,
          subject: subjectName,
          branch: branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي',
          extraNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل توليد التلخيص.');
      }

      setSummary(data.summary);
    } catch (err: any) {
      console.error('Summarize error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بالخادم.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSubjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Banner / Description */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-sm relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5" />
              <span>تلخيص مركز بدون حشو</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              التلخيص الذكي لدروس البكالوريا 2027
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              أدخل عنوان الدرس أو فقرة المنهج، وسنقوم باستخلاص <strong className="text-slate-900">الأفكار الأساسية، التعريفات المهمة، والقوانين أو الشواهد الرئيسية</strong> دون أي حشو لتسهيل الحفظ الفوري.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Subject selection */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>اختر المادة الدراسية:</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lesson title input */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>عنوان الدرس أو الموضوع المطلوب تلخيصه:</span>
            </label>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="مثال: النواس المرن، الاشتقاق، مبدأ لوشاتلييه، المعرفة والمذاهب..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>
        </div>

        {/* Quick chapter suggestions if any */}
        {currentSubjectObj && currentSubjectObj.chapters.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-500 block">
              اختر سريعاً من وحدات ودروس {currentSubjectObj.name}:
            </span>
            <div className="flex flex-wrap gap-2">
              {currentSubjectObj.chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => setTopicInput(ch)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-xs text-slate-700 font-bold transition-colors"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optional notes input */}
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
            <span>ملاحظات إضافية (اختياري - مثلاً: ركز على القوانين، أو اشرح التعاليل...):</span>
          </label>
          <input
            type="text"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="مثال: ركز على أسئلة التعليل الواردة في امتحانات سابقة"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
          />
        </div>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSummarize}
            disabled={!topicInput.trim() || isLoading}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm sm:text-base shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isLoading ? 'جاري استخلاص الملخص المركز...' : 'لخص الدرس فوراً بدون حشو'}</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary Output Area */}
      {summary && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-5 animate-fadeIn">
          
          {/* Header bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                  ملخص بكالوريا 2027
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {currentSubjectObj?.name} | {branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                {topicInput}
              </h3>
            </div>

            <div className="flex items-center gap-2">
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
                    <span>نسخ الملخص</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Markdown summary display */}
          <div className="markdown-body text-slate-800 text-sm sm:text-base leading-relaxed space-y-3">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>

          {/* Supervisor Footer stamp */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>ملخص معتمد ومطابق للمنهج الرسمي لشهادة البكالوريا 2027</span>
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
