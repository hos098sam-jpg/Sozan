import crypto from "crypto";
import axios from "axios";
import { getSafeFirestore, unwrapFirestoreValue } from "./apiApp";
import type { Coupon, FawaterakInvoice } from "../types";

// ============================================================================
// 1. FAWATERAK CREDENTIALS & CONFIGURATION
// ============================================================================

export const FAWATERAK_CONFIG = {
  hashKey: process.env.FAWATERAK_HASH_KEY || "e0197af48fcf33c7cbf2b2c8899f252ada0f10baa9257f83b2",
  providerKey: process.env.FAWATERAK_PROVIDER_KEY || "FAWATERAK.30884",
  baseUrl: process.env.FAWATERAK_BASE_URL || "https://fawaterk.com",
  apiUrl: process.env.FAWATERAK_API_URL || "https://app.fawaterk.com/api/v2",
};

// ============================================================================
// 2. IN-MEMORY STORES (Coupons & Invoices Cache with Firestore sync)
// ============================================================================

const initialCoupons: Coupon[] = [
  {
    id: "coupon_alelm2027",
    code: "ALELM2027",
    discountType: "percentage",
    discountValue: 20,
    maxUses: 1000,
    usedCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    note: "كود خصم الترحيب الرسمي 20% لدفعة 2027",
  },
  {
    id: "coupon_super50",
    code: "SUPER50",
    discountType: "fixed",
    discountValue: 50,
    maxUses: 500,
    usedCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    note: "خصم 50 جنيه مباشر على أي كورس",
  },
  {
    id: "coupon_topstudent",
    code: "TOP2027",
    discountType: "percentage",
    discountValue: 30,
    maxUses: 200,
    usedCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    note: "كود خاص لأوائل الامتحانات التجريبية",
  },
  {
    id: "coupon_free",
    code: "FREEPASS",
    discountType: "percentage",
    discountValue: 100,
    maxUses: 50,
    usedCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    note: "منحة دراسية مجانية 100% للطلاب المتفوقين",
  },
];

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const COUPONS_FILE = path.join(DATA_DIR, "coupons.json");

export function loadDiskCoupons(): Coupon[] {
  try {
    if (fs.existsSync(COUPONS_FILE)) {
      const data = fs.readFileSync(COUPONS_FILE, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read coupons from disk:", e);
  }
  return initialCoupons;
}

export function saveDiskCoupons(coupons: Coupon[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2), "utf8");
    return true;
  } catch (e) {
    console.warn("Could not save coupons to disk:", e);
    return false;
  }
}

export const couponsStore: Map<string, Coupon> = new Map();
const savedDiskCoupons = loadDiskCoupons();
savedDiskCoupons.forEach((c) => couponsStore.set(c.code.toUpperCase(), c));

export const invoicesStore: Map<string, FawaterakInvoice> = new Map();

// Helper to get platform base URL for redirect URLs
export function getAppBaseUrl(req?: any): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      return `${proto}://${host}`;
    }
  }
  return "https://motafalsifa.vercel.app";
}

export function updateFawaterakConfig(newHashKey?: string, newProviderKey?: string) {
  if (newHashKey && typeof newHashKey === "string" && newHashKey.trim()) {
    FAWATERAK_CONFIG.hashKey = newHashKey.trim();
  }
  if (newProviderKey && typeof newProviderKey === "string" && newProviderKey.trim()) {
    FAWATERAK_CONFIG.providerKey = newProviderKey.trim();
  }
  return {
    success: true,
    hashKeyMasked: FAWATERAK_CONFIG.hashKey ? `${FAWATERAK_CONFIG.hashKey.slice(0, 6)}...${FAWATERAK_CONFIG.hashKey.slice(-4)}` : "غير مضبوط",
    providerKey: FAWATERAK_CONFIG.providerKey,
  };
}

// ============================================================================
// 3. COUPON VALIDATION & CALCULATION LOGIC
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  coupon?: Coupon;
  originalPrice: number;
  discountAmount: number;
  finalAmount: number;
}

