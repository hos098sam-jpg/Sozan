import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  RefreshCw,
  HelpCircle,
  BookOpen,
  GraduationCap,
  Zap,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { ChatMessage, BacBranch } from '../types';

interface FloatingAITutorProps {
  branch: BacBranch;
  supervisorName: string;
}

export const FloatingAITutor: React.FC<FloatingAITutorProps> = ({
  branch,
  supervisorName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-floating',
      role: 'assistant',
      content: `أهلاً بك يا بطل! 👋 أنا مساعدك الأكاديمي الذكي المتاح 24/7 تحت إشراف ${supervisorName}.\nكيف يمكنني مساعدتك اليوم؟ (شرح مسألة، استفسار عن قانون، أو توضيح خطوات الحل النموذجي)`,
      timestamp: 'الآن',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          branch,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('API failed');
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'عذراً، حدث خطأ أثناء معالجة استفسارك. يرجى المحاولة مرة أخرى أو مراجعة المشرف.',
        timestamp: 'الآن',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'اشرح لي قانون قوة الإرجاع في النواس المرن',
    'كيف أتعامل مع حالات عدم التعيين (0/0)؟',
    'ما هي خطوات كتابة الموضوع الفلسفي للدرجة التامة؟',
  ];

  return (
    <div className="fixed bottom-5 left-5 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all border border-indigo-400/30 animate-bounce hover:animate-none"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-right">
            <div className="text-xs font-black">المساعد الذكي 24/7</div>
            <div className="text-[10px] text-indigo-200 font-bold">إشراف إدارة المنصة</div>
          </div>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full animate-ping" />
        </button>
      )}

      {/* Expandable Chat Window */}
      {isOpen && (
        <div className="bg-white border border-slate-200 rounded-[32px] w-[92vw] sm:w-[420px] h-[550px] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white">المساعد الذكي للبكالوريا والامتحانات</h4>
                <p className="text-[10px] text-slate-300 font-medium">إشراف: {supervisorName}</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-start flex-row-reverse' : 'justify-start'}`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {msg.role === 'user' ? 'أنا' : 'AI'}
                </div>

                <div
                  className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-tl-xs'
                  }`}
                >
                  {msg.content}
                  <span className={`text-[9px] block mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري التفكير وصياغة الحل النموذجي...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => setInput(q)}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك الأكاديمي هنا..."
              className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-50 shadow-xs shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
