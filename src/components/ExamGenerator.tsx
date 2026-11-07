import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Award, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  HelpCircle
} from 'lucide-react';
import { BacBranch } from '../types';
import { BAC_SUBJECTS } from '../data/bacData';
import ReactMarkdown from 'react-markdown';

interface ExamGeneratorProps {
  branch: BacBranch;
}

export const ExamGenerator: React.FC<ExamGeneratorProps> = ({ branch }) => {
  const availableSubjects = BAC_SUBJECTS.filter(
    (s) => s.branch === branch || s.branch === 'both'
  );

  const [selectedSubject, setSelectedSubject] = useState<string>(
    availableSubjects[0]?.id || 'math'
  );
  const [chapter, setChapter] = useState('');
  const [difficulty, setDifficulty] = useState('متوسط يحاكي الامتحان الرسمي');
  const [questionCount, setQuestionCount] = useState(5);
  const [examContent, setExamContent] = useState<string | null>(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setExamContent(null);
    setShowAnswerKey(false);

    const subjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);
    const subjectName = subjectObj ? subjectObj.name : selectedSubject;

    try {
      const res = await fetch('/api/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          chapter: chapter || 'شامل للمنهج',
          difficulty,
          questionCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل صياغة الاختبار.');
      }

      setExamContent(data.exam);
    } catch (err: any) {
      console.error('Exam generate error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء إعداد الاختبار.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!examContent) return;
    navigator.clipboard.writeText(examContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to split exam questions vs model answers
  const parseExamAndAnswers = (fullText: string) => {
    if (!fullText) return { questionsText: '', answersText: '' };
    const parts = fullText.split(/#\s*ثانياً:\s*الحل النموذجي|#\s*الحل النموذجي|ثانياً:\s*الحل النموذجي/i);
    if (parts.length >= 2) {
      return {
        questionsText: parts[0].trim(),
        answersText: `### 🎯 الحل النموذجي المعتمد (سلم التصحيح)\n\n` + parts.slice(1).join('\n').trim(),
      };
    }
    return { questionsText: fullText, answersText: 'تم تضمين الحلول في الأسئلة أعلاه.' };
  };

  const { questionsText, answersText } = examContent
    ? parseExamAndAnswers(examContent)
    : { questionsText: '', answersText: '' };

  const currentSubjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-[40px] p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black">
              <FileText className="w-3.5 h-3.5" />
              <span>محاكاة امتحانات البكالوريا الرسمية</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              صانع الاختبارات وسلالم التصحيح
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              قم بصياغة نماذج امتحانية دقيقة وفق أنماط البكالوريا 2027، واختبر نفسك ثم اضغط على <strong className="text-slate-900">"عرض الحل النموذجي المعتمد"</strong> لمراجعة سلم التصحيح.
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-indigo-700 font-black">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>إشراف إدارة المنصة</span>
          </div>
        </div>
      </div>

      {/* Generator Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 block">المادة الدراسية:</label>
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

          {/* Chapter / Topic */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-black text-slate-800 block">
              الوحدة أو الدرس المطلوب للاختبار:
            </label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="مثال: الاشتقاق، التحريض الكهرطيسي، المذاهب الأدبية، جامع لكامل الكتاب..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 block">مستوى الاختبار:</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="متوسط يحاكي الامتحان الرسمي">متوسط يحاكي الامتحان الرسمي</option>
              <option value="شامل لأسئلة الدورات السابقة">شامل لأسئلة الدورات السابقة</option>
              <option value="متقدم يميز الطالب المتفوق">متقدم يميز الطالب المتفوق</option>
            </select>
          </div>

        </div>

        {/* Quick Chapters */}
        {currentSubjectObj && currentSubjectObj.chapters.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-500 block">
              اختر وحدة دراسية سريعة:
            </span>
            <div className="flex flex-wrap gap-2">
              {currentSubjectObj.chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => setChapter(ch)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-xs text-slate-700 font-bold transition-colors"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>يتم توليد ورقة أسئلة + سلم تصحيح مفصل</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm sm:text-base shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isLoading ? 'جاري إعداد الاختبار وسلم التصحيح...' : 'صياغة اختبار جديد'}</span>
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

      {/* Exam Result Paper */}
      {examContent && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6 animate-fadeIn">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100">
                  ورقة امتحان بكالوريا 2027
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {currentSubjectObj?.name} | {chapter || 'شامل'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                نموذج امتحاني رسمي
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Answer Key */}
              <button
                onClick={() => setShowAnswerKey(!showAnswerKey)}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm ${
                  showAnswerKey
                    ? 'bg-indigo-600 text-white shadow-indigo-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-indigo-700 border border-slate-200'
                }`}
              >
                {showAnswerKey ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>إخفاء الحل النموذجي</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>عرض الحل النموذجي (سلم التصحيح)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopy}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="نسخ الاختبار بالكامل"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Exam Questions Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-indigo-700">
              <HelpCircle className="w-4 h-4" />
              <span>أولاً: أسئلة الاختبار (حاول الحل بنفسك أولاً قبل النظر لسلم التصحيح)</span>
            </div>
            <div className="markdown-body bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 text-slate-800 text-sm sm:text-base leading-relaxed">
              <ReactMarkdown>{questionsText}</ReactMarkdown>
            </div>
          </div>

          {/* Model Solution (Answer Key) Section */}
          {showAnswerKey && (
            <div className="space-y-4 pt-4 border-t border-slate-100 animate-fadeIn">
              <div className="flex items-center gap-2 text-sm font-black text-indigo-600">
                <CheckCircle2 className="w-5 h-5" />
                <span>ثانياً: الحل النموذجي المعتمد (سلم التصحيح والشرح التفصيلي)</span>
              </div>
              <div className="markdown-body bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white text-sm sm:text-base leading-relaxed shadow-lg">
                <ReactMarkdown>{answersText}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Footer Supervisor stamp */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>مطابق لأنظمة وسلالم تصحيح البكالوريا الرسمية 2027</span>
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