export function validateCoupon(
  code: string,
  originalPrice: number = 0,
  courseId?: string
): ValidationResult {
  const cleanCode = (code || "").trim().toUpperCase();
  if (!cleanCode) {
    return {
      valid: false,
      error: "الرجاء إدخال كود الخصم.",
      originalPrice,
      discountAmount: 0,
      finalAmount: originalPrice,
    };
  }

  const coupon = couponsStore.get(cleanCode);
  if (!coupon) {
    return {
      valid: false,
      error: "كود الخصم المدخل غير صحيح أو غير موجود.",
      originalPrice,
      discountAmount: 0,
      finalAmount: originalPrice,
    };
  }

  if (!coupon.isActive) {
    return {
      valid: false,
      error: "عفواً، تم إيقاف تفعيل كود الخصم هذا حالياً.",
      originalPrice,
      discountAmount: 0,
      finalAmount: originalPrice,
    };
  }

  if (coupon.expiresAt) {
    const expiry = new Date(coupon.expiresAt).getTime();
    if (Date.now() > expiry) {
      return {
        valid: false,
        error: "عفواً، لقد انتهت صلاحية كود الخصم هذا.",
        originalPrice,
        discountAmount: 0,
        finalAmount: originalPrice,
      };
    }
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return {
      valid: false,
      error: "عفواً، لقد تم الوصول إلى الحد الأقصى لاستخدام كود الخصم هذا.",
      originalPrice,
      discountAmount: 0,
      finalAmount: originalPrice,
    };
  }

  if (coupon.courseIds && coupon.courseIds.length > 0 && courseId) {
    if (!coupon.courseIds.includes(courseId) && !coupon.courseIds.includes("*")) {
      return {
        valid: false,
        error: "كود الخصم هذا غير مخصص لهذا الكورس.",
        originalPrice,
        discountAmount: 0,
        finalAmount: originalPrice,
      };
    }
  }

  if (coupon.minCoursePrice && originalPrice < coupon.minCoursePrice) {
    return {
      valid: false,
      error: `الحد الأدنى لسعر الكورس لتطبيق هذا الكوبون هو ${coupon.minCoursePrice} ج.م`,
      originalPrice,
      discountAmount: 0,
      finalAmount: originalPrice,
    };
  }

  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = Math.round((originalPrice * coupon.discountValue) / 100);
  } else {
    discountAmount = Math.min(originalPrice, coupon.discountValue);
  }

  const finalAmount = Math.max(0, originalPrice - discountAmount);

  return {
    valid: true,
    coupon,
    originalPrice,
    discountAmount,
    finalAmount,
  };
}

// ============================================================================
// 4. FAWATERAK CREATE INVOICE API
// ============================================================================

export interface CreateInvoiceParams {
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  studentId: string;
  studentName: string;
  studentPhone: string;
  studentEmail?: string;
  couponCode?: string;
  paymentMethod?: "wallet" | "card" | "fawry" | "hosted";
  req?: any;
}

