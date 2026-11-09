import React, { useState, useEffect, useRef } from 'react';
import {
  Headset,
  Send,
  Search,
  Trash2,
  CheckCircle2,
  Phone,
  User as UserIcon,
  MessageSquare,
  RefreshCw,
  Image as ImageIcon,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { SupportChatTicket, SupportChatMessage } from '../types';
import { compressImageFile } from '../utils/imageUtils';
import { db, auth } from '../auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const AdminSupportChatTab: React.FC<{ adminName?: string }> = ({ adminName }) => {
  const [tickets, setTickets] = useState<SupportChatTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [attachedImage, setAttachedImage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/support-chat/tickets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.tickets)) {
          setTickets(data.tickets);
          if (!selectedTicketId && data.tickets.length > 0) {
            setSelectedTicketId(data.tickets[0].id);
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    setIsLoading(true);
    fetchTickets().finally(() => setIsLoading(false));
    const timer = setInterval(fetchTickets, 3500);

    let unsub: (() => void) | null = null;
    if (auth.currentUser) {
      try {
        const docRef = doc(db, 'al_motafalsifa_data', 'support_chats');
        unsub = onSnapshot(
          docRef,
          (snap) => {
            if (!snap.exists()) return;
            const cloudTickets: SupportChatTicket[] = snap.data()?.data || [];
            if (Array.isArray(cloudTickets) && cloudTickets.length > 0) {
              const sorted = [...cloudTickets].sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
              setTickets(sorted);
            }
          },
          () => {}
        );
      } catch {}
    }

    return () => {
      clearInterval(timer);
      if (unsub) unsub();
    };
  }, []);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  useEffect(() => {
    if (selectedTicket && selectedTicket.unreadByAdmin > 0) {
      fetch('/api/support-chat/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selectedTicket.id, readerRole: 'admin' }),
      }).catch(() => {});
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicketId, selectedTicket?.messages?.length]);

  const syncListToCloud = async (updatedList: SupportChatTicket[]) => {
    try {
      const docRef = doc(db, 'al_motafalsifa_data', 'support_chats');
      await setDoc(docRef, { data: updatedList, updatedAt: new Date().toISOString() }, { merge: true });
    } catch {}
  };

  const handleAdminSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || (!replyText.trim() && !attachedImage) || isSending) return;

    const textToSend = replyText.trim();
    const imgToSend = attachedImage;
    setReplyText('');
    setAttachedImage('');
    setIsSending(true);

    try {
      const res = await fetch('/api/support-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          studentName: selectedTicket.studentName,
          studentPhone: selectedTicket.studentPhone,
          sender: 'admin',
          senderName: adminName || 'إدارة المنصة - الدعم الفني',
          text: textToSend,
          imageUrl: imgToSend || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.ticket) {
        const nextList = tickets.map((t) => (t.id === data.ticket.id ? data.ticket : t));
        setTickets(nextList);
        syncListToCloud(nextList);
      } else {
        const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const nowMs = Date.now();
        const newMsg: SupportChatMessage = {
          id: `msg_${nowMs}`,
          sender: 'admin',
          senderName: 'إدارة المنصة - الدعم الفني',
          text: textToSend,
          imageUrl: imgToSend || undefined,
          timestamp: nowStr,
          createdAtMs: nowMs,
        };
        const updatedTicket: SupportChatTicket = {
          ...selectedTicket,
          unreadByAdmin: 0,
          unreadByStudent: (selectedTicket.unreadByStudent || 0) + 1,
          lastMessageText: textToSend || '📷 صورة مرفقة',
          lastMessageAt: nowStr,
          updatedAtMs: nowMs,
          messages: [...(selectedTicket.messages || []), newMsg],
        };
        const nextList = tickets.map((t) => (t.id === updatedTicket.id ? updatedTicket : t));
        setTickets(nextList);
        syncListToCloud(nextList);
      }
    } catch {} finally {
      setIsSending(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm('هل تريد حذف هذه المحادثة نهائياً؟')) return;
    try {
      await fetch(`/api/support-chat/ticket/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
      const nextList = tickets.filter((t) => t.id !== ticketId);
      setTickets(nextList);
      syncListToCloud(nextList);
      if (selectedTicketId === ticketId) {
        setSelectedTicketId(nextList[0]?.id || null);
      }
    } catch {}
  };

  const filteredTickets = tickets.filter(
    (t) =>
      t.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.studentPhone?.includes(searchQuery)
  );

  const totalUnread = tickets.reduce((acc, t) => acc + (t.unreadByAdmin || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-[32px] p-6 text-white shadow-xl border border-indigo-800/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
            <Headset className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black">غرفة رسائل الدعم الفني المباشر مع الطلاب</h2>
              {totalUnread > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black">
                  {totalUnread} رسائل جديدة
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              استقبل رسائل الطلاب مع أسمائهم وأرقام هواتفهم وقم بالرد المباشر عليهم في نفس اللحظة
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchTickets}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث المحادثات</span>
        </button>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm min-h-[620px]">
        {/* Right Sidebar: Students List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الطالب أو رقم الهاتف..."
                className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px]">
            {filteredTickets.length === 0 ? (
              <div className="p-10 text-center space-y-2 text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-bold">لا توجد محادثات دعم فني حتى الآن</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = ticket.id === selectedTicket?.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`p-4 cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-r-4 border-indigo-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {ticket.studentName}
                        </span>
                        {ticket.unreadByAdmin > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                            {ticket.unreadByAdmin} جديد
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-indigo-600 dark:text-amber-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{ticket.studentPhone}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{ticket.lastMessageText}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-bold">{ticket.lastMessageAt}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTicket(ticket.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="حذف المحادثة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Left Main Area: Active Conversation */}
        <div className="lg:col-span-8 flex flex-col bg-slate-50/60 dark:bg-slate-950/50">
          {selectedTicket ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      {selectedTicket.studentName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                      <span className="font-mono text-indigo-600 dark:text-amber-400">
                        📱 {selectedTicket.studentPhone}
                      </span>
                      {selectedTicket.schoolYear && <span>🎓 {selectedTicket.schoolYear}</span>}
                    </div>
                  </div>
                </div>

                <a
                  href={`https://wa.me/2${selectedTicket.studentPhone.replace(/^0/, '0')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>فتح واتساب الطالب</span>
                </a>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[430px]">
                {(selectedTicket.messages || []).map((msg) => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                          {isAdmin ? '🛡️ إدارة المنصة (أنت)' : `👤 الطالب: ${selectedTicket.studentName}`}
                        </span>
                        <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                      </div>
                      <div
                        className={`max-w-[80%] rounded-3xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-xs space-y-2 ${
                          isAdmin
                            ? 'bg-indigo-600 text-white rounded-tr-md'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-tl-md'
                        }`}
                      >
                        {msg.imageUrl && (
                          <div className="rounded-2xl overflow-hidden max-h-72 flex justify-center bg-black/10">
                            <img src={msg.imageUrl} alt="مرفق" className="max-h-72 object-contain" />
                          </div>
                        )}
                        {msg.text && <p className="whitespace-pre-line font-semibold">{msg.text}</p>}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {attachedImage && (
                <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                  <img src={attachedImage} alt="preview" className="w-12 h-12 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachedImage('')}
                    className="text-xs font-black text-rose-600 cursor-pointer"
                  >
                    إزالة الصورة ✕
                  </button>
                </div>
              )}

              {/* Admin Reply Box */}
              <form
                onSubmit={handleAdminSendReply}
                className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <label
                  className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 cursor-pointer shrink-0"
                  title="إرفاق صورة للطالب"
                >
                  <ImageIcon className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        compressImageFile(file, 1000, 0.78).then((b64) => {
                          if (b64) setAttachedImage(b64);
                        });
                      }
                    }}
                  />
                </label>

                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`اكتب رد الإدارة على الطالب ${selectedTicket.studentName}...`}
                  className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-bold"
                />

                <button
                  type="submit"
                  disabled={isSending || (!replyText.trim() && !attachedImage)}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <span>إرسال الرد</span>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
              <Headset className="w-12 h-12 text-indigo-400 opacity-60" />
              <p className="text-sm font-black text-slate-600 dark:text-slate-300">
                اختر محادثة طالب من القائمة الجانبية لعرض الرسائل والرد المباشر عليه
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
