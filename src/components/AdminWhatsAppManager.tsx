import React, { useState, useEffect } from "react";
import { getIdToken } from "../auth";
import {
  Mail,
  ShieldCheck,
  Key,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  HelpCircle,
  Lock,
} from "lucide-react";

interface EmailConfigStatus {
  senderEmail: string;
  senderName: string;
  hasAppPassword: boolean;
  maskedAppPassword: string;
  dailyLimit: number;
  sentCountToday: number;
  remainingToday: number;
  updatedAt: string;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    toEmail: string;
    studentName: string;
    status: "sent" | "failed";
    error?: string;
  }>;
}

export const AdminWhatsAppManager: React.FC = () => {
  const [config, setConfig] = useState<EmailConfigStatus | null>(null);
  const [appPassword, setAppPassword] = useState("");
  const [senderName, setSenderName] = useState("منصة قلب العلم التعليمية");
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-admin-secret-key": "qalbalelm_supervisor_secret_2025",
    };
    try {
      const token = await getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {}
    return headers;
  };

  const fetchEmailConfig = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/email-config", { headers });
      const data = await res.json();
      if (data.success) {
        setConfig(data);
        if (data.senderName) setSenderName(data.senderName);
      }
    } catch (err) {
      console.error("Failed to fetch email config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPass = appPassword.replace(/\s+/g, "");
    if (!cleanPass || cleanPass.length < 8) {
      setErrorMsg("يرجى إدخال كلمة مرور التطبيقات (App Password) المكونة من 16 حرفاً الخاصة بحساب qalbalelm@gmail.com.");
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/email-config", {
        method: "POST",
        headers,
        body: JSON.stringify({
          appPassword: cleanPass,
          senderName: senderName.trim() || "منصة قلب العلم التعليمية",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || "تم حفظ وتفعيل كلمة مرور التطبيقات للبريد الرسمي qalbalelm@gmail.com بنجاح!");
        setAppPassword("");
        await fetchEmailConfig();
      } else {
        setErrorMsg(data.error || "تعذر حفظ إعدادات البريد الإلكتروني.");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم لحفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!testEmail.trim() || !testEmail.includes("@")) {
      setErrorMsg("يرجى إدخال بريد إلكتروني صحيح لتجربة إرسال رمز الاسترداد إليه.");
      return;
    }

    setTesting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/email-config/test", {
        method: "POST",
        headers,
        body: JSON.stringify({ testEmail: testEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message);
        await fetchEmailConfig();
      } else {
        setErrorMsg(data.error || "فشل إرسال البريد التجريبي.");
      }
    } catch {
      setErrorMsg("حدث خطأ أثناء إرسال البريد التجريبي.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="rounded-[32px] bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-lg">
              <Mail className="w-7 h-7 text-indigo-300" />
            </div>
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>تم إزالة الواتساب التلقائي نهائياً لحماية الأرقام من الحظر ✅</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                نظام استرداد كلمة السر عبر البريد الرسمي (qalbalelm@gmail.com)
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                يتم إرسال رمز الاسترداد (6 أرقام) للطلاب عند نسيان كلمة السر من البريد الحصري لمنصة قلب العلم{" "}
                <span className="font-mono font-bold text-amber-300" dir="ltr">
                  qalbalelm@gmail.com
                </span>
                .
              </p>
            </div>
          </div>

          {/* Daily Quota Counter */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-center">
              <span className="text-[11px] text-slate-300 font-bold block">الحد اليومي المجاني (Gmail)</span>
              <span className="text-xl font-black text-amber-300 font-mono">
                {config?.dailyLimit || 500} رسالة / يوم
              </span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-center">
              <span className="text-[11px] text-emerald-200 font-bold block">المتبقي اليوم</span>
              <span className="text-xl font-black text-white font-mono">
                {config ? config.remainingToday : 500} رسالة
              </span>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Setup Form & Test */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveConfig}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  تفعيل الإرسال من بريد qalbalelm@gmail.com
                </h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  config?.hasAppPassword
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-amber-100 text-amber-900 border border-amber-300"
                }`}
              >
                {config?.hasAppPassword ? "مفعل وجاهز للإرسال ✅" : "بانتظار كلمة مرور التطبيقات 🔑"}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  البريد الإلكتروني الرسمي للمنصة (خاص بقلب العلم فقط):
                </label>
                <input
                  type="email"
                  disabled
                  value="qalbalelm@gmail.com"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-black text-indigo-700 dark:text-indigo-300 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  كلمة مرور التطبيقات من جوجل (Google App Password - 16 حرفاً):
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder={
                      config?.hasAppPassword
                        ? `محفوظة حالياً (${config.maskedAppPassword}) - اكتب لتحديثها`
                        : "أدخل كلمة مرور التطبيقات المكونة من 16 حرفاً (مثال: abcd efgh ijkl mnop)"
                    }
                    className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-left bg-white dark:bg-slate-950"
                    dir="ltr"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  ملاحظة هامة: لا تكتب كلمة السر العادية للإيميل، بل اكتب <b>كلمة مرور التطبيقات (App Password)</b> المكونة من 16 حرفاً من إعدادات أمان جوجل.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ والتفعيل...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>حفظ وتفعيل كلمة مرور التطبيقات لبريد المنصة</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Test Email Form */}
          <form
            onSubmit={handleTestSend}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 shadow-xs space-y-4"
          >
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>تجربة إرسال رمز استرداد الآن</span>
            </h3>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="أدخل أي بريد إلكتروني لتجربة استلام الرمز عليه..."
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-left bg-slate-50 dark:bg-slate-950"
                dir="ltr"
              />
              <button
                type="submit"
                disabled={testing}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {testing ? "جاري الإرسال..." : "إرسال رمز تجريبي 📧"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Activation Steps & Daily Limit Guide */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-[28px] p-6 space-y-4">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-black text-sm">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              <span>المطلوب لتفعيل الإرسال من qalbalelm@gmail.com:</span>
            </div>

            <ol className="space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed list-decimal list-inside font-medium">
              <li>
                افتح حساب جوجل الخاص ببريد المنصة{" "}
                <b className="font-mono text-indigo-700 dark:text-indigo-300">qalbalelm@gmail.com</b> ثم ادخل إلى{" "}
                <b>إدارة حسابك على Google (Manage your Google Account)</b> ثم قسم <b>الأمان (Security)</b>.
              </li>
              <li>
                فعّل ميزة <b>التحقق بخطوتين (2-Step Verification)</b> على الحساب.
              </li>
              <li>
                من داخل صفحة الأمان (أو بالبحث في أعلى إعدادات الحساب عن <b>App passwords / كلمات مرور التطبيقات</b>)، أنشئ كلمة مرور تطبيق جديدة باسم <b>منصة قلب العلم</b>.
              </li>
              <li>
                سيعطيك جوجل كود مكون من <b>16 حرفاً</b>، انسخه والصقه في الخانة المجاورة واضغط <b>حفظ وتفعيل</b>.
              </li>
            </ol>

            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <span>فتح صفحة كلمات مرور التطبيقات في Google مباشرة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div className="pt-3 border-t border-indigo-200/70 dark:border-indigo-800 space-y-1.5 text-xs">
              <div className="font-black text-indigo-950 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>عدد الرسائل المسموح بإرسالها يومياً:</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                يتيح حساب Gmail المجاني (<span className="font-mono">qalbalelm@gmail.com</span>) إرسال حتى{" "}
                <b className="text-emerald-700 dark:text-emerald-400">500 رسالة بريد إلكتروني يومياً</b> مجاناً بالكامل، ويتجدد العداد تلقائياً كل 24 ساعة دون أي رسوم أو حظر.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
