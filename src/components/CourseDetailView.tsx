import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  BookOpen,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Play,
  FileText,
  UserCheck,
  Key,
  MessageCircle,
  Phone,
  Check,
  Video,
  ExternalLink,
  Download,
  Eye,
  X,
  ChevronRight,
  ChevronLeft,
  Layers,
  HelpCircle,
  RotateCcw,
  CheckCircle,
  GraduationCap,
  Maximize2,
  FileDown,
  Info,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Wallet,
  Tag,
  Percent,
  Zap,
  Loader2,
  Copy,
  Smartphone,
  Send,
  Radio,
} from 'lucide-react';
import { Course, CourseExam, User, CourseAccessCode, CourseLesson, LessonVideo, LessonPdf, WalletOrder, WalletTransaction } from '../types';
import { ExamTakeView } from './ExamTakeView';
import { SecureVideoPlayer } from './SecureVideoPlayer';
import { CertificateModal } from './CertificateModal';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createGatewayVideoPayload } from '../utils/mediaUtils';
import { getVideoProgress, clearVideoProgress, formatSecondsToTime } from '../utils/videoProgress';
import {
  getSavedAccessCodes,
  saveAccessCodes,
  getSavedUsers,
  saveUsers,
  saveSingleUserToServer,
  saveCurrentUser,
  saveStudentEnrolledCourse,
  getStudentEnrolledCourses,
  redeemStudentWalletCode
} from '../data/initialData';
import { enrollStudentInCourseInFirestore } from '../auth';
import {
  getCompletedVideos,
  isVideoCompleted,
  markVideoCompleted,
  getVideoQuiz,
  isLessonVideoUnlocked,
  isLessonVideoQuizUnlocked,
  isCourseLessonUnlocked,
  isCourseLessonCompleted,
  getLessonProgressStats,
  getNextDueVideo,
  DueVideoResult
} from '../utils/lessonProgress';

