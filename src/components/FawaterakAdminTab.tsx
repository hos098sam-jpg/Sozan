import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Wallet,
  Tag,
  Percent,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  Search,
  Filter,
  Users
} from 'lucide-react';
import { Coupon, FawaterakInvoice, Course, User } from '../types';

interface FawaterakAdminTabProps {
  courses: Course[];
  students: User[];
}

export const FawaterakAdminTab: React.FC<FawaterakAdminTabProps> = ({ courses, students }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [invoices, setInvoices] = useState<FawaterakInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // New Coupon Form States
  const [showAddCoupon, setShowAddCoupon] = useState<boolean>(false);
  const [newCode, setNewCode] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [newDiscountValue, setNewDiscountValue] = useState<number>(20);
  const [newMaxUses, setNewMaxUses] = useState<string>('500');
  const [newExpiresAt, setNewExpiresAt] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [couponSubmitting, setCouponSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Search in invoices
  const [searchInvoice, setSearchInvoice] = useState('');

  // Official Production Platform Domain & Activation URLs
  const primaryPlatformUrl = 'https://motafalsifa.vercel.app';
  const webhookUrl = `${primaryPlatformUrl}/api/fawaterak/webhook`;
  const successUrl = `${primaryPlatformUrl}/api/fawaterak/callback?status=paid`;
  const pendingUrl = `${primaryPlatformUrl}/api/fawaterak/callback?status=pending`;
  const failUrl = `${primaryPlatformUrl}/api/fawaterak/callback?status=failed`;
  const cancelUrl = `${primaryPlatformUrl}/api/fawaterak/cancel`;
  const refundUrl = `${primaryPlatformUrl}/api/fawaterak/refund`;
  const failedWebhookUrl = `${primaryPlatformUrl}/api/fawaterak/failed`;
  const hashVerifyUrl = `${primaryPlatformUrl}/api/fawaterak/hash-verify`;

  // Key Management State
  const [fawaterakApiKeyInput, setFawaterakApiKeyInput] = useState('');
  const [fawaterakProviderKeyInput, setFawaterakProviderKeyInput] = useState('FAWATERAK.30884');
  const [isUpdatingKeys, setIsUpdatingKeys] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; text?: string; success?: boolean } | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fawaterakApiKeyInput.trim()) {
      setFeedback({ text: 'الرجاء إدخال مفتاح الـ API الخاص بفواتيرك (API Key / Hash Key)', type: 'error' });
      return;
    }
    setIsUpdatingKeys(true);
    try {
      const res = await fetch('/api/fawaterak/update-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashKey: fawaterakApiKeyInput.trim(),
          providerKey: fawaterakProviderKeyInput.trim() || 'FAWATERAK.30884',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ text: 'تم حفظ وتحديث مفاتيح بوابة فواتيرك بنجاح! 🚀', type: 'success' });
        setFawaterakApiKeyInput('');
      } else {
        throw new Error(data.error || 'فشل تحديث المفاتيح');
      }
    } catch (err: any) {
      setFeedback({ text: err.message || 'فشل حفظ المفاتيح', type: 'error' });
    } finally {
      setIsUpdatingKeys(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/fawaterak/activation-info');
      const data = await res.json();
      if (res.ok) {
        setTestStatus({
          loading: false,
          success: true,
          text: `تم فحص البوابة بنجاح! الروابط معتمدة على نطاق: ${data.platformUrl} ومفتاح التأمين: ${data.config?.hashKeyMasked}`,
        });
      } else {
        throw new Error(data.error || 'فشل الاتصال');
      }
    } catch (err: any) {
      setTestStatus({ loading: false, success: false, text: err.message || 'فشل الاتصال بالبوابة' });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [couponsRes, invoicesRes] = await Promise.all([
        fetch('/api/coupons'),
        fetch('/api/fawaterak/invoices'),
      ]);

      if (couponsRes.ok) {
        const cData = await couponsRes.json();
        setCoupons(cData.coupons || []);
      }

      if (invoicesRes.ok) {
        const iData = await invoicesRes.json();
        setInvoices(iData.invoices || []);
      }
    } catch (err) {
      console.warn('Error fetching fawaterak data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      setFeedback({ text: 'الرجاء إدخال كود الخصم', type: 'error' });
      return;
    }
    setCouponSubmitting(true);
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          discountType: newDiscountType,
          discountValue: Number(newDiscountValue),
          maxUses: newMaxUses ? Number(newMaxUses) : undefined,
          expiresAt: newExpiresAt || undefined,
          note: newNote,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ text: `تم إنشاء كود الخصم (${newCode.toUpperCase()}) بنجاح!`, type: 'success' });
        setNewCode('');
        setNewNote('');
        setShowAddCoupon(false);
        fetchData();
      } else {
        setFeedback({ text: data.error || 'فشل إنشاء الكوبون', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ text: 'حدث خطأ في الاتصال بالسيرفر', type: 'error' });
    } finally {
      setCouponSubmitting(false);
    }
  };

  const handleToggleCoupon = async (code: string) => {
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(code)}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchData();
      }
    } catch {}
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!confirm(`هل أنت متأكد من حذف كود الخصم (${code})؟`)) return;
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch {}
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchInvoice.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.studentName.toLowerCase().includes(q) ||
      inv.studentPhone.includes(q) ||
      inv.courseTitle.toLowerCase().includes(q) ||
      String(inv.invoiceId).includes(q)
    );
  });

  const totalPaidRevenue = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.finalAmount || 0), 0);

  return (
    <div className="space-y-8 animate-fadeIn text-right">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-white font-bold text-xs sm:text-sm flex items-center justify-between shadow-lg ${
            feedback.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-white hover:opacity-80">
            ×
          </button>
        </div>
      )}

      {/* Header & Integration Credentials Card */}
      <div className="p-6 sm:p-8 rounded-[32px] bg-slate-900 text-white shadow-xl space-y-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black">
                <CreditCard className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black">
                بوابة دفع فواتيرك (Fawaterak) وأكواد الخصم
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              إدارة تكامل الدفع الإلكتروني (فودافون كاش، محافظ، فيزا)، روابط الـ Webhook، وأكواد الخصم الترويجية.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all flex items-center gap-2 self-start cursor-pointer border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>

        {/* Integration Credentials & Webhook URLs Box */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-black text-amber-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>روابط التوجيه والـ Webhook (ضعها في لوحة تحكم فواتيرك):</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Platform Official URL */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط المنصة الرسمي (Domain):</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px]">
                  الرئيسي
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {primaryPlatformUrl}
              </div>
              <button
                onClick={() => copyToClipboard(primaryPlatformUrl, 'domain')}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                {copiedUrl === 'domain' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-slate-950" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط المنصة</span>
                  </>
                )}
              </button>
            </div>

            {/* Webhook URL */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط إشعار الدفع (Webhook / IPN):</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px]">
                  POST
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {webhookUrl}
              </div>
              <button
                onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedUrl === 'webhook' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط الـ Webhook</span>
                  </>
                )}
              </button>
            </div>

            {/* Success URL */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط نجاح الدفع (Success URL):</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-400 text-[10px]">
                  Redirect
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {successUrl}
              </div>
              <button
                onClick={() => copyToClipboard(successUrl, 'success')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'success' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط النجاح</span>
                  </>
                )}
              </button>
            </div>

              {/* Fail URL */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط فشل / إلغاء الدفع (Fail URL):</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px]">
                  Redirect
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {failUrl}
              </div>
              <button
                onClick={() => copyToClipboard(failUrl, 'fail')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'fail' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط الفشل</span>
                  </>
                )}
              </button>
            </div>

            {/* Pending URL */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط إعادة التوجيه معلق (Pending URL):</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px]">
                  Redirect
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {pendingUrl}
              </div>
              <button
                onClick={() => copyToClipboard(pendingUrl, 'pending')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'pending' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط المعلق</span>
                  </>
                )}
              </button>
            </div>

            {/* Service Cancellation Webhook (Fawry / Aman / Masry) */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط إلغاء الخدمة (فوري - أمان - مصري):</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-[10px]">
                  Webhook
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {cancelUrl}
              </div>
              <button
                onClick={() => copyToClipboard(cancelUrl, 'cancel')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'cancel' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط إلغاء الخدمة</span>
                  </>
                )}
              </button>
            </div>

            {/* Refund Transactions Webhook */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>رابط ويب لاسترداد المعاملات (Refund):</span>
                <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-400 text-[10px]">
                  Webhook
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {refundUrl}
              </div>
              <button
                onClick={() => copyToClipboard(refundUrl, 'refund')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'refund' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط الاسترداد</span>
                  </>
                )}
              </button>
            </div>

            {/* Failed Transactions Webhook */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>خطاف الويب للمعاملات الفاشلة:</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px]">
                  Webhook
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {failedWebhookUrl}
              </div>
              <button
                onClick={() => copyToClipboard(failedWebhookUrl, 'failedHook')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'failedHook' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط المعاملات الفاشلة</span>
                  </>
                )}
              </button>
            </div>

            {/* Hash Verification Hook */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>خطاف تجزئة الكلمات (Hash Hook):</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px]">
                  Security
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {hashVerifyUrl}
              </div>
              <button
                onClick={() => copyToClipboard(hashVerifyUrl, 'hashHook')}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedUrl === 'hashHook' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ رابط تجزئة الكلمات</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Fawaterak API Key Configuration & Test */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs sm:text-sm font-black text-white">ضبط وتحديث مفتاح فواتيرك الحي (API Key & Provider):</span>
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-bold cursor-pointer transition-all"
              >
                فحص الاتصال بالبوابة ⚡
              </button>
            </div>

            {testStatus && (
              <div className={`p-3 rounded-xl text-xs font-bold ${testStatus.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>
                {testStatus.text}
              </div>
            )}

            <form onSubmit={handleSaveKeys} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-slate-400">مفتاح API الخاص بفواتيرك (Fawaterak API Key / Hash Key):</label>
                <input
                  type="password"
                  value={fawaterakApiKeyInput}
                  onChange={(e) => setFawaterakApiKeyInput(e.target.value)}
                  placeholder="الصق مفتاح الـ API الحي هنا (Bearer Token)"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-slate-400">كود المزود (Provider Key):</label>
                <input
                  type="text"
                  value={fawaterakProviderKeyInput}
                  onChange={(e) => setFawaterakProviderKeyInput(e.target.value)}
                  placeholder="FAWATERAK.30884"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isUpdatingKeys || !fawaterakApiKeyInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  {isUpdatingKeys ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>حفظ وتفعيل المفتاح</span>
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-400">
            <span>المزود: <strong className="text-white font-mono">FAWATERAK.30884</strong></span>
            <span>•</span>
            <span>مفتاح التجزئة (Hash Key): <strong className="text-emerald-400 font-mono">e019...7f83b2 (مُفعل للتأمين)</strong></span>
            <span>•</span>
            <span>حالة التحقق: <strong className="text-emerald-400">نشط وجاهز للربط التلقائي ⚡</strong></span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي الفواتير:</span>
            <span className="text-2xl font-black text-white">{invoices.length}</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
            <span className="text-[11px] font-bold text-emerald-400 block">المدفوعة بنجاح:</span>
            <span className="text-2xl font-black text-emerald-400">
              {invoices.filter((i) => i.status === 'paid').length}
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
            <span className="text-[11px] font-bold text-amber-400 block">إجمالي التحصيل:</span>
            <span className="text-2xl font-black text-amber-400">{totalPaidRevenue} ج.م</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
            <span className="text-[11px] font-bold text-indigo-400 block">أكواد الخصم النشطة:</span>
            <span className="text-2xl font-black text-indigo-400">
              {coupons.filter((c) => c.isActive).length}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. PROMO CODES / COUPONS MANAGEMENT SECTION */}
      {/* ===================================================================== */}
      <div className="p-6 sm:p-8 rounded-[32px] bg-white border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 font-black">
                <Tag className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-black text-slate-900">
                أكواد الخصم الترويجية (Coupons & Promo Codes)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              أنشئ أكواد خصم بنسبة مئوية أو مبلغ ثابت، وتحكم في صلاحيتها وتفعيلها للطلاب فوراً.
            </p>
          </div>

          <button
            onClick={() => setShowAddCoupon(!showAddCoupon)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-2 self-start cursor-pointer shadow-md shadow-amber-400/20"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddCoupon ? 'إلغاء النموذج' : 'إضافة كود خصم جديد'}</span>
          </button>
        </div>

        {/* Add Coupon Form */}
        {showAddCoupon && (
          <form onSubmit={handleCreateCoupon} className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-4 animate-fadeIn">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>بيانات كود الخصم الجديد:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">كود الخصم (Promo Code):</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="مثال: SUMMER2027"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نوع الخصم:</label>
                <select
                  value={newDiscountType}
                  onChange={(e) => setNewDiscountType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="percentage">نسبة مئوية (%)</option>
                  <option value="fixed">مبلغ ثابت (ج.م)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  قيمة الخصم {newDiscountType === 'percentage' ? '(%)' : '(جنيه)'}:
                </label>
                <input
                  type="number"
                  value={newDiscountValue}
                  onChange={(e) => setNewDiscountValue(Number(e.target.value))}
                  min={1}
                  max={newDiscountType === 'percentage' ? 100 : 5000}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الحد الأقصى للاستخدام:</label>
                <input
                  type="number"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(e.target.value)}
                  placeholder="مثال: 500 (اتركه فارغاً للاستخدام المفتوح)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">تاريخ انتهاء الصلاحية (اختياري):</label>
                <input
                  type="date"
                  value={newExpiresAt}
                  onChange={(e) => setNewExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظة توضيحية:</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="مثال: كود خصم أوائل الثانوية العامة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={couponSubmitting}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {couponSubmitting ? 'جارٍ الحفظ...' : 'حفظ ونشر كود الخصم'}
              </button>
            </div>
          </form>
        )}

        {/* Coupons List Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id || coupon.code}
              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                coupon.isActive
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-50 border-slate-200/60 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-slate-950 font-black font-mono text-sm tracking-wider">
                  {coupon.code}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleCoupon(coupon.code)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      coupon.isActive
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {coupon.isActive ? 'مفعل' : 'معطل'}
                  </button>

                  <button
                    onClick={() => handleDeleteCoupon(coupon.code)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span>قيمة الخصم:</span>
                  <span className="text-emerald-600 font-black">
                    {coupon.discountType === 'percentage'
                      ? `${coupon.discountValue}% خصم`
                      : `${coupon.discountValue} ج.م مباشر`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span>مرات الاستخدام:</span>
                  <span className="font-mono">
                    {coupon.usedCount || 0} / {coupon.maxUses || 'غير محدود'}
                  </span>
                </div>

                {coupon.note && (
                  <p className="text-[11px] text-slate-400 pt-1 line-clamp-1">{coupon.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. FAWATERAK INVOICES & TRANSACTIONS LOG */}
      {/* ===================================================================== */}
      <div className="p-6 sm:p-8 rounded-[32px] bg-white border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 font-black">
                <Layers className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-black text-slate-900">
                سجل عمليات وفواتير فواتيرك (Fawaterak Transactions)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              جميع العمليات المنشأة عبر البوابة وحالتها ومبالغ التحصيل بعد الخصم.
            </p>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchInvoice}
              onChange={(e) => setSearchInvoice(e.target.value)}
              placeholder="بحث باسم الطالب أو الهاتف..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CreditCard className="w-8 h-8 mx-auto opacity-50 text-slate-400" />
            <p className="text-xs font-bold">لا توجد عمليات دفع مسجلة حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black border-b border-slate-200">
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">الطالب</th>
                  <th className="py-3 px-4">الهاتف</th>
                  <th className="py-3 px-4">الكورس</th>
                  <th className="py-3 px-4">السعر الأصلي</th>
                  <th className="py-3 px-4">الكوبون</th>
                  <th className="py-3 px-4">المدفوع</th>
                  <th className="py-3 px-4">طريقة الدفع</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      #{String(inv.invoiceId).slice(-6)}
                    </td>
                    <td className="py-3 px-4 font-black text-slate-900">{inv.studentName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{inv.studentPhone}</td>
                    <td className="py-3 px-4 font-bold text-indigo-700">{inv.courseTitle}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{inv.originalPrice} ج.م</td>
                    <td className="py-3 px-4">
                      {inv.couponCode ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-[10px]">
                          {inv.couponCode} (-{inv.discountAmount})
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-emerald-600">
                      {inv.finalAmount} ج.م
                    </td>
                    <td className="py-3 px-4 text-[11px]">{inv.paymentMethodName || inv.paymentMethod}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.status === 'paid'
                          ? 'مدفوعة ومفعلة ✅'
                          : inv.status === 'failed'
                          ? 'ملغاة ❌'
                          : 'قيد الدفع ⏳'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[10px] text-slate-400">
                      {new Date(inv.createdAt).toLocaleString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
