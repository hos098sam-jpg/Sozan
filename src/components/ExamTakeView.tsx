import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Award,
  Lock,
  Unlock,
  Copy,
  Check,
  Image,
  Upload,
  FileText,
  HelpCircle,
  ShieldAlert,
  Shuffle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CourseExam, ExamQuestion, StudentExamSubmission, EssayGradingResult, User } from '../types';
import { getSavedSubmissions, saveSubmissions } from '../data/initialData';
import { getIdToken, db } from '../auth';
import { doc, setDoc } from 'firebase/firestore';
import { compressImageFile } from '../utils/imageUtils';
import { formatDetailedExamDuration, formatDetailedSubmissionDate } from '../utils/studentStats';
import { CertificateModal } from './CertificateModal';

interface ExamTakeViewProps {
  exam: CourseExam;
  courseTitle: string;
  currentUser: User | null;
  onBack: () => void;
  onExamCompleted: (
    examId: string,
    score: number,
    maxScore: number,
    percentage: number,
    passed: boolean,
    timingMeta?: {
      startedAt?: string;
      submittedAt?: string;
      durationTakenSeconds?: number;
      durationTakenFormatted?: string;
      status?: 'submitted' | 'under_review' | 'graded';
    }
  ) => void;
  onOpenAuth: () => void;
  attemptNumber?: number;
  isReviewOnly?: boolean;
}

