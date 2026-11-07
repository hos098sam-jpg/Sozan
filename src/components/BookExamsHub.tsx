import React, { useState, useRef } from 'react';
import {
  BookOpen,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Award,
  ChevronRight,
  RefreshCw,
  Printer,
  Copy,
  Check,
  Zap,
  HelpCircle,
  ArrowLeft,
  GraduationCap,
  Layers,
  Search,
  BookMarked
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  BacBranch,
  BookAnalysisResult,
  BookLesson,
  LessonExam,
  ExamQuestion,
  StudentExamSubmission,
  EssayGradingResult
} from '../types';
import { SAMPLE_BOOKS } from '../data/sampleBooks';
import { getSavedSubmissions, saveSubmissions, saveExamToStore } from '../data/initialData';

interface BookExamsHubProps {
  branch: BacBranch;
}

export const BookExamsHub: React.FC<BookExamsHubProps> = ({ branch }) => {
  // State for book upload & analysis
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'sample' | 'text'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [bookTitleInput, setBookTitleInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Analyzed book data
  const [bookData, setBookData] = useState<BookAnalysisResult | null>(null);

  // Selected lesson & active exam
  const [selectedLesson, setSelectedLesson] = useState<BookLesson | null>(null);
  const [activeExam, setActiveExam] = useState<LessonExam | null>(null);
  const [selectedExamNumber, setSelectedExamNumber] = useState<1 | 2 | 3>(1);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);

  // Student active answers & submission
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<StudentExamSubmission | null>(null);
  const [copiedSolution, setCopiedSolution] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter sample books based on active branch
  const availableSamples = SAMPLE_BOOKS.filter(
    (b) => b.branch === branch || b.branch === 'both'
  );

  // Handle File selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setAnalysisError(null);

    // Read file as Base64 for PDF or Text for .txt
    const reader = new FileReader();
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data url prefix (e.g. data:application/pdf;base64,)
        const base64Content = result.split(',')[1] || result;
        setFileBase64(base64Content);
      };
      reader.readAsDataURL(file);
    } else {
      // Plain text / markdown
      reader.onload = () => {
        setManualText(reader.result as string);
      };
      reader.readAsText(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Content = result.split(',')[1] || result;
          setFileBase64(base64Content);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          setManualText(reader.result as string);
        };
        reader.readAsText(file);
      }
    }
  };

  // Run AI Analysis on Uploaded Book / Text
  const handleAnalyzeBook = async (customText?: string, customTitle?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setBookData(null);
    setSelectedLesson(null);
    setActiveExam(null);
    setSubmission(null);

    try {
      const payload: any = {
        bookName: customTitle || bookTitleInput || selectedFile?.name || 'كتاب البكالوريا المعتمد',
        branch,
      };

      if (customText) {
        payload.bookText = customText;
      } else if (fileBase64) {
        payload.pdfBase64 = fileBase64;
      } else if (manualText) {
        payload.bookText = manualText;
      } else {
        throw new Error('الرجاء رفع ملف PDF للكتاب أو اختيار نموذج جاهز أو كتابة نص الدرس.');
      }

      const response = await fetch('/api/analyze-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'فشل تحليل محتوى الكتاب المدرسي.');
      }

      const data: BookAnalysisResult = await response.json();
      setBookData(data);
      if (data.lessons && data.lessons.length > 0) {
        setSelectedLesson(data.lessons[0]);
      }
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'حدث خطأ أثناء تحليل الكتاب.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Quick Select Sample Book
  const handleSelectSampleBook = (sample: typeof SAMPLE_BOOKS[0]) => {
    setBookTitleInput(sample.title);
    setManualText(sample.content);
    setFileBase64(null);
    setSelectedFile(null);
    handleAnalyzeBook(sample.content, sample.title);
  };

  // Generate 1 of 3 Dedicated Exams for Selected Lesson
  const handleGenerateExam = async (lesson: BookLesson, examNum: 1 | 2 | 3) => {
    setSelectedLesson(lesson);
    setSelectedExamNumber(examNum);
    setIsGeneratingExam(true);
    setExamError(null);
    setActiveExam(null);
    setSubmission(null);
    setMcqAnswers({});
    setEssayAnswers({});

    try {
      const response = await fetch('/api/generate-book-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: lesson.title,
          lessonConcepts: lesson.keyConcepts,
          examNumber: examNum,
          subject: bookData?.subject || 'المنهاج المعتمد',
          branch,
          bookReferenceText: manualText ? manualText.slice(0, 10000) : undefined,
          pdfBase64: fileBase64 || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'فشل توليد الامتحان.');
      }

      const examData: LessonExam = await response.json();
      setActiveExam(examData);

      // Persist exam to local & cloud storage
      try {
        saveExamToStore({
          id: examData.id,
          courseId: 'book-exams',
          title: `امتحان ${examData.lessonTitle} (${examData.examLevelName})`,
          lessonTitle: examData.lessonTitle,
          order: examData.examNumber,
          durationMinutes: examData.durationMinutes,
          passingPercentage: 60,
          isPublished: true,
          questions: examData.questions,
          bookReference: `كتاب ${bookData?.subject || ''} - درس ${examData.lessonTitle}`,
          createdAt: new Date().toISOString().split('T')[0],
        });
      } catch (e) {
        console.warn('Could not persist book exam to store:', e);
      }
    } catch (err: any) {
      console.error(err);
      setExamError(err.message || 'حدث خطأ أثناء إنشاء الامتحان.');
    } finally {
      setIsGeneratingExam(false);
    }
  };

  // Submit Exam & Instant AI Grading
  const handleSubmitExam = async () => {
    if (!activeExam) return;

    setIsSubmitting(true);
    let totalScore = 0;
    let maxScore = 0;
    const essayGrades: Record<string, EssayGradingResult> = {};

    try {
      // 1. Grade Multiple Choice Questions locally instantly
      activeExam.questions.forEach((q) => {
        maxScore += q.marks;
        if (q.type === 'mcq') {
          const selected = mcqAnswers[q.id];
          if (selected !== undefined && selected === q.correctOptionIndex) {
            totalScore += q.marks;
          }
        }
      });

      // 2. Essay Questions stay in 'under_review' (قيد التصحيح) until graded by Teacher
      const essayQuestions = activeExam.questions.filter((q) => q.type === 'essay');
      const hasEssayQuestions = essayQuestions.length > 0;

      for (const q of essayQuestions) {
        essayGrades[q.id] = {
          questionId: q.id,
          awardedMarks: 0,
          maxMarks: q.marks,
          feedback: 'قيد التصحيح والمراجعة من قِبل المدرس المعتمد ⏳',
          strengths: [],
          missingPoints: [],
          improvementTip: 'ستظهر درجتك وملاحظات المدرس فور اعتماد التصحيح.',
        };
      }

      const submissionStatus: 'under_review' | 'graded' = hasEssayQuestions ? 'under_review' : 'graded';
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      const newSubmission: StudentExamSubmission = {
        submissionId: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        examId: activeExam.id,
        courseId: 'book-exams',
        courseTitle: bookData?.bookTitle || 'امتحانات الكتاب المدرسي',
        lessonTitle: activeExam.lessonTitle,
        examTitle: `${activeExam.lessonTitle} (${activeExam.examLevelName})`,
        mcqAnswers: { ...mcqAnswers },
        essayAnswers: { ...essayAnswers },
        isSubmitted: true,
        status: submissionStatus,
        totalScore,
        maxScore,
        percentage,
        passed: hasEssayQuestions ? false : percentage >= 60,
        essayGrades,
        submittedAt: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }),
      };

      setSubmission(newSubmission);

      // Persist student submission
      try {
        const currentSubmissions = getSavedSubmissions();
        saveSubmissions([newSubmission, ...currentSubmissions.filter((s) => s.examId !== newSubmission.examId)]);
      } catch (e) {
        console.warn('Could not persist student submission:', e);
      }

      // Trigger confetti on good performance if no pending essay questions
      if (!hasEssayQuestions && percentage >= 70) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy full model solutions
  const handleCopySolutions = () => {
    if (!activeExam) return;
    const text = `
=== الإجابات النموذجية وسلالم التصحيح من الكتاب المدرسي ===
الدرس: ${activeExam.lessonTitle}
الامتحان: ${activeExam.examLevelName}
الدرجة الكلية: ${activeExam.totalMarks}

${activeExam.questions
  .map(
    (q, idx) => `
[السؤال ${idx + 1} (${q.type === 'mcq' ? 'اختيار من متعدد' : 'سؤال مقالي'}) - ${q.marks} درجات]:
${q.questionText}

* الحل النموذجي المعتمد:
${q.modelAnswer}

* المرجع من الكتاب:
${q.bookReference}
`
  )
  .join('\n----------------------------------------\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-[36px] p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black tracking-wide border border-indigo-100">
            <BookOpen className="w-4 h-4" />
            <span>محلل الكتب المدرسية والمذكرات الوزارية 2027</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
            ارفع كتابك أو مذكرتك، واستخرج 3 امتحانات ذكية لكل درس مع التصحيح الفوري
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            يقوم الذكاء الاصطناعي بقراءة الكتاب المدرسي (PDF)، وتفكيكه إلى وحدات ودروس، وصياغة 3 نماذج امتحانات متدرجة (تأسيسي، تطبيقي، وزاري متقدم) تجمع بين الاختيار من متعدد والأسئلة المقالية، مع تصحيح فوري وعرض الحلول النموذجية وسلالم الدرجات من نص الكتاب.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>دعم كامل لملفات PDF والكتب الوزارية</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>3 نماذج امتحانات لكل درس</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              <span>تصحيح مقالي واختياري فوري</span>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-50 rounded-full blur-[100px] opacity-60 pointer-events-none" />
      </div>

      {/* Upload and Input Section */}
      {!bookData && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl max-w-md">
            <button
              onClick={() => setActiveInputMode('upload')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                activeInputMode === 'upload'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملف PDF</span>
            </button>
            <button
              onClick={() => setActiveInputMode('sample')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                activeInputMode === 'sample'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>كتب جاهزة للتجربة</span>
            </button>
            <button
              onClick={() => setActiveInputMode('text')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                activeInputMode === 'text'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>لصق نص الدرس</span>
            </button>
          </div>

          {/* Mode 1: PDF Upload */}
          {activeInputMode === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[28px] p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-indigo-400 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf,text/plain"
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-4 border border-indigo-100 shadow-sm">
                  {selectedFile ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                </div>

                {selectedFile ? (
                  <div className="space-y-2">
                    <p className="text-base font-black text-slate-900">
                      تم اختيار: {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      الحجم: {(selectedFile.size / (1024 * 1024)).toFixed(2)} ميغابايت • جاهز للتحليل
                    </p>
                    <span className="inline-block mt-2 text-xs font-bold text-indigo-600 underline">
                      انقر لتغيير الملف
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-base font-black text-slate-900">
                      اضغط لاختيار ملف الكتاب المدرسي (PDF) أو اسحبه وأفلته هنا
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      يدعم كتب الوزارة، المذكرات الشاملة، وملفات PDF لجميع المواد العلمية والأدبية
                    </p>
                  </div>
                )}
              </div>

              {/* Book title optional hint */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان أو اسم المادة (اختياري لزيادة دقة التحليل):
                </label>
                <input
                  type="text"
                  value={bookTitleInput}
                  onChange={(e) => setBookTitleInput(e.target.value)}
                  placeholder="مثال: كتاب الفيزياء - الجزء الأول، أو كتاب علم الأحياء"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <button
                disabled={!selectedFile || isAnalyzing}
                onClick={() => handleAnalyzeBook()}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>جاري تحليل صفحات الكتاب واستخراج الدروس بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>تحليل محتوى الكتاب واستخراج الدروس والامتحانات</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Mode 2: Sample Books Pre-loaded */}
          {activeInputMode === 'sample' && (
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                اختر أي فصل أو كتاب مدرسي معتمد لتجربة التحليل الفوري وتوليد الامتحانات والتصحيح مباشرة:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableSamples.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => handleSelectSampleBook(sample)}
                    className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-700 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                          {sample.subject}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          {sample.branch === 'scientific' ? 'علمي' : sample.branch === 'literary' ? 'أدبي' : 'مشترك'}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {sample.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {sample.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                      <span>تحليل فوري وتوليد 3 امتحانات</span>
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode 3: Manual Text / Notes Paste */}
          {activeInputMode === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان الدرس أو الوحدة:
                </label>
                <input
                  type="text"
                  value={bookTitleInput}
                  onChange={(e) => setBookTitleInput(e.target.value)}
                  placeholder="مثال: درس التوازن الكيميائي أو درس المقال الفلسفي"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نص الدرس أو فقرات الكتاب المدرسي:
                </label>
                <textarea
                  rows={8}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="الصق نص الدرس أو صفحات الكتاب المدرسي هنا..."
                  className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                />
              </div>

              <button
                disabled={!manualText.trim() || isAnalyzing}
                onClick={() => handleAnalyzeBook()}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>جاري تحليل النص...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>تحليل الدروس وتوليد الامتحانات</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Analysis Error Alert */}
          {analysisError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{analysisError}</span>
            </div>
          )}
        </div>
      )}

      {/* Book Analyzed View: Lessons Explorer & 3 Exams for each lesson */}
      {bookData && !activeExam && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Bar for Book Info */}
          <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-indigo-700 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                  {bookData.subject || 'مادة البكالوريا'}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  {bookData.lessons?.length || 0} دروس مكتشفة
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                {bookData.bookTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                {bookData.overview}
              </p>
            </div>

            <button
              onClick={() => {
                setBookData(null);
                setSelectedLesson(null);
              }}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>رفع كتاب آخر</span>
            </button>
          </div>

          {/* Lessons List Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>اختر الدرس والنموذج الامتحاني المطلوب (3 نماذج لكل درس):</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {bookData.lessons?.map((lesson, idx) => (
                <div
                  key={lesson.id || idx}
                  className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black flex items-center justify-center border border-indigo-100 shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <h5 className="text-base font-black text-slate-900">
                          {lesson.title}
                        </h5>
                        {lesson.summary && (
                          <p className="text-xs text-slate-500 mt-0.5">{lesson.summary}</p>
                        )}
                      </div>
                    </div>

                    {lesson.keyConcepts && lesson.keyConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {lesson.keyConcepts.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3 Dedicated Exam Buttons for this Lesson */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Exam 1: Foundational */}
                    <button
                      disabled={isGeneratingExam}
                      onClick={() => handleGenerateExam(lesson, 1)}
                      className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-right transition-all group flex flex-col justify-between space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-800 px-2 py-0.5 bg-emerald-100 rounded-md">
                          النموذج 1: تأسيسي
                        </span>
                        <Zap className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-xs font-bold text-emerald-950">
                        تثبيت المفاهيم والتعريفات والقوانين
                      </p>
                      <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 pt-1">
                        <span>اختيار من متعدد + مقالي مباشر</span>
                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>

                    {/* Exam 2: Application / Standard */}
                    <button
                      disabled={isGeneratingExam}
                      onClick={() => handleGenerateExam(lesson, 2)}
                      className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-right transition-all group flex flex-col justify-between space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-indigo-800 px-2 py-0.5 bg-indigo-100 rounded-md">
                          النموذج 2: تطبيقي
                        </span>
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-xs font-bold text-indigo-950">
                        مستوى امتحاني متوسط وشامل للدرس
                      </p>
                      <div className="text-[10px] text-indigo-700 font-medium flex items-center gap-1 pt-1">
                        <span>مسائل حسابية + تعليلات علمية</span>
                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>

                    {/* Exam 3: Advanced Ministerial */}
                    <button
                      disabled={isGeneratingExam}
                      onClick={() => handleGenerateExam(lesson, 3)}
                      className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-right transition-all group flex flex-col justify-between space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-purple-800 px-2 py-0.5 bg-purple-100 rounded-md">
                          النموذج 3: وزاري متقدم
                        </span>
                        <Award className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-xs font-bold text-purple-950">
                        مسائل مركبة وفخاخ امتحانية للتميز
                      </p>
                      <div className="text-[10px] text-purple-700 font-medium flex items-center gap-1 pt-1">
                        <span>تفكير نقدي + سلم تصحيح دقيق</span>
                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loading Indicator for Exam Generation */}
          {isGeneratingExam && (
            <div className="p-8 bg-white border border-slate-200 rounded-[32px] text-center space-y-3 shadow-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
              <h4 className="text-base font-black text-slate-900">
                جاري صياغة الامتحان المخصص لدرس "{selectedLesson?.title}"...
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                يتم استخراج أسئلة الاختيار من متعدد والأسئلة المقالية وإعداد سلالم التصحيح من نص الكتاب بدقة.
              </p>
            </div>
          )}

          {examError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{examError}</span>
            </div>
          )}
        </div>
      )}

      {/* Active Exam Interface (Interactive Taking & Instant Submission) */}
      {activeExam && (
        <div className="space-y-8 animate-fadeIn">
          {/* Exam Header */}
          <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black text-indigo-700 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
                    الدرس: {activeExam.lessonTitle}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    الدرجة الكلية: {activeExam.totalMarks} درجة
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  {activeExam.examLevelName}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveExam(null);
                    setSubmission(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  العودة لقائمة الدروس
                </button>
              </div>
            </div>

            {/* Submission Status or Progress */}
            {submission ? (
              <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-md ${
                      submission.status === 'under_review'
                        ? 'bg-amber-500 text-white'
                        : submission.percentage >= 80
                        ? 'bg-emerald-500 text-white'
                        : submission.percentage >= 60
                        ? 'bg-amber-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}>
                      {submission.status === 'under_review' ? '⏳' : `${submission.percentage}%`}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-amber-300">
                        {submission.status === 'under_review'
                          ? 'الأسئلة المقالية قيد التصحيح من قِبل المدرس ⏳'
                          : 'تم اعتماد النتيجة النهائية ✅'}
                      </div>
                      <div className="text-xl font-black">
                        {submission.status === 'under_review'
                          ? `درجة الاختياري المبدئية: ${submission.totalScore} من ${submission.maxScore} (بانتظار تصحيح المقالي)`
                          : `الدرجة المستحقة: ${submission.totalScore} من ${submission.maxScore}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCopySolutions}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5"
                    >
                      {copiedSolution ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedSolution ? 'تم نسخ الحلول' : 'نسخ الإجابة النموذجية'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setSubmission(null);
                        setMcqAnswers({});
                        setEssayAnswers({});
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>إعادة حل الامتحان</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>أجب عن جميع الأسئلة المقالية والاختيارية ثم اضغط زر التسليم للحصول على التصحيح وسلم الدرجات المعتمد فوراً.</span>
                <span className="text-indigo-600 font-bold">
                  {Object.keys(mcqAnswers).length + Object.keys(essayAnswers).length} من {activeExam.questions.length} أسئلة مجابة
                </span>
              </div>
            )}
          </div>

          {/* Questions List */}
          <div className="space-y-6">
            {activeExam.questions.map((q, qIndex) => {
              const isMCQ = q.type === 'mcq';
              const essayGrade = submission?.essayGrades?.[q.id];
              const selectedOption = mcqAnswers[q.id];
              const isCorrectMCQ = selectedOption === q.correctOptionIndex;

              return (
                <div
                  key={q.id || qIndex}
                  className={`bg-white border rounded-[32px] p-6 sm:p-8 shadow-sm transition-all space-y-5 ${
                    submission
                      ? isMCQ
                        ? isCorrectMCQ
                          ? 'border-emerald-300 ring-1 ring-emerald-100'
                          : 'border-rose-300 ring-1 ring-rose-100'
                        : 'border-indigo-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 font-black text-xs flex items-center justify-center shrink-0">
                        {qIndex + 1}
                      </span>
                      <div>
                        <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 ml-2">
                          {isMCQ ? 'اختيار من متعدد' : 'سؤال مقالي / مسألة'}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          ({q.marks} درجات)
                        </span>
                      </div>
                    </div>

                    {/* Result badge after submission */}
                    {submission && (
                      <div>
                        {isMCQ ? (
                          isCorrectMCQ ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>+{q.marks} درجة كاملة</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-black border border-rose-200 flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-rose-600" />
                              <span>0 من {q.marks}</span>
                            </span>
                          )
                        ) : submission.status === 'under_review' ? (
                          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-black border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>قيد التصحيح ({q.marks} درجات)</span>
                          </span>
                        ) : (
                          essayGrade && (
                            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200">
                              {essayGrade.awardedMarks} من {q.marks} درجة
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* Question Text */}
                  <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                    {q.questionText}
                  </p>

                  {/* MCQ Options */}
                  {isMCQ && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = selectedOption === optIdx;
                        const isCorrect = q.correctOptionIndex === optIdx;

                        let optionStyle = 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-800';

                        if (submission) {
                          if (isCorrect) {
                            optionStyle = 'border-emerald-400 bg-emerald-50/80 text-emerald-950 font-black';
                          } else if (isSelected && !isCorrect) {
                            optionStyle = 'border-rose-400 bg-rose-50/80 text-rose-950 line-through';
                          } else {
                            optionStyle = 'border-slate-200 opacity-60 text-slate-600';
                          }
                        } else if (isSelected) {
                          optionStyle = 'border-indigo-600 bg-indigo-50 text-indigo-950 font-black ring-2 ring-indigo-500/20';
                        }

                        return (
                          <div
                            key={optIdx}
                            onClick={() => {
                              if (!submission) {
                                setMcqAnswers((prev) => ({ ...prev, [q.id]: optIdx }));
                              }
                            }}
                            className={`p-4 rounded-2xl border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-lg bg-white/80 border border-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                                {['أ', 'ب', 'ج', 'د'][optIdx]}
                              </span>
                              <span>{opt}</span>
                            </div>

                            {submission && isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Essay Answer Input */}
                  {!isMCQ && (
                    <div className="space-y-3 pt-2">
                      {!submission ? (
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            اكتب إجابتك أو خطوات الحل بالتفصيل هنا:
                          </label>
                          <textarea
                            rows={4}
                            value={essayAnswers[q.id] || ''}
                            onChange={(e) =>
                              setEssayAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            placeholder="اكتب القانون، خطوات التعويض، الشرح أو الاستنتاج المطلوب..."
                            className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                          />
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                          <span className="text-xs font-black text-slate-500">إجابتك المسلّمة:</span>
                          <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap">
                            {essayAnswers[q.id] || 'لم يتم كتابة إجابة'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Model Solution & Rubric (Shown after submission) */}
                  {submission && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                      {!isMCQ && submission.status === 'under_review' ? (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>حالة السؤال المقالي: قيد التصحيح ⏳</span>
                            </span>
                            <span className="text-xs font-bold text-amber-800 bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
                              بانتظار مراجعة المدرس ({q.marks} درجات)
                            </span>
                          </div>
                          <p className="text-xs text-amber-900 font-medium leading-relaxed">
                            تم استلام إجابتك المقالية بنجاح وهي الآن قيد التصحيح من قِبل المدرس. ستظهر الدرجة المستحقة والإجابة النموذجية فور اعتماد المدرس للتصحيح.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Essay Teacher Evaluation Feedback */}
                          {!isMCQ && essayGrade && (
                            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-indigo-600" />
                                  <span>تقييم وملاحظات المدرس:</span>
                                </span>
                                <span className="text-xs font-bold text-indigo-700">
                                  {essayGrade.awardedMarks} / {essayGrade.maxMarks} درجات
                                </span>
                              </div>

                              <p className="text-xs sm:text-sm text-indigo-950 font-medium leading-relaxed">
                                {essayGrade.feedback}
                              </p>
                            </div>
                          )}

                          {/* Official Textbook Model Answer */}
                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>الإجابة النموذجية وسلم التصحيح المعتمد:</span>
                              </span>
                              <span className="text-[11px] text-emerald-700 font-bold">من نص الكتاب الوزاري</span>
                            </div>
                            <p className="text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium whitespace-pre-wrap">
                              {q.modelAnswer}
                            </p>
                            {q.bookReference && (
                              <div className="text-[11px] text-emerald-700 font-bold pt-1">
                                📖 المرجع في الكتاب: {q.bookReference}
                              </div>
                            )}
                          </div>

                          {/* Rubric Criteria Checklist for Essay */}
                          {!isMCQ && q.rubricCriteria && q.rubricCriteria.length > 0 && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                              <span className="font-bold text-slate-900">بنود سلم التصحيح وتوزيع الدرجات:</span>
                              <ul className="space-y-1 list-disc list-inside text-slate-600">
                                {q.rubricCriteria.map((crit, idx) => (
                                  <li key={idx}>{crit}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Button Bar */}
          {!submission && (
            <div className="sticky bottom-6 z-30 bg-white/90 backdrop-blur-md border border-slate-200 rounded-[28px] p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs sm:text-sm text-slate-700 font-bold">
                تأكد من مراجعة إجاباتك كاملة قبل التسليم.
              </div>

              <button
                disabled={isSubmitting}
                onClick={handleSubmitExam}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري تسليم الإجابات وإرسال المقالي للمدرس...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>تسليم الامتحان</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
