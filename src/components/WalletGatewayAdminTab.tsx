import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Search,
  Filter,
  Users,
  AlertTriangle,
  Send,
  Play,
  Key,
  Tag,
  Percent,
  Plus,
  Trash2,
  Radio,
  FileText,
  DollarSign,
  HelpCircle,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Coupon, Course, User, WalletOrder } from '../types';

interface WalletGatewayAdminTabProps {
  courses: Course[];
  students: User[];
  initialSubTab?: 'orders' | 'simulator' | 'config' | 'coupons' | 'logs';
}

interface GatewayConfig {
  receivingWalletNumber: string;
  receivingWalletName: string;
  webhookUrl: string;
  webhookSecret?: string;
  taskerPayloadTemplate?: string;
}

export const WalletGatewayAdminTab: React.FC<WalletGatewayAdminTabProps> = ({
  courses,
  students,
  initialSubTab = 'orders',
}) => {
  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'simulator' | 'config' | 'coupons' | 'logs'>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Orders State
  const [orders, setOrders] = useState<WalletOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [orderFilter, setOrderFilter] = useState<'all' | 'Pending' | 'Completed' | 'Rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Unmatched SMS Buffer & Logs
  const [unmatchedSms, setUnmatchedSms] = useState<any[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState<number>(0);

  // Gateway Config State
  const [config, setConfig] = useState<GatewayConfig>({
    receivingWalletNumber: '01040672314',
    receivingWalletName: 'فودافون كاش - منصة المتفلسفة  التعليمية',
    webhookUrl: 'https://motafalsifa.vercel.app/api/gateway/sms-webhook',
    webhookSecret: 'alelm_sms_secure_2027',
  });
  const [walletInput, setWalletInput] = useState('01040672314');
  const [secretInput, setSecretInput] = useState('alelm_sms_secure_2027');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Clipboard
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // SMS Simulator State
  const [simSender, setSimSender] = useState('VF-Cash');
  const [simMessage, setSimMessage] = useState(
    'تم استلام مبلغ 150.00 جنيها من رقم 01012345678 رقم العملية 987654321'
  );
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Coupons State
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [newDiscountValue, setNewDiscountValue] = useState<number>(20);
  const [newMaxUses, setNewMaxUses] = useState('200');
  const [newCouponNote, setNewCouponNote] = useState('');

  // Load orders & config
  const fetchGatewayData = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/gateway/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setUnmatchedSms(data.unmatchedSms || []);
        setUnmatchedCount(data.unmatchedSmsCount || 0);
        if (data.config) {
          setConfig((prev) => ({
            ...prev,
            ...data.config,
          }));
          setWalletInput(data.config.receivingWalletNumber || '01040672314');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch gateway orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load coupons
  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const res = await fetch('/api/coupons');
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons || []);
      }
    } catch (err) {
      console.warn('Failed to load coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  };

  useEffect(() => {
    fetchGatewayData();
    fetchCoupons();
    const interval = setInterval(fetchGatewayData, 12000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Save config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivingWalletNumber: walletInput.trim(),
          webhookSecret: secretInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ text: 'تم حفظ وتحديث إعدادات البوابة بنجاح! 🚀', type: 'success' });
        setConfig((prev) => ({
          ...prev,
          receivingWalletNumber: walletInput.trim(),
          webhookSecret: secretInput.trim(),
        }));
      } else {
        throw new Error(data.error || 'فشل حفظ الإعدادات');
      }
    } catch (err: any) {
      setToast({ text: err.message || 'حدث خطأ أثناء حفظ الإعدادات', type: 'error' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Receipt Preview Modal State
  const [previewReceiptOrder, setPreviewReceiptOrder] = useState<WalletOrder | null>(null);

  // Admin manually approve order (1-click instant activation)
  const handleApproveOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/gateway/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: 'الإدارة' }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ text: 'تم اعتماد الإيصال وتفعيل الكورس للطالب فوراً! 🎉', type: 'success' });
        setPreviewReceiptOrder(null);
        fetchGatewayData();
      } else {
        throw new Error(data.error || 'فشل اعتماد الطلب');
      }
    } catch (err: any) {
      setToast({ text: err.message || 'حدث خطأ أثناء الاعتماد', type: 'error' });
    }
  };

  // Admin manually reject order (1-click rejection)
  const handleRejectOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/gateway/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'لم يتم التحقق من صحة إيصال التحويل المرفق' }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ text: 'تم رفض الطلب وإشعار الطالب.', type: 'success' });
        setPreviewReceiptOrder(null);
        fetchGatewayData();
      } else {
        throw new Error(data.error || 'فشل رفض الطلب');
      }
    } catch (err: any) {
      setToast({ text: err.message || 'حدث خطأ أثناء الرفض', type: 'error' });
    }
  };

  // Run SMS Simulator
  const handleRunSimulator = async () => {
    if (!simMessage.trim()) return;
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/gateway/simulate-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: simSender,
          message: simMessage,
        }),
      });
      const data = await res.json();
      setSimResult(data);
      if (data?.result?.activated) {
        setToast({
          text: `🎉 تمت محاكاة الرسالة وتفعيل كورس "${data.result.courseTitle}" للطالب بنجاح!`,
          type: 'success',
        });
        fetchGatewayData();
      } else if (data?.result?.buffered) {
        setToast({
          text: 'تم حفظ الرسالة في الانتظار (Buffer) لمطابقتها فور تسجيل الطالب للطلب.',
          type: 'success',
        });
        fetchGatewayData();
      } else if (!data?.result?.success) {
        setToast({
          text: data?.result?.error || 'فشلت معالجة نص الرسالة في المحاكاة.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setToast({ text: err.message || 'فشلت تجربة المحاكي', type: 'error' });
    } finally {
      setSimRunning(false);
    }
  };

  // Create Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCouponCode.trim().toUpperCase(),
          discountType: newDiscountType,
          discountValue: Number(newDiscountValue) || 10,
          maxUses: Number(newMaxUses) || 100,
          note: newCouponNote.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ text: `تم إنشاء كود الخصم (${newCouponCode.toUpperCase()}) بنجاح!`, type: 'success' });
        setNewCouponCode('');
        setShowAddCoupon(false);
        fetchCoupons();
      } else {
        throw new Error(data.error || 'فشل إنشاء الكود');
      }
    } catch (err: any) {
      setToast({ text: err.message || 'خطأ أثناء إنشاء الكود', type: 'error' });
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async (code: string) => {
    if (!confirm(`هل أنت متأكد من حذف كود الخصم ${code}؟`)) return;
    try {
      const res = await fetch(`/api/coupons/${code}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ text: 'تم حذف كود الخصم بنجاح.', type: 'success' });
        fetchCoupons();
      }
    } catch {
      setToast({ text: 'فشل حذف كود الخصم.', type: 'error' });
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.studentName.toLowerCase().includes(q) ||
      o.studentPhone.includes(q) ||
      o.senderPhone.includes(q) ||
      o.courseTitle.toLowerCase().includes(q) ||
      (o.transactionId && o.transactionId.toLowerCase().includes(q))
    );
  });

  // Calculate Metrics
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'Pending').length;
  const completedOrdersCount = orders.filter((o) => o.status === 'Completed').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'Completed')
    .reduce((acc, curr) => acc + (curr.finalAmount || 0), 0);

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`p-4 rounded-2xl text-white text-xs sm:text-sm font-bold flex items-center justify-between shadow-xl transition-all ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="p-1 rounded-lg hover:bg-white/20">
            ✕
          </button>
        </div>
      )}

      {/* Hero / Overview Header */}
      <div className="rounded-[36px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-10 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>متصل ويعمل تلقائياً 24/7</span>
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                Custom Automated Wallet Gateway
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">
              بوابة الدفع المخصصة والرسائل (SMS Gateway)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              منظومة الاستقبال التلقائي الفوري لتحويلات فودافون كاش والمحافظ الإلكترونية عبر هاتف الأندرويد المخصص. يتم فك تشفير الرسائل ومطابقة أرقام العمليات وتفعيل الكورسات للطلاب في أقل من ثانية واحدة آلياً.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                fetchGatewayData();
                fetchCoupons();
                setToast({ text: 'تم تحديث البيانات في الوقت الفعلي ✅', type: 'success' });
              }}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer border border-slate-700 shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">إجمالي الطلبات</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{totalOrdersCount}</div>
            <span className="text-[10px] text-slate-500 font-bold block">طلب مسجل بالمنظومة</span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center justify-between text-amber-300">
              <span className="text-xs font-bold">قيد الانتظار</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{pendingOrdersCount}</div>
            <span className="text-[10px] text-amber-300/70 font-bold block">في انتظار رسالة الـ SMS</span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center justify-between text-emerald-300">
              <span className="text-xs font-bold">مكتمل ومفعل آلياً</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{completedOrdersCount}</div>
            <span className="text-[10px] text-emerald-300/70 font-bold block">تم التفعيل والتسليم الفوري</span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
            <div className="flex items-center justify-between text-indigo-300">
              <span className="text-xs font-bold">إجمالي المتحصلات</span>
              <DollarSign className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-300">
              {totalRevenue.toLocaleString()} <span className="text-sm font-bold">ج.م</span>
            </div>
            <span className="text-[10px] text-indigo-300/70 font-bold block">تحويلات فودافون كاش المعتمدة</span>
          </div>
        </div>
      </div>

      {/* Secondary Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'orders'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          <span>طلبات الدفع بالمحفظة ({orders.length})</span>
          {pendingOrdersCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
              {pendingOrdersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('simulator')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'simulator'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Play className="w-4 h-4 text-amber-600" />
          <span>محاكي رسائل SMS التجريبي 🧪</span>
        </button>

        <button
          onClick={() => setActiveSubTab('config')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'config'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-500" />
          <span>إعدادات الهاتف والـ Webhook ⚙️</span>
        </button>

        <button
          onClick={() => setActiveSubTab('coupons')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'coupons'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4 text-rose-500" />
          <span>أكواد الخصم والكوبونات ({coupons.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'logs'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Radio className="w-4 h-4 text-sky-500" />
          <span>سجل الرسائل الواردة ({unmatchedCount})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. ORDERS MANAGEMENT TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                سجل طلبات التحويل بالمحفظة الإلكترونية
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                تتبع حالة عمليات تحويل الطلاب، مع إمكانية التحقق والتفعيل التلقائي أو اليدوي الفوري.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setOrderFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  orderFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل ({orders.length})
              </button>

              <button
                onClick={() => setOrderFilter('Pending')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  orderFilter === 'Pending'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                قيد الانتظار ({pendingOrdersCount})
              </button>

              <button
                onClick={() => setOrderFilter('Completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  orderFilter === 'Completed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                مكتمل ومفعل ({completedOrdersCount})
              </button>

              <button
                onClick={() => setOrderFilter('Rejected')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  orderFilter === 'Rejected'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                مرفوض ({orders.filter((o) => o.status === 'Rejected').length})
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الطالب، رقم الهاتف، رقم العملية، أو عنوان الكورس..."
              className="w-full pl-4 pr-11 py-3.5 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-4 pointer-events-none" />
          </div>

          {/* Orders Table */}
          {loadingOrders ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
              <p className="text-xs font-bold">جاري تحميل سجل الطلبات...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">لا توجد طلبات تطابق معايير البحث الحالية.</p>
              <p className="text-xs text-slate-400">ستظهر هنا أي طلبات دفع يقوم بها الطلاب عبر فودافون كاش.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black">
                    <th className="p-3.5">الطلب والتاريخ</th>
                    <th className="p-3.5">الطالب</th>
                    <th className="p-3.5">الكورس والمبلغ</th>
                    <th className="p-3.5">بيانات التحويل والإيصال</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">التفعيل بضغطة زر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 space-y-1">
                        <span className="font-mono text-[11px] font-bold text-slate-700 block select-all">
                          #{order.id}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {new Date(order.createdAt).toLocaleString('ar-EG', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </td>

                      <td className="p-3.5 space-y-1">
                        <div className="font-bold text-slate-900">{order.studentName}</div>
                        <div className="text-[10px] font-mono text-slate-500" dir="ltr">
                          {order.studentPhone || 'بدون هاتف'}
                        </div>
                      </td>

                      <td className="p-3.5 space-y-1">
                        <div className="font-bold text-slate-900 truncate max-w-xs">{order.courseTitle}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-indigo-700 font-mono text-xs">
                            {order.finalAmount} ج.م
                          </span>
                          {order.discountAmount > 0 && (
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                              خصم {order.discountAmount} ج.م
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                              order.paymentMethod === 'instapay'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {order.paymentMethod === 'instapay' ? 'InstaPay ⚡' : 'فودافون كاش 📱'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 space-y-1.5">
                        <div className="text-[11px] text-slate-700">
                          <span className="text-slate-400 text-[10px]">محول من: </span>
                          <span className="font-mono font-bold select-all" dir="ltr">
                            {order.senderPhone}
                          </span>
                        </div>
                        {order.transactionId && (
                          <div className="text-[11px] text-indigo-700">
                            <span className="text-slate-400 text-[10px]">رقم العملية: </span>
                            <span className="font-mono font-bold select-all bg-indigo-50 px-1.5 py-0.5 rounded">
                              {order.transactionId}
                            </span>
                          </div>
                        )}
                        {order.receiptImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptOrder(order)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-black transition cursor-pointer"
                          >
                            <img
                              src={order.receiptImageUrl}
                              alt="إيصال"
                              className="w-5 h-5 rounded object-cover border border-amber-400"
                            />
                            <span>عرض صورة الإيصال المرفق 🔍</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">بدون صورة إيصال</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {order.status === 'Completed' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>مكتمل ومفعل ✅</span>
                          </span>
                        ) : order.status === 'Pending' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black inline-flex items-center gap-1 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>بانتظار مراجعة الإيصال ⏳</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>مرفوض</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {order.status === 'Pending' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApproveOrder(order.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                              title="قبول الإيصال وتفعيل الكورس للطالب فوراً"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>قبول وتفعيل فوراً</span>
                            </button>

                            <button
                              onClick={() => handleRejectOrder(order.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                              title="رفض الطلب"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>رفض</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold block">
                            {order.status === 'Completed' ? 'تم فتح الكورس للطالب ✓' : 'تم الرفض'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Receipt Full-Screen Review Modal */}
          {previewReceiptOrder && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-black text-base text-slate-900">
                      مراجعة إيصال الدفع - {previewReceiptOrder.studentName}
                    </h4>
                    <p className="text-xs font-bold text-slate-500">
                      {previewReceiptOrder.courseTitle} • المطلوب: {previewReceiptOrder.finalAmount} ج.م
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewReceiptOrder(null)}
                    className="px-3 py-1 rounded-xl bg-slate-100 text-slate-600 font-black text-xs cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                </div>

                <div className="bg-slate-900 rounded-2xl p-3 flex items-center justify-center max-h-96 overflow-auto">
                  {previewReceiptOrder.receiptImageUrl ? (
                    <img
                      src={previewReceiptOrder.receiptImageUrl}
                      alt="صورة إيصال التحويل"
                      className="max-h-80 object-contain rounded-xl"
                    />
                  ) : (
                    <p className="text-xs text-slate-400 py-10">لا توجد صورة مرفقة</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 font-bold">
                  <div>
                    <span className="text-slate-400 block">محول من رقم:</span>
                    <span className="font-mono font-black text-slate-900">{previewReceiptOrder.senderPhone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">طريقة الدفع:</span>
                    <span className="font-black text-indigo-700">
                      {previewReceiptOrder.paymentMethod === 'instapay' ? 'إنستا باي (InstaPay)' : 'فودافون كاش'}
                    </span>
                  </div>
                </div>

                {previewReceiptOrder.status === 'Pending' && (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleApproveOrder(previewReceiptOrder.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs sm:text-sm shadow-lg transition cursor-pointer"
                    >
                      ✅ قبول الإيصال وتفعيل الكورس فوراً
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectOrder(previewReceiptOrder.id)}
                      className="px-5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black py-3 rounded-2xl text-xs sm:text-sm transition cursor-pointer"
                    >
                      ❌ رفض الطلب
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LIVE SMS SIMULATOR TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulator' && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-200">
                أداة اختبار وتطوير حية 🧪
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900">
              محاكي رسائل فودافون كاش (SMS Simulator)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-3xl">
              تتيح لك هذه الأداة محاكاة وصول رسالة SMS حقيقية من شركة فودافون إلى سيرفر المنصة مباشرة لاختبار مطابقة Regex واستخراج المبلغ ورقم العملية وتفعيل الكورس للطالب فوراً دون الحاجة لدفع أي رصيد حقيقي!
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 block">نماذج رسائل جاهزة للتجربة السريعة:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSimSender('VF-Cash');
                  setSimMessage('تم استلام مبلغ 150.00 جنيها من رقم 01012345678 رقم العملية 987654321');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all text-right cursor-pointer"
              >
                نموذج فودافون كاش 1 (150 ج.م - رقم العملية 987654321)
              </button>

              <button
                type="button"
                onClick={() => {
                  setSimSender('Vodafone');
                  setSimMessage('تم استقبال مبلغ 200 ج.م من رقم 01098765432 العملية: 11223344');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all text-right cursor-pointer"
              >
                نموذج فودافون كاش 2 (200 ج.م - العملية 11223344)
              </button>

              <button
                type="button"
                onClick={() => {
                  setSimSender('VF-Cash');
                  setSimMessage('استقبلت مبلغ 300 جنيه من 01123456789 الرقم المرجعي للعملية: 55667788');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all text-right cursor-pointer"
              >
                نموذج 3 (أرقام عربية ومصطلحات مرجعية)
              </button>
            </div>
          </div>

          {/* Simulation Form */}
          <div className="space-y-4 p-5 sm:p-6 rounded-2xl bg-slate-900 text-white border border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">اسم أو رقم الراسل (Sender):</label>
                <input
                  type="text"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  placeholder="VF-Cash أو Vodafone"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-300 block mb-1.5">نص الرسالة الكامل (SMS Message Body):</label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  placeholder="أدخل نص الرسالة النصية كما تصل على الهاتف بالضبط..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunSimulator}
              disabled={simRunning || !simMessage.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {simRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري إرسال الرسالة إلى الـ Webhook ومعالجتها...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>محاكاة وصول الرسالة إلى الـ Webhook الآن 🚀</span>
                </>
              )}
            </button>
          </div>

          {/* Simulator Output Preview */}
          {simResult && (
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border-2 border-indigo-200 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>نتيجة التحليل والمعالجة بالسيرفر:</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  HTTP {simResult?.result?.status || 200}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block">المبلغ المستخرج:</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {simResult?.result?.amount ? `${simResult.result.amount} ج.م` : 'تعذر الاستخراج'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block">رقم المحفظة المحول منها:</span>
                  <span className="text-base font-black text-slate-900 font-mono" dir="ltr">
                    {simResult?.result?.senderPhone || 'غير متوفر'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block">رقم العملية (Transaction ID):</span>
                  <span className="text-base font-black text-indigo-700 font-mono">
                    {simResult?.result?.transactionId || 'غير متوفر'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                <span className="font-bold text-slate-700 block">حالة التفعيل:</span>
                <p className="text-slate-600 font-medium">
                  {simResult?.result?.message || JSON.stringify(simResult?.result)}
                </p>
                {simResult?.result?.activated && (
                  <div className="pt-2 text-emerald-700 font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>تم فتح وتفعيل الكورس للطالب بنجاح وتم تحديث قاعدة البيانات!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GATEWAY CONFIG & ANDROID WEBHOOK SETUP TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'config' && (
        <div className="space-y-6">
          {/* Settings Form */}
          <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                إعدادات البوابة وهاتف الاستقبال
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                تعديل رقم محفظة فودافون كاش المعتمدة للمنصة، ومفتاح الأمان السري الخاص بالـ Webhook.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 max-w-2xl">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>رقم محفظة فودافون كاش المستلمة (الرسمية للمنصة):</span>
                </label>
                <input
                  type="text"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  placeholder="01040672314"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-right bg-slate-50"
                />
                <span className="text-[10px] text-slate-400 block font-medium">
                  هذا هو الرقم الذي يظهر لكافة الطلاب في واجهة الدفع لتحويل المبلغ إليه.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <span>مفتاح الأمان السري (Webhook Secret Token):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    {showSecret ? 'إخفاء' : 'إظهار'}
                  </button>
                </label>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="alelm_sms_secure_2027"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-right bg-slate-50"
                />
                <span className="text-[10px] text-slate-400 block font-medium">
                  يتم إدراجه في إعدادات تطبيق الـ SMS على الهاتف لتوثيق أن الطلب قادم من هاتفك المخصص حصراً.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingConfig ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>حفظ التعديلات في السيرفر</span>
              </button>
            </form>
          </div>

          {/* Android Phone Step-by-Step Setup Guide */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-slate-800 rounded-[32px] p-6 sm:p-8 shadow-xl space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-black bg-indigo-500/30 text-indigo-300 px-3 py-1 rounded-full border border-indigo-400/40 inline-block">
                دليل ربط هاتف الأندرويد المخصص 📱
              </span>
              <h3 className="text-xl font-black">
                خطوات تثبيت وضبط تطبيق ترحيل الرسائل (SMS Forwarder / Tasker)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                اتبع الخطوات البسيطة التالية على هاتف الأندرويد المخصص المتصل بالشاحن لربطه بالسيرفر بشكل دائم:
              </p>
            </div>

            <div className="space-y-4">
              {/* Step 1: Webhook URL */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                <span className="text-xs font-black text-amber-400 block">
                  الخطوة 1: رابط الـ Webhook المستهدف (Target URL)
                </span>
                <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-mono text-xs text-emerald-400 truncate select-all" dir="ltr">
                    https://motafalsifa.vercel.app/api/gateway/sms-webhook
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard('https://motafalsifa.vercel.app/api/gateway/sms-webhook', 'webhook')
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'webhook' ? 'تم النسخ' : 'نسخ الرابط'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: HTTP Request Settings */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2.5">
                <span className="text-xs font-black text-amber-400 block">
                  الخطوة 2: إعدادات طلب الإرسال (HTTP Request Settings)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">نوع الطلب (Method):</span>
                    <span className="font-mono font-bold text-white">POST</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">نوع المحتوى (Content-Type):</span>
                    <span className="font-mono font-bold text-white">application/json</span>
                  </div>
                </div>
              </div>

              {/* Step 3: Payload JSON Template */}
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 block">
                    الخطوة 3: قالب الرسالة في تطبيق Tasker أو SMS Forwarder:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            sender: '%SMSRF',
                            message: '%SMSRB',
                            secret: secretInput.trim(),
                          },
                          null,
                          2
                        ),
                        'payload'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'payload' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>نسخ قالب الـ JSON</span>
                  </button>
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto border border-slate-800" dir="ltr">
{`{
  "sender": "%SMSRF",
  "message": "%SMSRB",
  "secret": "${secretInput.trim()}"
}`}
                </pre>
                <span className="text-[10px] text-slate-400 block leading-relaxed">
                  حيث <code>%SMSRF</code> تمثل رقم أو اسم الراسل (مثل VF-Cash)، و<code>%SMSRB</code> تمثل نص الرسالة الواردة.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. COUPONS / PROMO CODES TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'coupons' && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                إدارة أكواد الخصم والكوبونات (Promo Codes)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                أنشئ كوبونات خصم لطلابك بنسبة مئوية أو بمبلغ ثابت تُطبق فورياً في صفحة الدفع.
              </p>
            </div>

            <button
              onClick={() => setShowAddCoupon(!showAddCoupon)}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-200 self-start"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة كود خصم جديد</span>
            </button>
          </div>

          {/* Add Coupon Form */}
          {showAddCoupon && (
            <form onSubmit={handleCreateCoupon} className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fadeIn">
              <h4 className="text-sm font-black text-slate-900">بيانات كود الخصم الجديد</h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">كود الخصم (رمز الكوبون):</label>
                  <input
                    type="text"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    placeholder="مثال: PHYSICS2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs uppercase focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">نوع الخصم:</label>
                  <select
                    value={newDiscountType}
                    onChange={(e) => setNewDiscountType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-xs bg-white"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ج.م)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">قيمة الخصم:</label>
                  <input
                    type="number"
                    value={newDiscountValue}
                    onChange={(e) => setNewDiscountValue(Number(e.target.value))}
                    min="1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">أقصى عدد مرات استخدام:</label>
                  <input
                    type="number"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(e.target.value)}
                    placeholder="200"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظة / وصف (اختياري):</label>
                  <input
                    type="text"
                    value={newCouponNote}
                    onChange={(e) => setNewCouponNote(e.target.value)}
                    placeholder="خصم أوائل دفعة 2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all cursor-pointer shadow-sm"
                >
                  حفظ وتفعيل الكود
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCoupon(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {/* Coupons Table */}
          {loadingCoupons ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">لا توجد أكواد خصم حالية. أضف أول كود الآن.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black">
                    <th className="p-3">الكود</th>
                    <th className="p-3">الخصم</th>
                    <th className="p-3">الاستخدامات</th>
                    <th className="p-3">الملاحظات</th>
                    <th className="p-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {coupons.map((c) => (
                    <tr key={c.id || c.code} className="hover:bg-slate-50">
                      <td className="p-3">
                        <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded select-all">
                          {c.code}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900">
                          {c.discountType === 'percentage' ? `${c.discountValue}%` : `${c.discountValue} ج.م`}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {c.usedCount || 0} / {c.maxUses || 'غير محدود'}
                      </td>
                      <td className="p-3 text-slate-500">{c.note || '-'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteCoupon(c.code)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="حذف الكوبون"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. LIVE RECENT SMS LOGS TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              سجل الرسائل الواردة غير المطابقة بعد (Waiting SMS Buffer)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تعرض هذه القائمة رسائل فودافون كاش التي استلمها السيرفر من الهاتف المخصص ولكن لم يسجل الطالب طلبها بعد. بمجرد قيام الطالب بإدخال رقم محفظته في الموقع، سيتم تفعيل الكورس فوراً!
            </p>
          </div>

          {unmatchedSms.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Radio className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">لا توجد رسائل معلقة في الانتظار حالياً.</p>
              <p className="text-[11px] text-slate-400">جميع رسائل المحفظة الواردة تمت مطابقتها وتفعيل كورساتها بنجاح 🎯</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unmatchedSms.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>راسل الرسالة: {item.sender}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(item.receivedAt).toLocaleTimeString('ar-EG')}
                    </span>
                  </div>

                  <p className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-slate-700 select-all">
                    {item.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 text-slate-600 font-bold">
                    <span>المبلغ: <b className="text-emerald-700">{item.amount} ج.م</b></span>
                    <span>المحول: <b className="font-mono">{item.senderPhone}</b></span>
                    <span>العملية: <b className="font-mono text-indigo-700">{item.transactionId}</b></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
