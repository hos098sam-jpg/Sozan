import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Copy, 
  Check, 
  Trash2, 
  BookOpen, 
  HelpCircle, 
  Award,
  AlertCircle
} from 'lucide-react';
import { BacBranch, ChatMessage, SubjectInfo } from '../types';
import { BAC_SUBJECTS, QUICK_TUTOR_SUGGESTIONS, IDENTITY_NOTICE } from '../data/bacData';
import ReactMarkdown from 'react-markdown';

interface ChatTutorProps {
  branch: BacBranch;
  onShowIdentityModal: () => void;
}

export const ChatTutor: React.FC<ChatTutorProps> = ({ branch, onShowIdentityModal }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `مرحباً بك يا بطل البكالوريا 2027! 🌟\n\nأنا **"منصة طلاب البكالوريا 2027"**، مساعدك الذكي لشهادة البكالوريا، تم تطويري وتحت إشراف **إدارة المنصة**.\n\nكيف يمكنني مساعدتك اليوم؟ يمكنك سؤالي عن:\n1. **شرح الدروس** بأسلوب مبسط ومقسم إلى خطوات.\n2. **تلخيص القوانين والأفكار الأساسية** بدون حشو.\n3. **حل المسائل** والتمارين خطوة بخطوة.\n4. **اختبارات تجريبية** مع الحل النموذجي المعتمد.`,
      timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter subjects based on active branch
  const availableSubjects = BAC_SUBJECTS.filter(
    (s) => s.branch === branch || s.branch === 'both'
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const checkIdentityQuestion = (msgText: string): boolean => {
    const keywords = ['من أنت', 'من انت', 'هويتك', 'من صنعك', 'من طورك', 'من صممك', 'من المطور', 'اسمك ايه', 'ما اسمك', 'إدارة المنصة', 'إدارة المنصة'];
    return keywords.some((k) => msgText.includes(k));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    setErrorMsg(null);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }),
      subject: selectedSubject !== 'all' ? selectedSubject : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInput('');

    // Check if user is asking about identity -> give instant official answer
    if (checkIdentityQuestion(textToSend)) {
      setTimeout(() => {
        const identityResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `أنا **"منصة طلاب البكالوريا 2027"**، مساعدك الذكي لشهادة البكالوريا، تم تطويري وتحت إشراف **إدارة المنصة**.\n\nأنا هنا لأقدم لك:\n- إجابات دقيقة وعلمية وفق المناهج المعتمدة (الفرع العلمي والأدبي).\n- شرحاً مبسطاً في خطوات ونقاط واضحة.\n- تلخيصاً للأفكار الأساسية والقوانين الرئيسية دون حشو.\n- اختبارات تحاكي الامتحانات الرسمية مع الحلول النموذجية.\n- دعماً نفسياً وتحفيزاً دائماً لتتجاوز التوتر وتبلغ التفوق! 🌟`,
          timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }),
          isIdentityAnswer: true,
        };
        setMessages((prev) => [...prev, identityResponse]);
      }, 400);
      return;
    }

    setIsLoading(true);

    try {
      const selectedSubjectObj = BAC_SUBJECTS.find((s) => s.id === selectedSubject);
      const subjectName = selectedSubjectObj ? selectedSubjectObj.name : 'عامة / شاملة';

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          branch: branch === 'scientific' ? 'الفرع العلمي' : 'الفرع الأدبي',
          subject: subjectName,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء التواصل مع الخادم.');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat Error:', err);
      setErrorMsg(err.message || 'تعذر الوصول لخدمة الشرح الذكي. يرجى المحاولة لاحقاً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('هل تريد مسح محادثة الشرح والبدء بمحادثة جديدة؟')) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `تم مسح المحادثة السابقة يا بطل البكالوريا 2027! 🌟\n\nأنا **"منصة طلاب البكالوريا 2027"**، مساعدك الذكي لشهادة البكالوريا، تم تطويري وتحت إشراف **إدارة المنصة**.\n\nتفضل بطرح سؤالك في أي مادة تريدها!`,
          timestamp: new Date().toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] min-h-[600px] max-w-7xl mx-auto p-4 gap-4">
      
      {/* Top filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-black text-slate-800">اختر مادة الشرح:</span>
          
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="all">🌐 كل المواد (شامل)</option>
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShowIdentityModal}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Award className="w-3.5 h-3.5 text-indigo-600" />
            <span>إشراف: إدارة المنصة</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-slate-200 transition-colors"
            title="مسح المحادثة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chat Messages Display */}
      <div className="flex-1 overflow-y-auto bg-white/60 border border-slate-200/80 rounded-3xl p-4 sm:p-6 space-y-4 shadow-inner">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 max-w-4xl ${
              m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-indigo-600 text-white shadow-indigo-200'
              }`}
            >
              {m.role === 'user' ? (
                <User className="w-5 h-5" />
              ) : (
                <Bot className="w-5 h-5" />
              )}
            </div>

            {/* Bubble content */}
            <div
              className={`relative group rounded-3xl p-4 sm:p-5 shadow-sm ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}
            >
              {/* Header inside bubble for assistant */}
              {m.role === 'assistant' && (
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-indigo-600">
                      بكالوريا 2027
                    </span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">
                      إشراف إدارة المنصة
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(m.content, m.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="نسخ الشرح"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Message text / Markdown */}
              <div className="markdown-body text-sm sm:text-base leading-relaxed space-y-2">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>

              {/* Timestamp */}
              <div className="mt-2 text-[11px] text-slate-400 text-left">
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 mr-auto max-w-md animate-pulse">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-none p-4 text-slate-600 text-sm flex items-center gap-2 shadow-sm">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>جاري صياغة شرح مبسط ومنظم وفق المنهج المعتمد...</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Question Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs font-black text-slate-500 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>أسئلة شائعة في البكالوريا:</span>
        </span>
        {QUICK_TUTOR_SUGGESTIONS.filter(
          (s) => s.branch === branch || s.branch === 'both'
        ).map((sug, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(sug.prompt)}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-bold whitespace-nowrap transition-all hover:border-indigo-500/50 shrink-0 shadow-sm"
          >
            {sug.title}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`اسأل في ${
              selectedSubject === 'all'
                ? 'أي مادة للبكالوريا 2027 (شرح، تلخيص، قوانين، حلول)...'
                : BAC_SUBJECTS.find((s) => s.id === selectedSubject)?.name
            }`}
            disabled={isLoading}
            className="flex-1 bg-transparent px-4 py-3 text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-indigo-200 shrink-0"
            aria-label="إرسال"
          >
            <Send className="w-5 h-5 rotate-180" />
          </button>
        </div>
      </div>

    </div>
  );
};