export const ExamTakeView: React.FC<ExamTakeViewProps> = ({
  exam,
  courseTitle,
  currentUser,
  onBack,
  onExamCompleted,
  onOpenAuth,
  attemptNumber: propAttemptNumber,
  isReviewOnly = false,
}) => {
  const maxAttempts = Math.max(1, Number(exam.maxAttempts) || 1);

  // Retrieve prior submissions for this user
  const priorSubmissions = getSavedSubmissions().filter(
    (item) =>
      item.examId === exam.id &&
      ((currentUser?.id && item.studentId === currentUser.id) ||
        (currentUser?.phone && item.studentPhone === currentUser.phone))
  );

  const priorAttemptsCount = Math.max(
    priorSubmissions.length,
    Number(currentUser?.examResults?.[exam.id]?.attemptsCount) || 0
  );

  const hasExhaustedAttempts = priorAttemptsCount >= maxAttempts;
  const isReviewMode = Boolean(isReviewOnly || (hasExhaustedAttempts && priorSubmissions.length > 0));
  const currentAttemptNumber = propAttemptNumber || Math.min(maxAttempts, priorAttemptsCount + 1);
  const remainingAttempts = Math.max(0, maxAttempts - priorAttemptsCount);

  // Preload last submission if in review mode
  const initialSubmission = isReviewMode
    ? priorSubmissions[priorSubmissions.length - 1] || null
    : null;

  // Record exact entry time
  const [entryTimestamp] = useState<Date>(() => new Date());
  const formattedStartTime =
    entryTimestamp.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    ` (${entryTimestamp.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })})`;

  // Timer state in seconds
  const totalSeconds = (exam.durationMinutes || 25) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [timerActive, setTimerActive] = useState(!isReviewMode);

  // Student active answers
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>(() => {
    return initialSubmission?.mcqAnswers ? { ...initialSubmission.mcqAnswers } : {};
  });
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>(() => {
    return initialSubmission?.essayAnswers ? { ...initialSubmission.essayAnswers } : {};
  });
  const [essayImages, setEssayImages] = useState<Record<string, string>>(() => {
    return initialSubmission?.essayAnswerImages ? { ...initialSubmission.essayAnswerImages } : {};
  });
  const [essayAudio, setEssayAudio] = useState<Record<string, string>>({});
  const [recordingQuestionId, setRecordingQuestionId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<StudentExamSubmission | null>(initialSubmission);
  const [copiedSolution, setCopiedSolution] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  // Anti-Cheating & Random Question Bank State
  const [tabSwitchesCount, setTabSwitchesCount] = useState<number>(0);
  const [antiCheatWarning, setAntiCheatWarning] = useState<string | null>(null);
  const [autoSubmittedByAntiCheat, setAutoSubmittedByAntiCheat] = useState<boolean>(false);

  // Create a randomized question + option order per attempt (Random Question Bank)
  const [randomizedQuestions] = useState(() => {
    const indexed = exam.questions.map((q, originalQIdx) => {
      const qId = String(q.id || `q_${originalQIdx}`);
      const isMCQ = q.type === 'mcq' || (!q.type && Array.isArray(q.options) && q.options.length > 0);
      const optionIndices = isMCQ && Array.isArray(q.options) ? q.options.map((_, i) => i) : [];

      if (!isReviewMode && optionIndices.length > 1) {
        for (let i = optionIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [optionIndices[i], optionIndices[j]] = [optionIndices[j], optionIndices[i]];
        }
      }

      return {
        q,
        qId,
        originalQIdx,
        shuffledOptionIndices: optionIndices,
      };
    });

    if (!isReviewMode && indexed.length > 1) {
      for (let i = indexed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
      }
    }
    return indexed;
  });

  // Anti-Cheat: Detect tab switching or leaving exam window
  useEffect(() => {
    if (isReviewMode || submission) return;

    const handleVisibilityOrBlur = () => {
      if (document.hidden) {
        setTabSwitchesCount((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setAutoSubmittedByAntiCheat(true);
            setAntiCheatWarning(
              '⚠️ تم رصد الخروج من شاشة الامتحان 3 مرات! قام نظام الحماية ومنع الغش بتسليم الامتحان تلقائياً وإبلاغ المعلم.'
            );
          } else {
            setAntiCheatWarning(
              `⚠️ تحذير نظام منع الغش (${next}/3): يُمنع الخروج من تبويب الامتحان أو فتح نوافذ أخرى أثناء الحل! عند التحذير الثالث يُغلق الامتحان تلقائياً.`
            );
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrBlur);
    };
  }, [isReviewMode, submission]);

  // Auto-submit if anti-cheat limit reached
  useEffect(() => {
    if (autoSubmittedByAntiCheat && !submission && !isSubmitting) {
      handleSubmit();
    }
  }, [autoSubmittedByAntiCheat, submission, isSubmitting]);

  // Timer countdown hook
  useEffect(() => {
    if (!timerActive || secondsRemaining <= 0 || submission) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          // Auto submit when timer expires
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, secondsRemaining, submission]);

  // Handle local image upload for essay answer
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    questionId: string
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      compressImageFile(file, 1200, 0.75).then((compressed) => {
        if (compressed) {
          setEssayImages((prev) => ({ ...prev, [questionId]: compressed }));
        }
      }).catch(() => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setEssayImages((prev) => ({ ...prev, [questionId]: reader.result as string }));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const toggleVoiceAnswer = async (questionId: string) => {
    if (recordingQuestionId === questionId) {
      recorderRef.current?.stop();
      (window as any).__qalbalelmRecognition?.stop?.();
      setRecordingQuestionId(null);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-EG';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results as ArrayLike<any>).map((result: any) => result[0].transcript).join(' ');
        setEssayAnswers((prev) => ({ ...prev, [questionId]: `${prev[questionId] || ''} ${transcript}`.trim() }));
      };
      recognition.onend = () => setRecordingQuestionId(null);
      recognition.start();
      (window as any).__qalbalelmRecognition = recognition;
    }
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
      if (stream && typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        recorder.onstop = () => {
          const reader = new FileReader();
          reader.onloadend = () => setEssayAudio((prev) => ({ ...prev, [questionId]: String(reader.result || '') }));
          reader.readAsDataURL(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
          stream.getTracks().forEach((track) => track.stop());
        };
        recorderRef.current = recorder;
        recorder.start();
      }
    } catch {
      // Voice fallback
    }
    setRecordingQuestionId(questionId);
  };

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Submit Exam
  const handleSubmit = async () => {
    if (submission || isSubmitting) return;

    setIsSubmitting(true);
    let totalScore = 0;
    let maxScore = 0;
    const essayGrades: Record<string, EssayGradingResult> = {};
    const hasEssayQuestions = exam.questions.some(
      (q) => q.type === 'essay' || (!q.type && (!Array.isArray(q.options) || q.options.length === 0))
    );

    try {
      // 1. Grade Multiple Choice Questions strictly with numeric verification
      exam.questions.forEach((q, idx) => {
        const qId = String(q.id || `q_${idx}`);
        const qMarks = Number(q.marks) > 0 ? Number(q.marks) : 10;
        maxScore += qMarks;
        const isMCQ = q.type === 'mcq' || (!q.type && Array.isArray(q.options) && q.options.length > 0);
        if (isMCQ) {
          const selected = mcqAnswers[qId] ?? mcqAnswers[q.id];
          if (
            selected !== undefined &&
            selected !== null &&
            q.correctOptionIndex !== undefined &&
            q.correctOptionIndex !== null &&
            Number(selected) === Number(q.correctOptionIndex)
          ) {
            totalScore += qMarks;
          }
        }
      });

      // 2. Essay Questions: Do NOT auto-grade! Mark as 'under_review' (قيد التصحيح) until teacher grades them
      exam.questions.forEach((q, idx) => {
        const isMCQ = q.type === 'mcq' || (!q.type && Array.isArray(q.options) && q.options.length > 0);
        if (!isMCQ) {
          const qId = String(q.id || `q_${idx}`);
          const qMarks = Number(q.marks) > 0 ? Number(q.marks) : 10;
          essayGrades[qId] = {
            questionId: qId,
            awardedMarks: 0,
            maxMarks: qMarks,
            feedback: 'قيد التصحيح والمراجعة من قِبل المدرس المعتمد ⏳',
            strengths: [],
            missingPoints: [],
            improvementTip: 'ستظهر درجتك وملاحظات المدرس فور اعتماد التصحيح.',
            ...(q.modelAnswerImage ? { modelAnswerImage: q.modelAnswerImage } : {}),
          };
        }
      });

      const submissionStatus: 'under_review' | 'graded' = hasEssayQuestions ? 'under_review' : 'graded';
      let calculatedPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      let passed = hasEssayQuestions ? false : calculatedPercentage >= (exam.passingPercentage || 60);

      const exitTimestamp = new Date();
      const dayName = exitTimestamp.toLocaleDateString('ar-EG', { weekday: 'long' });
      const dateStr = exitTimestamp.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
      const timeStr = exitTimestamp.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const formattedExitTime = `${dayName} ${dateStr} - الساعة ${timeStr}`;

      const exactElapsedSecs = Math.max(
        1,
        Math.round((exitTimestamp.getTime() - entryTimestamp.getTime()) / 1000) || (totalSeconds - secondsRemaining)
      );
      const formattedDuration = formatDetailedExamDuration(exactElapsedSecs);

      const studentId = currentUser?.id || `student_${Date.now()}`;
      const studentName = currentUser?.name || 'طالب منصة قلب العلم';
      const studentPhone = currentUser?.phone || '';
      const parentPhone = currentUser?.parentPhone || currentUser?.fatherPhone || currentUser?.motherPhone || '';
      const studentSchoolYear = currentUser?.schoolYear || 'الصف الثالث الثانوي';

      let finalSubmission: StudentExamSubmission;

      try {
        // Submit to secure backend for server-side verification and grading with 6s timeout
        const token = await Promise.race([
          getIdToken().catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const res = await fetch('/api/exams/submit', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            examId: exam.id,
            courseId: exam.courseId || '',
            courseTitle: courseTitle || '',
            lessonTitle: exam.lessonTitle || '',
            examTitle: exam.title || '',
            studentId,
            studentName,
            studentPhone,
            parentPhone,
            studentSchoolYear,
            startedAt: formattedStartTime,
            submittedAtFormatted: formattedExitTime,
            durationTakenFormatted: formattedDuration,
            durationMinutes: exam.durationMinutes || 30,
            mcqAnswers,
            essayAnswers,
            essayAnswerImages: essayImages,
            essayAnswerAudio: essayAudio,
            essayAnswerTranscripts: essayAnswers,
            essayGrades,
            status: submissionStatus,
            hasEssayQuestions,
            attemptNumber: currentAttemptNumber,
            priorAttemptsCount,
            maxAttempts,
            durationTakenSeconds: exactElapsedSecs,
            clientTotalScore: totalScore,
            clientMaxScore: maxScore,
            passingPercentage: exam.passingPercentage || 60,
            questions: exam.questions.map((q, idx) => ({
              id: String(q.id || `q_${idx}`),
              type: q.type || 'mcq',
              marks: Number(q.marks) || 10,
              correctOptionIndex: q.correctOptionIndex,
            })),
          }),
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const resData = await res.json();
          if (resData.submission) {
            finalSubmission = {
              ...resData.submission,
              status: resData.submission.status || submissionStatus,
              startedAt: formattedStartTime,
              submittedAt: formattedExitTime,
              durationMinutes: exam.durationMinutes || 30,
              durationTakenSeconds: exactElapsedSecs,
              durationTakenFormatted: formattedDuration,
              tabSwitchesCount,
              autoSubmittedByAntiCheat,
            };
            if (resData.totalScore !== undefined && resData.maxScore > 0 && !resData.alreadySubmitted) {
              totalScore = resData.totalScore;
              maxScore = resData.maxScore;
              calculatedPercentage = Math.round((totalScore / maxScore) * 100);
              passed = finalSubmission.status === 'under_review' ? false : calculatedPercentage >= (exam.passingPercentage || 60);
            }
          } else {
            throw new Error('No submission returned from server');
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Server submission error');
        }
      } catch (submitErr) {
        console.warn('Backend submission fallback to verified client payload:', submitErr);
        finalSubmission = {
          submissionId: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          examId: exam.id,
          courseId: exam.courseId || '',
          courseTitle: courseTitle || '',
          lessonTitle: exam.lessonTitle || '',
          examTitle: exam.title || '',
          studentId,
          studentName,
          studentPhone,
          parentPhone,
          studentSchoolYear,
          mcqAnswers: { ...mcqAnswers },
          essayAnswers: { ...essayAnswers },
          essayAnswerImages: { ...essayImages },
          isSubmitted: true,
          status: submissionStatus,
          totalScore,
          maxScore,
          percentage: calculatedPercentage,
          passed,
          essayGrades,
          startedAt: formattedStartTime,
          submittedAt: formattedExitTime,
          durationMinutes: exam.durationMinutes || 30,
          durationTakenSeconds: exactElapsedSecs,
          durationTakenFormatted: formattedDuration,
          tabSwitchesCount,
          autoSubmittedByAntiCheat,
        };
      }

      // Immediately update UI & local submissions BEFORE any background Firestore calls
      const currentSubs = getSavedSubmissions();
      const finalId = finalSubmission.submissionId || (finalSubmission as any).id;
      saveSubmissions([
        finalSubmission,
        ...currentSubs.filter((s) => (s.submissionId || (s as any).id) !== finalId),
      ]);

      setSubmission(finalSubmission);
      setTimerActive(false);

      if (passed) {
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch {}
      }

      // Notify parent with full timing & score details immediately
      onExamCompleted(exam.id, totalScore, maxScore, calculatedPercentage, passed, {
        startedAt: formattedStartTime,
        submittedAt: formattedExitTime,
        durationTakenSeconds: exactElapsedSecs,
        durationTakenFormatted: formattedDuration,
        status: finalSubmission.status || submissionStatus,
      });

      // Persist to client Firestore in the background (non-blocking, stripped of undefined fields)
      try {
        if (currentUser?.id && finalId) {
          const cleanPayload = JSON.parse(
            JSON.stringify({
              ...finalSubmission,
              updatedAt: new Date().toISOString(),
            })
          );
          setDoc(doc(db, 'submissions', finalId), cleanPayload, { merge: true }).catch((fsErr) =>
            console.warn('Client Firestore submission write notice:', fsErr)
          );
        }
      } catch (fsErr) {
        console.warn('Client Firestore submission write notice:', fsErr);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle starting next allowed attempt
  const handleStartNextAttempt = () => {
    if (priorAttemptsCount + 1 >= maxAttempts) return;
    setSubmission(null);
    setMcqAnswers({});
    setEssayAnswers({});
    setEssayImages({});
    setSecondsRemaining(totalSeconds);
    setTimerActive(true);
  };

  // Copy Model Solutions
  const handleCopySolutions = () => {
    const text = `
=== نموذج الإجابات الرسمية وسلالم التصحيح ===
الكورس: ${courseTitle}
الامتحان: ${exam.title}
الدرس: ${exam.lessonTitle}

${exam.questions
  .map(
    (q, idx) => `
[السؤال ${idx + 1} (${q.type === 'mcq' ? 'اختيار من متعدد' : 'سؤال مقالي'}) - ${q.marks} درجة]:
${q.questionText}

* الإجابة النموذجية المعتمدة:
${q.modelAnswer}

* المرجع: ${q.bookReference || 'المنهاج المعتمد'}
`
  )
  .join('\n----------------------------------------\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Sticky Exam Top Bar */}
      <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-20 z-30 backdrop-blur-md bg-white/95">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-indigo-700 px-2.5 py-0.5 bg-indigo-50 rounded-full border border-indigo-100">
              {courseTitle}
            </span>
            <span className="text-xs text-slate-500 font-bold">الدرس: {exam.lessonTitle}</span>
            <span
              className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                isReviewMode || hasExhaustedAttempts
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {isReviewMode || hasExhaustedAttempts
                ? `وضع المراجعة • المحاولات المستنفدة: ${priorAttemptsCount} من ${maxAttempts}`
                : `المحاولة ${currentAttemptNumber} من أصل ${maxAttempts}`}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">{exam.title}</h2>
        </div>

        {/* Live Timer & Back button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {!submission && (
            <div
              className={`px-4 py-2 rounded-2xl flex items-center gap-2 font-mono font-black text-sm border shadow-xs ${
                secondsRemaining < 180
                  ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>
          )}

          <button
            onClick={onBack}
            className="px-4 py-2 rounded-2xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>خروج من الامتحان</span>
          </button>
        </div>
      </div>

      {/* Result Card after submission */}
      {submission && (
        <div
          className={`p-6 sm:p-8 rounded-[32px] border text-white shadow-xl space-y-4 animate-fadeIn ${
            submission.status === 'under_review'
              ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 border-amber-500/30'
              : submission.percentage >= (exam.passingPercentage || 60)
              ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 border-emerald-500/30'
              : 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-900 border-rose-500/30'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg ${
                  submission.status === 'under_review'
                    ? 'bg-amber-500 text-slate-950'
                    : submission.percentage >= (exam.passingPercentage || 60)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {submission.status === 'under_review' ? '⏳' : `${submission.percentage}%`}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-black tracking-wide text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    {submission.status === 'under_review'
                      ? 'تم تسليم الامتحان • الأسئلة المقالية قيد التصحيح ⏳'
                      : 'نتيجة التصحيح والاعتماد'}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">
                  {submission.status === 'under_review'
                    ? 'إجابتك قيد التصحيح والمراجعة من قِبل المدرس 📝'
                    : submission.percentage >= (exam.passingPercentage || 60)
                    ? 'مبروك! لقد اجتزت الامتحان بنجاح 🎓'
                    : 'حاول مجدداً للوصول إلى نسبة النجاح المطلوبة'}
                </h3>
                <p className="text-xs text-slate-300">
                  {submission.status === 'under_review'
                    ? `درجة الاختياري المبدئية: ${submission.totalScore} من ${submission.maxScore} (بانتظار تصحيح الأسئلة المقالية وإضافة درجاتها)`
                    : `الدرجة المحققة: ${submission.totalScore} من أصل ${submission.maxScore} درجة`}{' '}
                  • المحاولة المستخدمة: {submission.attemptNumber || currentAttemptNumber} من {maxAttempts}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {submission.status !== 'under_review' &&
                submission.percentage >= (exam.passingPercentage || 60) && (
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/25 cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>شهادة التقدير (PDF + مشاركة)</span>
                  </button>
                )}

              <button
                onClick={handleCopySolutions}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-black text-white transition-all flex items-center gap-1.5 border border-white/15"
              >
                {copiedSolution ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSolution ? 'تم النسخ' : 'نسخ الإجابات النموذجية'}</span>
              </button>

              {/* Strict attempt check: Disable or hide retake button if attempts limit reached */}
              {currentAttemptNumber < maxAttempts && !hasExhaustedAttempts ? (
                <button
                  onClick={handleStartNextAttempt}
                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black text-white transition-all flex items-center gap-1.5 shadow-md shadow-indigo-500/30 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>بدء المحاولة التالية ({currentAttemptNumber + 1} من {maxAttempts})</span>
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-2xl bg-white/10 text-slate-200 text-xs font-black flex items-center gap-1.5 border border-white/15">
                  <Lock className="w-4 h-4 text-amber-300" />
                  <span>تم استنفاد كافة المحاولات ({maxAttempts}/{maxAttempts})</span>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Submission Time, Duration (Day/Hour/Min/Sec), and Student Score Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/15 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-1">
              <span className="text-[11px] text-amber-300 font-black block">📅 زمن وتاريخ تسليم الامتحان:</span>
              <span className="font-mono font-bold text-white block text-xs sm:text-sm">
                {formatDetailedSubmissionDate(submission.submittedAt)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-1">
              <span className="text-[11px] text-amber-300 font-black block">⏱️ الوقت المستغرق (يوم / ساعة / دقيقة / ثانية):</span>
              <span className="font-mono font-black text-emerald-300 block text-xs sm:text-sm">
                {formatDetailedExamDuration(submission.durationTakenSeconds, submission.durationTakenFormatted)}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 space-y-1">
              <span className="text-[11px] text-amber-300 font-black block">🏆 درجة الطالب والنسبة المئوية:</span>
              <span className="font-mono font-black text-white block text-xs sm:text-sm">
                {submission.status === 'under_review'
                  ? `قيد التصحيح ⏳ (الاختياري: ${submission.totalScore} / ${submission.maxScore})`
                  : `${submission.totalScore} / ${submission.maxScore} درجة (${submission.percentage}%)`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Anti-Cheat & Random Question Bank Security Banner */}
      {!submission && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white border border-slate-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-amber-400" />
            <span>بنك الأسئلة العشوائي مفعّل: ترتيب الأسئلة والاختيارات مختلف لكل طالب لمنع الغش.</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldAlert className="w-4 h-4" />
            <span>نظام مراقبة الشاشة نشط (محاولات الخروج المرصودة: {tabSwitchesCount}/3)</span>
          </div>
        </div>
      )}

      {antiCheatWarning && (
        <div className="p-4 rounded-2xl bg-rose-950 border-2 border-rose-500 text-rose-100 text-xs sm:text-sm font-black flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
            <span>{antiCheatWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setAntiCheatWarning(null)}
            className="px-3 py-1 rounded-xl bg-rose-800 text-white text-xs cursor-pointer"
          >
            فهمت
          </button>
        </div>
      )}

      {/* Questions List */}
      <div
        className="space-y-6 select-none"
        onCopy={(e) => {
          if (!submission) e.preventDefault();
        }}
        onContextMenu={(e) => {
          if (!submission) e.preventDefault();
        }}
      >
        {randomizedQuestions.map(({ q, qId, shuffledOptionIndices }, qIndex) => {
          const isMCQ = q.type === 'mcq' || (!q.type && Array.isArray(q.options) && q.options.length > 0);
          const selectedOption = mcqAnswers[qId] ?? mcqAnswers[q.id];
          const isCorrectMCQ =
            selectedOption !== undefined &&
            selectedOption !== null &&
            q.correctOptionIndex !== undefined &&
            q.correctOptionIndex !== null &&
            Number(selectedOption) === Number(q.correctOptionIndex);

          return (
            <div
              key={qId}
              className={`bg-white border rounded-[32px] p-6 sm:p-8 shadow-xs transition-all space-y-5 ${
                submission
                  ? isMCQ
                    ? isCorrectMCQ
                      ? 'border-emerald-300 ring-2 ring-emerald-50'
                      : 'border-rose-300 ring-2 ring-rose-50'
                    : 'border-amber-200 ring-2 ring-amber-50'
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
                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 ml-2">
                      {isMCQ ? 'اختيار من متعدد' : 'سؤال مقالي / مسألة واستنتاج'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">({q.marks} درجات)</span>
                  </div>
                </div>

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
                        <Clock className="w-3.5 h-3.5" />
                        <span>قيد التصحيح ⏳</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-black border border-indigo-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          تم التصحيح ({submission.essayGrades?.[qId]?.awardedMarks ?? submission.essayGrades?.[q.id]?.awardedMarks ?? 0} من {q.marks})
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Question Image (if attached) */}
              {q.questionImage && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-80 flex items-center justify-center">
                  <img src={q.questionImage} alt="question illustration" className="max-h-80 object-contain w-full" />
                </div>
              )}

              {/* Question Text */}
              <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                {q.questionText}
              </p>

              {/* MCQ Options (Shuffled per student via shuffledOptionIndices while storing original index) */}
              {isMCQ && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {(shuffledOptionIndices.length === q.options.length
                    ? shuffledOptionIndices
                    : q.options.map((_, i) => i)
                  ).map((originalOptIdx, displayIdx) => {
                    const opt = q.options![originalOptIdx];
                    const isSelected = selectedOption === originalOptIdx;
                    const isCorrect = Number(q.correctOptionIndex) === originalOptIdx;
                    const optionImg = q.optionImages?.[originalOptIdx];

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
                        key={originalOptIdx}
                        onClick={() => {
                          if (!submission) {
                            setMcqAnswers((prev) => ({ ...prev, [qId]: originalOptIdx }));
                          }
                        }}
                        className={`p-4 rounded-2xl border text-xs sm:text-sm transition-all flex flex-col gap-2 cursor-pointer ${optionStyle}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-white/80 border border-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                              {['أ', 'ب', 'ج', 'د'][displayIdx] || displayIdx + 1}
                            </span>
                            <span>{opt}</span>
                          </div>

                          {submission && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>

                        {optionImg && (
                          <div className="mt-1 rounded-xl overflow-hidden border border-slate-200 bg-white p-1 max-h-32 flex items-center justify-center">
                            <img src={optionImg} alt={`Option ${displayIdx + 1}`} className="max-h-28 object-contain" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Essay Answer Input, Voice Recording & Photo Upload */}
              {!isMCQ && (
                <div className="space-y-3 pt-2">
                  {!submission ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-600">
                          اكتب إجابتك أو خطوات الحل بالتفصيل هنا:
                        </label>
                        <button
                          type="button"
                          onClick={() => toggleVoiceAnswer(qId)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                            recordingQuestionId === qId
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                          }`}
                        >
                          <span>{recordingQuestionId === qId ? '⏹️ إيقاف التسجيل الصوتي' : '🎙️ إجابة صوتية (تسجيل + تحويل لنص)'}</span>
                        </button>
                      </div>

                      <textarea
                        rows={4}
                        value={essayAnswers[qId] ?? essayAnswers[q.id] ?? ''}
                        onChange={(e) =>
                          setEssayAnswers((prev) => ({ ...prev, [qId]: e.target.value }))
                        }
                        placeholder="اكتب القوانين الرياضية، التعويض بالأرقام، التعليل أو الشرح المطلوب..."
                        className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />

                      {(essayAudio[qId] || essayAudio[q.id]) && (
                        <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                          <span className="text-xs font-black text-indigo-950">التسجيل الصوتي المحفوظ:</span>
                          <audio controls src={essayAudio[qId] || essayAudio[q.id]} className="h-8" />
                        </div>
                      )}

                      {/* Handwritten sheet upload */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-600">
                          <span className="font-bold block text-slate-800">📸 إرفاق صورة ورقة الإجابة والخطوات:</span>
                          <span className="text-[11px] text-slate-400">يمكنك تصوير ورقة حلك ورفعها لمراجعتها من قِبل المشرف</span>
                        </div>

                        <label className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0">
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{(essayImages[qId] || essayImages[q.id]) ? 'تغيير الصورة المرفوعة ✅' : 'رفع صورة الإجابة'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, qId)}
                          />
                        </label>
                      </div>

                      {(essayImages[qId] || essayImages[q.id]) && (
                        <div className="h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                          <img src={essayImages[qId] || essayImages[q.id]} alt="uploaded answer preview" className="h-full object-contain" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-xs font-black text-slate-500">إجابتك المسلّمة:</span>
                      <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap">
                        {essayAnswers[qId] || essayAnswers[q.id] || 'تم تقديم الحل عبر صورة الورقة المرفوعة.'}
                      </p>
                      {(submission.essayAnswerAudio?.[qId] || submission.essayAnswerAudio?.[q.id]) && (
                        <div className="pt-2">
                          <span className="text-xs font-bold text-slate-600 block mb-1">المقطع الصوتي المسجل:</span>
                          <audio controls src={submission.essayAnswerAudio?.[qId] || submission.essayAnswerAudio?.[q.id]} className="h-8 w-full max-w-sm" />
                        </div>
                      )}
                      {(essayImages[qId] || essayImages[q.id]) && (
                        <div className="mt-2 h-32 rounded-xl overflow-hidden border border-slate-200">
                          <img src={essayImages[qId] || essayImages[q.id]} alt="student answer sheet" className="h-full object-contain" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Model Solution & Model Answer Image (Under question) */}
              {submission && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                  {isMCQ ? (
                    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                      <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                        <span>الحل النموذجي المعتمد من الكتاب:</span>
                      </span>

                      {q.modelAnswer && (
                        <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap font-medium leading-relaxed bg-white p-3 rounded-xl border border-emerald-100">
                          {q.modelAnswer}
                        </p>
                      )}

                      {/* Model Answer Image under question */}
                      {q.modelAnswerImage && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-black text-emerald-900 block">🖼️ صورة الحل النموذجي:</span>
                          <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-white p-2">
                            <img src={q.modelAnswerImage} alt="model answer visual" className="max-h-72 object-contain w-full" />
                          </div>
                        </div>
                      )}

                      {q.bookReference && (
                        <span className="text-[11px] text-slate-500 font-bold block pt-1">
                          📖 المرجع: {q.bookReference}
                        </span>
                      )}
                    </div>
                  ) : submission.status === 'under_review' ? (
                    /* Essay Under Review: Show 'قيد التصحيح' until Teacher grades it */
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>حالة السؤال المقالي: قيد التصحيح ⏳</span>
                        </span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white text-amber-800 border border-amber-200">
                          بانتظار تصحيح المدرس (من {q.marks} درجة)
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        تم استلام إجابتك المقالية بنجاح وهي الآن قيد التصحيح اليدوي من قِبل المدرس. ستظهر لك الدرجة المستحقة وملاحظات المدرس والحل النموذجي فور اعتماد التصحيح.
                      </p>
                    </div>
                  ) : (
                    /* Essay Graded by Teacher: Show Teacher Feedback & Model Solution */
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          <span>تصحيح المدرس والحل النموذجي للسؤال المقالي:</span>
                        </span>
                        {submission.essayGrades?.[q.id]?.awardedMarks !== undefined && (
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                            الدرجة المستحقة: {submission.essayGrades[q.id].awardedMarks} من {q.marks}
                          </span>
                        )}
                      </div>

                      {submission.essayGrades?.[q.id]?.feedback && (
                        <p className="text-xs text-indigo-900 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                          {submission.essayGrades[q.id].feedback}
                        </p>
                      )}

                      {q.modelAnswer && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-black text-slate-700 block">الإجابة النموذجية المعتمدة:</span>
                          <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                            {q.modelAnswer}
                          </p>
                        </div>
                      )}

                      {(submission.essayGrades?.[q.id]?.modelAnswerImage || q.modelAnswerImage) && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-black text-indigo-900 block">🖼️ صورة الحل النموذجي والخطوات:</span>
                          <div className="rounded-2xl overflow-hidden border border-indigo-200 bg-white p-2">
                            <img
                              src={submission.essayGrades?.[q.id]?.modelAnswerImage || q.modelAnswerImage}
                              alt="model answer visual"
                              className="max-h-72 object-contain w-full"
                            />
                          </div>
                        </div>
                      )}

                      {q.bookReference && (
                        <span className="text-[11px] text-slate-500 font-bold block pt-1">
                          📖 المرجع: {q.bookReference}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Submit Action */}
      {!submission && (
        <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            تمت الإجابة على <b>{Object.keys(mcqAnswers).length + Object.keys(essayAnswers).length + Object.keys(essayImages).length}</b> من أصل <b>{exam.questions.length}</b> أسئلة.
          </div>

          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري تسليم وتدقيق الامتحان...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>تسليم الامتحان وإنهاء المحاولة</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Printable PDF Certificate Modal */}
      {submission && (
        <CertificateModal
          isOpen={showCertificateModal}
          onClose={() => setShowCertificateModal(false)}
          studentName={currentUser?.name || submission.studentName || 'طالب متفوق'}
          studentGrade={currentUser?.grade || submission.studentSchoolYear}
          courseTitle={courseTitle}
          examTitle={exam.title}
          scorePercentage={submission.percentage}
          scoreText={`${submission.totalScore} / ${submission.maxScore}`}
          issuedDate={submission.submittedAt}
        />
      )}
    </div>
  );
};
