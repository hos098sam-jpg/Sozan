import React, { useState, useEffect, useRef } from 'react';
import {
  Headset,
  MessageCircle,
  Send,
  X,
  User as UserIcon,
  Phone,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Image as ImageIcon,
  CheckCheck,
  Minimize2,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { User, SupportChatTicket, SupportChatMessage } from '../types';
import { compressImageFile } from '../utils/imageUtils';
import { db, auth } from '../auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

interface FloatingSupportChatProps {
  currentUser: User | null;
  platformName?: string;
  onOpenAdminSupport?: () => void;
}

const STORAGE_SUPPORT_USER_KEY = 'qalb_alam_support_guest_info';

export const FloatingSupportChat: React.FC<FloatingSupportChatProps> = ({
  currentUser,
  platformName = 'منصة المتفلسفة ',
  onOpenAdminSupport,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpandedFullPage, setIsExpandedFullPage] = useState(false);
  const [step, setStep] = useState<'form' | 'chat'>('form');

  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const [activeTicket, setActiveTicket] = useState<SupportChatTicket | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Pre-fill name & phone from saved session or currentUser
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_SUPPORT_USER_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.name) setStudentName(parsed.name);
        if (parsed.phone) setStudentPhone(parsed.phone);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (!studentName && currentUser.name) setStudentName(currentUser.name);
      if (!studentPhone && currentUser.phone) setStudentPhone(currentUser.phone);
    }
  }, [currentUser]);

  const normalizePhone = (raw: string) =>
    String(raw || '')
      .replace(/\s+/g, '')
      .replace(/[^0-9+]/g, '')
      .replace(/^\+?20/, '0');

  // Poll / Sync active ticket in real-time when chat is active or saved phone exists
  useEffect(() => {
    const cleanPhone = normalizePhone(studentPhone);
    if (!cleanPhone || cleanPhone.length < 8) return;

    const ticketId = `support_${cleanPhone}`;
    let isMounted = true;

    const fetchLatestTicket = async () => {
      try {
        const res = await fetch(`/api/support-chat/ticket/${encodeURIComponent(ticketId)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.ticket) {
            setActiveTicket(data.ticket);
            if (!isOpen) {
              setUnreadCount(data.ticket.unreadByStudent || 0);
            } else if (step === 'chat' && data.ticket.unreadByStudent > 0) {
              setUnreadCount(0);
              fetch('/api/support-chat/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId: data.ticket.id, readerRole: 'student' }),
              }).catch(() => {});
            }
          }
        }
      } catch {}
    };

    fetchLatestTicket();
    const interval = setInterval(fetchLatestTicket, 3500);

    // Only subscribe to Firestore support_chats doc if authenticated as admin/teacher
    let unsubFirestore: (() => void) | null = null;
    const isPrivileged =
      Boolean(auth.currentUser) &&
      (currentUser?.role === 'admin' ||
        currentUser?.role === 'teacher' ||
        auth.currentUser?.email === 'hos098sam@gmail.com');

    if (isPrivileged) {
      try {
        const docRef = doc(db, 'al_motafalsifa_data', 'support_chats');
        unsubFirestore = onSnapshot(
          docRef,
          (snap) => {
            if (!snap.exists() || !isMounted) return;
            const allTickets: SupportChatTicket[] = snap.data()?.data || [];
            if (Array.isArray(allTickets)) {
              const matched = allTickets.find(
                (t) => t.id === ticketId || normalizePhone(t.studentPhone) === cleanPhone
              );
              if (matched) {
                setActiveTicket(matched);
                if (!isOpen) {
                  setUnreadCount(matched.unreadByStudent || 0);
                }
              }
            }
          },
          () => {}
        );
      } catch {}
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (unsubFirestore) unsubFirestore();
    };
  }, [studentPhone, isOpen, step, currentUser?.role]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && step === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.messages?.length, isOpen, step]);

  const syncTicketToFirestoreCloud = async (updatedTicket: SupportChatTicket) => {
    const isPrivileged =
      Boolean(auth.currentUser) &&
      (currentUser?.role === 'admin' ||
        currentUser?.role === 'teacher' ||
        auth.currentUser?.email === 'hos098sam@gmail.com');
    if (!isPrivileged) return;
    try {
      const docRef = doc(db, 'al_motafalsifa_data', 'support_chats');
      const snap = await getDoc(docRef);
      let list: SupportChatTicket[] = [];
      if (snap.exists() && Array.isArray(snap.data()?.data)) {
        list = snap.data()?.data;
      }
      const existsIdx = list.findIndex((t) => t.id === updatedTicket.id);
      if (existsIdx >= 0) {
        list[existsIdx] = updatedTicket;
      } else {
        list = [updatedTicket, ...list];
      }
      await setDoc(docRef, { data: list, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {}
  };

  const handleStartSupportChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = studentName.trim();
    const cleanPhone = normalizePhone(studentPhone);

    if (!cleanName || cleanName.length < 2) {
      setFormError('يرجى كتابة اسمك بالكامل بشكل صحيح');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      setFormError('يرجى كتابة رقم هاتف صحيح مكون من 11 رقم');
      return;
    }

    setIsSubmittingForm(true);
    try {
      localStorage.setItem(
        STORAGE_SUPPORT_USER_KEY,
        JSON.stringify({ name: cleanName, phone: cleanPhone })
      );

      const res = await fetch('/api/support-chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: cleanName,
          studentPhone: cleanPhone,
          studentId: currentUser?.id,
          schoolYear: currentUser?.schoolYear,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.ticket) {
        setActiveTicket(data.ticket);
        syncTicketToFirestoreCloud(data.ticket);
        setStep('chat');
        setUnreadCount(0);
      } else {
        // Fallback offline/client ticket creation if server is unreachable
        const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const nowMs = Date.now();
        const fallbackTicket: SupportChatTicket = {
          id: `support_${cleanPhone}`,
          studentName: cleanName,
          studentPhone: cleanPhone,
          studentId: currentUser?.id,
          schoolYear: currentUser?.schoolYear,
          status: 'open',
          unreadByAdmin: 0,
          unreadByStudent: 0,
          lastMessageText: `مرحباً بك يا ${cleanName} في خدمة الدعم الفني المباشر`,
          lastMessageAt: nowStr,
          updatedAtMs: nowMs,
          messages: [
            {
              id: `msg_${nowMs}`,
              sender: 'admin',
              senderName: 'إدارة المنصة - الدعم الفني',
              text: `مرحباً بك يا ${cleanName} في خدمة الدعم الفني المباشر لـ ${platformName} 👋\nاكتب رسالتك أو استفسارك هنا وسترد عليك الإدارة مباشرة.`,
              timestamp: nowStr,
              createdAtMs: nowMs,
            },
          ],
        };
        setActiveTicket(fallbackTicket);
        syncTicketToFirestoreCloud(fallbackTicket);
        setStep('chat');
      }
    } catch {
      setFormError('حدث خطأ أثناء فتح المحادثة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !attachedImage) || !activeTicket || isSending) return;

    const textToSend = messageInput.trim();
    const imgToSend = attachedImage;
    setMessageInput('');
    setAttachedImage('');
    setIsSending(true);

    try {
      const res = await fetch('/api/support-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          studentName: activeTicket.studentName,
          studentPhone: activeTicket.studentPhone,
          sender: 'student',
          senderName: activeTicket.studentName,
          text: textToSend,
          imageUrl: imgToSend || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.ticket) {
        setActiveTicket(data.ticket);
        syncTicketToFirestoreCloud(data.ticket);
      } else {
        const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const nowMs = Date.now();
        const newMsg: SupportChatMessage = {
          id: `msg_${nowMs}`,
          sender: 'student',
          senderName: activeTicket.studentName,
          text: textToSend,
          imageUrl: imgToSend || undefined,
          timestamp: nowStr,
          createdAtMs: nowMs,
        };
        const updated: SupportChatTicket = {
          ...activeTicket,
          unreadByAdmin: (activeTicket.unreadByAdmin || 0) + 1,
          lastMessageText: textToSend || '📷 صورة مرفقة',
          lastMessageAt: nowStr,
          updatedAtMs: nowMs,
          messages: [...(activeTicket.messages || []), newMsg],
        };
        setActiveTicket(updated);
        syncTicketToFirestoreCloud(updated);
      }
    } catch {} finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* FLOATING COMPACT SUPPORT BUTTON AT BOTTOM-RIGHT OF PLATFORM */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end" dir="rtl">
          <button
            type="button"
            onClick={() => {
              if (currentUser?.role === 'admin' && onOpenAdminSupport) {
                onOpenAdminSupport();
                return;
              }
              setIsOpen(true);
              setUnreadCount(0);
            }}
            className="group relative flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-indigo-950 via-indigo-800 to-amber-500 text-white shadow-xl shadow-indigo-950/40 border border-amber-400/70 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
          >
            {/* Icon Container */}
            <div className="relative w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs shrink-0 group-hover:rotate-6 transition-transform">
              <Headset className="w-4 h-4 stroke-[2.5]" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
            </div>

            {/* Label */}
            <span className="font-black text-[11px] sm:text-xs tracking-wide text-white pl-0.5">
              الدعم الفني المباشر
            </span>

            {/* Unread Notification Badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border border-white shadow-md animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* COMPACT POPUP WIDGET OR EXPANDED FULL PAGE */}
      {isOpen && (
        <div
          className={
            isExpandedFullPage
              ? 'fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn'
              : 'fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[370px] animate-fadeIn'
          }
          dir="rtl"
          onClick={(e) => {
            if (isExpandedFullPage && e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            className={`bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
              isExpandedFullPage
                ? 'w-full max-w-4xl h-[90vh] sm:h-[85vh] rounded-3xl'
                : step === 'chat'
                ? 'w-full h-[460px] max-h-[80vh] rounded-3xl'
                : 'w-full rounded-3xl'
            }`}
          >
            {/* Top Header with Clear Expand/Minimize & Close Buttons */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-indigo-900/50 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                  <Headset className="w-4 h-4" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-xs sm:text-sm text-white truncate">
                      الدعم الفني المباشر
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black shrink-0">
                      متصل
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate">
                    {step === 'form'
                      ? 'اكتب اسمك ورقمك لبدء الدردشة'
                      : `${activeTicket?.studentName} • ${activeTicket?.studentPhone}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {step === 'chat' && (
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 text-[10px] font-black transition-colors cursor-pointer"
                    title="تعديل الاسم أو الرقم"
                  >
                    بياناتي
                  </button>
                )}

                {/* Expand / Shrink Button (Visible on all screens) */}
                <button
                  type="button"
                  onClick={() => setIsExpandedFullPage(!isExpandedFullPage)}
                  className="px-2 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                  title={isExpandedFullPage ? 'تصغير النافذة' : 'تكبير النافذة'}
                >
                  {isExpandedFullPage ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>تصغير</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>تكبير</span>
                    </>
                  )}
                </button>

                {/* Easy Close / Dismiss Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsExpandedFullPage(false);
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="إغلاق نافذة الدعم"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إغلاق</span>
                </button>
              </div>
            </div>

            {/* STEP 1: STUDENT NAME & PHONE ENTRY SCREEN */}
            {step === 'form' ? (
              <form onSubmit={handleStartSupportChat} className="p-4 sm:p-5 space-y-3.5">
                <div className="text-center space-y-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    تواصل مباشر مع إدارة المنصة
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    أدخل اسمك ورقم هاتفك للدخول إلى الدردشة مع الدعم الفني
                  </p>
                </div>

                {formError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-bold text-center">
                    {formError}
                  </div>
                )}

                <div className="space-y-3">
                  {/* Name Field */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1">
                      اسم الطالب <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="اكتب اسمك هنا..."
                        className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <UserIcon className="w-4 h-4 text-indigo-600 dark:text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1">
                      رقم الهاتف <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        placeholder="010xxxxxxxx"
                        dir="ltr"
                        className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-black font-mono text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{isSubmittingForm ? 'جاري الفتح...' : 'بدء المحادثة مع الدعم الفني'}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              /* STEP 2: COMPACT OR EXPANDED CHAT VIEW */
              <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
                {/* Messages Scroll Container */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                  {(activeTicket?.messages || []).map((msg) => {
                    const isStudent = msg.sender === 'student';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isStudent ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">
                            {isStudent ? `${msg.senderName} (أنت)` : '🛡️ الدعم الفني'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">{msg.timestamp}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs space-y-1.5 ${
                            isStudent
                              ? 'bg-indigo-600 text-white rounded-tr-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                          }`}
                        >
                          {msg.imageUrl && (
                            <div className="rounded-xl overflow-hidden border border-white/20 bg-black/20 max-h-56 flex justify-center">
                              <img
                                src={msg.imageUrl}
                                alt="مرفق"
                                className="max-h-56 object-contain"
                              />
                            </div>
                          )}
                          {msg.text && <p className="whitespace-pre-line font-semibold">{msg.text}</p>}
                          {isStudent && (
                            <div className="flex justify-end">
                              <CheckCheck className="w-3 h-3 text-indigo-200" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Attached Image Preview */}
                {attachedImage && (
                  <div className="px-3 py-1.5 bg-indigo-50 dark:bg-slate-900 border-t border-indigo-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={attachedImage}
                        alt="preview"
                        className="w-9 h-9 rounded-lg object-cover border border-indigo-300"
                      />
                      <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                        صورة جاهزة للإرسال
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedImage('')}
                      className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black cursor-pointer"
                    >
                      حذف ✕
                    </button>
                  </div>
                )}

                {/* Bottom Message Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0"
                >
                  {/* Attach Image Button */}
                  <label
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                    title="إرفاق صورة"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImageFile(file, 1000, 0.78).then((base64) => {
                            if (base64) setAttachedImage(base64);
                          });
                        }
                      }}
                    />
                  </label>

                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="اكتب رسالتك للدعم..."
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    type="submit"
                    disabled={isSending || (!messageInput.trim() && !attachedImage)}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    <span>إرسال</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