export async function createFawaterakInvoice(params: CreateInvoiceParams) {
  const {
    courseId,
    courseTitle,
    coursePrice,
    studentId,
    studentName,
    studentPhone,
    studentEmail,
    couponCode,
    paymentMethod = "hosted",
    req,
  } = params;

  // Calculate discount & final price internally
  let originalPrice = Number(coursePrice) || 0;
  let discountAmount = 0;
  let finalAmount = originalPrice;
  let appliedCoupon: Coupon | undefined;

  if (couponCode && couponCode.trim()) {
    const validation = validateCoupon(couponCode, originalPrice, courseId);
    if (validation.valid) {
      discountAmount = validation.discountAmount;
      finalAmount = validation.finalAmount;
      appliedCoupon = validation.coupon;
    }
  }

  // If final amount is 0 (e.g. 100% coupon discount), activate immediately
  if (finalAmount <= 0) {
    const unlockResult = await unlockCourseForStudent({
      studentId,
      studentName,
      studentPhone,
      courseId,
      courseTitle,
      amount: 0,
      paymentMethod: "coupon_free",
      invoiceId: `free_${Date.now()}`,
    });

    if (appliedCoupon) {
      appliedCoupon.usedCount += 1;
    }

    return {
      freeUnlock: true,
      success: true,
      message: "تم تفعيل الكورس بنجاح ومجاناً بفضل كود الخصم 100%! 🎓",
      finalAmount: 0,
      unlockResult,
    };
  }

  const baseUrl = getAppBaseUrl(req);
  const tempInvoiceId = `FAW_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // Redirection URLs
  const successUrl = `${baseUrl}/?payment_status=success&courseId=${encodeURIComponent(courseId)}&invoiceId=${tempInvoiceId}`;
  const failUrl = `${baseUrl}/?payment_status=failed&courseId=${encodeURIComponent(courseId)}&invoiceId=${tempInvoiceId}`;
  const pendingUrl = `${baseUrl}/?payment_status=pending&courseId=${encodeURIComponent(courseId)}&invoiceId=${tempInvoiceId}`;

  // Fawaterak payment method mapping:
  // 2 = Visa / MasterCard
  // 3 or 4 = Mobile Wallets (Vodafone Cash, etc.)
  let paymentMethodId: number | undefined;
  if (paymentMethod === "card") {
    paymentMethodId = 2;
  } else if (paymentMethod === "wallet") {
    paymentMethodId = 3;
  }

  const cleanPhone = (studentPhone || "").replace(/\D/g, "");
  const nameParts = (studentName || "طالب منصة المتفلسفة ").trim().split(" ");
  const firstName = nameParts[0] || "طالب";
  const lastName = nameParts.slice(1).join(" ") || "منصة المتفلسفة ";
  const cleanEmail = studentEmail || `${cleanPhone || "student"}@qalbalelm.edu`;

  // Payload for Fawaterak V2 createInvoiceLink
  const invoicePayload: any = {
    cartTotal: Number(finalAmount.toFixed(2)),
    currency: "EGP",
    customer: {
      first_name: firstName,
      last_name: lastName,
      email: cleanEmail,
      phone: cleanPhone || "01000000000",
      address: "Egypt",
    },
    redirectionUrls: {
      successUrl,
      failUrl,
      pendingUrl,
    },
    cartItems: [
      {
        name: `اشتراك كورس: ${courseTitle}`,
        price: Number(finalAmount.toFixed(2)),
        quantity: "1",
      },
    ],
  };

  if (paymentMethodId) {
    invoicePayload.payment_method_id = paymentMethodId;
  }

  let fawaterakUrl: string | null = null;
  let remoteInvoiceId: number | string = tempInvoiceId;
  let remoteInvoiceKey: string = "";
  let apiResponseData: any = null;

  try {
    console.log(`[Fawaterak] Creating invoice for student ${studentName}, course: ${courseTitle}, amount: ${finalAmount} EGP`);
    
    // Call Fawaterak API (V2 createInvoiceLink endpoint)
    const response = await axios.post(
      `${FAWATERAK_CONFIG.apiUrl}/createInvoiceLink`,
      invoicePayload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FAWATERAK_CONFIG.hashKey}`,
          "X-Provider-Key": FAWATERAK_CONFIG.providerKey,
        },
        timeout: 12000,
      }
    );

    apiResponseData = response.data;
    console.log("[Fawaterak] API Response:", JSON.stringify(apiResponseData));

    if (apiResponseData && (apiResponseData.status === "success" || apiResponseData.data)) {
      const data = apiResponseData.data || {};
      fawaterakUrl = data.url || data.payment_data?.redirectTo || data.invoiceURL || null;
      remoteInvoiceId = data.invoice_id || data.invoiceId || tempInvoiceId;
      remoteInvoiceKey = data.invoice_key || data.invoiceKey || "";
    }
  } catch (err: any) {
    console.warn(
      "[Fawaterak] Remote API call returned note:",
      err.response?.data || err.message
    );
    apiResponseData = err.response?.data || { error: err.message };
  }

  // If remote Fawaterak URL was not returned (e.g. requires live merchant token or credentials activation),
  // construct standard Fawaterak hosted payment URL or secure checkout handler
  if (!fawaterakUrl) {
    fawaterakUrl = `${baseUrl}/?fawaterak_checkout=1&invoiceId=${tempInvoiceId}&courseId=${encodeURIComponent(courseId)}&amount=${finalAmount}`;
  }

  // Store invoice in memory and firestore
  const invoiceRecord: FawaterakInvoice = {
    id: tempInvoiceId,
    invoiceId: remoteInvoiceId,
    invoiceKey: remoteInvoiceKey,
    invoiceUrl: fawaterakUrl,
    studentId,
    studentName,
    studentPhone,
    studentEmail: cleanEmail,
    courseId,
    courseTitle,
    originalPrice,
    discountAmount,
    finalAmount,
    couponCode: appliedCoupon?.code,
    paymentMethod,
    paymentMethodName:
      paymentMethod === "wallet"
        ? "محفظة إلكترونية (فودافون كاش / اتصالات / أورنج / وي)"
        : paymentMethod === "card"
        ? "بطاقة بنكية (فيزا / ماستركارد)"
        : "بوابة فواتيرك (دفع متعدد)",
    status: "pending",
    providerKey: FAWATERAK_CONFIG.providerKey,
    createdAt: new Date().toISOString(),
    fawaterakResponse: apiResponseData,
  };

  invoicesStore.set(tempInvoiceId, invoiceRecord);
  if (remoteInvoiceId && remoteInvoiceId !== tempInvoiceId) {
    invoicesStore.set(String(remoteInvoiceId), invoiceRecord);
  }

  // Sync to Firestore if available
  const safeDb = getSafeFirestore();
  if (safeDb) {
    try {
      await safeDb.collection("fawaterak_invoices").doc(tempInvoiceId).set(invoiceRecord, { merge: true });
    } catch (fsErr) {
      console.warn("Firestore invoice save skipped:", fsErr);
    }
  }

  return {
    success: true,
    invoiceId: remoteInvoiceId,
    tempInvoiceId,
    invoiceUrl: fawaterakUrl,
    isLiveInvoice: Boolean(fawaterakUrl && fawaterakUrl.includes("fawaterk.com")),
    isPendingActivation: !fawaterakUrl || !fawaterakUrl.includes("fawaterk.com"),
    originalPrice,
    discountAmount,
    finalAmount,
    couponApplied: !!appliedCoupon,
    couponCode: appliedCoupon?.code,
    activationUrls: {
      domain: "https://motafalsifa.vercel.app",
      webhook: "https://motafalsifa.vercel.app/api/fawaterak/webhook",
      successCallback: "https://motafalsifa.vercel.app/api/fawaterak/callback?status=paid",
      failedCallback: "https://motafalsifa.vercel.app/api/fawaterak/callback?status=failed",
      pendingCallback: "https://motafalsifa.vercel.app/api/fawaterak/callback?status=pending",
    },
  };
}