interface CourseDetailViewProps {
  course: Course;
  currentUser: User | null;
  onBack: () => void;
  onOpenAuth: () => void;
  onUpdateUserResults: (
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
  onUpdateUser?: (updated: User) => void;
}

export type TopMediaState =
  | {
      type: 'video';
      video: LessonVideo;
      lessonTitle?: string;
      lessonId?: string;
    }
  | {
      type: 'pdf';
      pdf: LessonPdf;
      lessonTitle?: string;
      lessonId?: string;
    }
  | {
      type: 'exam_confirm';
      exam: CourseExam;
      lessonTitle?: string;
      videoTitle?: string;
      lessonId?: string;
    }
  | null;

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  currentUser,
  onBack,
  onOpenAuth,
  onUpdateUserResults,
  onUpdateUser,
}) => {
  const [activeExam, setActiveExam] = useState<CourseExam | null>(null);
  const [isExamReviewOnly, setIsExamReviewOnly] = useState<boolean>(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);
  const [isEnrollingFree, setIsEnrollingFree] = useState(false);
  const [localEnrolled, setLocalEnrolled] = useState<boolean>(() =>
    Boolean(
      currentUser && (
        (currentUser.enrolledCourseIds && currentUser.enrolledCourseIds.includes(course.id)) ||
        getStudentEnrolledCourses(currentUser.id).includes(course.id)
      )
    )
  );

  // Admin / Teacher preview bypass toggle
  const [adminBypassLocks, setAdminBypassLocks] = useState<boolean>(false);
  const isAdminOrTeacher = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  // Completed videos local tracking & reactive state
  const [completedVideosMap, setCompletedVideosMap] = useState<Record<string, boolean>>(() =>
    getCompletedVideos(currentUser?.id)
  );

  // Real-time video progress event listener for reactive watch progress bars
  const [, setProgressTick] = useState(0);
  useEffect(() => {
    const handleProgressUpdate = () => {
      setProgressTick((prev) => prev + 1);
    };
    window.addEventListener('video-progress-updated', handleProgressUpdate);
    return () => {
      window.removeEventListener('video-progress-updated', handleProgressUpdate);
    };
  }, []);

  // Interactive lock warning popup / notice
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  // Fawaterak Payment & Promo Code States
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  // Selected Payment Method from the 4 main buttons:
  // 'instapay' | 'vodafone_cash' | 'purchase_card' | 'wallet_balance'
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<'instapay' | 'vodafone_cash' | 'purchase_card' | 'wallet_balance'>('instapay');
  const [highlightPaymentMethods, setHighlightPaymentMethods] = useState(false);
  const paymentMethodsGridRef = useRef<HTMLDivElement | null>(null);
  const activePaymentPanelRef = useRef<HTMLDivElement | null>(null);

  // Authoritative server-verified price & wallet balance (Anti-Price-Tampering Protection)
  const initialCoursePrice = Math.max(0, Number(course.price ?? 0));
  const [serverVerifiedPrice, setServerVerifiedPrice] = useState<number>(initialCoursePrice);
  const [serverWalletBalance, setServerWalletBalance] = useState<number | null>(null);

  // Custom Automated Mobile Wallet State (Vodafone Cash & InstaPay)
  const [senderWalletPhone, setSenderWalletPhone] = useState(currentUser?.phone || '');
  const [transactionRefId, setTransactionRefId] = useState('');
  const [activePendingOrder, setActivePendingOrder] = useState<WalletOrder | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSuccess, setWalletSuccess] = useState<string | null>(null);
  const [copiedWalletNumber, setCopiedWalletNumber] = useState(false);
  const [showCodeInputAccordion, setShowCodeInputAccordion] = useState(false);

  // Target platform wallet number (or custom course wallet number if configured)
  const PLATFORM_VODAFONE_WALLET = '01040672314';
  const effectiveReceivingWallet = course.paymentPhone?.trim() || PLATFORM_VODAFONE_WALLET;

  // Student Electronic Wallet & Recharge Code states
  const [rechargeCodeInput, setRechargeCodeInput] = useState('');
  const [isRedeemingRechargeCode, setIsRedeemingRechargeCode] = useState(false);
  const [rechargeFeedback, setRechargeFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isPayingWithWallet, setIsPayingWithWallet] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Sync authoritative price & enrollment status from server database on mount
  useEffect(() => {
    setServerVerifiedPrice(Math.max(0, Number(course.price ?? 0)));
    let cancelled = false;
    const verifyFromServerDb = async () => {
      try {
        const q = new URLSearchParams();
        if (currentUser?.id) q.set('studentId', currentUser.id);
        if (currentUser?.phone) q.set('studentPhone', currentUser.phone);
        const res = await fetch(`/api/courses/${encodeURIComponent(course.id)}/enrollment-status?${q.toString()}`);
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json") || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.authoritativePrice === 'number' && data.authoritativePrice >= 0) {
          setServerVerifiedPrice(data.authoritativePrice);
        }
        if (typeof data.walletBalance === 'number' && data.walletBalance > 0) {
          setServerWalletBalance(data.walletBalance);
        }
        if (data.isEnrolledInDb && currentUser) {
          setLocalEnrolled(true);
        }
      } catch {}
    };
    verifyFromServerDb();
    return () => {
      cancelled = true;
    };
  }, [course.id, course.price, currentUser?.id, currentUser?.phone]);

  // Exact course price handling: strictly uses authoritative price to block DevTools manipulation
  const hasCourseDiscount =
    typeof course.originalPrice === 'number' &&
    course.originalPrice > Number(course.price ?? 0) &&
    course.originalPrice > 0;
  const courseDiscountPercent = hasCourseDiscount
    ? course.discountPercentage && course.discountPercentage > 0
      ? Math.round(course.discountPercentage)
      : Math.round(((course.originalPrice! - Number(course.price ?? 0)) / course.originalPrice!) * 100)
    : 0;
  const courseRawPrice =
    hasCourseDiscount && serverVerifiedPrice === course.originalPrice
      ? Math.max(0, Number(course.price ?? 0))
      : Math.max(Number(course.price ?? 0), serverVerifiedPrice);
  const isCourseFree = courseRawPrice === 0 && ((course as any).isFree === true || hasCourseDiscount);
  const courseBasePrice = isCourseFree ? 0 : courseRawPrice;
  const currentDiscountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalPayableAmount = appliedCoupon
    ? Math.max(0, appliedCoupon.finalAmount)
    : Math.max(0, courseBasePrice - currentDiscountAmount);

  // Use the student's existing account balance (from currentUser.walletBalance or synced server balance)
  const accountExistingBalance = Math.max(0, Number(currentUser?.walletBalance) || 0);
  const effectiveStudentBalance =
    serverWalletBalance !== null ? serverWalletBalance : accountExistingBalance;

  // Helper: Unlock course immediately via server database when coupon gives 100% discount
  const unlockCourseWith100CouponInDB = async (cleanCode: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setCouponLoading(true);
    try {
      const res = await fetch('/api/courses/subscribe-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'coupon_100',
          courseId: course.id,
          courseTitle: course.title,
          coursePrice: courseBasePrice,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentPhone: currentUser.phone,
          couponCode: cleanCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCouponError(data.error || 'تعذر فتح الكورس بكود الخصم، يرجى المحاولة مرة أخرى.');
        return;
      }

      const nextEnrolled = Array.from(new Set([...(currentUser.enrolledCourseIds || []), course.id]));
      const updatedUser: User = {
        ...currentUser,
        ...(data.updatedUser || {}),
        enrolledCourseIds: nextEnrolled,
      };

      saveCurrentUser(updatedUser);
      saveStudentEnrolledCourse(currentUser.id, course.id);
      enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});

      const allUsers = getSavedUsers();
      if (allUsers.some((u) => u.id === currentUser.id)) {
        saveUsers(allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u)));
      }

      onUpdateUser?.(updatedUser);
      setLocalEnrolled(true);
      setWalletSuccess(data.message || '🎉 تم تطبيق خصم 100% وفتح الكورس في حسابك فوراً عبر قاعدة البيانات!');
    } catch {
      setCouponError('حدث خطأ في الاتصال بقاعدة البيانات أثناء تفعيل كود الخصم 100%.');
    } finally {
      setCouponLoading(false);
    }
  };

  // Live preview of payable amount as soon as the student types a valid discount code
  useEffect(() => {
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) {
      if (appliedCoupon && !cleanCode) {
        setAppliedCoupon(null);
      }
      return;
    }
    if (appliedCoupon && appliedCoupon.code === cleanCode) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: cleanCode,
            originalPrice: courseBasePrice,
            courseId: course.id,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.valid) {
          const authoritativeBase =
            typeof data.authoritativePrice === 'number' ? data.authoritativePrice : courseBasePrice;
          setAppliedCoupon({
            code: cleanCode,
            discountType: data.coupon?.discountType || 'percentage',
            discountValue: data.coupon?.discountValue || 0,
            discountAmount: data.discountAmount || 0,
            finalAmount: data.finalAmount ?? Math.max(0, authoritativeBase - (data.discountAmount || 0)),
          });
          setCouponError(null);
        }
      } catch {}
    }, 350);

    return () => clearTimeout(timer);
  }, [couponInput, courseBasePrice, course.id]);

  const handleRedeemWalletRechargeInCourse = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!rechargeCodeInput.trim()) {
      setRechargeFeedback({ text: 'يرجى إدخال كود شحن المحفظة أولاً.', type: 'error' });
      return;
    }
    setIsRedeemingRechargeCode(true);
    setRechargeFeedback(null);
    try {
      const res = await redeemStudentWalletCode(rechargeCodeInput, currentUser);
      if (res.success && res.updatedUser) {
        setRechargeCodeInput('');
        if (typeof res.newBalance === 'number') {
          setServerWalletBalance(res.newBalance);
        }
        setRechargeFeedback({
          text: res.message || `تم شحن محفظتك بمبلغ ${res.amount} ج.م بنجاح! رصيدك الآن ${res.newBalance} ج.م 🎉`,
          type: 'success',
        });
        if (onUpdateUser) onUpdateUser(res.updatedUser);
      } else {
        setRechargeFeedback({ text: res.error || 'كود الشحن غير صالح أو تم استخدامه.', type: 'error' });
      }
    } catch {
      setRechargeFeedback({ text: 'حدث خطأ أثناء شحن الكود. حاول مرة أخرى.', type: 'error' });
    } finally {
      setIsRedeemingRechargeCode(false);
    }
  };

  // Database-verified Existing Account Balance Subscription (Anti-Tampering)
  const handlePayCourseFromStudentWallet = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (finalPayableAmount === 0 && appliedCoupon) {
      await unlockCourseWith100CouponInDB(appliedCoupon.code);
      return;
    }

    if (effectiveStudentBalance < finalPayableAmount) {
      setRechargeFeedback({
        text: `رصيد الحساب الموجود حالياً (${effectiveStudentBalance} ج.م) غير كافٍ لسداد قيمة الاشتراك (${finalPayableAmount} ج.م). المتبقي المطلوب: ${finalPayableAmount - effectiveStudentBalance} ج.م.`,
        type: 'error',
      });
      return;
    }

    setIsPayingWithWallet(true);
    setRechargeFeedback(null);
    try {
      const res = await fetch('/api/courses/subscribe-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'wallet_balance',
          courseId: course.id,
          courseTitle: course.title,
          coursePrice: courseBasePrice,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentPhone: currentUser.phone,
          accountBalance: effectiveStudentBalance,
          couponCode: appliedCoupon?.code,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (typeof data.currentBalance === 'number') {
          setServerWalletBalance(data.currentBalance);
        }
        setRechargeFeedback({
          text: data.error || 'تعذر إتمام الخصم من رصيد الحساب، يرجى التأكد من رصيدك والمحاولة مرة أخرى.',
          type: 'error',
        });
        return;
      }

      const nextBalance =
        typeof data.newBalance === 'number'
          ? data.newBalance
          : Math.max(0, effectiveStudentBalance - finalPayableAmount);
      const nextEnrolled = Array.from(new Set([...(currentUser.enrolledCourseIds || []), course.id]));
      const updatedUser: User = {
        ...currentUser,
        ...(data.updatedUser || {}),
        walletBalance: nextBalance,
        enrolledCourseIds: nextEnrolled,
      };

      setServerWalletBalance(nextBalance);

      saveCurrentUser(updatedUser);
      saveStudentEnrolledCourse(currentUser.id, course.id);
      await saveSingleUserToServer(updatedUser).catch(() => {});
      await enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});

      const allUsers = getSavedUsers();
      if (allUsers.some((u) => u.id === currentUser.id)) {
        saveUsers(allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u)));
      }

      if (onUpdateUser) onUpdateUser(updatedUser);
      setLocalEnrolled(true);
      setWalletSuccess(
        data.message ||
          `تم خصم ${finalPayableAmount} ج.م من رصيد حسابك الموجود وتفعيل كورس (${course.title}) بنجاح! 🎉`
      );
    } catch {
      setRechargeFeedback({ text: 'تعذر الاتصال بقاعدة البيانات لإتمام الاشتراك، يرجى المحاولة مرة أخرى.', type: 'error' });
    } finally {
      setIsPayingWithWallet(false);
    }
  };

  // Real-time polling effect when an order is in 'Pending' status
  useEffect(() => {
    if (!activePendingOrder || activePendingOrder.status !== 'Pending') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/gateway/order-status/${activePendingOrder.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isCompleted) {
            setLocalEnrolled(true);
            if (currentUser) {
              const updated: User = {
                ...currentUser,
                enrolledCourseIds: Array.from(new Set([...(currentUser.enrolledCourseIds || []), course.id])),
              };
              saveCurrentUser(updated);
              saveStudentEnrolledCourse(currentUser.id, course.id);
              enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});
              onUpdateUser?.(updated);
            }
            setActivePendingOrder(null);
            setWalletSuccess('🎉 تم استلام التحويل وتأكيد العملية في قاعدة البيانات بنجاح! تم تفعيل الكورس في حسابك فوراً.');
          }
        }
      } catch {}
    }, 3500);

    return () => clearInterval(interval);
  }, [activePendingOrder, currentUser, course.id]);

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCouponError(null);
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) {
      setCouponError('الرجاء كتابة كود الخصم أولاً');
      return;
    }
    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, originalPrice: courseBasePrice, courseId: course.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.error || 'كود الخصم غير صالح أو منتهي الصلاحية');
        setAppliedCoupon(null);
      } else {
        const authoritativeBase =
          typeof data.authoritativePrice === 'number' ? data.authoritativePrice : courseBasePrice;
        const computedFinal = data.finalAmount ?? Math.max(0, authoritativeBase - (data.discountAmount || 0));

        setAppliedCoupon({
          code: cleanCode,
          discountType: data.coupon?.discountType || 'percentage',
          discountValue: data.coupon?.discountValue || 0,
          discountAmount: data.discountAmount || 0,
          finalAmount: computedFinal,
        });
        setCouponError(null);

        // If 100% discount (finalAmount === 0), unlock course immediately via server database!
        if (computedFinal === 0 || data.isFree100Percent) {
          await unlockCourseWith100CouponInDB(cleanCode);
          return;
        }

        // Otherwise (< 100% discount), direct student to the 4 payment buttons below with the discounted price
        setHighlightPaymentMethods(true);
        setTimeout(() => setHighlightPaymentMethods(false), 3500);
        setTimeout(() => {
          paymentMethodsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    } catch (err: any) {
      setCouponError('تعذر التحقق من كود الخصم حالياً');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleWalletCheckout = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    // 100% discount or free course instant enrollment via database
    if (isCourseFree || finalPayableAmount === 0) {
      if (appliedCoupon) {
        await unlockCourseWith100CouponInDB(appliedCoupon.code);
      } else {
        await handleEnrollFreeCourse();
      }
      return;
    }

    const isInstaPay = selectedPaymentTab === 'instapay';

    if (!senderWalletPhone.trim() || senderWalletPhone.trim().length < 5) {
      setWalletError(
        isInstaPay
          ? 'الرجاء إدخال رقم الهاتف أو عنوان إنستا باي (InstaPay) الذي قمت بالتحويل منه.'
          : 'الرجاء إدخال رقم المحفظة (فودافون كاش) التي قمت بالتحويل منها.'
      );
      return;
    }

    setWalletLoading(true);
    setWalletError(null);
    setWalletSuccess(null);

    try {
      const orderPayload = {
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentPhone: currentUser.phone || "",
        senderPhone: senderWalletPhone.trim(),
        transactionId: transactionRefId.trim() || "",
        courseId: course.id,
        courseTitle: course.title,
        coursePrice: courseBasePrice,
        couponCode: appliedCoupon?.code || "",
        paymentMethod: isInstaPay ? "instapay" : "vodafone_cash",
        receiptImageUrl: receiptImageUrl || "",
      };
      const res = await fetch('/api/gateway/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      }).catch(() => null);

      const ct = res?.headers.get("content-type") || "";
      let data: any = null;
      if (res && ct.includes("application/json")) {
        data = await res.json();
      } else {
        const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const pendingOrder: WalletOrder = {
          id: orderId,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentPhone: currentUser.phone || "",
          senderPhone: senderWalletPhone.trim(),
          targetWallet: effectiveReceivingWallet,
          transactionId: transactionRefId.trim() || undefined,
          courseId: course.id,
          courseTitle: course.title,
          originalPrice: courseBasePrice,
          discountAmount: currentDiscountAmount,
          finalAmount: finalPayableAmount,
          paymentMethod: isInstaPay ? "instapay" : "vodafone_cash",
          status: "Pending",
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "orders", orderId), {
          ...pendingOrder,
          updatedAt: serverTimestamp(),
        });
        setActivePendingOrder(pendingOrder);
        setWalletSuccess(
          isInstaPay
            ? "تم تسجيل طلب التحويل عبر إنستا باي بنجاح! سيتم مراجعته وتفعيل الكورس فور التأكيد من الإدارة."
            : "تم إرسال طلب التحويل بنجاح! سيتم مراجعة الإيصال وتفعيل الكورس في حسابك فور التأكيد."
        );
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إرسال طلب التحويل.');
      }

      if (data.instantActivated || data.status === 'Completed') {
        const prevEnrolled = currentUser.enrolledCourseIds || [];
        const updatedCourseIds = Array.from(new Set([...prevEnrolled, course.id]));
        const updatedUser: User = {
          ...currentUser,
          enrolledCourseIds: updatedCourseIds,
        };
        saveCurrentUser(updatedUser);
        saveStudentEnrolledCourse(currentUser.id, course.id);
        enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});
        onUpdateUser?.(updatedUser);
        setLocalEnrolled(true);
        setWalletSuccess(data.message || '🎉 تم التحقق الفوري من التحويل وتفعيل الكورس في حسابك بنجاح!');
        setActivePendingOrder(null);
        return;
      }

      // Order created in Pending state waiting for verification
      setActivePendingOrder(data.order);
      setWalletSuccess(
        isInstaPay
          ? 'تم تسجيل طلب التحويل عبر إنستا باي في قاعدة البيانات بنجاح! جاري المطابقة وتفعيل الكورس تلقائياً...'
          : 'تم إرسال طلبك بنجاح! في انتظار رسالة التأكيد عبر فودافون كاش ليتم التفعيل تلقائياً خلال لحظات...'
      );
    } catch (err: any) {
      console.error('Wallet order error:', err);
      setWalletError(err.message || 'تعذر تسجيل طلب التحويل.');
    } finally {
      setWalletLoading(false);
    }
  };

  // Integrated course states
  const hasLessons = Boolean(course.lessons && course.lessons.length > 0);
  const [activeViewTab, setActiveViewTab] = useState<'lessons' | 'exams'>(
    hasLessons ? 'lessons' : 'exams'
  );

  // Active selected lesson ID (null by default so lesson content does NOT open automatically until clicked!)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Top Area Media & Action Stage state (فيديوهات • ملفات • تأكيد دخول الامتحان)
  const [activeTopMedia, setActiveTopMedia] = useState<TopMediaState>(null);
  const topMediaRef = useRef<HTMLDivElement>(null);

  // Currently playing video reference
  const [selectedVideo, setSelectedVideo] = useState<LessonVideo | null>(null);
  const [previewPdf, setPreviewPdf] = useState<LessonPdf | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string>('');
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);

  const handleReceiptImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Active lesson reference (only defined when user explicitly selected a lesson)
  const activeLesson = selectedLessonId ? course.lessons?.find((l) => l.id === selectedLessonId) : null;
  const activeLessonIndex = activeLesson && course.lessons ? course.lessons.findIndex((l) => l.id === activeLesson.id) : -1;

  // Listen to video completion events across the platform
  useEffect(() => {
    const handleVideoCompletedEvent = () => {
      setCompletedVideosMap(getCompletedVideos(currentUser?.id));
    };
    window.addEventListener('qalb_alam_video_completed', handleVideoCompletedEvent);
    return () => window.removeEventListener('qalb_alam_video_completed', handleVideoCompletedEvent);
  }, [currentUser?.id]);

  // Auto-dismiss lock notice after 5 seconds
  useEffect(() => {
    if (lockNotice) {
      const timer = setTimeout(() => setLockNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lockNotice]);

  // Dedicated handler to play a video in the Top Stage (أعلى فهرس الدروس)
  const handlePlayVideoInTopArea = (vid: LessonVideo, lesson: CourseLesson) => {
    // Pass video through the dedicated platform Gateway and mask original source
    const gatewayVideo = createGatewayVideoPayload(vid, currentUser?.id);
    setSelectedVideo(gatewayVideo);
    setActiveTopMedia({
      type: 'video',
      video: gatewayVideo,
      lessonTitle: lesson.title,
      lessonId: lesson.id,
    });
    // Smoothly scroll to the top media area
    setTimeout(() => {
      topMediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Play the video whose turn it is (الفيديو اللى عليه الدور) in the Top Stage
  const handlePlayDueVideo = () => {
    const due = getNextDueVideo(course, effectiveUserForLocks);
    if (due) {
      const gatewayVideo = createGatewayVideoPayload(due.video, currentUser?.id);
      setSelectedVideo(gatewayVideo);
      setActiveTopMedia({
        type: 'video',
        video: gatewayVideo,
        lessonTitle: due.lesson.title,
        lessonId: due.lesson.id,
      });
      // Optionally open the lesson to highlight its position in the list
      setSelectedLessonId(due.lesson.id);
      setTimeout(() => {
        topMediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  // Dedicated handler to open and view a PDF in the Top Stage
  const handleOpenPdfInTopArea = (pdf: LessonPdf, lessonTitle?: string, lessonId?: string) => {
    setActiveTopMedia({
      type: 'pdf',
      pdf,
      lessonTitle,
      lessonId,
    });
    setTimeout(() => {
      topMediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Dedicated handler to show Exam Entrance Confirmation (تأكيد دخول الامتحان) in the Top Stage
  const handleRequestExamConfirmation = (
    exam: CourseExam,
    lessonTitle?: string,
    videoTitle?: string,
    lessonId?: string
  ) => {
    setActiveTopMedia({
      type: 'exam_confirm',
      exam,
      lessonTitle,
      videoTitle,
      lessonId,
    });
    setTimeout(() => {
      topMediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Confirm start exam handler (opens the exam take view)
  const handleConfirmStartExam = (exam: CourseExam) => {
    setActiveExam(exam);
    setIsExamReviewOnly(false);
  };

  // Is course locked for student?
  const isEnrolled =
    isAdminOrTeacher ||
    Boolean(
      currentUser && (
        localEnrolled ||
        (currentUser.enrolledCourseIds && currentUser.enrolledCourseIds.includes(course.id)) ||
        getStudentEnrolledCourses(currentUser.id).includes(course.id)
      )
    );

  // Effective currentUser for permission checking (taking admin preview into account)
  const effectiveUserForLocks = adminBypassLocks ? ({ ...currentUser, role: 'admin' } as User) : currentUser;

  // Check if an individual exam inside course is unlocked
  const isExamUnlocked = (exam: CourseExam, index: number) => {
    if (adminBypassLocks || isAdminOrTeacher) return true;
    if (index === 0) return true;
    const prevExam = course.exams[index - 1];
    if (!prevExam) return true;
    const prevResult = currentUser?.examResults?.[prevExam.id];
    return Boolean(prevResult && prevResult.passed);
  };

  const getExamResult = (examId: string) => {
    return currentUser?.examResults?.[examId];
  };

  // Video completion handler
  const handleMarkVideoCompleted = (videoId: string) => {
    const updated = markVideoCompleted(videoId, currentUser, onUpdateUser);
    setCompletedVideosMap(updated);
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setCodeSuccess(null);

    if (!currentUser) {
      onOpenAuth();
      return;
    }

    const trimmed = enteredCode.trim().toUpperCase();
    if (!trimmed) {
      setCodeError('الرجاء إدخال كود كارت شراء الكورس أولاً.');
      return;
    }

    try {
      const localKnownCodes = getSavedAccessCodes();
      const res = await fetch('/api/courses/subscribe-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'purchase_card',
          courseId: course.id,
          courseTitle: course.title,
          coursePrice: courseBasePrice,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentPhone: currentUser.phone,
          purchaseCardCode: trimmed,
          clientKnownCodes: localKnownCodes,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setCodeError(data.error || 'عذراً، كود كارت شراء الكورس غير صحيح أو تم استخدامه مسبقاً.');
        return;
      }

      if (Array.isArray(data.updatedAccessCodes)) {
        saveAccessCodes(data.updatedAccessCodes);
      }

      const prevEnrolled = currentUser.enrolledCourseIds || [];
      const updatedCourseIds = Array.from(new Set([...prevEnrolled, course.id]));
      const updatedUser: User = {
        ...currentUser,
        ...(data.updatedUser || {}),
        enrolledCourseIds: updatedCourseIds,
      };

      saveCurrentUser(updatedUser);
      saveStudentEnrolledCourse(currentUser.id, course.id);
      enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});

      const allUsers = getSavedUsers();
      const updatedUsers = allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      saveUsers(updatedUsers);

      onUpdateUser?.(updatedUser);
      setLocalEnrolled(true);
      setCodeSuccess(data.message || 'تم تفعيل اشتراك الكورس بنجاح عبر قاعدة البيانات! تم حفظ الكورس في حسابك وفتح المحتوى والامتحانات.');
    } catch {
      setCodeError('تعذر الاتصال بقاعدة البيانات للتحقق من الكارت. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleEnrollFreeCourse = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setIsEnrollingFree(true);
    try {
      const res = await fetch('/api/courses/subscribe-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'coupon_100',
          courseId: course.id,
          courseTitle: course.title,
          coursePrice: courseBasePrice,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentPhone: currentUser.phone,
          couponCode: appliedCoupon?.code,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCodeError(data.error || 'لا يمكن فتح هذا الكورس مجاناً إلا بكود خصم 100% معتمد في قاعدة البيانات.');
        return;
      }

      const prevEnrolled = currentUser.enrolledCourseIds || [];
      const updatedCourseIds = Array.from(new Set([...prevEnrolled, course.id]));
      const updatedUser: User = {
        ...currentUser,
        ...(data.updatedUser || {}),
        enrolledCourseIds: updatedCourseIds,
      };

      saveCurrentUser(updatedUser);
      saveStudentEnrolledCourse(currentUser.id, course.id);
      await enrollStudentInCourseInFirestore(currentUser.id, course.id).catch(() => {});

      const allUsers = getSavedUsers();
      const updatedUsers = allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      saveUsers(updatedUsers);

      onUpdateUser?.(updatedUser);
      setLocalEnrolled(true);
      setCodeSuccess(data.message || 'تم حفظ وتثبيت الكورس في حسابك وقائمة كورساتك المشتركة بنجاح!');
    } catch (e) {
      console.error('Error enrolling in free course:', e);
    } finally {
      setIsEnrollingFree(false);
    }
  };

  if (activeExam) {
    return (
      <ExamTakeView
        exam={activeExam}
        courseTitle={course.title}
        currentUser={currentUser}
        onBack={() => {
          setActiveExam(null);
          setIsExamReviewOnly(false);
        }}
        onExamCompleted={(examId, score, maxScore, percentage, passed, timingMeta) => {
          onUpdateUserResults(examId, score, maxScore, percentage, passed, timingMeta);
        }}
        onOpenAuth={onOpenAuth}
        isReviewOnly={isExamReviewOnly}
      />
    );
  }

  const supervisorWhatsappLink = `https://wa.me/201040672314?text=${encodeURIComponent(
    `مرحباً إدارة المنصة، أود الاشتراك في كورس (${course.title}) والحصول على كود التفعيل الخاص بي.`
  )}`;

  // Calculate totals
  const totalLessonsCount = course.lessons?.length || 0;
  const totalVideosCount = course.lessons?.reduce((sum, l) => sum + (l.videos?.length || 0), 0) || 0;
  const totalPdfsCount = course.lessons?.reduce((sum, l) => sum + (l.pdfs?.length || 0), 0) || 0;
  const totalExamsCount =
    (course.exams?.length || 0) +
    (course.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0);

  const isCourseIntegrated = course.courseType === 'integrated' || hasLessons;

  // Calculate Course Total Progress
  let totalCourseSteps = 0;
  let completedCourseSteps = 0;
  (course.lessons || []).forEach((lesson) => {
    const stats = getLessonProgressStats(course, lesson, effectiveUserForLocks);
    totalCourseSteps += stats.totalSteps;
    completedCourseSteps += stats.completedSteps;
  });
  const courseOverallProgress = totalCourseSteps > 0
    ? Math.round((completedCourseSteps / totalCourseSteps) * 100)
    : 100;

  // Next due video in the sequential curriculum (الفيديو اللى عليه الدور)
  const dueVideoInfo = getNextDueVideo(course, effectiveUserForLocks);

  // Security check: Teacher cannot open, view, or modify another teacher's course
  const isTeacherOwner =
    course.instructorId === currentUser?.id ||
    course.instructor === currentUser?.name ||
    course.teacherName === currentUser?.name;

  if (currentUser?.role === 'teacher' && !isTeacherOwner) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center animate-fadeIn" dir="rtl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[36px] p-8 sm:p-12 shadow-2xl space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <span className="text-xs font-black px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
              حدود وصلاحيات حساب المعلم 🔒
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              غير مصرح للمعلم بفتح أو تعديل كورسات معلم آخر
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto">
              وفقاً لسياسة منصة المتفلسفة  وصلاحيات المدرسين، يمكنك فقط فتح وتعديل ومتابعة الكورسات الخاصة بك، وإضافة الدروس ومتابعة طلابك المشتركين وتصحيح الأسئلة المقالية لكورساتك فقط.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لكورساتي الخاصة</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Top Back Navigation & Admin Preview Switcher (Hidden when activeTopMedia is open to keep view 100% focused) */}
      {!activeTopMedia && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-black text-slate-700 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة لقائمة الكورسات</span>
          </button>
        </div>
      )}

      {/* Floating Interactive Lock Notice */}
      {lockNotice && !activeTopMedia && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-lg text-amber-950 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-xs sm:text-sm">تنبيه القفل التسلسلي</h4>
              <p className="text-xs font-bold text-amber-800 mt-0.5">{lockNotice}</p>
            </div>
          </div>
          <button
            onClick={() => setLockNotice(null)}
            className="p-1 text-amber-600 hover:text-amber-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Course Banner (Hidden when activeTopMedia is open, and sleek/compact when enrolled) */}
      {!activeTopMedia && (
        !isEnrolled ? (
          /* Full Course Banner for non-enrolled students */
          <div className="bg-white border border-slate-200 rounded-[36px] overflow-hidden shadow-sm">
            <div className="relative h-64 sm:h-80 w-full bg-slate-900">
              <img
                src={course.coverImage}
                alt={`كورس ${course.title} - ${course.schoolYear} - إشراف ${course.instructor}`}
                className="w-full h-full object-cover opacity-60"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=1200&auto=format&fit=crop';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />

              <div className="absolute bottom-6 right-6 left-6 space-y-2 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black px-3 py-1 bg-indigo-600 rounded-full text-white">
                    {course.schoolYear}
                  </span>
                  {course.division && (
                    <span className="text-xs font-black px-3 py-1 bg-amber-500 text-slate-950 rounded-full font-bold">
                      {course.division}
                    </span>
                  )}
                  <span className="text-xs font-black px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white">
                    {course.subject}
                  </span>
                  <span className="text-xs font-black px-3 py-1 bg-emerald-500 rounded-full text-white">
                    {course.price === 0 ? 'كورس مجاني بالكامل' : `${course.price} ${course.priceCurrency}`}
                  </span>
                  <span className="text-xs font-black px-3 py-1 bg-purple-600/90 rounded-full text-white flex items-center gap-1">
                    {isCourseIntegrated ? 'كورس شرح متكامل (فيديوهات + كويزات + مذكرات)' : 'كورس امتحانات تسلسلية'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {course.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  إشراف وتدريس: <b>{course.instructor}</b>
                </p>
              </div>
            </div>

            {/* Course Info Body */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900">وصف ومنهجية الكورس:</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  {course.description}
                </p>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">الدروس التعليمية</span>
                    <span className="text-sm font-black text-indigo-950">{totalLessonsCount} دروس</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">فيديوهات الشرح</span>
                    <span className="text-sm font-black text-amber-950">{totalVideosCount} فيديو</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">مذكرات وملفات PDF</span>
                    <span className="text-sm font-black text-rose-950">{totalPdfsCount} مذكرة</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">الاختبارات والكويزات</span>
                    <span className="text-sm font-black text-emerald-950">{totalExamsCount} كويز وامتحان</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sleek, Compact Header for Enrolled Students (No clutter, straight to studying) */
          <div className="bg-white border border-slate-200 rounded-[28px] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                    {course.schoolYear}
                  </span>
                  {course.division && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                      {course.division}
                    </span>
                  )}
                  <span className="text-[11px] font-black px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
                    {course.subject}
                  </span>
                  <span className="text-[11px] font-black px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>مشترك ومفعّل</span>
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {course.title}
                </h1>
                <p className="text-xs text-slate-500 font-bold">
                  إشراف وتدريس: {course.instructor}
                </p>
              </div>

              {/* Progress Summary */}
              {totalLessonsCount > 0 && (
                <div className="sm:text-left bg-slate-50 border border-slate-200/80 p-3 rounded-2xl min-w-[200px] space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700">
                    <span className="flex items-center gap-1 text-indigo-600">
                      <GraduationCap className="w-4 h-4" />
                      <span>الإنجاز بالكورس:</span>
                    </span>
                    <span className="text-emerald-700 font-black">{courseOverallProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
                      style={{ width: `${courseOverallProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold block text-left">
                    {completedCourseSteps} من {totalCourseSteps} خطوة مكتملة
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-[11px] shadow-sm transition cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>شهادة التقدير (PDF)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Course Subscription / Lock State */}
      {!isEnrolled ? (
        <div className="bg-gradient-to-br from-indigo-900/5 via-white to-amber-500/10 border-2 border-indigo-200/80 rounded-[36px] p-6 sm:p-10 shadow-xl space-y-8 animate-fadeIn">
          {/* Lock Header */}
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-300">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              الاشتراك في كورس: {course.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              احصل على حق الوصول الكامل لجميع محاضرات الشرح، مذكرات الـ PDF التفاعلية، بنوك الأسئلة، والامتحانات التقييمية المصححة فورياً.
            </p>
          </div>

          {/* Free Course Instant Activation or Paid Fawaterak Payment Card */}
          {courseBasePrice === 0 ? (
            /* Free Course Immediate Activation Box */
            <div id="fawaterak-checkout" className="max-w-xl mx-auto rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white p-6 sm:p-8 shadow-2xl space-y-6 border border-emerald-500/40 text-center scroll-mt-24">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-black px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 inline-block shadow-md">
                  كورس مجاني بالكامل 100% 🎁
                </span>
                <h3 className="text-2xl font-black">
                  {course.title}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed max-w-md mx-auto">
                  هذا الكورس متاح مجاناً لكافة طلاب المنصة بدون أي رسوم. اضغط على زر «اشترك الآن مجاناً» بالأسفل لفتح المحتوى والبدء في الدراسة فوراً!
                </p>
              </div>

              {codeSuccess && (
                <div className="text-xs font-bold text-emerald-300 bg-emerald-900/50 border border-emerald-600 p-3 rounded-2xl flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{codeSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleEnrollFreeCourse}
                disabled={isEnrollingFree}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isEnrollingFree ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري تفعيل الكورس في حسابك...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>اشترك الآن مجاناً وابدأ التعلم فوراً 🚀</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Unified 4-Button Course Subscription Card with Top Discount Code & Database Protection */
            <div id="wallet-checkout" className="max-w-2xl mx-auto rounded-3xl bg-slate-900 text-white p-5 sm:p-8 shadow-2xl space-y-6 border border-slate-800 scroll-mt-24">
              {/* 1. TOP SECTION: DISCOUNT CODE INPUT & LIVE PAYABLE AMOUNT */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block">
                      {appliedCoupon
                        ? 'المبلغ المطلوب دفعه بعد تطبيق كود الخصم:'
                        : hasCourseDiscount
                        ? 'سعر الاشتراك في الكورس بعد الخصم:'
                        : 'قيمة الاشتراك في الكورس:'}
                    </span>
                    <div className="flex items-baseline gap-2.5 mt-0.5 flex-wrap">
                      {appliedCoupon ? (
                        <>
                          <span className="text-3xl sm:text-4xl font-black text-emerald-400">{finalPayableAmount}</span>
                          <span className="text-xs font-bold text-emerald-300">ج.م فقط</span>
                          <span className="text-sm font-bold text-slate-500 line-through mr-1">
                            {hasCourseDiscount ? course.originalPrice : courseBasePrice} ج.م
                          </span>
                        </>
                      ) : hasCourseDiscount ? (
                        <>
                          <span className="text-lg sm:text-xl font-bold text-rose-400 line-through decoration-rose-500 decoration-2">
                            {course.originalPrice} ج.م
                          </span>
                          <span className="text-3xl sm:text-4xl font-black text-emerald-400">{courseBasePrice}</span>
                          <span className="text-xs font-bold text-emerald-300">ج.م</span>
                          <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-xs font-black shadow-sm">
                            🔥 خصم {courseDiscountPercent}%
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl sm:text-4xl font-black text-amber-400">{courseBasePrice}</span>
                          <span className="text-xs font-bold text-amber-300">ج.م</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>اشتراك مؤمّن عبر قاعدة البيانات</span>
                  </div>
                </div>

                {/* Discount Code Input at Top */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-amber-400" />
                      <span>خانة كود الخصم (أدخل كود الخصم إن وجد لمعرفة المبلغ المطلوب):</span>
                    </span>
                    {appliedCoupon && (
                      <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                        خصم {appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `${appliedCoupon.discountValue} ج.م`}
                      </span>
                    )}
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="اكتب كود الخصم هنا..."
                      disabled={couponLoading}
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm font-bold font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />

                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponInput('');
                          setCouponError(null);
                        }}
                        className="px-4 py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        إلغاء الكود
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      {couponLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Percent className="w-4 h-4" />
                      )}
                      <span>تطبيق كود الخصم</span>
                    </button>
                  </div>

                  {couponError && (
                    <div className="text-[11px] font-bold text-rose-400 bg-rose-950/50 border border-rose-800/60 p-2.5 rounded-xl">
                      {couponError}
                    </div>
                  )}

                  {/* Live Payable Amount Banner when Coupon is Entered */}
                  {appliedCoupon && (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/60 border-2 border-emerald-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black text-emerald-300 block">
                          ✅ تم تطبيق كود الخصم ({appliedCoupon.code}) بنجاح! (وفرت {currentDiscountAmount} ج.م)
                        </span>
                        <span className="text-[11px] text-slate-300 block">
                          {finalPayableAmount === 0
                            ? '🎉 خصم 100% — اضغط على الزر لفتح الكورس مجاناً الآن!'
                            : 'اختر الآن إحدى وسائل الدفع الأربع بالأسفل لسداد المبلغ بعد الخصم:'}
                        </span>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm text-center shrink-0 shadow-md">
                        المبلغ المطلوب دفعه: {finalPayableAmount} ج.م
                      </div>
                    </div>
                  )}

                  {appliedCoupon && finalPayableAmount === 0 && (
                    <button
                      type="button"
                      onClick={() => unlockCourseWith100CouponInDB(appliedCoupon.code)}
                      disabled={couponLoading}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {couponLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                      <span>فتح الكورس فوراً ومجاناً (خصم 100%) 🎓</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. THE 4 MAIN SUBSCRIPTION METHOD BUTTONS */}
              <div
                ref={paymentMethodsGridRef}
                className={`space-y-3 rounded-2xl p-2 transition-all duration-300 ${
                  highlightPaymentMethods ? 'ring-4 ring-emerald-400 bg-emerald-500/10' : ''
                }`}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs sm:text-sm font-black text-white">
                    اختر وسيلة الاشتراك والتفعيل الفوري ({finalPayableAmount} ج.م):
                  </span>
                  <span className="text-[11px] font-bold text-amber-400">4 طرق متاحة</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Button 1: InstaPay */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentTab('instapay');
                      setWalletError(null);
                      setTimeout(() => activePaymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      selectedPaymentTab === 'instapay'
                        ? 'bg-gradient-to-b from-purple-600/30 to-indigo-900/40 border-purple-400 text-white shadow-lg shadow-purple-500/20 scale-[1.02]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md ${
                      selectedPaymentTab === 'instapay' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-purple-400'
                    }`}>
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black block">إنستا باي</span>
                      <span className="text-[10px] text-purple-300 font-bold block mt-0.5">InstaPay</span>
                    </div>
                  </button>

                  {/* Button 2: Vodafone Cash */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentTab('vodafone_cash');
                      setWalletError(null);
                      setTimeout(() => activePaymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      selectedPaymentTab === 'vodafone_cash'
                        ? 'bg-gradient-to-b from-red-600/30 to-rose-950/40 border-red-400 text-white shadow-lg shadow-red-500/20 scale-[1.02]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md ${
                      selectedPaymentTab === 'vodafone_cash' ? 'bg-red-600 text-white' : 'bg-slate-800 text-red-400'
                    }`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black block">فودافون كاش</span>
                      <span className="text-[10px] text-red-300 font-bold block mt-0.5">Vodafone Cash</span>
                    </div>
                  </button>

                  {/* Button 3: Course Purchase Card */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentTab('purchase_card');
                      setCodeError(null);
                      setTimeout(() => activePaymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      selectedPaymentTab === 'purchase_card'
                        ? 'bg-gradient-to-b from-amber-500/30 to-amber-950/40 border-amber-400 text-white shadow-lg shadow-amber-500/20 scale-[1.02]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md ${
                      selectedPaymentTab === 'purchase_card' ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-amber-400'
                    }`}>
                      <Key className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black block">كارت شراء الكورس</span>
                      <span className="text-[10px] text-amber-300 font-bold block mt-0.5">كود التفعيل</span>
                    </div>
                  </button>

                  {/* Button 4: Subscribe with Current Account Balance */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaymentTab('wallet_balance');
                      setRechargeFeedback(null);
                      setTimeout(() => activePaymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
                    }}
                    className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      selectedPaymentTab === 'wallet_balance'
                        ? 'bg-gradient-to-b from-emerald-500/30 to-teal-950/40 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md ${
                      selectedPaymentTab === 'wallet_balance' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400'
                    }`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black block">اشتراك بالرصيد الحالي</span>
                      <span className="text-[10px] text-emerald-300 font-bold font-mono block mt-0.5">
                        رصيد الحساب: {effectiveStudentBalance} ج.م
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. ACTIVE PAYMENT METHOD PANEL */}
              <div ref={activePaymentPanelRef} className="pt-1">
                {/* PANEL A & B: INSTAPAY OR VODAFONE CASH */}
                {(selectedPaymentTab === 'instapay' || selectedPaymentTab === 'vodafone_cash') && (
                  <div className="p-4 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                          selectedPaymentTab === 'instapay' ? 'bg-purple-400' : 'bg-red-500'
                        }`} />
                        <span className="text-xs sm:text-sm font-black text-white">
                          {selectedPaymentTab === 'instapay'
                            ? `الدفع عبر إنستا باي (InstaPay) — المبلغ المطلوب: ${finalPayableAmount} ج.م`
                            : `الدفع عبر فودافون كاش (Vodafone Cash) — المبلغ المطلوب: ${finalPayableAmount} ج.م`}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md font-mono border ${
                        selectedPaymentTab === 'instapay'
                          ? 'bg-purple-950/80 text-purple-300 border-purple-700/60'
                          : 'bg-red-950/80 text-red-400 border-red-800/60'
                      }`}>
                        {selectedPaymentTab === 'instapay' ? 'InstaPay' : 'Vodafone Cash'}
                      </span>
                    </div>

                    {/* Recipient Number Box */}
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg text-white flex items-center justify-center font-black shrink-0 shadow-md ${
                          selectedPaymentTab === 'instapay' ? 'bg-purple-600' : 'bg-red-600'
                        }`}>
                          {selectedPaymentTab === 'instapay' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {selectedPaymentTab === 'instapay'
                              ? 'رقم / حساب استلام إنستا باي الرسمي:'
                              : 'رقم محفظة فودافون كاش لاستلام الاشتراك:'}
                          </span>
                          <span className="text-base sm:text-lg font-black font-mono text-white tracking-wider select-all">
                            {effectiveReceivingWallet}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(effectiveReceivingWallet);
                          setCopiedWalletNumber(true);
                          setTimeout(() => setCopiedWalletNumber(false), 2500);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 shrink-0"
                      >
                        {copiedWalletNumber ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ الرقم</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Optional QR Code */}
                    {course.paymentQrCode && (
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-400/40 flex flex-col sm:flex-row items-center gap-4">
                        <div
                          onClick={() => setShowQrModal(true)}
                          className="w-32 h-32 rounded-2xl bg-white p-2 border-2 border-amber-400 shrink-0 cursor-pointer hover:scale-105 transition-transform shadow-md"
                          title="اضغط لتكبير الباركود"
                        >
                          <img
                            src={course.paymentQrCode}
                            alt="باركود الدفع"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-2 text-center sm:text-right flex-1">
                          <h5 className="text-xs sm:text-sm font-black text-amber-300">
                            📱 مسح باركود الدفع السريع (QR Code)
                          </h5>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            يمكنك فتح تطبيق {selectedPaymentTab === 'instapay' ? 'إنستا باي' : 'فودافون كاش'} ومسح الباركود لتحويل قيمة الاشتراك (<b>{finalPayableAmount} ج.م</b>) مباشرةً.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowQrModal(true)}
                            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-black inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>تكبير صورة الباركود</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sender & Reference Inputs */}
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <span>
                            {selectedPaymentTab === 'instapay'
                              ? 'رقم الهاتف أو عنوان إنستا باي الذي حولت منه:'
                              : 'رقم محفظة فودافون كاش التي قمت بالتحويل منها:'}
                          </span>
                          <span className="text-rose-400 font-black">*</span>
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={senderWalletPhone}
                          onChange={(e) => setSenderWalletPhone(e.target.value)}
                          placeholder={selectedPaymentTab === 'instapay' ? 'مثال: 01012345678 أو username@instapay' : 'مثال: 01012345678'}
                          className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm font-bold font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                          <span>رقم العملية المرجعي (Transaction Reference - اختياري):</span>
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={transactionRefId}
                          onChange={(e) => setTransactionRefId(e.target.value)}
                          placeholder="أدخل رقم العملية الموجود في إيصال التحويل أو الرسالة"
                          className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm font-bold font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400 text-right"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                          <span>📸 إرفاق صورة إيصال التحويل (للتفعيل السريع من قسم مراجعة الإيصالات):</span>
                        </label>
                        <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-amber-400/50 hover:border-amber-400 bg-slate-900/80 text-xs font-black text-amber-300 cursor-pointer transition">
                          <FileDown className="w-4 h-4" />
                          <span>
                            {receiptImageUrl
                              ? 'تم إرفاق صورة إيصال الدفع بنجاح ✓ (اضغط لتغييرها)'
                              : 'اضغط هنا لرفع صورة إيصال التحويل (إنستا باي / فودافون كاش)'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptImageChange}
                            className="hidden"
                          />
                        </label>
                        {receiptImageUrl && (
                          <div className="relative mt-2 inline-block">
                            <img
                              src={receiptImageUrl}
                              alt="معاينة الإيصال"
                              className="max-h-40 rounded-xl border border-amber-400/50 object-contain mx-auto"
                            />
                            <button
                              type="button"
                              onClick={() => setReceiptImageUrl('')}
                              className="mt-1 text-[11px] text-rose-400 font-black hover:underline block"
                            >
                              حذف الصورة المرفقة
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {walletError && (
                      <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-xs font-bold text-rose-300 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">⚠️</span>
                        <div className="flex-1 leading-relaxed">{walletError}</div>
                      </div>
                    )}

                    {walletSuccess && (
                      <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-xs font-bold text-emerald-300 flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex-1 leading-relaxed">{walletSuccess}</div>
                      </div>
                    )}

                    {activePendingOrder && activePendingOrder.status === 'Pending' && (
                      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2 animate-pulse">
                        <div className="flex items-center justify-between text-xs font-black text-amber-300">
                          <span className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-amber-400 animate-spin" />
                            <span>جاري التحقق من التحويل في قاعدة البيانات وتفعيل الكورس...</span>
                          </span>
                          <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded">
                            #{activePendingOrder.id}
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleWalletCheckout}
                      disabled={walletLoading}
                      className={`w-full py-4 rounded-2xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-98 ${
                        selectedPaymentTab === 'instapay'
                          ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-purple-500/20'
                          : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20'
                      }`}
                    >
                      {walletLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>جاري التحقق وتوثيق الاشتراك في قاعدة البيانات...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          <span>
                            {selectedPaymentTab === 'instapay'
                              ? `تأكيد تحويل إنستا باي (${finalPayableAmount} ج.م) وتفعيل الكورس 🚀`
                              : `تأكيد تحويل فودافون كاش (${finalPayableAmount} ج.م) وتفعيل الكورس 🚀`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* PANEL C: COURSE PURCHASE CARD (كارت شراء الكورس) */}
                {selectedPaymentTab === 'purchase_card' && (
                  <form
                    onSubmit={handleRedeemCode}
                    className="p-5 sm:p-6 rounded-2xl bg-slate-950 border-2 border-amber-400/50 space-y-4 animate-fadeIn"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                          <Key className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-black text-amber-300 block">
                            تفعيل الكورس بواسطة كارت شراء الكورس
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            أدخل الكود الموجود على كارت شراء الكورس ليتم فحصه في قاعدة البيانات وفتح الكورس فوراً
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={enteredCode}
                        onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                        placeholder="أدخل كود كارت شراء الكورس هنا (مثال: QALB-PHYS-9821)"
                        className="w-full pl-4 pr-11 py-3.5 rounded-2xl border-2 border-amber-400/60 bg-slate-900 text-white placeholder-slate-500 text-xs sm:text-sm font-black font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400 text-center"
                      />
                      <Key className="w-5 h-5 text-amber-400 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>

                    {codeError && (
                      <div className="text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-800 p-3 rounded-xl">
                        {codeError}
                      </div>
                    )}

                    {codeSuccess && (
                      <div className="text-xs font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800 p-3 rounded-xl flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{codeSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Unlock className="w-5 h-5" />
                      <span>تفعيل كارت شراء الكورس وفتح المحتوى الآن 🚀</span>
                    </button>
                  </form>
                )}

                {/* PANEL D: SUBSCRIBE WITH EXISTING ACCOUNT BALANCE (اشتراك من رصيد الحساب الموجود) */}
                {selectedPaymentTab === 'wallet_balance' && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 border-2 border-emerald-500/50 space-y-4 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-black text-emerald-300 block">
                            الاشتراك المباشر من رصيد الحساب الموجود 💰
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            يتم خصم قيمة الاشتراك ({finalPayableAmount} ج.م) مباشرة من رصيد حسابك الحالي وتفعيل الكورس فوراً
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Account Balance Breakdown Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400 font-bold block mb-1">رصيد الحساب الموجود</span>
                        <span className="text-lg font-black font-mono text-emerald-400">{effectiveStudentBalance} ج.م</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400 font-bold block mb-1">المبلغ المطلوب للكورس</span>
                        <span className="text-lg font-black font-mono text-amber-400">{finalPayableAmount} ج.م</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-400 font-bold block mb-1">
                          {effectiveStudentBalance >= finalPayableAmount
                            ? 'المتبقي في الحساب بعد الاشتراك'
                            : 'الرصيد المتبقي المطلوب'}
                        </span>
                        <span
                          className={`text-lg font-black font-mono ${
                            effectiveStudentBalance >= finalPayableAmount ? 'text-teal-300' : 'text-rose-400'
                          }`}
                        >
                          {effectiveStudentBalance >= finalPayableAmount
                            ? `${effectiveStudentBalance - finalPayableAmount} ج.م`
                            : `${finalPayableAmount - effectiveStudentBalance} ج.م`}
                        </span>
                      </div>
                    </div>

                    {rechargeFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs font-bold border ${
                          rechargeFeedback.type === 'success'
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                            : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                        }`}
                      >
                        {rechargeFeedback.text}
                      </div>
                    )}

                    {/* Primary Pay from Existing Account Balance Button */}
                    <button
                      type="button"
                      onClick={handlePayCourseFromStudentWallet}
                      disabled={isPayingWithWallet}
                      className={`w-full py-4 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl ${
                        effectiveStudentBalance >= finalPayableAmount
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20'
                          : 'bg-amber-500/90 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isPayingWithWallet ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Zap className="w-5 h-5" />
                      )}
                      <span>
                        {effectiveStudentBalance >= finalPayableAmount
                          ? `تأكيد الاشتراك وخصم ${finalPayableAmount} ج.م من رصيد الحساب الآن 🚀`
                          : `اشترك من رصيد الحساب الموجود (رصيدك: ${effectiveStudentBalance} ج.م | المطلوب: ${finalPayableAmount} ج.م)`}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* QR Modal */}
              {showQrModal && course.paymentQrCode && (
                <div
                  className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                  onClick={() => setShowQrModal(false)}
                >
                  <div
                    className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900">باركود استلام اشتراك الكورس</h4>
                      <button
                        type="button"
                        onClick={() => setShowQrModal(false)}
                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="w-64 h-64 mx-auto bg-white p-2 rounded-2xl border-2 border-slate-200">
                      <img
                        src={course.paymentQrCode}
                        alt="QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs font-bold text-slate-600">
                      الرقم المرتبط: <span className="font-mono font-black text-slate-900">{effectiveReceivingWallet}</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>نظام دفع واشتراك مؤمّن بالكامل عبر قاعدة بيانات منصة المتفلسفة  (حماية ضد التلاعب بالأسعار)</span>
              </div>
            </div>
          )}

          {/* Contact Supervisor Box */}
          <div className="pt-4 border-t border-slate-200/80 max-w-xl mx-auto space-y-2 text-center">
            <span className="text-xs text-slate-500 font-bold block">
              هل تواجه أي مشكلة أو تود المساعدة في الاشتراك؟
            </span>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <a
                href={supervisorWhatsappLink}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تواصل مع الإدارة عبر واتساب (01040672314)</span>
              </a>

              <a
                href="tel:01040672314"
                className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>اتصال هاتفياً</span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* Enrolled Content Area */
        <div className="space-y-8">
          {/* ========================================================================= */}
          {/* TOP STAGE: DEDICATED MEDIA & EXAM CONFIRMATION AREA (أعلى فهرس الدروس) */}
          {/* ========================================================================= */}
          <div ref={topMediaRef} className="scroll-mt-6">
            {activeTopMedia?.type === 'video' ? (
              /* 1. TOP VIDEO PLAYER VIEW (Pure, focused, distraction-free, perfectly fits mobile portrait) */
              <div className="w-full max-w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black animate-fadeIn">
                <SecureVideoPlayer
                  key={activeTopMedia.video.id || activeTopMedia.video.url || 'top-video'}
                  video={activeTopMedia.video}
                  currentUser={currentUser}
                  onEnded={() => handleMarkVideoCompleted(activeTopMedia.video.id)}
                />
              </div>
            ) : activeTopMedia?.type === 'pdf' ? (
              /* 2. TOP PDF VIEWER VIEW */
              <div className="rounded-[32px] border-2 border-rose-300/80 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-xl space-y-4 animate-fadeIn">
                {/* PDF Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200">
                        عارض المذكرات والملفات (المنطقة العلوية)
                      </span>
                      {activeTopMedia.lessonTitle && (
                        <span className="text-xs text-slate-500 font-bold">
                          ملف تابع لـ: {activeTopMedia.lessonTitle}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-rose-600" />
                      <span>{activeTopMedia.pdf.title}</span>
                    </h3>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <a
                      href={activeTopMedia.pdf.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
                      title="فتح في صفحة جديدة"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح بتبويب مستقل</span>
                    </a>

                    <a
                      href={activeTopMedia.pdf.fileUrl}
                      download={activeTopMedia.pdf.title + '.pdf'}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      title="تحميل الملف على جهازك"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل الملف</span>
                    </a>

                    <button
                      onClick={() => setActiveTopMedia(null)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>إغلاق الملف</span>
                    </button>
                  </div>
                </div>

                {/* Embedded PDF iframe */}
                <div className="w-full h-[520px] sm:h-[620px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-inner">
                  <iframe
                    src={activeTopMedia.pdf.fileUrl}
                    title={activeTopMedia.pdf.title}
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              </div>
            ) : activeTopMedia?.type === 'exam_confirm' ? (
              /* 3. TOP EXAM ENTRANCE CONFIRMATION VIEW (تأكيد دخول الامتحان) */
              <div className="rounded-[32px] border-2 border-amber-400 bg-gradient-to-br from-amber-500/10 via-white to-indigo-500/10 p-6 sm:p-8 shadow-xl space-y-6 animate-fadeIn">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-xs">
                        بوابة تأكيد دخول الامتحان (المنطقة العلوية)
                      </span>
                      {activeTopMedia.lessonTitle && (
                        <span className="text-xs text-slate-600 font-bold">
                          الدرس: {activeTopMedia.lessonTitle}
                        </span>
                      )}
                      {activeTopMedia.videoTitle && (
                        <span className="text-xs text-slate-500 font-medium">
                          • كويز فيديو: {activeTopMedia.videoTitle}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                      <HelpCircle className="w-6 h-6 text-amber-600" />
                      <span>{activeTopMedia.exam.title}</span>
                    </h3>
                  </div>

                  <button
                    onClick={() => setActiveTopMedia(null)}
                    className="self-start sm:self-center px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>تراجع وإلغاء</span>
                  </button>
                </div>

                {/* Notice & Specifications */}
                <div className="space-y-4">
                  <p className="text-xs sm:text-sm text-slate-700 font-bold">
                    يرجى مراجعة تفاصيل وضوابط الاختبار بدقة قبل بدء احتساب العداد التنازلي:
                  </p>

                  {/* 4 Stat Cards */}
                  {(() => {
                    const exam = activeTopMedia.exam;
                    const result = currentUser?.examResults?.[exam.id];
                    const isUnderReview = result?.status === 'under_review';
                    const isPassed = Boolean(result && result.passed && !isUnderReview);
                    const maxAttempts = Math.max(1, Number(exam.maxAttempts) || 1);
                    const attemptsCount = Number(result?.attemptsCount) || 0;
                    const hasExhausted = attemptsCount >= maxAttempts;

                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-1 text-center">
                            <span className="text-2xl block">⏱️</span>
                            <span className="text-[11px] font-bold text-slate-500 block">مدة الامتحان</span>
                            <span className="text-base sm:text-lg font-black text-slate-900">
                              {exam.durationMinutes || 25} دقيقة
                            </span>
                          </div>

                          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-1 text-center">
                            <span className="text-2xl block">❓</span>
                            <span className="text-[11px] font-bold text-slate-500 block">عدد الأسئلة</span>
                            <span className="text-base sm:text-lg font-black text-slate-900">
                              {exam.questions?.length || 0} أسئلة
                            </span>
                          </div>

                          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-1 text-center">
                            <span className="text-2xl block">🎯</span>
                            <span className="text-[11px] font-bold text-slate-500 block">نسبة النجاح</span>
                            <span className="text-base sm:text-lg font-black text-emerald-600">
                              {exam.passingPercentage || 60}%
                            </span>
                          </div>

                          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs space-y-1 text-center">
                            <span className="text-2xl block">🔄</span>
                            <span className="text-[11px] font-bold text-slate-500 block">المحاولات المتاحة</span>
                            <span className={`text-base sm:text-lg font-black ${hasExhausted ? 'text-rose-600' : 'text-slate-900'}`}>
                              {attemptsCount} من {maxAttempts}
                            </span>
                          </div>
                        </div>

                        {/* Previous Result Banner if any */}
                        {attemptsCount > 0 && result && (
                          <div
                            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isPassed
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-rose-50 border-rose-200 text-rose-900'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isPassed ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                              )}
                              <span className="text-xs sm:text-sm font-bold">
                                آخر نتيجة لك: {result.percentage}% ({result.score} من {result.maxScore}) — {isPassed ? 'تم الاجتياز بنجاح ✅' : 'لم يتم الاجتياز بعد ⚠️'}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                setActiveExam(exam);
                                setIsExamReviewOnly(true);
                              }}
                              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>مراجعة الإجابات السابقة</span>
                            </button>
                          </div>
                        )}

                        {/* Exam Rules Checklist */}
                        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-xs text-amber-950">
                          <div className="font-black flex items-center gap-1.5 text-amber-900">
                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                            <span>تعليمات هامة قبل بدء الامتحان:</span>
                          </div>
                          <ul className="space-y-1 font-medium text-[11px] sm:text-xs list-disc list-inside">
                            <li>يبدأ العداد الزمني بالعد التنازلي فور الضغط على زر "أؤكد دخولي للامتحان" بالأسفل.</li>
                            <li>يرجى الحفاظ على استقرار اتصال الإنترنت، وعدم إغلاق أو إعادة تحميل الصفحة أثناء الإجابة.</li>
                            <li>تأكد من الضغط على زر "تسليم الامتحان" في النهاية لتسجيل درجتك الرسمية بحسابك وتحديث تقدمك بالكورس.</li>
                          </ul>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                          {!hasExhausted ? (
                            <button
                              onClick={() => handleConfirmStartExam(exam)}
                              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>🚀 أؤكد دخولي للامتحان وبدء الوقت الآن</span>
                            </button>
                          ) : (
                            <div className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-200 text-slate-600 font-black text-xs sm:text-sm flex items-center justify-center gap-2">
                              <Lock className="w-4 h-4" />
                              <span>تم استنفاد كافة المحاولات المسموحة لهذا الامتحان</span>
                            </div>
                          )}

                          <button
                            onClick={() => setActiveTopMedia(null)}
                            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer"
                          >
                            ✕ إلغاء والعودة للفهرس
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>

          {/* VIEW 1: INTEGRATED LESSONS VIEW */}
          {hasLessons && (
            <div className="space-y-8">
              {/* SECTION: LESSONS ACCORDION INDEX */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <span>فهرس دروس الكورس</span>
                    </h3>
                  </div>
                </div>

                {/* Lessons Vertical Accordion List */}
                <div className="space-y-4">
                  {course.lessons?.map((lesson, idx) => {
                    const isUnlocked = isCourseLessonUnlocked(course, idx, effectiveUserForLocks);
                    const isCompleted = isCourseLessonCompleted(course, lesson, effectiveUserForLocks);
                    const isExpanded = selectedLessonId === lesson.id;
                    const stats = getLessonProgressStats(course, lesson, effectiveUserForLocks);

                    const vCount = lesson.videos?.length || 0;
                    const pCount = lesson.pdfs?.length || 0;
                    const eCount = (lesson.exams?.length || 0) + (lesson.videos?.filter((v) => v.quiz)?.length || 0);

                    return (
                      <div
                        key={lesson.id}
                        id={`lesson_accordion_${lesson.id}`}
                        className={`rounded-3xl border-2 transition-all overflow-hidden ${
                          !isUnlocked
                            ? 'bg-slate-50/90 border-slate-200 opacity-80'
                            : isExpanded
                            ? 'bg-white border-blue-900 shadow-xl ring-2 ring-blue-900/20'
                            : isCompleted
                            ? 'bg-white border-emerald-300 hover:border-emerald-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-blue-900/40 hover:shadow-sm'
                        }`}
                      >
                        {/* 1. LESSON HEADER ROW (يظهر اسم الدرس بوضوح ومعلوماته الأساسية) */}
                        <div
                          onClick={() => {
                            if (isUnlocked) {
                              setSelectedLessonId(isExpanded ? null : lesson.id);
                            } else {
                              setLockNotice(
                                `الدرس (${idx + 1}: ${lesson.title}) مقفل حالياً 🔒. يجب عليك إتمام جميع فيديوهات واختبارات الدرس السابق (${idx}) أولاً لفتحه.`
                              );
                            }
                          }}
                          className={`p-5 sm:p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all select-none ${
                            isExpanded ? 'bg-blue-50/50 border-b border-blue-100' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* Title & Info */}
                          <div className="flex items-start gap-3.5 sm:gap-4 flex-1">
                            <div
                              className={`w-12 h-12 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 shadow-xs transition-all ${
                                !isUnlocked
                                  ? 'bg-slate-200 text-slate-500'
                                  : isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : isExpanded
                                  ? 'bg-blue-950 text-white shadow-md shadow-blue-950/20'
                                  : 'bg-blue-100 text-blue-950'
                              }`}
                            >
                              {!isUnlocked ? (
                                <Lock className="w-5 h-5" />
                              ) : isCompleted ? (
                                <CheckCircle2 className="w-6 h-6" />
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  الدرس #{idx + 1}
                                </span>

                                {!isUnlocked ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-slate-600" />
                                    <span>مقفل 🔒 (أكمل الدرس السابق)</span>
                                  </span>
                                ) : isCompleted ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>مكتمل بالكامل (100%) ✅</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-950 text-[10px] font-black flex items-center gap-1 border border-blue-200">
                                    <Play className="w-3 h-3 fill-current text-blue-900" />
                                    <span>متاح للدراسة</span>
                                  </span>
                                )}
                              </div>

                              {/* Lesson Title (اسم الدرس بارز وواضح) */}
                              <h3 className="font-black text-slate-900 text-base sm:text-lg leading-snug">
                                {lesson.title}
                              </h3>

                              {lesson.description && (
                                <p className="text-xs text-slate-500 font-medium line-clamp-2">
                                  {lesson.description}
                                </p>
                              )}

                              {/* Content Summary Badges */}
                              <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold text-slate-500 pt-0.5">
                                <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                  <Video className="w-3.5 h-3.5 text-blue-900" />
                                  <span>{vCount} فيديو شرح</span>
                                </span>
                                <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                  <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{eCount} كويز</span>
                                </span>
                                {pCount > 0 && (
                                  <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                                    <span>{pCount} مذكرة PDF</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress bar & Toggle action button */}
                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                            {isUnlocked && (
                              <div className="text-left space-y-1 w-32 md:w-40">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                                  <span>الإنجاز:</span>
                                  <span className="font-black text-blue-950">{stats.percentage}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      isCompleted ? 'bg-emerald-500' : 'bg-blue-900'
                                    }`}
                                    style={{ width: `${stats.percentage}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            <div
                              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-xs ${
                                !isUnlocked
                                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                  : isExpanded
                                  ? 'bg-blue-950 text-white shadow-blue-950/20'
                                  : 'bg-slate-100 text-slate-700 hover:bg-blue-950 hover:text-white'
                              }`}
                            >
                              {!isUnlocked ? (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>الدرس مقفل 🔒</span>
                                </>
                              ) : isExpanded ? (
                                <>
                                  <span>إغلاق محتوى الدرس 🔼</span>
                                  <ChevronUp className="w-4 h-4" />
                                </>
                              ) : (
                                <>
                                  <span>فتح محتوى الدرس ⬇️</span>
                                  <ChevronDown className="w-4 h-4" />
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 2. IN-PLACE LESSON CONTENT (يفتح محتوى الدرس تحت اسم الدرس في نفس المكان مباشرة) */}
                        {isExpanded && isUnlocked && (
                          <div className="p-5 sm:p-7 bg-slate-50/60 space-y-6 animate-fadeIn border-t border-slate-100">
                            {/* Jump to Active Top Player Button (if media is currently open) */}
                            {activeTopMedia && (
                              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-blue-900 shrink-0" />
                                  <p className="text-xs text-blue-950 font-bold">
                                    يوجد محتوى معروض حالياً في المشغل بالمنطقة العلوية 🎬
                                  </p>
                                </div>
                                <button
                                  onClick={() => topMediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                  className="px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-black text-xs flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-xs"
                                >
                                  <span>الصعود للمشغل العلوي 🔼</span>
                                </button>
                              </div>
                            )}

                            {/* Videos & Quizzes Section */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                  <Video className="w-4 h-4 text-blue-900" />
                                  <span>فيديوهات الشرح والكويزات التابعة لها ({lesson.videos?.length || 0}):</span>
                                </h4>
                              </div>

                              {lesson.videos && lesson.videos.length > 0 ? (
                                <div className="space-y-4">
                                  {lesson.videos.map((vid, vidIdx) => {
                                    const isVidUnlocked = isLessonVideoUnlocked(course, lesson, vidIdx, effectiveUserForLocks);
                                    const isVidCompleted = isVideoCompleted(vid.id, currentUser);
                                    const isTopPlaying = activeTopMedia?.type === 'video' && activeTopMedia.video.id === vid.id;
                                    const isDueVideo = dueVideoInfo?.video.id === vid.id;

                                    // Dedicated Quiz under this video
                                    const quiz = getVideoQuiz(lesson, vid, vidIdx);
                                    const isQuizUnlocked = isLessonVideoQuizUnlocked(course, lesson, vidIdx, effectiveUserForLocks);
                                    const quizResult = quiz ? getExamResult(quiz.id) : undefined;
                                    const isQuizUnderReview = quizResult?.status === 'under_review';
                                    const isQuizPassed = Boolean(quizResult && quizResult.passed && !isQuizUnderReview);
                                    const maxAttempts = Math.max(1, Number(quiz?.maxAttempts) || 1);
                                    const attemptsCount = Number(quizResult?.attemptsCount) || 0;
                                    const hasExhaustedAttempts = attemptsCount >= maxAttempts;

                                    return (
                                      <div
                                        key={vid.id}
                                        className={`rounded-3xl border-2 p-5 transition-all space-y-4 bg-white ${
                                          !isVidUnlocked
                                            ? 'border-slate-200 opacity-75'
                                            : isTopPlaying
                                            ? 'border-blue-900 shadow-md ring-2 ring-blue-900/20 bg-blue-50/40'
                                            : isDueVideo
                                            ? 'border-blue-900/60 shadow-sm bg-blue-50/25'
                                            : isVidCompleted && (!quiz || isQuizPassed)
                                            ? 'border-emerald-200 bg-emerald-50/20'
                                            : 'border-slate-200 hover:border-blue-900/40'
                                        }`}
                                      >
                                        {/* 1. Video Row */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="flex items-start sm:items-center gap-3">
                                            <div
                                              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black ${
                                                !isVidUnlocked
                                                  ? 'bg-slate-200 text-slate-500'
                                                  : isVidCompleted
                                                  ? 'bg-emerald-600 text-white'
                                                  : isTopPlaying
                                                  ? 'bg-blue-950 text-white shadow-md shadow-blue-950/30 animate-pulse ring-2 ring-blue-700'
                                                  : isDueVideo
                                                  ? 'bg-blue-900 text-white shadow-md shadow-blue-900/30'
                                                  : 'bg-blue-950 text-white shadow-xs'
                                              }`}
                                            >
                                              {!isVidUnlocked ? (
                                                <Lock className="w-5 h-5" />
                                              ) : isVidCompleted ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                              ) : (
                                                <Play className="w-5 h-5 fill-current" />
                                              )}
                                            </div>

                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-950/10 text-blue-950">
                                                  فيديو {vidIdx + 1} من {lesson.videos.length}
                                                </span>

                                                {isDueVideo && (
                                                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-900 text-white shadow-xs flex items-center gap-1">
                                                    <span>🎯 عليه الدور الآن</span>
                                                  </span>
                                                )}

                                                {!isVidUnlocked ? (
                                                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1">
                                                    <Lock className="w-3 h-3" />
                                                    <span>مقفل (أكمل الفيديو والكويز السابق أولاً)</span>
                                                  </span>
                                                ) : isVidCompleted ? (
                                                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span>تمت المشاهدة ✅</span>
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-950 font-black border border-blue-200">
                                                    متاح للمشاهدة الآن
                                                  </span>
                                                )}
                                              </div>

                                              <h5 className="font-black text-slate-900 text-sm">{vid.title}</h5>

                                              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1">
                                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                  <span>{vid.duration || '30 دقيقة'}</span>
                                                </span>
                                                {vid.description && <span>• {vid.description}</span>}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Video Action Button (تشغيل في المنطقة العلوية) */}
                                          <div className="flex items-center gap-2 shrink-0">
                                            {isVidUnlocked ? (
                                              <>
                                                <button
                                                  onClick={() => handlePlayVideoInTopArea(vid, lesson)}
                                                  className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                                    isTopPlaying
                                                      ? 'bg-blue-950 text-white ring-2 ring-blue-700 shadow-md'
                                                      : isDueVideo
                                                      ? 'bg-blue-900 hover:bg-blue-950 text-white font-black ring-2 ring-blue-600 shadow-md shadow-blue-900/20'
                                                      : 'bg-blue-900 hover:bg-blue-950 text-white shadow-md shadow-blue-900/20'
                                                  }`}
                                                >
                                                  <Play className="w-3.5 h-3.5 fill-current" />
                                                  <span>
                                                    {isTopPlaying
                                                      ? 'يُعرض الآن بالمشغل العلوي 🎬'
                                                      : isDueVideo
                                                      ? '▶️ تشغيل الفيديو (عليه الدور)'
                                                      : '▶️ تشغيل في المنطقة العلوية'}
                                                  </span>
                                                </button>

                                                {!isVidCompleted && (
                                                  <button
                                                    onClick={() => handleMarkVideoCompleted(vid.id)}
                                                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                                                    title="تحديد كمشاهد لفتح الكويز مباشرة"
                                                  >
                                                    ✓ إتمام
                                                  </button>
                                                )}
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  setLockNotice(
                                                    `الفيديو (${vidIdx + 1}: ${vid.title}) مقفل حالياً 🔒. لا يمكن فتحه إلا بعد مشاهدة الفيديو السابق (${vidIdx}) واجتياز الكويز الخاص به بنجاح.`
                                                  );
                                                }}
                                                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-600 font-black text-xs flex items-center gap-1.5 cursor-not-allowed"
                                              >
                                                <Lock className="w-3.5 h-3.5" />
                                                <span>مقفل 🔒</span>
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Video Watch Progress Bar (شريط التقدم في المشاهدة واستئناف التشغيل) */}
                                        {(() => {
                                          const vidProgress = getVideoProgress(vid.id || vid.url, currentUser?.id);
                                          const isFinished = isVidCompleted || vidProgress.completed || vidProgress.percentage >= 90;
                                          const percent = isFinished ? 100 : vidProgress.percentage;
                                          return (
                                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                                              <div className="flex items-center justify-between text-[11px] font-bold">
                                                <span className="text-slate-600 flex items-center gap-1.5">
                                                  <Clock className="w-3.5 h-3.5 text-blue-900" />
                                                  <span>شريط التقدم في المشاهدة:</span>
                                                </span>
                                                <span className={isFinished ? 'text-emerald-600 font-black' : percent > 0 ? 'text-blue-900 font-black' : 'text-slate-400 font-medium'}>
                                                  {isFinished
                                                    ? 'تمت المشاهدة بالكامل (100%) ✅'
                                                    : percent > 0
                                                    ? `${percent}% (دقيقة ${formatSecondsToTime(vidProgress.currentTime)} من ${formatSecondsToTime(vidProgress.duration || 1800)})`
                                                    : 'لم تبدأ المشاهدة بعد (0%)'}
                                                </span>
                                              </div>

                                              {/* Visual Progress Bar */}
                                              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden relative border border-slate-200/70 shadow-inner">
                                                <div
                                                  className={`h-full rounded-full transition-all duration-500 ${
                                                    isFinished
                                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                                      : percent > 0
                                                      ? 'bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-500'
                                                      : 'bg-slate-200'
                                                  }`}
                                                  style={{ width: `${isFinished ? 100 : Math.max(percent > 0 ? 3 : 0, percent)}%` }}
                                                />
                                              </div>

                                              {/* Resume Notice if student stopped mid-video */}
                                              {vidProgress.currentTime > 5 && !isFinished && (
                                                <div className="flex items-center justify-between text-[10px] text-blue-950 bg-blue-50/70 px-2.5 py-1.5 rounded-xl border border-blue-200/60 mt-0.5">
                                                  <span className="flex items-center gap-1.5 font-bold">
                                                    <span>⏱️</span>
                                                    <span>سيعود الفيديو للعمل تلقائياً من حيث توقفت: <b>دقيقة {formatSecondsToTime(vidProgress.currentTime)}</b></span>
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      clearVideoProgress(vid.id || vid.url, currentUser?.id);
                                                    }}
                                                    className="text-[10px] text-slate-500 hover:text-rose-600 font-bold transition-colors cursor-pointer underline shrink-0"
                                                  >
                                                    البدء من الأول 🔄
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* 2. Dedicated Quiz Under Video */}
                                        {quiz ? (
                                          <div
                                            className={`rounded-2xl border-2 p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                              !isQuizUnlocked
                                                ? 'bg-slate-100/80 border-slate-200 text-slate-500'
                                                : isQuizPassed
                                                ? 'bg-emerald-50 border-emerald-300'
                                                : 'bg-blue-50/60 border-blue-900/25'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
                                                  !isQuizUnlocked
                                                    ? 'bg-slate-200 text-slate-500'
                                                    : isQuizPassed
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-blue-900 text-white shadow-sm shadow-blue-900/20'
                                                }`}
                                              >
                                                {!isQuizUnlocked ? (
                                                  <Lock className="w-5 h-5" />
                                                ) : isQuizPassed ? (
                                                  <CheckCircle2 className="w-5 h-5" />
                                                ) : (
                                                  <HelpCircle className="w-5 h-5" />
                                                )}
                                              </div>

                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                                                    كويز الفيديو #{vidIdx + 1}
                                                  </span>

                                                  {!isQuizUnlocked ? (
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 flex items-center gap-1">
                                                      <Lock className="w-3 h-3" />
                                                      <span>مقفل (شاهد الفيديو أعلاه أولاً لفتحه)</span>
                                                    </span>
                                                  ) : isQuizUnderReview ? (
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                                      <Clock className="w-3 h-3" />
                                                      <span>قيد التصحيح ⏳ (بانتظار تصحيح المدرس)</span>
                                                    </span>
                                                  ) : isQuizPassed ? (
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                                                      <Check className="w-3 h-3" />
                                                      <span>تم الاجتياز بنجاح ({quizResult?.percentage}%)</span>
                                                    </span>
                                                  ) : attemptsCount > 0 ? (
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                                      لم يُجتز بعد ({quizResult?.percentage}% - المطلوب {quiz.passingPercentage}%)
                                                    </span>
                                                  ) : (
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-950 font-bold border border-blue-200">
                                                      مطلوب اجتيازه لفتح الفيديو التالي 🔓
                                                    </span>
                                                  )}
                                                </div>

                                                <h6 className="font-black text-xs sm:text-sm text-slate-900">{quiz.title}</h6>

                                                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                                  <span>المدة: {quiz.durationMinutes} دقيقة</span>
                                                  <span>•</span>
                                                  <span>{quiz.questions.length} أسئلة</span>
                                                  <span>•</span>
                                                  <span>نسبة النجاح: {quiz.passingPercentage}%</span>
                                                  {attemptsCount > 0 && (
                                                    <span>• المحاولات: {attemptsCount} من {maxAttempts}</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Quiz Action Buttons (يفتح تأكيد الدخول بالمنطقة العلوية) */}
                                            <div className="flex items-center gap-2 shrink-0">
                                              {!isQuizUnlocked ? (
                                                <button
                                                  onClick={() => {
                                                    setLockNotice(
                                                      `كويز الفيديو (${quiz.title}) مقفل 🔒. يجب إنهاء مشاهدة الفيديو أعلاه وتأكيد فهم الشرح أولاً لبدء الكويز.`
                                                    );
                                                  }}
                                                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-500 font-black text-xs flex items-center gap-1 cursor-pointer"
                                                >
                                                  <Lock className="w-3.5 h-3.5" />
                                                  <span>مقفل 🔒</span>
                                                </button>
                                              ) : (
                                                <>
                                                  {attemptsCount > 0 && (
                                                    <button
                                                      onClick={() => {
                                                        setActiveExam(quiz);
                                                        setIsExamReviewOnly(true);
                                                      }}
                                                      className="px-3 py-2 rounded-xl bg-white border border-blue-900/20 hover:bg-blue-50 text-blue-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                                                    >
                                                      <Eye className="w-3.5 h-3.5 text-blue-900" />
                                                      <span>مراجعة الإجابات</span>
                                                    </button>
                                                  )}

                                                  {!hasExhaustedAttempts ? (
                                                    <button
                                                      onClick={() => {
                                                        handleRequestExamConfirmation(quiz, lesson.title, vid.title, lesson.id);
                                                      }}
                                                      className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                                                        isQuizPassed
                                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                          : 'bg-blue-900 hover:bg-blue-950 text-white shadow-md shadow-blue-900/25 ring-1 ring-blue-800'
                                                      }`}
                                                    >
                                                      <Play className="w-3.5 h-3.5 fill-current" />
                                                      <span>
                                                        {isQuizPassed
                                                          ? 'تأكيد إعادة الكويز للتحسين ⏱️'
                                                          : attemptsCount > 0
                                                          ? `تأكيد المحاولة (${attemptsCount + 1}/${maxAttempts}) ⏱️`
                                                          : 'تأكيد ودخول كويز الفيديو ⏱️'}
                                                      </span>
                                                    </button>
                                                  ) : (
                                                    <div className="px-3 py-2 rounded-xl bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1">
                                                      <Lock className="w-3.5 h-3.5" />
                                                      <span>استُنفدت المحاولات</span>
                                                    </div>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-[11px] text-slate-400 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-1.5">
                                            <span>ℹ️ هذا الفيديو بدون كويز، بمجرد إنهائه يُفتح الفيديو التالي مباشرة.</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">لا توجد فيديوهات مضافة بعد في هذا الدرس.</p>
                              )}
                            </div>

                            {/* PDFs & Notes Section (تفتح للمعاينة بالمنطقة العلوية) */}
                            {lesson.pdfs && lesson.pdfs.length > 0 && (
                              <div className="space-y-4 pt-4 border-t border-slate-200/80">
                                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-rose-600" />
                                  <span>المذكرات وملفات الـ PDF والملخصات بالدرس ({lesson.pdfs.length}):</span>
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {lesson.pdfs.map((pdf) => (
                                    <div
                                      key={pdf.id}
                                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                          <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h5 className="font-bold text-xs text-slate-900 leading-snug">{pdf.title}</h5>
                                          <div className="text-[11px] text-slate-500 mt-1">
                                            {pdf.pageCount && <span>{pdf.pageCount} صفحة • </span>}
                                            <span>{pdf.description || 'مذكرة دراسية مخصصة للمطالعة والتحميل'}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        <button
                                          onClick={() => handleOpenPdfInTopArea(pdf, lesson.title, lesson.id)}
                                          className="flex-1 py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>فتح ومعاينة بالمنطقة العلوية</span>
                                        </button>

                                        <a
                                          href={pdf.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1"
                                          title="فتح في تبويب مستقل"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>

                                        <a
                                          href={pdf.fileUrl}
                                          download={pdf.title + '.pdf'}
                                          className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all flex items-center justify-center gap-1"
                                          title="تحميل الملف"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Lesson Exams Section (if any) */}
                            {lesson.exams && lesson.exams.length > 0 && (
                              <div className="space-y-3 pt-4 border-t border-slate-200/80">
                                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-indigo-600" />
                                  <span>امتحانات شاملة لهذا الدرس ({lesson.exams.length}):</span>
                                </h4>

                                <div className="space-y-2">
                                  {lesson.exams.map((lexam) => {
                                    const examResult = getExamResult(lexam.id);
                                    const isExamPassed = Boolean(examResult && examResult.passed);

                                    return (
                                      <div
                                        key={lexam.id}
                                        className="p-4 rounded-2xl border border-indigo-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                      >
                                        <div className="space-y-1.5">
                                          <h5 className="font-black text-xs sm:text-sm text-slate-900">{lexam.title}</h5>
                                          <span className="text-[11px] text-slate-500 font-medium block">
                                            المدة: {lexam.durationMinutes} دقيقة • {lexam.questions.length} أسئلة • نسبة النجاح: {lexam.passingPercentage}%
                                          </span>
                                          {examResult && (
                                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-black font-mono border border-indigo-100">
                                                الدرجة: {examResult.score}/{examResult.maxScore} (%{examResult.percentage})
                                              </span>
                                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                                                التسليم: {examResult.submittedAt || examResult.completedAt || 'تم التسليم'}
                                              </span>
                                              <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-100">
                                                الوقت المستغرق: {examResult.durationTakenFormatted || 'أقل من دقيقة'}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        <button
                                          onClick={() => handleRequestExamConfirmation(lexam, lesson.title, undefined, lesson.id)}
                                          className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                                            isExamPassed
                                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                                          }`}
                                        >
                                          <Play className="w-3.5 h-3.5 fill-current" />
                                          <span>{isExamPassed ? 'إعادة الامتحان للتحسين ⏱️' : 'تأكيد ودخول الامتحان بالمنطقة العلوية ⏱️'}</span>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Celebration Banner when Lesson is 100% Completed */}
                            {isCompleted && idx < (course.lessons?.length || 0) - 1 && (
                              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md space-y-2 animate-fadeIn">
                                <div className="flex items-center gap-2">
                                  <Award className="w-5 h-5 text-amber-300" />
                                  <h4 className="font-black text-sm">أحسنت صنعاً! لقد أتممت هذا الدرس بنجاح بنسبة 100% 🎉</h4>
                                </div>
                                <p className="text-xs text-emerald-50 font-medium">
                                  تم فتح الدرس التالي ({course.lessons![idx + 1].title}) تلقائياً ويمكنك البدء في دراسته الآن.
                                </p>
                                <button
                                  onClick={() => {
                                    const nextLesson = course.lessons![idx + 1];
                                    setSelectedLessonId(nextLesson.id);
                                    setTimeout(() => {
                                      const el = document.getElementById(`lesson_accordion_${nextLesson.id}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 100);
                                  }}
                                  className="px-4 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer mt-2"
                                >
                                  <span>الانتقال إلى الدرس التالي ({course.lessons![idx + 1].title})</span>
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: GLOBAL SEQUENTIAL EXAMS TIMELINE */}
          {(activeViewTab === 'exams' || !hasLessons) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>مسار الامتحانات التسلسلي للكورس:</span>
                </h3>
              </div>

              {course.exams && course.exams.length > 0 ? (
                <div className="space-y-4">
                  {course.exams.map((exam, index) => {
                    const unlocked = isExamUnlocked(exam, index);
                    const result = getExamResult(exam.id);
                    const isUnderReview = result?.status === 'under_review';
                    const isPassed = Boolean(result && result.passed && !isUnderReview);
                    const maxAttempts = Math.max(1, Number(exam.maxAttempts) || 1);
                    const attemptsCount = Number(result?.attemptsCount) || 0;
                    const hasExhaustedAttempts = attemptsCount >= maxAttempts;

                    return (
                      <div
                        key={exam.id}
                        className={`bg-white border rounded-[30px] p-6 shadow-xs transition-all ${
                          unlocked
                            ? 'border-slate-200 hover:border-indigo-300'
                            : 'border-slate-200 opacity-75 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start sm:items-center gap-4">
                            {/* Status Icon */}
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black shrink-0 ${
                                isPassed
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                                  : unlocked
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {isPassed ? (
                                <CheckCircle2 className="w-6 h-6" />
                              ) : unlocked ? (
                                <Unlock className="w-5 h-5" />
                              ) : (
                                <Lock className="w-5 h-5" />
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                  الامتحان #{exam.order || index + 1}
                                </span>
                                <span className="text-xs text-slate-500 font-bold">
                                  الدرس: {exam.lessonTitle}
                                </span>
                                {isUnderReview ? (
                                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>قيد التصحيح ⏳ (بانتظار تصحيح المدرس)</span>
                                  </span>
                                ) : isPassed ? (
                                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    تم الاجتياز بنسبة {result?.percentage}% ({result?.score}/{result?.maxScore})
                                  </span>
                                ) : null}
                                <span
                                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                                    hasExhaustedAttempts
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : attemptsCount > 0
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  المحاولات: {attemptsCount} من {maxAttempts}
                                </span>
                              </div>

                              <h4 className="text-base sm:text-lg font-black text-slate-900">
                                {exam.title}
                              </h4>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>المدة: {exam.durationMinutes || 25} دقيقة</span>
                                </span>
                                <span>•</span>
                                <span>{exam.questions.length} أسئلة (اختياري ومقالي)</span>
                                <span>•</span>
                                <span>نسبة النجاح المطلوبة: {exam.passingPercentage || 60}%</span>
                              </div>

                              {/* Detailed Submission Time, Duration, and Score on Exam Card */}
                              {result && (
                                <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 block">درجة الطالب في الامتحان:</span>
                                    <span className="font-mono font-black text-indigo-700">
                                      {isUnderReview
                                        ? `قيد التصحيح ⏳ (الاختياري: ${result.score}/${result.maxScore})`
                                        : `${result.score} / ${result.maxScore} (%${result.percentage})`}
                                    </span>
                                  </div>
                                  <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 block">زمن تسليم الامتحان:</span>
                                    <span className="font-bold text-slate-800 text-[11px]">
                                      {result.submittedAt || result.completedAt || 'تم التسليم'}
                                    </span>
                                  </div>
                                  <div className="p-2 rounded-xl bg-white border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 block">الوقت المستغرق (يوم/ساعة/دقيقة/ثانية):</span>
                                    <span className="font-bold text-amber-800 text-[11px]">
                                      {result.durationTakenFormatted || 'أقل من دقيقة'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="shrink-0 pt-2 sm:pt-0">
                            {unlocked ? (
                              <div className="flex flex-col sm:flex-row items-center gap-2">
                                {attemptsCount > 0 && (
                                  <button
                                    onClick={() => {
                                      setActiveExam(exam);
                                      setIsExamReviewOnly(true);
                                    }}
                                    className="w-full sm:w-auto px-5 py-3 rounded-2xl font-black text-xs sm:text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                                  >
                                    <Eye className="w-4 h-4 text-indigo-600" />
                                    <span>عرض النتيجة والحل</span>
                                  </button>
                                )}

                                {!hasExhaustedAttempts ? (
                                  <button
                                    onClick={() => {
                                      handleRequestExamConfirmation(exam, exam.lessonTitle);
                                    }}
                                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                                  >
                                    <Play className="w-4 h-4 fill-current" />
                                    <span>
                                      {attemptsCount > 0
                                        ? `تأكيد ودخول المحاولة (${attemptsCount + 1} من ${maxAttempts}) ⏱️`
                                        : 'تأكيد ودخول الامتحان ⏱️'}
                                    </span>
                                  </button>
                                ) : (
                                  <div className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center gap-1.5 border border-slate-200">
                                    <Lock className="w-4 h-4" />
                                    <span>استُنفدت المحاولات</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-100 px-4 py-3 rounded-2xl">
                                <Lock className="w-4 h-4" />
                                <span>مقفل (اجتز الامتحان #{index} أولاً)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl">
                  <p className="text-xs text-slate-500">لا توجد امتحانات عامة مضافة بعد في هذا الكورس.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PDF Inline Preview Modal */}
      {previewPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-slate-900 text-sm truncate max-w-md">{previewPdf.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdf.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح بصفحة جديدة</span>
                </a>
                <button
                  onClick={() => setPreviewPdf(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewPdf.fileUrl}
                title={previewPdf.title}
                className="w-full h-full rounded-2xl border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Printable PDF Certificate Modal */}
      <CertificateModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        studentName={currentUser?.name || 'طالب متفوق'}
        studentGrade={currentUser?.grade || course.schoolYear}
        courseTitle={course.title}
        scorePercentage={Math.max(courseOverallProgress, 95)}
        instructorName={course.instructor || 'د. حسام شحاته'}
      />
    </div>
  );
};
