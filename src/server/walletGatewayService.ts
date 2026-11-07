import fs from "fs";
import path from "path";
import { getSafeFirestore } from "./apiApp";
import { validateCoupon, unlockCourseForStudent } from "./fawaterakService";
import type { WalletOrder } from "../types";

// ============================================================================
// 1. CONFIGURATION & WALLET RECIPIENT
// ============================================================================

export const WALLET_CONFIG = {
  // Official Vodafone Cash Receiving Number
  receivingWalletNumber: process.env.VODAFONE_CASH_NUMBER || "01040672314",
  receivingWalletName: "فودافون كاش - منصة قلب العلم التعليمية",
  webhookSecret: process.env.SMS_GATEWAY_SECRET || "alelm_sms_secure_2027",
  autoApproveOnSmsMatch: true,
};

export function updateWalletConfig(newConfig: Partial<typeof WALLET_CONFIG>) {
  if (newConfig.receivingWalletNumber) {
    WALLET_CONFIG.receivingWalletNumber = normalizeEgyptianPhone(newConfig.receivingWalletNumber) || newConfig.receivingWalletNumber;
  }
  if (newConfig.receivingWalletName) {
    WALLET_CONFIG.receivingWalletName = newConfig.receivingWalletName;
  }
  if (newConfig.webhookSecret) {
    WALLET_CONFIG.webhookSecret = newConfig.webhookSecret;
  }
  if (typeof newConfig.autoApproveOnSmsMatch === "boolean") {
    WALLET_CONFIG.autoApproveOnSmsMatch = newConfig.autoApproveOnSmsMatch;
  }
  return WALLET_CONFIG;
}

// ============================================================================
// 2. IN-MEMORY STORES & DISK PERSISTENCE
// ============================================================================

const WALLET_ORDERS_FILE = path.join(process.cwd(), "data", "wallet_orders.json");

function loadOrdersFromDisk(): Map<string, WalletOrder> {
  const map = new Map<string, WalletOrder>();
  try {
    if (fs.existsSync(WALLET_ORDERS_FILE)) {
      const raw = fs.readFileSync(WALLET_ORDERS_FILE, "utf8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((o: WalletOrder) => {
          if (o && o.id) map.set(o.id, o);
        });
      }
    }
  } catch (e) {
    console.warn("[WalletGateway] Could not load wallet_orders.json:", e);
  }
  return map;
}