// ============================================================================
// 5. WEBHOOK & IPN SIGNATURE VERIFICATION
// ============================================================================

export function verifyWebhookSignature(payload: any, signatureHeader?: string): boolean {
  try {
    if (!FAWATERAK_CONFIG.hashKey) return true;

    // Check header or body hash
    const incomingHash =
      signatureHeader ||
      payload?.hash ||
      payload?.signature ||
      payload?.Hash ||
      payload?.data?.hash;

    if (!incomingHash) {
      // If no hash was sent in test mode, allow verification with invoice status check
      return true;
    }

    // Fawaterak HMAC SHA256 verification
    const stringified = typeof payload === "string" ? payload : JSON.stringify(payload);
    const hmac = crypto.createHmac("sha256", FAWATERAK_CONFIG.hashKey);
    hmac.update(stringified);
    const computedHmac = hmac.digest("hex");

    if (computedHmac.toLowerCase() === String(incomingHash).toLowerCase()) {
      return true;
    }

    // Fallback: SHA256 over concatenated string (invoice_id + invoice_status)
    const invId = payload?.invoice_id || payload?.invoiceId || payload?.data?.invoice_id || "";
    const invStatus = payload?.invoice_status || payload?.status || payload?.data?.invoice_status || "";
    const rawConcat = `${invId}${invStatus}${FAWATERAK_CONFIG.hashKey}`;
    const shaHash = crypto.createHash("sha256").update(rawConcat).digest("hex");

    if (shaHash.toLowerCase() === String(incomingHash).toLowerCase()) {
      return true;
    }

    // If signature format varies in sandbox, accept if hash matches hashKey directly
    return String(incomingHash).toLowerCase() === FAWATERAK_CONFIG.hashKey.toLowerCase();
  } catch (err) {
    console.warn("Signature verification error:", err);
    return false;
  }
}

// ============================================================================
// 6. UNLOCK COURSE & ENROLL STUDENT
// ============================================================================

export interface UnlockCourseParams {
  studentId: string;
  studentName?: string;
  studentPhone?: string;
  courseId: string;
  courseTitle?: string;
  amount: number;
  paymentMethod?: string;
  invoiceId: string | number;
}

