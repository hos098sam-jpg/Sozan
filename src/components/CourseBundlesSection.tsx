import React, { useState, useEffect } from 'react';
import {
  Package,
  Sparkles,
  CheckCircle2,
  Wallet,
  Smartphone,
  Upload,
  Plus,
  Trash2,
  X,
  ArrowLeft,
  Flame,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { Course, CourseBundle, User } from '../types';

interface CourseBundlesSectionProps {
  courses: Course[];
  currentUser: User | null;
  onBundleSubscribed?: (enrolledCourseIds: string[], newBalance?: number) => void;
  onSelectCourse?: (course: Course) => void;
  vodafoneNumber?: string;
  instapayAddress?: string;
}

export const CourseBundlesSection: React.FC<CourseBundlesSectionProps> = ({
  courses,
  currentUser,
  onBundleSubscribed,
  onSelectCourse,
  vodafoneNumber = '01003730098',
  instapayAddress = '01003730098',
}) => {
  const [bundles, setBundles] = useState<CourseBundle[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected bundle for checkout modal
  const [checkoutBundle, setCheckoutBundle] = useState<CourseBundle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'vodafone_cash' | 'instapay'>('wallet');
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin / Teacher Create Bundle Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGrade, setNewGrade] = useState('الصف الثالث الثانوي');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [newOriginalPrice, setNewOriginalPrice] = useState(600);
  const [newBundlePrice, setNewBundlePrice] = useState(390);

  const isStaff =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'teacher';

  useEffect(() => {
    fetchBundles();
  }, []);

  const fetchBundles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bundles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bundles)) {
          setBundles(data.bundles);
        }
      }
    } catch (err) {
      console.error('Failed to fetch bundles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const isBundleFullyOwned = (bundle: CourseBundle): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'teacher' || currentUser.role === 'assistant') {
      return true;
    }
    const enrolled = currentUser.enrolledCourseIds || [];
    return bundle.courseIds.length > 0 && bundle.courseIds.every((id) => enrolled.includes(String(id)));
  };

  const handleSubscribeBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutBundle) return;
    if (!currentUser) {
      setFeedback({ type: 'error', message: 'يرجى تسجيل الدخول بحساب الطالب أولاً للاشتراك في الباقة.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (paymentMethod === 'wallet') {
        const res = await fetch(`/api/bundles/${checkoutBundle.id}/subscribe-wallet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: currentUser.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', message: data.error || 'فشل الاشتراك بالمحفظة.' });
        } else {
          setFeedback({ type: 'success', message: data.message });
          if (onBundleSubscribed && Array.isArray(data.enrolledCourseIds)) {
            onBundleSubscribed(data.enrolledCourseIds, data.newBalance);
          }
        }
      } else {
        if (!senderPhone.trim()) {
          setFeedback({ type: 'error', message: 'يرجى إدخال رقم الهاتف المحول منه.' });
          setSubmitting(false);
          return;
        }
        const res = await fetch('/api/gateway/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: currentUser.id,
            studentName: currentUser.name,
            studentPhone: currentUser.phone,
            senderPhone: senderPhone.trim(),
            transactionId: transactionId.trim() || undefined,
            courseId: checkoutBundle.courseIds[0] || checkoutBundle.id,
            courseTitle: `باقة: ${checkoutBundle.title}`,
            coursePrice: checkoutBundle.bundlePrice,
            bundleId: checkoutBundle.id,
            bundleCourseIds: checkoutBundle.courseIds,
            paymentMethod,
            receiptImageUrl: receiptImageUrl || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', message: data.error || 'فشل إرسال طلب تفعيل الباقة.' });
        } else {
          setFeedback({
            type: 'success',
            message:
              data.message ||
              'تم إرسال إيصال الدفع وطلب تفعيل الباقة إلى قسم مراجعة الإيصالات! سيتم فتح جميع كورسات الباقة فور المراجعة.',
          });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء الاتصال بالخادم.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || selectedCourseIds.length === 0) return;

    try {
      const res = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          grade: newGrade,
          courseIds: selectedCourseIds,
          originalTotalPrice: Number(newOriginalPrice) || 500,
          bundlePrice: Number(newBundlePrice) || 350,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.bundles)) {
          setBundles(data.bundles);
        }
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        setSelectedCourseIds([]);
      }
    } catch (err) {
      console.error('Error creating bundle:', err);
    }
  };

  const handleDeleteBundle = async (id: string) => {
    try {
      const res = await fetch(`/api/bundles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBundles((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete bundle:', err);
    }
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  if (loading && bundles.length === 0) return null;

  return (
    <section className="mb-12" dir="rtl">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/25">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                نظام الباقات والعروض المجمعة
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-black">
                <Flame className="w-3.5 h-3.5" />
                توفير حتى 40%
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold">
              اشترك في باقة مجمعة وافتح عدة كورسات وأبواب معاً بسعر مخفض بدلاً من شراء كل كورس منفرداً
            </p>
          </div>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black px-4 py-2.5 rounded-2xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            إضافة باقة مجمعة جديدة
          </button>
        )}
      </div>

      {/* Bundles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bundles.map((bundle) => {
          const bundleCourses = courses.filter((c) => bundle.courseIds.includes(String(c.id)));
          const owned = isBundleFullyOwned(bundle);
          const savings = Math.max(0, bundle.originalTotalPrice - bundle.bundlePrice);

          return (
            <div
              key={bundle.id}
              className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white border-2 border-amber-500/40 shadow-2xl overflow-hidden flex flex-col justify-between p-6"
            >
              {/* Top Discount Ribbon */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  {bundle.badgeText || `خصم ${bundle.discountPercentage}% 🔥`}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-xl">
                    {bundle.grade}
                  </span>
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => handleDeleteBundle(bundle.id)}
                      className="p-1.5 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/30 transition cursor-pointer"
                      title="حذف الباقة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-white mb-2 leading-snug">
                  {bundle.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-bold leading-relaxed mb-4">
                  {bundle.description}
                </p>

                {/* Included Courses Pills */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 mb-4">
                  <p className="text-[11px] font-black text-amber-400 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    الكورسات المشمولة داخل هذه الباقة ({bundleCourses.length || bundle.courseIds.length} كورسات):
                  </p>
                  <div className="space-y-1.5">
                    {bundleCourses.length > 0 ? (
                      bundleCourses.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => onSelectCourse && onSelectCourse(c)}
                          className="flex items-center justify-between text-xs font-bold bg-slate-900/90 hover:bg-slate-800 px-3 py-2 rounded-xl border border-slate-800 cursor-pointer transition"
                        >
                          <span className="text-white truncate">{c.title}</span>
                          <span className="text-amber-400 font-black shrink-0">{c.price} ج.م</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 font-bold">
                        تشمل {bundle.courseIds.length} كورسات أساسية ومراجعات شاملة
                      </p>
                    )}
                  </div>
                </div>

                {/* Features List */}
                {bundle.features && bundle.features.length > 0 && (
                  <ul className="space-y-1.5 mb-5">
                    {bundle.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Price & Subscribe CTA */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 line-through font-bold">
                      {bundle.originalTotalPrice} ج.م
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-black">
                      وفر {savings} ج.م ({bundle.discountPercentage}%)
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-0.5">
                    {bundle.bundlePrice} <span className="text-sm font-bold text-slate-300">ج.م فقط</span>
                  </div>
                </div>

                {owned ? (
                  <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-2xl text-xs sm:text-sm font-black">
                    <CheckCircle2 className="w-5 h-5" />
                    أنت مشترك في جميع كورسات الباقة
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutBundle(bundle);
                      setFeedback(null);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black px-6 py-3.5 rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition cursor-pointer"
                  >
                    <span>اشترك في الباقة الآن</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bundle Checkout Modal */}
      {checkoutBundle && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-black text-amber-400">تفعيل باقة التوفير المجمعة</span>
                <h3 className="text-lg font-black text-white mt-0.5">{checkoutBundle.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutBundle(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold">إجمالي سعر الباقة بعد الخصم</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-slate-500 line-through font-bold">
                    {checkoutBundle.originalTotalPrice} ج.م
                  </span>
                  <span className="text-2xl font-black text-amber-400">
                    {checkoutBundle.bundlePrice} ج.م
                  </span>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black">
                خصم {checkoutBundle.discountPercentage}%
              </span>
            </div>

            {/* Payment Method Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`p-3 rounded-2xl border text-center font-black text-xs transition cursor-pointer ${
                  paymentMethod === 'wallet'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Wallet className="w-5 h-5 mx-auto mb-1" />
                رصيد المحفظة ({currentUser?.walletBalance || 0} ج.م)
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('vodafone_cash')}
                className={`p-3 rounded-2xl border text-center font-black text-xs transition cursor-pointer ${
                  paymentMethod === 'vodafone_cash'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Smartphone className="w-5 h-5 mx-auto mb-1" />
                فودافون كاش
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`p-3 rounded-2xl border text-center font-black text-xs transition cursor-pointer ${
                  paymentMethod === 'instapay'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <ShieldCheck className="w-5 h-5 mx-auto mb-1" />
                إنستا باي (InstaPay)
              </button>
            </div>

            <form onSubmit={handleSubscribeBundle} className="space-y-4">
              {paymentMethod === 'wallet' ? (
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-300 leading-relaxed">
                  سيتم خصم مبلغ <span className="text-amber-400 font-black">{checkoutBundle.bundlePrice} ج.م</span> من رصيد محفظتك الحالي ({currentUser?.walletBalance || 0} ج.م) وفتح جميع كورسات الباقة في حسابك فوراً.
                </div>
              ) : (
                <div className="space-y-3 bg-slate-950/90 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-300">
                    قم بتحويل مبلغ <span className="text-amber-400 font-black">{checkoutBundle.bundlePrice} ج.م</span> إلى رقم{' '}
                    {paymentMethod === 'instapay' ? 'إنستا باي' : 'فودافون كاش'}:{' '}
                    <span className="text-emerald-400 font-black dir-ltr inline-block">{paymentMethod === 'instapay' ? instapayAddress : vodafoneNumber}</span>
                  </p>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1">
                      الرقم أو الحساب الذي حولت منه *
                    </label>
                    <input
                      type="text"
                      required
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1">
                      إرفاق صورة إيصال التحويل (للمراجعة السريعة في لوحة الإدارة)
                    </label>
                    <label className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-slate-700 hover:border-amber-500 bg-slate-900/60 p-3 text-xs font-black text-amber-300 cursor-pointer transition">
                      <Upload className="w-4 h-4" />
                      <span>{receiptImageUrl ? 'تم إرفاق صورة الإيصال بنجاح ✓' : 'اضغط لرفع صورة إيصال التحويل'}</span>
                      <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
                    </label>
                    {receiptImageUrl && (
                      <img
                        src={receiptImageUrl}
                        alt="إيصال التحويل"
                        className="mt-2 max-h-36 rounded-xl mx-auto border border-slate-700 object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              {feedback && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-black ${
                    feedback.type === 'success'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-black py-3.5 rounded-2xl text-sm shadow-lg transition cursor-pointer"
              >
                {submitting
                  ? 'جاري التنفيذ...'
                  : paymentMethod === 'wallet'
                  ? `تأكيد الاشتراك الفوري بالمحفظة (${checkoutBundle.bundlePrice} ج.م)`
                  : 'إرسال الإيصال وتفعيل الباقة'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin/Teacher Create Bundle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-400">إنشاء باقة كورسات مجمعة جديدة</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBundle} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">اسم الباقة *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: باقة الترم الأول الشاملة - الصف الثالث الثانوي"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">وصف الباقة</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="وصف مميزات الباقة للطلاب..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">السعر الأصلي قبل الخصم (ج.م)</label>
                  <input
                    type="number"
                    value={newOriginalPrice}
                    onChange={(e) => setNewOriginalPrice(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-emerald-400 mb-1">سعر الباقة المخفض (ج.م)</label>
                  <input
                    type="number"
                    value={newBundlePrice}
                    onChange={(e) => setNewBundlePrice(Number(e.target.value))}
                    className="w-full rounded-xl bg-slate-950 border border-emerald-500/50 px-3.5 py-2 text-xs text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1.5">
                  اختر الكورسات المشمولة داخل الباقة ({selectedCourseIds.length} مختار):
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {courses.map((c) => {
                    const checked = selectedCourseIds.includes(String(c.id));
                    return (
                      <label
                        key={c.id}
                        onClick={() => toggleCourseSelection(String(c.id))}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition ${
                          checked ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200' : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <span>{c.title}</span>
                        <span className="text-amber-400">{c.price} ج.م</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!newTitle.trim() || selectedCourseIds.length === 0}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl text-xs shadow-lg cursor-pointer"
              >
                حفظ ونشر الباقة للطلاب
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