export function saveOrdersToDisk() {
  try {
    const dir = path.dirname(WALLET_ORDERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const list = Array.from(ordersStore.values());
    fs.writeFileSync(WALLET_ORDERS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.warn("[WalletGateway] Could not write wallet_orders.json:", e);
  }
}

export const ordersStore: Map<string, WalletOrder> = loadOrdersFromDisk();
export const usedTransactionIds: Set<string> = new Set();

export interface BufferedSms {
  sender: string;
  message: string;
  amount: number;
  senderPhone: string;
  transactionId: string;
  receivedAt: string;
}

// Stores incoming SMS that haven't yet matched a pending order (holds for 24h)
export const unmatchedSmsBuffer: BufferedSms[] = [];

// ============================================================================
// 3. ARABIC DIGITS & TEXT NORMALIZATION UTILS
// ============================================================================

/**
 * Converts Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) and Persian numerals to Western digits (0-9)
 */
export function normalizeArabicDigits(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9")
    .replace(/[,،]/g, ".")
    .trim();
}

/**
 * Clean phone numbers to standard 11-digit Egyptian mobile format (01xxxxxxxxx)
 */
export function normalizeEgyptianPhone(phone: string): string {
  if (!phone) return "";
  const normalized = normalizeArabicDigits(phone).replace(/\D/g, "");
  // Handle country code +20 or 20
  if (normalized.startsWith("201") && normalized.length === 12) {
    return "0" + normalized.slice(2);
  }
  if (normalized.startsWith("01") && normalized.length === 11) {
    return normalized;
  }
  if (normalized.startsWith("1") && normalized.length === 10) {
    return "0" + normalized;
  }
  return normalized;
}

// ============================================================================
// 4. HIGH-PRECISION VODAFONE CASH ARABIC SMS PARSER
// ============================================================================

export interface ParsedSmsResult {
  valid: boolean;
  amount?: number;
  senderPhone?: string;
  transactionId?: string;
  rawMessage: string;
  error?: string;
}

/**
 * Parses Vodafone Cash Arabic SMS messages:
 * Examples:
 * - "تم استقبال مبلغ 200.00 جنيها من رقم 01012345678 رقم العملية 987654321"
 * - "تم استلام مبلغ 150 ج.م من رقم 01098765432 رقم العملية 12345678"
 * - "استقبلت مبلغ 300 جنيه من 01123456789 العملية: 99887766"
 */
export function parseVodafoneCashSms(rawMessage: string): ParsedSmsResult {
  if (!rawMessage || typeof rawMessage !== "string") {
    return { valid: false, rawMessage: "", error: "نص الرسالة فارغ" };
  }

  const normalized = normalizeArabicDigits(rawMessage);

  // 1. Amount Extraction
  // Matches: مبلغ 200.00 or استلام 200 or إيداع 200 or 150.00 جنيه
  let amountMatch = normalized.match(/(?:مبلغ|استقبال|استلام|تحويل|إيداع|received|amount)\s*[:]?\s*([\d.]+)/i);
  if (!amountMatch) {
    amountMatch = normalized.match(/([\d.]+)\s*(?:جنيها|جنيه|جم|ج\.م|egp|le)/i);
  }

  // 2. Sender Phone Extraction
  // Matches: من رقم 01012345678 or من 01012345678
  const phoneRegex = /(?:من\s*رقم|من|رقم)\s*[:]?\s*(01[0-25][\d]{8})/i;
  let phoneMatch = normalized.match(phoneRegex);

  // Fallback phone regex: any 11-digit Egyptian mobile number in the message
  if (!phoneMatch) {
    const fallbackPhone = normalized.match(/\b(01[0-25][\d]{8})\b/);
    if (fallbackPhone) phoneMatch = fallbackPhone;
  }

  // 3. Transaction ID Extraction
  // Matches: رقم العملية 987654321 or العملية 987654321 or الرقم المرجعي or مرجع
  const trxRegex = /(?:العملية|المعاملة|المرجعي|مرجع|كود|transaction\s*id|trx|ref)\s*[:#]?\s*([A-Za-z0-9]+)/i;
  let trxMatch = normalized.match(trxRegex);

  // Fallback for transaction ID: look for digits after phone number or 6-14 digits sequence
  if (!trxMatch && phoneMatch) {
    const afterPhone = normalized.slice(normalized.indexOf(phoneMatch[1]) + phoneMatch[1].length);
    const trailingDigits = afterPhone.match(/\b(\d{6,14})\b/);
    if (trailingDigits) {
      trxMatch = trailingDigits;
    } else {
      const withoutPhone = normalized.replace(phoneMatch[1], "");
      const anyDigits = withoutPhone.match(/\b(\d{6,14})\b/);
      if (anyDigits) trxMatch = anyDigits;
    }
  }

  if (amountMatch && phoneMatch && trxMatch) {
    const amount = parseFloat(amountMatch[1]);
    const senderPhone = normalizeEgyptianPhone(phoneMatch[1]);
    const transactionId = trxMatch[1].trim();

    if (!isNaN(amount) && amount > 0 && senderPhone.length === 11 && transactionId.length >= 4) {
      return {
        valid: true,
        amount,
        senderPhone,
        transactionId,
        rawMessage,
      };
    }
  }

  return {
    valid: false,
    rawMessage,
    error: "تعذر استخراج العناصر الثلاثة (المبلغ، رقم المحول، رقم العملية) من نص الرسالة",
  };
}

// ============================================================================
// 5. ORDER CREATION & SUBMISSION BY STUDENT
// ============================================================================

export interface CreateOrderParams {
  studentId: string;
  studentName: string;
  studentPhone: string;
  senderPhone: string; // The wallet number transferred from
  transactionId?: string; // Optional at creation
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  couponCode?: string;
  receiptImageUrl?: string;
  paymentMethod?: 'vodafone_cash' | 'instapay';
  bundleId?: string;
  bundleCourseIds?: string[];
}

export async function createStudentWalletOrder(params: CreateOrderParams) {
  const {
    studentId,
    studentName,
    studentPhone,
    senderPhone,
    transactionId = "",
    courseId,
    courseTitle,
    coursePrice,
    couponCode,
    receiptImageUrl,
    paymentMethod = "vodafone_cash",
    bundleId,
    bundleCourseIds,
  } = params;

  const cleanSenderPhone = normalizeEgyptianPhone(senderPhone);
  const cleanTrxId = transactionId ? normalizeArabicDigits(transactionId).trim() : "";

  // Calculate pricing & coupons
  let originalPrice = Number(coursePrice) || 0;
  let discountAmount = 0;
  let finalAmount = originalPrice;

  if (couponCode && couponCode.trim()) {
    const validation = validateCoupon(couponCode, originalPrice, courseId);
    if (validation.valid) {
      discountAmount = validation.discountAmount;
      finalAmount = validation.finalAmount;
    }
  }

  // Free course or 100% discount
  if (finalAmount <= 0) {
    await unlockCourseForStudent({
      studentId,
      studentName,
      studentPhone,
      courseId,
      courseTitle,
      amount: 0,
      paymentMethod: "wallet_free",
      invoiceId: `free_${Date.now()}`,
    });

    return {
      success: true,
      instantActivated: true,
      status: "Completed",
      message: "تم تفعيل الكورس فوراً ومجاناً 🎓",
      finalAmount: 0,
    };
  }

  const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = new Date().toISOString();

  // Check if this transaction ID was already used
  if (cleanTrxId && usedTransactionIds.has(cleanTrxId)) {
    throw new Error("رقم العملية هذا تم استخدامه مسبقاً في تفعيل كورس آخر!");
  }

  // CHECK BUFFER: Was there an incoming SMS from this sender with this amount ALREADY received?
  let matchedSmsIndex = -1;
  for (let i = unmatchedSmsBuffer.length - 1; i >= 0; i--) {
    const item = unmatchedSmsBuffer[i];
    const phonesMatch = item.senderPhone === cleanSenderPhone;
    const amountsMatch = Math.abs(item.amount - finalAmount) < 0.5; // tolerance for 0.00
    const trxMatch = cleanTrxId ? item.transactionId === cleanTrxId : true;

    if (phonesMatch && amountsMatch && trxMatch) {
      matchedSmsIndex = i;
      break;
    }
  }

  // If already matched in SMS buffer -> AUTO-ACTIVATE INSTANTLY!
  if (matchedSmsIndex !== -1) {
    const matchedSms = unmatchedSmsBuffer.splice(matchedSmsIndex, 1)[0];
    const effectiveTrxId = cleanTrxId || matchedSms.transactionId;

    usedTransactionIds.add(effectiveTrxId);

    const completedOrder: WalletOrder = {
      id: orderId,
      studentId,
      studentName,
      studentPhone,
      senderPhone: cleanSenderPhone,
      targetWallet: WALLET_CONFIG.receivingWalletNumber,
      courseId,
      courseTitle,
      originalPrice,
      discountAmount,
      finalAmount,
      couponCode,
      transactionId: effectiveTrxId,
      rawSmsText: matchedSms.message,
      status: "Completed",
      createdAt: nowIso,
      paidAt: nowIso,
      notes: "تم التحقق التلقائي والفوري عبر رسالة SMS المحفظة المطابقة 🚀",
    };

    ordersStore.set(orderId, completedOrder);
    saveOrdersToDisk();

    // Save to Firestore
    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("orders").doc(orderId).set(completedOrder, { merge: true });
        await safeDb.collection("processed_transactions").doc(effectiveTrxId).set({
          transactionId: effectiveTrxId,
          orderId,
          amount: matchedSms.amount,
          senderPhone: cleanSenderPhone,
          processedAt: nowIso,
        }, { merge: true });
      } catch (e) {
        console.warn("Firestore order sync warning:", e);
      }
    }

    // Unlock course(s) for student
    const idsToUnlock = Array.isArray(bundleCourseIds) && bundleCourseIds.length > 0 ? bundleCourseIds : [courseId];
    for (const cid of idsToUnlock) {
      await unlockCourseForStudent({
        studentId,
        studentName,
        studentPhone,
        courseId: cid,
        courseTitle,
        amount: finalAmount,
        paymentMethod: "vodafone_cash_automated",
        invoiceId: effectiveTrxId,
      });
    }

    return {
      success: true,
      instantActivated: true,
      order: completedOrder,
      status: "Completed",
      message: "🎉 تم التحقق من التحويل وتفعيل الكورس في حسابك فوراً وبنجاح!",
    };
  }

  // Otherwise, create Pending order waiting for SMS or Admin/Assistant Receipt Review
  const pendingOrder: WalletOrder = {
    id: orderId,
    studentId,
    studentName,
    studentPhone,
    senderPhone: cleanSenderPhone || senderPhone.trim(),
    targetWallet: WALLET_CONFIG.receivingWalletNumber,
    courseId,
    courseTitle,
    ...(bundleId ? { bundleId } : {}),
    ...(Array.isArray(bundleCourseIds) && bundleCourseIds.length > 0 ? { bundleCourseIds } : {}),
    originalPrice,
    discountAmount,
    finalAmount,
    couponCode,
    transactionId: cleanTrxId || undefined,
    ...(receiptImageUrl ? { receiptImageUrl } : {}),
    paymentMethod,
    status: "Pending",
    createdAt: nowIso,
    notes: receiptImageUrl
      ? `تم إرفاق صورة إيصال التحويل (${paymentMethod === "instapay" ? "InstaPay" : "Vodafone Cash"}) - بانتظار المراجعة والاعتماد`
      : "في انتظار وصول رسالة التأكيد عبر المحفظة أو مراجعة الإيصال",
  };

  ordersStore.set(orderId, pendingOrder);
  saveOrdersToDisk();

  // Sync with Firestore
  const safeDb = getSafeFirestore();
  if (safeDb) {
    try {
      await safeDb.collection("orders").doc(orderId).set(pendingOrder, { merge: true });
    } catch (e) {
      console.warn("Firestore pending order save skipped:", e);
    }
  }

  return {
    success: true,
    instantActivated: false,
    order: pendingOrder,
    status: "Pending",
    message: "تم تسجيل طلبك بنجاح! جاري مطابقة التحويل مع هاتف المحفظة وتفعيل الكورس آلياً...",
  };
}

// ============================================================================
// 6. MOBILE SMS WEBHOOK HANDLER
// ============================================================================

export interface HandleSmsWebhookParams {
  sender?: string;
  message?: string;
  // Alternative payload keys used by various SMS Gateway Android apps
  from?: string;
  text?: string;
  phone?: string;
  body?: string;
  msg?: string;
  content?: string;
  sms?: string;
  originatingAddress?: string;
  secret?: string;
  token?: string;
}

export async function processIncomingSmsWebhook(payload: HandleSmsWebhookParams) {
  const sender = (
    payload.sender ||
    payload.from ||
    payload.phone ||
    payload.originatingAddress ||
    ""
  ).trim();

  const message = (
    payload.message ||
    payload.text ||
    payload.body ||
    payload.msg ||
    payload.content ||
    payload.sms ||
    ""
  ).trim();

  console.log(`[SMS Gateway] Received webhook from sender: "${sender}"`);

  // 1. Verify Sender Authenticity
  const senderLower = sender.toLowerCase();
  const isAuthorizedSender =
    senderLower.includes("vf-cash") ||
    senderLower.includes("vodafone") ||
    senderLower.includes("cash") ||
    senderLower.includes("vfcash") ||
    senderLower.includes("etisalat") ||
    senderLower.includes("orange") ||
    senderLower.includes("we-pay") ||
    senderLower.includes("instapay") ||
    payload.secret === WALLET_CONFIG.webhookSecret ||
    payload.token === WALLET_CONFIG.webhookSecret;

  if (!isAuthorizedSender) {
    console.warn(`[SMS Gateway] Rejected unauthorized sender: "${sender}"`);
    return {
      status: 403,
      success: false,
      error: "Unauthorized sender. Sender must be Vodafone Cash (VF-Cash/Vodafone)",
    };
  }

  // 2. Parse Arabic Message
  const parsed = parseVodafoneCashSms(message);
  if (!parsed.valid || !parsed.amount || !parsed.senderPhone || !parsed.transactionId) {
    console.warn("[SMS Gateway] SMS parse mismatch:", parsed.error, "Message:", message);
    return {
      status: 422,
      success: false,
      error: parsed.error || "Failed to parse SMS elements",
      rawMessage: message,
    };
  }

  const { amount, senderPhone, transactionId } = parsed;
  console.log(`[SMS Gateway] Parsed Transfer: Amount=${amount} EGP, Sender=${senderPhone}, TrxID=${transactionId}`);

  // 3. Prevent Duplicate Processing of Transaction ID
  if (usedTransactionIds.has(transactionId)) {
    console.warn(`[SMS Gateway] Duplicate transaction ID rejected: ${transactionId}`);
    return {
      status: 400,
      success: false,
      error: "Transaction ID already processed",
      transactionId,
    };
  }

  // Check Firestore for transaction ID
  const safeDb = getSafeFirestore();
  if (safeDb) {
    try {
      const existingTrxDoc = await safeDb.collection("processed_transactions").doc(transactionId).get();
      if (existingTrxDoc.exists) {
        usedTransactionIds.add(transactionId);
        return {
          status: 400,
          success: false,
          error: "Transaction ID already processed in database",
          transactionId,
        };
      }
    } catch (e) {
      console.warn("Firestore transaction check skipped:", e);
    }
  }

  // 4. Find Pending Order matching: (senderPhone + amount) OR (transactionId)
  let matchedOrder: WalletOrder | null = null;

  // Search memory store first
  for (const order of ordersStore.values()) {
    if (order.status === "Pending") {
      const phoneMatches = order.senderPhone === senderPhone;
      const amountMatches = Math.abs(order.finalAmount - amount) < 0.5;
      const trxMatches = order.transactionId && order.transactionId === transactionId;

      if ((phoneMatches && amountMatches) || trxMatches) {
        matchedOrder = order;
        break;
      }
    }
  }

  // Search Firestore if not found in memory
  if (!matchedOrder && safeDb) {
    try {
      const snap = await safeDb
        .collection("orders")
        .where("status", "==", "Pending")
        .where("senderPhone", "==", senderPhone)
        .limit(5)
        .get();

      for (const doc of snap.docs) {
        const oData = doc.data() as WalletOrder;
        if (Math.abs(oData.finalAmount - amount) < 0.5) {
          matchedOrder = oData;
          break;
        }
      }
    } catch (e) {
      console.warn("Firestore pending orders lookup skipped:", e);
    }
  }

  // 5. If matched: Activate and complete order
  const nowIso = new Date().toISOString();
  if (matchedOrder) {
    usedTransactionIds.add(transactionId);

    matchedOrder.status = "Completed";
    matchedOrder.transactionId = transactionId;
    matchedOrder.rawSmsText = message;
    matchedOrder.paidAt = nowIso;

    ordersStore.set(matchedOrder.id, matchedOrder);

    // Save to Firestore
    if (safeDb) {
      try {
        await safeDb.collection("orders").doc(matchedOrder.id).set(matchedOrder, { merge: true });
        await safeDb.collection("processed_transactions").doc(transactionId).set({
          transactionId,
          orderId: matchedOrder.id,
          amount,
          senderPhone,
          processedAt: nowIso,
        }, { merge: true });
      } catch (fsErr) {
        console.warn("Firestore order update error:", fsErr);
      }
    }

    // Unlock course for student
    await unlockCourseForStudent({
      studentId: matchedOrder.studentId,
      studentName: matchedOrder.studentName,
      studentPhone: matchedOrder.studentPhone,
      courseId: matchedOrder.courseId,
      courseTitle: matchedOrder.courseTitle,
      amount,
      paymentMethod: "vodafone_cash_sms_automated",
      invoiceId: transactionId,
    });

    console.log(`[SMS Gateway] 🎉 Course ${matchedOrder.courseId} activated for student ${matchedOrder.studentName}`);

    return {
      status: 200,
      success: true,
      activated: true,
      orderId: matchedOrder.id,
      transactionId,
      amount,
      studentName: matchedOrder.studentName,
      courseTitle: matchedOrder.courseTitle,
      message: "تمت مطابقة الرسالة وتفعيل الكورس للطالب فوراً بنجاح! 🚀",
    };
  }

  // 6. If no pending order matches yet, buffer this SMS so when the student submits, it activates immediately!
  unmatchedSmsBuffer.push({
    sender,
    message,
    amount,
    senderPhone,
    transactionId,
    receivedAt: nowIso,
  });

  // Keep buffer size limited
  if (unmatchedSmsBuffer.length > 100) {
    unmatchedSmsBuffer.shift();
  }

  console.log(`[SMS Gateway] SMS buffered waiting for student order submission. Buffer size: ${unmatchedSmsBuffer.length}`);

  return {
    status: 200,
    success: true,
    activated: false,
    buffered: true,
    transactionId,
    amount,
    senderPhone,
    message: "تم استلام وتحليل الرسالة بنجاح وحفظها في الانتظار لمطابقتها فور إرسال الطالب للطلب.",
  };
}

// ============================================================================
// 7. MANUAL ADMIN ACTIONS (Approve / Reject)
// ============================================================================

export async function adminApproveWalletOrder(orderId: string) {
  let order = ordersStore.get(orderId);
  const safeDb = getSafeFirestore();

  if (!order && safeDb) {
    try {
      const doc = await safeDb.collection("orders").doc(orderId).get();
      if (doc.exists) {
        order = doc.data() as WalletOrder;
      }
    } catch {}
  }

  if (!order) {
    throw new Error("لم يتم العثور على الطلب المطلوب.");
  }

  const nowIso = new Date().toISOString();
  order.status = "Completed";
  order.paidAt = nowIso;
  order.notes = "تم الاعتماد والتفعيل يدوياً بواسطة إدارة المنصة ✅";

  ordersStore.set(orderId, order);
  saveOrdersToDisk();

  if (safeDb) {
    try {
      await safeDb.collection("orders").doc(orderId).set(order, { merge: true });
    } catch {}
  }

  const idsToUnlock =
    Array.isArray(order.bundleCourseIds) && order.bundleCourseIds.length > 0
      ? order.bundleCourseIds
      : [order.courseId];

  for (const cid of idsToUnlock) {
    await unlockCourseForStudent({
      studentId: order.studentId,
      studentName: order.studentName,
      studentPhone: order.studentPhone,
      courseId: cid,
      courseTitle: order.courseTitle,
      amount: order.finalAmount,
      paymentMethod: "manual_admin_approval",
      invoiceId: order.transactionId || order.id,
    });
  }

  return { success: true, order, unlockedCourseIds: idsToUnlock };
}

export async function adminRejectWalletOrder(orderId: string, reason?: string) {
  let order = ordersStore.get(orderId);
  const safeDb = getSafeFirestore();

  if (!order && safeDb) {
    try {
      const doc = await safeDb.collection("orders").doc(orderId).get();
      if (doc.exists) {
        order = doc.data() as WalletOrder;
      }
    } catch {}
  }

  if (!order) {
    throw new Error("لم يتم العثور على الطلب المطلوب.");
  }

  order.status = "Rejected";
  order.notes = reason || "تم رفض الطلب لعدم مطابقة بيانات التحويل أو انتهاء المهلة.";

  ordersStore.set(orderId, order);
  saveOrdersToDisk();

  if (safeDb) {
    try {
      await safeDb.collection("orders").doc(orderId).set(order, { merge: true });
    } catch {}
  }

  return { success: true, order };
}