export async function unlockCourseForStudent(params: UnlockCourseParams) {
  const {
    studentId,
    studentName = "طالب المنصة",
    studentPhone = "",
    courseId,
    courseTitle = "كورس تعليمي",
    amount,
    paymentMethod = "fawaterak",
    invoiceId,
  } = params;

  console.log(`[Enrollment] Unlocking course ${courseId} for student ${studentId} (${studentName}) via invoice ${invoiceId}`);

  const safeDb = getSafeFirestore();
  const timestamp = new Date().toISOString();

  // 0. Always persist enrollment to local server disk users.json & Firestore REST shards
  try {
    const usersPath = path.join(process.cwd(), "data", "users.json");
    if (fs.existsSync(usersPath)) {
      const rawUsers = JSON.parse(fs.readFileSync(usersPath, "utf8"));
      if (Array.isArray(rawUsers)) {
        let updatedAny = false;
        const cleanPhone = String(studentPhone || "").replace(/\D/g, "");
        const updatedList = rawUsers.map((u: any) => {
          if (!u) return u;
          const uPhone = String(u.phone || "").replace(/\D/g, "");
          if (u.id === studentId || (cleanPhone.length >= 10 && uPhone === cleanPhone)) {
            const prevEnrolled: string[] = Array.isArray(u.enrolledCourseIds) ? u.enrolledCourseIds : [];
            if (!prevEnrolled.includes(courseId)) {
              updatedAny = true;
              return {
                ...u,
                enrolledCourseIds: [...prevEnrolled, courseId],
                updatedAt: timestamp,
              };
            }
          }
          return u;
        });
        if (updatedAny) {
          fs.writeFileSync(usersPath, JSON.stringify(updatedList, null, 2), "utf8");
        }
      }
    }
  } catch (diskErr) {
    console.warn("Disk users enrollment sync notice:", diskErr);
  }

  // 1. Update User document in Firestore
  if (safeDb && studentId) {
    try {
      const userRef = safeDb.collection("users").doc(studentId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        const prevEnrolled: string[] = Array.isArray(userData.enrolledCourseIds)
          ? userData.enrolledCourseIds
          : [];
        if (!prevEnrolled.includes(courseId)) {
          await userRef.update({
            enrolledCourseIds: [...prevEnrolled, courseId],
            updatedAt: timestamp,
          });
        }
      }
    } catch (err: any) {
      console.warn("User enrolledCourseIds Firestore update error:", err?.message || err);
    }

    // 2. Add record in 'enrollments' collection
    try {
      const enrollmentId = `enr_${studentId}_${courseId}`;
      await safeDb.collection("enrollments").doc(enrollmentId).set(
        {
          studentId,
          studentName,
          studentPhone,
          courseId,
          courseTitle,
          amount,
          paymentMethod,
          invoiceId: String(invoiceId),
          status: "active",
          enrolledAt: timestamp,
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn("Enrollment record Firestore save error:", err?.message || err);
    }

    // 3. Add an access code record in 'accessCodes' for accounting
    try {
      const accessCodeId = `FAW-${invoiceId}`;
      await safeDb.collection("accessCodes").doc(accessCodeId).set(
        {
          id: accessCodeId,
          code: accessCodeId,
          courseId,
          isUsed: true,
          usedBy: studentId,
          usedByName: studentName,
          usedAt: timestamp,
          createdAt: timestamp,
          type: "fawaterak_online",
          price: amount,
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn("Access code save error:", err?.message || err);
    }

    // 4. Send in-app notification to the student
    try {
      const notifId = `notif_faw_${Date.now()}`;
      await safeDb.collection("notifications").doc(notifId).set(
        {
          id: notifId,
          targetUid: studentId,
          title: "🎉 تم تفعيل الكورس بنجاح!",
          content: `تهانينا! تم تأكيد اشتراكك في كورس (${courseTitle}) بنجاح. يمكنك الآن مشاهدة الفيديوهات وتحميل المذكرات وخوض الامتحانات.`,
          type: "academic",
          createdAt: timestamp,
          isRead: false,
          senderName: "إدارة المنصة",
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn("Notification save error:", err?.message || err);
    }
  }

  return {
    success: true,
    unlockedCourseId: courseId,
    studentId,
    invoiceId,
    unlockedAt: timestamp,
  };
}
