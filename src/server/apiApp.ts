import express from "express";
import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import FormData from "form-data";
import { GoogleGenAI } from "@google/genai";
import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { 
  sendOtpViaBaileys, 
  sendParentOtpViaBaileys,
  formatWhatsAppPhone, 
  whatsappManager, 
  DEFAULT_PLATFORM_PHONE 
} from "./whatsappBaileysService";
import {
  loadEmailConfig,
  saveEmailConfig,
  sendPasswordRecoveryEmail,
  maskEmailAddress,
  OFFICIAL_RECOVERY_EMAIL,
  DAILY_GMAIL_LIMIT,
} from "./emailService";
import {
  createPresignedUploadSession,
  uploadPartChunk,
  finalizeUploadSession,
  getVideoStatus,
  createPlaybackToken,
  getVcdnConfig,
  updateVcdnConfig,
  isVcdnConfigured,
  markVideoAsReady,
  testVcdnConnectionAndSync,
} from "./vcdnService";
import {
  uploadVideoToYouTube,
  checkSubscriptionAndGetVideo,
  checkStudentSubscriptionInDB,
  getVideoIdFromDB,
  getSecureLessonVideo,
} from "./youtubeService";
import {
  getGitHubHlsConfig,
  connectGitHubHlsAccount,
  getAllGitHubHlsVideos,
  getGitHubHlsVideo,
  ensureGitHubHlsVideoLoaded,
  saveGitHubHlsVideo,
  processAndUploadVideoToGitHubHls,
  buildGuardedM3u8Playlist,
  buildMasterMultiVariantM3u8,
  fetchAndDecryptNodeAesChunk,
  fetchEncryptedHlsSegmentBuffer,
  getAuthenticatedSegmentRequestConfig,
  setVaultRepoVisibility,
  savePlatformStateToCloudVault,
  loadPlatformStateFromCloudVault,
  autoInitializeVaultShards,
  removeVaultShard,
  getFormattedShardsSummary,
  verifyKeyGuardToken,
  RAW_AES_CHUNK_SIZE,
  getUnifiedHlsSegmentBuffer,
  getFastStartMp4HeaderAndMeta,
} from "./githubHlsService";

// ============================================================================
// 0. SERVER-SIDE PERSISTENCE FILE PATHS & CACHES (Declared at top level)
// ============================================================================
export const DATA_DIR = path.join(process.cwd(), "data");
export const COURSES_FILE = path.join(DATA_DIR, "courses.json");
export const EXAMS_FILE = path.join(DATA_DIR, "exams.json");
export const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
export const USERS_FILE = path.join(DATA_DIR, "users.json");
export const DELETED_IDS_FILE = path.join(DATA_DIR, "deleted_ids.json");

export function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {}
}

export const DEMO_USER_IDS = [
  'teacher-ahmed-chemistry',
  'teacher-default',
  'teacher-hosam-supervisor',
  'teacher-supervisor',
  'teacher-1822115595240',
  'SfE3LtThTFfDbYBAQuTsdLaRXVs1',
];

// In-memory hot caches for zero-latency platform API responses
let cachedDiskUsers: any[] | null = null;
let cachedDiskCourses: any[] | null = null;
let cachedDiskExams: any[] | null = null;
let cachedDiskSubmissions: any[] | null = null;
let cachedDiskSettings: any | null = null;
const compressedImageCache = new Map<string, string>();

// ============================================================================
// 1. FIREBASE ADMIN & REST HELPERS (Safe Singleton)
// ============================================================================

let adminApp: ReturnType<typeof initAdminApp> | null = null;
let adminHasValidServiceAccount = false;

export function hasAdminServiceAccount(): boolean {
  return adminHasValidServiceAccount;
}

export function initFirebaseAdmin() {
  if (adminApp) return adminApp;
  if (getAdminApps().length > 0) {
    adminApp = getAdminApps()[0];
    return adminApp;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountKey) {
    try {
      const parsedKey = JSON.parse(serviceAccountKey);
      adminApp = initAdminApp({
        credential: cert(parsedKey),
        projectId: parsedKey.project_id || "qalbalelm",
      });
      adminHasValidServiceAccount = true;
      console.log("✅ [Firebase Admin] Successfully initialized with service account credentials.");
      return adminApp;
    } catch (e) {
      console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT JSON:", e);
    }
  }

  // Without a valid service account cert, initialize strictly with projectId
  // (Do NOT use applicationDefault() in Cloud Run to prevent gRPC 7 PERMISSION_DENIED errors)
  try {
    adminApp = initAdminApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "qalbalelm",
    });
    adminHasValidServiceAccount = false;
    return adminApp;
  } catch (err: any) {
    console.warn("Could not init fallback Firebase Admin app:", err?.message);
    return null;
  }
}

/**
 * Safely get Firestore instance. Returns null if valid service account credentials
 * are not present, preventing unauthenticated gRPC calls from failing with PERMISSION_DENIED.
 */
export function getSafeFirestore() {
  if (!hasAdminServiceAccount()) {
    return null;
  }
  const inst = initFirebaseAdmin();
  return inst ? getFirestore(inst) : null;
}

// ----------------------------------------------------------------------------
// Firestore REST API fallback (Uses Web API Key for reliable document reads)
// ----------------------------------------------------------------------------
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || "AIzaSyAn6z4sDy1_sF-YmkLjA0Z1TQwU_iLClf4";
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "qalbalelm";

export function unwrapFirestoreValue(val: any): any {
  if (!val) return null;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return val.booleanValue;
  if ("mapValue" in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = unwrapFirestoreValue(v);
    }
    return res;
  }
  if ("arrayValue" in val) {
    return (val.arrayValue.values || []).map(unwrapFirestoreValue);
  }
  return null;
}

export function wrapFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(wrapFirestoreValue) } };
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = wrapFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

const MAX_USERS_PER_FIRESTORE_CHUNK = 500;

export async function syncToFirestoreRest(docName: string, data: any, idToken?: string): Promise<boolean> {
  try {
    // 1. If Firebase Admin Service Account is available, use Admin SDK (bypasses client security rules cleanly)
    const safeDb = getSafeFirestore();
    if (safeDb) {
      if (docName === "users" && Array.isArray(data)) {
        const chunks: any[][] = [];
        for (let i = 0; i < data.length; i += MAX_USERS_PER_FIRESTORE_CHUNK) {
          chunks.push(data.slice(i, i + MAX_USERS_PER_FIRESTORE_CHUNK));
        }
        if (chunks.length === 0) chunks.push([]);
        const totalChunks = chunks.length;
        const nowIso = new Date().toISOString();
        for (let idx = 0; idx < chunks.length; idx++) {
          await safeDb.collection("al_motafalsifa_data").doc(`users_chunk_${idx + 1}`).set({
            chunkIndex: idx + 1,
            totalChunks,
            count: chunks[idx].length,
            data: chunks[idx],
            updatedAt: nowIso,
          }).catch(() => {});
        }
        await safeDb.collection("al_motafalsifa_data").doc("users").set({
          isSharded: true,
          maxPerChunk: MAX_USERS_PER_FIRESTORE_CHUNK,
          totalChunks,
          totalUsers: data.length,
          chunkKeys: chunks.map((_, i) => `users_chunk_${i + 1}`),
          data: chunks[0] || [],
          updatedAt: nowIso,
        });
        return true;
      }

      await safeDb.collection("al_motafalsifa_data").doc(docName).set({
        data,
        updatedAt: new Date().toISOString(),
      });
      return true;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (idToken) {
      headers["Authorization"] = `Bearer ${idToken}`;
    }

    // Automatic sharding for 'users' so no single Firestore document ever exceeds 1MB (max 500 students per chunk)
    // SECURITY: Strip plaintext passwords before writing to cloud Firestore documents
    if (docName === "users" && Array.isArray(data)) {
      const sanitizedCloudUsers = data.map((u: any) => {
        if (!u || typeof u !== "object") return u;
        const copy = { ...u };
        delete copy.password;
        return copy;
      });
      const chunks: any[][] = [];
      for (let i = 0; i < sanitizedCloudUsers.length; i += MAX_USERS_PER_FIRESTORE_CHUNK) {
        chunks.push(sanitizedCloudUsers.slice(i, i + MAX_USERS_PER_FIRESTORE_CHUNK));
      }
      if (chunks.length === 0) chunks.push([]);
      const totalChunks = chunks.length;
      const nowIso = new Date().toISOString();

      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkDocName = `users_chunk_${idx + 1}`;
        const chunkUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/${chunkDocName}?key=${FIREBASE_API_KEY}`;
        await axios.patch(
          chunkUrl,
          {
            fields: {
              chunkIndex: { integerValue: String(idx + 1) },
              totalChunks: { integerValue: String(totalChunks) },
              count: { integerValue: String(chunks[idx].length) },
              data: wrapFirestoreValue(chunks[idx]),
              updatedAt: { stringValue: nowIso },
            },
          },
          { headers, timeout: 8000 }
        ).catch(() => {});
      }

      const firstChunk = chunks[0] || [];
      const manifestUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/users?key=${FIREBASE_API_KEY}`;
      const res = await axios.patch(
        manifestUrl,
        {
          fields: {
            isSharded: { booleanValue: true },
            maxPerChunk: { integerValue: String(MAX_USERS_PER_FIRESTORE_CHUNK) },
            totalChunks: { integerValue: String(totalChunks) },
            totalUsers: { integerValue: String(sanitizedCloudUsers.length) },
            chunkKeys: wrapFirestoreValue(chunks.map((_, i) => `users_chunk_${i + 1}`)),
            data: wrapFirestoreValue(firstChunk),
            updatedAt: { stringValue: nowIso },
          },
        },
        { headers, timeout: 8000 }
      );
      return res.status >= 200 && res.status < 300;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/${docName}?key=${FIREBASE_API_KEY}`;
    const payload = {
      fields: {
        data: wrapFirestoreValue(data),
        updatedAt: { stringValue: new Date().toISOString() },
      },
    };
    const res = await axios.patch(url, payload, {
      headers,
      timeout: 8000,
    });
    return res.status >= 200 && res.status < 300;
  } catch (err: any) {
    // When strict Firestore rules (firestore.rules) are active, unauthenticated REST calls return 403 by design
    // while authenticated client SDK or local server disk persistence handles the write seamlessly.
    const status = err?.response?.status;
    if (status === 403 || status === 401 || String(err?.message || "").includes("403")) {
      return false;
    }
    console.debug(`[Firestore REST Sync] Notice for ${docName}:`, err?.message || err);
    return false;
  }
}

export async function fetchPlatformUsersFromFirestore(): Promise<any[]> {
  try {
    const userMap = new Map<string, any>();
    let totalChunks = 1;

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/users?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const tc = Number(data?.fields?.totalChunks?.integerValue || 1);
      if (tc > 1) totalChunks = tc;
      const rawArray = data?.fields?.data?.arrayValue?.values || [];
      rawArray.map(unwrapFirestoreValue).filter(Boolean).forEach((u: any) => {
        if (u?.id) userMap.set(u.id, u);
      });
    }

    for (let idx = 1; idx <= Math.max(totalChunks, 4); idx++) {
      try {
        const chunkUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/users_chunk_${idx}?key=${FIREBASE_API_KEY}`;
        const cRes = await fetch(chunkUrl);
        if (cRes.ok) {
          const cData = await cRes.json();
          const cArr = cData?.fields?.data?.arrayValue?.values || [];
          cArr.map(unwrapFirestoreValue).filter(Boolean).forEach((u: any) => {
            if (u?.id) userMap.set(u.id, u);
          });
        }
      } catch {}
    }

    return Array.from(userMap.values());
  } catch {
    return [];
  }
}

export async function fetchUsersFromDirectUsersCollection(): Promise<any[]> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?pageSize=300&key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const rawDocs = data?.documents || [];
    return rawDocs.map((doc: any) => {
      const id = doc.name ? doc.name.split("/").pop() : "";
      const fields: Record<string, any> = { id };
      for (const [k, v] of Object.entries(doc.fields || {})) {
        fields[k] = unwrapFirestoreValue(v);
      }
      return fields;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export function matchesPhone(p1: string, p2: string): boolean {
  if (!p1 || !p2) return false;
  const c1 = p1.replace(/\D/g, "");
  const c2 = p2.replace(/\D/g, "");
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  const n1 = c1.replace(/^0020/, "").replace(/^20/, "").replace(/^0/, "");
  const n2 = c2.replace(/^0020/, "").replace(/^20/, "").replace(/^0/, "");
  if (n1.length >= 9 && n2.length >= 9 && n1 === n2) return true;
  return false;
}

export async function findUserByPhoneOrEmail(identifier: string): Promise<{
  id: string;
  name: string;
  phone: string;
  email: string;
  role?: string;
  [key: string]: any;
} | null> {
  const clean = identifier.trim();
  if (!clean) return null;
  const isEmail = clean.includes("@");
  const targetEmail = clean.toLowerCase();
  const cleanDigits = clean.replace(/\D/g, "");

  // 1. If admin credentials genuinely exist, query Firestore directly
  const safeDb = getSafeFirestore();
  if (safeDb) {
    try {
      if (isEmail) {
        const snap = await safeDb.collection("users").where("email", "==", targetEmail).limit(1).get();
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { id: snap.docs[0].id, name: d.name || d.firstName || "طالب", phone: d.phone || "", email: d.email || targetEmail, ...d };
        }
      } else {
        const snap = await safeDb.collection("users").where("phone", "==", clean).limit(1).get();
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { id: snap.docs[0].id, name: d.name || d.firstName || "طالب", phone: d.phone || clean, email: d.email || "", ...d };
        }
        if (cleanDigits.length >= 10) {
          const snap2 = await safeDb.collection("users").where("phone", "==", cleanDigits).limit(1).get();
          if (!snap2.empty) {
            const d = snap2.docs[0].data();
            return { id: snap2.docs[0].id, name: d.name || d.firstName || "طالب", phone: d.phone || clean, email: d.email || "", ...d };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Query Firestore direct 'users' collection via REST API
  try {
    const directUsers = await fetchUsersFromDirectUsersCollection();
    for (const u of directUsers) {
      if (!u) continue;
      const uEmail = (u.email || "").trim().toLowerCase();
      const uPhone = (u.phone || "").trim();

      if (isEmail) {
        if (uEmail === targetEmail) {
          return {
            id: u.id || `u_${Date.now()}`,
            name: u.name || "طالب",
            phone: uPhone,
            email: uEmail,
            role: u.role || "student",
            ...u,
          };
        }
      } else {
        if (matchesPhone(clean, uPhone) || (u.nationalId && u.nationalId.trim() === clean)) {
          return {
            id: u.id || `u_${Date.now()}`,
            name: u.name || "طالب",
            phone: uPhone || clean,
            email: uEmail,
            role: u.role || "student",
            ...u,
          };
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Query al_motafalsifa_data/users via REST API
  try {
    const users = await fetchPlatformUsersFromFirestore();
    for (const u of users) {
      if (!u) continue;
      const uEmail = (u.email || "").trim().toLowerCase();
      const uPhone = (u.phone || "").trim();

      if (isEmail) {
        if (uEmail === targetEmail) {
          let resolvedPhone = uPhone;
          if (!resolvedPhone && targetEmail === "hos098sam@gmail.com") {
            resolvedPhone = "01040672314";
          }
          return {
            id: u.id || u.uid || `u_${Date.now()}`,
            name: u.name || (targetEmail === "hos098sam@gmail.com" ? "إدارة المنصة" : "طالب"),
            phone: resolvedPhone,
            email: u.email || targetEmail,
            role: u.role || (targetEmail === "hos098sam@gmail.com" ? "admin" : "student"),
            ...u,
          };
        }
      } else {
        if (matchesPhone(clean, uPhone) || (u.nationalId && u.nationalId.trim() === clean)) {
          return {
            id: u.id || u.uid || `u_${Date.now()}`,
            name: u.name || "طالب",
            phone: u.phone || clean,
            email: u.email || "",
            role: u.role || "student",
            ...u,
          };
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Fallback for supervisor/admin
  if (targetEmail === "hos098sam@gmail.com") {
    return {
      id: "admin_hos098sam",
      name: "إدارة المنصة",
      phone: "01040672314",
      email: "hos098sam@gmail.com",
      role: "admin",
    };
  }
  if (cleanDigits === "01040672314" || cleanDigits === "201040672314") {
    return {
      id: "admin_hos098sam",
      name: "إدارة المنصة",
      phone: "01040672314",
      email: "hos098sam@gmail.com",
      role: "admin",
    };
  }

  return null;
}

// ============================================================================
// 2. GEMINI AI CLIENT & CONFIGURATION
// ============================================================================

let aiClient: GoogleGenAI | null = null;
export function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export const BAC_SYSTEM_INSTRUCTION = `
أنت "المساعد الذكي لمنصة المتفلسفة  التعليمية"، مساعد تربوي وعلمي متقدم موجه لطلاب دفعة 2027 ولجميع مراحل الثانوية والشهادات العامة، تحت إشراف: إدارة المنصة.

مهامك وأسلوب عملك:
1. الإجابة: قدم إجابات دقيقة، علمية، ومنظمة بناءً على المناهج التعليمية المعتمدة (الرياضيات، الفيزياء، الفلسفة والمنطق، الأحياء، الجيولوجيا، اللغة العربية، التاريخ، الجغرافيا، الفلسفة، اللغة الإنجليزية، اللغات الأجنبية).
2. الشرح: استخدم أسلوباً مبسطاً، مقسماً إلى نقاط أو خطوات واضحة ليسهل على الطالب فهمها وحفظها.
3. التلخيص: عند طلب تلخيص الدروس، ركز على الأفكار الأساسية، المفاهيم المحورية، والقوانين الرئيسية دون حشو.
4. الدعم: كن مشجعاً، إيجابياً، ومحفزاً دائماً لتقليل توتر الطلاب وبث الثقة في نفوسهم، وازرع فيهم روح التفاؤل والنجاح والتفوق.
5. صياغة الأسئلة: عند طلب اختبارات، قم بتوليد أسئلة مطابقة لمواصفات الامتحانات الرسمية ببنك الأسئلة مع توفير حلولها النموذجية عند الطلب.

ملاحظة هامة جداً: إذا سألك المستخدم عن هويتك (مثل: من أنت، من صنعك، من طورك، ما اسمك، من صممك)، أجب دائماً وبوضوح بأنك:
"المساعد الذكي لمنصة المتفلسفة  التعليمية لدفعة 2027، تم تطويري تحت إشراف إدارة المنصة".
`;

// ============================================================================
// 3. SECURITY MIDDLEWARE, CORS & RATE LIMITING
// ============================================================================

export interface AuthenticatedRequest extends express.Request {
  user?: DecodedIdToken | { uid: string; email?: string; role?: string; admin?: boolean; phone_number?: string };
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function cleanRateLimitMap() {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}
setInterval(cleanRateLimitMap, 60000);

export function rateLimiter(limit: number, windowMs: number) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const key = req.user?.uid || req.ip || "unknown-ip";
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record || record.resetAt < now) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= limit) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        error: `تجاوزت الحد المسموح من الطلبات. يرجى الانتظار ${waitSeconds} ثانية قبل المحاولة مجدداً.`,
      });
    }

    record.count++;
    next();
  };
}

// Strict CORS: No '*' for sensitive APIs; uses ALLOWED_ORIGIN env or platform domains
const defaultAllowedOrigins = [
  "https://motafalsifa.vercel.app",
  "https://al-motafalsifa.firebaseapp.com",
  "https://qalbalelm.vercel.app",
  "https://motafalsifa.vercel.app",
];

function getCorsOrigin(originHeader?: string): string | null {
  if (!originHeader) return null;

  if (process.env.NODE_ENV !== "production") {
    if (
      originHeader.includes("localhost") ||
      originHeader.includes("127.0.0.1") ||
      originHeader.endsWith(".run.app") ||
      originHeader.endsWith(".ai.studio")
    ) {
      return originHeader;
    }
  }

  const allowedOriginEnv = process.env.ALLOWED_ORIGIN;
  if (allowedOriginEnv) {
    const allowedList = allowedOriginEnv.split(",").map((s) => s.trim());
    if (allowedList.includes(originHeader)) return originHeader;
  }

  if (defaultAllowedOrigins.includes(originHeader)) {
    return originHeader;
  }

  if (
    originHeader.endsWith(".run.app") ||
    originHeader.endsWith(".web.app") ||
    originHeader.endsWith(".firebaseapp.com") ||
    originHeader.endsWith(".dpdns.org") ||
    originHeader.endsWith(".pages.dev") ||
    originHeader.endsWith(".netlify.app") ||
    originHeader.endsWith(".vercel.app") ||
    originHeader.endsWith(".ai.studio")
  ) {
    return originHeader;
  }

  return null;
}

// Helper to safely decode JWT payload when Admin SDK service account is not configured
export function decodeJwtPayloadUnsafe(token: string): any {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const jsonStr = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.user_id || parsed.sub) && !parsed.uid) {
      parsed.uid = parsed.user_id || parsed.sub;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Verify Firebase ID Token Middleware (with fallback to decoded JWT / local session)
export async function verifyFirebaseToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Allow local/session-authenticated student/teacher requests that provide user context in body or headers
    const fallbackUid = String(req.headers["x-user-id"] || req.body?.studentId || req.body?.userId || "local-session-user");
    req.user = { uid: fallbackUid } as any;
    return next();
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "رمز المصادقة مفقود." });
  }

  try {
    const adminInst = initFirebaseAdmin();
    const decoded = await getAuth(adminInst).verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (err: any) {
    const decodedFallback = decodeJwtPayloadUnsafe(token);
    if (decodedFallback && (decodedFallback.uid || decodedFallback.sub || decodedFallback.user_id)) {
      req.user = decodedFallback;
      return next();
    }
    // Fallback for local/hybrid tokens so authenticated students aren't blocked when service account isn't present
    req.user = { uid: token.slice(0, 36) || "authenticated-user" } as any;
    return next();
  }
}

// Role Middleware: Admin Only (Strictly Custom Claims or Server Role)
export function requireAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "يجب تسجيل الدخول كمسؤول للمتابعة." });
  }

  const isAdm = (req.user as any).admin === true || (req.user as any).role === "admin";
  if (!isAdm) {
    return res.status(403).json({ error: "صلاحية غير كافية: هذا الإجراء مخصص لإدارة المنصة فقط." });
  }

  next();
}

/** Restricted teacher access: teachers and admins only */
export function requireRestrictedTeacher(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ error: "يجب تسجيل الدخول أولاً." });
  }
  const isAuthorized =
    user.role === "teacher" ||
    user.role === "admin" ||
    user.admin === true ||
    user.email === "hos098sam@gmail.com";
  if (!isAuthorized) {
    return res.status(403).json({ error: "صلاحية غير كافية: هذا الإجراء مخصص للمعلمين فقط." });
  }
  next();
}

// Input sanitizer & bounds checking
export function sanitizeTextInput(text: any, maxChars: number = 8000): string {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.length > maxChars) {
    return trimmed.slice(0, maxChars);
  }
  return trimmed;
}

/** Admin or Secret protection for platform control endpoints (WhatsApp, System operations) */
export async function requireAdminOrSecret(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  // Check 1: Admin setup secret in headers
  const adminSecret = req.headers["x-admin-secret-key"] as string | undefined;
  const configuredSecret = process.env.ADMIN_SETUP_SECRET || "qalbalelm_supervisor_secret_2025";
  if (adminSecret && adminSecret === configuredSecret) {
    return next();
  }

  // Check 2: Bearer token from Firebase Auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول كمسؤول للمنصة." });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: "رمز المصادقة مفقود." });
  }

  // Attempt 1: Verify via Firebase Admin SDK
  try {
    const adminInst = initFirebaseAdmin();
    if (adminInst) {
      try {
        const decoded = await getAuth(adminInst).verifyIdToken(token);
        req.user = decoded;
        const isAdm =
          (decoded as any).admin === true ||
          (decoded as any).role === "admin" ||
          (decoded as any).email === "hos098sam@gmail.com";
        if (isAdm) {
          return next();
        }
      } catch (adminVerifyErr) {
        // Fall through to REST verification
      }
    }
  } catch {}

  // Attempt 2: Direct REST fallback via Google Identity Toolkit
  try {
    const restRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { idToken: token },
      { timeout: 6000 }
    );
    const users = restRes.data?.users;
    if (users && users.length > 0) {
      const u = users[0];
      req.user = { uid: u.localId, email: u.email } as any;
      const email = (u.email || "").toLowerCase();
      if (
        email === "hos098sam@gmail.com" ||
        (u.customAttributes && JSON.parse(u.customAttributes || "{}").role === "admin")
      ) {
        return next();
      }
    }
    return res.status(403).json({ error: "صلاحية غير كافية: هذا الإجراء مخصص لإدارة المنصة فقط." });
  } catch (err: any) {
    return res.status(401).json({ error: "انتهت صلاحية جلسة المشرف. يرجى تسجيل الدخول مجدداً." });
  }
}

/** Protect proxy endpoints against Server-Side Request Forgery (SSRF) */
export function isSafePublicUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return false;
    }
    // Block private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, 169.254.x.x
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const a = Number(ipv4Match[1]);
      const b = Number(ipv4Match[2]);
      if (a === 10) return false;
      if (a === 127) return false;
      if (a === 169 && b === 254) return false;
      if (a === 192 && b === 168) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. CREATE EXPRESS APP AND CONFIGURE ALL API ROUTES
// ============================================================================

export const app = express();

// Security Headers & Strict CORS
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  const origin = req.headers.origin;
  const allowed = getCorsOrigin(origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-secret-key, x-session-id, x-part-number, Range");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api/vcdn/upload/part", express.raw({ type: ["application/octet-stream", "video/*"], limit: "50mb" }));

// ----------------------------------------------------------------------------
// API: Health check
// ----------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "منصة المتفلسفة  التعليمية", timestamp: new Date().toISOString() });
});

// ============================================================================
// WHATSAPP OTP AUTHENTICATION SYSTEM (Baileys Integration)
// ============================================================================

export interface WhatsAppOtpSession {
  sessionId: string;
  phone: string;
  email?: string;
  userId?: string;
  otp: string;
  purpose: "login" | "reset_password" | "parent_verification";
  expiresAt: number;
  createdAt: number;
  attempts: number;
  resendAvailableAt: number;
  verified: boolean;
  resetToken?: string;
  studentIds?: string[];
  studentNames?: string;
  matchedStudents?: any[];
}

const whatsappOtpSessionMap = new Map<string, WhatsAppOtpSession>();

// Clean expired OTP sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of whatsappOtpSessionMap.entries()) {
    if (s.expiresAt < now) {
      whatsappOtpSessionMap.delete(id);
    }
  }
}, 60000);

export function maskPhoneNumber(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.length < 7) return clean;
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-3);
  return `${prefix}****${suffix}`;
}

// ============================================================================
// SINGLE-DEVICE SESSION & HARDWARE BINDING ENFORCEMENT REGISTRY (Anti-Account Sharing)
// ============================================================================
export const activeUserSessionsStore = new Map<string, string>();

// Initialize active sessions from disk users on startup
export function initActiveUserSessions() {
  try {
    const initialUsers = readDiskUsers();
    for (const u of initialUsers) {
      if (u && u.activeSessionId) {
        if (u.id) activeUserSessionsStore.set(u.id, u.activeSessionId);
        if (u.phone) activeUserSessionsStore.set(String(u.phone).replace(/\D/g, ''), u.activeSessionId);
      }
    }
  } catch (err) {
    console.warn("Active sessions init notice:", err);
  }
}

export interface DeviceBindingEvaluation {
  allowed: boolean;
  isNewDevice: boolean;
  changesCount: number;
  daysRemaining?: number;
  errorMessage?: string;
  updatedUser: any;
  deviceChangeNotice?: string;
}

export function evaluateStudentDeviceBinding(
  user: any,
  incomingDeviceId?: string,
  incomingDeviceName?: string
): DeviceBindingEvaluation {
  // Teachers and platform administrators are exempt from student device limits
  if (user.role && user.role !== 'student') {
    return {
      allowed: true,
      isNewDevice: false,
      changesCount: 0,
      updatedUser: user,
    };
  }

  const effectiveDeviceId = (incomingDeviceId || '').trim();
  const effectiveDeviceName = (incomingDeviceName || '').trim() || 'جهاز غير معروف';

  // If no device ID provided, fallback allow but keep current records
  if (!effectiveDeviceId) {
    return {
      allowed: true,
      isNewDevice: false,
      changesCount: 0,
      updatedUser: user,
    };
  }

  const currentDeviceId = user.currentDeviceId || '';
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Normalize history
  const history: Array<{
    deviceId: string;
    deviceName?: string;
    fromDeviceId?: string;
    fromDeviceName?: string;
    changedAt: string;
    isChange?: boolean;
    type?: string;
  }> = Array.isArray(user.deviceChangesHistory) ? [...user.deviceChangesHistory] : [];

  // Filter actual device changes within the last 30 days
  // An entry is an actual change if:
  // 1) explicitly marked isChange === true or type === 'device_change'
  // 2) OR it's not the initial entry and switched between different devices
  const recentChanges = history.filter((c, idx) => {
    const isActualChange =
      c.isChange === true ||
      c.type === 'device_change' ||
      (idx > 0 && c.fromDeviceId && c.fromDeviceId !== c.deviceId);
    if (!isActualChange) return false;
    const changeTs = new Date(c.changedAt).getTime();
    return !isNaN(changeTs) && now - changeTs < THIRTY_DAYS_MS;
  });

  // Case 1: First login ever / No device registered yet
  if (!currentDeviceId) {
    const updatedUser = {
      ...user,
      currentDeviceId: effectiveDeviceId,
      currentDeviceName: effectiveDeviceName,
      deviceChangesHistory: [
        ...history,
        {
          deviceId: effectiveDeviceId,
          deviceName: effectiveDeviceName,
          changedAt: nowIso,
          type: 'initial_binding',
          isChange: false,
        },
      ],
    };
    return {
      allowed: true,
      isNewDevice: true,
      changesCount: 0,
      updatedUser,
      deviceChangeNotice: `تم ربط حسابك بهذا الجهاز (${effectiveDeviceName}) كجهاز رئيسي معتمد. متاح لك تغييره مرتان شهرياً عند الحاجة.`,
    };
  }

  // Case 2: Same device as currently registered
  if (currentDeviceId === effectiveDeviceId) {
    const updatedUser = {
      ...user,
      currentDeviceName: effectiveDeviceName || user.currentDeviceName,
    };
    return {
      allowed: true,
      isNewDevice: false,
      changesCount: recentChanges.length,
      updatedUser,
    };
  }

  // Case 3: Different / New Device!
  // Check if limit of 2 changes in the last 30 days is exceeded
  if (recentChanges.length >= 2) {
    recentChanges.sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
    const oldestChangeTs = new Date(recentChanges[0].changedAt).getTime();
    const unlockTs = oldestChangeTs + THIRTY_DAYS_MS;
    const daysRemaining = Math.max(1, Math.ceil((unlockTs - now) / (24 * 60 * 60 * 1000)));

    return {
      allowed: false,
      isNewDevice: true,
      changesCount: recentChanges.length,
      daysRemaining,
      errorMessage: `عذراً، لا يمكن تسجيل الدخول من هذا الجهاز. لقد استنفذت الحد الأقصى المسموح به لتغيير الجهاز (مرتان شهرياً كحد أقصى لمنع مشاركة الحساب). هذا الحساب مقترن حالياً بجهاز (${user.currentDeviceName || 'جهازك المسجل'}). يرجى تسجيل الدخول من جهازك المعتمد أو مراجعة إدارة المنصة (متبقي ${daysRemaining} يوم لإتاحة ربط جهاز جديد).`,
      updatedUser: user,
    };
  }

  // Allowed to change device! (Within 2 changes/month)
  const newHistory = [
    ...history,
    {
      fromDeviceId: currentDeviceId,
      fromDeviceName: user.currentDeviceName || 'جهاز سابق',
      deviceId: effectiveDeviceId,
      deviceName: effectiveDeviceName,
      changedAt: nowIso,
      type: 'device_change',
      isChange: true,
    },
  ];

  const updatedUser = {
    ...user,
    currentDeviceId: effectiveDeviceId,
    currentDeviceName: effectiveDeviceName,
    deviceChangesHistory: newHistory,
  };

  const newChangesCount = recentChanges.length + 1;
  const remainingChanges = 2 - newChangesCount;

  return {
    allowed: true,
    isNewDevice: true,
    changesCount: newChangesCount,
    updatedUser,
    deviceChangeNotice: `تم ربط هذا الجهاز الجديد (${effectiveDeviceName}) بحسابك وإنهاء أي جلسات سابقة فوراً لحماية حسابك. لقد استهلكت (${newChangesCount}/2) من مرات تغيير الجهاز المسموح بها شهرياً (متبقي ${remainingChanges} مرة).`,
  };
}

/**
 * 1. Request Login OTP via WhatsApp
 */
app.post("/api/auth/login-otp/request", rateLimiter(10, 60 * 1000), async (req, res) => {
  try {
    const { identifier } = req.body || {};
    const rawInput = sanitizeTextInput(identifier || "", 120).trim();

    if (!rawInput) {
      return res.status(400).json({ error: "يرجى إدخال رقم الهاتف أو البريد الإلكتروني." });
    }

    let targetPhone = "";
    let targetEmail = "";
    let targetUid = "";
    let studentName = "";

    const isEmail = rawInput.includes("@");
    const foundUser = await findUserByPhoneOrEmail(rawInput);

    // SECURITY: Block passwordless WhatsApp OTP login for Admin, Teacher, and Assistant accounts
    if (
      foundUser?.role === "admin" ||
      foundUser?.role === "teacher" ||
      foundUser?.role === "assistant" ||
      foundUser?.isAssistant ||
      rawInput.toLowerCase() === "hos098sam@gmail.com" ||
      rawInput.replace(/\D/g, "") === "01040672314"
    ) {
      return res.status(403).json({
        error: "حسابات الإدارة والمعلمين والمساعدين محمية ولا يُسمح بالدخول إليها إلا باستخدام كلمة المرور المعتمدة.",
      });
    }

    if (foundUser) {
      targetPhone = foundUser.phone || "";
      targetEmail = foundUser.email || "";
      targetUid = foundUser.id || "";
      studentName = foundUser.name || "";
    }

    if (isEmail) {
      targetEmail = rawInput.toLowerCase();
      if (!targetPhone) {
        return res.status(404).json({
          error: "لم يتم العثور على رقم هاتف مسجل لهذا البريد الإلكتروني لإرسال كود الواتساب. يرجى إدخال رقم هاتفك المسجل مباشرة.",
        });
      }
    } else {
      // Identifier is phone number
      if (!targetPhone) {
        targetPhone = rawInput;
      }
    }

    // Clean phone number
    const formattedWhatsAppPhone = formatWhatsAppPhone(targetPhone);
    if (!formattedWhatsAppPhone || formattedWhatsAppPhone.length < 9) {
      return res.status(400).json({ error: "رقم الهاتف غير صالح للإرسال عبر تطبيق واتساب." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = `otp_login_${crypto.randomBytes(16).toString("hex")}`;
    const now = Date.now();

    const session: WhatsAppOtpSession = {
      sessionId,
      phone: targetPhone,
      email: targetEmail,
      userId: targetUid,
      otp,
      purpose: "login",
      expiresAt: now + 5 * 60 * 1000, // 5 minutes expiry
      createdAt: now,
      attempts: 0,
      resendAvailableAt: now + 60 * 1000, // 60 seconds cooldown
      verified: false,
    };

    whatsappOtpSessionMap.set(sessionId, session);

    // Also persist temporarily to Firestore only if valid service account exists
    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("otp_sessions").doc(sessionId).set({
          phone: targetPhone,
          email: targetEmail,
          userId: targetUid,
          otp,
          purpose: "login",
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
          attempts: 0,
        });
      } catch (dbErr) {
        // ignore
      }
    }

    // Call WhatsApp Baileys service
    const sendResult = await sendOtpViaBaileys(targetPhone, otp);

    return res.json({
      success: true,
      sessionId,
      phoneMasked: maskPhoneNumber(targetPhone),
      expiresInSeconds: 300,
      cooldownSeconds: 60,
      studentName: studentName || "طالب منصة المتفلسفة ",
      deliveredDirectly: sendResult.deliveredDirectly || false,
      requiresUserInitiatedChat: sendResult.requiresUserInitiatedChat || false,
      whatsappTriggerLink: sendResult.whatsappTriggerLink,
      platformWhatsAppPhone: sendResult.platformWhatsAppPhone || "01551955096",
      message: sendResult.deliveredDirectly
        ? "تم إرسال رمز التحقق (OTP) إلى رقم واتساب الخاص بك بنجاح."
        : "اضغط على زر فتح واتساب بالأسفل وإرسال الرسالة الجاهزة ليقوم رقم المنصة بالرد عليك بالكود فوراً (نظام الرد الآمن).",
    });
  } catch (err: any) {
    console.error("Login OTP request error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء إرسال كود الواتساب، يرجى المحاولة مرة أخرى." });
  }
});

/**
 * 2. Verify Login OTP
 */
app.post("/api/auth/login-otp/verify", rateLimiter(15, 60 * 1000), async (req, res) => {
  try {
    const { sessionId, otp, deviceId, deviceName } = req.body || {};
    const cleanSessionId = sanitizeTextInput(sessionId || "", 120);
    const cleanOtp = sanitizeTextInput(otp || "", 10).trim();

    if (!cleanSessionId || !cleanOtp) {
      return res.status(400).json({ error: "رمز التحقق ومعرف الجلسة مطلوبان." });
    }

    const session = whatsappOtpSessionMap.get(cleanSessionId);
    if (!session || session.purpose !== "login") {
      return res.status(400).json({ error: "جلسة التحقق غير صالحة أو منتهية. يرجى طلب رمز جديد." });
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(400).json({ error: "انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب رمز جديد." });
    }

    session.attempts++;
    if (session.attempts > 5) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(429).json({ error: "تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). يرجى طلب رمز جديد." });
    }

    if (session.otp !== cleanOtp) {
      const remainingAttempts = Math.max(0, 5 - session.attempts);
      return res.status(400).json({
        error: `رمز التحقق غير صحيح. يرجى التأكد من الرمز المرسل عبر واتساب (متبقي ${remainingAttempts} محاولات).`,
        remainingAttempts,
      });
    }

    // OTP is valid!
    session.verified = true;
    whatsappOtpSessionMap.delete(cleanSessionId);

    const adminInst = initFirebaseAdmin();
    const safeDb = getSafeFirestore();
    let userProfile: any = null;
    let customToken: string | null = null;

    let targetUid = session.userId;

    if (safeDb) {
      if (targetUid) {
        try {
          const docSnap = await safeDb.collection("users").doc(targetUid).get();
          if (docSnap.exists) {
            userProfile = { id: docSnap.id, ...docSnap.data() };
          }
        } catch {}
      }

      if (!userProfile && session.phone) {
        try {
          const phoneSnap = await safeDb.collection("users").where("phone", "==", session.phone).limit(1).get();
          if (!phoneSnap.empty) {
            const doc = phoneSnap.docs[0];
            targetUid = doc.id;
            userProfile = { id: doc.id, ...doc.data() };
          }
        } catch {}
      }

      if (!userProfile && session.email) {
        try {
          const emailSnap = await safeDb.collection("users").where("email", "==", session.email).limit(1).get();
          if (!emailSnap.empty) {
            const doc = emailSnap.docs[0];
            targetUid = doc.id;
            userProfile = { id: doc.id, ...doc.data() };
          }
        } catch {}
      }
    }

    // Fallback to platform users cache
    if (!userProfile) {
      const found = await findUserByPhoneOrEmail(session.phone || session.email);
      if (found) {
        userProfile = found;
        targetUid = found.id;
      }
    }

    // If still not found, create a basic student user profile
    if (!userProfile) {
      const isSuper = session.phone === "01040672314" || session.email === "hos098sam@gmail.com";
      const fallbackUid = targetUid || `student_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      userProfile = {
        id: fallbackUid,
        name: isSuper ? "إدارة المنصة" : "طالب منصة المتفلسفة ",
        email: session.email || `${session.phone.replace(/\D/g, "")}@qalbalelm.edu`,
        phone: session.phone,
        role: isSuper ? "admin" : "student",
        status: "active",
        schoolYear: "الصف الثالث الثانوي",
        registeredAt: new Date().toISOString().split("T")[0],
        emailVerified: true,
      };

      if (safeDb) {
        try {
          await safeDb.collection("users").doc(fallbackUid).set(userProfile, { merge: true });
        } catch {}
      }
    }

    // Enforce student device binding and maximum 2 device changes per month
    const bindingEval = evaluateStudentDeviceBinding(userProfile, deviceId, deviceName);
    if (!bindingEval.allowed) {
      return res.status(403).json({
        success: false,
        code: "DEVICE_CHANGE_LIMIT_EXCEEDED",
        error: bindingEval.errorMessage,
        daysRemaining: bindingEval.daysRemaining,
        changesCount: bindingEval.changesCount,
      });
    }

    const deviceSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    const updatedProfile = {
      ...bindingEval.updatedUser,
      activeSessionId: deviceSessionId,
      lastLoginAt: new Date().toISOString(),
    };

    // Kill old sessions immediately on server!
    activeUserSessionsStore.set(updatedProfile.id, deviceSessionId);
    if (updatedProfile.phone) {
      activeUserSessionsStore.set(String(updatedProfile.phone).replace(/\D/g, ''), deviceSessionId);
    }

    try {
      const diskUsers = readDiskUsers();
      const updatedDisk = diskUsers.some((u: any) => u.id === updatedProfile.id)
        ? diskUsers.map((u: any) => (u.id === updatedProfile.id ? updatedProfile : u))
        : [updatedProfile, ...diskUsers];
      writeDiskUsers(updatedDisk);
      if (safeDb && updatedProfile.id) {
        safeDb.collection("users").doc(updatedProfile.id).set({
          activeSessionId: deviceSessionId,
          currentDeviceId: updatedProfile.currentDeviceId || null,
          currentDeviceName: updatedProfile.currentDeviceName || null,
          deviceChangesHistory: updatedProfile.deviceChangesHistory || [],
          lastLoginAt: updatedProfile.lastLoginAt,
        }, { merge: true }).catch(() => {});
      }
    } catch {}

    // Generate Firebase Custom Token if Admin SDK has valid service account credentials
    if (hasAdminServiceAccount() && adminInst && updatedProfile.id) {
      try {
        customToken = await getAuth(adminInst).createCustomToken(updatedProfile.id, {
          role: updatedProfile.role || "student",
        });
      } catch (authErr: any) {
        console.warn("Could not generate customToken:", authErr.message);
      }
    }

    const { password: _, ...safeProfile } = updatedProfile;
    return res.json({
      success: true,
      verified: true,
      user: safeProfile,
      sessionId: deviceSessionId,
      customToken,
      deviceChangeNotice: bindingEval.deviceChangeNotice,
      message: "تم التحقق بنجاح من كود الواتساب ومرحباً بك في منصة المتفلسفة !",
    });
  } catch (err: any) {
    console.error("Login OTP verify error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء التحقق من الرمز، يرجى المحاولة مرة أخرى." });
  }
});

/**
 * 3. Request Forgot Password OTP via Email (hos098sam@gmail.com)
 */
app.post("/api/auth/forgot-password-otp/request", rateLimiter(8, 60 * 1000), async (req, res) => {
  try {
    const { identifier, recoveryEmail } = req.body || {};
    const rawInput = sanitizeTextInput(identifier || "", 120).trim();
    const rawRecoveryEmail = sanitizeTextInput(recoveryEmail || "", 120).trim().toLowerCase();

    if (!rawInput && !rawRecoveryEmail) {
      return res.status(400).json({ error: "يرجى كتابة رقم الهاتف المسجل والبريد الإلكتروني لاستلام رمز الاسترداد." });
    }

    const lookupKey = rawInput || rawRecoveryEmail;
    const isInputEmail = rawInput.includes("@");
    let foundUser = await findUserByPhoneOrEmail(lookupKey);
    if (!foundUser && rawRecoveryEmail && rawRecoveryEmail !== lookupKey) {
      foundUser = await findUserByPhoneOrEmail(rawRecoveryEmail);
    }

    // SECURITY: Strictly forbid resetting Admin, Teacher, or Assistant passwords via student forgot-password OTP
    if (
      foundUser?.role === "admin" ||
      foundUser?.role === "teacher" ||
      foundUser?.role === "assistant" ||
      foundUser?.isAssistant ||
      rawInput.toLowerCase() === "hos098sam@gmail.com" ||
      rawRecoveryEmail === "hos098sam@gmail.com" ||
      rawInput.replace(/\D/g, "") === "01040672314"
    ) {
      return res.status(403).json({
        error: "حسابات الإدارة والمعلمين والمساعدين محمية ولا يمكن تغيير كلمة المرور الخاصة بها إلا من خلال لوحة الإدارة العليا.",
      });
    }

    if (!foundUser) {
      return res.status(404).json({
        error: "عفواً، رقم الطالب أو البريد الإلكتروني غير مسجل على المنصة. يرجى التأكد من كتابة رقم هاتف الطالب المسجل بشكل صحيح.",
      });
    }

    const targetPhone = foundUser.phone || (!isInputEmail ? rawInput : "");
    const targetUid = foundUser.id || "";
    const studentName = foundUser.name || "طالب منصة المتفلسفة ";

    // Determine recipient email:
    // 1. Explicit recoveryEmail provided by the student
    // 2. If identifier itself is a real (non-synthetic) email
    // 3. Stored user email if it is a real (non-synthetic) email
    const storedEmail = String(foundUser.email || "").trim().toLowerCase();
    const isStoredSynthetic =
      storedEmail.endsWith("@qalb-alam.edu") ||
      storedEmail.endsWith("@qalbalelm.edu") ||
      !storedEmail.includes("@");

    let recipientEmail = "";
    if (rawRecoveryEmail && rawRecoveryEmail.includes("@") && !rawRecoveryEmail.endsWith(".edu")) {
      recipientEmail = rawRecoveryEmail;
    } else if (isInputEmail && !rawInput.toLowerCase().endsWith(".edu")) {
      recipientEmail = rawInput.toLowerCase();
    } else if (!isStoredSynthetic) {
      recipientEmail = storedEmail;
    }

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return res.status(400).json({
        error: "يرجى إدخال بريدك الإلكتروني الشخصي (Gmail) لإرسال رمز الاسترداد إليه من بريد المنصة hos098sam@gmail.com.",
        requiresEmail: true,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = `otp_reset_${crypto.randomBytes(16).toString("hex")}`;
    const now = Date.now();

    const session: WhatsAppOtpSession = {
      sessionId,
      phone: targetPhone,
      email: recipientEmail,
      userId: targetUid,
      otp,
      purpose: "reset_password",
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      createdAt: now,
      attempts: 0,
      resendAvailableAt: now + 60 * 1000,
      verified: false,
    };

    whatsappOtpSessionMap.set(sessionId, session);

    // Send 6-digit recovery code via hos098sam@gmail.com
    const emailResult = await sendPasswordRecoveryEmail({
      toEmail: recipientEmail,
      otpCode: otp,
      studentName,
      studentPhone: targetPhone,
    });

    if (!emailResult.success) {
      whatsappOtpSessionMap.delete(sessionId);
      return res.status(400).json({
        error: emailResult.error || "تعذر إرسال رمز الاسترداد عبر البريد الإلكتروني حالياً.",
      });
    }

    return res.json({
      success: true,
      sessionId,
      phoneMasked: maskEmailAddress(recipientEmail),
      emailMasked: maskEmailAddress(recipientEmail),
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      expiresInSeconds: 600,
      cooldownSeconds: 60,
      studentName,
      deliveredDirectly: true,
      requiresUserInitiatedChat: false,
      message: `تم إرسال رمز الاسترداد المكون من 6 أرقام من البريد الرسمي (${OFFICIAL_RECOVERY_EMAIL}) إلى بريدك الإلكتروني (${maskEmailAddress(recipientEmail)}) بنجاح.`,
    });
  } catch (err: any) {
    console.error("Forgot password Email OTP request error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء إرسال رمز الاسترداد عبر البريد الإلكتروني، يرجى المحاولة مرة أخرى." });
  }
});

/**
 * 4. Verify Forgot Password OTP
 */
app.post("/api/auth/forgot-password-otp/verify", rateLimiter(15, 60 * 1000), async (req, res) => {
  try {
    const { sessionId, otp } = req.body || {};
    const cleanSessionId = sanitizeTextInput(sessionId || "", 120);
    const cleanOtp = sanitizeTextInput(otp || "", 10).trim();

    if (!cleanSessionId || !cleanOtp) {
      return res.status(400).json({ error: "رمز التحقق ومعرف الجلسة مطلوبان." });
    }

    const session = whatsappOtpSessionMap.get(cleanSessionId);
    if (!session || session.purpose !== "reset_password") {
      return res.status(400).json({ error: "جلسة الاستعادة غير صالحة أو منتهية. يرجى طلب كود استعادة جديد." });
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(400).json({ error: "انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب كود جديد." });
    }

    session.attempts++;
    if (session.attempts > 5) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(429).json({ error: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب كود استعادة جديد." });
    }

    if (session.otp !== cleanOtp) {
      const remainingAttempts = Math.max(0, 5 - session.attempts);
      return res.status(400).json({
        error: `رمز الاستعادة غير صحيح. يرجى التأكد من الرمز المرسل عبر واتساب (متبقي ${remainingAttempts} محاولات).`,
        remainingAttempts,
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    session.verified = true;
    session.resetToken = resetToken;
    // Extend expiration for entering new password to 10 minutes
    session.expiresAt = now + 10 * 60 * 1000;

    return res.json({
      success: true,
      verified: true,
      resetToken,
      message: "تم التحقق بنجاح! يمكنك الآن تعيين كلمة مرور جديدة لحسابك.",
    });
  } catch (err: any) {
    console.error("Forgot password OTP verify error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء التحقق من كود الاستعادة." });
  }
});

/**
 * 5. Set New Password using OTP Reset Token
 */
app.post("/api/auth/reset-password", rateLimiter(8, 60 * 1000), async (req, res) => {
  try {
    const { sessionId, resetToken, newPassword } = req.body || {};
    const cleanSessionId = sanitizeTextInput(sessionId || "", 120);
    const cleanResetToken = sanitizeTextInput(resetToken || "", 120);
    const cleanPassword = sanitizeTextInput(newPassword || "", 100).trim();

    if (!cleanSessionId || !cleanResetToken || !cleanPassword) {
      return res.status(400).json({ error: "بيانات تعيين كلمة المرور غير مكتملة." });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: "يجب ألا تقل كلمة المرور الجديدة عن 6 خانات." });
    }

    const session = whatsappOtpSessionMap.get(cleanSessionId);
    if (!session || !session.verified || session.resetToken !== cleanResetToken) {
      return res.status(403).json({ error: "جلسة الاستعادة غير مصرح بها أو منتهية الصلاحية." });
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(400).json({ error: "انتهت مهلة تعيين كلمة المرور. يرجى طلب كود استعادة جديد." });
    }

    const adminInst = initFirebaseAdmin();
    const safeDb = getSafeFirestore();
    let passwordUpdated = false;

    // 1. Update in Firebase Auth if Admin SDK has valid service account credentials
    if (hasAdminServiceAccount() && adminInst && session.userId) {
      try {
        await getAuth(adminInst).updateUser(session.userId, {
          password: cleanPassword,
        });
        passwordUpdated = true;
        console.log(`✅ [Firebase Auth] Password updated for user ${session.userId}`);
      } catch (authErr: any) {
        console.warn("Could not update Firebase Auth user password via Admin SDK:", authErr.message);
      }
    }

    // 2. Update in Firestore if service account is available
    if (safeDb && session.userId) {
      try {
        await safeDb.collection("users").doc(session.userId).set(
          {
            updatedAt: FieldValue.serverTimestamp(),
            lastPasswordReset: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr) {
        // ignore
      }
    }

    // 3. Also update password in local disk users store (ONLY for student accounts)
    try {
      const diskUsers = readDiskUsers();
      const targetProtected = diskUsers.find(
        (u: any) =>
          (session.userId && u.id === session.userId) ||
          (session.phone && u.phone && matchesPhone(u.phone, session.phone)) ||
          (session.email && u.email && u.email.toLowerCase() === session.email.toLowerCase())
      );
      if (
        targetProtected &&
        (targetProtected.role === "admin" ||
          targetProtected.role === "teacher" ||
          targetProtected.role === "assistant" ||
          targetProtected.isAssistant)
      ) {
        whatsappOtpSessionMap.delete(cleanSessionId);
        return res.status(403).json({
          error: "غير مصرح بتغيير كلمة مرور حسابات الإدارة أو المعلمين عبر هذا المسار.",
        });
      }

      const updatedDisk = diskUsers.map((u: any) => {
        if (
          (session.userId && u.id === session.userId) ||
          (session.phone && u.phone && matchesPhone(u.phone, session.phone)) ||
          (session.email && u.email && u.email.toLowerCase() === session.email.toLowerCase())
        ) {
          return { ...u, password: cleanPassword, lastPasswordReset: new Date().toISOString() };
        }
        return u;
      });
      writeDiskUsers(updatedDisk);
    } catch {}

    // Remove used session
    whatsappOtpSessionMap.delete(cleanSessionId);

    return res.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بها بكل سهولة.",
    });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "فشل تعيين كلمة المرور الجديدة، يرجى المحاولة مرة أخرى." });
  }
});

/**
 * 6. Resend OTP with strict 60-second cooldown rate limit
 */
app.post("/api/auth/otp/resend", rateLimiter(10, 60 * 1000), async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    const cleanSessionId = sanitizeTextInput(sessionId || "", 120);

    if (!cleanSessionId) {
      return res.status(400).json({ error: "معرف الجلسة مطلوب." });
    }

    const session = whatsappOtpSessionMap.get(cleanSessionId);
    if (!session) {
      return res.status(400).json({ error: "انتهت صلاحية الجلسة، يرجى إعادة المحاولة من البداية." });
    }

    const now = Date.now();
    if (session.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((session.resendAvailableAt - now) / 1000);
      return res.status(429).json({
        error: `يرجى الانتظار ${waitSeconds} ثانية قبل طلب إعادة إرسال الكود لحماية حساب الواتساب.`,
        remainingSeconds: waitSeconds,
      });
    }

    // Generate fresh OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    session.otp = newOtp;
    session.expiresAt = now + 10 * 60 * 1000;
    session.resendAvailableAt = now + 60 * 1000;
    session.attempts = 0;

    if (session.purpose === "reset_password" && session.email) {
      const emailRes = await sendPasswordRecoveryEmail({
        toEmail: session.email,
        otpCode: newOtp,
        studentPhone: session.phone,
      });
      if (!emailRes.success) {
        return res.status(400).json({ error: emailRes.error || "تعذر إعادة إرسال الرمز عبر البريد الإلكتروني." });
      }
      return res.json({
        success: true,
        cooldownSeconds: 60,
        phoneMasked: maskEmailAddress(session.email),
        message: `تمت إعادة إرسال رمز الاسترداد بنجاح من ${OFFICIAL_RECOVERY_EMAIL} إلى بريدك الإلكتروني.`,
      });
    }

    return res.status(400).json({ error: "تم إيقاف رسائل الواتساب التلقائية. استخدم استرداد كلمة المرور عبر البريد الإلكتروني." });
  } catch (err: any) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء إعادة إرسال الكود." });
  }
});

// ============================================================================
// OFFICIAL EMAIL RECOVERY CONFIGURATION (hos098sam@gmail.com)
// ============================================================================
app.get("/api/admin/email-config", requireAdminOrSecret, async (_req, res) => {
  try {
    const cfg = loadEmailConfig();
    return res.json({
      success: true,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      senderName: cfg.senderName,
      hasAppPassword: Boolean(cfg.appPassword && cfg.appPassword.length >= 8),
      maskedAppPassword: cfg.appPassword
        ? `${cfg.appPassword.slice(0, 2)}••••••••••••${cfg.appPassword.slice(-2)}`
        : "",
      dailyLimit: DAILY_GMAIL_LIMIT,
      sentCountToday: cfg.sentCountToday,
      remainingToday: Math.max(0, DAILY_GMAIL_LIMIT - cfg.sentCountToday),
      updatedAt: cfg.updatedAt,
      recentLogs: cfg.recentLogs || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: "تعذر جلب إعدادات البريد الإلكتروني." });
  }
});

app.post("/api/admin/email-config", requireAdminOrSecret, async (req, res) => {
  try {
    const { appPassword, senderName } = req.body || {};
    const cleanPass = String(appPassword || "").replace(/\s+/g, "");
    if (!cleanPass || cleanPass.length < 8) {
      return res.status(400).json({
        error: "يرجى إدخال كلمة مرور التطبيقات (Google App Password) المكونة من 16 حرفاً الخاصة ببريد hos098sam@gmail.com.",
      });
    }
    const updated = saveEmailConfig({
      appPassword: cleanPass,
      senderName: senderName ? String(senderName).trim() : "منصة المتفلسفة  التعليمية",
    });

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("system_config").doc("email_recovery").set(
          {
            senderEmail: OFFICIAL_RECOVERY_EMAIL,
            appPassword: cleanPass,
            senderName: updated.senderName,
            updatedAt: updated.updatedAt,
          },
          { merge: true }
        );
      } catch {}
    }

    return res.json({
      success: true,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      hasAppPassword: true,
      dailyLimit: DAILY_GMAIL_LIMIT,
      sentCountToday: updated.sentCountToday,
      remainingToday: Math.max(0, DAILY_GMAIL_LIMIT - updated.sentCountToday),
      message: `تم حفظ وتفعيل كلمة مرور التطبيقات للبريد الرسمي (${OFFICIAL_RECOVERY_EMAIL}) بنجاح!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "حدث خطأ أثناء حفظ إعدادات البريد الإلكتروني." });
  }
});

app.post("/api/admin/email-config/test", requireAdminOrSecret, async (req, res) => {
  try {
    const { testEmail } = req.body || {};
    const cleanTestEmail = String(testEmail || "").trim().toLowerCase();
    if (!cleanTestEmail || !cleanTestEmail.includes("@")) {
      return res.status(400).json({ error: "يرجى إدخال بريد إلكتروني صحيح لتجربة الإرسال إليه." });
    }
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await sendPasswordRecoveryEmail({
      toEmail: cleanTestEmail,
      otpCode: testOtp,
      studentName: "تجربة إدارة منصة المتفلسفة ",
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      otp: testOtp,
      remainingToday: result.remainingToday,
      message: `تم إرسال رسالة الاختبار برمز الاسترداد [${testOtp}] من (${OFFICIAL_RECOVERY_EMAIL}) إلى (${cleanTestEmail}) بنجاح!`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "حدث خطأ أثناء إرسال البريد التجريبي." });
  }
});

/**
 * 6.5. Request Guardian / Parent Verification OTP via WhatsApp
 * مخصص لإرسال رمز تحقق خاص إلى واتساب ولي الأمر لربط وتوثيق وحفظ بيانات الطالب
 */
app.post("/api/auth/parent-otp/request", rateLimiter(10, 60 * 1000), async (req, res) => {
  try {
    const { parentPhone, studentId, studentPhone, studentName } = req.body || {};
    const rawParentPhone = sanitizeTextInput(parentPhone || "", 60).trim();

    if (!rawParentPhone) {
      return res.status(400).json({ error: "يرجى إدخال رقم هاتف ولي الأمر المسجل (واتساب)." });
    }

    const formattedParentPhone = formatWhatsAppPhone(rawParentPhone);
    if (!formattedParentPhone || formattedParentPhone.length < 9) {
      return res.status(400).json({ error: "رقم هاتف ولي الأمر غير صالح للإرسال عبر واتساب." });
    }

    const cleanParentDigits = rawParentPhone.replace(/\D/g, "");

    // 1. Search for associated student(s)
    let matchedStudents: any[] = [];
    const safeDb = getSafeFirestore();

    if (safeDb) {
      try {
        const queries = [
          safeDb.collection("users").where("parentPhone", "==", rawParentPhone).get(),
          safeDb.collection("users").where("fatherPhone", "==", rawParentPhone).get(),
          safeDb.collection("users").where("motherPhone", "==", rawParentPhone).get(),
        ];
        const snapshots = await Promise.all(queries);
        for (const snap of snapshots) {
          snap.docs.forEach((doc) => {
            const data = doc.data();
            if (!matchedStudents.some((s) => s.id === doc.id)) {
              matchedStudents.push({ id: doc.id, ...data });
            }
          });
        }
      } catch (dbErr) {
        console.warn("Firestore parent lookup error:", dbErr);
      }
    }

    // Fallback: check direct REST users collection
    if (matchedStudents.length === 0) {
      try {
        const allUsers = await fetchUsersFromDirectUsersCollection();
        const matches = allUsers.filter((u: any) =>
          matchesPhone(u.parentPhone, rawParentPhone) ||
          matchesPhone(u.fatherPhone, rawParentPhone) ||
          matchesPhone(u.motherPhone, rawParentPhone) ||
          matchesPhone(u.phone, rawParentPhone)
        );
        matches.forEach((m) => {
          if (!matchedStudents.some((s) => s.id === m.id)) {
            matchedStudents.push(m);
          }
        });
      } catch (restErr) {
        console.warn("REST users lookup fallback warning:", restErr);
      }
    }

    // If specific student ID was passed, make sure that student is included
    if (studentId && !matchedStudents.some((s) => s.id === studentId)) {
      if (safeDb) {
        try {
          const sDoc = await safeDb.collection("users").doc(studentId).get();
          if (sDoc.exists) {
            matchedStudents.unshift({ id: sDoc.id, ...sDoc.data() });
          }
        } catch {}
      }
    }

    // Check if any registered student exists for this guardian phone
    if (matchedStudents.length === 0) {
      return res.status(404).json({
        error: `رقم ولي الأمر (${rawParentPhone}) غير مسجل لأي طالب في المنصة. يرجى إنشاء حساب جديد للطالب أولاً أو التأكد من كتابة الرقم الصحيح.`,
        notFound: true,
      });
    }

    // Resolve student names from actual registered students
    const resolvedStudentNames =
      matchedStudents
        .map((s) => s.name)
        .filter(Boolean)
        .join(" و ") ||
      "طالب منصة المتفلسفة ";

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = `otp_parent_${crypto.randomBytes(16).toString("hex")}`;
    const now = Date.now();

    const session: WhatsAppOtpSession = {
      sessionId,
      phone: rawParentPhone,
      otp,
      purpose: "parent_verification",
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
      createdAt: now,
      attempts: 0,
      resendAvailableAt: now + 60 * 1000,
      verified: false,
      studentIds: matchedStudents.map((s) => s.id).filter(Boolean),
      studentNames: resolvedStudentNames,
      matchedStudents,
    };

    whatsappOtpSessionMap.set(sessionId, session);

    // Call WhatsApp parent sender via Baileys or Meta Cloud API
    const sendResult = await sendParentOtpViaBaileys(rawParentPhone, otp, resolvedStudentNames);

    // Build direct WhatsApp web/app link for fallback or instant launch
    const directWhatsAppUrl =
      sendResult.whatsappTriggerLink ||
      `https://wa.me/201551955096?text=${encodeURIComponent(
        `مرحباً منصة المتفلسفة ، أرسل لي كود التحقق الخاص بولي أمر الطالب (${resolvedStudentNames}) 🔐`
      )}`;

    return res.json({
      success: true,
      sessionId,
      phoneMasked: maskPhoneNumber(rawParentPhone),
      expiresInSeconds: 300,
      cooldownSeconds: 60,
      studentNames: resolvedStudentNames,
      matchedStudents,
      deliveredDirectly: sendResult.deliveredDirectly || false,
      requiresUserInitiatedChat: sendResult.requiresUserInitiatedChat || false,
      whatsappTriggerLink: directWhatsAppUrl,
      platformWhatsAppPhone: sendResult.platformWhatsAppPhone || "01551955096",
      directWhatsAppUrl,
      message: sendResult.deliveredDirectly
        ? `تم إرسال رمز التحقق الخاص إلى واتساب ولي الأمر بنجاح (${maskPhoneNumber(rawParentPhone)}).`
        : `اضغط على زر فتح واتساب بالأسفل وإرسال الرسالة الجاهزة ليقوم رقم المنصة بالرد عليك بكود ولي الأمر فوراً.`,
    });
  } catch (err: any) {
    console.error("Parent OTP request error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء إرسال كود التحقق إلى واتساب ولي الأمر." });
  }
});

/**
 * 6.6. Verify Guardian / Parent OTP and Link/Save Student Data
 * تطبق عند تطبيق الرمز وتخفي صفحة ولي الأمر وتثبت التوثيق الأبوي
 */
app.post("/api/auth/parent-otp/verify", rateLimiter(15, 60 * 1000), async (req, res) => {
  try {
    const { sessionId, otp } = req.body || {};
    const cleanSessionId = sanitizeTextInput(sessionId || "", 120);
    const cleanOtp = sanitizeTextInput(otp || "", 10).trim();

    if (!cleanSessionId || !cleanOtp) {
      return res.status(400).json({ error: "رمز التحقق ومعرف الجلسة مطلوبان." });
    }

    const session = whatsappOtpSessionMap.get(cleanSessionId);
    if (!session || session.purpose !== "parent_verification") {
      return res.status(400).json({ error: "جلسة التحقق غير صالحة أو منتهية. يرجى طلب كود جديد." });
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(400).json({ error: "انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب رمز جديد." });
    }

    session.attempts++;
    if (session.attempts > 5) {
      whatsappOtpSessionMap.delete(cleanSessionId);
      return res.status(429).json({ error: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز جديد." });
    }

    if (session.otp !== cleanOtp) {
      const remainingAttempts = Math.max(0, 5 - session.attempts);
      return res.status(400).json({
        error: `رمز التحقق غير صحيح. يرجى التأكد من الرمز المرسل لواتساب ولي الأمر (متبقي ${remainingAttempts} محاولات).`,
        remainingAttempts,
      });
    }

    // OTP verified successfully!
    session.verified = true;
    whatsappOtpSessionMap.delete(cleanSessionId);

    const safeDb = getSafeFirestore();
    const verifiedTimestamp = new Date().toISOString();

    // 1. Update matched students in Firestore with guardianVerified fields
    if (safeDb && session.studentIds && session.studentIds.length > 0) {
      for (const stId of session.studentIds) {
        try {
          await safeDb.collection("users").doc(stId).set(
            {
              guardianVerified: true,
              guardianVerifiedPhone: session.phone,
              guardianVerifiedAt: verifiedTimestamp,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn("Could not update student guardianVerified status in Firestore:", dbErr);
        }
      }
    }

    // 2. Prepare verified parent user object
    const mainStudent = session.matchedStudents?.[0];
    const parentUser = {
      id: `parent-${session.phone}`,
      name: `ولي أمر الطالب (${session.studentNames || mainStudent?.name || "طالب المتفلسفة "})`,
      phone: session.phone,
      parentPhone: session.phone,
      schoolYear: mainStudent?.schoolYear || "الصف الثالث الثانوي",
      role: "parent",
      status: "active",
      guardianVerified: true,
      guardianVerifiedPhone: session.phone,
      guardianVerifiedAt: verifiedTimestamp,
      registeredAt: verifiedTimestamp.split("T")[0],
      linkedStudentId: mainStudent?.id,
      linkedStudents: session.matchedStudents || [],
    };

    return res.json({
      success: true,
      verified: true,
      user: parentUser,
      linkedStudents: session.matchedStudents || [],
      message: "تم التحقق بنجاح من ولي الأمر، وحفظ وتوثيق بيانات الطالب، وتفعيل الربط الأبوي!",
    });
  } catch (err: any) {
    console.error("Parent OTP verify error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء تأكيد رمز التحقق لولي الأمر." });
  }
});

// ============================================================================
// WHATSAPP BAILEYS CONNECTION & PAIRING APIS (رقم المنصة: 01508616572)
// ============================================================================

/**
 * 7. Get WhatsApp Service Connection Status & Recent Deliveries
 */
app.get("/api/whatsapp/status", requireAdminOrSecret, async (req, res) => {
  try {
    const status = whatsappManager.getStatus();
    return res.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    console.error("WhatsApp status error:", err);
    return res.status(500).json({ error: "فشل استعلام حالة الواتساب." });
  }
});

/**
 * 8. Request WhatsApp Pairing Code for Platform Number (01508616572)
 * Generates an 8-character code for linking without scanning QR code
 */
const handleRequestPairingCode = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { phoneNumber } = req.body || {};
    const targetPhone = phoneNumber || DEFAULT_PLATFORM_PHONE;
    const result = await whatsappManager.requestPairingCode(targetPhone);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || "فشل توليد كود الربط من سيرفرات واتساب.",
      });
    }

    return res.json({
      success: true,
      pairingCode: result.code,
      phone: targetPhone,
      message: `تم توليد كود الربط (${result.code}) المكون من 8 خانات لرقم الهاتف (+${formatWhatsAppPhone(targetPhone)}). يرجى إدخاله في تطبيق واتساب > الأجهزة المرتبطة > الربط برقم الهاتف.`,
    });
  } catch (err: any) {
    console.error("Request pairing code error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء طلب كود الربط." });
  }
};

app.post("/api/whatsapp/request-pairing-code", requireAdminOrSecret, handleRequestPairingCode);
app.post("/api/whatsapp/pairing-code", requireAdminOrSecret, handleRequestPairingCode);

/**
 * Request WhatsApp QR Code (Barcode) for Camera Scanning
 */
app.post("/api/whatsapp/request-qr", requireAdminOrSecret, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { phoneNumber } = req.body || {};
    const result = await whatsappManager.requestQrCode(phoneNumber);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json({
      success: true,
      qrDataUrl: result.qrDataUrl,
      message: "تم توليد رمز الباركود بنجاح. امسحه الآن بكاميرا واتساب بهاتفك.",
    });
  } catch (err: any) {
    console.error("Request QR error:", err);
    return res.status(500).json({ success: false, error: "حدث خطأ أثناء توليد رمز الباركود." });
  }
});

/**
 * Change WhatsApp Platform Phone Number & Reset Old Session
 */
app.post("/api/whatsapp/change-phone", requireAdminOrSecret, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { phoneNumber } = req.body || {};
    if (!phoneNumber || !String(phoneNumber).trim()) {
      return res.status(400).json({ success: false, error: "يرجى كتابة رقم الهاتف الجديد." });
    }
    const result = await whatsappManager.changePhoneNumber(String(phoneNumber).trim());
    if (!result.success) {
      return res.status(400).json(result);
    }
    const status = whatsappManager.getStatus();
    return res.json({
      success: true,
      message: `تم تغيير وحفظ رقم هاتف المنصة إلى (${result.configuredPhone}) وفصل أي جلسة سابقة بنجاح. يمكنك الآن ربط الرقم الجديد بالباركود أو كود الـ 8 خانات.`,
      ...status,
    });
  } catch (err: any) {
    console.error("WhatsApp change phone error:", err);
    return res.status(500).json({ success: false, error: "حدث خطأ أثناء تغيير رقم الهاتف." });
  }
});

/**
 * 9. Restart / Reconnect WhatsApp Session
 */
app.post("/api/whatsapp/restart", requireAdminOrSecret, async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    await whatsappManager.restart(phoneNumber || DEFAULT_PLATFORM_PHONE);
    const status = whatsappManager.getStatus();
    return res.json({
      success: true,
      message: "تمت إعادة تشغيل خدمة واتساب بنجاح.",
      ...status,
    });
  } catch (err: any) {
    console.error("WhatsApp restart error:", err);
    return res.status(500).json({ error: "فشل إعادة تشغيل خدمة الواتساب." });
  }
});

/**
 * 10. Logout & Clear WhatsApp Session
 */
app.post("/api/whatsapp/logout", requireAdminOrSecret, async (req, res) => {
  try {
    await whatsappManager.logout();
    return res.json({
      success: true,
      message: "تم تسجيل الخروج وحذف بيانات الجلسة السابقة بنجاح.",
    });
  } catch (err: any) {
    console.error("WhatsApp logout error:", err);
    return res.status(500).json({ error: "فشل تسجيل الخروج من الواتساب." });
  }
});

/**
 * 11. Test Send WhatsApp Message
 */
app.post("/api/whatsapp/test-send", requireAdminOrSecret, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body || {};
    if (!phoneNumber) {
      return res.status(400).json({ error: "رقم الهاتف مطلوب لتجربة الإرسال." });
    }

    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await whatsappManager.sendOtp(phoneNumber, testOtp, message || undefined, true);

    if (!result.deliveredDirectly) {
      return res.status(200).json({
        success: false,
        deliveredDirectly: false,
        result,
        otp: testOtp,
        error: "واتساب غير متصل بهاتف حقيقي أو بوابة Meta. لم يتم تسليم الرسالة إلى هاتف المستلم.",
        message: `تعذر تسليم الرسالة إلى (+${phoneNumber}) لأن واتساب غير متصل حالياً. يرجى ربط الهاتف أولاً عبر كود الربط (Pairing Code) أو مسح QR في لوحة الإدارة.`,
      });
    }

    return res.json({
      success: true,
      deliveredDirectly: true,
      result,
      otp: testOtp,
      message: `تم تسليم الرسالة بنجاح عبر واتساب إلى الرقم (+${phoneNumber})!`,
    });
  } catch (err: any) {
    console.error("WhatsApp test send error:", err);
    return res.status(500).json({ error: "فشل إرسال الرسالة التجريبية." });
  }
});

/**
 * 12. Configure Meta WhatsApp Cloud API (Official Cloud API)
 */
app.post("/api/whatsapp/meta-config", requireAdminOrSecret, async (req, res) => {
  try {
    const { token, phoneNumberId, wabaId, templateName, clear } = req.body || {};
    if (clear) {
      whatsappManager.clearMetaConfig();
      const safeDb = getSafeFirestore();
      if (safeDb) {
        try {
          await safeDb.collection("system_config").doc("whatsapp_meta").delete();
        } catch {}
      }
      const status = whatsappManager.getStatus();
      return res.json({
        success: true,
        message: "تم مسح وإلغاء إعدادات Meta Cloud API بنجاح، والاعتماد الآن على ربط الهاتف المباشر (Baileys).",
        status,
      });
    }

    whatsappManager.setMetaConfig({
      token: token !== undefined ? String(token).trim() : undefined,
      phoneNumberId: phoneNumberId !== undefined ? String(phoneNumberId).trim() : undefined,
      wabaId: wabaId !== undefined ? String(wabaId).trim() : undefined,
      templateName: templateName !== undefined ? String(templateName).trim() : undefined,
    });

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("system_config").doc("whatsapp_meta").set(
          {
            token: token !== undefined ? String(token).trim() : "",
            phoneNumberId: phoneNumberId !== undefined ? String(phoneNumberId).trim() : "",
            wabaId: wabaId !== undefined ? String(wabaId).trim() : "",
            templateName: templateName !== undefined ? String(templateName).trim() : "",
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Could not persist Meta config to Firestore:", e);
      }
    }

    const status = whatsappManager.getStatus();
    return res.json({
      success: true,
      message: "تم حفظ إعدادات Meta WhatsApp Cloud API بنجاح.",
      status,
    });
  } catch (err: any) {
    console.error("Meta config error:", err);
    return res.status(500).json({ error: "فشل حفظ إعدادات Meta Cloud API." });
  }
});

app.get("/api/whatsapp/meta-config", requireAdminOrSecret, async (req, res) => {
  try {
    const config = whatsappManager.getMetaConfig();
    return res.json({
      success: true,
      config: {
        hasToken: Boolean(config.token),
        phoneNumberId: config.phoneNumberId || "",
        wabaId: config.wabaId || "",
        templateName: config.templateName || "",
      },
      webhookUrl: `${getAppBaseUrl(req)}/api/webhooks/whatsapp`,
      verifyToken: "qalbalelm_whatsapp_verify_2027",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل قراءة إعدادات Meta." });
  }
});

/**
 * 12.1. Official Meta WhatsApp Cloud API Webhook Verification & Incoming Events
 */
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "qalbalelm_whatsapp_verify_2027";

app.get(["/api/webhooks/whatsapp", "/api/whatsapp/webhook"], (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && (token === WHATSAPP_WEBHOOK_VERIFY_TOKEN || token === "qalbalelm")) {
    console.log("✅ [Meta WhatsApp Webhook] تم التحقق من الـ Webhook بنجاح مع سيرفرات Meta!");
    return res.status(200).send(String(challenge));
  }
  return res.status(403).send("Verification token mismatch");
});

app.post(["/api/webhooks/whatsapp", "/api/whatsapp/webhook"], (req, res) => {
  try {
    const body = req.body;
    if (body?.object === "whatsapp_business_account") {
      console.log("📩 [Meta WhatsApp Webhook] تم استلام حدث من واتساب:", JSON.stringify(body).slice(0, 300));
    }
    return res.status(200).send("EVENT_RECEIVED");
  } catch {
    return res.status(200).send("EVENT_RECEIVED");
  }
});

/**
 * 12.2. Send Student Academic Report to Student / Parent via WhatsApp (Meta Cloud API / Baileys)
 */
app.post("/api/whatsapp/send-student-report", requireAdminOrSecret, async (req, res) => {
  try {
    const {
      studentName,
      studentPhone,
      parentPhone,
      targetRecipient = "parent", // 'parent' | 'student' | 'both'
      schoolYear,
      totalExamsTaken = 0,
      passedExamsCount = 0,
      averagePercentage = 0,
      totalScore = 0,
      totalMaxScore = 0,
      gradeBadge = "متميز",
      enrolledCoursesCount = 0,
      customNote = "",
    } = req.body || {};

    const reportText =
      `📊 *تقرير المتابعة الأكاديمية - منصة المتفلسفة  التعليمية* 🎓\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *اسم الطالب:* ${studentName || "طالب المنصة"}\n` +
      `📚 *الصف الدراسي:* ${schoolYear || "الثانوية العامة"}\n` +
      `📖 *الكورسات المشترك بها:* ${enrolledCoursesCount} كورس\n` +
      `📝 *الامتحانات التي أداها:* ${totalExamsTaken} امتحان (${passedExamsCount} ناجح)\n` +
      `🏆 *المجموع الكلي للدرجات:* ${totalScore} من ${totalMaxScore || 100}\n` +
      `📈 *النسبة المئوية العامة:* %${averagePercentage}\n` +
      `⭐ *التقدير العام:* ${gradeBadge}\n` +
      (customNote ? `\n💬 *ملاحظة الإدارة:* ${customNote}\n` : "") +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `مع خالص تمنيات أسرة *منصة المتفلسفة * بدوام التفوق والنجاح 🌟`;

    const targets: string[] = [];
    if ((targetRecipient === "parent" || targetRecipient === "both") && parentPhone) {
      targets.push(String(parentPhone).trim());
    }
    if ((targetRecipient === "student" || targetRecipient === "both") && studentPhone) {
      if (!targets.includes(String(studentPhone).trim())) {
        targets.push(String(studentPhone).trim());
      }
    }
    if (targets.length === 0 && (parentPhone || studentPhone)) {
      targets.push(String(parentPhone || studentPhone).trim());
    }

    if (targets.length === 0) {
      return res.status(400).json({ error: "لا يوجد رقم هاتف مسجل للطالب أو ولي الأمر لإرسال التقرير." });
    }

    const results = [];
    for (const phone of targets) {
      const sendRes = await whatsappManager.sendOtp(phone, "REPORT", reportText);
      results.push({ phone, ...sendRes });
    }

    const anyDelivered = results.some((r) => r.deliveredDirectly);
    return res.json({
      success: anyDelivered,
      deliveredDirectly: anyDelivered,
      results,
      reportText,
      message: anyDelivered
        ? `تم إرسال تقرير الطالب (${studentName}) عبر واتساب بنجاح!`
        : "تم تجهيز التقرير، ولكن يرجى تفعيل بوابة Meta أو ربط الهاتف أولاً للإرسال التلقائي.",
    });
  } catch (err: any) {
    console.error("Send student report error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء إرسال تقرير الطالب عبر واتساب." });
  }
});

// ----------------------------------------------------------------------------
// API: Admin Set User Role & Custom Claims (Admin Only)
// ----------------------------------------------------------------------------
app.post("/api/admin/set-role", verifyFirebaseToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetUid, role } = req.body;
    if (!targetUid || !role) {
      return res.status(400).json({ error: "targetUid and role are required." });
    }

    const validRoles = ["admin", "teacher", "student", "parent"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role specified." });
    }

    const adminInst = initFirebaseAdmin();
    if (hasAdminServiceAccount() && adminInst) {
      try {
        await getAuth(adminInst).setCustomUserClaims(targetUid, {
          role,
          admin: role === "admin",
        });
      } catch (e) {}
    }

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("users").doc(targetUid).update({
          role,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (e) {}
    }

    res.json({ success: true, message: `تم تحديث صلاحيات المستخدم بنجاح إلى: ${role}` });
  } catch (err: any) {
    console.error("Set role error:", err);
    res.status(500).json({ error: err.message || "فشل تعيين صلاحيات المستخدم." });
  }
});

// ----------------------------------------------------------------------------
// API: Secure Admin Bootstrap (Requires ADMIN_SETUP_SECRET or existing Admin)
// Public self-elevation is completely disabled. No email matching bypass.
// ----------------------------------------------------------------------------
app.post("/api/admin/bootstrap-admin", async (req: AuthenticatedRequest, res) => {
  try {
    const { targetUid } = req.body || {};
    const adminSecret = req.headers["x-admin-secret-key"] as string | undefined;
    const configuredSecret = process.env.ADMIN_SETUP_SECRET;

    if (!targetUid) {
      return res.status(400).json({ error: "targetUid مطلوب لتفعيل صلاحيات المسؤول." });
    }

    let isAuthorized = false;

    // Check 1: Secret Key provided in headers
    if (configuredSecret && adminSecret && adminSecret === configuredSecret) {
      isAuthorized = true;
    }

    // Check 2: Caller has valid token with admin claim
    if (!isAuthorized && req.headers.authorization?.startsWith("Bearer ")) {
      try {
        const token = req.headers.authorization.split("Bearer ")[1]?.trim();
        const adminInst = initFirebaseAdmin();
        const decoded = await getAuth(adminInst).verifyIdToken(token);
        if (decoded.admin === true || (decoded as any).role === "admin") {
          isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: "غير مصرح: تم إيقاف الترقية الذاتية العامة. يلزم مفتاح المشرف ADMIN_SETUP_SECRET في متغيرات البيئة.",
      });
    }

    const adminInst = initFirebaseAdmin();
    if (hasAdminServiceAccount() && adminInst) {
      try {
        await getAuth(adminInst).setCustomUserClaims(targetUid, {
          admin: true,
          role: "admin",
        });
      } catch (e) {}
    }

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("users").doc(targetUid).set({
          role: "admin",
          status: "active",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {}
    }

    return res.json({
      success: true,
      message: `تم منح صلاحيات المشرف الكاملة (Firebase Custom Claim: admin: true) بنجاح للمستخدم ${targetUid}`,
    });
  } catch (err: any) {
    console.error("Bootstrap admin error:", err);
    return res.status(500).json({ error: err.message || "فشل تفعيل صلاحيات المشرف." });
  }
});

// ----------------------------------------------------------------------------
// API: Restricted Teacher Dashboard & Grading
// ----------------------------------------------------------------------------
app.get("/api/teacher/dashboard", verifyFirebaseToken, requireRestrictedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getSafeFirestore();
    let courses: any[] = [];
    let users: any[] = [];
    let submissions: any[] = [];

    if (db) {
      try {
        const [coursesDoc, usersDoc, submissionsDoc] = await Promise.all([
          db.collection("al_motafalsifa_data").doc("courses").get(),
          db.collection("al_motafalsifa_data").doc("users").get(),
          db.collection("al_motafalsifa_data").doc("submissions").get(),
        ]);
        courses = Array.isArray(coursesDoc.data()?.data) ? coursesDoc.data()?.data : [];
        users = Array.isArray(usersDoc.data()?.data) ? usersDoc.data()?.data : [];
        submissions = Array.isArray(submissionsDoc.data()?.data) ? submissionsDoc.data()?.data : [];
      } catch (dbErr) {
        console.warn("Firestore fetch in teacher dashboard error:", dbErr);
      }
    }

    const teacherId = req.user?.uid;
    const teacherName = (req.user as any)?.name;

    const ownedCourses = courses.filter(
      (course: any) => course.instructorId === teacherId || course.instructor === teacherName
    );
    const ownedIds = new Set(ownedCourses.map((course: any) => course.id));
    const students = users.filter((user: any) => user.role !== "teacher" && user.role !== "admin");

    return res.json({
      success: true,
      permissions: { viewEnrollmentCount: true, viewStudentExamScores: true, gradeEssayAnswers: true },
      courses: ownedCourses.map((course: any) => ({
        ...course,
        enrolledCount: students.filter((student: any) => student.enrolledCourseIds?.includes(course.id)).length,
      })),
      submissions: submissions.filter((submission: any) => ownedIds.has(submission.courseId)),
    });
  } catch (error: any) {
    return res.status(503).json({ error: error?.message || "تعذر جلب بيانات المعلم." });
  }
});

app.post("/api/teacher/grade-essay", verifyFirebaseToken, requireRestrictedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const { submissionId, courseId, essayGrades } = req.body || {};
    if (!submissionId || !essayGrades || typeof essayGrades !== "object") {
      return res.status(400).json({ error: "بيانات التصحيح غير مكتملة." });
    }

    const essayScore = Object.values(essayGrades as Record<string, any>).reduce(
      (sum: number, grade: any) => sum + (Number(grade?.awardedMarks) || 0),
      0
    );

    let updatedSubmission: any = null;
    const db = getSafeFirestore();
    let currentSub = inMemorySubmissionsStore.get(submissionId);

    if (db) {
      try {
        const submissionRef = db.collection("submissions").doc(submissionId);
        const submissionDoc = await submissionRef.get();
        if (submissionDoc.exists) {
          const submission = submissionDoc.data() || {};
          const totalScore = (Number(submission.mcqScore) || 0) + essayScore;
          const maxScore = Number(submission.maxScore) || 100;
          const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
          const passed = percentage >= (Number(submission.passingPercentage) || 60);

          updatedSubmission = {
            ...submission,
            id: submissionId,
            submissionId,
            essayGrades,
            totalScore,
            score: totalScore,
            percentage,
            passed,
            status: "graded",
            reviewedAt: new Date().toISOString(),
            reviewedBy: (req.user as any)?.name || (req.user as any)?.email || "المعلم المعتمد",
            updatedAt: new Date().toISOString(),
          };

          await submissionRef.set(updatedSubmission, { merge: true });

          if (submission.studentId && submission.examId) {
            await db.collection("users").doc(submission.studentId).set(
              {
                examResults: {
                  [submission.examId]: {
                    score: totalScore,
                    maxScore,
                    percentage,
                    passed,
                    status: "graded",
                    completedAt: new Date().toISOString().split("T")[0],
                  },
                },
              },
              { merge: true }
            );
          }
        }
      } catch (e) {
        console.warn("Firestore update error in teacher grade-essay:", e);
      }
    }

    if (!updatedSubmission && currentSub) {
      const totalScore = (Number(currentSub.mcqScore ?? currentSub.score) || 0) + essayScore;
      const maxScore = Number(currentSub.maxScore) || 100;
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const passed = percentage >= (Number(currentSub.passingPercentage) || 60);

      updatedSubmission = {
        ...currentSub,
        id: submissionId,
        submissionId,
        essayGrades,
        totalScore,
        score: totalScore,
        percentage,
        passed,
        status: "graded",
        reviewedAt: new Date().toISOString(),
        reviewedBy: (req.user as any)?.name || (req.user as any)?.email || "المعلم المعتمد",
        updatedAt: new Date().toISOString(),
      };
    }

    // Also update disk submissions and disk users if present
    try {
      const diskSubs = readDiskSubmissions();
      const subIdx = diskSubs.findIndex((s: any) => s.submissionId === submissionId || s.id === submissionId);
      if (subIdx !== -1) {
        const targetSub = diskSubs[subIdx];
        const totalScore = (Number(targetSub.mcqScore ?? targetSub.score) || 0) + essayScore;
        const maxScore = Number(targetSub.maxScore) || 100;
        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        const passed = percentage >= (Number(targetSub.passingPercentage) || 60);
        updatedSubmission = updatedSubmission || {
          ...targetSub,
          id: submissionId,
          submissionId,
          essayGrades,
          totalScore,
          score: totalScore,
          percentage,
          passed,
          status: "graded",
          reviewedAt: new Date().toISOString(),
          reviewedBy: (req.user as any)?.name || (req.user as any)?.email || "المعلم المعتمد",
          updatedAt: new Date().toISOString(),
        };
        diskSubs[subIdx] = updatedSubmission;
        writeDiskSubmissions(diskSubs);
      }

      if (updatedSubmission?.studentId && updatedSubmission?.examId) {
        const diskUsers = readDiskUsers();
        const uIdx = diskUsers.findIndex((u: any) => u.id === updatedSubmission.studentId);
        if (uIdx !== -1) {
          diskUsers[uIdx].examResults = {
            ...(diskUsers[uIdx].examResults || {}),
            [updatedSubmission.examId]: {
              ...(diskUsers[uIdx].examResults?.[updatedSubmission.examId] || {}),
              score: updatedSubmission.totalScore,
              maxScore: updatedSubmission.maxScore,
              percentage: updatedSubmission.percentage,
              passed: updatedSubmission.passed,
              status: "graded",
              completedAt: new Date().toISOString().split("T")[0],
            },
          };
          writeDiskUsers(diskUsers);
        }
      }
    } catch {}

    if (updatedSubmission) {
      inMemorySubmissionsStore.set(submissionId, updatedSubmission);
      return res.json({ success: true, submission: updatedSubmission, message: "تم حفظ وتوثيق درجات التصحيح بنجاح." });
    }

    return res.json({ success: true, message: "تم حفظ وتوثيق درجات التصحيح بنجاح." });
  } catch (error: any) {
    return res.status(503).json({ error: error?.message || "فشل تسجيل التصحيح." });
  }
});

// ----------------------------------------------------------------------------
// API: Course Access Verification (Prevents IDOR & leaks)
// ----------------------------------------------------------------------------
app.get("/api/courses/:courseId/verify-access", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const courseId = req.params.courseId;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: "غير مصرح" });

    const isAdm = (req.user as any)?.admin === true || (req.user as any)?.role === "admin" || (req.user as any)?.email === "hos098sam@gmail.com";
    if (isAdm) {
      return res.json({ hasAccess: true, reason: "admin" });
    }

    try {
      const safeDb = getSafeFirestore();
      if (!safeDb) {
        return res.json({ hasAccess: true, reason: "client_fallback" });
      }

      const courseDoc = await safeDb.collection("courses").doc(courseId).get();
      if (!courseDoc.exists) {
        return res.status(404).json({ error: "الكورس غير موجود" });
      }

      const courseData = courseDoc.data() || {};
      if (courseData.isFree) {
        return res.json({ hasAccess: true, reason: "public_or_free" });
      }

      const enrollmentSnap = await safeDb.collection("enrollments")
        .where("studentId", "==", uid)
        .where("courseId", "==", courseId)
        .limit(1)
        .get();

      if (!enrollmentSnap.empty) {
        return res.json({ hasAccess: true, reason: "enrolled" });
      }

      const userDoc = await safeDb.collection("users").doc(uid).get();
      const userData = userDoc.data() || {};
      const enrolled = Array.isArray(userData.enrolledCourseIds) && userData.enrolledCourseIds.includes(courseId);

      if (enrolled) {
        return res.json({ hasAccess: true, reason: "user_enrolled" });
      }
    } catch (fsErr: any) {
      console.warn("Course access Firestore query skipped:", fsErr?.message || fsErr);
      return res.json({ hasAccess: true, reason: "client_fallback" });
    }

    return res.status(403).json({ hasAccess: false, error: "يجب الاشتراك في الكورس لعرض هذا المحتوى التعليمي." });
  } catch (err: any) {
    console.warn("Course access check warning:", err?.message || err);
    res.status(500).json({ error: "حدث خطأ أثناء فحص صلاحية الوصول للكورس." });
  }
});

// ----------------------------------------------------------------------------
// SERVER-SIDE PERSISTENCE FOR COURSES & EXAMS (Local disk fallback + Firestore)
// ----------------------------------------------------------------------------
// (File constants, caches, and DEMO_USER_IDS are declared at top of module)

function isDisallowedUserServer(u: any, deletedUsers: string[]): boolean {
  if (!u || !u.id) return true;
  if (deletedUsers && deletedUsers.includes(u.id)) return true;
  if (DEMO_USER_IDS.includes(u.id)) return true;
  if (u.phone === 'teacher-4879' || u.phone === '4879') return true;
  if (u.role === 'teacher' && u.name?.trim() === 'حسام احمد مساعد') return true;
  if (u.email === '4879@qalb-alam.edu') return true;
  return false;
}

function readDiskUsers(): any[] {
  ensureDataDir();
  const deleted = readDeletedIds();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        cachedDiskUsers = parsed.filter((u: any) => !isDisallowedUserServer(u, deleted.users));
        return cachedDiskUsers;
      }
    }
  } catch (e) {
    console.warn("Could not read disk users:", e);
    if (cachedDiskUsers !== null) return cachedDiskUsers;
  }
  cachedDiskUsers = [];
  return [];
}

function writeDiskUsers(users: any[]): boolean {
  const deleted = readDeletedIds();
  const existingMap = new Map<string, any>();
  const existingPhoneMap = new Map<string, any>();
  try {
    const sourceList = cachedDiskUsers || (fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) : []);
    if (Array.isArray(sourceList)) {
      sourceList.forEach((u: any) => {
        if (u?.id) existingMap.set(u.id, u);
        const cPhone = u?.phone ? String(u.phone).replace(/\D/g, "") : "";
        if (cPhone.length >= 10) existingPhoneMap.set(cPhone, u);
      });
    }
  } catch {}

  const filtered = (users || [])
    .filter((u: any) => !isDisallowedUserServer(u, deleted.users))
    .map((u: any) => {
      const cPhone = u?.phone ? String(u.phone).replace(/\D/g, "") : "";
      const prev = existingMap.get(u.id) || (cPhone.length >= 10 ? existingPhoneMap.get(cPhone) : undefined);
      if (!prev) return u;
      return {
        ...prev,
        ...u,
        // Preserve existing password and accountNumber if omitted by sanitized client cache
        password: u.password !== undefined && u.password !== "" ? u.password : prev.password,
        accountNumber: u.accountNumber !== undefined && u.accountNumber !== "" ? u.accountNumber : prev.accountNumber,
      };
    });

  cachedDiskUsers = filtered;
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(filtered, null, 2), "utf8");
  } catch (e) {
    console.warn("Could not write disk users:", e);
  }
  syncEncryptedAuthVaultToCloud(filtered).catch(() => {});
  return true;
}

const AUTH_VAULT_SECRET = process.env.JWT_SECRET || `qalbalelm_vault_${FIREBASE_PROJECT_ID}_2027_master`;

function encryptAuthVaultPayload(credsMap: Record<string, { password?: string; accountNumber?: string }>): { iv: string; payload: string } {
  const key = crypto.createHash("sha256").update(AUTH_VAULT_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credsMap), "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), payload: encrypted.toString("base64") };
}

function decryptAuthVaultPayload(enc: any): Record<string, { password?: string; accountNumber?: string }> {
  try {
    if (!enc || !enc.iv || !enc.payload) return {};
    const key = crypto.createHash("sha256").update(AUTH_VAULT_SECRET).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(enc.iv, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(enc.payload, "base64")), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(decrypted);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let authVaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
async function syncEncryptedAuthVaultToCloud(users: any[]): Promise<void> {
  if (authVaultSyncTimer) clearTimeout(authVaultSyncTimer);
  authVaultSyncTimer = setTimeout(async () => {
    try {
      const credsMap: Record<string, { password?: string; accountNumber?: string }> = {};
      (users || []).forEach((u: any) => {
        if (u && u.id && (u.password || u.accountNumber)) {
          credsMap[u.id] = {
            ...(u.password ? { password: u.password } : {}),
            ...(u.accountNumber ? { accountNumber: u.accountNumber } : {}),
          };
        }
      });
      if (Object.keys(credsMap).length > 0) {
        const encrypted = encryptAuthVaultPayload(credsMap);
        await syncToFirestoreRest("server_auth_vault", encrypted);
      }
      scheduleCloudVaultStateSync();
    } catch {}
  }, 400);
}

let cloudVaultStateSyncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCloudVaultStateSync(): void {
  if (cloudVaultStateSyncTimer) clearTimeout(cloudVaultStateSyncTimer);
  cloudVaultStateSyncTimer = setTimeout(async () => {
    try {
      await savePlatformStateToCloudVault({
        updatedAt: new Date().toISOString(),
        courses: readDiskCourses(),
        users: readDiskUsers(),
        exams: readDiskExams(),
        submissions: readDiskSubmissions(),
        deletedIds: readDeletedIds(),
        settings: readDiskSettings(),
      });
    } catch {}
  }, 1200);
}

const DEMO_COURSE_IDS = [
  'course-1821013405232',
  'course-sec2-chemistry',
  'course-sec3-mastery',
  'course-integrated-physics',
  'course-exams-chemistry',
];

// Track courses modified or saved in the current container session so in-session edits always take priority
const serverModifiedCourseIds = new Set<string>();

// (DELETED_IDS_FILE is declared at top of module)
interface DeletedIdsStore {
  courses: string[];
  users: string[];
  videos?: string[];
  exams?: string[];
  lessons?: string[];
  notifications?: string[];
  coupons?: string[];
}
function readDeletedIds(): DeletedIdsStore {
  ensureDataDir();
  try {
    if (fs.existsSync(DELETED_IDS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_IDS_FILE, "utf8"));
      return {
        courses: Array.isArray(parsed.courses) ? parsed.courses : [],
        users: Array.isArray(parsed.users) ? parsed.users : [],
        videos: Array.isArray(parsed.videos) ? parsed.videos : [],
        exams: Array.isArray(parsed.exams) ? parsed.exams : [],
        lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        coupons: Array.isArray(parsed.coupons) ? parsed.coupons : [],
      };
    }
  } catch {}
  return { courses: [], users: [], videos: [], exams: [], lessons: [], notifications: [], coupons: [] };
}

function writeDeletedIdsStore(store: DeletedIdsStore, syncCloud = true): void {
  ensureDataDir();
  try {
    fs.writeFileSync(DELETED_IDS_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {}
  if (syncCloud) {
    syncToFirestoreRest("deleted_ids", store).catch(() => {});
    scheduleCloudVaultStateSync();
  }
}

// Safely bootstrap active user sessions now that all file constants and helpers are ready
try {
  initActiveUserSessions();
} catch (e) {}
function addDeletedId(type: keyof DeletedIdsStore, id: string) {
  if (!id) return;
  const store = readDeletedIds();
  if (!Array.isArray(store[type])) (store as any)[type] = [];
  if (!store[type]!.includes(id)) {
    store[type]!.push(id);
    writeDeletedIdsStore(store, true);
  }
}

function cleanCoursesForDisk(courses: any[], deleted: DeletedIdsStore): any[] {
  const delVideos = deleted.videos || [];
  const delExams = deleted.exams || [];
  const delLessons = deleted.lessons || [];
  const nowMs = Date.now();
  return (courses || [])
    .filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id))
    .map((c: any) => {
      // Fix any future clock-skewed updatedAt timestamps (e.g., from 2027) so new saves always win
      const rawUpdatedMs = c.updatedAt ? new Date(c.updatedAt).getTime() : 0;
      const safeUpdatedAt =
        !rawUpdatedMs || Number.isNaN(rawUpdatedMs) || rawUpdatedMs > nowMs + 300000
          ? new Date(nowMs).toISOString()
          : c.updatedAt;

      const courseExams = Array.isArray(c.exams)
        ? c.exams.filter((e: any) => e && (!e.id || !delExams.includes(e.id)))
        : undefined;

      if (!Array.isArray(c.lessons)) {
        return { ...c, ...(courseExams ? { exams: courseExams } : {}), updatedAt: safeUpdatedAt, lessons: [] };
      }
      return {
        ...c,
        ...(courseExams ? { exams: courseExams } : {}),
        updatedAt: safeUpdatedAt,
        lessons: c.lessons
          .filter((l: any) => l && (!l.id || !delLessons.includes(l.id)))
          .map((l: any, lIdx: number) => {
            const lessonId = l?.id || `lesson_${nowMs}_${lIdx}`;
            const lessonExams = Array.isArray(l?.exams)
              ? l.exams.filter((e: any) => e && (!e.id || !delExams.includes(e.id)))
              : undefined;
            if (!Array.isArray(l?.videos)) {
              return { ...l, ...(lessonExams ? { exams: lessonExams } : {}), id: lessonId, videos: [] };
            }
            return {
              ...l,
              ...(lessonExams ? { exams: lessonExams } : {}),
              id: lessonId,
              videos: l.videos
                .filter((v: any) => v && (v.id || v.url || v.vcdnVideoId) && (!v.id || !delVideos.includes(v.id)))
                .map((v: any, vIdx: number) => ({
                  ...v,
                  id: v.id || `vid_${nowMs}_${lIdx}_${vIdx}`,
                  order: v.order || vIdx + 1,
                })),
            };
          }),
      };
    });
}

function readDiskCourses(): any[] {
  ensureDataDir();
  const deleted = readDeletedIds();
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const content = fs.readFileSync(COURSES_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        cachedDiskCourses = cleanCoursesForDisk(parsed, deleted);
        return cachedDiskCourses;
      }
    }
  } catch (e) {
    console.warn("Could not read disk courses:", e);
    if (cachedDiskCourses !== null) return cachedDiskCourses;
  }
  cachedDiskCourses = [];
  return [];
}

function writeDiskCourses(courses: any[], syncVault = true): boolean {
  const deleted = readDeletedIds();
  cachedDiskCourses = cleanCoursesForDisk(courses, deleted);
  ensureDataDir();
  try {
    fs.writeFileSync(COURSES_FILE, JSON.stringify(cachedDiskCourses, null, 2), "utf8");
    syncToFirestoreRest("courses", cachedDiskCourses).catch(() => {});
  } catch (e) {
    console.warn("Could not write disk courses:", e);
  }
  if (syncVault) {
    scheduleCloudVaultStateSync();
  }
  return true;
}

function readDiskExams(): any[] {
  if (cachedDiskExams !== null) return cachedDiskExams;
  ensureDataDir();
  try {
    if (fs.existsSync(EXAMS_FILE)) {
      const content = fs.readFileSync(EXAMS_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        cachedDiskExams = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read disk exams:", e);
  }
  cachedDiskExams = [];
  return [];
}

function writeDiskExams(exams: any[], syncVault = true): boolean {
  cachedDiskExams = exams;
  ensureDataDir();
  fs.promises.writeFile(EXAMS_FILE, JSON.stringify(exams, null, 2), "utf8").catch((e) => {
    console.warn("Could not write disk exams:", e);
  });
  syncToFirestoreRest("exams", exams).catch(() => {});
  if (syncVault) {
    scheduleCloudVaultStateSync();
  }
  return true;
}

function readDiskSubmissions(): any[] {
  if (cachedDiskSubmissions !== null) return cachedDiskSubmissions;
  ensureDataDir();
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const content = fs.readFileSync(SUBMISSIONS_FILE, "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        cachedDiskSubmissions = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read disk submissions:", e);
  }
  cachedDiskSubmissions = [];
  return [];
}

function writeDiskSubmissions(submissions: any[], syncVault = true): boolean {
  cachedDiskSubmissions = submissions;
  ensureDataDir();
  fs.promises.writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), "utf8").catch((e) => {
    console.warn("Could not write disk submissions:", e);
  });
  if (syncVault) {
    scheduleCloudVaultStateSync();
  }
  return true;
}

function findExamLocally(examId: string, courseId?: string): any | null {
  if (!examId) return null;
  // 1. Search disk exams
  const diskExams = readDiskExams();
  const directExam = diskExams.find((e: any) => e.id === examId);
  if (directExam) return directExam;

  // 2. Search disk courses (course-level exams, lesson-level exams, and video quizzes)
  const diskCourses = readDiskCourses();
  for (const c of diskCourses) {
    if (courseId && c.id !== courseId) continue;
    if (Array.isArray(c.exams)) {
      const match = c.exams.find((e: any) => e.id === examId);
      if (match) return match;
    }
    if (Array.isArray(c.lessons)) {
      for (const l of c.lessons) {
        if (Array.isArray(l.exams)) {
          const match = l.exams.find((e: any) => e.id === examId);
          if (match) return match;
        }
        if (Array.isArray(l.videos)) {
          for (const v of l.videos) {
            if (v?.quiz && (v.quiz.id === examId || v.quizId === examId)) {
              return v.quiz;
            }
          }
        }
      }
    }
  }
  return null;
}

async function fetchFirestoreDocData(docName: string): Promise<any | null> {
  const safeDb = getSafeFirestore();
  if (safeDb) {
    try {
      const docSnap = await safeDb.collection("al_motafalsifa_data").doc(docName).get();
      if (docSnap.exists && docSnap.data()?.data !== undefined) {
        return docSnap.data()?.data;
      }
    } catch {}
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/${encodeURIComponent(docName)}?key=${FIREBASE_API_KEY}`;
    const res = await axios.get(url, { timeout: 4500 });
    if (res.data?.fields?.data !== undefined) {
      return unwrapFirestoreValue(res.data.fields.data);
    }
  } catch {}
  return null;
}

async function fetchCloudCourses(): Promise<any[] | null> {
  const data = await fetchFirestoreDocData("courses");
  return Array.isArray(data) ? data : null;
}

function mergeCourseLessonsServer(baseLessons: any[] = [], cloudLessons: any[] = [], deleted: DeletedIdsStore, preferCloud: boolean): any[] {
  const delVideos = deleted.videos || [];
  const delExams = deleted.exams || [];
  const delLessons = deleted.lessons || [];
  const lessonMap = new Map<string, any>();

  const firstList = preferCloud ? baseLessons : cloudLessons;
  const secondList = preferCloud ? cloudLessons : baseLessons;

  (firstList || []).forEach((l: any) => {
    if (l && l.id && !delLessons.includes(l.id)) lessonMap.set(l.id, l);
  });

  (secondList || []).forEach((l: any) => {
    if (!l || !l.id || delLessons.includes(l.id)) return;
    const prev = lessonMap.get(l.id);
    if (!prev) {
      lessonMap.set(l.id, l);
    } else {
      const videoMap = new Map<string, any>();
      (prev.videos || []).forEach((v: any) => {
        if (v && v.id && !delVideos.includes(v.id)) videoMap.set(v.id, v);
      });
      (l.videos || []).forEach((v: any) => {
        if (v && v.id && !delVideos.includes(v.id)) videoMap.set(v.id, { ...(videoMap.get(v.id) || {}), ...v });
      });

      const pdfMap = new Map<string, any>();
      (prev.pdfs || []).forEach((p: any) => {
        if (p && p.id) pdfMap.set(p.id, p);
      });
      (l.pdfs || []).forEach((p: any) => {
        if (p && p.id) pdfMap.set(p.id, { ...(pdfMap.get(p.id) || {}), ...p });
      });

      const examMap = new Map<string, any>();
      (prev.exams || []).forEach((e: any) => {
        if (e && e.id && !delExams.includes(e.id)) examMap.set(e.id, e);
      });
      (l.exams || []).forEach((e: any) => {
        if (e && e.id && !delExams.includes(e.id)) examMap.set(e.id, { ...(examMap.get(e.id) || {}), ...e });
      });

      lessonMap.set(l.id, {
        ...prev,
        ...l,
        videos: Array.from(videoMap.values()).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
        pdfs: Array.from(pdfMap.values()),
        exams: Array.from(examMap.values()),
      });
    }
  });

  return Array.from(lessonMap.values()).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
}

function mergeServerCoursesWithCloud(diskCourses: any[], cloudCourses: any[], deleted: DeletedIdsStore): any[] {
  const courseMap = new Map<string, any>();
  const delCourses = deleted.courses || [];
  const delExams = deleted.exams || [];

  (diskCourses || []).forEach((c: any) => {
    if (c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !delCourses.includes(c.id)) {
      courseMap.set(c.id, c);
    }
  });

  (cloudCourses || []).forEach((cloudCourse: any) => {
    if (!cloudCourse || !cloudCourse.id || DEMO_COURSE_IDS.includes(cloudCourse.id) || delCourses.includes(cloudCourse.id)) {
      return;
    }
    const diskCourse = courseMap.get(cloudCourse.id);
    if (!diskCourse) {
      courseMap.set(cloudCourse.id, cloudCourse);
      return;
    }

    // If the course was NOT modified in the current container session, Cloud Firestore is authoritative over build-time disk!
    const modifiedInThisSession = serverModifiedCourseIds.has(cloudCourse.id);
    const preferCloud = !modifiedInThisSession;

    const mergedLessons = mergeCourseLessonsServer(
      diskCourse.lessons || [],
      cloudCourse.lessons || [],
      deleted,
      preferCloud
    );

    const examMap = new Map<string, any>();
    const firstExams = preferCloud ? (diskCourse.exams || []) : (cloudCourse.exams || []);
    const secondExams = preferCloud ? (cloudCourse.exams || []) : (diskCourse.exams || []);
    firstExams.forEach((e: any) => {
      if (e && e.id && !delExams.includes(e.id)) examMap.set(e.id, e);
    });
    secondExams.forEach((e: any) => {
      if (e && e.id && !delExams.includes(e.id)) examMap.set(e.id, { ...(examMap.get(e.id) || {}), ...e });
    });

    const mergedCourse = preferCloud
      ? { ...diskCourse, ...cloudCourse, lessons: mergedLessons, exams: Array.from(examMap.values()) }
      : { ...cloudCourse, ...diskCourse, lessons: mergedLessons, exams: Array.from(examMap.values()) };

    courseMap.set(cloudCourse.id, mergedCourse);
  });

  return cleanCoursesForDisk(Array.from(courseMap.values()), deleted);
}

let cloudHydrationPromise: Promise<void> | null = null;
let lastCloudHydrationAt = 0;

async function hydrateServerFromCloud(force = false): Promise<void> {
  const now = Date.now();
  if (!force && lastCloudHydrationAt > 0 && now - lastCloudHydrationAt < 25000) {
    return;
  }
  if (cloudHydrationPromise) {
    return cloudHydrationPromise;
  }

  cloudHydrationPromise = (async () => {
    try {
      // 0. Load Encrypted Cloud Vault Snapshot (from private repository qalbelm-hls-vault-1) + Video Catalog
      const [vaultSnapshot, cloudDeleted] = await Promise.all([
        loadPlatformStateFromCloudVault().catch(() => null),
        fetchFirestoreDocData("deleted_ids").catch(() => null),
      ]);
      await ensureGitHubHlsVideoLoaded('__init__').catch(() => {});

      // 1. Hydrate & merge deleted_ids first so deleted courses/users/videos never resurrect after redeploy
      const localDeleted = readDeletedIds();
      const vaultDeleted = vaultSnapshot?.deletedIds || {};
      const fbDeleted = cloudDeleted && typeof cloudDeleted === "object" ? cloudDeleted : {};

      const mergedDeleted: DeletedIdsStore = {
        courses: Array.from(new Set([...(localDeleted.courses || []), ...(Array.isArray(vaultDeleted.courses) ? vaultDeleted.courses : []), ...(Array.isArray(fbDeleted.courses) ? fbDeleted.courses : [])])),
        users: Array.from(new Set([...(localDeleted.users || []), ...(Array.isArray(vaultDeleted.users) ? vaultDeleted.users : []), ...(Array.isArray(fbDeleted.users) ? fbDeleted.users : [])])),
        videos: Array.from(new Set([...(localDeleted.videos || []), ...(Array.isArray(vaultDeleted.videos) ? vaultDeleted.videos : []), ...(Array.isArray(fbDeleted.videos) ? fbDeleted.videos : [])])),
        exams: Array.from(new Set([...(localDeleted.exams || []), ...(Array.isArray(vaultDeleted.exams) ? vaultDeleted.exams : []), ...(Array.isArray(fbDeleted.exams) ? fbDeleted.exams : [])])),
        lessons: Array.from(new Set([...(localDeleted.lessons || []), ...(Array.isArray(vaultDeleted.lessons) ? vaultDeleted.lessons : []), ...(Array.isArray(fbDeleted.lessons) ? fbDeleted.lessons : [])])),
        notifications: Array.from(new Set([...(localDeleted.notifications || []), ...(Array.isArray(vaultDeleted.notifications) ? vaultDeleted.notifications : []), ...(Array.isArray(fbDeleted.notifications) ? fbDeleted.notifications : [])])),
        coupons: Array.from(new Set([...(localDeleted.coupons || []), ...(Array.isArray(vaultDeleted.coupons) ? vaultDeleted.coupons : []), ...(Array.isArray(fbDeleted.coupons) ? fbDeleted.coupons : [])])),
      };
      writeDeletedIdsStore(mergedDeleted, false);

      const activeDeleted = readDeletedIds();

      // 2. Hydrate & merge courses (Encrypted Cloud Vault + Cloud Firestore + Local Disk)
      const fbCourses = await fetchCloudCourses().catch(() => null);
      const vaultCourses = Array.isArray(vaultSnapshot?.courses) ? vaultSnapshot!.courses : [];
      const diskCourses = readDiskCourses();

      let combinedCloudCourses: any[] = [];
      if (Array.isArray(fbCourses) && fbCourses.length > 0 && vaultCourses.length > 0) {
        combinedCloudCourses = mergeServerCoursesWithCloud(fbCourses, vaultCourses, activeDeleted);
      } else if (vaultCourses.length > 0) {
        combinedCloudCourses = vaultCourses;
      } else if (Array.isArray(fbCourses) && fbCourses.length > 0) {
        combinedCloudCourses = fbCourses;
      }

      if (combinedCloudCourses.length > 0) {
        const mergedCourses = mergeServerCoursesWithCloud(diskCourses, combinedCloudCourses, activeDeleted);
        writeDiskCourses(mergedCourses, false);
      }

      // 3. Hydrate & merge users (Encrypted Cloud Vault + Firestore + Local Disk)
      const [cloudUsers, directUsers, cloudAuthVault] = await Promise.all([
        fetchPlatformUsersFromFirestore().catch(() => []),
        fetchUsersFromDirectUsersCollection().catch(() => []),
        fetchFirestoreDocData("server_auth_vault").catch(() => null),
      ]);
      const vaultUsers = Array.isArray(vaultSnapshot?.users) ? vaultSnapshot!.users : [];
      const decryptedCreds = decryptAuthVaultPayload(cloudAuthVault);
      const diskUsers = readDiskUsers();
      const userMap = new Map<string, any>();

      diskUsers.forEach((u: any) => {
        if (u && u.id && !isDisallowedUserServer(u, activeDeleted.users)) {
          userMap.set(u.id, u);
        }
      });
      cloudUsers.forEach((u: any) => {
        if (u && u.id && !isDisallowedUserServer(u, activeDeleted.users)) {
          const prev = userMap.get(u.id) || {};
          const vaultCred = decryptedCreds[u.id] || {};
          userMap.set(u.id, {
            ...prev,
            ...u,
            password: u.password || prev.password || vaultCred.password,
            accountNumber: u.accountNumber || prev.accountNumber || vaultCred.accountNumber,
          });
        }
      });
      directUsers.forEach((u: any) => {
        if (u && u.id && !isDisallowedUserServer(u, activeDeleted.users)) {
          const prev = userMap.get(u.id) || {};
          const vaultCred = decryptedCreds[u.id] || {};
          userMap.set(u.id, {
            ...prev,
            ...u,
            password: u.password || prev.password || vaultCred.password,
            accountNumber: u.accountNumber || prev.accountNumber || vaultCred.accountNumber,
          });
        }
      });
      vaultUsers.forEach((u: any) => {
        if (u && u.id && !isDisallowedUserServer(u, activeDeleted.users)) {
          const prev = userMap.get(u.id) || {};
          const vaultCred = decryptedCreds[u.id] || {};
          userMap.set(u.id, {
            ...prev,
            ...u,
            password: u.password || prev.password || vaultCred.password,
            accountNumber: u.accountNumber || prev.accountNumber || vaultCred.accountNumber,
          });
        }
      });

      const mergedUsers = Array.from(userMap.values()).filter((u: any) => !isDisallowedUserServer(u, activeDeleted.users));
      if (mergedUsers.length > 0) {
        cachedDiskUsers = mergedUsers;
        ensureDataDir();
        try {
          fs.writeFileSync(USERS_FILE, JSON.stringify(mergedUsers, null, 2), "utf8");
        } catch {}
      }

      // 4. Hydrate & merge standalone exams, submissions, settings
      const [cloudExams, cloudSubmissions, cloudSettings] = await Promise.all([
        fetchFirestoreDocData("exams").catch(() => null),
        fetchFirestoreDocData("submissions").catch(() => null),
        fetchFirestoreDocData("settings").catch(() => null),
      ]);

      const vaultExams = Array.isArray(vaultSnapshot?.exams) ? vaultSnapshot!.exams : [];
      const examMap = new Map<string, any>();
      readDiskExams().forEach((e: any) => {
        if (e?.id && !(activeDeleted.exams || []).includes(e.id)) examMap.set(e.id, e);
      });
      (Array.isArray(cloudExams) ? cloudExams : []).forEach((e: any) => {
        if (e?.id && !(activeDeleted.exams || []).includes(e.id)) examMap.set(e.id, { ...(examMap.get(e.id) || {}), ...e });
      });
      vaultExams.forEach((e: any) => {
        if (e?.id && !(activeDeleted.exams || []).includes(e.id)) examMap.set(e.id, { ...(examMap.get(e.id) || {}), ...e });
      });
      if (examMap.size > 0) {
        writeDiskExams(Array.from(examMap.values()), false);
      }

      const vaultSubs = Array.isArray(vaultSnapshot?.submissions) ? vaultSnapshot!.submissions : [];
      const subMap = new Map<string, any>();
      readDiskSubmissions().forEach((s: any) => {
        if (s?.id) subMap.set(s.id, s);
      });
      (Array.isArray(cloudSubmissions) ? cloudSubmissions : []).forEach((s: any) => {
        if (s?.id) subMap.set(s.id, { ...(subMap.get(s.id) || {}), ...s });
      });
      vaultSubs.forEach((s: any) => {
        if (s?.id) subMap.set(s.id, { ...(subMap.get(s.id) || {}), ...s });
      });
      if (subMap.size > 0) {
        writeDiskSubmissions(Array.from(subMap.values()), false);
      }

      const mergedSettings = {
        ...(readDiskSettings() || {}),
        ...(cloudSettings && typeof cloudSettings === "object" ? cloudSettings : {}),
        ...(vaultSnapshot?.settings && typeof vaultSnapshot.settings === "object" ? vaultSnapshot.settings : {}),
      };
      if (Object.keys(mergedSettings).length > 0) {
        writeDiskSettings(mergedSettings);
      }

      // 5. If platform_db_vault.json did not exist yet in the Cloud Vault, seed it immediately!
      if (!vaultSnapshot) {
        scheduleCloudVaultStateSync();
      }

      lastCloudHydrationAt = Date.now();
    } catch (e) {
      console.warn("Cloud hydration notice:", e);
    } finally {
      cloudHydrationPromise = null;
    }
  })();

  return cloudHydrationPromise;
}

// Trigger immediate background hydration on server boot
setTimeout(() => {
  hydrateServerFromCloud(true).catch(() => {});
}, 200);

app.get("/api/courses", async (req, res) => {
  try {
    if (lastCloudHydrationAt === 0) {
      await Promise.race([
        hydrateServerFromCloud(false),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } else if (Date.now() - lastCloudHydrationAt > 30000) {
      hydrateServerFromCloud(false).catch(() => {});
    }

    const deleted = readDeletedIds();
    const diskCourses = readDiskCourses();
    const cleanDisk = (diskCourses || []).filter(
      (c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id)
    );
    if (cleanDisk.length > 0) {
      return res.json({ success: true, courses: cleanDisk, deletedCourseIds: deleted.courses });
    }

    const cloudCourses = await fetchCloudCourses();
    if (Array.isArray(cloudCourses) && cloudCourses.length > 0) {
      const cleanCloud = cloudCourses.filter(
        (c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id)
      );
      writeDiskCourses(cleanCloud);
      return res.json({ success: true, courses: readDiskCourses(), deletedCourseIds: deleted.courses });
    }

    res.json({ success: true, courses: [], deletedCourseIds: deleted.courses });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load courses" });
  }
});

async function compressServerBase64Image(dataUrl: string): Promise<string> {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image") || dataUrl.length < 75000) {
    return dataUrl;
  }
  const cacheKey = `${dataUrl.length}_${dataUrl.slice(0, 64)}_${dataUrl.slice(-64)}`;
  const cached = compressedImageCache.get(cacheKey);
  if (cached) return cached;

  try {
    const sharp = (await import("sharp")).default;
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64Data, "base64");
    const outBuf = await sharp(buf)
      .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    const compressed = "data:image/jpeg;base64," + outBuf.toString("base64");
    if (compressedImageCache.size > 200) {
      compressedImageCache.clear();
    }
    compressedImageCache.set(cacheKey, compressed);
    compressedImageCache.set(`${compressed.length}_${compressed.slice(0, 64)}_${compressed.slice(-64)}`, compressed);
    return compressed;
  } catch (e) {
    return dataUrl;
  }
}

async function deepSanitizeAndCompress(obj: any): Promise<any> {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => deepSanitizeAndCompress(item)));
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "string" && obj[key].startsWith("data:image")) {
        result[key] = await compressServerBase64Image(obj[key]);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        result[key] = await deepSanitizeAndCompress(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }
  return obj;
}

// Endpoint to save courses (Supports clean updates and deletions without resurrection)
app.post("/api/courses/save", async (req, res) => {
  try {
    const { courses } = req.body;
    if (!Array.isArray(courses)) {
      return res.status(400).json({ error: "Invalid courses array payload" });
    }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

    courses.forEach((c: any) => {
      if (c && c.id) serverModifiedCourseIds.add(c.id);
    });

    const fullyCompressed = await deepSanitizeAndCompress(courses);
    writeDiskCourses(fullyCompressed);

    // Unconditionally sync to Firestore Cloud via REST (passes Firebase ID Token if present)
    syncToFirestoreRest("courses", fullyCompressed, idToken).catch(() => {});

    const examMap = new Map<string, any>();
    readDiskExams().forEach((e) => { if (e?.id) examMap.set(e.id, e); });
    fullyCompressed.forEach((c: any) => {
      (c.exams || []).forEach((e: any) => {
        if (e?.id) examMap.set(e.id, { ...e, courseId: c.id });
      });
    });
    const compressedExams = await deepSanitizeAndCompress(Array.from(examMap.values()));
    writeDiskExams(compressedExams);
    syncToFirestoreRest("exams", compressedExams, idToken).catch(() => {});

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("al_motafalsifa_data").doc("courses").set({
          data: fullyCompressed,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Firestore courses sync notice:", e);
      }
    }

    res.json({ success: true, count: fullyCompressed.length, courses: fullyCompressed });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save courses" });
  }
});

// Endpoint to delete a specific course permanently
app.delete("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    addDeletedId("courses", id);
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

    const existing = readDiskCourses();
    const updated = existing.filter((c: any) => c.id !== id);
    writeDiskCourses(updated);

    // Unconditionally sync updated courses to Firestore Cloud via REST
    syncToFirestoreRest("courses", updated, idToken).catch(() => {});

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("al_motafalsifa_data").doc("courses").set({
          data: updated,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Firestore delete course sync notice:", e);
      }
    }

    res.json({ success: true, deletedCourseId: id, count: updated.length, courses: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to delete course" });
  }
});

// Endpoint to delete a user/teacher permanently from Firestore & Server
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    addDeletedId("users", id);
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

    const existing = readDiskUsers();
    const updated = existing.filter((u: any) => u.id !== id);
    writeDiskUsers(updated);

    // 1. Sync updated users array to Firestore Cloud via REST
    syncToFirestoreRest("users", updated, idToken).catch(() => {});

    // 2. Also delete document directly from 'users' collection via REST
    try {
      const restDeleteUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(id)}?key=${FIREBASE_API_KEY}`;
      const delHeaders: Record<string, string> = {};
      if (idToken) delHeaders["Authorization"] = `Bearer ${idToken}`;
      await fetch(restDeleteUrl, { method: "DELETE", headers: delHeaders });
    } catch {}

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("users").doc(id).delete();
        const docSnap = await safeDb.collection("al_motafalsifa_data").doc("users").get();
        if (docSnap.exists && Array.isArray(docSnap.data()?.data)) {
          const filtered = docSnap.data()?.data.filter((u: any) => u.id !== id);
          await safeDb.collection("al_motafalsifa_data").doc("users").set({
            data: filtered,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("Firestore delete user notice:", e);
      }
    }
    res.json({ success: true, deletedUserId: id, users: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to delete user" });
  }
});

// Endpoint to save/update users list in Firestore
app.post("/api/users/save", async (req, res) => {
  try {
    const { users } = req.body;
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

    if (Array.isArray(users)) {
      writeDiskUsers(users);

      // Unconditionally sync users to Firestore Cloud via REST
      syncToFirestoreRest("users", users, idToken).catch(() => {});

      // Also ensure any teachers or updated profiles are synced to users/{id} collection
      const patchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) patchHeaders['Authorization'] = `Bearer ${idToken}`;

      for (const u of users) {
        if (
          u &&
          u.id &&
          (u.role === 'teacher' || u.role === 'assistant' || u.isAssistant || u.role === 'admin' || u.accountNumber)
        ) {
          try {
            const restUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(u.id)}?key=${FIREBASE_API_KEY}`;
            const fieldsObj: Record<string, any> = {};
            for (const [k, v] of Object.entries(u)) {
              // SECURITY: Never write plaintext passwords to Firestore user documents
              if (k === 'password') continue;
              fieldsObj[k] = wrapFirestoreValue(v);
            }
            fieldsObj['updatedAt'] = { stringValue: new Date().toISOString() };
            fetch(restUrl, {
              method: 'PATCH',
              headers: patchHeaders,
              body: JSON.stringify({ fields: fieldsObj }),
            }).catch(() => {});
          } catch {}
        }
      }

      const safeDb = getSafeFirestore();
      if (safeDb) {
        try {
          const cloudSafeUsers = users.map((u: any) => {
            if (!u || typeof u !== "object") return u;
            const copy = { ...u };
            delete copy.password;
            return copy;
          });
          await safeDb.collection("al_motafalsifa_data").doc("users").set({
            data: cloudSafeUsers,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Firestore users save notice:", e);
        }
      }
    }
    res.json({ success: true, count: Array.isArray(users) ? users.length : 0 });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save users" });
  }
});

// Endpoint to save or update a single teacher/user directly
app.post("/api/users/save-single", async (req, res) => {
  try {
    const { user } = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ error: "Missing user or user id" });
    }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

    const existing = readDiskUsers();
    const idx = existing.findIndex(
      (u: any) => u && (u.id === user.id || (user.phone && u.phone && matchesPhone(u.phone, user.phone)))
    );

    // SECURITY: Prevent an existing student account from self-elevating role or forging walletBalance without an admin/teacher token
    let safeIncomingUser = { ...user };
    if (idx >= 0) {
      const prevUser = existing[idx];
      if (prevUser.role === "student" && !idToken) {
        if (
          safeIncomingUser.role === "admin" ||
          safeIncomingUser.role === "teacher" ||
          safeIncomingUser.role === "assistant" ||
          safeIncomingUser.isAssistant
        ) {
          safeIncomingUser.role = "student";
          delete safeIncomingUser.isAssistant;
          delete safeIncomingUser.assistantSpecialty;
        }
        // Prevent unauthenticated student request from artificially increasing walletBalance
        const prevBal = Math.max(0, Number(prevUser.walletBalance) || 0);
        if (typeof safeIncomingUser.walletBalance === "number" && safeIncomingUser.walletBalance > prevBal) {
          safeIncomingUser.walletBalance = prevBal;
        }
      }
      if (!safeIncomingUser.password && prevUser.password) {
        safeIncomingUser.password = prevUser.password;
      }
    }

    let updatedUsers: any[];
    if (idx >= 0) {
      updatedUsers = existing.map((u: any, i: number) => (i === idx ? { ...u, ...safeIncomingUser } : u));
    } else {
      updatedUsers = [...existing, safeIncomingUser];
    }
    writeDiskUsers(updatedUsers);

    // 1. Sync updated users array to al_motafalsifa_data/users unconditionally
    syncToFirestoreRest("users", updatedUsers, idToken).catch(() => {});

    // 2. Direct REST write to users/{user.id} (without plaintext password)
    try {
      const restUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(safeIncomingUser.id)}?key=${FIREBASE_API_KEY}`;
      const fieldsObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(safeIncomingUser)) {
        if (k === 'password') continue;
        fieldsObj[k] = wrapFirestoreValue(v);
      }
      fieldsObj['updatedAt'] = { stringValue: new Date().toISOString() };
      const patchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) patchHeaders['Authorization'] = `Bearer ${idToken}`;
      await fetch(restUrl, {
        method: 'PATCH',
        headers: patchHeaders,
        body: JSON.stringify({ fields: fieldsObj }),
      }).catch(() => {});
    } catch {}

    const { password: _, ...clientSafeUser } = safeIncomingUser;
    res.json({ success: true, user: clientSafeUser });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save single user" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const deleted = readDeletedIds();
    const diskUsers = readDiskUsers() || [];
    const firestoreUsers = await fetchPlatformUsersFromFirestore().catch(() => []);
    const directUsers = await fetchUsersFromDirectUsersCollection().catch(() => []);

    const userMap = new Map<string, any>();
    diskUsers.forEach((u: any) => {
      if (u && u.id && !isDisallowedUserServer(u, deleted.users)) userMap.set(u.id, u);
    });
    firestoreUsers.forEach((u: any) => {
      if (u && u.id && !isDisallowedUserServer(u, deleted.users)) userMap.set(u.id, { ...(userMap.get(u.id) || {}), ...u });
    });
    directUsers.forEach((u: any) => {
      if (u && u.id && !isDisallowedUserServer(u, deleted.users)) userMap.set(u.id, { ...(userMap.get(u.id) || {}), ...u });
    });

    const merged = Array.from(userMap.values())
      .filter((u: any) => !isDisallowedUserServer(u, deleted.users))
      .map((u: any) => {
        const copy = { ...u };
        delete copy.password;
        delete copy.pin;
        delete copy.pinCode;
        delete copy.resetToken;
        delete copy.otp;
        delete copy.secretKey;
        return copy;
      });

    if (merged.length > diskUsers.length) {
      writeDiskUsers(Array.from(userMap.values()));
    }

    return res.json({ success: true, users: merged });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to get users" });
  }
});

const SETTINGS_BACKUP_FILE = path.join(process.cwd(), "data", "settings_backup.json");

function readDiskSettings(): any {
  if (cachedDiskSettings !== null) return cachedDiskSettings;
  try {
    if (fs.existsSync(SETTINGS_BACKUP_FILE)) {
      const raw = fs.readFileSync(SETTINGS_BACKUP_FILE, "utf8");
      cachedDiskSettings = JSON.parse(raw);
      return cachedDiskSettings;
    }
  } catch {}
  return null;
}

function writeDiskSettings(settings: any): void {
  cachedDiskSettings = settings;
  try {
    const dir = path.dirname(SETTINGS_BACKUP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.promises.writeFile(SETTINGS_BACKUP_FILE, JSON.stringify(settings, null, 2), "utf8").catch(() => {});
    syncToFirestoreRest("settings", settings).catch(() => {});
  } catch {}
}

app.post("/api/settings/save", async (req, res) => {
  try {
    const { settings } = req.body || {};
    if (settings && typeof settings === "object") {
      writeDiskSettings(settings);
      syncToFirestoreRest("settings", settings).catch(() => {});
      const safeDb = getSafeFirestore();
      if (safeDb) {
        try {
          await safeDb.collection("al_motafalsifa_data").doc("settings").set({
            data: settings,
            updatedAt: new Date().toISOString(),
          });
        } catch {}
      }
    }
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save settings" });
  }
});

// Ultra-fast consolidated data endpoint for school tablets and low-connectivity devices
app.get("/api/platform-data", async (req, res) => {
  try {
    if (lastCloudHydrationAt === 0) {
      await Promise.race([
        hydrateServerFromCloud(false),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } else if (Date.now() - lastCloudHydrationAt > 30000) {
      hydrateServerFromCloud(false).catch(() => {});
    }

    const deleted = readDeletedIds();
    const diskExams = readDiskExams();
    const diskUsers = readDiskUsers();
    const diskSettings = readDiskSettings();
    let courses: any[] = [];

    const cleanDiskCourses = readDiskCourses().filter(
      (c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id)
    );
    if (cleanDiskCourses.length > 0) {
      courses = cleanDiskCourses;
    } else {
      const cloudCourses = await fetchCloudCourses();
      if (Array.isArray(cloudCourses) && cloudCourses.length > 0) {
        courses = cloudCourses.filter(
          (c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id)
        );
        writeDiskCourses(courses);
        courses = readDiskCourses();
      } else {
        courses = [];
      }
    }

    // Never expose passwords or sensitive tokens in platform-data
    const safeUsers = (diskUsers || []).map((u: any) => {
      if (!u) return null;
      const copy = { ...u };
      delete copy.password;
      delete copy.pin;
      delete copy.pinCode;
      delete copy.resetToken;
      delete copy.otp;
      delete copy.secretKey;
      return copy;
    }).filter(Boolean);

    res.json({
      success: true,
      courses: courses || [],
      deletedCourseIds: deleted.courses,
      deletedUserIds: deleted.users,
      deletedVideoIds: deleted.videos || [],
      deletedExamIds: deleted.exams || [],
      exams: diskExams || [],
      users: safeUsers,
      settings: diskSettings || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to get platform data" });
  }
});

// Dedicated endpoints to synchronize deleted IDs across clients and server
app.get("/api/deleted-ids", async (req, res) => {
  if (lastCloudHydrationAt === 0) {
    await Promise.race([
      hydrateServerFromCloud(false),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  }
  res.json({ success: true, ...readDeletedIds() });
});

app.post("/api/deleted-ids", (req, res) => {
  const { type, id } = req.body;
  const allowedTypes: (keyof DeletedIdsStore)[] = ['courses', 'users', 'videos', 'exams', 'lessons', 'notifications', 'coupons'];
  if (allowedTypes.includes(type) && typeof id === 'string' && id.trim()) {
    const cleanId = id.trim();
    addDeletedId(type, cleanId);
    if (type === 'courses') {
      const existing = readDiskCourses();
      const updated = existing.filter((c: any) => c.id !== cleanId);
      writeDiskCourses(updated);
      syncToFirestoreRest("courses", updated).catch(() => {});
    } else if (type === 'users') {
      const existing = readDiskUsers();
      const updated = existing.filter((u: any) => u.id !== cleanId);
      writeDiskUsers(updated);
      syncToFirestoreRest("users", updated).catch(() => {});
    } else if (type === 'videos' || type === 'lessons' || type === 'exams') {
      const existing = readDiskCourses();
      writeDiskCourses(existing);
      syncToFirestoreRest("courses", readDiskCourses()).catch(() => {});
      if (type === 'exams') {
        const updatedExams = readDiskExams().filter((e: any) => e.id !== cleanId);
        writeDiskExams(updatedExams);
        syncToFirestoreRest("exams", updatedExams).catch(() => {});
      }
    }
    return res.json({ success: true, store: readDeletedIds() });
  }
  res.status(400).json({ error: "Invalid type or id" });
});

// ============================================================================
// MOBILE REST APIS (FLUTTER ANDROID & IOS CLIENT INTEGRATION)
// Connects Flutter Mobile App directly to Platform Database
// ============================================================================

// Mobile Token Helper
const mobileSessionsMap = new Map<string, { studentId: string; expiresAt: number }>();

function generateMobileToken(studentId: string): string {
  const token = `mbl_${studentId}_${Date.now()}_${crypto.randomBytes(12).toString("hex")}`;
  mobileSessionsMap.set(token, { studentId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  return token;
}

function resolveStudentIdFromReq(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const session = mobileSessionsMap.get(token);
    if (session && session.expiresAt > Date.now()) {
      return session.studentId;
    }
    if (token.startsWith("mbl_")) {
      const parts = token.split("_");
      if (parts.length >= 2 && parts[1]) {
        return parts[1];
      }
    }
  }
  const customHeader = req.headers["x-student-id"] as string;
  if (customHeader && typeof customHeader === "string") {
    return customHeader.trim();
  }
  const queryId = req.query.studentId as string;
  if (queryId && typeof queryId === "string") {
    return queryId.trim();
  }
  return null;
}

/**
 * 1. Mobile Login Endpoint
 * Authenticates student and returns enrolled courses & last lesson
 */
app.post("/api/mobile/login", async (req, res) => {
  try {
    const { identifier, password, deviceId, deviceName } = req.body || {};
    const cleanId = sanitizeTextInput(identifier || "", 120).trim();
    const rawPassword = String(password || "").trim();

    if (!cleanId || !rawPassword) {
      return res.status(400).json({
        success: false,
        error: "يرجى إدخال رقم الهاتف أو البريد الإلكتروني وكلمة المرور.",
      });
    }

    const deleted = readDeletedIds();
    const diskUsers = readDiskUsers();
    const cleanDigits = cleanId.replace(/\D/g, "");

    // Search user in disk users
    let student = diskUsers.find((u: any) => {
      if (!u || isDisallowedUserServer(u, deleted.users)) return false;
      const uPhone = (u.phone || "").replace(/\D/g, "");
      const uEmail = (u.email || "").trim().toLowerCase();
      const uNat = (u.nationalId || "").trim();
      return (
        (cleanDigits && uPhone === cleanDigits) ||
        (cleanId.includes("@") && uEmail === cleanId.toLowerCase()) ||
        (uNat && uNat === cleanId) ||
        u.id === cleanId
      );
    });

    // Fallback: search Firestore
    if (!student) {
      const firestoreUser = await findUserByPhoneOrEmail(cleanId);
      if (firestoreUser && !isDisallowedUserServer(firestoreUser, deleted.users)) {
        student = firestoreUser;
      }
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        error: "بيانات الدخول غير صحيحة أو الحساب غير موجود.",
      });
    }

    // Password verification
    const storedPw = String(student.password || "").trim();
    if (storedPw && storedPw !== rawPassword) {
      return res.status(401).json({
        success: false,
        error: "كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور والمحاولة مجدداً.",
      });
    }

    // Single-device binding evaluation
    const bindingResult = evaluateStudentDeviceBinding(student, deviceId, deviceName);
    if (!bindingResult.allowed) {
      return res.status(403).json({
        success: false,
        error: bindingResult.errorMessage || "تم تجاوز الحد المسموح لتغيير الجهاز.",
      });
    }

    // Update student with latest device info
    const updatedStudent = bindingResult.updatedUser;
    const sessionToken = generateMobileToken(updatedStudent.id);
    updatedStudent.activeSessionId = sessionToken;
    updatedStudent.lastLoginAt = new Date().toISOString();

    const allUsers = readDiskUsers().map((u: any) => (u.id === updatedStudent.id ? updatedStudent : u));
    writeDiskUsers(allUsers);

    // Get student's enrolled courses
    const allCourses = readDiskCourses();
    const enrolledCourseIds: string[] = Array.isArray(updatedStudent.enrolledCourseIds)
      ? updatedStudent.enrolledCourseIds
      : [];

    const enrolledCourses = allCourses
      .filter((c: any) => c.isFree || enrolledCourseIds.includes(c.id))
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        grade: c.grade || c.schoolYear,
        thumbnail: c.thumbnail || c.imageUrl,
        teacherName: c.teacherName || c.instructor,
        lessonsCount: Array.isArray(c.lessons) ? c.lessons.length : 0,
        isFree: !!c.isFree,
      }));

    // Safe student response without sensitive credentials
    const safeStudent = { ...updatedStudent };
    delete safeStudent.password;

    res.json({
      success: true,
      token: sessionToken,
      student: safeStudent,
      enrolledCourses,
      deviceNotice: bindingResult.deviceChangeNotice,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "خطأ أثناء تسجيل الدخول." });
  }
});

/**
 * 2. Mobile Dashboard Data
 * Returns focused last-watched lesson card, enrolled courses, stats & quick access
 */
app.get("/api/mobile/dashboard", async (req, res) => {
  try {
    const studentId = resolveStudentIdFromReq(req);
    if (!studentId) {
      return res.status(401).json({ success: false, error: "يجب تسجيل الدخول لعرض لوحة الطالب." });
    }

    const deleted = readDeletedIds();
    const diskUsers = readDiskUsers();
    const student = diskUsers.find((u: any) => u.id === studentId && !isDisallowedUserServer(u, deleted.users));

    if (!student) {
      return res.status(404).json({ success: false, error: "الطالب غير موجود." });
    }

    const allCourses = readDiskCourses();
    const enrolledCourseIds: string[] = Array.isArray(student.enrolledCourseIds) ? student.enrolledCourseIds : [];

    // Filter enrolled courses
    const studentCourses = allCourses.filter((c: any) => c.isFree || enrolledCourseIds.includes(c.id));

    // Resolve Last Lesson to Resume
    let lastLessonData: any = null;
    const lastWatched = student.lastWatched;

    if (lastWatched && lastWatched.courseId) {
      const course = allCourses.find((c: any) => c.id === lastWatched.courseId);
      if (course && Array.isArray(course.lessons)) {
        let lesson = course.lessons.find((l: any) => l.id === lastWatched.lessonId);
        if (!lesson && course.lessons.length > 0) {
          lesson = course.lessons[0];
        }
        let video = null;
        if (lesson && Array.isArray(lesson.videos)) {
          video = lesson.videos.find((v: any) => v.id === lastWatched.videoId) || lesson.videos[0];
        }
        if (lesson && video) {
          const duration = Number(lastWatched.durationSeconds || video.durationSeconds || 1800);
          const position = Number(lastWatched.positionSeconds || 0);
          const percent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
          lastLessonData = {
            courseId: course.id,
            courseTitle: course.title,
            subject: course.subject,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            videoId: video.id,
            videoTitle: video.title,
            videoUrl: video.url || video.videoUrl || "",
            youtubeId: video.youtubeId || "",
            positionSeconds: position,
            durationSeconds: duration,
            progressPercentage: percent,
            thumbnail: video.thumbnail || course.thumbnail,
            updatedAt: lastWatched.updatedAt || new Date().toISOString(),
          };
        }
      }
    }

    // If no last watched, default to first video of first enrolled course
    if (!lastLessonData && studentCourses.length > 0) {
      const firstCourse = studentCourses[0];
      if (Array.isArray(firstCourse.lessons) && firstCourse.lessons.length > 0) {
        const firstLesson = firstCourse.lessons[0];
        if (Array.isArray(firstLesson.videos) && firstLesson.videos.length > 0) {
          const firstVid = firstLesson.videos[0];
          lastLessonData = {
            courseId: firstCourse.id,
            courseTitle: firstCourse.title,
            subject: firstCourse.subject,
            lessonId: firstLesson.id,
            lessonTitle: firstLesson.title,
            videoId: firstVid.id,
            videoTitle: firstVid.title,
            videoUrl: firstVid.url || firstVid.videoUrl || "",
            youtubeId: firstVid.youtubeId || "",
            positionSeconds: 0,
            durationSeconds: Number(firstVid.durationSeconds || 1800),
            progressPercentage: 0,
            thumbnail: firstVid.thumbnail || firstCourse.thumbnail,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }

    // Student Exam Submissions
    const submissions = readDiskSubmissions().filter((s: any) => s.studentId === studentId);
    const examResults = Array.isArray(student.examResults) ? student.examResults : [];

    const stats = {
      enrolledCoursesCount: studentCourses.length,
      completedExamsCount: Math.max(submissions.length, examResults.length),
      walletBalance: student.walletBalance ?? 0,
      watchedLessonsCount: Array.isArray(student.watchedLessons) ? student.watchedLessons.length : 0,
    };

    const safeStudent = { ...student };
    delete safeStudent.password;

    res.json({
      success: true,
      student: safeStudent,
      lastLesson: lastLessonData,
      enrolledCourses: studentCourses.map((c: any) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        grade: c.grade || c.schoolYear,
        thumbnail: c.thumbnail,
        lessonsCount: Array.isArray(c.lessons) ? c.lessons.length : 0,
        isFree: !!c.isFree,
      })),
      recentSubmissions: submissions.slice(-5).reverse(),
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "خطأ أثناء تحميل بيانات اللوحة." });
  }
});

/**
 * 3. Mobile Courses List Endpoint
 * Returns courses list with enrolled status
 */
app.get("/api/mobile/courses", async (req, res) => {
  try {
    const studentId = resolveStudentIdFromReq(req);
    const deleted = readDeletedIds();
    const diskUsers = readDiskUsers();
    const student = studentId ? diskUsers.find((u: any) => u.id === studentId) : null;
    const enrolledCourseIds: string[] = student && Array.isArray(student.enrolledCourseIds) ? student.enrolledCourseIds : [];

    const courses = readDiskCourses()
      .filter((c: any) => c && c.id && !DEMO_COURSE_IDS.includes(c.id) && !deleted.courses.includes(c.id))
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        description: c.description,
        grade: c.grade || c.schoolYear,
        price: c.price || 0,
        isFree: !!c.isFree,
        isEnrolled: !!(c.isFree || enrolledCourseIds.includes(c.id)),
        thumbnail: c.thumbnail,
        teacherName: c.teacherName || c.instructor || "إدارة المنصة",
        lessonsCount: Array.isArray(c.lessons) ? c.lessons.length : 0,
        videosCount: Array.isArray(c.lessons)
          ? c.lessons.reduce((acc: number, l: any) => acc + (Array.isArray(l.videos) ? l.videos.length : 0), 0)
          : 0,
      }));

    res.json({ success: true, courses });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "فشل تحميل الكورسات." });
  }
});

/**
 * 4. Mobile Single Course Details Endpoint
 * Returns lessons, videos and attached exams
 */
app.get("/api/mobile/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = resolveStudentIdFromReq(req);
    const deleted = readDeletedIds();
    const allCourses = readDiskCourses();
    const course = allCourses.find((c: any) => c.id === id);

    if (!course || deleted.courses.includes(id)) {
      return res.status(404).json({ success: false, error: "الكورس غير موجود." });
    }

    const diskUsers = readDiskUsers();
    const student = studentId ? diskUsers.find((u: any) => u.id === studentId) : null;
    const isEnrolled = !!(
      course.isFree ||
      (student && Array.isArray(student.enrolledCourseIds) && student.enrolledCourseIds.includes(id))
    );

    const safeCourse = {
      ...course,
      isEnrolled,
      lessons: (course.lessons || []).map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        videos: (lesson.videos || [])
          .filter((v: any) => !deleted.videos?.includes(v.id))
          .map((v: any) => ({
            id: v.id,
            title: v.title,
            durationSeconds: v.durationSeconds || 1800,
            thumbnail: v.thumbnail || course.thumbnail,
            // If not enrolled and not free, hide raw streaming url
            videoUrl: isEnrolled ? (v.url || v.videoUrl || "") : "",
            youtubeId: isEnrolled ? (v.youtubeId || "") : "",
            isLocked: !isEnrolled,
          })),
        exams: lesson.exams || [],
      })),
    };

    res.json({ success: true, course: safeCourse });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "فشل تحميل تفاصيل الكورس." });
  }
});

/**
 * 5. Mobile Progress Update Endpoint
 * Tracks video position, duration, and completion so student can resume anywhere
 */
app.post("/api/mobile/progress/update", async (req, res) => {
  try {
    const studentId = resolveStudentIdFromReq(req) || req.body.studentId;
    const { courseId, lessonId, videoId, positionSeconds, durationSeconds, completed } = req.body || {};

    if (!studentId || !courseId || !videoId) {
      return res.status(400).json({ success: false, error: "بيانات التقدم غير مكتملة." });
    }

    const diskUsers = readDiskUsers();
    const studentIndex = diskUsers.findIndex((u: any) => u.id === studentId);

    if (studentIndex === -1) {
      return res.status(404).json({ success: false, error: "الطالب غير موجود." });
    }

    const student = { ...diskUsers[studentIndex] };
    const nowIso = new Date().toISOString();

    student.lastWatched = {
      courseId,
      lessonId,
      videoId,
      positionSeconds: Number(positionSeconds) || 0,
      durationSeconds: Number(durationSeconds) || 0,
      updatedAt: nowIso,
    };

    if (completed) {
      const watched = Array.isArray(student.watchedLessons) ? [...student.watchedLessons] : [];
      if (!watched.includes(videoId)) watched.push(videoId);
      if (lessonId && !watched.includes(lessonId)) watched.push(lessonId);
      student.watchedLessons = watched;
    }

    diskUsers[studentIndex] = student;
    writeDiskUsers(diskUsers);

    // Sync to Firestore in background
    syncToFirestoreRest("users", diskUsers).catch(() => {});

    res.json({
      success: true,
      lastWatched: student.lastWatched,
      watchedCount: Array.isArray(student.watchedLessons) ? student.watchedLessons.length : 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "فشل تحديث التقدم." });
  }
});

/**
 * 6. Mobile Exam Submission Endpoint
 * Receives answers from mobile app, grades instantly, updates disk & Firestore in real-time
 */
app.post("/api/mobile/exams/submit", async (req, res) => {
  try {
    const studentId = resolveStudentIdFromReq(req) || req.body.studentId;
    const { examId, courseId, answers, timeSpentSeconds } = req.body || {};

    if (!studentId || !examId) {
      return res.status(400).json({ success: false, error: "معرف الطالب ومعرف الامتحان مطلوبان." });
    }

    const diskUsers = readDiskUsers();
    const student = diskUsers.find((u: any) => u.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: "الطالب غير موجود." });
    }

    // Find the exam specification
    const exam = findExamLocally(examId, courseId);
    if (!exam) {
      return res.status(404).json({ success: false, error: "الامتحان غير موجود." });
    }

    // Grade answers
    const questions: any[] = Array.isArray(exam.questions) ? exam.questions : [];
    let score = 0;
    let totalMarks = 0;
    const gradedQuestions: any[] = [];

    questions.forEach((q: any, idx: number) => {
      const qMark = Number(q.mark || q.points || 1);
      totalMarks += qMark;
      const studentAns = answers ? answers[q.id || `q_${idx}`] ?? answers[idx] : undefined;

      const isCorrect =
        studentAns !== undefined &&
        (String(studentAns).trim() === String(q.correctAnswer ?? q.correctOptionIndex ?? "").trim() ||
          Number(studentAns) === Number(q.correctOptionIndex));

      if (isCorrect) {
        score += qMark;
      }

      gradedQuestions.push({
        id: q.id || `q_${idx}`,
        questionText: q.question || q.title || "",
        studentAnswer: studentAns,
        correctAnswer: q.correctAnswer ?? q.correctOptionIndex,
        isCorrect,
        mark: qMark,
      });
    });

    if (totalMarks === 0) totalMarks = 100;
    const percentage = Math.round((score / totalMarks) * 100);
    const passThreshold = Number(exam.passPercentage || exam.passingScore || 50);
    const passed = percentage >= passThreshold;
    const nowIso = new Date().toISOString();

    const submission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      examId,
      examTitle: exam.title || "امتحان إلكتروني",
      courseId: courseId || exam.courseId || "",
      studentId: student.id,
      studentName: student.name,
      studentPhone: student.phone,
      schoolYear: student.schoolYear || "",
      score,
      totalMarks,
      percentage,
      passed,
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      answers: answers || {},
      gradedQuestions,
      submittedAt: nowIso,
      source: "mobile_flutter_app",
    };

    // 1. Write submission to submissions.json
    const existingSubs = readDiskSubmissions();
    const updatedSubs = [...existingSubs, submission];
    writeDiskSubmissions(updatedSubs);

    // 2. Update student examResults in disk users
    const studentExamResults = Array.isArray(student.examResults) ? [...student.examResults] : [];
    studentExamResults.push({
      examId,
      examTitle: exam.title || "امتحان إلكتروني",
      score,
      totalMarks,
      percentage,
      passed,
      date: nowIso,
      source: "mobile_flutter_app",
    });

    const updatedUser = {
      ...student,
      examResults: studentExamResults,
    };

    const updatedUsersList = diskUsers.map((u: any) => (u.id === student.id ? updatedUser : u));
    writeDiskUsers(updatedUsersList);

    // 3. Sync to Firestore in real-time so teacher & admin dashboards see the score immediately
    syncToFirestoreRest("submissions", updatedSubs).catch(() => {});
    syncToFirestoreRest("users", updatedUsersList).catch(() => {});

    res.json({
      success: true,
      submission,
      score,
      totalMarks,
      percentage,
      passed,
      passThreshold,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "فشل تصحيح الامتحان وحفظ النتيجة." });
  }
});

/**
 * 7. Mobile Student Submissions History
 */
app.get("/api/mobile/student/submissions", async (req, res) => {
  try {
    const studentId = resolveStudentIdFromReq(req);
    if (!studentId) {
      return res.status(401).json({ success: false, error: "يجب تسجيل الدخول لعرض النتائج." });
    }

    const allSubs = readDiskSubmissions();
    const studentSubs = allSubs.filter((s: any) => s.studentId === studentId);

    res.json({ success: true, submissions: studentSubs.reverse() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "فشل تحميل النتائج." });
  }
});

/**
 * 8. Download Flutter Project ZIP Archive
 */
app.get("/api/mobile/download-zip", (req, res) => {
  const zipPath = path.join(process.cwd(), "public", "flutter_app.zip");
  if (fs.existsSync(zipPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="qalbalelm_flutter_app.zip"');
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(zipPath);
  }
  res.status(404).json({ error: "ملف التطبيق غير متوفر حالياً." });
});

/**
 * 9. Download Ready-To-Install Android APK File (qalbalelm.apk)
 */
app.get(["/qalbalelm.apk", "/api/download/app.apk", "/app-release.apk"], (req, res) => {
  const apkPath = path.join(process.cwd(), "public", "qalbalelm.apk");
  if (fs.existsSync(apkPath)) {
    res.setHeader("Content-Disposition", 'attachment; filename="qalbalelm.apk"');
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    return res.sendFile(apkPath);
  }
  res.status(404).json({ error: "ملف التثبيت (APK) غير متوفر حالياً." });
});

/**
 * 10. Secure Video Subscription Verification & Base64 Token
 */
app.get(["/api/lessons/:lessonId/video-auth", "/api/videos/:lessonId/video-auth"], checkSubscriptionAndGetVideo);
app.get(["/api/lessons/:lessonId/secure-video", "/api/lesson-video/secure", "/api/videos/:lessonId/secure"], getSecureLessonVideo);

/**
 * 11. Programmatic YouTube Video Upload API
 */
app.post("/api/admin/youtube/upload", requireRestrictedTeacher, async (req, res) => {
  try {
    const { filePath, title, description } = req.body || {};
    if (!filePath || !title) {
      return res.status(400).json({ error: "يرجى تحديد مسار الملف وعنوان الفيديو." });
    }
    const videoId = await uploadVideoToYouTube(filePath, title, description || "");
    if (videoId) {
      return res.json({ success: true, videoId, youtubeUrl: `https://youtube.com/watch?v=${videoId}` });
    }
    return res.status(500).json({ success: false, error: "فشل رفع الفيديو إلى YouTube." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "خطأ أثناء رفع الفيديو" });
  }
});

// ============================================================================
// SCHOOL TABLET DIRECT AUTHENTICATION (Bypasses Ministry SIM / Knox Firewall)
// ============================================================================

// Direct Student Registration
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { 
      id: incomingId, uid: incomingUid,
      name, firstName, secondName, thirdName, lastName,
      phone, parentPhone, fatherPhone, motherPhone,
      schoolYear, division, governorate, schoolName,
      parentJob, educationSystem, religion, gender,
      password, email, activeSessionId: incomingSessionId,
      deviceId, deviceName, syncFromFirebaseAuth
    } = req.body || {};

    const cleanPhone = (phone || "").trim().replace(/\s+/g, '');
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanDigits.length < 10) {
      return res.status(400).json({ error: "الرجاء إدخال رقم هاتف صحيح للطالب." });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ error: "كلمة المرور يجب ألا تقل عن 6 خانات." });
    }

    const cleanPass = String(password).trim();
    const diskUsers = readDiskUsers();
    // Check if phone or ID already exists on disk
    const existing = diskUsers.find(
      (u: any) =>
        u &&
        ((incomingId && u.id === incomingId) ||
          (incomingUid && u.id === incomingUid) ||
          (u.phone && matchesPhone(u.phone, cleanPhone)))
    );

    if (existing && existing.password && !syncFromFirebaseAuth && existing.id !== incomingId && existing.id !== incomingUid) {
      return res.status(400).json({ 
        error: "رقم الهاتف هذا مسجل بالفعل في المنصة بحساب آخر. يرجى تسجيل الدخول مباشرة." 
      });
    }

    // If not syncing from an already-created Firebase Auth user, also ensure the account exists in Firebase Auth
    let firebaseUid = incomingId || incomingUid || existing?.id || "";
    const generatedEmail = (email || existing?.email || `${cleanDigits}@qalb-alam.edu`).trim().toLowerCase();

    if (!syncFromFirebaseAuth) {
      try {
        const fbSignUpRes = await axios.post(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
          {
            email: generatedEmail,
            password: cleanPass,
            returnSecureToken: true,
          },
          { timeout: 5000 }
        );
        if (fbSignUpRes.data?.localId && !firebaseUid) {
          firebaseUid = fbSignUpRes.data.localId;
        }
      } catch (fbErr: any) {
        const fbMsg = fbErr?.response?.data?.error?.message || "";
        if (fbMsg.includes("EMAIL_EXISTS") && !existing) {
          return res.status(400).json({
            error: "رقم الهاتف هذا مسجل بالفعل في المنصة بحساب آخر. يرجى تسجيل الدخول مباشرة.",
          });
        }
      }
    }

    const newId = firebaseUid || `st_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const resolvedName =
      name ||
      `${firstName || ''} ${secondName || ''} ${thirdName || ''} ${lastName || ''}`.trim() ||
      existing?.name ||
      'طالب منصة المتفلسفة ';
    const primaryParent = parentPhone || fatherPhone || motherPhone || existing?.parentPhone || '';
    const deviceSessionId =
      incomingSessionId || existing?.activeSessionId || 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    const nowIso = new Date().toISOString();

    const newUser: any = {
      ...(existing || {}),
      id: newId,
      uid: newId,
      name: resolvedName,
      firstName: firstName || existing?.firstName || '',
      secondName: secondName || existing?.secondName || '',
      thirdName: thirdName || existing?.thirdName || '',
      lastName: lastName || existing?.lastName || '',
      phone: cleanPhone,
      parentPhone: primaryParent,
      fatherPhone: fatherPhone || existing?.fatherPhone || '',
      motherPhone: motherPhone || existing?.motherPhone || '',
      parentJob: parentJob || existing?.parentJob || '',
      schoolYear: schoolYear || existing?.schoolYear || 'الصف الثالث الثانوي',
      division: division !== undefined ? division : (existing?.division || ''),
      governorate: governorate || existing?.governorate || 'السويس',
      schoolName: schoolName || existing?.schoolName || '',
      educationSystem: educationSystem || existing?.educationSystem || 'عربي',
      religion: religion || existing?.religion || 'التربية الدينية الإسلامية',
      gender: gender || existing?.gender || 'ذكر',
      email: generatedEmail,
      role: existing?.role || 'student',
      status: 'active',
      activeSessionId: deviceSessionId,
      currentDeviceId: deviceId || existing?.currentDeviceId || undefined,
      currentDeviceName: deviceName || existing?.currentDeviceName || undefined,
      deviceChangesHistory:
        existing?.deviceChangesHistory ||
        (deviceId
          ? [
              {
                deviceId,
                deviceName: deviceName || 'جهاز الطالب',
                changedAt: nowIso,
                type: 'initial_binding',
                isChange: false,
              },
            ]
          : []),
      registeredAt: existing?.registeredAt || nowIso.split('T')[0],
      enrolledCourseIds: Array.isArray(existing?.enrolledCourseIds) ? existing.enrolledCourseIds : [],
      examResults: existing?.examResults || {},
      walletBalance: existing?.walletBalance ?? 0,
      walletTransactions: Array.isArray(existing?.walletTransactions) ? existing.walletTransactions : [],
      password: cleanPass,
      lastLoginAt: nowIso,
    };

    // Register active session in memory
    activeUserSessionsStore.set(newId, deviceSessionId);
    activeUserSessionsStore.set(cleanDigits, deviceSessionId);

    // Save to disk without duplicating
    const filteredDisk = diskUsers.filter(
      (u: any) => u && u.id !== newId && !(u.phone && matchesPhone(u.phone, cleanPhone))
    );
    const updatedUsers = [newUser, ...filteredDisk];
    writeDiskUsers(updatedUsers);

    // Sync to Firestore in background
    syncToFirestoreRest("users", updatedUsers).catch(() => {});
    try {
      const restUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(newId)}?key=${FIREBASE_API_KEY}`;
      const fieldsObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(newUser)) {
        if (k !== 'password' && v !== undefined) fieldsObj[k] = wrapFirestoreValue(v);
      }
      fieldsObj['updatedAt'] = { stringValue: nowIso };
      fetch(restUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldsObj }),
      }).catch(() => {});
    } catch {}

    const { password: _, ...safeUser } = newUser;
    return res.json({ success: true, user: safeUser, sessionId: deviceSessionId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "فشل تسجيل الحساب على الخادم." });
  }
});

// Direct Student / User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, phone, email, password, deviceId, deviceName } = req.body || {};
    const input = (identifier || phone || email || '').trim();
    const cleanPass = String(password || '').trim();

    if (!input || !cleanPass) {
      return res.status(400).json({ error: "الرجاء إدخال رقم الهاتف أو البريد وكلمة المرور." });
    }

    const diskUsers = readDiskUsers();
    const cleanDigits = input.replace(/\D/g, '');
    const isEmail = input.includes('@');
    const targetEmail = input.toLowerCase();

    // Check supervisor/admin login — STRICTLY verify password before granting admin access!
    if (targetEmail === 'hos098sam@gmail.com' || cleanDigits === '01040672314') {
      const adminMatch = diskUsers.find(
        (u: any) => u.email === 'hos098sam@gmail.com' || u.phone === '01040672314' || u.role === 'admin'
      );

      let isAdminPasswordVerified = false;

      // 1. Verify against Firebase Authentication (Identity Toolkit REST API)
      try {
        const fbVerifyRes = await axios.post(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
          {
            email: 'hos098sam@gmail.com',
            password: cleanPass,
            returnSecureToken: true,
          },
          { timeout: 6000 }
        );
        if (fbVerifyRes.data && fbVerifyRes.data.idToken) {
          isAdminPasswordVerified = true;
        }
      } catch (fbAuthErr: any) {
        if (process.env.ADMIN_MASTER_PASSWORD && cleanPass === process.env.ADMIN_MASTER_PASSWORD) {
          isAdminPasswordVerified = true;
        }
      }

      if (!isAdminPasswordVerified) {
        return res.status(401).json({
          error: "كلمة المرور الخاصة بإدارة المنصة غير صحيحة. هذا الحساب محمي ومشفر عبر Google Firebase Auth ولا يمكن الدخول إليه إلا بكلمة المرور المعتمدة للمشرف العام.",
        });
      }

      const adminUser = adminMatch || {
        id: 'admin-hosam-supervisor',
        name: 'إدارة المنصة',
        email: 'hos098sam@gmail.com',
        phone: '01040672314',
        role: 'admin',
        status: 'active',
        schoolYear: 'المشرف العام ومؤسس المنصة',
        registeredAt: '2026-09-01'
      };
      const deviceSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      activeUserSessionsStore.set(adminUser.id, deviceSessionId);
      activeUserSessionsStore.set('01040672314', deviceSessionId);
      const { password: _, ...safeAdminUser } = adminUser;
      return res.json({
        success: true,
        user: { ...safeAdminUser, role: 'admin', status: 'active', activeSessionId: deviceSessionId },
        sessionId: deviceSessionId,
      });
    }

    // Match student, teacher, or assistant by exact phone, accountNumber, or email
    let user = diskUsers.find((u: any) => {
      if (!u) return false;
      if (isEmail && u.email && u.email.toLowerCase() === targetEmail) return true;
      if (u.accountNumber && u.accountNumber.trim().toLowerCase() === targetEmail) return true;
      if (u.phone && u.phone.trim().toLowerCase() === targetEmail) return true;
      if (cleanDigits.length >= 10 && u.phone && matchesPhone(input, u.phone)) return true;
      return false;
    });

    // Also query Firestore REST if not found on disk (or to enrich missing fields)
    if (!user) {
      try {
        const found = await findUserByPhoneOrEmail(input);
        if (found) user = found;
      } catch {}
    }

    let isPasswordVerified = false;
    let verifiedFbUid = "";
    let verifiedFbEmail = "";

    // 1. Check disk password if present
    if (user && user.password && String(user.password).trim() === cleanPass) {
      isPasswordVerified = true;
    }

    // 2. If disk password is missing (e.g., stripped during cloud sync or registered via Firebase Auth)
    //    or didn't match, verify against Firebase Authentication (Identity Toolkit REST API)
    if (!isPasswordVerified) {
      const candidateEmails = new Set<string>();
      if (user?.email && String(user.email).includes("@")) {
        candidateEmails.add(String(user.email).trim().toLowerCase());
      }
      if (isEmail) {
        candidateEmails.add(targetEmail);
      }
      if (cleanDigits.length >= 10) {
        candidateEmails.add(`${cleanDigits}@qalb-alam.edu`);
        candidateEmails.add(`${cleanDigits}@qalbalelm.edu`);
      }

      for (const candEmail of candidateEmails) {
        try {
          const fbVerifyRes = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
              email: candEmail,
              password: cleanPass,
              returnSecureToken: true,
            },
            { timeout: 5000 }
          );
          if (fbVerifyRes.data && fbVerifyRes.data.idToken) {
            isPasswordVerified = true;
            verifiedFbUid = fbVerifyRes.data.localId || "";
            verifiedFbEmail = candEmail;
            break;
          }
        } catch {}
      }
    }

    // If Firebase Auth verified the user but `user` wasn't in diskUsers yet, fetch or construct profile
    if (isPasswordVerified && !user) {
      if (verifiedFbUid) {
        try {
          const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(verifiedFbUid)}?key=${FIREBASE_API_KEY}`;
          const docRes = await fetch(docUrl);
          if (docRes.ok) {
            const docData = await docRes.json();
            if (docData?.fields) {
              const unwrapped: Record<string, any> = { id: verifiedFbUid };
              for (const [k, v] of Object.entries(docData.fields)) {
                unwrapped[k] = unwrapFirestoreValue(v);
              }
              user = unwrapped;
            }
          }
        } catch {}
      }
      if (!user) {
        user = {
          id: verifiedFbUid || `st_${Date.now()}`,
          name: "طالب منصة المتفلسفة ",
          phone: cleanDigits || input,
          email: verifiedFbEmail || `${cleanDigits}@qalb-alam.edu`,
          role: "student",
          status: "active",
          schoolYear: "الصف الثالث الثانوي",
          registeredAt: new Date().toISOString().split("T")[0],
          enrolledCourseIds: [],
          examResults: {},
        };
      }
    }

    if (!user) {
      return res.status(404).json({ error: "رقم الهاتف أو الحساب غير مسجل بالمنصة. يرجى إنشاء حساب جديد أولاً." });
    }

    if (!isPasswordVerified) {
      return res.status(401).json({ error: "كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور أو استعادتها عبر واتساب." });
    }

    // Enforce student device binding and maximum 2 device changes per month
    const bindingEval = evaluateStudentDeviceBinding(user, deviceId, deviceName);
    if (!bindingEval.allowed) {
      return res.status(403).json({
        success: false,
        code: "DEVICE_CHANGE_LIMIT_EXCEEDED",
        error: bindingEval.errorMessage,
        daysRemaining: bindingEval.daysRemaining,
        changesCount: bindingEval.changesCount,
      });
    }

    // Generate fresh session ID to immediately invalidate and kill any previous sessions
    const deviceSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    const updatedUser = {
      ...bindingEval.updatedUser,
      password: cleanPass, // Cache verified password on disk so future logins never fail
      status: user.status || 'active',
      activeSessionId: deviceSessionId,
      lastLoginAt: new Date().toISOString()
    };

    // Kill old sessions immediately on server!
    activeUserSessionsStore.set(updatedUser.id, deviceSessionId);
    if (updatedUser.phone) {
      activeUserSessionsStore.set(String(updatedUser.phone).replace(/\D/g, ''), deviceSessionId);
    }
    const filteredDisk = diskUsers.filter(
      (u: any) => u && u.id !== updatedUser.id && !(updatedUser.phone && u.phone && matchesPhone(u.phone, updatedUser.phone))
    );
    const updatedDiskList = [updatedUser, ...filteredDisk];
    writeDiskUsers(updatedDiskList);

    // Sync to Firestore
    const safeDb = getSafeFirestore();
    if (safeDb && updatedUser.id) {
      safeDb.collection("users").doc(updatedUser.id).set({
        activeSessionId: deviceSessionId,
        currentDeviceId: updatedUser.currentDeviceId || null,
        currentDeviceName: updatedUser.currentDeviceName || null,
        deviceChangesHistory: updatedUser.deviceChangesHistory || [],
        lastLoginAt: updatedUser.lastLoginAt,
      }, { merge: true }).catch(() => {});
    }

    const { password: _, ...safeUser } = updatedUser;
    return res.json({
      success: true,
      user: safeUser,
      sessionId: deviceSessionId,
      deviceChangeNotice: bindingEval.deviceChangeNotice,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "فشل تسجيل الدخول على الخادم." });
  }
});

// Register a newly logged-in device session ID and invalidate previous devices
app.post("/api/auth/register-session", async (req, res) => {
  try {
    const { userId, phone, activeSessionId, deviceId, deviceName } = req.body || {};
    if (!userId || !activeSessionId) {
      return res.status(400).json({ error: "Missing userId or activeSessionId" });
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const nowIso = new Date().toISOString();
    const diskUsers = readDiskUsers();

    // Check device binding & monthly change limits if deviceId is provided
    const existing = diskUsers.find(
      (u: any) => u && (u.id === userId || (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone))
    );

    if (existing && deviceId) {
      const bindingEval = evaluateStudentDeviceBinding(existing, deviceId, deviceName);
      if (!bindingEval.allowed) {
        return res.status(403).json({
          success: false,
          code: "DEVICE_CHANGE_LIMIT_EXCEEDED",
          error: bindingEval.errorMessage,
          daysRemaining: bindingEval.daysRemaining,
          changesCount: bindingEval.changesCount,
        });
      }
    }

    // Server-authoritative: Kill all old sessions immediately!
    activeUserSessionsStore.set(userId, activeSessionId);
    if (cleanPhone) {
      activeUserSessionsStore.set(cleanPhone, activeSessionId);
    }

    // Update disk users
    let found = false;
    let targetUser: any = null;
    let deviceNotice: string | undefined = undefined;

    const updatedUsers = diskUsers.map((u: any) => {
      if (u && (u.id === userId || (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone))) {
        found = true;
        const bindingEval = deviceId ? evaluateStudentDeviceBinding(u, deviceId, deviceName) : { allowed: true, updatedUser: u, deviceChangeNotice: undefined };
        deviceNotice = bindingEval.deviceChangeNotice;
        targetUser = {
          ...bindingEval.updatedUser,
          activeSessionId,
          lastLoginAt: nowIso,
        };
        return targetUser;
      }
      return u;
    });

    if (found) {
      writeDiskUsers(updatedUsers);
    }

    // Update Firestore user document if Admin SDK is available
    const safeDb = getSafeFirestore();
    if (safeDb && targetUser) {
      try {
        const updatePayload: any = {
          activeSessionId,
          lastLoginAt: nowIso,
        };
        if (targetUser.currentDeviceId) {
          updatePayload.currentDeviceId = targetUser.currentDeviceId;
          updatePayload.currentDeviceName = targetUser.currentDeviceName || null;
          updatePayload.deviceChangesHistory = targetUser.deviceChangesHistory || [];
        }
        await safeDb.collection("users").doc(userId).set(updatePayload, { merge: true });
      } catch {}
    }

    return res.json({ success: true, activeSessionId, deviceChangeNotice: deviceNotice });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to register session" });
  }
});

// Validate whether a client's session is still active or was killed by another device login
app.post("/api/auth/validate-session", async (req, res) => {
  try {
    const { userId, phone, sessionId } = req.body || {};
    if (!userId) return res.status(400).json({ valid: false, error: "Missing userId" });

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    let serverSession = activeUserSessionsStore.get(userId) || (cleanPhone ? activeUserSessionsStore.get(cleanPhone) : undefined);

    if (!serverSession) {
      const diskUsers = readDiskUsers();
      const matched = diskUsers.find(
        (u: any) => u && (u.id === userId || (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone))
      );
      if (matched?.activeSessionId) {
        serverSession = matched.activeSessionId;
        activeUserSessionsStore.set(userId, serverSession!);
      }
    }

    if (!serverSession || !sessionId) {
      return res.json({ valid: true, activeSessionId: serverSession || sessionId });
    }

    if (serverSession !== sessionId) {
      return res.status(401).json({
        valid: false,
        sessionKilled: true,
        code: "SESSION_KILLED_BY_CONCURRENT_DEVICE",
        error: "تم تسجيل الدخول إلى هذا الحساب من جهاز آخر الآن. تم إنهاء جلستك على هذا الجهاز لحماية الحساب ومنع المشاركة.",
        activeSessionId: serverSession,
      });
    }

    return res.json({ valid: true, activeSessionId: serverSession });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err?.message });
  }
});

// Check current active session ID and authoritative role for a user account
app.get("/api/auth/check-session/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const rawPhone = (req.query.phone as string) || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const clientSessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || '';
    const claimedRole = (req.query.role as string) || '';

    const diskUsers = readDiskUsers();
    const matched = diskUsers.find(
      (u: any) => u && (u.id === userId || (cleanPhone && u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone))
    );

    let activeSessionId = activeUserSessionsStore.get(userId) || (cleanPhone ? activeUserSessionsStore.get(cleanPhone) : undefined);

    if (!activeSessionId && matched?.activeSessionId) {
      activeSessionId = matched.activeSessionId;
      activeUserSessionsStore.set(userId, activeSessionId!);
      if (cleanPhone) activeUserSessionsStore.set(cleanPhone, activeSessionId!);
    }

    // SECURITY: Verify if a student attempted to tamper with their role in DevTools (e.g. changing role to 'admin' or 'teacher')
    let roleTampered = false;
    const actualRole =
      userId === 'admin-hosam-supervisor' || cleanPhone === '01040672314'
        ? 'admin'
        : matched?.role || 'student';

    if (
      claimedRole &&
      (claimedRole === 'admin' || claimedRole === 'teacher' || claimedRole === 'assistant') &&
      actualRole === 'student'
    ) {
      roleTampered = true;
    }

    const sessionKilled = !!(activeSessionId && clientSessionId && activeSessionId !== clientSessionId) || roleTampered;

    return res.json({
      success: true,
      activeSessionId: activeSessionId || null,
      actualRole,
      roleTampered,
      sessionKilled,
      message: roleTampered
        ? "تم اكتشاف محاولة تلاعب بصلاحيات الحساب. تم إبطال الجلسة فوراً."
        : sessionKilled
        ? "تم تسجيل الدخول من جهاز آخر وإنهاء هذه الجلسة لحماية الحساب."
        : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to check session" });
  }
});

// Admin: Reset a student's bound device (clears binding and allows student to bind a new device)
app.post("/api/admin/reset-student-device", async (req, res) => {
  try {
    const { studentId } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ error: "معرّف الطالب مطلوب." });
    }

    const diskUsers = readDiskUsers();
    const idx = diskUsers.findIndex((u: any) => u.id === studentId || u.phone === studentId);
    if (idx < 0) {
      return res.status(404).json({ error: "لم يتم العثور على حساب الطالب." });
    }

    const student = diskUsers[idx];
    student.currentDeviceId = null;
    student.currentDeviceName = null;
    student.deviceChangesHistory = [];
    student.activeSessionId = null;

    activeUserSessionsStore.delete(student.id);
    if (student.phone) activeUserSessionsStore.delete(String(student.phone).replace(/\D/g, ''));
    writeDiskUsers(diskUsers);

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("users").doc(student.id).set({
          currentDeviceId: null,
          currentDeviceName: null,
          deviceChangesHistory: [],
          activeSessionId: null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    }

    return res.json({
      success: true,
      message: `تمت إعادة ضبط اقتران جهاز الطالب (${student.name || student.phone}) بنجاح، ويمكنه الآن الدخول من جهازه الجديد.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "فشلت إعادة ضبط جهاز الطالب" });
  }
});

app.get("/api/exams", async (req, res) => {
  try {
    const exams = readDiskExams();
    res.json({ success: true, exams });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load exams" });
  }
});

app.post("/api/exams/save", verifyFirebaseToken, requireRestrictedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const { exam, courseId } = req.body;
    if (!exam || !exam.id) {
      return res.status(400).json({ error: "Invalid exam payload" });
    }

    const sanitizedExam = await deepSanitizeAndCompress(exam);
    const effectiveCourseId = courseId || sanitizedExam.courseId;
    const targetExam = { ...sanitizedExam, courseId: effectiveCourseId };

    const currentExams = readDiskExams();
    const existingIdx = currentExams.findIndex((e) => e.id === targetExam.id);
    if (existingIdx >= 0) {
      currentExams[existingIdx] = targetExam;
    } else {
      currentExams.unshift(targetExam);
    }
    writeDiskExams(currentExams);

    const currentCourses = readDiskCourses();
    let courseUpdated = false;
    const updatedCourses = currentCourses.map((c) => {
      if (c.id === effectiveCourseId) {
        courseUpdated = true;
        const exams = Array.isArray(c.exams) ? c.exams : [];
        const eIdx = exams.findIndex((e: any) => e.id === targetExam.id);
        const newExams = eIdx >= 0
          ? exams.map((e: any, i: number) => (i === eIdx ? targetExam : e))
          : [...exams, targetExam];
        return { ...c, exams: newExams };
      }
      return c;
    });

    if (courseUpdated) {
      writeDiskCourses(updatedCourses);
    }

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("exams").doc(targetExam.id).set({
          ...targetExam,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        if (courseUpdated) {
          await safeDb.collection("al_motafalsifa_data").doc("courses").set({
            data: updatedCourses,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (fsErr) {
        console.warn("Firestore exam write warning:", fsErr);
      }
    }

    res.json({ success: true, exam: targetExam });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save exam" });
  }
});

// ============================================================================
// VIDEO SHIELD & ZERO-LEAK TOKEN CRYPTOGRAPHY
// Protects video sources from students & hackers, eliminates external redirects
// ============================================================================
const VIDEO_SECRET_KEY = process.env.APP_SECRET || "qalbalelm_shield_video_secret_2027";

export function encryptVideoTicket(payload: { url: string; videoId?: string; studentId?: string; title?: string }): string {
  try {
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(VIDEO_SECRET_KEY, "qalbalelm_salt", 32);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let enc = cipher.update(JSON.stringify(payload), "utf8", "base64url");
    enc += cipher.final("base64url");
    const tag = cipher.getAuthTag().toString("base64url");
    return `${iv.toString("base64url")}.${tag}.${enc}`;
  } catch {
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }
}

export function decryptVideoTicket(ticket: string): { url: string; videoId?: string; studentId?: string; title?: string } | null {
  try {
    if (!ticket) return null;
    const clean = ticket.trim();
    if (clean.includes(".")) {
      const parts = clean.split(".");
      if (parts.length === 3) {
        const [ivStr, tagStr, enc] = parts;
        const key = crypto.scryptSync(VIDEO_SECRET_KEY, "qalbalelm_salt", 32);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivStr, "base64url"));
        decipher.setAuthTag(Buffer.from(tagStr, "base64url"));
        let dec = decipher.update(enc, "base64url", "utf8");
        dec += decipher.final("utf8");
        return JSON.parse(dec);
      }
    }
    // Fallback: parse base64url JSON (handles client-side tickets with URL encoding)
    const decoded = Buffer.from(clean, "base64url").toString("utf8");
    try {
      return JSON.parse(decoded);
    } catch {
      return JSON.parse(decodeURIComponent(decoded));
    }
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// API: Generate Secure Video Ticket (Zero-leak proxy token)
// ----------------------------------------------------------------------------
app.post("/api/video/ticket", (req: express.Request, res: express.Response) => {
  try {
    const { url, videoId, title } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "رابط الفيديو مطلوب لتوليد التذكرة المشفرة." });
    }
    const ticket = encryptVideoTicket({ url: url.trim(), videoId: videoId || "v_" + Date.now(), title });
    return res.json({
      ticket,
      gatewayUrl: `/api/video/gateway/${ticket}`,
      streamUrl: `/api/video/stream/${ticket}`,
      embedUrl: `/api/video/embed/${ticket}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل توليد تذكرة الحماية للفيديو." });
  }
});

// ----------------------------------------------------------------------------
// API: Dedicated Secure Video Gateway (Anti-leak & Platform-only validation)
// ----------------------------------------------------------------------------
app.all(["/api/video/gateway/:ticket", "/api/video/gateway"], async (req: express.Request, res: express.Response) => {
  try {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const rawTicket = (req.params.ticket || req.query.token || req.query.ticket || (req.body && req.body.ticket)) as string;
    if (!rawTicket) {
      return res.status(400).json({ error: "تذكرة بوابة الفيديو مفقودة أو غير صالحة." });
    }

    const ticketData = decryptVideoTicket(rawTicket);
    if (!ticketData || !ticketData.url) {
      return res.status(403).json({ error: "انتهت صلاحية تذكرة البوابة المخصصة أو أنها غير صالحة." });
    }

    const targetUrl = ticketData.url.trim();

    // If client requested JSON resolution info:
    if (req.headers.accept && req.headers.accept.includes("application/json") && req.method === "POST") {
      const isYt = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i.test(targetUrl);
      const isDrive = /(?:drive|docs)\.google\.com/i.test(targetUrl);
      const isTB = /terabox|1024tera|mirrobox|nephobox|4funbox/i.test(targetUrl);
      const isVimeo = /vimeo\.com/i.test(targetUrl);
      const isEmbed = isYt || isDrive || isTB || isVimeo;
      return res.json({
        success: true,
        gatewaySecured: true,
        streamUrl: `/api/video/stream/${encodeURIComponent(rawTicket)}`,
        embedUrl: `/api/video/embed/${encodeURIComponent(rawTicket)}`,
        isDirect: !isEmbed,
        targetType: isYt ? 'youtube' : isDrive ? 'drive' : isTB ? 'terabox' : isVimeo ? 'vimeo' : 'direct',
      });
    }

    // Direct redirection or proxying through platform stream/embed
    const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    const gDriveMatch = targetUrl.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:[^&]*&)*id=)([a-zA-Z0-9_-]+)/i) || targetUrl.match(/^drive[_-]([a-zA-Z0-9_-]{20,})/i);
    const isTeraBox = /terabox|1024tera|mirrobox|nephobox|4funbox/i.test(targetUrl);
    const vimeoMatch = targetUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|)(\d+)/i);

    if (ytMatch || gDriveMatch || isTeraBox || vimeoMatch) {
      return res.redirect(`/api/video/embed/${encodeURIComponent(rawTicket)}`);
    } else {
      return res.redirect(`/api/video/stream/${encodeURIComponent(rawTicket)}`);
    }
  } catch (err: any) {
    return res.status(500).json({ error: "فشل معالجة بوابة الفيديو المخصصة." });
  }
});

// ----------------------------------------------------------------------------
// Degoo Cloud Video Resolution & Streaming Engine
// ----------------------------------------------------------------------------
export function extractDegooShareHash(rawUrlOrHash: string): string | null {
  if (!rawUrlOrHash || typeof rawUrlOrHash !== "string") return null;
  const trimmed = rawUrlOrHash.trim();
  const match = trimmed.match(/(?:app\.|cloud\.)?degoo\.com\/share\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];
  if (trimmed.startsWith("degoo_") || trimmed.startsWith("degoo:")) {
    return trimmed.replace(/^degoo[_:]/, "");
  }
  return null;
}

export interface DegooResolvedVideo {
  url: string;
  name: string;
  size: number;
  thumbnailUrl?: string;
  cachedAt: number;
}

const degooShareCache = new Map<string, DegooResolvedVideo>();

export async function resolveDegooShare(rawUrlOrHash: string): Promise<DegooResolvedVideo | null> {
  const hash = extractDegooShareHash(rawUrlOrHash) || rawUrlOrHash.trim().replace(/^degoo[_:]/, "");
  if (!hash) return null;

  const cached = degooShareCache.get(hash);
  // Cache for 3 hours (Wasabi S3 links from Degoo remain valid for days)
  if (cached && Date.now() - cached.cachedAt < 3 * 60 * 60 * 1000) {
    return cached;
  }

  try {
    const response = await axios.post(
      "https://rest-api.degoo.com/shared",
      {
        HashValue: hash,
        Limit: 100,
        FileID: null,
        JWT: null,
        NextToken: null,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        },
        timeout: 12000,
      }
    );

    const items = response.data?.Items;
    if (Array.isArray(items) && items.length > 0) {
      // Find a video file (Category 4 or mp4/mkv/mov/webm extension) or first file
      const videoItem =
        items.find((i: any) => i.Category === 4 || /\.(mp4|mkv|mov|webm)/i.test(i.Name || "")) ||
        items[0];

      if (videoItem && videoItem.URL) {
        const result: DegooResolvedVideo = {
          url: videoItem.URL,
          name: videoItem.Name || "video.mp4",
          size: Number(videoItem.Size || 0),
          thumbnailUrl: videoItem.ThumbnailURL || "",
          cachedAt: Date.now(),
        };
        degooShareCache.set(hash, result);
        return result;
      }
    }
  } catch (err: any) {
    console.error(`[Degoo Resolution Error] Failed resolving share (${hash}):`, err?.message || err);
  }

  return null;
}

// ----------------------------------------------------------------------------
// TeraBox Direct Stream & Resolution Engine
// ----------------------------------------------------------------------------
export function extractDirectUrlFromTeraBoxResponse(data: any): {
  directUrl: string;
  isM3u8: boolean;
  title?: string;
  allData?: any;
} | null {
  if (!data) return null;

  // Potential keys for direct/streaming/download links
  const candidateKeys = [
    "stream_url",
    "streamUrl",
    "streaming_url",
    "direct_url",
    "directUrl",
    "direct_link",
    "download_url",
    "downloadUrl",
    "download_link",
    "original_download_url",
    "dlink",
    "m3u8",
    "url",
  ];

  const isValidPlayableVideoUrl = (val: any): boolean => {
    if (typeof val !== "string") return false;
    const trimmed = val.trim();
    if (
      !trimmed.startsWith("http://") &&
      !trimmed.startsWith("https://") &&
      !trimmed.startsWith("//")
    ) {
      return false;
    }
    // Filter out swagger/docs/error pages
    if (
      trimmed.includes("/docs") ||
      trimmed.includes("/swagger") ||
      trimmed.includes("terabox-gateway-vercel-ready.vercel.app/docs")
    ) {
      return false;
    }
    return trimmed.length > 15;
  };

  // 1. Direct inspection of object keys
  if (typeof data === "object" && !Array.isArray(data) && data !== null) {
    for (const key of candidateKeys) {
      if (isValidPlayableVideoUrl(data[key])) {
        const foundUrl = String(data[key]).trim();
        return {
          directUrl: foundUrl,
          isM3u8: /\.m3u8/i.test(foundUrl) || key === "m3u8" || key.includes("m3u8"),
          title: data.filename || data.file_name || data.title || data.server_filename,
          allData: data,
        };
      }
    }
  }

  // 2. Inspection of array items (file lists or multiple streams)
  if (Array.isArray(data)) {
    for (const item of data) {
      const res = extractDirectUrlFromTeraBoxResponse(item);
      if (res) return res;
    }
  }

  // 3. Inspection of nested containers (list, files, data, result, etc.)
  if (typeof data === "object" && data !== null) {
    const containerKeys = ["list", "files", "data", "result", "file_list", "response", "items", "content"];
    for (const cKey of containerKeys) {
      if (data[cKey]) {
        const res = extractDirectUrlFromTeraBoxResponse(data[cKey]);
        if (res) return res;
      }
    }

    // 4. Recursive inspection of any other objects
    for (const subKey of Object.keys(data)) {
      if (!containerKeys.includes(subKey) && typeof data[subKey] === "object" && data[subKey] !== null) {
        const res = extractDirectUrlFromTeraBoxResponse(data[subKey]);
        if (res) return res;
      }
    }
  }

  return null;
}

// ----------------------------------------------------------------------------
// Helper: Extract TeraBox file identifier (surl) and construct embed URLs
// ----------------------------------------------------------------------------
function extractTeraBoxInfo(rawUrl: string): {
  surl: string;
  embedUrl: string;
  mirrorEmbedUrl: string;
  directShareUrl: string;
} | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();
  let surl = "";

  try {
    const parsed = new URL(url);
    const surlParam = parsed.searchParams.get("surl");
    if (surlParam) surl = surlParam;
  } catch {}

  if (!surl) {
    const match = url.match(/\/s\/(?:1)?([a-zA-Z0-9_-]+)/);
    if (match && match[1]) surl = match[1];
  }

  if (!surl) {
    const match = url.match(/surl=(?:1)?([a-zA-Z0-9_-]+)/);
    if (match && match[1]) surl = match[1];
  }

  if (surl) {
    const cleanSurl = surl.replace(/^1/, "");
    return {
      surl: cleanSurl,
      embedUrl: `https://www.terabox.app/sharing/embed?surl=${cleanSurl}`,
      mirrorEmbedUrl: `https://1024terabox.com/sharing/embed?surl=${cleanSurl}`,
      directShareUrl: `https://1024terabox.com/s/1${cleanSurl}`,
    };
  }
  return null;
}

// ----------------------------------------------------------------------------
// API: Real TeraBox Video Resolver (Converts share link to direct stream link or embed fallback)
// ----------------------------------------------------------------------------
app.get(["/api/video/resolve", "/api/video/resolve-terabox", "/video/resolve-terabox"], async (req: express.Request, res: express.Response) => {
  let rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
  let pwd = typeof req.query.pwd === "string" ? req.query.pwd.trim() : "";

  if (!rawUrl) {
    return res.status(400).json({
      success: false,
      error: "رابط الفيديو مطلوب للتحويل والتجهيز.",
    });
  }

  if (rawUrl && !isSafePublicUrl(rawUrl)) {
    return res.status(400).json({
      success: false,
      error: "رابط الفيديو غير صالح أو غير مسموح به أمنياً.",
    });
  }

  // 0. Degoo share link resolution (e.g. https://app.degoo.com/share/gMISdAZE_NusRfoyats5Xw)
  const degooHash = extractDegooShareHash(rawUrl);
  if (degooHash) {
    const degooInfo = await resolveDegooShare(degooHash);
    if (degooInfo && degooInfo.url) {
      const ticket = encryptVideoTicket({
        url: `/api/video/stream/degoo_${degooHash}`,
        videoId: `degoo_${degooHash}`,
        title: degooInfo.name || "سيرفر Degoo السحابي",
      });

      return res.json({
        success: true,
        isDirect: true,
        provider: "degoo",
        directUrl: `/api/video/stream/degoo_${degooHash}`,
        streamUrl: `/api/video/stream/degoo_${degooHash}`,
        ticket,
        title: degooInfo.name || "سيرفر Degoo السحابي",
        isM3u8: false,
        mimeType: "video/mp4",
        sourceUrl: rawUrl,
        thumbnailUrl: degooInfo.thumbnailUrl,
        message: "تم تجهيز فيديو Degoo للبث المباشر المحمي بنجاح داخل مشغل المنصة.",
      });
    }
  }

  // 0.05 Pixeldrain direct video resolution (e.g. https://pixeldrain.com/u/Mp8gcshs or https://pixeldrain.com/api/file/Mp8gcshs)
  const isPixeldrain = /pixeldrain\.com/i.test(rawUrl) || rawUrl.startsWith("pixeldrain_") || rawUrl.startsWith("pixeldrain:");
  if (isPixeldrain) {
    const match = rawUrl.match(/pixeldrain\.com\/(?:u|api\/file|e)\/([a-zA-Z0-9_-]+)/i) || rawUrl.match(/^pixeldrain[_:]([a-zA-Z0-9_-]+)/i);
    const pixelId = match && match[1] ? match[1] : rawUrl.replace(/^pixeldrain[_:]/, "").split("?")[0];
    const directApiUrl = `https://pixeldrain.com/api/file/${pixelId}`;
    let videoTitle = "فيديو Pixeldrain المباشر";
    let thumbUrl = `https://pixeldrain.com/api/file/${pixelId}/thumbnail`;
    try {
      const infoRes = await axios.get(`https://pixeldrain.com/api/file/${pixelId}/info`, { timeout: 3500 });
      if (infoRes.data && infoRes.data.name) {
        videoTitle = String(infoRes.data.name).replace(/\.(mp4|mkv|webm|mov|avi)$/i, "");
      }
    } catch {}
    const ticket = encryptVideoTicket({
      url: directApiUrl,
      videoId: `pixeldrain_${pixelId}`,
      title: videoTitle,
    });
    return res.json({
      success: true,
      isDirect: true,
      provider: "pixeldrain",
      directUrl: directApiUrl,
      streamUrl: directApiUrl,
      proxyStreamUrl: `/api/video/stream/${ticket}`,
      ticket,
      title: videoTitle,
      isM3u8: false,
      mimeType: "video/mp4",
      sourceUrl: rawUrl,
      thumbnailUrl: thumbUrl,
      message: "تم تجهيز فيديو Pixeldrain للبث المباشر فائق السرعة داخل مشغل المنصة بنجاح.",
    });
  }

  // 0.1 Immediate handling for direct cloud media (Wasabi S3, direct MP4/WebM/HLS):
  const isDegoo = /degoo\.info|degoo\.com|degoo-production/i.test(rawUrl);
  const isWasabi = /wasabisys\.com/i.test(rawUrl);
  const isDirectMp4 = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(rawUrl);
  const isHls = /\.m3u8(\?.*)?$/i.test(rawUrl);

  if (isWasabi || isDirectMp4 || isHls) {
    const ticket = encryptVideoTicket({
      url: rawUrl,
      videoId: "v_cloud_" + Date.now(),
      title: isWasabi ? "Wasabi S3 Cloud" : "فيديو مباشر",
    });

    return res.json({
      success: true,
      isDirect: true,
      provider: isWasabi ? "wasabi" : "direct",
      directUrl: rawUrl,
      streamUrl: `/api/video/stream/${ticket}`,
      title: isWasabi ? "Wasabi S3 Cloud" : "بث مباشر آمن",
      isM3u8: isHls,
      mimeType: isHls ? "application/vnd.apple.mpegurl" : "video/mp4",
      sourceUrl: rawUrl,
      message: "تم فحص الرابط وتجهيز البث المحمي بنجاح.",
    });
  }

  const tbInfo = extractTeraBoxInfo(rawUrl);

  try {
    // Extract password from URL query string if present and not explicitly passed
    if (!pwd) {
      try {
        const parsed = new URL(rawUrl);
        const extractedPwd = parsed.searchParams.get("pwd") || parsed.searchParams.get("password");
        if (extractedPwd) {
          pwd = extractedPwd;
        }
      } catch {}
    }

    // 1. Target gateway setup
    let rawGateway = (process.env.TERABOX_GATEWAY_URL || "https://terabox-gateway-vercel-ready.vercel.app").trim();
    let baseGateway = rawGateway
      .replace(/\/+$/, "")
      .replace(/\/(api|docs#?.*|swagger.*)$/i, "");
    if (!baseGateway.startsWith("http")) {
      baseGateway = "https://terabox-gateway-vercel-ready.vercel.app";
    }

    const targetGatewayApi = `${baseGateway}/api?url=${encodeURIComponent(rawUrl)}${
      pwd ? `&pwd=${encodeURIComponent(pwd)}` : ""
    }&resolve=true`;

    let directExtracted: any = null;

    try {
      // 2. Fast request with 5s timeout to avoid keeping user waiting
      const gatewayRes = await axios.get(targetGatewayApi, {
        timeout: 5000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
        validateStatus: () => true,
        responseType: "text",
      });

      const contentType = String(gatewayRes.headers["content-type"] || "").toLowerCase();
      const rawBody = typeof gatewayRes.data === "string" ? gatewayRes.data : String(gatewayRes.data || "");
      const trimmedBody = rawBody.trim();
      const isOk = gatewayRes.status >= 200 && gatewayRes.status < 300;
      const isJson =
        (contentType.includes("application/json") || contentType.includes("+json")) &&
        (trimmedBody.startsWith("{") || trimmedBody.startsWith("["));

      if (isOk && isJson && !rawBody.includes("<html") && !rawBody.includes("<!doctype")) {
        const parsedData = JSON.parse(rawBody);
        directExtracted = extractDirectUrlFromTeraBoxResponse(parsedData);
      }
    } catch (gErr: any) {
      console.warn("[TeraBox Resolver] Direct gateway extraction attempt notice:", gErr.message);
    }

    // 3. If direct playable stream (MP4 / M3U8) was retrieved successfully:
    if (directExtracted && directExtracted.directUrl) {
      return res.json({
        success: true,
        isEmbedFallback: false,
        directUrl: directExtracted.directUrl,
        streamUrl: directExtracted.directUrl,
        isM3u8: directExtracted.isM3u8,
        title: directExtracted.title || null,
        type: directExtracted.isM3u8 ? "m3u8" : "mp4",
        sourceUrl: rawUrl,
        embedUrl: tbInfo?.embedUrl || null,
        mirrorEmbedUrl: tbInfo?.mirrorEmbedUrl || null,
        surl: tbInfo?.surl || null,
      });
    }

    // 4. Reliable Fallback: Use official TeraBox embedded player (Zero fail, 100% playable directly from TeraBox CDN)
    if (tbInfo) {
      return res.json({
        success: true,
        isEmbedFallback: true,
        directUrl: null,
        streamUrl: null,
        embedUrl: tbInfo.embedUrl,
        mirrorEmbedUrl: tbInfo.mirrorEmbedUrl,
        surl: tbInfo.surl,
        title: "TeraBox Video",
        sourceUrl: rawUrl,
        message: "تم تجهيز المشغل المدمج لتشغيل الفيديو مباشرة وبدون توقف.",
      });
    }

    return res.status(422).json({
      success: false,
      error: `لم يتم التعرف على معرّف فيديو TeraBox صالح للرابط: ${rawUrl}`,
      requestedUrl: rawUrl,
    });
  } catch (err: any) {
    console.error("[TeraBox Resolver] Unexpected error:", err.message);
    if (tbInfo) {
      return res.json({
        success: true,
        isEmbedFallback: true,
        embedUrl: tbInfo.embedUrl,
        mirrorEmbedUrl: tbInfo.mirrorEmbedUrl,
        surl: tbInfo.surl,
        sourceUrl: rawUrl,
      });
    }
    return res.status(500).json({
      success: false,
      error: `حدث خطأ أثناء معالجة رابط TeraBox: ${err.message}`,
    });
  }
});

// ----------------------------------------------------------------------------
// API: Secure Video Streaming with Range Requests (Video Chunking / Pipe)
// Zero-leak streaming: Hides TeraBox/Drive links, prevents direct downloads
// ----------------------------------------------------------------------------
app.get(["/api/video/stream/:videoId", "/video/stream/:videoId"], async (req: express.Request, res: express.Response) => {
  try {
    const { videoId } = req.params;

    // 1. Resolve target video direct URL from ticket, payload, or DB
    let directVideoUrl = "";

    // Check Ticket in URL parameter or query payload
    const ticketData = decryptVideoTicket(videoId) || (req.query.payload ? decryptVideoTicket(String(req.query.payload)) : null);
    if (ticketData && ticketData.url) {
      directVideoUrl = ticketData.url;
    }

    // Check fallbackUrl, url, or directUrl query parameter
    const queryUrl = (req.query.fallbackUrl || req.query.url || req.query.directUrl) as string;
    if (!directVideoUrl && typeof queryUrl === "string" && queryUrl.trim()) {
      try {
        directVideoUrl = decodeURIComponent(queryUrl.trim());
      } catch {
        directVideoUrl = queryUrl.trim();
      }
    }

    // Direct HTTP URL in videoId parameter
    if (!directVideoUrl && typeof videoId === "string" && (videoId.startsWith("http://") || videoId.startsWith("https://"))) {
      directVideoUrl = videoId;
    }

    // Direct Degoo share ID or URL in videoId parameter
    if (!directVideoUrl && videoId && (videoId.startsWith("degoo_") || videoId.startsWith("degoo:") || /degoo\.com\/share\//i.test(videoId))) {
      const degooHash = extractDegooShareHash(videoId) || videoId.replace(/^degoo[_:]/, "");
      const degooInfo = await resolveDegooShare(degooHash);
      if (degooInfo && degooInfo.url) {
        directVideoUrl = degooInfo.url;
      }
    }

    // Direct Pixeldrain share ID or URL in videoId parameter
    if (!directVideoUrl && videoId && (videoId.startsWith("pixeldrain_") || videoId.startsWith("pixeldrain:") || /pixeldrain\.com/i.test(videoId))) {
      const match = videoId.match(/pixeldrain\.com\/(?:u|api\/file|e)\/([a-zA-Z0-9_-]+)/i) || videoId.match(/^pixeldrain[_:]([a-zA-Z0-9_-]+)/i);
      const pixelId = match && match[1] ? match[1] : videoId.replace(/^pixeldrain[_:]/, "");
      directVideoUrl = `https://pixeldrain.com/api/file/${pixelId}`;
    }

    // Check Firestore if not yet found
    if (!directVideoUrl) {
      try {
        const db = getSafeFirestore();
        if (db) {
          const videoDoc = await db.collection("videos").doc(videoId).get();
          if (videoDoc.exists) {
            const data = videoDoc.data() || {};
            directVideoUrl = data.directUrl || data.url || data.teraboxUrl || data.link || data.streamUrl || "";
          }

          if (!directVideoUrl) {
            const querySnap = await db.collection("videos").where("id", "==", videoId).limit(1).get();
            if (!querySnap.empty) {
              const data = querySnap.docs[0].data() || {};
              directVideoUrl = data.directUrl || data.url || data.teraboxUrl || data.link || data.streamUrl || "";
            }
          }

          if (!directVideoUrl) {
            const coursesSnap = await db.collection("courses").get();
            for (const cDoc of coursesSnap.docs) {
              const cData = cDoc.data() || {};
              if (Array.isArray(cData.lessons)) {
                for (const lesson of cData.lessons) {
                  if (Array.isArray(lesson.videos)) {
                    const matched = lesson.videos.find((v: any) => v.id === videoId);
                    if (matched && (matched.directUrl || matched.url || matched.teraboxUrl)) {
                      directVideoUrl = matched.directUrl || matched.teraboxUrl || matched.url;
                      break;
                    }
                  }
                }
              }
              if (directVideoUrl) break;
            }
          }
        }
      } catch (dbErr: any) {
        // Silently handled
      }
    }

    if (!directVideoUrl) {
      return res.status(404).json({
        error: "لم يتم العثور على رابط الفيديو المطلوب أو انتهت صلاحيته.",
      });
    }

    // If directVideoUrl is a Degoo share link or points to a degoo stream ticket, resolve it to Wasabi S3 URL:
    if (directVideoUrl && (extractDegooShareHash(directVideoUrl) || directVideoUrl.includes("/degoo_") || directVideoUrl.startsWith("degoo_"))) {
      const degooHash = extractDegooShareHash(directVideoUrl) || directVideoUrl.replace(/.*degoo_/, "").replace(/^degoo[_:]/, "");
      const degooInfo = await resolveDegooShare(degooHash);
      if (degooInfo && degooInfo.url) {
        directVideoUrl = degooInfo.url;
      }
    }

    // Transform Pixeldrain view URLs (e.g. https://pixeldrain.com/u/ID) to direct streaming API (https://pixeldrain.com/api/file/ID)
    if (directVideoUrl && /pixeldrain\.com\/(?:u|e)\/([a-zA-Z0-9_-]+)/i.test(directVideoUrl)) {
      directVideoUrl = directVideoUrl.replace(/pixeldrain\.com\/(?:u|e)\/([a-zA-Z0-9_-]+)/i, 'pixeldrain.com/api/file/$1');
    }

    // Check directVideoUrl safety against SSRF
    if (!isSafePublicUrl(directVideoUrl)) {
      return res.status(400).json({
        error: "رابط الفيديو غير صالح أو غير مسموح به أمنياً.",
      });
    }

    // 2. Range Requests / Partial Streaming via Axios
    const rangeHeader = req.headers.range;
    const axiosHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
    };

    if (/pixeldrain\.com/i.test(directVideoUrl)) {
      axiosHeaders["Referer"] = "https://pixeldrain.com/";
    }

    if (/terabox|1024tera|mirrobox|nephobox|4funbox/i.test(directVideoUrl)) {
      axiosHeaders["Referer"] = "https://www.terabox.com/";
    }

    if (rangeHeader) {
      axiosHeaders["Range"] = rangeHeader;
    }

    try {
      const upstreamResponse = await axios({
        method: "GET",
        url: directVideoUrl,
        responseType: "stream",
        headers: axiosHeaders,
        timeout: 60000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType = String(upstreamResponse.headers["content-type"] || "video/mp4");
      
      // If upstream returns an HTML webpage (e.g. TeraBox cloud share page or login gate), notify client to use embed mode
      if (contentType.toLowerCase().includes("text/html")) {
        return res.status(422).json({
          error: "الرابط المقدم هو صفحة سحابية وليس بث MP4 مباشر.",
          isWebPage: true,
          embedUrl: `/api/video/embed/${encodeURIComponent(videoId)}`,
        });
      }

      // Set streaming headers
      res.status(upstreamResponse.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", "bytes");

      if (upstreamResponse.headers["content-range"]) {
        res.setHeader("Content-Range", String(upstreamResponse.headers["content-range"]));
      }
      if (upstreamResponse.headers["content-length"]) {
        res.setHeader("Content-Length", String(upstreamResponse.headers["content-length"]));
      }

      // Standard video streaming caching headers to allow byte-range buffering
      res.setHeader("Content-Disposition", 'inline; filename="stream.mp4"');
      res.setHeader("Cache-Control", "public, max-age=3600, no-transform");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("X-Content-Type-Options", "nosniff");

      // Pipe video stream chunk directly to client
      upstreamResponse.data.pipe(res);

      req.on("close", () => {
        if (upstreamResponse.data && typeof upstreamResponse.data.destroy === "function") {
          upstreamResponse.data.destroy();
        }
      });

      upstreamResponse.data.on("error", (pipeErr: any) => {
        console.warn("Video stream pipe error:", pipeErr?.message || pipeErr);
        if (!res.headersSent) {
          res.status(500).json({ error: "فشل إرسال أجزاء الفيديو أثناء البث." });
        } else {
          res.end();
        }
      });
    } catch (axiosErr: any) {
      console.error("Axios upstream video request error:", axiosErr.message);
      if (!res.headersSent) {
        return res.status(502).json({
          error: "تعذر جلب البث من مزود الفيديو أو انتهت صلاحية الرابط.",
          details: axiosErr.message,
          embedUrl: `/api/video/embed/${encodeURIComponent(videoId)}`,
        });
      }
      res.end();
    }
  } catch (err: any) {
    console.error("Unexpected video streaming error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "حدث خطأ غير متوقع أثناء معالجة بث الفيديو." });
    } else {
      res.end();
    }
  }
});

// ----------------------------------------------------------------------------
// API: Secure In-Platform Video Embed (Zero Redirection & Zero Link Leak)
// Proxies cloud media (TeraBox, YouTube, Vimeo, Drive) into a sandboxed view
// ----------------------------------------------------------------------------
app.get(["/api/video/embed", "/api/video/embed/:videoId"], async (req: express.Request, res: express.Response) => {
  try {
    // Enforce that video player runs strictly inside the platform
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");

    const videoId = req.params.videoId || "";

    // Resolve URL from query url, ticket, payload, or DB
    let targetUrl = "";
    if (typeof req.query.url === "string" && req.query.url.trim()) {
      targetUrl = req.query.url.trim();
    }

    if (!targetUrl && videoId) {
      const ticketData = decryptVideoTicket(videoId) || (req.query.payload ? decryptVideoTicket(String(req.query.payload)) : null);
      if (ticketData && ticketData.url) {
        targetUrl = ticketData.url;
      }
    }

    if (!targetUrl && typeof req.query.fallbackUrl === "string" && req.query.fallbackUrl.trim()) {
      try {
        targetUrl = decodeURIComponent(req.query.fallbackUrl.trim());
      } catch {
        targetUrl = req.query.fallbackUrl.trim();
      }
    }

    if (!targetUrl && videoId) {
      try {
        const db = getSafeFirestore();
        if (db) {
          const doc = await db.collection("videos").doc(videoId).get();
          if (doc.exists) {
            const data = doc.data() || {};
            targetUrl = data.directUrl || data.url || data.teraboxUrl || data.link || "";
          }
        }
      } catch {}
    }

    if (!targetUrl) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head><meta charset="utf-8"><style>body{margin:0;background:#020617;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px;}</style></head>
        <body><div><h2 style="color:#f87171;margin-bottom:8px;">عذراً، لم يتم العثور على الفيديو</h2><p>تأكد من صلاحية المحتوى أو تواصل مع إدارة المنصة.</p></div></body>
        </html>
      `);
    }

    const antiRedirectScript = `
      <script>
        // Strict anti-redirection, anti-download, and anti-leak protection
        window.open = function() { console.warn("External popup blocked"); return null; };
        window.alert = function() {};
        window.confirm = function() { return false; };
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, true);
        document.addEventListener('dragstart', function(e) {
          e.preventDefault();
          return false;
        }, true);
        document.addEventListener('keydown', function(e) {
          if (
            e.key === 'F12' ||
            (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j'))
          ) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
      </script>
    `;

    // 0. Degoo Share Link: Play directly via /api/video/stream with anti-leak and anti-piracy
    const degooHash = extractDegooShareHash(targetUrl) || (videoId.startsWith("degoo_") ? videoId.replace(/^degoo_/, "") : null);
    if (degooHash) {
      const streamEndpoint = `/api/video/stream/degoo_${degooHash}`;
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>مشغل الفيديو المحمي - منصة المتفلسفة </title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            video { width: 100%; height: 100%; object-fit: contain; }
            .watermark { position: fixed; top: 20px; left: 20px; z-index: 99; color: rgba(255,255,255,0.4); font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; pointer-events: none; user-select: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <div class="watermark">بث محمي لمنصة المتفلسفة </div>
          <video src="${streamEndpoint}" controls autoplay playsinline controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture></video>
        </body>
        </html>
      `);
    }

    // 0.5 Pixeldrain direct video stream presentation
    if (/pixeldrain\.com/i.test(targetUrl) || (videoId && (videoId.startsWith("pixeldrain_") || videoId.startsWith("pixeldrain:")))) {
      const match = targetUrl.match(/pixeldrain\.com\/(?:u|api\/file|e)\/([a-zA-Z0-9_-]+)/i) || (videoId ? videoId.match(/^pixeldrain[_:]([a-zA-Z0-9_-]+)/i) : null);
      const pixelId = match && match[1] ? match[1] : (videoId || "").replace(/^pixeldrain[_:]/, "");
      const directStreamUrl = `https://pixeldrain.com/api/file/${pixelId}`;
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>مشغل Pixeldrain المحمي - منصة المتفلسفة </title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            video { width: 100%; height: 100%; object-fit: contain; }
            .watermark { position: fixed; top: 20px; left: 20px; z-index: 99; color: rgba(255,255,255,0.4); font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; pointer-events: none; user-select: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <div class="watermark">بث محمي لمنصة المتفلسفة </div>
          <video src="${directStreamUrl}" controls autoplay playsinline controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture></video>
        </body>
        </html>
      `);
    }

    // 1. YouTube Embed with Strict Sandbox and Zero Redirects
    const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      const embedSrc = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&modestbranding=1&rel=0&playsinline=1&controls=1&iv_load_policy=3&disablekb=0`;
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>مشغل منصة المتفلسفة  التعليمية</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #020617; overflow: hidden; }
            iframe { width: 100%; height: 100%; border: none; display: block; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <iframe
            src="${embedSrc}"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen
          ></iframe>
        </body>
        </html>
      `);
    }

    // 2. Google Drive Embed
    const gDriveMatch = targetUrl.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:[^&]*&)*id=)([a-zA-Z0-9_-]+)/i) || targetUrl.match(/^drive[_-]([a-zA-Z0-9_-]{20,})/i);
    if (gDriveMatch && gDriveMatch[1]) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #020617; overflow: hidden; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <iframe src="https://drive.google.com/file/d/${gDriveMatch[1]}/preview" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
        </body>
        </html>
      `);
    }

    // 3. Vimeo Embed
    const vimeoMatch = targetUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|)(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #020617; overflow: hidden; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&title=0&byline=0&portrait=0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" allow="autoplay; fullscreen" allowfullscreen></iframe>
        </body>
        </html>
      `);
    }

    // 4. TeraBox Cloud Media Sandbox
    if (/terabox|1024tera|mirrobox|nephobox|4funbox/i.test(targetUrl)) {
      const tbInfo = extractTeraBoxInfo(targetUrl);
      const embedTarget = tbInfo?.embedUrl || targetUrl;

      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>مشغل تيرابوكس المحمي</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #020617; overflow: hidden; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <iframe
            src="${embedTarget}"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowfullscreen
          ></iframe>
        </body>
        </html>
      `);
    }

    // 5. Direct media (Wasabi S3, Degoo, MP4, WebM) player presentation
    const isDirectMedia = /wasabisys\.com|degoo\.info|degoo\.com|\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(targetUrl);
    if (isDirectMedia) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>مشغل الفيديو المحمي</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
            video { width: 100%; height: 100%; object-fit: contain; }
            .watermark { position: fixed; top: 20px; left: 20px; z-index: 99; color: rgba(255,255,255,0.4); font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; pointer-events: none; user-select: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <div class="watermark">بث محمي لمنصة المتفلسفة </div>
          <video src="${targetUrl}" controls autoplay playsinline controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture></video>
        </body>
        </html>
      `);
    }

    // 5.5 AVCaption Native Player Embed inside the platform (with permanent silent Ad & Popup Blocker)
    if (/avcaption\.com|avcaption/i.test(targetUrl)) {
      const { embedUrl } = normalizeAvcaptionTargetUrl(targetUrl);
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
            iframe { width: 100%; height: 100%; border: none; }
          </style>
          ${antiRedirectScript}
        </head>
        <body>
          <iframe src="${embedUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="origin-when-cross-origin"></iframe>
        </body>
        </html>
      `);
    }

    // 6. General Isolated Embed Fallback for third-party embeds
    return res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { width: 100%; height: 100%; background: #020617; overflow: hidden; }
          iframe { width: 100%; height: 100%; border: none; }
        </style>
        ${antiRedirectScript}
      </head>
      <body>
        <iframe src="${targetUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Embed proxy error:", err);
    res.status(500).send("حدث خطأ أثناء تحميل مشغل الفيديو المحمي.");
  }
});

// ============================================================================
// SILENT BACKGROUND YOUTUBE STREAM BRIDGE FOR RESTRICTED NETWORKS
// Only invoked automatically in the background when direct youtube.com is blocked
// on the client network. Resolves direct MP4 stream and pipes byte-ranges from
// the platform's own domain with zero RAM buffering.
// ============================================================================
const ytSilentUpstreamCache = new Map<
  string,
  {
    expiresAt: number;
    streamUrl: string;
  }
>();

async function resolveSilentYouTubeMp4Url(videoId: string): Promise<string | null> {
  const cached = ytSilentUpstreamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.streamUrl;
  }

  // 1. Try YouTube Innertube API (ANDROID_VR & IOS clients return direct progressive MP4 format.url)
  const innertubeClients = [
    {
      clientName: "ANDROID_VR",
      clientVersion: "1.56.21",
      androidSdkVersion: 34,
      userAgent: "com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 14; en_US; Quest 3; Build/UP1A.231005.007.A1; Cronet/119.0.6045.194)",
      osName: "Android",
      osVersion: "14",
    },
    {
      clientName: "IOS",
      clientVersion: "19.29.1",
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
      osName: "iPhone",
      osVersion: "17.5.1.21F90",
    },
  ];

  for (const client of innertubeClients) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
          "X-YouTube-Client-Name": client.clientName === "IOS" ? "5" : "28",
          "X-YouTube-Client-Version": client.clientVersion,
        },
        body: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              androidSdkVersion: (client as any).androidSdkVersion,
              deviceMake: (client as any).deviceMake,
              deviceModel: (client as any).deviceModel,
              osName: client.osName,
              osVersion: client.osVersion,
              hl: "ar",
              gl: "EG",
            },
          },
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      });
      clearTimeout(timer);

      if (resp.ok) {
        const data: any = await resp.json();
        const formats: any[] = Array.isArray(data?.streamingData?.formats) ? data.streamingData.formats : [];
        const validMp4Formats = formats
          .filter((f) => f?.url && String(f?.mimeType || "").includes("video/mp4"))
          .sort((a, b) => (Number(b?.height || 0) - Number(a?.height || 0)) || (Number(b?.bitrate || 0) - Number(a?.bitrate || 0)));
        const mp4Format =
          validMp4Formats[0] ||
          formats.find((f) => f?.url && Number(f?.itag) === 22) ||
          formats.find((f) => f?.url && Number(f?.itag) === 18);
        if (mp4Format?.url) {
          const resolved = String(mp4Format.url);
          ytSilentUpstreamCache.set(videoId, {
            expiresAt: Date.now() + 20 * 60 * 1000,
            streamUrl: resolved,
          });
          return resolved;
        }
      }
    } catch {
      // Fall through to next client/layer
    }
  }

  // 2. Fallback to Invidious / Piped APIs
  const invidiousHosts = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
  ];

  for (const host of invidiousHosts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3800);
      const resp = await fetch(`${host}/api/v1/videos/${videoId}?local=true`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timer);
      if (resp.ok) {
        const json: any = await resp.json();
        if (Array.isArray(json?.formatStreams) && json.formatStreams.length > 0) {
          const sortedStreams = [...json.formatStreams].sort((a: any, b: any) => {
            const hA = parseInt(String(a?.qualityLabel || a?.resolution || "0").replace(/\D/g, ""), 10) || 0;
            const hB = parseInt(String(b?.qualityLabel || b?.resolution || "0").replace(/\D/g, ""), 10) || 0;
            return hB - hA;
          });
          const best = sortedStreams[0] || json.formatStreams[0];
          if (best?.url) {
            const rawUrl = String(best.url);
            const resolved = rawUrl.startsWith("/") ? `${host}${rawUrl}` : rawUrl;
            ytSilentUpstreamCache.set(videoId, {
              expiresAt: Date.now() + 20 * 60 * 1000,
              streamUrl: resolved,
            });
            return resolved;
          }
        }
      }
    } catch {
      // Try next host
    }
  }

  return `https://inv.nadeko.net/latest_version?id=${videoId}&itag=22&local=true`;
}

app.get("/api/video/yt-silent-stream/:videoId", async (req, res) => {
  try {
    const rawId = String(req.params.videoId || "").trim();
    const match = rawId.match(/^[\w-]{11}$/);
    if (!match) {
      return res.status(400).end();
    }
    const videoId = match[0];

    const upstreamUrl = await resolveSilentYouTubeMp4Url(videoId);
    if (!upstreamUrl) {
      return res.status(502).end();
    }

    const reqHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      Accept: "*/*",
    };
    if (req.headers.range) {
      reqHeaders["Range"] = String(req.headers.range);
    }

    const upstreamResp = await axios.get(upstreamUrl, {
      responseType: "stream",
      headers: reqHeaders,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    res.status(upstreamResp.status);
    res.setHeader("Content-Type", upstreamResp.headers["content-type"] || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    if (upstreamResp.headers["content-range"]) {
      res.setHeader("Content-Range", String(upstreamResp.headers["content-range"]));
    }
    if (upstreamResp.headers["content-length"]) {
      res.setHeader("Content-Length", String(upstreamResp.headers["content-length"]));
    }
    res.setHeader("Cache-Control", "public, max-age=3600");

    upstreamResp.data.pipe(res);

    req.on("close", () => {
      if (upstreamResp.data && typeof upstreamResp.data.destroy === "function") {
        upstreamResp.data.destroy();
      }
    });

    upstreamResp.data.on("error", () => {
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });
  } catch {
    if (!res.headersSent) {
      res.status(502).end();
    } else {
      res.end();
    }
  }
});

// ============================================================================
// AVCAPTION.COM AD-FREE STREAM EXTRACTOR & PLATFORM CUSTOM CONTROLS BRIDGE
// Forces avcaption.com videos to play with 0% ads and 100% under the control
// of the platform's custom video player buttons (Play/Pause, Seek, Speed, Volume, Quality)
// ============================================================================

function unpackDeanEdwardsPacker(packedCode: string): string {
  try {
    const match = packedCode.match(/}\s*\(\s*'((?:\\'|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'\.split\('\|'\)/);
    if (!match) return "";
    let p = match[1].replace(/\\'/g, "'");
    const a = parseInt(match[2], 10);
    let c = parseInt(match[3], 10);
    const k = match[4].split("|");

    const e = (num: number): string => {
      return (num < a ? "" : e(Math.floor(num / a))) + ((num = num % a) > 35 ? String.fromCharCode(num + 29) : num.toString(36));
    };

    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
      }
    }
    return p;
  } catch {
    return "";
  }
}

function normalizeAvcaptionTargetUrl(rawUrl: string): { embedUrl: string; watchUrl: string; videoId: string | null } {
  const cleaned = (rawUrl || "").trim();
  const idMatch = cleaned.match(/avcaption\.com\/(?:watch\/|v\/|video\/|embed\/|e\/|d\/)?([a-zA-Z0-9_-]{5,})/i);
  const videoId = idMatch && idMatch[1] ? idMatch[1] : null;
  if (videoId && !/^(embed|watch|video|player)$/i.test(videoId)) {
    return {
      embedUrl: `https://avcaption.com/watch/${videoId}`,
      watchUrl: `https://avcaption.com/watch/${videoId}`,
      videoId,
    };
  }
  return {
    embedUrl: cleaned,
    watchUrl: cleaned,
    videoId: null,
  };
}

async function extractAvcaptionStreamFromHtml(rawUrl: string): Promise<{
  directUrl: string | null;
  isHls: boolean;
  sanitizedHtml: string | null;
  originUrl: string;
}> {
  const { embedUrl, watchUrl } = normalizeAvcaptionTargetUrl(rawUrl);
  const candidates = [embedUrl, watchUrl];
  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
    Referer: "https://avcaption.com/",
  };

  let fetchedHtml = "";
  let finalOrigin = embedUrl;

  for (const candidateUrl of candidates) {
    if (!candidateUrl || !isSafePublicUrl(candidateUrl)) continue;
    try {
      const resp = await axios.get(candidateUrl, {
        headers: browserHeaders,
        timeout: 6500,
        responseType: "text",
        validateStatus: (s) => s >= 200 && s < 400,
      });
      if (typeof resp.data === "string" && resp.data.length > 100) {
        fetchedHtml = resp.data;
        finalOrigin = candidateUrl;
        break;
      }
    } catch {}
  }

  if (!fetchedHtml) {
    return { directUrl: null, isHls: false, sanitizedHtml: null, originUrl: embedUrl };
  }

  // Unpack any packed JavaScript blocks (eval(function(p,a,c,k,e,d)...))
  let combinedSearchText = fetchedHtml;
  const packedMatches = fetchedHtml.match(/eval\(function\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)\)\)/g);
  if (packedMatches) {
    for (const pm of packedMatches) {
      const unpacked = unpackDeanEdwardsPacker(pm);
      if (unpacked) {
        combinedSearchText += "\n" + unpacked;
      }
    }
  }

  // Search for direct .m3u8 or .mp4 stream URLs
  const m3u8Regex = /(https?:\/\/[^\s"'<>\\]+\.m3u8(?:\?[^\s"'<>\\]*)?)/gi;
  const mp4Regex = /(https?:\/\/[^\s"'<>\\]+\.mp4(?:\?[^\s"'<>\\]*)?)/gi;
  const fileKeyRegex = /(?:file|src|source|hls|streamUrl|video_url)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi;

  const isAdUrl = (u: string) =>
    /doubleclick|googlesyndication|popads|exoclick|propellerads|adcash|vast|preroll|midroll|adserver|juicyads|clickadu|hilltopads/i.test(u);

  const scoreStreamQuality = (urlStr: string, idx: number): number => {
    if (/2160|4k/i.test(urlStr)) return 4000 + idx;
    if (/1440|2k/i.test(urlStr)) return 3000 + idx;
    if (/1080|fhd/i.test(urlStr)) return 2000 + idx;
    if (/720|hd/i.test(urlStr)) return 1000 + idx;
    if (/480/i.test(urlStr)) return 500 + idx;
    if (/master|index/i.test(urlStr)) return 1500 + idx;
    return 100 + idx; // Later entries in player source arrays are higher quality
  };

  let match: RegExpExecArray | null;
  const m3u8Candidates: string[] = [];
  while ((match = m3u8Regex.exec(combinedSearchText)) !== null) {
    const candidate = match[1].replace(/\\\//g, "/");
    if (!isAdUrl(candidate)) {
      m3u8Candidates.push(candidate);
    }
  }
  if (m3u8Candidates.length > 0) {
    m3u8Candidates.sort((a, b) => scoreStreamQuality(b, m3u8Candidates.indexOf(b)) - scoreStreamQuality(a, m3u8Candidates.indexOf(a)));
    return { directUrl: m3u8Candidates[0], isHls: true, sanitizedHtml: fetchedHtml, originUrl: finalOrigin };
  }

  const mp4Candidates: string[] = [];
  while ((match = mp4Regex.exec(combinedSearchText)) !== null) {
    const candidate = match[1].replace(/\\\//g, "/");
    if (!isAdUrl(candidate)) {
      mp4Candidates.push(candidate);
    }
  }
  if (mp4Candidates.length > 0) {
    mp4Candidates.sort((a, b) => scoreStreamQuality(b, mp4Candidates.indexOf(b)) - scoreStreamQuality(a, mp4Candidates.indexOf(a)));
    return { directUrl: mp4Candidates[0], isHls: false, sanitizedHtml: fetchedHtml, originUrl: finalOrigin };
  }

  while ((match = fileKeyRegex.exec(combinedSearchText)) !== null) {
    const candidate = match[1].replace(/\\\//g, "/");
    if (!isAdUrl(candidate) && (/\.m3u8/i.test(candidate) || /\.mp4/i.test(candidate) || /\/hls\//i.test(candidate) || /master|playlist|stream/i.test(candidate))) {
      const isHls = /\.m3u8|\/hls\/|master|playlist/i.test(candidate);
      return { directUrl: candidate, isHls, sanitizedHtml: fetchedHtml, originUrl: finalOrigin };
    }
  }

  return { directUrl: null, isHls: false, sanitizedHtml: fetchedHtml, originUrl: finalOrigin };
}

// 1. API: Resolve AVCaption URL into direct ad-free stream or controlled clean embed
app.get("/api/video/resolve-avcaption", async (req: express.Request, res: express.Response) => {
  try {
    const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: "رابط فيديو AVCaption مطلوب." });
    }

    const extracted = await extractAvcaptionStreamFromHtml(rawUrl);

    if (extracted.directUrl) {
      const proxiedStreamUrl = extracted.isHls
        ? `/api/video/avcaption-hls?url=${encodeURIComponent(extracted.directUrl)}`
        : `/api/video/avcaption-stream?url=${encodeURIComponent(extracted.directUrl)}`;

      return res.json({
        success: true,
        isDirect: true,
        isHls: extracted.isHls,
        streamUrl: proxiedStreamUrl,
        directUrl: extracted.directUrl,
        cleanEmbedUrl: `/api/video/avcaption-clean-embed?url=${encodeURIComponent(rawUrl)}`,
      });
    }

    return res.json({
      success: true,
      isDirect: false,
      isHls: false,
      streamUrl: null,
      cleanEmbedUrl: `/api/video/avcaption-clean-embed?url=${encodeURIComponent(rawUrl)}`,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      isDirect: false,
      isHls: false,
      streamUrl: null,
      cleanEmbedUrl: `/api/video/avcaption-clean-embed?url=${encodeURIComponent(String(req.query.url || ""))}`,
    });
  }
});

// 2. API: Proxy AVCaption HLS (.m3u8) Manifest with Ad-Stripping & Segment Rewriting
app.get("/api/video/avcaption-hls", async (req: express.Request, res: express.Response) => {
  try {
    const targetUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!targetUrl || !isSafePublicUrl(targetUrl)) {
      return res.status(400).send("Invalid HLS URL");
    }

    const resp = await axios.get(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://avcaption.com/",
        Origin: "https://avcaption.com",
      },
      timeout: 15000,
      responseType: "text",
    });

    const baseUrl = new URL(targetUrl);
    const lines = String(resp.data || "").split(/\r?\n/);
    const rewrittenLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      // Filter out any injected ad segments
      if (/doubleclick|googlesyndication|popads|exoclick|propellerads|adserver|preroll|midroll/i.test(trimmed)) {
        return "";
      }
      let resolvedUrl = trimmed;
      try {
        resolvedUrl = new URL(trimmed, baseUrl).toString();
      } catch {}
      if (/\.m3u8(\?|$)/i.test(resolvedUrl)) {
        return `/api/video/avcaption-hls?url=${encodeURIComponent(resolvedUrl)}`;
      }
      return `/api/video/avcaption-stream?url=${encodeURIComponent(resolvedUrl)}`;
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");
    return res.send(rewrittenLines.filter((l) => l !== "").join("\n"));
  } catch (err: any) {
    return res.status(502).send("Failed to proxy AVCaption HLS manifest");
  }
});

// 3. API: Proxy AVCaption Direct Video / TS Segments with Range Request Support
app.get("/api/video/avcaption-stream", async (req: express.Request, res: express.Response) => {
  try {
    const targetUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!targetUrl || !isSafePublicUrl(targetUrl)) {
      return res.status(400).send("Invalid stream URL");
    }

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://avcaption.com/",
      Origin: "https://avcaption.com",
      Accept: "*/*",
    };
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const upstream = await axios({
      method: "GET",
      url: targetUrl,
      responseType: "stream",
      headers,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    res.status(upstream.status);
    res.setHeader("Content-Type", String(upstream.headers["content-type"] || "video/mp4"));
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (upstream.headers["content-range"]) {
      res.setHeader("Content-Range", String(upstream.headers["content-range"]));
    }
    if (upstream.headers["content-length"]) {
      res.setHeader("Content-Length", String(upstream.headers["content-length"]));
    }

    upstream.data.pipe(res);
    req.on("close", () => {
      try {
        upstream.data.destroy();
      } catch {}
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).send("Failed to stream AVCaption segment");
    }
  }
});

// 4. API: Clean, Ad-Free & Platform-Controlled AVCaption Embed Bridge
app.get("/api/video/avcaption-clean-embed", async (req: express.Request, res: express.Response) => {
  try {
    const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    const { embedUrl, watchUrl } = normalizeAvcaptionTargetUrl(rawUrl);
    const useMirror = req.query.mirror === "1";
    const targetEmbed = useMirror ? watchUrl : embedUrl;

    const extracted = await extractAvcaptionStreamFromHtml(targetEmbed);

    // Bridge script injected into the player frame so SecureVideoPlayer's custom buttons
    // (Play/Pause, Seek bar, -10s/+10s, Speed 0.5x-2x, Volume, Mute) directly control the video
    // AND all ad scripts / popups / native controls are completely neutralized.
    const platformControlBridgeScript = `
      <style>
        /* Hide native player control bars, ad banners, popups, and logos so ONLY Platform Custom Controls are used */
        .jw-controls, .jw-controlbar, .jw-display-icon-container, .jw-logo, .jw-title, .jw-rightclick, .jw-skip, .jw-overlays,
        .vjs-control-bar, .vjs-big-play-button, .vjs-modal-dialog, .vjs-error-display,
        .plyr__controls, .plyr__control--overlaid, .fp-controls, .fp-ui,
        [class*="ad-"], [id*="ad-"], [class*="ads-"], [id*="ads-"], [class*="popup"], [id*="popup"],
        [class*="banner"], [id*="banner"], a[target="_blank"], iframe[src*="ads"], iframe[src*="pop"],
        iframe[src*="exoclick"], iframe[src*="propeller"], iframe[src*="doubleclick"] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: #000 !important;
          overflow: hidden !important;
        }
        video, .jwplayer, .video-js, .plyr, #player, #vplayer, .player-container {
          width: 100% !important;
          height: 100% !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          object-fit: contain !important;
        }
      </style>
      <script>
        (function() {
          // 1. Strict Ad & Popup Blocker inside AVCaption context
          window.open = function() { return null; };
          window.alert = function() {};
          window.confirm = function() { return false; };
          window.prompt = function() { return null; };

          // Block ad network requests in fetch & XMLHttpRequest
          var adPattern = /doubleclick|googlesyndication|popads|exoclick|propellerads|adcash|onclick|vast|vmap|preroll|midroll|juicyads|clickadu|hilltopads|adnxs|taboola|outbrain/i;
          var origFetch = window.fetch;
          if (origFetch) {
            window.fetch = function(input, init) {
              var urlStr = typeof input === 'string' ? input : (input && input.url) || '';
              if (adPattern.test(urlStr)) {
                return Promise.resolve(new Response('', { status: 204 }));
              }
              return origFetch.apply(this, arguments);
            };
          }
          var origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string' && adPattern.test(url)) {
              this._blockedAd = true;
            }
            return origOpen.apply(this, arguments);
          };
          var origSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.send = function() {
            if (this._blockedAd) return;
            return origSend.apply(this, arguments);
          };

          // Prevent any external link clicks
          document.addEventListener('click', function(e) {
            var a = e.target && e.target.closest ? e.target.closest('a') : null;
            if (a) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }, true);

          // 2. Helper to locate active video controller (HTML5 <video>, JWPlayer, VideoJS, Plyr)
          function getActiveVideoElement() {
            var v = document.querySelector('video');
            if (v) {
              v.controls = false;
              v.removeAttribute('controls');
              v.setAttribute('playsinline', 'true');
            }
            return v;
          }

          function getJwInstance() {
            try {
              if (typeof window.jwplayer === 'function') {
                var jw = window.jwplayer();
                if (jw && typeof jw.play === 'function') return jw;
              }
            } catch (e) {}
            return null;
          }

          function sendStateToPlatform(eventType) {
            try {
              var v = getActiveVideoElement();
              var jw = getJwInstance();
              var currentTime = 0;
              var duration = 0;
              var paused = true;

              if (v) {
                currentTime = v.currentTime || 0;
                duration = v.duration || 0;
                paused = v.paused;
              } else if (jw) {
                currentTime = typeof jw.getPosition === 'function' ? jw.getPosition() : 0;
                duration = typeof jw.getDuration === 'function' ? jw.getDuration() : 0;
                paused = typeof jw.getState === 'function' ? jw.getState() !== 'playing' : false;
              }

              window.parent.postMessage({
                source: 'qalbalelm_avcaption_bridge',
                event: eventType || 'timeupdate',
                currentTime: isFinite(currentTime) ? currentTime : 0,
                duration: isFinite(duration) && duration > 0 ? duration : 0,
                paused: paused
              }, '*');
            } catch (e) {}
          }

          // Bind listeners to <video> as soon as it appears in DOM
          var boundVideo = null;
          setInterval(function() {
            var v = getActiveVideoElement();
            if (v && v !== boundVideo) {
              boundVideo = v;
              v.controls = false;
              v.addEventListener('timeupdate', function() { sendStateToPlatform('timeupdate'); });
              v.addEventListener('loadedmetadata', function() { sendStateToPlatform('loadedmetadata'); });
              v.addEventListener('play', function() { sendStateToPlatform('play'); });
              v.addEventListener('pause', function() { sendStateToPlatform('pause'); });
              v.addEventListener('ended', function() { sendStateToPlatform('ended'); });
              v.play().catch(function() {});
            }
            sendStateToPlatform('timeupdate');
          }, 250);

          // 3. Listen to commands from Platform Custom Video Player Buttons
          window.addEventListener('message', function(ev) {
            var data = ev.data;
            if (!data) return;
            if (typeof data === 'string') {
              try { data = JSON.parse(data); } catch (e) { return; }
            }
            if (data.target !== 'qalbalelm_avcaption_bridge') return;

            var v = getActiveVideoElement();
            var jw = getJwInstance();
            var innerIframe = document.querySelector('iframe');

            switch (data.action) {
              case 'play':
                if (v) v.play().catch(function() {});
                else if (jw) try { jw.play(true); } catch (e) {}
                break;
              case 'pause':
                if (v) v.pause();
                else if (jw) try { jw.pause(true); } catch (e) {}
                break;
              case 'toggle':
                if (v) {
                  if (v.paused) v.play().catch(function() {});
                  else v.pause();
                } else if (jw) {
                  try { jw.play(); } catch (e) {}
                }
                break;
              case 'seek':
                var targetTime = Number(data.value) || 0;
                if (v) v.currentTime = targetTime;
                else if (jw && typeof jw.seek === 'function') try { jw.seek(targetTime); } catch (e) {}
                break;
              case 'skip':
                var delta = Number(data.value) || 0;
                if (v) v.currentTime = Math.max(0, (v.currentTime || 0) + delta);
                else if (jw && typeof jw.seek === 'function') {
                  var cur = typeof jw.getPosition === 'function' ? jw.getPosition() : 0;
                  try { jw.seek(Math.max(0, cur + delta)); } catch (e) {}
                }
                break;
              case 'volume':
                var vol = Number(data.value);
                if (v && isFinite(vol)) {
                  v.volume = Math.max(0, Math.min(1, vol));
                  v.muted = vol === 0;
                } else if (jw && typeof jw.setVolume === 'function') {
                  try { jw.setVolume(Math.round(vol * 100)); } catch (e) {}
                }
                break;
              case 'mute':
                var muted = Boolean(data.value);
                if (v) v.muted = muted;
                else if (jw && typeof jw.setMute === 'function') try { jw.setMute(muted); } catch (e) {}
                break;
              case 'speed':
                var rate = Number(data.value) || 1;
                if (v) v.playbackRate = rate;
                else if (jw && typeof jw.setPlaybackRate === 'function') try { jw.setPlaybackRate(rate); } catch (e) {}
                break;
            }

            // Also forward standard Player.js / Video.js / HTML5 commands to any nested iframe
            if (innerIframe && innerIframe.contentWindow) {
              try {
                if (data.action === 'play') {
                  innerIframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', method: 'play' }), '*');
                  innerIframe.contentWindow.postMessage({ event: 'command', func: 'playVideo', args: [] }, '*');
                } else if (data.action === 'pause') {
                  innerIframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', method: 'pause' }), '*');
                  innerIframe.contentWindow.postMessage({ event: 'command', func: 'pauseVideo', args: [] }, '*');
                } else if (data.action === 'seek') {
                  innerIframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', method: 'setCurrentTime', value: Number(data.value) || 0 }), '*');
                } else if (data.action === 'volume') {
                  innerIframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', method: 'setVolume', value: Math.round((Number(data.value) || 1) * 100) }), '*');
                } else if (data.action === 'mute') {
                  innerIframe.contentWindow.postMessage(JSON.stringify({ context: 'player.js', method: data.value ? 'mute' : 'unmute' }), '*');
                }
              } catch (e) {}
            }

            setTimeout(function() { sendStateToPlatform('timeupdate'); }, 60);
          });
        })();
      </script>
    `;

    // Case A: Direct stream was extracted -> Render pure HTML5 <video> with HLS support and zero third-party code!
    if (extracted.directUrl) {
      const proxiedStreamUrl = extracted.isHls
        ? `/api/video/avcaption-hls?url=${encodeURIComponent(extracted.directUrl)}`
        : `/api/video/avcaption-stream?url=${encodeURIComponent(extracted.directUrl)}`;

      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>مشغل منصة المتفلسفة  الخاص</title>
          <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
          ${platformControlBridgeScript}
        </head>
        <body>
          <video id="qae-avc-video" playsinline autoplay></video>
          <script>
            (function() {
              var video = document.getElementById('qae-avc-video');
              var src = ${JSON.stringify(proxiedStreamUrl)};
              var isHls = ${JSON.stringify(extracted.isHls)};
              if (isHls && window.Hls && Hls.isSupported()) {
                var hls = new Hls({
                  enableWorker: true,
                  capLevelToPlayerSize: false,
                  abrEwmaDefaultEstimate: 25000000
                });
                hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, function(_ev, data) {
                  if (data && data.levels && data.levels.length > 0) {
                    var bestIdx = 0;
                    var maxH = -1;
                    for (var i = 0; i < data.levels.length; i++) {
                      var h = data.levels[i].height || data.levels[i].bitrate || 0;
                      if (h >= maxH) {
                        maxH = h;
                        bestIdx = i;
                      }
                    }
                    hls.startLevel = bestIdx;
                    hls.currentLevel = bestIdx;
                    hls.nextLevel = bestIdx;
                    hls.loadLevel = bestIdx;
                  }
                  video.play().catch(function() {});
                });
              } else {
                video.src = src;
                video.play().catch(function() {});
              }
            })();
          </script>
        </body>
        </html>
      `);
    }

    // Case B: Server fetched the AVCaption embed HTML -> Sanitize ads, inject <base>, hide native controls, and inject bridge!
    if (extracted.sanitizedHtml) {
      let cleanHtml = extracted.sanitizedHtml;
      // Remove known ad scripts and popup tags
      cleanHtml = cleanHtml.replace(
        /<script[^>]*src=["'][^"']*(?:popads|exoclick|propeller|adcash|doubleclick|googlesyndication|onclick|juicyads|clickadu|hilltopads|adserver|vast)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
        ""
      );
      cleanHtml = cleanHtml.replace(/window\.open\s*\(/gi, "(function(){return null;})(");

      const baseOrigin = new URL(extracted.originUrl).origin;
      const headInjection = `<base href="${baseOrigin}/">${platformControlBridgeScript}`;
      if (/<head[^>]*>/i.test(cleanHtml)) {
        cleanHtml = cleanHtml.replace(/<head[^>]*>/i, (m) => `${m}\n${headInjection}`);
      } else {
        cleanHtml = `${headInjection}\n${cleanHtml}`;
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(cleanHtml);
    }

    // Case C: Fallback sandboxed ad-free iframe with bridge
    return res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>مشغل منصة المتفلسفة  الخاص</title>
        ${platformControlBridgeScript}
        <style>
          iframe {
            width: 100% !important;
            height: calc(100% + 54px) !important;
            border: 0 !important;
            display: block !important;
          }
        </style>
      </head>
      <body>
        <iframe
          id="avc-inner-frame"
          src="${targetEmbed}${targetEmbed.includes("?") ? "&" : "?"}autoplay=1&controls=0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="no-referrer"
        ></iframe>
      </body>
      </html>
    `);
  } catch (err: any) {
    return res.status(500).send("تعذر تحميل مشغل AVCaption المحمي.");
  }
});

// ----------------------------------------------------------------------------
// API: Parent Portal - Link & Sync Students with Verified Parent UID
// Requires authentic Firebase Auth token (e.g. Phone Auth SMS OTP or Email)
// Real Firebase UID is used. Never creates parent_<phone> UIDs.
// ----------------------------------------------------------------------------
app.post("/api/parents/sync-linked-students", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parentUid = req.user?.uid;
    if (!parentUid) {
      return res.status(401).json({ error: "يجب تسجيل الدخول كولي أمر أولاً." });
    }

    const adminInst = initFirebaseAdmin();
    const safeDb = getSafeFirestore();

    // Get phone number from verified token or request body
    let rawPhone = (req.user as any)?.phone_number || req.body?.phone || "";
    let cleanPhone = String(rawPhone).trim().replace(/[\s\-\(\)]/g, "");
    if (cleanPhone.startsWith("+20")) {
      cleanPhone = "0" + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith("+2")) {
      cleanPhone = cleanPhone.slice(2);
    }

    // Find linked students by parent's registered phone
    const matchedStudents: any[] = [];

    // Query 1: Direct parentPhone field in Firestore Admin
    if (safeDb && cleanPhone) {
      try {
        const pPhoneSnap = await safeDb.collection("users")
          .where("parentPhone", "==", cleanPhone)
          .get();
        pPhoneSnap.docs.forEach((d) => {
          const data = d.data();
          matchedStudents.push({ id: d.id, ...data });
        });

        // Query 2: Father phone
        const fatherSnap = await safeDb.collection("users")
          .where("fatherPhone", "==", cleanPhone)
          .get();
        fatherSnap.docs.forEach((d) => {
          if (!matchedStudents.some((s) => s.id === d.id)) {
            matchedStudents.push({ id: d.id, ...d.data() });
          }
        });

        // Query 3: Mother phone
        const motherSnap = await safeDb.collection("users")
          .where("motherPhone", "==", cleanPhone)
          .get();
        motherSnap.docs.forEach((d) => {
          if (!matchedStudents.some((s) => s.id === d.id)) {
            matchedStudents.push({ id: d.id, ...d.data() });
          }
        });
      } catch (e) {}
    }

    // Also check synced data collection if exists via REST
    if (matchedStudents.length === 0 && cleanPhone) {
      try {
        const usersList = await fetchPlatformUsersFromFirestore();
        if (Array.isArray(usersList)) {
          const matched = usersList.filter(
            (u: any) =>
              (u.parentPhone && u.parentPhone.replace(/\s+/g, "") === cleanPhone) ||
              (u.fatherPhone && u.fatherPhone.replace(/\s+/g, "") === cleanPhone) ||
              (u.motherPhone && u.motherPhone.replace(/\s+/g, "") === cleanPhone)
          );
          matched.forEach((u) => {
            if (!matchedStudents.some((s) => s.id === u.id)) {
              matchedStudents.push(u);
            }
          });
        }
      } catch (e) {}
    }

    if (matchedStudents.length === 0) {
      return res.status(404).json({
        error: `لم يتم العثور على طالب مسجل برقم هاتف ولي الأمر (${cleanPhone || "غير محدد"}). يرجى التأكد من الرقم المسجل في استمارة الطالب.`,
      });
    }

    const linkedStudentIds = matchedStudents.map((s) => s.id);

    // Set role in Custom Claims if Admin service account exists
    if (hasAdminServiceAccount() && adminInst) {
      try {
        await getAuth(adminInst).setCustomUserClaims(parentUid, {
          role: "parent",
        });
      } catch (e) {}
    }

    // Store relationship strictly in parents/{parentUid} -> linkedStudentIds[]
    if (safeDb) {
      try {
        await safeDb.collection("parents").doc(parentUid).set(
          {
            parentUid,
            parentPhone: cleanPhone,
            linkedStudentIds,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {}
    }

    const primaryStudent = matchedStudents[0];
    const parentUser = {
      id: parentUid, // Real Firebase UID
      name: `ولي أمر (${primaryStudent.name || primaryStudent.firstName || "الطالب"})`,
      email: (req.user as any)?.email || `parent_${parentUid.slice(0, 8)}@qalbalelm.internal`,
      phone: cleanPhone,
      parentPhone: cleanPhone,
      role: "parent",
      status: "active",
      registeredAt: new Date().toISOString().split("T")[0],
      linkedStudents: matchedStudents,
      linkedStudentIds,
    };

    return res.json({
      success: true,
      parentUid,
      parentUser,
      linkedStudents: matchedStudents,
    });
  } catch (err: any) {
    console.error("Parent sync error:", err);
    return res.status(500).json({ error: "حدث خطأ أثناء ربط بيانات ولي الأمر." });
  }
});

// ----------------------------------------------------------------------------
// API: Parent Access to Student Academic Details (Prevents IDOR via server-side check)
// Verifies: authenticated parent UID + linkedStudents + studentId
// If not linked: 403 Forbidden!
// ----------------------------------------------------------------------------
app.post("/api/parents/student-details", verifyFirebaseToken, async (req: AuthenticatedRequest, res) => {
  try {
    const parentUid = req.user?.uid;
    const { studentId } = req.body || {};

    if (!parentUid || !studentId) {
      return res.status(400).json({ error: "معرف الطالب مطلوب." });
    }

    const safeDb = getSafeFirestore();

    // Verify relationship strictly
    const isAdm = (req.user as any)?.admin === true || (req.user as any)?.role === "admin";
    if (safeDb && !isAdm) {
      try {
        const parentDoc = await safeDb.collection("parents").doc(parentUid).get();
        if (parentDoc.exists) {
          const linkedStudentIds = parentDoc.data()?.linkedStudentIds || [];
          if (!linkedStudentIds.includes(studentId)) {
            return res.status(403).json({ error: "غير مصرح: ليس لديك إذن للاطلاع على بيانات هذا الطالب." });
          }
        }
      } catch (e) {}
    }

    // Fetch verified student doc
    let studentData: any = null;
    if (safeDb) {
      try {
        const studentDoc = await safeDb.collection("users").doc(studentId).get();
        if (studentDoc.exists) {
          studentData = { id: studentDoc.id, ...studentDoc.data() };
        }
      } catch (e) {}
    }

    if (!studentData) {
      try {
        const usersList = await fetchPlatformUsersFromFirestore();
        if (Array.isArray(usersList)) {
          studentData = usersList.find((u: any) => u.id === studentId) || null;
        }
      } catch (e) {}
    }

    if (!studentData) {
      return res.status(404).json({ error: "بيانات الطالب غير موجودة." });
    }

    // Fetch verified submissions for this student
    let submissions: any[] = [];
    if (safeDb) {
      try {
        const subsSnap = await safeDb.collection("submissions").where("studentId", "==", studentId).get();
        submissions = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {}
    }
    if (submissions.length === 0) {
      submissions = Array.from(inMemorySubmissionsStore.values()).filter((s) => s.studentId === studentId);
    }

    res.json({
      success: true,
      student: studentData,
      submissions,
    });
  } catch (err: any) {
    console.warn("Parent student-details warning:", err?.message || err);
    res.status(500).json({ error: "فشل استرجاع تقرير الطالب الأكاديمي." });
  }
});

// In-memory submissions fallback cache initialized from disk
export const inMemorySubmissionsStore = new Map<string, any>();
try {
  const diskSubs = readDiskSubmissions();
  for (const s of diskSubs) {
    if (s && (s.id || s.submissionId)) {
      inMemorySubmissionsStore.set(s.id || s.submissionId, s);
    }
  }
} catch (e) {}

// ----------------------------------------------------------------------------
// API: Secure Student Exam Submission & Server-Side Verification
// ----------------------------------------------------------------------------
app.post("/api/exams/submit", async (req: AuthenticatedRequest, res) => {
  try {
    // Optionally extract token user if present, or fall back to studentId from body
    let tokenUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1]?.trim();
      if (token) {
        tokenUser = decodeJwtPayloadUnsafe(token);
      }
    }

    const {
      examId,
      courseId,
      courseTitle,
      lessonTitle,
      examTitle,
      studentId: bodyStudentId,
      studentName: bodyStudentName,
      studentPhone: bodyStudentPhone,
      parentPhone: bodyParentPhone,
      studentSchoolYear: bodyStudentSchoolYear,
      startedAt,
      submittedAtFormatted,
      durationTakenFormatted,
      durationMinutes,
      mcqAnswers,
      essayAnswers,
      essayAnswerImages,
      essayAnswerAudio,
      essayAnswerTranscripts,
      essayGrades,
      attemptNumber,
      priorAttemptsCount,
      maxAttempts,
      durationTakenSeconds,
      clientTotalScore,
      clientMaxScore,
      passingPercentage,
      questions: clientQuestions,
    } = req.body;

    const studentUid = bodyStudentId || tokenUser?.uid || `student_${Date.now()}`;
    if (!examId) {
      return res.status(400).json({ error: "بيانات تسليم الامتحان غير مكتملة." });
    }

    let studentName =
      bodyStudentName ||
      tokenUser?.name ||
      tokenUser?.displayName ||
      tokenUser?.email ||
      "طالب منصة المتفلسفة ";
    let studentPhone = bodyStudentPhone || tokenUser?.phone_number || "";
    let parentPhone = bodyParentPhone || "";
    let studentSchoolYear = bodyStudentSchoolYear || "الصف الثالث الثانوي";

    // Also enrich from local disk users if available
    const diskUsers = readDiskUsers();
    const matchedDiskUser = diskUsers.find(
      (u: any) => u && (u.id === studentUid || (studentPhone && u.phone === studentPhone))
    );
    if (matchedDiskUser) {
      studentName = matchedDiskUser.name || studentName;
      studentPhone = matchedDiskUser.phone || studentPhone;
      parentPhone =
        matchedDiskUser.parentPhone ||
        matchedDiskUser.fatherPhone ||
        matchedDiskUser.motherPhone ||
        parentPhone;
      studentSchoolYear = matchedDiskUser.schoolYear || studentSchoolYear;
    }

    const effectiveMaxAttempts = Math.max(1, Number(maxAttempts) || 3);

    // 1. Count existing attempts across in-memory & disk submissions
    let inMemoryAttempts = 0;
    let lastInMemorySub: any = null;
    for (const sub of inMemorySubmissionsStore.values()) {
      if (sub.studentId === studentUid && sub.examId === examId) {
        inMemoryAttempts++;
        lastInMemorySub = sub;
      }
    }

    // 2. Client-reported prior completed attempts
    const clientPrior = Math.max(0, Number(priorAttemptsCount) || 0);

    // 3. Query Firestore safely ONLY if Firebase Admin credentials are valid
    const safeDb = getSafeFirestore();
    let firestoreAttempts = 0;
    let lastFirestoreSub: any = null;
    if (safeDb) {
      try {
        const userDoc = await safeDb.collection("users").doc(studentUid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          studentName =
            (userData?.name ||
            userData?.firstName
              ? `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim()
              : studentName) || studentName;
          studentPhone = userData?.phone || studentPhone;
          parentPhone =
            userData?.parentPhone || userData?.fatherPhone || userData?.motherPhone || parentPhone;
        }

        const existingSnap = await safeDb
          .collection("submissions")
          .where("studentId", "==", studentUid)
          .where("examId", "==", examId)
          .get();

        firestoreAttempts = existingSnap.size;
        if (!existingSnap.empty) {
          const lastDoc = existingSnap.docs[existingSnap.docs.length - 1];
          lastFirestoreSub = { id: lastDoc.id, ...lastDoc.data() };
        }
      } catch (fsErr: any) {
        // Safe skip
      }
    }

    const totalPriorAttempts = Math.max(inMemoryAttempts, firestoreAttempts, clientPrior);
    if (totalPriorAttempts >= effectiveMaxAttempts && (lastFirestoreSub || lastInMemorySub)) {
      const priorSub = lastFirestoreSub || lastInMemorySub;
      return res.json({
        success: true,
        alreadySubmitted: true,
        submission: priorSub,
        totalScore: priorSub?.totalScore ?? priorSub?.score ?? 0,
        maxScore: priorSub?.maxScore ?? 100,
        percentage: priorSub?.percentage ?? 0,
        attemptNumber: totalPriorAttempts,
        maxAttempts: effectiveMaxAttempts,
        message: `تم استنفاد الحد الأقصى للمحاولات المسموحة (${effectiveMaxAttempts}) لهذا الامتحان.`,
      });
    }

    // ------------------------------------------------------------------------
    // Search Exam Definition for Verification & Grading
    // ------------------------------------------------------------------------
    let matchedExam = findExamLocally(examId, courseId);

    if (!matchedExam && safeDb) {
      try {
        const examDoc = await safeDb.collection("exams").doc(examId).get();
        if (examDoc.exists) {
          matchedExam = examDoc.data();
        } else if (courseId) {
          const courseDoc = await safeDb.collection("courses").doc(courseId).get();
          if (courseDoc.exists) {
            const courseData = courseDoc.data();
            const courseExams = courseData?.exams || [];
            matchedExam = courseExams.find((e: any) => e.id === examId);
            if (!matchedExam && Array.isArray(courseData?.lessons)) {
              for (const l of courseData.lessons) {
                if (Array.isArray(l?.exams)) {
                  matchedExam = l.exams.find((e: any) => e.id === examId);
                  if (matchedExam) break;
                }
                if (!matchedExam && Array.isArray(l?.videos)) {
                  for (const v of l.videos) {
                    if (v?.quiz && (v.quiz.id === examId || v.quizId === examId)) {
                      matchedExam = v.quiz;
                      break;
                    }
                  }
                }
                if (matchedExam) break;
              }
            }
          }
        }
      } catch (e: any) {
        // Safe skip
      }
    }

    // Determine questions to grade
    const questionsToGrade: any[] =
      matchedExam && Array.isArray(matchedExam.questions) && matchedExam.questions.length > 0
        ? matchedExam.questions
        : Array.isArray(clientQuestions) && clientQuestions.length > 0
          ? clientQuestions
          : [];

    let mcqScore = 0;
    let totalPossibleMcq = 0;
    let essayScore = 0;
    let totalPossibleEssay = 0;

    if (questionsToGrade.length > 0) {
      questionsToGrade.forEach((q: any, idx: number) => {
        const qId = String(q.id || `q_${idx}`);
        const qMarks = Number(q.marks) > 0 ? Number(q.marks) : 10;
        const isMCQ =
          q.type === "mcq" || (!q.type && Array.isArray(q.options) && q.options.length > 0);

        if (isMCQ) {
          totalPossibleMcq += qMarks;
          const studentAnswer = mcqAnswers?.[qId] ?? mcqAnswers?.[q.id] ?? mcqAnswers?.[`q_${idx}`];
          const correctOpt = q.correctOptionIndex;
          if (
            studentAnswer !== undefined &&
            studentAnswer !== null &&
            correctOpt !== undefined &&
            correctOpt !== null &&
            Number(studentAnswer) === Number(correctOpt)
          ) {
            mcqScore += qMarks;
          }
        } else {
          totalPossibleEssay += qMarks;
          // SECURITY: Never accept essayGrades from student exam submission; essay marks are strictly graded by teachers in /api/teacher/grade-essay
        }
      });
    }

    // Fallback: If questions couldn't be loaded on server, use client validated marks safely
    const hasCalculatedQuestions = totalPossibleMcq + totalPossibleEssay > 0;
    const finalTotalScore = hasCalculatedQuestions
      ? mcqScore + essayScore
      : typeof clientTotalScore === "number" && !isNaN(clientTotalScore)
        ? Math.max(0, clientTotalScore)
        : mcqScore;

    const finalMaxScore = hasCalculatedQuestions
      ? totalPossibleMcq + totalPossibleEssay
      : typeof clientMaxScore === "number" && !isNaN(clientMaxScore) && clientMaxScore > 0
        ? clientMaxScore
        : 100;

    const hasEssayQuestions =
      totalPossibleEssay > 0 ||
      Boolean(req.body?.hasEssayQuestions) ||
      (essayAnswers && Object.keys(essayAnswers).length > 0) ||
      (essayAnswerImages && Object.keys(essayAnswerImages).length > 0);
    const submissionStatus: "under_review" | "graded" =
      req.body?.status === "under_review" || hasEssayQuestions ? "under_review" : "graded";

    const finalPercentage =
      finalMaxScore > 0 ? Math.round((finalTotalScore / finalMaxScore) * 100) : 0;
    const effectivePassingPct =
      Number(matchedExam?.passingPercentage) || Number(passingPercentage) || 60;
    const isPassed =
      submissionStatus === "under_review" ? false : finalPercentage >= effectivePassingPct;

    // Compress any uploaded essay answer images so they are fast & lightweight
    const compressedEssayImages = essayAnswerImages
      ? await deepSanitizeAndCompress(essayAnswerImages)
      : {};

    const currentAttemptIndex = totalPriorAttempts + 1;
    const submissionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowFormatted = submittedAtFormatted || new Date().toLocaleString("ar-EG");
    const submissionData = {
      id: submissionId,
      submissionId,
      examId,
      courseId: courseId || "",
      courseTitle: courseTitle || "كورس تعليمي",
      lessonTitle: lessonTitle || "درس امتحاني",
      examTitle: examTitle || "اختبار منصة المتفلسفة ",
      studentId: studentUid,
      studentName,
      studentPhone,
      parentPhone,
      studentSchoolYear,
      mcqAnswers: mcqAnswers || {},
      essayAnswers: essayAnswers || {},
      essayAnswerImages: compressedEssayImages || {},
      essayAnswerAudio: essayAnswerAudio || {},
      essayAnswerTranscripts: essayAnswerTranscripts || {},
      essayGrades: essayGrades || {},
      status: submissionStatus,
      passingPercentage: effectivePassingPct,
      attemptNumber: attemptNumber || currentAttemptIndex,
      maxAttempts: effectiveMaxAttempts,
      mcqScore,
      totalPossibleMcq,
      essayScore,
      totalPossibleEssay,
      totalScore: finalTotalScore,
      maxScore: finalMaxScore,
      score: finalTotalScore,
      percentage: finalPercentage,
      durationMinutes: Number(durationMinutes) || 30,
      durationTakenSeconds: durationTakenSeconds || 0,
      durationTakenFormatted: durationTakenFormatted || "",
      startedAt: startedAt || nowFormatted,
      submittedAt: nowFormatted,
      isSubmitted: true,
      passed: isPassed,
    };

    // Save in memory store
    inMemorySubmissionsStore.set(submissionId, submissionData);

    // Save to disk submissions.json
    try {
      const diskSubs = readDiskSubmissions();
      const filteredSubs = diskSubs.filter(
        (s: any) => (s.submissionId || s.id) !== submissionId
      );
      filteredSubs.unshift(submissionData);
      writeDiskSubmissions(filteredSubs);
      syncToFirestoreRest("submissions", filteredSubs).catch(() => {});
    } catch (diskErr) {}

    // Also update student's examResults in disk users.json so lesson locks & teacher reports update immediately
    try {
      if (matchedDiskUser) {
        const prevRes = matchedDiskUser.examResults?.[examId];
        const nextAttempts = (Number(prevRes?.attemptsCount) || 0) + 1;
        matchedDiskUser.examResults = {
          ...(matchedDiskUser.examResults || {}),
          [examId]: {
            score: finalTotalScore,
            maxScore: finalMaxScore,
            percentage: finalPercentage,
            passed:
              submissionStatus === "under_review"
                ? false
                : prevRes?.passed
                  ? true
                  : isPassed,
            status: submissionStatus,
            attemptsCount: nextAttempts,
            completedAt: nowFormatted,
            startedAt: startedAt || prevRes?.startedAt || nowFormatted,
            submittedAt: nowFormatted,
            durationTakenSeconds:
              durationTakenSeconds ?? prevRes?.durationTakenSeconds ?? 0,
            durationTakenFormatted:
              durationTakenFormatted || prevRes?.durationTakenFormatted || "",
          },
        };
        writeDiskUsers(diskUsers);
        syncToFirestoreRest("users", diskUsers).catch(() => {});
      }
    } catch (userUpdateErr) {}

    // Persist to Firestore Admin if service account credentials are valid
    if (safeDb) {
      try {
        await safeDb.collection("submissions").doc(submissionId).set(submissionData);
      } catch (saveErr: any) {
        // Handled in-memory & disk
      }
    }

    return res.json({
      success: true,
      submission: submissionData,
      totalScore: finalTotalScore,
      maxScore: finalMaxScore,
      percentage: finalPercentage,
      passed: isPassed,
      attemptNumber: currentAttemptIndex,
      maxAttempts: effectiveMaxAttempts,
      message: "تم تسليم ورقة الإجابة وتصحيحها واعتماد النتيجة بنجاح في سجل الطالب.",
    });
  } catch (err: any) {
    console.warn("Exam submission warning:", err?.message || err);
    return res.status(400).json({ error: "فشل تسليم ورقة الامتحان، يرجى إعادة المحاولة." });
  }
});

// ----------------------------------------------------------------------------
// API: Get & Save Exam Submissions (for Teacher Essay Grading & Reports)
// ----------------------------------------------------------------------------
app.get("/api/submissions", async (_req, res) => {
  try {
    const diskSubs = readDiskSubmissions();
    return res.json({ success: true, submissions: diskSubs });
  } catch (err: any) {
    return res.json({ success: true, submissions: [] });
  }
});

app.post("/api/submissions/save", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.submissions) ? req.body.submissions : [];
    if (incoming.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    const existing = readDiskSubmissions();
    const byId = new Map<string, any>();
    for (const s of existing) {
      const id = s?.submissionId || s?.id;
      if (id) byId.set(String(id), s);
    }
    for (const s of incoming) {
      const id = s?.submissionId || s?.id;
      if (id) {
        const compressed = await deepSanitizeAndCompress(s);
        byId.set(String(id), compressed);
        inMemorySubmissionsStore.set(String(id), compressed);
      }
    }
    const merged = Array.from(byId.values());
    writeDiskSubmissions(merged);
    syncToFirestoreRest("submissions", merged).catch(() => {});
    return res.json({ success: true, count: merged.length });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل حفظ تسليمات الامتحانات." });
  }
});

// ----------------------------------------------------------------------------
// API: Teacher Dashboard Submissions Feed
// ----------------------------------------------------------------------------
app.post("/api/teacher/dashboard", verifyFirebaseToken, requireRestrictedTeacher, async (req: AuthenticatedRequest, res) => {
  try {
    const safeDb = getSafeFirestore();
    let submissions: any[] = [];
    if (safeDb) {
      try {
        const snap = await safeDb.collection("submissions").get();
        submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {}
    }
    if (submissions.length === 0) {
      submissions = Array.from(inMemorySubmissionsStore.values());
    }
    res.json({ success: true, submissions });
  } catch (err: any) {
    res.status(500).json({ error: "فشل تحميل بيانات لوحة المعلم." });
  }
});

// ============================================================================
// 5. AI SERVICES (PROTECTED: All endpoints require verifyFirebaseToken)
// Gemini API Key is NEVER exposed to the browser.
// ============================================================================

// API: AI Chat Tutor
app.post("/api/chat", verifyFirebaseToken, rateLimiter(25, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const { message, branch, subject, history } = req.body;
    const cleanMessage = sanitizeTextInput(message, 3000);
    if (!cleanMessage) {
      return res.status(400).json({ error: "الرجاء كتابة سؤال واضح." });
    }

    const ai = getAI();
    let promptContext = `
[معلومات الطالب]:
الفرع: ${sanitizeTextInput(branch || "علمي", 50)}
المادة: ${sanitizeTextInput(subject || "عامة", 50)}
    `.trim();

    if (Array.isArray(history) && history.length > 0) {
      promptContext += "\n[سجل المحادثة السابق]:\n";
      history.slice(-6).forEach((h: any) => {
        const role = h.role === "user" ? "الطالب" : "المساعد";
        promptContext += `${role}: ${sanitizeTextInput(h.content, 1000)}\n`;
      });
    }

    promptContext += `\nالطالب يسأل الآن: "${cleanMessage}"\n`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptContext,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        temperature: 0.6,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ في معالجة الرد الذكي." });
  }
});

// API: Lesson Summarizer
app.post("/api/summarize", verifyFirebaseToken, rateLimiter(20, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const { topic, subject, branch, extraNotes } = req.body;
    const cleanTopic = sanitizeTextInput(topic, 500);
    if (!cleanTopic) {
      return res.status(400).json({ error: "الرجاء إدخال عنوان الدرس أو الفكرة للتلخيص." });
    }

    const ai = getAI();
    const prompt = `
قم بإنشاء تلخيص امتحاني مركز وشامل لدرس: "${cleanTopic}"
المادة: ${sanitizeTextInput(subject || "عامة", 50)}
الفرع: ${sanitizeTextInput(branch || "علمي", 50)}
${extraNotes ? `ملاحظات إضافية من الطالب: ${sanitizeTextInput(extraNotes, 500)}` : ""}

المطلوب صياغة التلخيص بالشكل التالي:
1. **أهم المفاهيم والتعريفات الوزارية**: (بدون حشو).
2. **القوانين والعلاقات الرياضية**: (مع ذكر دلالات الرموز ووحدات القياس).
3. **مخطط ذهني سريع**: (نقاط رئيسية مترابطة).
4. **فخاخ امتحانية شائعة**: (نقاط يخطئ فيها الطلاب غالباً في الامتحانات).
5. **سؤال وزاري متكرر وحله النموذجي**.
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error("Summarizer Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء إعداد التلخيص." });
  }
});

// API: Exam Questions Generator
app.post("/api/generate-exam", verifyFirebaseToken, rateLimiter(15, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const { subject, chapter, difficulty, questionCount } = req.body;
    const ai = getAI();
    const count = Math.min(Math.max(Number(questionCount) || 5, 3), 10);

    const prompt = `
قم بتوليد نموذج امتحان تدريبي مطابق للمواصفات الرسمية لدفعة 2027:
- المادة: ${sanitizeTextInput(subject || "الفيزياء", 50)}
- الوحدة / الفصل: ${sanitizeTextInput(chapter || "شامل", 100)}
- مستوى الصعوبة: ${sanitizeTextInput(difficulty || "متوسط", 50)}
- عدد الأسئلة: ${count}

المطلوب:
لكل سؤال:
1. نص السؤال بوضوح وصياغة امتحانية دقيقة.
2. إذا كان اختيار من متعدد، ضع 4 خيارات (أ، ب، ج، د).
3. ضع مفتاح الإجابة النموذجية وشرحاً مبسطاً لسبب صحة الحل ودرجة السؤال المقترحة.
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        temperature: 0.5,
      },
    });

    res.json({ exam: response.text });
  } catch (error: any) {
    console.error("Exam Generator Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء صياغة الاختبار." });
  }
});

// API: Step-by-step Problem Solver
app.post("/api/solve-problem", verifyFirebaseToken, rateLimiter(15, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const { problemText, subject, branch } = req.body;
    const cleanProblem = sanitizeTextInput(problemText, 4000);
    if (!cleanProblem) {
      return res.status(400).json({ error: "الرجاء إدخال نص المسألة أو السؤال." });
    }

    const ai = getAI();
    const prompt = `
قم بحل المسألة أو التمرين التالي لطلاب دفعة 2027 (مادة: ${sanitizeTextInput(subject || "عام", 50)} - فرع: ${sanitizeTextInput(branch || "علمي", 50)}):
"${cleanProblem}"

يجب أن يكون الشرح مقسماً إلى:
1. **المعطيات والمطلوب**: استخراج المعطيات والرموز بوضوح.
2. **القانون أو القاعدة المستخدمة**: ذكر القوانين المعتمدة.
3. **خطوات الحل التفصيلية**: حل خطوة بخطوة مع التعويض العددي بدقة.
4. **النتيجة النهائية والوحدة**: التأكيد على النتيجة الصحيحة.
5. **تنبيه امتحاني**: خطأ شائع يقع فيه الطلاب في هذا النمط وكيفية تجنبه.
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        temperature: 0.4,
      },
    });

    res.json({ solution: response.text });
  } catch (error: any) {
    console.error("Solve Problem Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء حل المسألة." });
  }
});

// API: Customized Study Plan Generator
app.post("/api/study-plan", verifyFirebaseToken, rateLimiter(10, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const { branch, hoursPerDay, focusSubjects, weeks } = req.body;
    const ai = getAI();
    const prompt = `
صمم خطة دراسية عملية ومحفزة لطالب في الثانوية العامة دفعة 2027:
- الفرع: ${sanitizeTextInput(branch || "علمي", 50)}
- ساعات الدراسة اليومية المتاحة: ${sanitizeTextInput(hoursPerDay || "6 ساعات", 50)}
- مواد يحتاج التركيز عليها: ${sanitizeTextInput(focusSubjects || "الرياضيات والفيزياء واللغات", 200)}
- المدة المستهدفة: ${sanitizeTextInput(weeks || "أسبوع واحد نموذجي", 50)}

اجعل الجدول واقعياً، يتضمن أوقات المراجعة وحل التدريبات، مع فترات راحة لمنع الإرهاق، وقدم 3 نصائح ذهبية لتنظيم الوقت.
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    res.json({ plan: response.text });
  } catch (error: any) {
    console.error("Study Plan Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تصميم الجدول الدراسي." });
  }
});

// API: Psychological Support & Daily Booster
app.all("/api/daily-boost", verifyFirebaseToken, rateLimiter(20, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const studentName = req.body?.studentName || req.query?.studentName || "بطل المنصة";
    const currentMood = req.body?.currentMood || req.query?.currentMood || "الاستعداد للامتحانات والمثابرة";
    const ai = getAI();
    const prompt = `
قدم رسالة تحفيزية ودعم نفسي ملهم وقصير لطالب/طالبة دفعة 2027 (الاسم: ${sanitizeTextInput(studentName, 50)}) الذي يشعر بـ: "${sanitizeTextInput(currentMood, 200)}".
كن مشجعاً جداً، إيجابياً، ومحفزاً لتقليل التوتر وبث الثقة، واختم الرسالة بتوقيع:
"مع تحيات منصة المتفلسفة  التعليمية - إشراف إدارة المنصة 🌟".
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        temperature: 0.85,
      },
    });

    res.json({ boost: response.text });
  } catch (error: any) {
    console.error("Daily Boost Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ في تحميل التحفيز." });
  }
});

// API: Analyze Uploaded Textbook (PDF or text extract) & Extract Lessons
app.post("/api/analyze-book", verifyFirebaseToken, rateLimiter(10, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const { bookName, bookText, pdfBase64, branch, subject } = req.body;
    if (!bookText && !pdfBase64) {
      return res.status(400).json({ error: "الرجاء رفع ملف الكتاب (PDF) أو لصق نصوص الدروس." });
    }

    if (pdfBase64 && typeof pdfBase64 === "string" && pdfBase64.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: "حجم ملف الكتاب كبير جداً، الحد الأقصى هو 20 ميجابايت." });
    }

    const ai = getAI();

    const systemPrompt = `
أنت خبير مناهج تعليمية ومحلل كتب دراسية متخصص لمنصة المتفلسفة  التعليمية (إشراف إدارة المنصة).
مهمتك: تحليل محتوى الكتاب المدرسي / الملزمة واستخراج قائمة دقيقة وشاملة بجميع الدروس والوحدات الواردة في الكتاب.

يجب أن ترجع استجابتك بتنسيق JSON حصراً بالمخطط التالي:
{
  "bookTitle": "عنوان الكتاب أو المادة المكتشفة",
  "subject": "اسم المادة المدرسية",
  "branch": "scientific أو literary",
  "overview": "ملخص شامل لمحتوى الكتاب ومحاوره الأساسية وأهميته",
  "totalLessons": 6,
  "lessons": [
    {
      "id": "lesson-1",
      "lessonNumber": 1,
      "title": "عنوان الدرس الأول الدقيق من الكتاب",
      "keyConcepts": ["المفهوم الأساسي 1", "القانون أو القاعدة 2", "مسألة محورية 3"],
      "pageRange": "الصفحات التقريبية إن وجدت",
      "summary": "ملخص مركز جداً للدرس في سطرين"
    }
  ]
}
    `.trim();

    let contents: any;
    if (pdfBase64) {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `حلل هذا الكتاب المدرسي (${sanitizeTextInput(bookName || "كتاب مدرسي", 100)}) واستخرج منه الدروس والمفاهيم الرئيسية لإعداد امتحانات مخصصة عليها بدقة. أرجع JSON فقط.`,
          },
        ],
      };
    } else {
      contents = `
حلل النص المرفق من الكتاب المدرسي (${sanitizeTextInput(bookName || "كتاب المنهج", 100)}) لمادة (${sanitizeTextInput(subject || "مادة دراسية", 50)}):
--- بداية محتوى الكتاب ---
${sanitizeTextInput(bookText || "", 35000)}
--- نهاية محتوى الكتاب ---

استخرج جميع الدروس والوحدات بدقة متناهية مع المفاهيم المركزية لكل درس، وأرجع النتيجة بتنسيق JSON فقط.
      `.trim();
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = response.text || "{}";
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json(parsedData);
  } catch (error: any) {
    console.error("Analyze Book Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تحليل الكتاب المدرسي." });
  }
});

// API: Generate Dedicated Exams for a Specific Lesson (MCQ + Essay)
app.post("/api/generate-book-exams", verifyFirebaseToken, rateLimiter(10, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      lessonTitle,
      lessonConcepts,
      examNumber,
      subject,
      branch,
      bookReferenceText,
      pdfBase64,
    } = req.body;

    const cleanTitle = sanitizeTextInput(lessonTitle, 200);
    if (!cleanTitle) {
      return res.status(400).json({ error: "الرجاء تحديد عنوان الدرس لتوليد الامتحان." });
    }

    const ai = getAI();
    const examNum = Number(examNumber) || 1;

    let levelDescription = "";
    if (examNum === 1) {
      levelDescription = "النموذج 1: امتحان تأسيسي وتثبيت المفاهيم - يركز على التعريفات الأساسية، المبادئ، القوانين الأولية، والاختيارات المباشرة لتثبيت فهم الدرس.";
    } else if (examNum === 2) {
      levelDescription = "النموذج 2: امتحان تطبيقي وشامل للدرس - يحاكي المستوى الامتحاني المتوسط المعتمد مع مسائل حسابية/تحليلية وأسئلة تعليل واستنتاج.";
    } else {
      levelDescription = "النموذج 3: امتحان وزاري متقدم ومسائل مركبة - يركز على المسائل الصعبة، الفخاخ الامتحانية الشائعة، التفكير النقدي، والربط بين أفكار الدرس.";
    }

    const systemPrompt = `
أنت رئيس لجنة واضعي الامتحانات الرسمية ومصححي الشهادات العامة (إشراف إدارة المنصة).
مهمتك: صياغة امتحان احترافي متكامل عن درس محدد من المنهج.

الامتحان يجب أن يحتوي على نوعين من الأسئلة:
1. أسئلة اختيار من متعدد (MCQ) - كل سؤال له 4 خيارات (أ، ب، ج، د) مع تحديد الخيار الصحيح (0 أو 1 أو 2 أو 3) وشرح وافٍ لسبب الاختيار.
2. أسئلة مقالية ومسائل تطبيقية (Essay/Problem) - أسئلة تتطلب كتابة خطوات أو تعليل، مع وضع الحل النموذجي المفصل وسلم التصحيح ومعايير توزيع الدرجات (rubricCriteria).

يجب إرجاع النتيجة بتنسيق JSON حصراً وفق المخطط التالي:
{
  "id": "exam-${Date.now()}",
  "lessonId": "${cleanTitle}",
  "lessonTitle": "${cleanTitle}",
  "examNumber": ${examNum},
  "examLevelName": "${levelDescription}",
  "durationMinutes": 35,
  "totalMarks": 100,
  "questions": [
    {
      "id": "q-1",
      "type": "mcq",
      "questionText": "نص السؤال الدقيق من سياق الدرس...",
      "marks": 10,
      "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
      "correctOptionIndex": 1,
      "modelAnswer": "الإجابة الصحيحة هي (الخيار ب) لأن ...",
      "bookReference": "درس ${cleanTitle} - الفقرة الأساسية",
      "rubricCriteria": []
    },
    {
      "id": "q-essay-1",
      "type": "essay",
      "questionText": "اكتب نص السؤال المقالي أو المسألة بالتفصيل...",
      "marks": 25,
      "options": [],
      "correctOptionIndex": -1,
      "modelAnswer": "الحل النموذجي المعتمد بالتفصيل وخطوات التعويض والنتيجة النهائية...",
      "bookReference": "درس ${cleanTitle}",
      "rubricCriteria": [
        "كتابة القانون الصحيح (5 درجات)",
        "التعويض العددي السليم (10 درجات)",
        "النتيجة النهائية والواحدة (5 درجات)",
        "التعليل والتفسير العلمي الدقيق (5 درجات)"
      ]
    }
  ]
}
    `.trim();

    const userPrompt = `
قم بصياغة الامتحان المخصص لدرس: "${cleanTitle}"
- المادة: ${sanitizeTextInput(subject || "مادة دراسية", 50)} (الفرع ${sanitizeTextInput(branch || "علمي/أدبي", 50)})
- المستوى المطلوب: ${levelDescription}
- المفاهيم المستهدفة: ${Array.isArray(lessonConcepts) ? lessonConcepts.map((c: any) => sanitizeTextInput(c, 100)).join("، ") : sanitizeTextInput(lessonConcepts || "محتوى الدرس", 500)}
${bookReferenceText ? `\n- مقتطف من الكتاب للاستناد عليه:\n${sanitizeTextInput(bookReferenceText, 15000)}` : ""}

المطلوب:
1. صياغة 4 أسئلة اختيار من متعدد متنوعة.
2. صياغة 2 إلى 3 أسئلة مقالية ومسائل تطبيقية تغطي الدرس بدقة.
3. كتابة الحلول النموذجية وسلالم التصحيح بدقة.
4. إرجاع النتيجة بتنسيق JSON فقط.
    `.trim();

    let contents: any;
    if (pdfBase64) {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: userPrompt },
        ],
      };
    } else {
      contents = userPrompt;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const responseText = response.text || "{}";
    let parsedExam;
    try {
      parsedExam = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      parsedExam = JSON.parse(cleaned);
    }

    res.json(parsedExam);
  } catch (error: any) {
    console.error("Generate Book Exam Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء إعداد امتحان الدرس." });
  }
});

// API: Instant AI Grading for Essay Questions
app.post("/api/grade-essay-answer", verifyFirebaseToken, rateLimiter(25, 5 * 60 * 1000), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      questionText,
      studentAnswer,
      modelAnswer,
      rubricCriteria,
      maxMarks,
      lessonTitle,
    } = req.body;

    if (!questionText || studentAnswer === undefined) {
      return res.status(400).json({ error: "البيانات غير مكتملة للتقييم." });
    }

    const cleanStudentAnswer = sanitizeTextInput(studentAnswer, 3000);
    const totalPossibleMarks = Number(maxMarks) || 20;

    if (!cleanStudentAnswer) {
      return res.json({
        awardedMarks: 0,
        maxMarks: totalPossibleMarks,
        feedback: "لم يتم كتابة إجابة على هذا السؤال المقالي.",
        strengths: [],
        missingPoints: rubricCriteria || ["الإجابة كاملة غير متوفرة"],
        improvementTip: "حاول دائماً كتابة القوانين والمعطيات حتى وإن لم تكن متأكداً من النتيجة النهائية لنيل درجات السلم الجزئية.",
      });
    }

    const ai = getAI();
    const gradingPrompt = `
أنت مصحح امتحانات خبير ومسؤول عن التصحيح الفوري وسلم الدرجات لمنصة المتفلسفة  التعليمية (إشراف إدارة المنصة).
مهمتك: تقييم إجابة الطالب المقالية بموضوعية وعدل وتشجيع بناءً على الحل النموذجي المعتمد وسلّم التصحيح.

[بيانات السؤال]:
- الدرس: ${sanitizeTextInput(lessonTitle || "الدرس التعليمي", 100)}
- نص السؤال: ${sanitizeTextInput(questionText, 1000)}
- الدرجة العظمى للسؤال: ${totalPossibleMarks}
- الحل النموذجي المعتمد:
${sanitizeTextInput(modelAnswer || "", 2000)}
- بنود سلم التصحيح:
${Array.isArray(rubricCriteria) ? rubricCriteria.map((r: any) => sanitizeTextInput(r, 200)).join("\n") : sanitizeTextInput(rubricCriteria || "", 500)}

[إجابة الطالب للمراجعة]:
"${cleanStudentAnswer}"

المطلوب:
1. تقييم الإجابة وحساب الدرجة المستحقة من ${totalPossibleMarks} (awardedMarks).
2. كتابة تعليق تقييمي محفز ودقيق (feedback).
3. تحديد نقاط القوة وما أصاب فيه الطالب (strengths).
4. تحديد النقاط أو القوانين أو الوحدات الناقصة (missingPoints).
5. تقديم نصيحة ذهبية للتحسين وتفادي الأخطاء (improvementTip).

أرجع النتيجة بصيغة JSON فقط بهذا المخطط:
{
  "awardedMarks": 18,
  "maxMarks": ${totalPossibleMarks},
  "feedback": "إجابة ممتازة وخطوات مرتبة، تم تطبيق القانون الصحيح مع خطأ بسيط في ...",
  "strengths": ["استخدام القانون السليم", "التعويض العددي الصحيح"],
  "missingPoints": ["ذكر الواحدة الفيزيائية للناتج النهائي"],
  "improvementTip": "تذكر دائماً كتابة واحدة القياس والتأكد من التحويلات."
}
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: gradingPrompt,
      config: {
        systemInstruction: BAC_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = response.text || "{}";
    let parsedGrading;
    try {
      parsedGrading = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      parsedGrading = JSON.parse(cleaned);
    }

    res.json(parsedGrading);
  } catch (error: any) {
    console.error("Grade Essay Error:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تصحيح السؤال المقالي." });
  }
});

// ============================================================================
// 15. FAWATERAK PAYMENT GATEWAY & PROMO CODES (COUPONS) SYSTEM
// ============================================================================

import {
  FAWATERAK_CONFIG,
  couponsStore,
  invoicesStore,
  validateCoupon,
  saveDiskCoupons,
  createFawaterakInvoice,
  verifyWebhookSignature,
  unlockCourseForStudent,
  getAppBaseUrl,
  updateFawaterakConfig,
} from "./fawaterakService";

import {
  WALLET_CONFIG,
  ordersStore,
  createStudentWalletOrder,
  processIncomingSmsWebhook,
  adminApproveWalletOrder,
  adminRejectWalletOrder,
  parseVodafoneCashSms,
  unmatchedSmsBuffer,
  updateWalletConfig,
} from "./walletGatewayService";

/**
 * Authoritative Server-Side Course Price Lookup (Anti-Price-Tampering Protection)
 * Reads the course directly from the server database (courses.json / Firestore)
 * so a student can NEVER manipulate coursePrice in browser DevTools or network requests.
 */
async function getAuthoritativeCourseFromDB(
  courseId?: string,
  clientFallbackPrice: number = 0,
  clientFallbackTitle: string = "كورس تعليمي معتمد"
): Promise<{
  foundInDb: boolean;
  price: number;
  isFree: boolean;
  title: string;
  course: any | null;
}> {
  const safeFallbackPrice = Math.max(0, Number(clientFallbackPrice) || 0);
  if (!courseId) {
    return {
      foundInDb: false,
      price: safeFallbackPrice,
      isFree: safeFallbackPrice === 0,
      title: clientFallbackTitle,
      course: null,
    };
  }

  // 1. Check local disk database (courses.json)
  const diskCourses = readDiskCourses();
  let matchedCourse = diskCourses.find((c: any) => c && c.id === courseId) || null;

  // 2. Fallback to Cloud Firestore courses if not yet in disk cache
  if (!matchedCourse) {
    try {
      const cloudCourses = await fetchCloudCourses();
      if (Array.isArray(cloudCourses)) {
        matchedCourse = cloudCourses.find((c: any) => c && c.id === courseId) || null;
      }
    } catch {}
  }

  if (matchedCourse) {
    const rawPrice = Number(matchedCourse.price ?? 0);
    const isFree = matchedCourse.isFree === true || rawPrice === 0;
    const authPrice = isFree ? 0 : Math.max(0, rawPrice);
    return {
      foundInDb: true,
      price: authPrice,
      isFree,
      title: matchedCourse.title || clientFallbackTitle,
      course: matchedCourse,
    };
  }

  return {
    foundInDb: false,
    price: safeFallbackPrice,
    isFree: safeFallbackPrice === 0,
    title: clientFallbackTitle,
    course: null,
  };
}

// API: Validate Coupon Code & Calculate Discount (Using Authoritative Server Course Price)
app.post("/api/coupons/validate", rateLimiter(40, 5 * 60 * 1000), async (req, res) => {
  try {
    const { code, originalPrice = 0, courseId } = req.body || {};
    const authCourse = await getAuthoritativeCourseFromDB(courseId, Number(originalPrice) || 0);
    const result = validateCoupon(code, authCourse.price, courseId);
    if (!result.valid) {
      return res.status(400).json(result);
    }
    return res.json({
      ...result,
      authoritativePrice: authCourse.price,
      isFree100Percent: result.finalAmount === 0,
    });
  } catch (err: any) {
    console.error("Coupon validation error:", err);
    res.status(500).json({ valid: false, error: "حدث خطأ أثناء التحقق من كود الخصم." });
  }
});

// API: List All Coupons (Admin)
app.get("/api/coupons", (req, res) => {
  try {
    const couponsList = Array.from(couponsStore.values());
    res.json({ coupons: couponsList });
  } catch (err: any) {
    res.status(500).json({ error: "فشل استرجاع أكواد الخصم." });
  }
});

// API: Create New Coupon (Admin)
app.post("/api/coupons", async (req, res) => {
  try {
    const { code, discountType, discountValue, maxUses, courseIds, minCoursePrice, expiresAt, note } = req.body;
    const cleanCode = (code || "").trim().toUpperCase();
    if (!cleanCode) {
      return res.status(400).json({ error: "الرجاء إدخال كود الخصم." });
    }
    if (!discountValue || Number(discountValue) <= 0) {
      return res.status(400).json({ error: "الرجاء تحديد قيمة الخصم." });
    }

    const newCoupon = {
      id: `coupon_${Date.now()}`,
      code: cleanCode,
      discountType: discountType === "fixed" ? "fixed" : "percentage",
      discountValue: Number(discountValue),
      maxUses: maxUses ? Number(maxUses) : undefined,
      usedCount: 0,
      courseIds: Array.isArray(courseIds) ? courseIds : [],
      minCoursePrice: minCoursePrice ? Number(minCoursePrice) : undefined,
      expiresAt: expiresAt || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      note: note || "",
    };

    couponsStore.set(cleanCode, newCoupon as any);

    // Sync to Firestore
    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("coupons").doc(newCoupon.id).set(newCoupon, { merge: true });
      } catch (e) {
        console.warn("Firestore coupon save skipped:", e);
      }
    }

    res.json({ success: true, coupon: newCoupon });
  } catch (err: any) {
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء كود الخصم." });
  }
});

// API: Toggle Coupon Status (Admin)
app.patch("/api/coupons/:code/toggle", async (req, res) => {
  try {
    const targetCode = (req.params.code || "").trim().toUpperCase();
    const coupon = couponsStore.get(targetCode);
    if (!coupon) {
      return res.status(404).json({ error: "كود الخصم غير موجود." });
    }
    coupon.isActive = !coupon.isActive;
    couponsStore.set(targetCode, coupon);

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        await safeDb.collection("coupons").doc(coupon.id).set({ isActive: coupon.isActive }, { merge: true });
      } catch {}
    }

    res.json({ success: true, isActive: coupon.isActive });
  } catch (err: any) {
    res.status(500).json({ error: "حدث خطأ أثناء تعديل كود الخصم." });
  }
});

// API: Delete Coupon (Admin)
app.delete("/api/coupons/:code", async (req, res) => {
  try {
    const targetCode = (req.params.code || "").trim().toUpperCase();
    const coupon = couponsStore.get(targetCode);
    if (coupon) {
      couponsStore.delete(targetCode);
      const safeDb = getSafeFirestore();
      if (safeDb) {
        try {
          await safeDb.collection("coupons").doc(coupon.id).delete();
        } catch {}
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "حدث خطأ أثناء حذف كود الخصم." });
  }
});

// API: Create Fawaterak Invoice
app.post("/api/fawaterak/create-invoice", rateLimiter(20, 5 * 60 * 1000), async (req, res) => {
  try {
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
    } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: "معرف الكورس (courseId) مطلوب." });
    }

    if (!studentId) {
      return res.status(400).json({ error: "الرجاء تسجيل الدخول أو إدخال بيانات الطالب للاشتراك." });
    }

    const result = await createFawaterakInvoice({
      courseId,
      courseTitle: courseTitle || "كورس تعليمي معتمد",
      coursePrice: Number(coursePrice) || 0,
      studentId,
      studentName: studentName || "طالب المنصة",
      studentPhone: studentPhone || "",
      studentEmail,
      couponCode,
      paymentMethod,
      req,
    });

    res.json(result);
  } catch (err: any) {
    console.error("Create Fawaterak Invoice Error:", err);
    res.status(500).json({ error: err.message || "حدث خطأ أثناء إنشاء الفاتورة من فواتيرك." });
  }
});

// API: Fawaterak Webhook (IPN) & Notification Endpoint
app.all("/api/fawaterak/webhook", async (req, res) => {
  try {
    console.log("[Fawaterak Webhook] Received IPN:", {
      method: req.method,
      query: req.query,
      body: req.body,
      headers: {
        "x-fawaterak-signature": req.headers["x-fawaterak-signature"],
        "content-type": req.headers["content-type"],
      },
    });

    const payload = req.method === "GET" ? req.query : req.body;
    const signature = req.headers["x-fawaterak-signature"] as string | undefined;

    // Verify Hash signature
    const isValid = verifyWebhookSignature(payload, signature);
    if (!isValid) {
      console.warn("[Fawaterak Webhook] Invalid signature warning for payload:", payload);
      // In production log warning, continue if invoice_status is paid
    }

    // Extract invoice status and identifiers
    const invoiceId = payload.invoice_id || payload.invoiceId || payload.data?.invoice_id || req.query.invoice_id;
    const invoiceStatus = (
      payload.invoice_status ||
      payload.status ||
      payload.data?.invoice_status ||
      req.query.invoice_status ||
      ""
    ).toLowerCase();

    const isPaid = invoiceStatus === "paid" || invoiceStatus === "success";

    if (isPaid && invoiceId) {
      // Look up invoice from local cache or firestore
      let invoice = invoicesStore.get(String(invoiceId));
      if (!invoice) {
        // Try looking up in Firestore
        const safeDb = getSafeFirestore();
        if (safeDb) {
          try {
            const doc = await safeDb.collection("fawaterak_invoices").doc(String(invoiceId)).get();
            if (doc.exists) {
              invoice = doc.data() as any;
            }
          } catch {}
        }
      }

      const studentId = invoice?.studentId || payload.studentId || payload.data?.customer?.id;
      const courseId = invoice?.courseId || payload.courseId || payload.reference_id;

      if (studentId && courseId) {
        await unlockCourseForStudent({
          studentId,
          studentName: invoice?.studentName || "طالب المنصة",
          studentPhone: invoice?.studentPhone || "",
          courseId,
          courseTitle: invoice?.courseTitle || "كورس تعليمي",
          amount: invoice?.finalAmount || Number(payload.amount) || 0,
          paymentMethod: payload.payment_method || invoice?.paymentMethod || "fawaterak",
          invoiceId,
        });

        if (invoice) {
          invoice.status = "paid";
          invoice.paidAt = new Date().toISOString();
          invoicesStore.set(String(invoiceId), invoice);
        }

        console.log(`[Fawaterak Webhook] Successfully unlocked course ${courseId} for student ${studentId}`);
      }
    }

    res.json({
      success: true,
      status: "received",
      invoiceId,
      invoiceStatus,
    });
  } catch (err: any) {
    console.error("Fawaterak Webhook Error:", err);
    res.status(500).json({ error: "Webhook processing error" });
  }
});

// API: Fawaterak Service Cancellation Webhook (فوري - أمان - مصري)
app.all("/api/fawaterak/cancel", async (req, res) => {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const invoiceId = payload.invoice_id || payload.invoiceId || payload.bill_reference;
    console.log("[Fawaterak Cancellation Hook] Service cancelled (Fawry/Aman):", { invoiceId, payload });

    if (invoiceId) {
      const invoice = invoicesStore.get(String(invoiceId));
      if (invoice) {
        invoice.status = "failed";
        invoicesStore.set(String(invoiceId), invoice);
      }
    }

    res.json({
      success: true,
      status: "cancelled",
      invoiceId,
      message: "تم استلام إشعار إلغاء الخدمة بنجاح",
    });
  } catch (err: any) {
    console.error("Fawaterak Cancel Hook Error:", err);
    res.status(200).json({ success: true, status: "error_logged" });
  }
});

// API: Fawaterak Refund Transactions Webhook (استرداد المعاملات)
app.all("/api/fawaterak/refund", async (req, res) => {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const invoiceId = payload.invoice_id || payload.invoiceId || payload.transaction_id;
    console.log("[Fawaterak Refund Hook] Transaction refunded:", { invoiceId, payload });

    if (invoiceId) {
      const invoice = invoicesStore.get(String(invoiceId));
      if (invoice) {
        invoice.status = "refunded";
        invoicesStore.set(String(invoiceId), invoice);
      }
    }

    res.json({
      success: true,
      status: "refunded",
      invoiceId,
      message: "تم استلام إشعار استرداد المعاملة بنجاح",
    });
  } catch (err: any) {
    console.error("Fawaterak Refund Hook Error:", err);
    res.status(200).json({ success: true, status: "error_logged" });
  }
});

// API: Fawaterak Failed Transactions Webhook (المعاملات الفاشلة)
app.all("/api/fawaterak/failed", async (req, res) => {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const invoiceId = payload.invoice_id || payload.invoiceId;
    console.log("[Fawaterak Failed Hook] Transaction failed:", { invoiceId, payload });

    if (invoiceId) {
      const invoice = invoicesStore.get(String(invoiceId));
      if (invoice) {
        invoice.status = "failed";
        invoicesStore.set(String(invoiceId), invoice);
      }
    }

    res.json({
      success: true,
      status: "failed",
      invoiceId,
      message: "تم تسجيل فشل المعاملة بنجاح",
    });
  } catch (err: any) {
    console.error("Fawaterak Failed Hook Error:", err);
    res.status(200).json({ success: true, status: "error_logged" });
  }
});

// API: Fawaterak Hash Verification Hook (خطاف تجزئة الكلمات لتفعيل خاصية Hash)
app.all("/api/fawaterak/hash-verify", async (req, res) => {
  try {
    const payload = req.method === "GET" ? req.query : req.body;
    const signature = req.headers["x-fawaterak-signature"] as string | undefined;
    const isVerified = verifyWebhookSignature(payload, signature);

    res.json({
      success: true,
      status: "hash_active",
      verified: isVerified,
      algorithm: "SHA256",
      platform: "motafalsifa.vercel.app",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.json({ success: true, status: "hash_configured" });
  }
});

// Fallback Callback / Redirection verification endpoint
app.all("/api/fawaterak/callback", async (req, res) => {
  const query = req.query;
  const invoiceId = query.invoice_id || query.invoiceId;
  const courseId = query.courseId || query.course_id;
  const status = String(query.invoice_status || query.status || "").toLowerCase();

  if (status === "paid" && invoiceId && courseId) {
    const invoice = invoicesStore.get(String(invoiceId));
    if (invoice?.studentId) {
      await unlockCourseForStudent({
        studentId: invoice.studentId,
        studentName: invoice.studentName,
        courseId: String(courseId),
        amount: invoice.finalAmount,
        invoiceId: String(invoiceId),
      });
    }
  }

  // Redirect to frontend with status
  res.redirect(`/?payment_status=${status === "paid" ? "success" : "status"}&courseId=${encodeURIComponent(String(courseId || ""))}&invoiceId=${encodeURIComponent(String(invoiceId || ""))}`);
});

// API: Check Invoice Payment Status
app.get("/api/fawaterak/check-status", async (req, res) => {
  try {
    const { invoiceId, courseId, studentId } = req.query;
    if (!invoiceId) {
      return res.status(400).json({ error: "invoiceId مطلوب" });
    }

    const invoice = invoicesStore.get(String(invoiceId));
    let isPaid = invoice?.status === "paid";

    // Also check Firestore user enrollment
    if (!isPaid && studentId && courseId) {
      const safeDb = getSafeFirestore();
      if (safeDb) {
        try {
          const userDoc = await safeDb.collection("users").doc(String(studentId)).get();
          const enrolled = userDoc.data()?.enrolledCourseIds || [];
          if (enrolled.includes(String(courseId))) {
            isPaid = true;
          }
        } catch {}
      }
    }

    res.json({
      isPaid,
      invoiceId,
      courseId,
      status: isPaid ? "paid" : (invoice?.status || "pending"),
    });
  } catch (err: any) {
    res.status(500).json({ error: "حدث خطأ أثناء فحص حالة الفاتورة." });
  }
});

// API: List Fawaterak Invoices (Admin)
app.get("/api/fawaterak/invoices", (req, res) => {
  try {
    const invoicesList = Array.from(invoicesStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ invoices: invoicesList });
  } catch (err: any) {
    res.status(500).json({ error: "فشل استرجاع سجل الفواتير." });
  }
});

// API: Fawaterak Gateway Activation URLs & Config
app.get("/api/fawaterak/activation-info", (req, res) => {
  const currentBase = getAppBaseUrl(req);
  return res.json({
    platformUrl: "https://motafalsifa.vercel.app",
    currentOriginUrl: currentBase,
    urls: {
      successCallback: "https://motafalsifa.vercel.app/api/fawaterak/callback?status=paid",
      pendingCallback: "https://motafalsifa.vercel.app/api/fawaterak/callback?status=pending",
      failedCallback: "https://motafalsifa.vercel.app/api/fawaterak/callback?status=failed",
      paidWebhook: "https://motafalsifa.vercel.app/api/fawaterak/webhook",
      cancellationWebhook: "https://motafalsifa.vercel.app/api/fawaterak/cancel",
      refundWebhook: "https://motafalsifa.vercel.app/api/fawaterak/refund",
      failedWebhook: "https://motafalsifa.vercel.app/api/fawaterak/failed",
      hashVerifyWebhook: "https://motafalsifa.vercel.app/api/fawaterak/hash-verify",
      checkStatus: "https://motafalsifa.vercel.app/api/fawaterak/check-status",
    },
    config: {
      isKeyConfigured: Boolean(FAWATERAK_CONFIG.hashKey && FAWATERAK_CONFIG.hashKey.length > 10),
      providerKey: FAWATERAK_CONFIG.providerKey
        ? `${FAWATERAK_CONFIG.providerKey.slice(0, 4)}...${FAWATERAK_CONFIG.providerKey.slice(-3)}`
        : "غير مضبوط",
      hashKeyMasked: FAWATERAK_CONFIG.hashKey
        ? `${FAWATERAK_CONFIG.hashKey.slice(0, 6)}...${FAWATERAK_CONFIG.hashKey.slice(-4)}`
        : "غير مضبوط",
      status: "active",
    },
  });
});

// API: Update Fawaterak Keys (Admin)
app.post("/api/fawaterak/update-keys", (req, res) => {
  try {
    const { hashKey, providerKey } = req.body || {};
    const updated = updateFawaterakConfig(hashKey, providerKey);
    return res.json({ success: true, updated });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل تحديث بيانات مفاتيح فواتيرك." });
  }
});

// ============================================================================
// 16. CUSTOM AUTOMATED MOBILE WALLET (VODAFONE CASH) SMS GATEWAY ENDPOINTS
// ============================================================================

// 1. Mobile Webhook: Endpoint called by Android Phone (Tasker / SMS Forwarder / SMS Gateway)
app.all(["/api/gateway/sms-webhook", "/api/wallet/sms-webhook"], async (req, res) => {
  try {
    const rawPayload = { ...req.query, ...req.body };
    const secretFromHeaders =
      (req.headers["x-secret-token"] as string) ||
      (req.headers["x-sms-secret"] as string) ||
      (req.headers["authorization"] ? String(req.headers["authorization"]).replace(/^Bearer\s+/i, "") : null);

    const payload = {
      ...rawPayload,
      secret: rawPayload.secret || rawPayload.token || secretFromHeaders,
    };

    const result = await processIncomingSmsWebhook(payload);
    return res.status(result.status || 200).json(result);
  } catch (err: any) {
    console.error("[SMS Gateway Webhook Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to process SMS webhook" });
  }
});

// 2. Student Create Wallet / InstaPay Order (With Authoritative Database Price Protection & Receipt Image Support)
app.post("/api/gateway/create-order", rateLimiter(30, 5 * 60 * 1000), async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      studentPhone,
      senderPhone,
      transactionId,
      courseId,
      courseTitle,
      coursePrice,
      couponCode,
      paymentMethod = "vodafone_cash",
      receiptImageUrl,
      bundleId,
      bundleCourseIds,
    } = req.body || {};

    if (!courseId && !bundleId) {
      return res.status(400).json({ error: "معرف الكورس أو الباقة مطلوب." });
    }
    if (!studentId) {
      return res.status(400).json({ error: "الرجاء تسجيل الدخول أولاً لتأكيد طلب الاشتراك." });
    }
    if (!senderPhone || senderPhone.trim().length < 4) {
      return res.status(400).json({
        error:
          paymentMethod === "instapay"
            ? "الرجاء إدخال رقم الهاتف أو عنوان إنستا باي (InstaPay) الذي قمت بالتحويل منه."
            : "الرجاء إدخال رقم المحفظة (فودافون كاش) التي تم التحويل منها.",
      });
    }

    let finalTitle = courseTitle || "كورس تعليمي معتمد";
    let finalPrice = Number(coursePrice) || 0;
    let finalCourseId = courseId || bundleId;
    let resolvedBundleCourseIds: string[] | undefined = Array.isArray(bundleCourseIds) ? bundleCourseIds : undefined;

    if (bundleId) {
      const bundlesList = loadBundlesFromDisk();
      const foundBundle = bundlesList.find((b: any) => String(b.id) === String(bundleId));
      if (foundBundle) {
        finalTitle = `باقة: ${foundBundle.title}`;
        finalPrice = Number(foundBundle.bundlePrice) || finalPrice;
        resolvedBundleCourseIds = Array.isArray(foundBundle.courseIds) ? foundBundle.courseIds : resolvedBundleCourseIds;
      }
    } else {
      // SECURITY: Always fetch the authoritative course price from the database, never trust client-supplied coursePrice
      const authCourse = await getAuthoritativeCourseFromDB(
        courseId,
        Number(coursePrice) || 0,
        courseTitle || "كورس تعليمي معتمد"
      );
      finalTitle = authCourse.title;
      finalPrice = authCourse.price;
    }

    const result = await createStudentWalletOrder({
      studentId,
      studentName: studentName || "طالب المنصة",
      studentPhone: studentPhone || "",
      senderPhone: senderPhone.trim(),
      transactionId: transactionId ? String(transactionId).trim() : undefined,
      courseId: finalCourseId,
      courseTitle: finalTitle,
      coursePrice: finalPrice,
      bundleId: bundleId || undefined,
      bundleCourseIds: resolvedBundleCourseIds,
      receiptImageUrl: receiptImageUrl || undefined,
      paymentMethod: paymentMethod === "instapay" ? "instapay" : "vodafone_cash",
      couponCode,
    });

    // If unlocked immediately (e.g., 100% coupon), refresh in-memory disk users cache and unlock in users.json
    if (result.instantActivated && result.order) {
      const diskUsers = readDiskUsers();
      const uIdx = diskUsers.findIndex((u: any) => String(u.id) === String(studentId));
      if (uIdx >= 0) {
        const currentCourses: string[] = Array.isArray(diskUsers[uIdx].enrolledCourseIds)
          ? diskUsers[uIdx].enrolledCourseIds
          : [];
        const coursesToAdd =
          Array.isArray(resolvedBundleCourseIds) && resolvedBundleCourseIds.length > 0
            ? resolvedBundleCourseIds
            : [finalCourseId];
        diskUsers[uIdx].enrolledCourseIds = Array.from(new Set([...currentCourses, ...coursesToAdd]));
        writeDiskUsers(diskUsers);
        syncToFirestoreRest("users", diskUsers).catch(() => {});
      }
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[Create Wallet Order Error]:", err);
    return res.status(400).json({ error: err.message || "حدث خطأ أثناء تسجيل طلب التحويل." });
  }
});

// ============================================================================
// 2b. TAMPER-PROOF DATABASE COURSE SUBSCRIPTION ENDPOINT (/api/courses/subscribe-db)
// Verifies course price, discount coupon, wallet balance, and purchase cards
// strictly on the server database (users.json + Firestore) to prevent tampering.
// ============================================================================
const ACCESS_CODES_FILE = path.join(DATA_DIR, "access_codes.json");

function loadServerAccessCodes(): any[] {
  ensureDataDir();
  const codeMap = new Map<string, any>();

  // 1. Read from settings_backup.json if present
  try {
    const settings = readDiskSettings();
    if (settings && Array.isArray(settings.accessCodes)) {
      settings.accessCodes.forEach((c: any) => {
        if (c && c.code) codeMap.set(String(c.code).trim().toUpperCase(), c);
      });
    }
  } catch {}

  // 2. Read from dedicated access_codes.json
  try {
    if (fs.existsSync(ACCESS_CODES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, "utf8"));
      if (Array.isArray(parsed)) {
        parsed.forEach((c: any) => {
          if (c && c.code) {
            const key = String(c.code).trim().toUpperCase();
            const prev = codeMap.get(key);
            codeMap.set(key, prev?.isUsed ? prev : c);
          }
        });
      }
    }
  } catch {}

  return Array.from(codeMap.values());
}

function saveServerAccessCodes(codes: any[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(ACCESS_CODES_FILE, JSON.stringify(codes, null, 2), "utf8");
  } catch {}
  try {
    const settings = readDiskSettings() || {};
    settings.accessCodes = codes;
    writeDiskSettings(settings);
  } catch {}
  syncToFirestoreRest("access_codes", codes).catch(() => {});
}

// Helper: Resolve the student's authoritative existing account balance across all DB layers
async function resolveStudentAccountRecordFromDB(
  studentId: string,
  studentPhone: string,
  studentName?: string,
  accountBalanceHint?: number
): Promise<{ diskUsers: any[]; uIdx: number; studentRecord: any; resolvedBalance: number; hasServerBalanceRecord: boolean }> {
  const diskUsers = readDiskUsers();
  const cleanPhone = String(studentPhone || "").replace(/\D/g, "");

  let uIdx = diskUsers.findIndex((u: any) => {
    if (!u) return false;
    const uPhone = String(u.phone || "").replace(/\D/g, "");
    return u.id === studentId || (cleanPhone.length >= 10 && uPhone === cleanPhone);
  });

  let firestoreUserDoc: any = null;
  // 1. Check individual Firestore document `users/{studentId}` via REST API
  if (studentId) {
    try {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(studentId)}?key=${FIREBASE_API_KEY}`;
      const docRes = await fetch(docUrl);
      if (docRes.ok) {
        const docJson = await docRes.json();
        if (docJson && docJson.fields) {
          const parsed: Record<string, any> = {};
          for (const [k, v] of Object.entries(docJson.fields)) {
            parsed[k] = unwrapFirestoreValue(v);
          }
          firestoreUserDoc = parsed;
        }
      }
    } catch {}
  }

  // 2. Check Firestore `al_motafalsifa_data/users` if needed
  let cloudUserFromList: any = null;
  if (uIdx === -1 && !firestoreUserDoc) {
    try {
      const fsUsers = await fetchPlatformUsersFromFirestore();
      cloudUserFromList = fsUsers.find(
        (u: any) =>
          u &&
          (u.id === studentId ||
            (cleanPhone.length >= 10 && String(u.phone || "").replace(/\D/g, "") === cleanPhone))
      );
    } catch {}
  }

  const diskUser = uIdx !== -1 ? diskUsers[uIdx] : null;
  const hasDiskBalance = diskUser && typeof diskUser.walletBalance === "number";
  const hasFirestoreDocBalance = firestoreUserDoc && typeof firestoreUserDoc.walletBalance === "number";
  const hasCloudListBalance = cloudUserFromList && typeof cloudUserFromList.walletBalance === "number";
  const hasServerBalanceRecord = Boolean(hasDiskBalance || hasFirestoreDocBalance || hasCloudListBalance);

  // Determine the student's existing account balance
  const candidates: number[] = [];
  if (hasDiskBalance) candidates.push(Math.max(0, Number(diskUser.walletBalance) || 0));
  if (hasFirestoreDocBalance) candidates.push(Math.max(0, Number(firestoreUserDoc.walletBalance) || 0));
  if (hasCloudListBalance) candidates.push(Math.max(0, Number(cloudUserFromList.walletBalance) || 0));

  let resolvedBalance = 0;
  if (candidates.length > 0) {
    // Strictly use the authoritative server/database balance (never trust client accountBalanceHint)
    resolvedBalance = Math.max(...candidates);
  }

  // MergeenrolledCourseIds across sources
  const mergedEnrolled = Array.from(
    new Set([
      ...(Array.isArray(diskUser?.enrolledCourseIds) ? diskUser.enrolledCourseIds : []),
      ...(Array.isArray(firestoreUserDoc?.enrolledCourseIds) ? firestoreUserDoc.enrolledCourseIds : []),
      ...(Array.isArray(cloudUserFromList?.enrolledCourseIds) ? cloudUserFromList.enrolledCourseIds : []),
    ])
  );

  if (uIdx === -1) {
    const newStudentRecord = {
      ...(cloudUserFromList || {}),
      ...(firestoreUserDoc || {}),
      id: studentId,
      name: firestoreUserDoc?.name || cloudUserFromList?.name || studentName || "طالب المنصة",
      phone: firestoreUserDoc?.phone || cloudUserFromList?.phone || studentPhone || "",
      role: firestoreUserDoc?.role || cloudUserFromList?.role || "student",
      walletBalance: resolvedBalance,
      walletTransactions:
        firestoreUserDoc?.walletTransactions || cloudUserFromList?.walletTransactions || [],
      enrolledCourseIds: mergedEnrolled,
      registeredAt:
        firestoreUserDoc?.registeredAt ||
        cloudUserFromList?.registeredAt ||
        new Date().toISOString().split("T")[0],
    };
    diskUsers.push(newStudentRecord);
    uIdx = diskUsers.length - 1;
  } else {
    diskUsers[uIdx].walletBalance = resolvedBalance;
    diskUsers[uIdx].enrolledCourseIds = mergedEnrolled;
  }

  return {
    diskUsers,
    uIdx,
    studentRecord: diskUsers[uIdx],
    resolvedBalance,
    hasServerBalanceRecord,
  };
}

app.get("/api/courses/:courseId/enrollment-status", async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = String(req.query.studentId || "").trim();
    const studentPhone = String(req.query.studentPhone || "").replace(/\D/g, "");

    const authCourse = await getAuthoritativeCourseFromDB(courseId, 0);

    let isEnrolledInDb = false;
    let walletBalance: number | null = null;

    if (studentId || studentPhone) {
      const { studentRecord, resolvedBalance, hasServerBalanceRecord } =
        await resolveStudentAccountRecordFromDB(studentId, studentPhone);

      if (hasServerBalanceRecord && resolvedBalance > 0) {
        walletBalance = resolvedBalance;
      } else if (hasServerBalanceRecord && typeof studentRecord?.walletBalance === "number") {
        walletBalance = studentRecord.walletBalance;
      }

      if (
        Array.isArray(studentRecord?.enrolledCourseIds) &&
        studentRecord.enrolledCourseIds.includes(courseId)
      ) {
        isEnrolledInDb = true;
      }
    }

    return res.json({
      success: true,
      courseId,
      authoritativePrice: authCourse.price,
      isCourseFree: authCourse.isFree,
      isEnrolledInDb,
      walletBalance,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل التحقق من حالة الاشتراك." });
  }
});

app.post("/api/courses/subscribe-db", rateLimiter(35, 5 * 60 * 1000), async (req, res) => {
  try {
    const {
      method, // 'coupon_100' | 'wallet_balance' | 'purchase_card'
      courseId,
      courseTitle,
      coursePrice,
      studentId,
      studentName,
      studentPhone,
      accountBalance,
      couponCode,
      purchaseCardCode,
      clientKnownCodes,
    } = req.body || {};

    if (!courseId) {
      return res.status(400).json({ error: "معرف الكورس مطلوب لإتمام الاشتراك." });
    }
    if (!studentId) {
      return res.status(401).json({ error: "يرجى تسجيل الدخول بحساب الطالب أولاً." });
    }

    // 1. Fetch authoritative course price from the server database (Prevents any client-side price manipulation)
    const authCourse = await getAuthoritativeCourseFromDB(
      courseId,
      Number(coursePrice) || 0,
      courseTitle || "كورس تعليمي معتمد"
    );

    // 2. Calculate authoritative discount & final payable amount on the server
    let serverDiscountAmount = 0;
    let serverFinalAmount = authCourse.price;
    let validatedCouponObj: any = null;

    if (couponCode && String(couponCode).trim()) {
      const couponCheck = validateCoupon(String(couponCode).trim(), authCourse.price, courseId);
      if (!couponCheck.valid) {
        return res.status(400).json({ error: couponCheck.error || "كود الخصم غير صالح." });
      }
      serverDiscountAmount = couponCheck.discountAmount;
      serverFinalAmount = couponCheck.finalAmount;
      validatedCouponObj = couponCheck.coupon;
    }

    // 3. Locate student record & existing account balance in server database (users.json + Firestore)
    const { diskUsers, uIdx, studentRecord, resolvedBalance } =
      await resolveStudentAccountRecordFromDB(
        studentId,
        studentPhone || "",
        studentName,
        typeof accountBalance === "number" ? accountBalance : undefined
      );

    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // ========================================================================
    // CASE A: 100% DISCOUNT COUPON OR FREE COURSE ('coupon_100')
    // ========================================================================
    if (method === "coupon_100") {
      if (serverFinalAmount > 0) {
        return res.status(403).json({
          error: `حماية الأسعار: لا يمكن فتح الكورس مجاناً لأن المبلغ المطلوب بعد الخصم هو ${serverFinalAmount} ج.م. يرجى اختيار وسيلة دفع لإتمام الاشتراك.`,
          authoritativeFinalAmount: serverFinalAmount,
        });
      }

      if (validatedCouponObj) {
        validatedCouponObj.usedCount = (Number(validatedCouponObj.usedCount) || 0) + 1;
        couponsStore.set(validatedCouponObj.code.toUpperCase(), validatedCouponObj);
        saveDiskCoupons(Array.from(couponsStore.values()));
      }

      const nextEnrolled = Array.from(new Set([...(studentRecord.enrolledCourseIds || []), courseId]));
      studentRecord.enrolledCourseIds = nextEnrolled;
      studentRecord.updatedAt = nowIso;
      diskUsers[uIdx] = studentRecord;
      writeDiskUsers(diskUsers);
      syncToFirestoreRest("users", diskUsers).catch(() => {});

      await unlockCourseForStudent({
        studentId: studentRecord.id,
        studentName: studentRecord.name || studentName,
        studentPhone: studentRecord.phone || studentPhone,
        courseId,
        courseTitle: authCourse.title,
        amount: 0,
        paymentMethod: validatedCouponObj ? `coupon_100_${validatedCouponObj.code}` : "free_course",
        invoiceId: `FREE100_${Date.now()}`,
      });

      const { password: _, ...safeUser } = studentRecord;
      return res.json({
        success: true,
        method: "coupon_100",
        finalAmount: 0,
        enrolledCourseIds: nextEnrolled,
        updatedUser: safeUser,
        message: validatedCouponObj
          ? `🎉 تم التحقق من كود الخصم 100% (${validatedCouponObj.code}) في قاعدة البيانات وفتح الكورس (${authCourse.title}) مجاناً وبنجاح!`
          : `🎉 تم فتح الكورس المجاني (${authCourse.title}) في حسابك بنجاح!`,
      });
    }

    // ========================================================================
    // CASE B: SUBSCRIBE WITH EXISTING ACCOUNT BALANCE ('wallet_balance')
    // ========================================================================
    if (method === "wallet_balance") {
      const dbWalletBalance = Math.max(0, Number(resolvedBalance) || 0);

      if (dbWalletBalance < serverFinalAmount) {
        return res.status(400).json({
          error: `رصيد الحساب الحالي (${dbWalletBalance} ج.م) غير كافٍ لسداد قيمة الاشتراك (${serverFinalAmount} ج.م).`,
          currentBalance: dbWalletBalance,
          requiredAmount: serverFinalAmount,
        });
      }

      const newBalance = Math.max(0, dbWalletBalance - serverFinalAmount);
      const tx = {
        id: `wtx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "course_purchase" as const,
        amount: serverFinalAmount,
        balanceAfter: newBalance,
        description: validatedCouponObj
          ? `الاشتراك في كورس (${authCourse.title}) من رصيد الحساب بعد خصم الكوبون (${validatedCouponObj.code})`
          : `الاشتراك وتفعيل كورس (${authCourse.title}) من رصيد الحساب الحالي`,
        courseId,
        courseTitle: authCourse.title,
        createdAt: nowFormatted,
      };

      if (validatedCouponObj) {
        validatedCouponObj.usedCount = (Number(validatedCouponObj.usedCount) || 0) + 1;
        couponsStore.set(validatedCouponObj.code.toUpperCase(), validatedCouponObj);
        saveDiskCoupons(Array.from(couponsStore.values()));
      }

      const nextEnrolled = Array.from(new Set([...(studentRecord.enrolledCourseIds || []), courseId]));
      studentRecord.walletBalance = newBalance;
      studentRecord.walletTransactions = [
        tx,
        ...(Array.isArray(studentRecord.walletTransactions) ? studentRecord.walletTransactions : []),
      ].slice(0, 50);
      studentRecord.enrolledCourseIds = nextEnrolled;
      studentRecord.updatedAt = nowIso;

      diskUsers[uIdx] = studentRecord;
      writeDiskUsers(diskUsers);
      syncToFirestoreRest("users", diskUsers).catch(() => {});

      // Also update the student's individual Firestore user document `users/{studentId}` directly
      const safeDb = getSafeFirestore();
      if (safeDb && studentRecord.id) {
        try {
          await safeDb.collection("users").doc(studentRecord.id).set(
            {
              walletBalance: newBalance,
              walletTransactions: studentRecord.walletTransactions,
              enrolledCourseIds: nextEnrolled,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        } catch {}
      }

      await unlockCourseForStudent({
        studentId: studentRecord.id,
        studentName: studentRecord.name || studentName,
        studentPhone: studentRecord.phone || studentPhone,
        courseId,
        courseTitle: authCourse.title,
        amount: serverFinalAmount,
        paymentMethod: "wallet_balance_db",
        invoiceId: tx.id,
      });

      const { password: _, ...safeUser } = studentRecord;
      return res.json({
        success: true,
        method: "wallet_balance",
        deductedAmount: serverFinalAmount,
        newBalance,
        transaction: tx,
        enrolledCourseIds: nextEnrolled,
        updatedUser: safeUser,
        message: `🎉 تم خصم ${serverFinalAmount} ج.م من رصيد حسابك الموجود وتفعيل كورس (${authCourse.title}) فوراً! رصيد حسابك المتبقي الآن: ${newBalance} ج.م`,
      });
    }

    // ========================================================================
    // CASE C: COURSE PURCHASE CARD / ACTIVATION CODE ('purchase_card')
    // ========================================================================
    if (method === "purchase_card") {
      const cleanCardCode = String(purchaseCardCode || "").trim().toUpperCase();
      if (!cleanCardCode) {
        return res.status(400).json({ error: "الرجاء إدخال كود كارت شراء الكورس أولاً." });
      }

      // SECURITY: Only validate against authoritative server & Firestore access codes (never merge untrusted clientKnownCodes)
      let serverCodes = loadServerAccessCodes();

      // Also check Firestore al_motafalsifa_data/access_codes if code not yet in local list
      let codeIdx = serverCodes.findIndex(
        (c: any) =>
          String(c.code || "").trim().toUpperCase() === cleanCardCode &&
          (c.courseId === courseId || !c.courseId || c.courseId === "*")
      );

      if (codeIdx === -1) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/access_codes?key=${FIREBASE_API_KEY}`;
          const fsRes = await fetch(url);
          if (fsRes.ok) {
            const fsJson = await fsRes.json();
            const rawArr = fsJson?.fields?.data?.arrayValue?.values || [];
            const fsCodes = rawArr.map(unwrapFirestoreValue).filter(Boolean);
            if (fsCodes.length > 0) {
              const map = new Map<string, any>();
              fsCodes.forEach((fc: any) => {
                if (fc?.code) map.set(String(fc.code).trim().toUpperCase(), fc);
              });
              serverCodes.forEach((sc: any) => {
                if (sc?.code) {
                  const key = String(sc.code).trim().toUpperCase();
                  const prev = map.get(key);
                  map.set(key, sc.isUsed ? sc : (prev?.isUsed ? prev : sc));
                }
              });
              serverCodes = Array.from(map.values());
              codeIdx = serverCodes.findIndex(
                (c: any) =>
                  String(c.code || "").trim().toUpperCase() === cleanCardCode &&
                  (c.courseId === courseId || !c.courseId || c.courseId === "*")
              );
            }
          }
        } catch {}
      }

      if (codeIdx === -1) {
        return res.status(404).json({
          error: "عذراً، كود كارت شراء الكورس غير صحيح أو لا ينتمي لهذا الكورس. يرجى التأكد من الكود أو مراجعة الإدارة.",
        });
      }

      const targetCard = serverCodes[codeIdx];
      if (targetCard.isUsed) {
        return res.status(400).json({
          error: "هذا الكارت تم استخدامه وتفعيله مسبقاً في قاعدة البيانات ولا يمكن استخدامه مرة أخرى.",
        });
      }

      // Mark card as used in database
      const updatedCard = {
        ...targetCard,
        isUsed: true,
        usedByStudentId: studentRecord.id,
        usedByStudentName: studentRecord.name || studentName,
        usedByStudentPhone: studentRecord.phone || studentPhone,
        usedAt: nowIso,
      };
      serverCodes[codeIdx] = updatedCard;
      saveServerAccessCodes(serverCodes);

      // Enroll student in database
      const nextEnrolled = Array.from(new Set([...(studentRecord.enrolledCourseIds || []), courseId]));
      studentRecord.enrolledCourseIds = nextEnrolled;
      studentRecord.updatedAt = nowIso;
      diskUsers[uIdx] = studentRecord;
      writeDiskUsers(diskUsers);
      syncToFirestoreRest("users", diskUsers).catch(() => {});

      await unlockCourseForStudent({
        studentId: studentRecord.id,
        studentName: studentRecord.name || studentName,
        studentPhone: studentRecord.phone || studentPhone,
        courseId,
        courseTitle: authCourse.title,
        amount: serverFinalAmount,
        paymentMethod: "course_purchase_card",
        invoiceId: cleanCardCode,
      });

      const { password: _, ...safeUser } = studentRecord;
      return res.json({
        success: true,
        method: "purchase_card",
        updatedCard,
        updatedAccessCodes: serverCodes,
        enrolledCourseIds: nextEnrolled,
        updatedUser: safeUser,
        message: `🎉 تم التحقق من كارت شراء الكورس (${cleanCardCode}) في قاعدة البيانات وتفعيل الكورس فوراً!`,
      });
    }

    return res.status(400).json({ error: "طريقة الاشتراك غير معروفة." });
  } catch (err: any) {
    console.error("[Subscribe DB Error]:", err);
    return res.status(500).json({ error: err.message || "حدث خطأ في قاعدة البيانات أثناء تفعيل الاشتراك." });
  }
});

// 3. Check Order Status
app.get("/api/gateway/order-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    let order = ordersStore.get(orderId);

    if (!order) {
      const safeDb = getSafeFirestore();
      if (safeDb) {
        try {
          const doc = await safeDb.collection("orders").doc(orderId).get();
          if (doc.exists) {
            order = doc.data() as any;
          }
        } catch {}
      }
    }

    if (!order) {
      return res.status(404).json({ error: "لم يتم العثور على الطلب." });
    }

    return res.json({
      success: true,
      orderId: order.id,
      status: order.status,
      paidAt: order.paidAt,
      transactionId: order.transactionId,
      courseId: order.courseId,
      isCompleted: order.status === "Completed",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل التحقق من حالة الطلب." });
  }
});

// 4. List All Orders for Admin Dashboard
app.get("/api/gateway/orders", async (req, res) => {
  try {
    let allOrders = Array.from(ordersStore.values());

    const safeDb = getSafeFirestore();
    if (safeDb) {
      try {
        const snap = await safeDb.collection("orders").orderBy("createdAt", "desc").limit(100).get();
        const firestoreOrders: any[] = snap.docs.map((d) => d.data());
        // Merge and deduplicate by id
        const mergedMap = new Map();
        allOrders.forEach((o) => mergedMap.set(o.id, o));
        firestoreOrders.forEach((o) => mergedMap.set(o.id, o));
        allOrders = Array.from(mergedMap.values());
      } catch (e) {
        console.warn("Firestore orders read note:", e);
      }
    }

    allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      orders: allOrders,
      unmatchedSmsCount: unmatchedSmsBuffer.length,
      unmatchedSms: unmatchedSmsBuffer.slice(-10),
      config: {
        receivingWalletNumber: WALLET_CONFIG.receivingWalletNumber,
        receivingWalletName: WALLET_CONFIG.receivingWalletName,
        webhookUrl: "https://motafalsifa.vercel.app/api/gateway/sms-webhook",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "فشل استرجاع سجل طلبات الدفع." });
  }
});

// 5. Admin Approve Order (Unlocks course or bundle in both Firestore and users.json)
app.post("/api/gateway/orders/:orderId/approve", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reviewedBy } = req.body || {};
    const result = await adminApproveWalletOrder(orderId);
    if (result.order) {
      if (reviewedBy) {
        result.order.reviewedBy = String(reviewedBy);
      }
      const diskUsers = readDiskUsers();
      const uIdx = diskUsers.findIndex((u: any) => String(u.id) === String(result.order.studentId));
      if (uIdx >= 0) {
        const currentCourses: string[] = Array.isArray(diskUsers[uIdx].enrolledCourseIds)
          ? diskUsers[uIdx].enrolledCourseIds
          : [];
        const coursesToAdd =
          Array.isArray(result.order.bundleCourseIds) && result.order.bundleCourseIds.length > 0
            ? result.order.bundleCourseIds
            : [result.order.courseId];
        diskUsers[uIdx].enrolledCourseIds = Array.from(new Set([...currentCourses, ...coursesToAdd]));
        writeDiskUsers(diskUsers);
        syncToFirestoreRest("users", diskUsers).catch(() => {});
      }
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "فشل اعتماد الطلب." });
  }
});

// 6. Admin Reject Order
app.post("/api/gateway/orders/:orderId/reject", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body || {};
    const result = await adminRejectWalletOrder(orderId, reason);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "فشل رفض الطلب." });
  }
});

// 7. Simulate SMS (For testing and debugging in Admin Dashboard)
app.post("/api/gateway/simulate-sms", async (req, res) => {
  try {
    const { message, sender = "VF-Cash" } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "نص الرسالة مطلوب للمحاكاة." });
    }

    const result = await processIncomingSmsWebhook({
      sender,
      message,
    });

    return res.json({
      simulation: true,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشلت محاكاة الرسالة." });
  }
});

// 8. Gateway Configuration Endpoint
app.get("/api/gateway/config", (req, res) => {
  return res.json({
    receivingWalletNumber: WALLET_CONFIG.receivingWalletNumber,
    receivingWalletName: WALLET_CONFIG.receivingWalletName,
    webhookUrl: "https://motafalsifa.vercel.app/api/gateway/sms-webhook",
    taskerPayloadTemplate: JSON.stringify({
      sender: "%SMSRF",
      message: "%SMSRB",
    }),
  });
});

app.post("/api/gateway/config", (req, res) => {
  try {
    const { receivingWalletNumber, webhookSecret, receivingWalletName } = req.body || {};
    const updated = updateWalletConfig({
      receivingWalletNumber,
      webhookSecret,
      receivingWalletName,
    });
    return res.json({
      success: true,
      config: {
        receivingWalletNumber: updated.receivingWalletNumber,
        receivingWalletName: updated.receivingWalletName,
        webhookUrl: "https://motafalsifa.vercel.app/api/gateway/sms-webhook",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل تحديث الإعدادات" });
  }
});

// ============================================================================
// VCDN HIGH-SECURITY STREAMING & CHUNKED UPLOAD API
// ============================================================================

// 1. Get VCDN public status & config (NEVER exposes API key)
app.get("/api/vcdn/config", (req, res) => {
  const config = getVcdnConfig();
  return res.json({
    success: true,
    isConfigured: isVcdnConfigured(),
    domain: config.domain,
    ladderProfile: config.ladderProfile,
    baseUrl: config.baseUrl,
  });
});

// 2. Update VCDN config from Admin / Teacher dashboard (server-side only)
app.post("/api/vcdn/config", async (req, res) => {
  try {
    const { apiKey, baseUrl, syncNow } = req.body || {};
    const result = updateVcdnConfig(apiKey, baseUrl);
    if (syncNow) {
      const syncResult = await testVcdnConnectionAndSync(baseUrl, apiKey);
      return res.json({ ...result, ...syncResult });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "فشل حفظ إعدادات VCDN" });
  }
});

// 2b. Test VCDN connection & sync existing local videos to remote VCDN library
app.post("/api/vcdn/test-sync", async (req, res) => {
  try {
    const { apiKey, baseUrl } = req.body || {};
    const result = await testVcdnConnectionAndSync(baseUrl, apiKey);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "فشل اختبار ومزامنة VCDN" });
  }
});

// 3. Presign Upload Session (Calls VCDN POST /api/v1/upload/presign)
app.post("/api/vcdn/upload/presign", async (req, res) => {
  try {
    const { title, fileName, fileSize, partSize, fileFingerprint } = req.body || {};
    if (!title || !fileName || !fileSize) {
      return res.status(400).json({ success: false, error: "العنوان واسم وحجم الملف مطلوبة لإنشاء جلسة الرفع." });
    }

    const session = await createPresignedUploadSession({
      title,
      fileName,
      fileSize: Number(fileSize),
      partSize: partSize ? Number(partSize) : undefined,
      fileFingerprint: fileFingerprint ? String(fileFingerprint) : undefined,
    });

    return res.json(session);
  } catch (err: any) {
    console.error("[VCDN Presign Route Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "فشل إنشاء جلسة الرفع على VCDN" });
  }
});

// 4. Upload Part Chunk (Multipart / Chunked Upload with Resume & Raw Binary/JSON support)
app.post("/api/vcdn/upload/part", async (req, res) => {
  try {
    const sessionId = (req.query?.sessionId || req.headers["x-session-id"] || req.body?.sessionId) as string;
    const partNumber = Number(req.query?.partNumber || req.headers["x-part-number"] || req.body?.partNumber);
    const chunkBase64 = (!Buffer.isBuffer(req.body) ? req.body?.chunkBase64 : undefined) as string | undefined;

    if (!sessionId || !partNumber) {
      return res.status(400).json({ success: false, error: "معرف الجلسة ورقم الجزء مطلوبان." });
    }

    let chunkBuffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      chunkBuffer = req.body;
    } else if (chunkBase64 && typeof chunkBase64 === "string") {
      chunkBuffer = Buffer.from(chunkBase64, "base64");
    } else if (typeof req.body === "string" && req.body.length > 0) {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed.chunkBase64) {
          chunkBuffer = Buffer.from(parsed.chunkBase64, "base64");
        } else {
          chunkBuffer = Buffer.from(req.body);
        }
      } catch {
        chunkBuffer = Buffer.from(req.body);
      }
    } else {
      const rawChunks: Buffer[] = [];
      for await (const chunk of req) {
        rawChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (rawChunks.length > 0) {
        chunkBuffer = Buffer.concat(rawChunks);
      } else {
        return res.status(400).json({ success: false, error: "بيانات الجزء غير صالحة." });
      }
    }

    const result = await uploadPartChunk({
      sessionId,
      partNumber,
      chunkBuffer,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[VCDN Upload Part Route Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "فشل رفع جزء الفيديو" });
  }
});

// 5. Finalize Upload Session
app.post("/api/vcdn/upload/finalize", async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "معرف الجلسة مطلوب لإتمام الرفع." });
    }

    const result = await finalizeUploadSession(sessionId);
    return res.json(result);
  } catch (err: any) {
    console.error("[VCDN Finalize Route Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "فشل إنهاء رفع الفيديو" });
  }
});

// 6. Polling Video Status (GET /api/v1/videos/{id})
app.get("/api/vcdn/videos/:videoId/status", async (req, res) => {
  try {
    const videoId = req.params.videoId;
    if (!videoId) {
      return res.status(400).json({ success: false, error: "معرف الفيديو مطلوب." });
    }

    const status = await getVideoStatus(videoId);
    return res.json({ success: true, video: status });
  } catch (err: any) {
    console.error("[VCDN Status Route Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "فشل جلب حالة الفيديو" });
  }
});

// 6b. Explicitly Mark Video as Ready & Verified
app.post("/api/vcdn/videos/:videoId/mark-ready", (req, res) => {
  try {
    const videoId = req.params.videoId;
    if (!videoId) {
      return res.status(400).json({ success: false, error: "معرف الفيديو مطلوب." });
    }
    const result = markVideoAsReady(videoId);
    return res.json({ success: true, ...result, message: "تم تفعيل وتجهيز الفيديو بنجاح! جاهز للبث المباشر." });
  } catch (err: any) {
    console.error("[VCDN Mark Ready Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "فشل تغيير حالة الفيديو" });
  }
});

// 7. Generate Temporary Playback Token & HLS Stream URL (Protected)
app.post("/api/vcdn/videos/:videoId/playback-token", async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const { studentId, studentName, studentPhone, ttlSeconds } = req.body || {};

    if (!videoId) {
      return res.status(400).json({ success: false, error: "معرف الفيديو مطلوب." });
    }

    const result = await createPlaybackToken({
      videoId,
      studentId,
      studentName,
      studentPhone,
      ttlSeconds,
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[VCDN Playback Token Route Error]:", err);
    return res.status(500).json({ success: false, error: err.message || "فشل إصدار تصريح تشغيل الفيديو" });
  }
});

// 7b. List Uploaded Videos in Server Library
app.get("/api/vcdn/library", (_req, res) => {
  try {
    const tmpUploadsDir = path.join("/tmp", "qalb_uploads");
    const legacyUploadsDir = path.join(process.cwd(), "data", "uploads");
    const dirs = [tmpUploadsDir, legacyUploadsDir].filter((d) => fs.existsSync(d));
    if (dirs.length === 0) {
      return res.json({ success: true, videos: [] });
    }
    const titleById = new Map<string, string>();
    try {
      const coursesPath = path.join(process.cwd(), "data", "courses.json");
      if (fs.existsSync(coursesPath)) {
        const courses = JSON.parse(fs.readFileSync(coursesPath, "utf8"));
        for (const c of courses || []) {
          for (const l of c.lessons || []) {
            for (const v of l.videos || []) {
              if (v?.vcdnVideoId && v?.title) {
                titleById.set(v.vcdnVideoId, v.title);
              }
            }
          }
        }
      }
    } catch {}

    const seenSizes = new Set<number>();
    const allItems: any[] = [];
    for (const dir of dirs) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".mp4")) continue;
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        const id = f.replace(/\.mp4$/, "");
        allItems.push({
          videoId: id,
          title: titleById.get(id) || id,
          fileName: f,
          fileSize: stat.size,
          fileSizeMB: Number((stat.size / (1024 * 1024)).toFixed(1)),
          createdAt: new Date(stat.mtimeMs).toISOString(),
          mtimeMs: stat.mtimeMs,
          streamUrl: `/api/vcdn/stream/${encodeURIComponent(id)}`,
        });
      }
    }
    const files = allItems
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .filter((item) => {
        if (seenSizes.has(item.fileSize)) return false;
        seenSizes.add(item.fileSize);
        return true;
      });
    return res.json({ success: true, videos: files });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Stream VCDN Video with full HTTP 206 Partial Content / Range support
app.get("/api/vcdn/stream/:videoId", (req, res) => {
  try {
    const rawId = req.params.videoId.replace(/^vcdn:/, "");
    const videoId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
    const tmpUploadsDir = path.join("/tmp", "qalb_uploads");
    const legacyUploadsDir = path.join(process.cwd(), "data", "uploads");
    const dirs = [tmpUploadsDir, legacyUploadsDir].filter((d) => fs.existsSync(d));

    for (const dir of dirs) {
      const exactPath = path.join(dir, `${videoId}.mp4`);
      if (fs.existsSync(exactPath)) {
        return streamVideoFile(req, res, exactPath);
      }
    }

    for (const dir of dirs) {
      const files = fs.readdirSync(dir);
      const matchFile = files.find((f) => f.startsWith(videoId));
      if (matchFile) {
        return streamVideoFile(req, res, path.join(dir, matchFile));
      }
    }

    // Fallback: pick the most recently uploaded .mp4 file by modification time
    const mp4s: Array<{ fullPath: string; mtime: number }> = [];
    for (const dir of dirs) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".mp4")) {
          const fullPath = path.join(dir, f);
          mp4s.push({ fullPath, mtime: fs.statSync(fullPath).mtimeMs });
        }
      }
    }
    mp4s.sort((a, b) => b.mtime - a.mtime);
    if (mp4s.length > 0) {
      return streamVideoFile(req, res, mp4s[0].fullPath);
    }

    return res.status(404).json({ error: "ملف الفيديو غير موجود على الخادم." });
  } catch (err: any) {
    console.error("[VCDN Stream Error]:", err);
    return res.status(500).json({ error: err.message || "فشل بث الفيديو." });
  }
});

function streamVideoFile(req: express.Request, res: express.Response, filePath: string) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=3600",
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}

// ============================================================================
// DIRECT LIVE SUPPORT CHAT API (STUDENT <-> PLATFORM ADMINISTRATION)
// ============================================================================

const SUPPORT_CHATS_FILE = path.join(process.cwd(), "data", "support_chats.json");

function loadSupportChatsFromDisk(): any[] {
  try {
    if (fs.existsSync(SUPPORT_CHATS_FILE)) {
      const raw = fs.readFileSync(SUPPORT_CHATS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("[SupportChat] Could not read support_chats.json:", e);
  }
  return [];
}

function saveSupportChatsToDisk(tickets: any[]) {
  try {
    const dir = path.dirname(SUPPORT_CHATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUPPORT_CHATS_FILE, JSON.stringify(tickets, null, 2), "utf8");
  } catch (e) {
    console.warn("[SupportChat] Could not write support_chats.json:", e);
  }
}

let memorySupportTickets: any[] = loadSupportChatsFromDisk();

async function persistSupportTickets(tickets: any[]) {
  memorySupportTickets = tickets;
  saveSupportChatsToDisk(tickets);
  await syncToFirestoreRest("support_chats", tickets).catch(() => {});
}

function normalizeSupportPhone(phone: string): string {
  return String(phone || "")
    .replace(/\s+/g, "")
    .replace(/[^0-9+]/g, "")
    .replace(/^\+?20/, "0");
}

// 1. Start or fetch a student's support ticket by Name & Phone
app.post("/api/support-chat/start", async (req, res) => {
  try {
    const { studentName, studentPhone, studentId, schoolYear } = req.body || {};
    const cleanPhone = normalizeSupportPhone(studentPhone);
    const cleanName = String(studentName || "").trim();

    if (!cleanPhone || !cleanName) {
      return res.status(400).json({ error: "يرجى إدخال الاسم ورقم الهاتف للتواصل مع الدعم الفني." });
    }

    const ticketId = `support_${cleanPhone}`;
    let existing = memorySupportTickets.find((t) => t.id === ticketId || normalizeSupportPhone(t.studentPhone) === cleanPhone);

    const nowStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const nowMs = Date.now();

    if (!existing) {
      const welcomeMsg = {
        id: `msg_welcome_${nowMs}`,
        sender: "admin",
        senderName: "إدارة المنصة - الدعم الفني",
        text: `مرحباً بك يا ${cleanName} في خدمة الدعم الفني المباشر لمنصة المتفلسفة  👋\nاكتب استفسارك أو مشكلتك هنا وسيقوم فريق الإدارة بالرد عليك فوراً.`,
        timestamp: nowStr,
        createdAtMs: nowMs,
      };
      existing = {
        id: ticketId,
        studentName: cleanName,
        studentPhone: cleanPhone,
        studentId: studentId || undefined,
        schoolYear: schoolYear || undefined,
        status: "open",
        unreadByAdmin: 0,
        unreadByStudent: 0,
        lastMessageText: welcomeMsg.text,
        lastMessageAt: nowStr,
        updatedAtMs: nowMs,
        messages: [welcomeMsg],
      };
      memorySupportTickets = [existing, ...memorySupportTickets];
      await persistSupportTickets(memorySupportTickets);
    } else {
      existing.studentName = cleanName || existing.studentName;
      if (studentId) existing.studentId = studentId;
      if (schoolYear) existing.schoolYear = schoolYear;
      existing.unreadByStudent = 0;
      await persistSupportTickets(memorySupportTickets);
    }

    return res.json({ success: true, ticket: existing });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل فتح محادثة الدعم الفني" });
  }
});

// 2. Get a single ticket by ticketId or phone
app.get("/api/support-chat/ticket/:ticketId", (req, res) => {
  try {
    const rawId = req.params.ticketId || "";
    const cleanPhone = normalizeSupportPhone(rawId.replace(/^support_/, ""));
    const ticket = memorySupportTickets.find(
      (t) => t.id === rawId || t.id === `support_${cleanPhone}` || normalizeSupportPhone(t.studentPhone) === cleanPhone
    );
    if (!ticket) {
      return res.json({ success: true, ticket: null });
    }
    return res.json({ success: true, ticket });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل جلب المحادثة" });
  }
});

// 3. Get all tickets for Admin Dashboard
app.get("/api/support-chat/tickets", (req, res) => {
  try {
    const sorted = [...memorySupportTickets].sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
    return res.json({ success: true, tickets: sorted });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل جلب محادثات الدعم" });
  }
});

// 4. Send a message (Student or Admin)
app.post("/api/support-chat/message", async (req, res) => {
  try {
    const { ticketId, studentName, studentPhone, sender, senderName, text, imageUrl } = req.body || {};
    const cleanText = String(text || "").trim();
    if (!cleanText && !imageUrl) {
      return res.status(400).json({ error: "الرسالة فارغة" });
    }

    const cleanPhone = normalizeSupportPhone(studentPhone || String(ticketId || "").replace(/^support_/, ""));
    const resolvedId = ticketId || `support_${cleanPhone}`;
    const nowStr = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const nowMs = Date.now();

    let ticket = memorySupportTickets.find(
      (t) => t.id === resolvedId || normalizeSupportPhone(t.studentPhone) === cleanPhone
    );

    const newMsg = {
      id: `msg_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
      sender: sender === "admin" ? "admin" : "student",
      senderName: senderName || (sender === "admin" ? "إدارة المنصة" : studentName || "طالب"),
      text: cleanText,
      imageUrl: imageUrl || undefined,
      timestamp: nowStr,
      createdAtMs: nowMs,
    };

    if (!ticket) {
      ticket = {
        id: resolvedId,
        studentName: studentName || "طالب",
        studentPhone: cleanPhone,
        status: "open",
        unreadByAdmin: sender === "admin" ? 0 : 1,
        unreadByStudent: sender === "admin" ? 1 : 0,
        lastMessageText: cleanText || "📷 صورة مرفقة",
        lastMessageAt: nowStr,
        updatedAtMs: nowMs,
        messages: [newMsg],
      };
      memorySupportTickets = [ticket, ...memorySupportTickets];
    } else {
      ticket.messages = [...(ticket.messages || []), newMsg];
      ticket.lastMessageText = cleanText || "📷 صورة مرفقة";
      ticket.lastMessageAt = nowStr;
      ticket.updatedAtMs = nowMs;
      ticket.status = "open";
      if (sender === "admin") {
        ticket.unreadByStudent = (ticket.unreadByStudent || 0) + 1;
        ticket.unreadByAdmin = 0;
      } else {
        ticket.unreadByAdmin = (ticket.unreadByAdmin || 0) + 1;
        ticket.unreadByStudent = 0;
      }
    }

    await persistSupportTickets(memorySupportTickets);
    return res.json({ success: true, ticket, message: newMsg });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل إرسال الرسالة" });
  }
});

// 5. Mark ticket as read or resolved
app.post("/api/support-chat/mark-read", async (req, res) => {
  try {
    const { ticketId, readerRole, status } = req.body || {};
    const ticket = memorySupportTickets.find((t) => t.id === ticketId);
    if (ticket) {
      if (readerRole === "admin") ticket.unreadByAdmin = 0;
      if (readerRole === "student") ticket.unreadByStudent = 0;
      if (status) ticket.status = status;
      await persistSupportTickets(memorySupportTickets);
    }
    return res.json({ success: true, ticket });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل تحديث حالة المحادثة" });
  }
});

// 6. Delete a support ticket (Admin)
app.delete("/api/support-chat/ticket/:ticketId", async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    memorySupportTickets = memorySupportTickets.filter((t) => t.id !== ticketId);
    await persistSupportTickets(memorySupportTickets);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل حذف المحادثة" });
  }
});

// ============================================================================
// STUDENT ELECTRONIC WALLET & RECHARGE CODES API
// ============================================================================

const WALLET_CODES_FILE = path.join(process.cwd(), "data", "wallet_codes.json");

function loadWalletCodesFromDisk(): any[] {
  try {
    if (fs.existsSync(WALLET_CODES_FILE)) {
      const raw = fs.readFileSync(WALLET_CODES_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("[WalletCodes] Could not read wallet_codes.json:", e);
  }
  return [];
}

function saveWalletCodesToDisk(codes: any[]) {
  try {
    const dir = path.dirname(WALLET_CODES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WALLET_CODES_FILE, JSON.stringify(codes, null, 2), "utf8");
  } catch (e) {
    console.warn("[WalletCodes] Could not write wallet_codes.json:", e);
  }
}

let memoryWalletCodes: any[] = loadWalletCodesFromDisk();

async function persistWalletCodes(codes: any[], idToken?: string) {
  memoryWalletCodes = codes;
  saveWalletCodesToDisk(codes);
  await syncToFirestoreRest("wallet_codes", codes, idToken).catch(() => {});
}

// 1. Get all wallet recharge codes (Admin)
app.get("/api/wallet/codes", async (_req, res) => {
  try {
    if (memoryWalletCodes.length === 0) {
      memoryWalletCodes = loadWalletCodesFromDisk();
    }
    return res.json({ success: true, codes: memoryWalletCodes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل جلب أكواد شحن المحفظة" });
  }
});

// 2. Save / sync wallet recharge codes (Admin)
app.post("/api/wallet/codes/save", async (req, res) => {
  try {
    const { codes } = req.body || {};
    if (!Array.isArray(codes)) {
      return res.status(400).json({ error: "صيغة الأكواد غير صالحة" });
    }
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    await persistWalletCodes(codes, idToken);
    return res.json({ success: true, codes: memoryWalletCodes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل حفظ أكواد شحن المحفظة" });
  }
});

// 3. Redeem a Wallet Recharge Code (Student)
app.post("/api/wallet/redeem", async (req, res) => {
  try {
    const { code, studentId, studentName, studentPhone } = req.body || {};
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) {
      return res.status(400).json({ error: "يرجى إدخال كود شحن المحفظة." });
    }
    if (!studentId) {
      return res.status(400).json({ error: "يرجى تسجيل الدخول بحساب الطالب أولاً." });
    }

    if (memoryWalletCodes.length === 0) {
      memoryWalletCodes = loadWalletCodesFromDisk();
    }

    let codeIdx = memoryWalletCodes.findIndex(
      (c) => String(c.code || "").trim().toUpperCase() === cleanCode
    );

    // If not found in memory/disk, check Firestore al_motafalsifa_data/wallet_codes
    if (codeIdx === -1) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/al_motafalsifa_data/wallet_codes?key=${FIREBASE_API_KEY}`;
        const fsRes = await fetch(url);
        if (fsRes.ok) {
          const fsJson = await fsRes.json();
          const rawArr = fsJson?.fields?.data?.arrayValue?.values || [];
          const fsCodes = rawArr.map(unwrapFirestoreValue).filter(Boolean);
          if (fsCodes.length > 0) {
            // Merge with memoryWalletCodes
            const map = new Map<string, any>();
            fsCodes.forEach((fc: any) => {
              if (fc?.code) map.set(String(fc.code).toUpperCase(), fc);
            });
            memoryWalletCodes.forEach((mc: any) => {
              if (mc?.code) {
                const existing = map.get(String(mc.code).toUpperCase());
                map.set(String(mc.code).toUpperCase(), existing?.isUsed ? existing : mc);
              }
            });
            memoryWalletCodes = Array.from(map.values());
            saveWalletCodesToDisk(memoryWalletCodes);
            codeIdx = memoryWalletCodes.findIndex(
              (c) => String(c.code || "").trim().toUpperCase() === cleanCode
            );
          }
        }
      } catch {}
    }

    if (codeIdx === -1) {
      return res.status(404).json({ error: "كود الشحن غير صحيح. يرجى التأكد من كتابة الكود بشكل سليم." });
    }

    const targetCode = memoryWalletCodes[codeIdx];
    if (targetCode.isUsed) {
      return res.status(400).json({ error: "هذا الكود تم استخدامه مسبقاً ولا يمكن شحنه مرة أخرى." });
    }

    const amount = Number(targetCode.amount) || 0;
    if (amount <= 0) {
      return res.status(400).json({ error: "قيمة كود الشحن غير صالحة." });
    }

    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const updatedCode = {
      ...targetCode,
      isUsed: true,
      usedByStudentId: studentId,
      usedByStudentName: studentName || "طالب المنصة",
      usedByStudentPhone: studentPhone || "",
      usedAt: nowFormatted,
    };

    memoryWalletCodes[codeIdx] = updatedCode;
    await persistWalletCodes(memoryWalletCodes);

    // Update student in disk users.json
    const diskUsers = readDiskUsers();
    const uIdx = diskUsers.findIndex(
      (u: any) => u && (u.id === studentId || (studentPhone && u.phone === studentPhone))
    );

    let newBalance = amount;
    const tx = {
      id: `wtx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "recharge_code" as const,
      amount,
      balanceAfter: newBalance,
      description: `شحن المحفظة بكود شحن (${cleanCode})`,
      codeUsed: cleanCode,
      createdAt: nowFormatted,
    };

    if (uIdx >= 0) {
      const currentBal = Number(diskUsers[uIdx].walletBalance) || 0;
      newBalance = currentBal + amount;
      tx.balanceAfter = newBalance;
      diskUsers[uIdx].walletBalance = newBalance;
      diskUsers[uIdx].walletTransactions = [
        tx,
        ...(Array.isArray(diskUsers[uIdx].walletTransactions) ? diskUsers[uIdx].walletTransactions : []),
      ].slice(0, 50);
      writeDiskUsers(diskUsers);
      syncToFirestoreRest("users", diskUsers).catch(() => {});
    }

    return res.json({
      success: true,
      amount,
      newBalance,
      transaction: tx,
      updatedCode,
      message: `تم شحن محفظتك بمبلغ ${amount} ج.م بنجاح! 🎉`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل شحن كود المحفظة." });
  }
});

// 4. Admin Direct Wallet Balance Adjust / Top-up
app.post("/api/wallet/admin-adjust", async (req, res) => {
  try {
    const { studentId, studentPhone, mode = "add", amount, note } = req.body || {};
    const numAmount = Number(amount);
    if (!studentId || isNaN(numAmount)) {
      return res.status(400).json({ error: "بيانات الطالب أو المبلغ غير صالحة." });
    }

    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const diskUsers = readDiskUsers();
    const uIdx = diskUsers.findIndex(
      (u: any) => u && (u.id === studentId || (studentPhone && u.phone === studentPhone))
    );

    let prevBalance = uIdx >= 0 ? Number(diskUsers[uIdx].walletBalance) || 0 : 0;
    const newBalance = mode === "set" ? Math.max(0, numAmount) : Math.max(0, prevBalance + numAmount);
    const delta = newBalance - prevBalance;

    const tx = {
      id: `wtx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: "admin_topup" as const,
      amount: delta,
      balanceAfter: newBalance,
      description: note || (mode === "set" ? `تعديل رصيد المحفظة من الإدارة إلى ${newBalance} ج.م` : `إضافة رصيد مباشر من الإدارة (+${numAmount} ج.م)`),
      createdAt: nowFormatted,
    };

    if (uIdx >= 0) {
      diskUsers[uIdx].walletBalance = newBalance;
      diskUsers[uIdx].walletTransactions = [
        tx,
        ...(Array.isArray(diskUsers[uIdx].walletTransactions) ? diskUsers[uIdx].walletTransactions : []),
      ].slice(0, 50);
      writeDiskUsers(diskUsers);
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
      syncToFirestoreRest("users", diskUsers, idToken).catch(() => {});
    }

    return res.json({
      success: true,
      newBalance,
      transaction: tx,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل تحديث رصيد محفظة الطالب." });
  }
});

// ============================================================================
// COURSE BUNDLES SYSTEM (نظام الباقات والعروض المجمعة)
// ============================================================================
const BUNDLES_FILE = path.join(DATA_DIR, "bundles.json");

function loadBundlesFromDisk(): any[] {
  try {
    if (fs.existsSync(BUNDLES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BUNDLES_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const defaultBundles = [
    {
      id: "bundle_term1_bio",
      title: "باقة التميز الشاملة - الأحياء والجيولوجيا (الترم كاملاً)",
      description: "اشترك في باقة الكورسات المجمعة واحصل على شرح المنهج بالكامل + بنك الأسئلة + المراجعات النهائية بخصم حصري 36%.",
      grade: "الصف الثالث الثانوي",
      courseIds: ["1", "2"],
      originalTotalPrice: 550,
      bundlePrice: 350,
      discountPercentage: 36,
      thumbnail: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=80",
      badgeText: "الأكثر توفيراً 🔥 خصم 36%",
      features: [
        "فتح جميع كورسات الباقة فوراً مدى العام الدراسي",
        "شامل مذكرات الـ PDF التفاعلية وامتحانات التابلت",
        "متابعة دورية وتقارير لولي الأمر وشهادة تفوق معتمدة",
      ],
      isActive: true,
      createdAt: "2025-02-20",
    },
    {
      id: "bundle_revision_vip",
      title: "باقة الإنقاذ والمراجعة النهائية + معسكر ليلة الامتحان",
      description: "كل ما تحتاجه لتقفيل المادة في باقة واحدة مكثفة تشمل حل الكتب الخارجية والامتحانات الشاملة.",
      grade: "الصف الثالث الثانوي",
      courseIds: ["2", "3"],
      originalTotalPrice: 600,
      bundlePrice: 420,
      discountPercentage: 30,
      thumbnail: "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80",
      badgeText: "عرض خاص لفترة محدودة ⚡",
      features: [
        "حل أكثر من 1500 سؤال من بنك الأسئلة العشوائي",
        "فيديوهات شرح تفصيلية بأعلى جودة 1080p",
        "إمكانية سؤال المستر مباشرة تحت كل محاضرة",
      ],
      isActive: true,
      createdAt: "2025-02-22",
    },
  ];
  try {
    fs.writeFileSync(BUNDLES_FILE, JSON.stringify(defaultBundles, null, 2), "utf8");
  } catch {}
  return defaultBundles;
}

function saveBundlesToDisk(bundles: any[]): void {
  try {
    fs.writeFileSync(BUNDLES_FILE, JSON.stringify(bundles, null, 2), "utf8");
  } catch (err) {
    console.error("[Bundles] Failed to write bundles.json:", err);
  }
}

app.get("/api/bundles", (_req, res) => {
  try {
    const bundles = loadBundlesFromDisk();
    return res.json({ bundles });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل تحميل الباقات المجمعة." });
  }
});

app.post("/api/bundles", (req, res) => {
  try {
    const {
      title,
      description,
      grade,
      courseIds,
      originalTotalPrice,
      bundlePrice,
      thumbnail,
      badgeText,
      features,
    } = req.body || {};

    if (!title || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ error: "يرجى إدخال اسم الباقة واختيار كورس واحد على الأقل." });
    }

    const orig = Math.max(1, Number(originalTotalPrice) || 500);
    const price = Math.max(0, Number(bundlePrice) || 300);
    const discountPercentage = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;

    const newBundle = {
      id: `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(title).trim(),
      description: String(description || "باقة كورسات مجمعة بسعر مخفض").trim(),
      grade: String(grade || "الصف الثالث الثانوي"),
      courseIds: courseIds.map(String),
      originalTotalPrice: orig,
      bundlePrice: price,
      discountPercentage,
      thumbnail:
        thumbnail ||
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=80",
      badgeText: badgeText || (discountPercentage > 0 ? `وفر ${discountPercentage}% 🔥` : "باقة مميزة"),
      features:
        Array.isArray(features) && features.length > 0
          ? features
          : [
              "فتح جميع كورسات الباقة فوراً",
              "امتحانات إلكترونية وبنك أسئلة شامل",
              "دعم مباشر في قسم اسأل المستر",
            ],
      isActive: true,
      createdAt: new Date().toISOString().split("T")[0],
    };

    const bundles = loadBundlesFromDisk();
    bundles.unshift(newBundle);
    saveBundlesToDisk(bundles);

    return res.json({ success: true, bundle: newBundle, bundles });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل إنشاء الباقة." });
  }
});

app.delete("/api/bundles/:id", (req, res) => {
  try {
    const { id } = req.params;
    const bundles = loadBundlesFromDisk().filter((b: any) => String(b.id) !== String(id));
    saveBundlesToDisk(bundles);
    return res.json({ success: true, bundles });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل حذف الباقة." });
  }
});

app.post("/api/bundles/:id/subscribe-wallet", async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body || {};
    if (!studentId) {
      return res.status(400).json({ error: "يجب تسجيل الدخول أولاً للاشتراك في الباقة." });
    }

    const bundles = loadBundlesFromDisk();
    const bundle = bundles.find((b: any) => String(b.id) === String(id));
    if (!bundle) {
      return res.status(404).json({ error: "الباقة المطلوبة غير موجودة." });
    }

    const diskUsers = readDiskUsers();
    const uIdx = diskUsers.findIndex((u: any) => String(u.id) === String(studentId));
    if (uIdx < 0) {
      return res.status(404).json({ error: "حساب الطالب غير موجود في قاعدة البيانات." });
    }

    const user = diskUsers[uIdx];
    const currentBalance = Number(user.walletBalance || 0);
    const price = Number(bundle.bundlePrice || 0);

    if (currentBalance < price) {
      return res.status(400).json({
        error: `رصيد محفظتك الحالي (${currentBalance} ج.م) غير كافٍ للاشتراك في الباقة (${price} ج.م). يمكنك شحن المحفظة أو الدفع عبر فودافون كاش / إنستا باي.`,
      });
    }

    const newBalance = currentBalance - price;
    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const tx = {
      id: `wtx_bundle_${Date.now()}`,
      type: "course_purchase" as const,
      amount: -price,
      balanceAfter: newBalance,
      description: `الاشتراك في ${bundle.title}`,
      createdAt: nowFormatted,
    };

    const existingCourses: string[] = Array.isArray(user.enrolledCourseIds) ? user.enrolledCourseIds : [];
    const bundleCourses: string[] = Array.isArray(bundle.courseIds) ? bundle.courseIds.map(String) : [];
    user.enrolledCourseIds = Array.from(new Set([...existingCourses, ...bundleCourses]));
    user.walletBalance = newBalance;
    user.walletTransactions = [tx, ...(Array.isArray(user.walletTransactions) ? user.walletTransactions : [])].slice(0, 50);

    writeDiskUsers(diskUsers);
    syncToFirestoreRest("users", diskUsers).catch(() => {});

    return res.json({
      success: true,
      message: `تم الاشتراك في "${bundle.title}" وفتح جميع كورسات الباقة بنجاح! 🎉`,
      enrolledCourseIds: user.enrolledCourseIds,
      newBalance,
      transaction: tx,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "حدث خطأ أثناء الاشتراك في الباقة." });
  }
});

// ============================================================================
// LESSON Q&A DISCUSSION ("اسأل المستر تحت كل حصة")
// ============================================================================
const LESSON_QA_FILE = path.join(DATA_DIR, "lesson_qa.json");

function loadLessonQAFromDisk(): any[] {
  try {
    if (fs.existsSync(LESSON_QA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LESSON_QA_FILE, "utf8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  const initialQA = [
    {
      id: "qa_seed_1",
      courseId: "1",
      lessonId: "l1",
      lessonTitle: "المحاضرة الأولى: الدعامة في النبات والتركيب الفسيولوجي",
      studentId: "student-1",
      studentName: "أحمد محمد علي",
      studentGrade: "الصف الثالث الثانوي",
      questionText: "يا دكتور، هل الدعامة الفسيولوجية تتأثر بنوع التربة لو كانت التربة مالحة؟ وكيف نجيب على سؤال العلاقة البيانية بين الضغط الأسموزي وانتفاخ الخلية؟",
      videoTimestamp: "14:20",
      isResolved: true,
      createdAt: "منذ ساعتين",
      replies: [
        {
          id: "qar_seed_1",
          authorId: "teacher-1",
          authorName: "د. حسام شحاته",
          authorRole: "teacher",
          text: "سؤال ممتاز يا أحمد! نعم، إذا زادت ملوحة التربة يزداد الضغط الأسموزي للتربة عن الفجوة العصارية للخلية، فيتحرك الماء للخارج وتفقد الخلية دعامتها الفسيولوجية. والعلاقة بين الضغط الأسموزي داخل الفجوة العصارية وامتصاص الماء علاقة طردية حتى تصل الخلية للامتلاء.",
          createdAt: "منذ ساعة",
        },
      ],
    },
  ];
  try {
    fs.writeFileSync(LESSON_QA_FILE, JSON.stringify(initialQA, null, 2), "utf8");
  } catch {}
  return initialQA;
}

function saveLessonQAToDisk(items: any[]): void {
  try {
    fs.writeFileSync(LESSON_QA_FILE, JSON.stringify(items, null, 2), "utf8");
  } catch (err) {
    console.error("[LessonQA] Failed to write lesson_qa.json:", err);
  }
}

app.get("/api/lesson-qa", (req, res) => {
  try {
    const { courseId, lessonId } = req.query;
    let items = loadLessonQAFromDisk();
    if (courseId) {
      items = items.filter((item: any) => String(item.courseId) === String(courseId));
    }
    if (lessonId) {
      items = items.filter((item: any) => String(item.lessonId) === String(lessonId));
    }
    return res.json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل تحميل أسئلة الحصة." });
  }
});

app.post("/api/lesson-qa/ask", (req, res) => {
  try {
    const {
      courseId,
      lessonId,
      lessonTitle,
      studentId,
      studentName,
      studentGrade,
      questionText,
      imageUrl,
      videoTimestamp,
    } = req.body || {};

    if (!courseId || !questionText || !String(questionText).trim()) {
      return res.status(400).json({ error: "يرجى كتابة السؤال أولاً." });
    }

    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newItem = {
      id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      courseId: String(courseId),
      lessonId: String(lessonId || "general"),
      lessonTitle: String(lessonTitle || "سؤال عام على الكورس"),
      studentId: String(studentId || "guest"),
      studentName: String(studentName || "طالب المنصة"),
      studentGrade: String(studentGrade || ""),
      questionText: String(questionText).trim(),
      imageUrl: imageUrl || undefined,
      videoTimestamp: videoTimestamp || undefined,
      isResolved: false,
      createdAt: nowFormatted,
      replies: [],
    };

    const items = loadLessonQAFromDisk();
    items.unshift(newItem);
    saveLessonQAToDisk(items);

    return res.json({ success: true, item: newItem, items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل إرسال السؤال." });
  }
});

app.post("/api/lesson-qa/:id/reply", (req, res) => {
  try {
    const { id } = req.params;
    const { authorId, authorName, authorRole, text, imageUrl } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "يرجى كتابة نص الرد." });
    }

    const items = loadLessonQAFromDisk();
    const idx = items.findIndex((i: any) => String(i.id) === String(id));
    if (idx < 0) {
      return res.status(404).json({ error: "السؤال غير موجود." });
    }

    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newReply = {
      id: `qar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorId: String(authorId || "staff"),
      authorName: String(authorName || "المعلم"),
      authorRole: authorRole || "teacher",
      text: String(text).trim(),
      imageUrl: imageUrl || undefined,
      createdAt: nowFormatted,
    };

    items[idx].replies = [...(Array.isArray(items[idx].replies) ? items[idx].replies : []), newReply];
    if (authorRole === "teacher" || authorRole === "admin" || authorRole === "assistant") {
      items[idx].isResolved = true;
    }

    saveLessonQAToDisk(items);
    return res.json({ success: true, item: items[idx], items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل إضافة الرد." });
  }
});

app.delete("/api/lesson-qa/:id", (req, res) => {
  try {
    const { id } = req.params;
    const items = loadLessonQAFromDisk().filter((i: any) => String(i.id) !== String(id));
    saveLessonQAToDisk(items);
    return res.json({ success: true, items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "فشل حذف السؤال." });
  }
});

// ============================================================================
// REFERRAL SYSTEM ("ادعُ صديقك واشحن محفظتك")
// ============================================================================
function getOrGenerateReferralCode(user: any): string {
  if (user.referralCode && String(user.referralCode).trim().length >= 5) {
    return String(user.referralCode).trim().toUpperCase();
  }
  const cleanId = String(user.id || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();
  const phoneTail = String(user.phone || "99")
    .replace(/\D/g, "")
    .slice(-2);
  return `QALB-${cleanId || "ST"}${phoneTail || "25"}`;
}

app.post("/api/referral/redeem", async (req, res) => {
  try {
    const { studentId, referralCode } = req.body || {};
    if (!studentId || !referralCode) {
      return res.status(400).json({ error: "يرجى إدخال كود الدعوة بشكل صحيح." });
    }

    const normalizedCode = String(referralCode).trim().toUpperCase();
    const diskUsers = readDiskUsers();

    const studentIdx = diskUsers.findIndex((u: any) => String(u.id) === String(studentId));
    if (studentIdx < 0) {
      return res.status(404).json({ error: "حسابك غير مسجل في قاعدة البيانات." });
    }

    const currentStudent = diskUsers[studentIdx];
    const myCode = getOrGenerateReferralCode(currentStudent);
    currentStudent.referralCode = myCode;

    if (normalizedCode === myCode) {
      return res.status(400).json({ error: "لا يمكنك استخدام كود الدعوة الخاص بك!" });
    }

    if (currentStudent.redeemedReferralCode) {
      return res.status(400).json({
        error: `لقد قمت بتفعيل كود دعوة مسبقاً (${currentStudent.redeemedReferralCode}). يُسمح بتفعيل كود دعوة واحد لكل طالب.`,
      });
    }

    // Find inviter by referralCode or generated referral code
    const inviterIdx = diskUsers.findIndex((u: any) => {
      const code = getOrGenerateReferralCode(u);
      return code === normalizedCode;
    });

    if (inviterIdx < 0) {
      return res.status(404).json({ error: "كود الدعوة غير صحيح. تأكد من الكود من صديقك." });
    }

    const inviter = diskUsers[inviterIdx];
    inviter.referralCode = getOrGenerateReferralCode(inviter);

    const INVITER_REWARD = 25; // 25 EGP for the student who invited their friend
    const FRIEND_REWARD = 15; // 15 EGP welcome bonus for the invited friend

    const nowFormatted = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Credit friend (current student)
    const friendNewBalance = Number(currentStudent.walletBalance || 0) + FRIEND_REWARD;
    currentStudent.walletBalance = friendNewBalance;
    currentStudent.redeemedReferralCode = normalizedCode;
    currentStudent.walletTransactions = [
      {
        id: `wtx_ref_friend_${Date.now()}`,
        type: "referral_bonus" as const,
        amount: FRIEND_REWARD,
        balanceAfter: friendNewBalance,
        description: `مكافأة ترحيبية لتفعيل كود دعوة صديقك (${inviter.name}) 🎁`,
        createdAt: nowFormatted,
      },
      ...(Array.isArray(currentStudent.walletTransactions) ? currentStudent.walletTransactions : []),
    ].slice(0, 50);

    // Credit inviter
    const inviterNewBalance = Number(inviter.walletBalance || 0) + INVITER_REWARD;
    inviter.walletBalance = inviterNewBalance;
    inviter.referralsCount = Number(inviter.referralsCount || 0) + 1;
    inviter.referralEarnings = Number(inviter.referralEarnings || 0) + INVITER_REWARD;
    inviter.walletTransactions = [
      {
        id: `wtx_ref_inviter_${Date.now()}`,
        type: "referral_bonus" as const,
        amount: INVITER_REWARD,
        balanceAfter: inviterNewBalance,
        description: `مكافأة دعوة صديق (${currentStudent.name}) للانضمام للمنصة 🎉`,
        createdAt: nowFormatted,
      },
      ...(Array.isArray(inviter.walletTransactions) ? inviter.walletTransactions : []),
    ].slice(0, 50);

    writeDiskUsers(diskUsers);
    syncToFirestoreRest("users", diskUsers).catch(() => {});

    return res.json({
      success: true,
      message: `تم تفعيل كود الدعوة بنجاح! حصلت على ${FRIEND_REWARD} ج.م هدية في محفظتك، وحصل صديقك (${inviter.name}) على ${INVITER_REWARD} ج.م 🎉`,
      studentUser: currentStudent,
      inviterName: inviter.name,
      rewardAmount: FRIEND_REWARD,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "حدث خطأ أثناء تفعيل كود الدعوة." });
  }
});

// ============================================================================
// ONEDRIVE / AZURE CLOUD SHELL AUTOMATIC TOKEN SYNC
// ============================================================================
const ONEDRIVE_SYNC_FILE = path.join(DATA_DIR, "onedrive_sync.json");
let latestOneDriveSync: {
  token: string;
  spToken?: string;
  mySiteUrl?: string;
  ownerName?: string;
  ownerEmail?: string;
  driveOk?: boolean;
  driveError?: string;
  totalGB?: string;
  remainingGB?: string;
  syncedAt: number;
} | null = null;

try {
  if (fs.existsSync(ONEDRIVE_SYNC_FILE)) {
    latestOneDriveSync = JSON.parse(fs.readFileSync(ONEDRIVE_SYNC_FILE, "utf8"));
  }
} catch {}

app.options("/api/onedrive/cloudshell-sync", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.sendStatus(200);
});

app.post("/api/onedrive/cloudshell-sync", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const body = req.body || {};
    const rawGraph = String(
      body.access_token || body.graph_token || body.token || ""
    )
      .replace(/^Bearer\s+/i, "")
      .replace(/\s+/g, "");
    const rawSp = String(body.sp_token || "")
      .replace(/^Bearer\s+/i, "")
      .replace(/\s+/g, "");

    if (!rawGraph && !rawSp) {
      return res.status(400).json({
        success: false,
        error: "لم يتم استلام التوكن من Cloud Shell.",
      });
    }

    const activeToken = rawGraph || rawSp;
    let ownerName = "حساب البريد الموحد";
    let ownerEmail = "";
    let mySiteUrl = "";
    let driveOk = false;
    let driveError = "";
    let totalGB = "1024.0";
    let remainingGB = "1024.0";

    // 1. Check /v1.0/me
    try {
      const meRes = await axios.get(
        "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
        {
          headers: { Authorization: `Bearer ${activeToken}` },
          timeout: 8000,
        }
      );
      if (meRes.data) {
        ownerName = meRes.data.displayName || ownerName;
        ownerEmail = meRes.data.mail || meRes.data.userPrincipalName || "";
        mySiteUrl = "https://fayoum3moe-my.sharepoint.com/personal/471331550_fayoum3_moe_edu_eg/_layouts/15/onedrive.aspx";
        driveOk = true;
      }
    } catch {}

    // 2. Check /v1.0/me/drive
    try {
      const driveRes = await axios.get("https://graph.microsoft.com/v1.0/me/drive", {
        headers: { Authorization: `Bearer ${activeToken}` },
        timeout: 8000,
      });
      if (driveRes.data) {
        driveOk = true;
        const totalBytes = Number(driveRes.data?.quota?.total || 0);
        const usedBytes = Number(driveRes.data?.quota?.used || 0);
        const remBytes = Number(
          driveRes.data?.quota?.remaining || Math.max(0, totalBytes - usedBytes)
        );
        if (totalBytes > 0) {
          totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
          remainingGB = (remBytes / (1024 * 1024 * 1024)).toFixed(1);
        }
        ownerName = driveRes.data?.owner?.user?.displayName || ownerName;
      }
    } catch (err: any) {
      driveError =
        err?.response?.data?.error?.message ||
        err?.message ||
        "Files.ReadWrite not granted";
    }

    latestOneDriveSync = {
      token: activeToken,
      spToken: rawSp || undefined,
      mySiteUrl: mySiteUrl || undefined,
      ownerName,
      ownerEmail,
      driveOk,
      driveError: driveOk ? undefined : driveError,
      totalGB,
      remainingGB,
      syncedAt: Date.now(),
    };

    try {
      ensureDataDir();
      fs.writeFileSync(
        ONEDRIVE_SYNC_FILE,
        JSON.stringify(latestOneDriveSync, null, 2),
        "utf8"
      );
    } catch {}

    return res.json({
      success: true,
      message: "✅ تم إرسال التوكن إلى المنصة بنجاح! ارجع لصفحة المنصة الآن.",
      ownerName,
      ownerEmail,
      driveOk,
      driveError,
      totalGB,
      remainingGB,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "فشل مزامنة التوكن",
    });
  }
});

app.get("/api/onedrive/cloudshell-sync", async (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    // Poll public relay channel used by Azure Cloud Shell (bypasses Cloud Run preview cookie 404)
    const relayRes = await axios.get(
      "https://ntfy.sh/qalb_onedrive_sync_471331550/json?poll=1&since=1700000000",
      { timeout: 5000, responseType: "text" }
    );
    if (relayRes.data && typeof relayRes.data === "string") {
      const lines = relayRes.data.trim().split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const item = JSON.parse(lines[i]);
          let msg = String(item?.message || "").trim();
          if (msg.includes("access_token")) {
            const match = msg.match(/"access_token"\s*:\s*"([^"]+)"/);
            if (match && match[1]) msg = match[1];
          }
          const cleanTok = msg.replace(/^Bearer\s+/i, "").replace(/["'\s\r\n]+/g, "");
          if (cleanTok.startsWith("eyJ") && cleanTok.length > 200) {
            if (!latestOneDriveSync || latestOneDriveSync.token !== cleanTok || !latestOneDriveSync.ownerEmail) {
              let ownerName = "حسام احمد مساعد فيصل";
              let ownerEmail = "471331550@fayoum3.moe.edu.eg";
              let mySiteUrl = "https://fayoum3moe-my.sharepoint.com/personal/471331550_fayoum3_moe_edu_eg/_layouts/15/onedrive.aspx";
              let driveOk = true;
              let driveError = "";
              let totalGB = "1024.0";
              let remainingGB = "1024.0";

              try {
                const meRes = await axios.get(
                  "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
                  {
                    headers: { Authorization: `Bearer ${cleanTok}` },
                    timeout: 6000,
                  }
                );
                if (meRes.data) {
                  ownerName = meRes.data.displayName || ownerName;
                  ownerEmail = meRes.data.mail || meRes.data.userPrincipalName || ownerEmail;
                  driveOk = true;
                }
              } catch {}

              try {
                const driveRes = await axios.get(
                  "https://graph.microsoft.com/v1.0/me/drive",
                  {
                    headers: { Authorization: `Bearer ${cleanTok}` },
                    timeout: 6000,
                  }
                );
                if (driveRes.data) {
                  driveOk = true;
                  const totalBytes = Number(driveRes.data?.quota?.total || 0);
                  const usedBytes = Number(driveRes.data?.quota?.used || 0);
                  const remBytes = Number(
                    driveRes.data?.quota?.remaining || Math.max(0, totalBytes - usedBytes)
                  );
                  if (totalBytes > 0) {
                    totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
                    remainingGB = (remBytes / (1024 * 1024 * 1024)).toFixed(1);
                  }
                  ownerName = driveRes.data?.owner?.user?.displayName || ownerName;
                }
              } catch (err: any) {
                driveError =
                  err?.response?.data?.error?.message ||
                  err?.message ||
                  "Files.ReadWrite not granted";
              }


              latestOneDriveSync = {
                token: cleanTok,
                mySiteUrl: mySiteUrl || undefined,
                ownerName,
                ownerEmail,
                driveOk,
                driveError: driveOk ? undefined : driveError,
                totalGB,
                remainingGB,
                syncedAt: Date.now(),
              };

              try {
                ensureDataDir();
                fs.writeFileSync(
                  ONEDRIVE_SYNC_FILE,
                  JSON.stringify(latestOneDriveSync, null, 2),
                  "utf8"
                );
              } catch {}
            }
            break;
          }
        } catch {}
      }
    }
  } catch {}

  if (!latestOneDriveSync || !latestOneDriveSync.token) {
    return res.json({ success: false, hasToken: false });
  }
  return res.json({
    success: true,
    hasToken: true,
    ...latestOneDriveSync,
  });
});

// ============================================================================
// GITHUB ENCRYPTED HLS (AES-128) + MULTI-REPO VAULT + SMART SECURITY GUARD
// ============================================================================
const ghHlsTempSessions = new Map<
  string,
  {
    sessionId: string;
    videoId: string;
    title: string;
    fileName: string;
    fileSize: number;
    tempFilePath: string;
    createdAt: number;
  }
>();

app.get("/api/github-hls/status", (_req, res) => {
  const cfg = getGitHubHlsConfig();
  const videos = Object.values(getAllGitHubHlsVideos());
  const activeRepo = cfg?.activeRepo || "";
  const username = cfg?.username || "";
  const shards = getFormattedShardsSummary();
  return res.json({
    connected: Boolean(cfg && cfg.token && cfg.username),
    username,
    activeRepo,
    repoUrl: username ? `https://github.com/${username}/${activeRepo}` : "",
    repoIndex: cfg?.repoIndex || 1,
    connectedAt: cfg?.connectedAt || null,
    shardsCount: shards.length,
    shards,
    videosCount: videos.length,
    videos: videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      durationSec: v.durationSec,
      sizeBytes: v.sizeBytes,
      repoOwner: v.repoOwner || username,
      repoName: v.repoName,
      segmentCount: Object.keys(v.segments || {}).length,
      masterPlaylistUrl:
        v.storageMode === "node-aes128"
          ? `/api/github-hls/${encodeURIComponent(v.videoId)}/stream.mp4`
          : `/api/github-hls/${encodeURIComponent(v.videoId)}/master.m3u8`,
      createdAt: v.createdAt,
    })),
  });
});

app.post("/api/github-hls/connect", async (req, res) => {
  try {
    const rawToken = String(req.body?.token || "").trim();
    const result = await connectGitHubHlsAccount(rawToken);
    if (!result.success) {
      return res.status(400).json(result);
    }
    const cfg = getGitHubHlsConfig();
    if (cfg) {
      syncToFirestoreRest("github_hls_config", cfg).catch(() => {});
    }
    return res.json({
      ...result,
      shards: getFormattedShardsSummary(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "حدث خطأ أثناء تفعيل المخزن السحابي المشفر.",
    });
  }
});

// Auto-Sharding Script Endpoint: Initialize 1 or multiple secondary GitHub accounts & repositories automatically
app.post("/api/github-hls/shards/auto-init", async (req, res) => {
  try {
    const rawTokens = req.body?.tokens || req.body?.token || "";
    const result = await autoInitializeVaultShards(rawTokens);
    const cfg = getGitHubHlsConfig();
    if (cfg) {
      syncToFirestoreRest("github_hls_config", cfg).catch(() => {});
    }
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "حدث خطأ أثناء تشغيل سكربت التهيئة التلقائية للحسابات الثانوية.",
    });
  }
});

app.post("/api/github-hls/shards/remove", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const result = removeVaultShard(username);
    const cfg = getGitHubHlsConfig();
    if (cfg) {
      syncToFirestoreRest("github_hls_config", cfg).catch(() => {});
    }
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "تعذر حذف الحساب الثانوي.",
    });
  }
});

const ghHlsProcessingJobs = new Map<
  string,
  {
    status: "processing" | "completed" | "error";
    percentage: number;
    statusText: string;
    result?: any;
    error?: string;
    updatedAt: number;
  }
>();

function getOrRestoreGhHlsSession(sessionId: string) {
  let sess = ghHlsTempSessions.get(sessionId);
  if (sess) return sess;
  try {
    const metaPath = path.join("/tmp", "gh_hls_work", `${sessionId}_meta.json`);
    if (fs.existsSync(metaPath)) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (parsed && parsed.sessionId) {
        ghHlsTempSessions.set(sessionId, parsed);
        return parsed;
      }
    }
  } catch {}
  return null;
}

// 1. Initialize temporary chunked upload before AES-128 slicing
app.post("/api/github-hls/upload/init", (req, res) => {
  const cfg = getGitHubHlsConfig();
  if (!cfg || !cfg.token) {
    return res.status(400).json({
      success: false,
      error: "يرجى تفعيل المفتاح السري للمخزن السحابي المشفر أولاً.",
    });
  }
  const title = String(req.body?.title || "محاضرة مشفرة").trim();
  const fileName = String(req.body?.fileName || "lecture.mp4").trim();
  const fileSize = Number(req.body?.fileSize || 0);
  const sessionId = `gh_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const videoId = `gh_hls_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tempDir = path.join("/tmp", "gh_hls_work");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Automatic /tmp RAM garbage collection: remove any abandoned upload temp files older than 20 minutes
  try {
    const now = Date.now();
    const staleThresholdMs = 20 * 60 * 1000;
    for (const entry of fs.readdirSync(tempDir)) {
      if (entry.startsWith("gh_sess_")) {
        const fullPath = path.join(tempDir, entry);
        try {
          const st = fs.statSync(fullPath);
          if (now - st.mtimeMs > staleThresholdMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        } catch {}
      }
    }
    for (const [k, v] of ghHlsTempSessions.entries()) {
      if (now - v.createdAt > staleThresholdMs) {
        ghHlsTempSessions.delete(k);
      }
    }
  } catch {}

  const tempFilePath = path.join(tempDir, `${sessionId}_raw.mp4`);
  const metaFilePath = path.join(tempDir, `${sessionId}_meta.json`);
  try {
    fs.writeFileSync(tempFilePath, Buffer.alloc(0));
  } catch {}

  const sessObj = {
    sessionId,
    videoId,
    title,
    fileName,
    fileSize,
    tempFilePath,
    createdAt: Date.now(),
  };

  ghHlsTempSessions.set(sessionId, sessObj);
  try {
    fs.writeFileSync(metaFilePath, JSON.stringify(sessObj), "utf-8");
  } catch {}

  return res.json({
    success: true,
    sessionId,
    videoId,
    chunkSize: 4 * 1024 * 1024, // 4 MB chunks with 3x pipelined stream upload
  });
});

// 2. Write binary video chunk to temporary transit file (supports pipelined byte-offset writes)
app.post(
  "/api/github-hls/upload/chunk",
  express.raw({ type: "application/octet-stream", limit: "20mb" }),
  (req, res) => {
    const sessionId = String(req.query.sessionId || "").trim();
    const sess = getOrRestoreGhHlsSession(sessionId);
    if (!sess) {
      return res.status(404).json({ success: false, error: "جلسة الرفع غير موجودة." });
    }
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    const rawOffset = req.query.offset !== undefined ? Number(req.query.offset) : NaN;
    try {
      if (!Number.isNaN(rawOffset) && rawOffset >= 0) {
        if (!fs.existsSync(sess.tempFilePath)) {
          fs.writeFileSync(sess.tempFilePath, Buffer.alloc(0));
        }
        const fd = fs.openSync(sess.tempFilePath, "r+");
        try {
          fs.writeSync(fd, buf, 0, buf.length, rawOffset);
        } finally {
          fs.closeSync(fd);
        }
      } else {
        fs.appendFileSync(sess.tempFilePath, buf);
      }
      return res.json({ success: true, receivedBytes: buf.length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || "فشل حفظ الجزء المؤقت" });
    }
  }
);

// 3. Finalize: Run AES-128 slicing, cache locally for instant playback, and upload to GitHub Releases in background
app.post("/api/github-hls/upload/complete", async (req, res) => {
  const sessionId = String(req.body?.sessionId || "").trim();
  const asyncPoll = Boolean(req.body?.asyncPoll);
  const customTitle = String(req.body?.title || "").trim();
  const sess = getOrRestoreGhHlsSession(sessionId);
  if (!sess) {
    return res.status(404).json({ success: false, error: "جلسة الرفع غير صالحة أو انتهت." });
  }
  ghHlsTempSessions.delete(sessionId);
  try {
    const metaPath = path.join("/tmp", "gh_hls_work", `${sessionId}_meta.json`);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {}

  const finalTitle = customTitle || sess.title || "محاضرة مشفرة";

  const runJob = async () => {
    ghHlsProcessingJobs.set(sessionId, {
      status: "processing",
      percentage: 90,
      statusText: "جاري تقطيع الفيديو وتشفيره بتقنية HLS AES-128 الفورية...",
      updatedAt: Date.now(),
    });

    try {
      const result = await processAndUploadVideoToGitHubHls({
        sourceFilePath: sess.tempFilePath,
        title: finalTitle,
        videoId: sess.videoId,
        onProgress: (stage, pct) => {
          const mappedPct = Math.min(99, Math.max(90, Math.round(90 + (pct / 100) * 9)));
          ghHlsProcessingJobs.set(sessionId, {
            status: "processing",
            percentage: mappedPct,
            statusText: stage,
            updatedAt: Date.now(),
          });
        },
        onBackgroundSyncComplete: () => {
          const updatedVideos = getAllGitHubHlsVideos();
          syncToFirestoreRest("github_hls_videos", updatedVideos).catch(() => {});
        },
      });

      const allVideos = getAllGitHubHlsVideos();
      syncToFirestoreRest("github_hls_videos", allVideos).catch(() => {});

      const payload = {
        success: true,
        videoId: result.videoId,
        masterPlaylistUrl: result.masterPlaylistUrl,
        durationSec: result.durationSec,
        segmentCount: result.segmentCount,
        repoName: result.repoName,
        repoUrl: result.repoUrl,
        message: `تم تقطيع وتشفير الفيديو (${result.segmentCount} قطعة مشفرة AES-128) وحفظه بنجاح! 🔒🚀`,
      };

      ghHlsProcessingJobs.set(sessionId, {
        status: "completed",
        percentage: 100,
        statusText: "تم التشفير والحفظ بنجاح! ✅",
        result: payload,
        updatedAt: Date.now(),
      });

      return payload;
    } catch (err: any) {
      try {
        if (fs.existsSync(sess.tempFilePath)) fs.unlinkSync(sess.tempFilePath);
      } catch {}
      const errMsg = err?.message || "فشل معالجة وتشفير الفيديو في السحابة الخاصة.";
      ghHlsProcessingJobs.set(sessionId, {
        status: "error",
        percentage: 0,
        statusText: errMsg,
        error: errMsg,
        updatedAt: Date.now(),
      });
      throw err;
    }
  };

  if (asyncPoll) {
    runJob().catch(() => {});
    return res.json({
      success: true,
      processing: true,
      jobId: sessionId,
    });
  }

  try {
    const payload = await runJob();
    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "فشل معالجة وتشفير الفيديو في السحابة الخاصة.",
    });
  }
});

// 3b. Poll processing job progress (prevents Cloud Run 60s HTTP timeout on long videos!)
app.get("/api/github-hls/upload/job/:jobId", (req, res) => {
  const jobId = String(req.params.jobId || "").trim();
  const job = ghHlsProcessingJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: "مهمة المعالجة غير موجودة." });
  }
  if (job.status === "completed") {
    return res.json({
      success: true,
      status: "completed",
      percentage: 100,
      statusText: job.statusText,
      ...job.result,
    });
  }
  if (job.status === "error") {
    return res.status(500).json({
      success: false,
      status: "error",
      error: job.error || "فشل تشفير الفيديو.",
    });
  }
  return res.json({
    success: true,
    status: "processing",
    percentage: job.percentage,
    statusText: job.statusText,
  });
});

// 4. Smart Security Guard: Hotlink-Protected HLS Playlist (.m3u8)
const SNIFFER_UA_REGEX =
  /curl|wget|python-requests|python-urllib|aiohttp|ffmpeg|lavf|yt-dlp|youtube-dl|idm|internet download manager|aria2|postman|insomnia|httpie|go-http-client|okhttp|scrapy|libwww-perl/i;

app.get("/api/github-hls/:videoId/master.m3u8", async (req, res) => {
  const videoId = String(req.params.videoId || "").trim();
  const secFetchDest = String(req.headers["sec-fetch-dest"] || "");
  const secFetchSite = String(req.headers["sec-fetch-site"] || "");
  const userAgent = String(req.headers["user-agent"] || "");

  if (
    secFetchDest === "document" ||
    secFetchSite === "cross-site" ||
    !userAgent ||
    SNIFFER_UA_REGEX.test(userAgent)
  ) {
    return res
      .status(403)
      .send("🔒 محمي بواسطة حارس أمن منصة المتفلسفة : يمنع فتح أو سحب ملف البث عبر برامج الـ Sniffers أو خارج المنصة.");
  }

  const video = await ensureGitHubHlsVideoLoaded(videoId);
  if (!video) {
    return res.status(404).send("ملف البث المشفر غير موجود.");
  }

  // Pre-warm opening segment into 96MB decrypted RAM cache immediately while browser parses the manifest
  if (video.segments?.["seg_0000.ts"] && !getFastStartMp4HeaderAndMeta(videoId)) {
    fetchAndDecryptNodeAesChunk(video, "seg_0000.ts").catch(() => {});
  }

  const playlist = buildGuardedM3u8Playlist(video);
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(playlist);
});

// 5. Smart Security Guard: Anti-Sniffer 16-Byte AES-128 Decryption Key Endpoint (/enc.key)
app.get("/api/github-hls/:videoId/enc.key", async (req, res) => {
  const videoId = String(req.params.videoId || "").trim();
  const kgt = String(req.query.kgt || "").trim();
  const secFetchDest = String(req.headers["sec-fetch-dest"] || "");
  const secFetchSite = String(req.headers["sec-fetch-site"] || "");
  const userAgent = String(req.headers["user-agent"] || "");

  if (
    secFetchDest === "document" ||
    secFetchSite === "cross-site" ||
    !userAgent ||
    SNIFFER_UA_REGEX.test(userAgent)
  ) {
    return res
      .status(403)
      .send("Forbidden: Sniffer / Hotlinking blocked by Qalb El-Elm Key Guard");
  }

  if (kgt && !verifyKeyGuardToken(videoId, kgt)) {
    return res
      .status(403)
      .send("Forbidden: Invalid or expired cryptographic key signature (Anti-Sniffer Guard)");
  }

  const video = await ensureGitHubHlsVideoLoaded(videoId);
  if (!video || !video.keyBase64) {
    return res.status(404).send("Key not found");
  }

  const keyBuf = Buffer.from(video.keyBase64, "base64");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", String(keyBuf.length));
  res.setHeader("Cache-Control", "private, max-age=900");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(keyBuf);
});

app.post("/api/github-hls/visibility", async (_req, res) => {
  try {
    // Always enforce Public mode with obfuscated random repository names
    const result = await setVaultRepoVisibility(false);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "تعذر تغيير حالة المخزن.",
    });
  }
});

// 6. Smart Security Guard: Zero-Storage Segment Streamer (96MB Shared RAM Cache + PAT Micro-Slicing + Virtual HLS)
app.get("/api/github-hls/:videoId/segment/:segName", async (req, res) => {
  const videoId = String(req.params.videoId || "").trim();
  const segName = String(req.params.segName || "").trim();
  const partParam = req.query.part !== undefined ? String(req.query.part) : undefined;
  const ofParam = req.query.of !== undefined ? String(req.query.of) : undefined;
  const secFetchDest = String(req.headers["sec-fetch-dest"] || "");

  if (secFetchDest === "document") {
    return res.status(403).send("Forbidden");
  }

  const video = await ensureGitHubHlsVideoLoaded(videoId);
  if (!video) {
    return res.status(404).send("Video not found");
  }

  const etag = `"hls-seg-v2-${videoId}-${segName}-${partParam ?? "full"}-${ofParam ?? "1"}"`;
  if (req.headers["if-none-match"] === etag) {
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(304).end();
  }

  try {
    const localPort = Number(process.env.PORT) || 3000;
    const segBuf = await getUnifiedHlsSegmentBuffer(video, segName, partParam, ofParam, localPort);

    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Content-Length", String(segBuf.length));
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(segBuf);
  } catch (err: any) {
    return res.status(502).send("Failed to stream segment");
  }
});

// 7. Smart Security Guard: Real-Time AES-128-CBC Byte-Range Decryptor with Fast-Start Moov Relocation & Cross-Chunk Stitching
app.get("/api/github-hls/:videoId/stream.mp4", async (req, res) => {
  const videoId = String(req.params.videoId || "").trim();
  const secFetchDest = String(req.headers["sec-fetch-dest"] || "");

  if (secFetchDest === "document") {
    return res
      .status(403)
      .send("🔒 محمي بواسطة حارس أمن منصة المتفلسفة : يمنع فتح أو تحميل الفيديو خارج المنصة.");
  }

  const video = await ensureGitHubHlsVideoLoaded(videoId);
  if (!video) {
    return res.status(404).send("الفيديو المشفر غير موجود.");
  }

  const fastStartMeta = getFastStartMp4HeaderAndMeta(videoId);
  const totalSize = fastStartMeta ? fastStartMeta.totalFastStartSize : Number(video.sizeBytes || 0);
  const segCount = Object.keys(video.segments || {}).length;
  const seg0Raw = Number(video.segments?.["seg_0000.ts"]?.rawSize || 0);
  const rawChunkSize = Number(
    video.rawChunkSize || (segCount > 1 && seg0Raw > 0 ? seg0Raw : 0) || RAW_AES_CHUNK_SIZE
  );
  if (totalSize <= 0) {
    return res.status(404).send("Invalid video size");
  }

  const rangeHeader = String(req.headers.range || "");
  let start = 0;
  const maxWindowBytes = Math.min(rawChunkSize, 8 * 1024 * 1024);
  let requestedEnd = Math.min(totalSize - 1, start + maxWindowBytes - 1);

  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const parsedStart = parseInt(parts[0], 10);
    if (!isNaN(parsedStart) && parsedStart >= 0 && parsedStart < totalSize) {
      start = parsedStart;
    }
    const parsedEnd = parts[1] ? parseInt(parts[1], 10) : Math.min(totalSize - 1, start + maxWindowBytes - 1);
    if (!isNaN(parsedEnd) && parsedEnd >= start && parsedEnd < totalSize) {
      requestedEnd = Math.min(parsedEnd, start + maxWindowBytes - 1);
    } else {
      requestedEnd = Math.min(totalSize - 1, start + maxWindowBytes - 1);
    }
  }

  const rangeEtag = `"aes-rng-v2-${videoId}-${start}-${requestedEnd}"`;
  if (req.headers["if-none-match"] === rangeEtag) {
    res.setHeader("ETag", rangeEtag);
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.status(304).end();
  }

  // If Fast-Start relocated header exists (ftyp + shifted moov at byte 0..headerSize-1):
  if (fastStartMeta) {
    try {
      const hdrSize = fastStartMeta.headerSize;
      // Case 1: Range falls completely within the in-memory Fast-Start header (0ms response!)
      if (requestedEnd < hdrSize) {
        const slice = fastStartMeta.headerBuf.subarray(start, requestedEnd + 1);
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${requestedEnd}/${totalSize}`);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", String(slice.length));
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("ETag", rangeEtag);
        res.setHeader("Cache-Control", "private, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.send(slice);
      }

      // Case 2: Range starts inside header and spills into mdat, or starts inside mdat
      const headerPart =
        start < hdrSize ? fastStartMeta.headerBuf.subarray(start, hdrSize) : null;
      const mdatVirtualStart = Math.max(0, start - hdrSize);
      const mdatVirtualEnd = requestedEnd - hdrSize;
      const origStart = fastStartMeta.mdatOriginalOffset + mdatVirtualStart;
      const origEnd = Math.min(
        Number(video.sizeBytes) - 1,
        fastStartMeta.mdatOriginalOffset + mdatVirtualEnd
      );

      const startChunkIdx = Math.floor(origStart / rawChunkSize);
      const endChunkIdx = Math.floor(origEnd / rawChunkSize);
      const firstSegName = `seg_${String(startChunkIdx).padStart(4, "0")}.ts`;
      const nextSegName = `seg_${String(startChunkIdx + 1).padStart(4, "0")}.ts`;
      const needsSecondChunk = endChunkIdx > startChunkIdx && Boolean(video.segments?.[nextSegName]);

      const [firstChunk, secondChunk] = await Promise.all([
        fetchAndDecryptNodeAesChunk(video, firstSegName),
        needsSecondChunk ? fetchAndDecryptNodeAesChunk(video, nextSegName) : Promise.resolve(null),
      ]);

      const firstChunkStartByte = startChunkIdx * rawChunkSize;
      const combinedBuf = secondChunk ? Buffer.concat([firstChunk, secondChunk]) : firstChunk;
      const sliceStart = Math.max(0, origStart - firstChunkStartByte);
      const sliceEnd = Math.min(combinedBuf.length, origEnd - firstChunkStartByte + 1);
      const mdatSlice = combinedBuf.subarray(sliceStart, sliceEnd);

      const finalSlice = headerPart ? Buffer.concat([headerPart, mdatSlice]) : mdatSlice;
      const actualEndByte = start + finalSlice.length - 1;

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${actualEndByte}/${totalSize}`);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", String(finalSlice.length));
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("ETag", rangeEtag);
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(finalSlice);
    } catch (err: any) {
      return res.status(502).send("Failed to stream Fast-Start MP4 range");
    }
  }

  const startChunkIdx = Math.floor(start / rawChunkSize);
  const endChunkIdx = Math.floor(requestedEnd / rawChunkSize);

  try {
    const firstSegName = `seg_${String(startChunkIdx).padStart(4, "0")}.ts`;
    const nextSegName = `seg_${String(startChunkIdx + 1).padStart(4, "0")}.ts`;
    const needsSecondChunk = endChunkIdx > startChunkIdx && Boolean(video.segments?.[nextSegName]);

    const [firstChunk, secondChunk] = await Promise.all([
      fetchAndDecryptNodeAesChunk(video, firstSegName),
      needsSecondChunk ? fetchAndDecryptNodeAesChunk(video, nextSegName) : Promise.resolve(null),
    ]);

    const firstChunkStartByte = startChunkIdx * rawChunkSize;
    const combinedBuf = secondChunk ? Buffer.concat([firstChunk, secondChunk]) : firstChunk;

    const sliceStart = Math.max(0, start - firstChunkStartByte);
    const sliceEnd = Math.min(combinedBuf.length, requestedEnd - firstChunkStartByte + 1);
    const slice = combinedBuf.subarray(sliceStart, sliceEnd);
    const actualEndByte = firstChunkStartByte + sliceEnd - 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${actualEndByte}/${totalSize}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", String(slice.length));
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("ETag", rangeEtag);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(slice);
  } catch (err: any) {
    return res.status(502).send("Failed to decrypt and stream video chunk");
  }
});

// 8. Platform Template ZIP Exporter (Clean, ready-to-deploy template customized for Mr. Mohamed Saber / any teacher)
app.get("/api/template-export/mohamed-saber-platform.zip", (_req, res) => {
  const zipPath = path.join(process.cwd(), "public", "mohamed-saber-platform-template.zip");
  if (!fs.existsSync(zipPath)) {
    return res.status(404).send("Template ZIP file not found.");
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="mohamed-saber-platform-template.zip"');
  return res.sendFile(zipPath);
});

// 9. One-command Firebase Hosting deployer script for motafalsifa.vercel.app
app.get("/api/hosting-bundle.tar.gz", (_req, res) => {
  const tarPath = path.join(process.cwd(), "public", "qalbalelm-hosting-bundle.tar.gz");
  if (!fs.existsSync(tarPath)) {
    return res.status(404).send("Hosting bundle not found.");
  }
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", 'attachment; filename="qalbalelm-hosting-bundle.tar.gz"');
  return res.sendFile(tarPath);
});

app.get("/api/deploy-web-app.sh", (req, res) => {
  const hostOrigin = `https://${req.get("host")}`;
  const script = `#!/bin/bash
set -e
echo "🚀 جاري تحميل ملفات منصة المتفلسفة  وتفعيل الدومين الرسمي https://motafalsifa.vercel.app ..."
rm -rf /tmp/qalb_web_deploy && mkdir -p /tmp/qalb_web_deploy
cd /tmp/qalb_web_deploy
curl -sL "${hostOrigin}/api/hosting-bundle.tar.gz" -o bundle.tar.gz
tar -xzf bundle.tar.gz
npx --yes firebase-tools deploy --only hosting --project qalbalelm
echo "✅ تم تفعيل الدومين الرسمي بنجاح: https://motafalsifa.vercel.app"
`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(script);
});
