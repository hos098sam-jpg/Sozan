import React, { useState, useEffect } from 'react';
import {
  MessageSquarePlus,
  Send,
  BookmarkPlus,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Image as ImageIcon,
  Trash2,
  Reply,
  Sparkles,
  BookOpen,
  PlayCircle,
} from 'lucide-react';
import { LessonQAItem, User, VideoTimestampNote } from '../types';

interface LessonQASectionProps {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  currentUser: User | null;
  onUpdateUserNotes?: (notes: VideoTimestampNote[]) => void;
  onSeekToTimestamp?: (timestamp: string) => void;
}

export const LessonQASection: React.FC<LessonQASectionProps> = ({
  courseId,
  lessonId,
  lessonTitle,
  currentUser,
  onUpdateUserNotes,
  onSeekToTimestamp,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'qa' | 'notes'>('qa');
  const [qaItems, setQaItems] = useState<LessonQAItem[]>([]);
  const [loadingQA, setLoadingQA] = useState(false);

  // Ask question state
  const [questionText, setQuestionText] = useState('');
  const [questionTimestamp, setQuestionTimestamp] = useState('');
  const [questionImage, setQuestionImage] = useState<string>('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Staff reply state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Student video timestamp notes state
  const [noteTimestamp, setNoteTimestamp] = useState('05:30');
  const [noteText, setNoteText] = useState('');
  const [localNotes, setLocalNotes] = useState<VideoTimestampNote[]>([]);

  const isStaff =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'teacher' ||
    currentUser?.role === 'assistant';

  useEffect(() => {
    fetchLessonQA();
  }, [courseId, lessonId]);

  useEffect(() => {
    const storageKey = `motafalsifa_video_notes_${currentUser?.id || 'guest'}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setLocalNotes(JSON.parse(saved));
      } else if (currentUser?.videoNotes) {
        setLocalNotes(currentUser.videoNotes);
      }
    } catch {
      if (currentUser?.videoNotes) setLocalNotes(currentUser.videoNotes);
    }
  }, [currentUser?.id]);

  const fetchLessonQA = async () => {
    setLoadingQA(true);
    try {
      const res = await fetch(
        `/api/lesson-qa?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setQaItems(data.items);
        }
      }
    } catch (err) {
      console.error('Failed to load lesson Q&A:', err);
    } finally {
      setLoadingQA(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setQuestionImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    setSubmittingQuestion(true);
    try {
      const res = await fetch('/api/lesson-qa/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId,
          lessonTitle,
          studentId: currentUser?.id || 'guest',
          studentName: currentUser?.name || 'طالب بالمنصة',
          studentGrade: currentUser?.grade || '',
          questionText: questionText.trim(),
          videoTimestamp: questionTimestamp.trim() || undefined,
          imageUrl: questionImage || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setQaItems((prev) => [data.item, ...prev]);
        }
        setQuestionText('');
        setQuestionTimestamp('');
        setQuestionImage('');
      }
    } catch (err) {
      console.error('Error submitting question:', err);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleSendReply = async (qaId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/lesson-qa/${qaId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentUser?.id || 'staff',
          authorName: currentUser?.name || 'د. حسام شحاته',
          authorRole: currentUser?.role || 'teacher',
          text: replyText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setQaItems((prev) => prev.map((item) => (item.id === qaId ? data.item : item)));
        }
        setReplyText('');
        setReplyingToId(null);
      }
    } catch (err) {
      console.error('Error replying to question:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteQuestion = async (qaId: string) => {
    try {
      const res = await fetch(`/api/lesson-qa/${qaId}`, { method: 'DELETE' });
      if (res.ok) {
        setQaItems((prev) => prev.filter((i) => i.id !== qaId));
      }
    } catch (err) {
      console.error('Failed to delete question:', err);
    }
  };

  const handleAddTimestampNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const newNote: VideoTimestampNote = {
      id: `vnote_${Date.now()}`,
      courseId,
      lessonId,
      lessonTitle,
      timestampFormatted: noteTimestamp.trim() || '00:00',
      noteText: noteText.trim(),
      createdAt: new Date().toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updated = [newNote, ...localNotes];
    setLocalNotes(updated);
    setNoteText('');

    const storageKey = `motafalsifa_video_notes_${currentUser?.id || 'guest'}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    if (onUpdateUserNotes) {
      onUpdateUserNotes(updated);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    const updated = localNotes.filter((n) => n.id !== noteId);
    setLocalNotes(updated);
    const storageKey = `motafalsifa_video_notes_${currentUser?.id || 'guest'}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
    if (onUpdateUserNotes) {
      onUpdateUserNotes(updated);
    }
  };

  const lessonNotes = localNotes.filter(
    (n) => String(n.courseId) === String(courseId) && String(n.lessonId) === String(lessonId)
  );

  return (
    <div className="mt-6 rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 shadow-xl" dir="rtl">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <MessageSquarePlus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-white text-sm sm:text-base">
              أدوات المذاكرة التفاعلية للحصة: {lessonTitle}
            </h4>
            <p className="text-xs text-slate-400 font-bold">
              اسأل المستر والمساعدين مباشرة تحت الفيديو أو سجل ملاحظاتك الزمنية للمراجعة ليلة الامتحان
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubTab('qa')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'qa'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquarePlus className="w-4 h-4" />
            اسأل المستر ({qaItems.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('notes')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeSubTab === 'notes'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookmarkPlus className="w-4 h-4" />
            ملاحظاتي الزمنية ({lessonNotes.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ASK THE TEACHER (قسم اسأل المستر) */}
      {activeSubTab === 'qa' && (
        <div className="mt-5 space-y-5">
          {/* Ask Question Form */}
          <form
            onSubmit={handleAskQuestion}
            className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                عندك سؤال أو جزئية غير واضحة في هذه الحصة؟ اكتبها وسيجيبك المعلم أو المساعد العلمي:
              </span>
            </div>

            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={2}
              placeholder="اكتب سؤالك هنا بالتفصيل... (مثال: يا مستر في الدقيقة 14:30 لم أفهم الفرق بين الدعامة الفسيولوجية والتركيبية)"
              className="w-full rounded-xl bg-slate-900 border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-bold"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <input
                    type="text"
                    value={questionTimestamp}
                    onChange={(e) => setQuestionTimestamp(e.target.value)}
                    placeholder="الدقيقة (مثال 14:30)"
                    className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-28 font-bold"
                  />
                </div>

                <label className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300 cursor-pointer transition">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{questionImage ? 'تم إرفاق صورة المسألة ✓' : 'إرفاق صورة مسألة'}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>

                {questionImage && (
                  <button
                    type="button"
                    onClick={() => setQuestionImage('')}
                    className="text-xs text-rose-400 hover:underline font-bold"
                  >
                    إزالة الصورة
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingQuestion || !questionText.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingQuestion ? 'جاري الإرسال...' : 'إرسال السؤال للمستر'}
              </button>
            </div>
          </form>

          {/* Questions List */}
          {loadingQA ? (
            <div className="text-center py-6 text-xs text-slate-400 font-bold">
              جاري تحميل أسئلة ومناقشات الحصة...
            </div>
          ) : qaItems.length === 0 ? (
            <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800/60">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-black text-slate-300">لا توجد أسئلة بعد على هذه الحصة</p>
              <p className="text-xs text-slate-500 font-bold mt-1">
                كن أول من يطرح سؤاله ليستفيد جميع زملائك في الكورس!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {qaItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/85 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm">
                        {item.studentName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-white text-xs sm:text-sm">
                            {item.studentName}
                          </span>
                          {item.videoTimestamp && (
                            <button
                              type="button"
                              onClick={() => onSeekToTimestamp && onSeekToTimestamp(item.videoTimestamp!)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black hover:bg-amber-500/25 transition cursor-pointer"
                            >
                              <PlayCircle className="w-3 h-3" />
                              الدقيقة {item.videoTimestamp}
                            </button>
                          )}
                          {item.isResolved && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3" />
                              تم الرد من المعلم
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-bold">{item.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyingToId(replyingToId === item.id ? null : item.id)
                        }
                        className="flex items-center gap-1 text-xs font-black text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1.5 rounded-xl border border-indigo-500/20 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        {isStaff ? 'رد المعلم / المساعد' : 'إضافة رد'}
                      </button>

                      {(isStaff || currentUser?.id === item.studentId) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(item.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-slate-200 leading-relaxed pr-2">
                    {item.questionText}
                  </p>

                  {item.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={item.imageUrl}
                        alt="صورة السؤال"
                        className="max-h-56 rounded-xl border border-slate-700 object-contain"
                      />
                    </div>
                  )}

                  {/* Replies */}
                  {item.replies && item.replies.length > 0 && (
                    <div className="space-y-2 pr-4 border-r-2 border-emerald-500/40 mt-3">
                      {item.replies.map((rep) => {
                        const isTeacherReply =
                          rep.authorRole === 'teacher' ||
                          rep.authorRole === 'admin' ||
                          rep.authorRole === 'assistant';
                        return (
                          <div
                            key={rep.id}
                            className={`rounded-xl p-3 ${
                              isTeacherReply
                                ? 'bg-emerald-950/40 border border-emerald-500/30'
                                : 'bg-slate-900 border border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs text-white">
                                  {rep.authorName}
                                </span>
                                {isTeacherReply && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                                    <ShieldCheck className="w-3 h-3" />
                                    إجابة معتمدة
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold">
                                {rep.createdAt}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed">
                              {rep.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply Input Box */}
                  {replyingToId === item.id && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={
                          isStaff
                            ? 'اكتب الإجابة العلمية المعتمدة للطالب...'
                            : 'اكتب تعليقك أو إجابتك...'
                        }
                        className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-bold"
                      />
                      <button
                        type="button"
                        disabled={submittingReply || !replyText.trim()}
                        onClick={() => handleSendReply(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                      >
                        {submittingReply ? '...' : 'إرسال الرد'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VIDEO TIMESTAMP NOTES (ملاحظات الطالب الزمنية تحت الفيديو) */}
      {activeSubTab === 'notes' && (
        <div className="mt-5 space-y-4">
          <form
            onSubmit={handleAddTimestampNote}
            className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-3"
          >
            <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <BookmarkPlus className="w-4 h-4" />
              سجّل ملاحظاتك المهمة مع دقيقة الفيديو لتعود إليها فوراً ليلة الامتحان بضغطة زر:
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 sm:w-44">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  value={noteTimestamp}
                  onChange={(e) => setNoteTimestamp(e.target.value)}
                  placeholder="الدقيقة (14:30)"
                  className="bg-transparent text-xs text-white font-black focus:outline-none w-full"
                />
              </div>

              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="مثال: قانون هام جداً لحساب عدد الأربطة والفقرات في المسائل..."
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-bold"
              />

              <button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer shrink-0"
              >
                + حفظ الملاحظة الزمنية
              </button>
            </div>
          </form>

          {lessonNotes.length === 0 ? (
            <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800/60">
              <Clock className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
              <p className="text-sm font-black text-slate-300">لم تقم بتسجيل ملاحظات زمنية على هذا الفيديو بعد</p>
              <p className="text-xs text-slate-500 font-bold mt-1">
                اكتب الدقيقة والملاحظة بالأعلى لتسهيل المراجعة السريعة قبل الامتحان
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lessonNotes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start justify-between gap-3 bg-slate-950/90 border border-amber-500/25 rounded-2xl p-3.5 hover:border-amber-500/50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSeekToTimestamp && onSeekToTimestamp(note.timestampFormatted)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 transition cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        الدقيقة {note.timestampFormatted}
                      </button>
                      <span className="text-[11px] text-slate-500 font-bold">{note.createdAt}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed pt-1">
                      {note.noteText}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                    title="حذف الملاحظة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
