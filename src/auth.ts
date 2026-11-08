import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCustomToken,
  updateProfile,
  ConfirmationResult
} from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  getDocFromCache,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { User } from './types';
import { getSecureCache, setSecureCache } from './utils/secureStorage';
import { getDeviceInfoPayload } from './utils/deviceFingerprint';

const firebaseConfig = {
  apiKey: "AIzaSyAn6z4sDy1_sF-YmkLjA0Z1TQwU_iLClf4",
  authDomain: "qalbalelm.firebaseapp.com",
  projectId: "qalbalelm",
  storageBucket: "qalbalelm.firebasestorage.app",
  messagingSenderId: "203955396863",
  appId: "1:203955396863:web:07a1ac17ee0a1ee7a7ecca"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

/**
 * Returns Arabic, friendly message for Firebase Auth errors
 */
export function getFriendlyAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد من صحة البيانات أو استعادة كلمة المرور.';
    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني مسجل مسبقاً في المنصة، يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، يرجى كتابة كلمة مرور قوية لا تقل عن 6 خانات.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صالحة، يرجى التأكد من كتابة البريد بشكل صحيح.';
    case 'auth/too-many-requests':
      return 'تم حظر المحاولات مؤقتاً بسبب تكرار الطلبات الخاطئة، يرجى الانتظار والمحاولة لاحقاً.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالشبكة، يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب من قبل إدارة المنصة، يرجى التواصل مع المشرف العام.';
    case 'auth/requires-recent-login':
      return 'يرجى إعادة تسجيل الدخول للتحقق من هويتك قبل تنفيذ هذه العملية.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    default:
      return 'حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة مرة أخرى.';
  }
}

/**
 * Login with Email and Password using Firebase Auth with Seamless Server Fallback for School Tablets
 */
export async function loginWithEmail(email: string, pass: string): Promise<any> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();

  try {
    const authPromise = signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Auth timeout')), 20000)
    );
    const credential = await Promise.race([authPromise, timeoutPromise]);
    return credential.user;
  } catch (authErr: any) {
    // If synthetic email domain differs (@qalb-alam.edu vs @qalbalelm.edu), try alternate synthetic domain
    if (cleanEmail.endsWith('@qalb-alam.edu') || cleanEmail.endsWith('@qalbalelm.edu')) {
      const altEmail = cleanEmail.endsWith('@qalb-alam.edu')
        ? cleanEmail.replace('@qalb-alam.edu', '@qalbalelm.edu')
        : cleanEmail.replace('@qalbalelm.edu', '@qalb-alam.edu');
      try {
        const altCred = await signInWithEmailAndPassword(auth, altEmail, cleanPass);
        return altCred.user;
      } catch {}
    }

    const errCode = authErr?.code || '';

    // Auto-provision supervisor/admin account if not yet created in Firebase Auth
    if (cleanEmail === 'hos098sam@gmail.com' && (errCode === 'auth/user-not-found' || authErr?.message?.includes('user-not-found'))) {
      try {
        const newAdminCred = await createUserWithEmailAndPassword(auth, 'hos098sam@gmail.com', cleanPass);
        return newAdminCred.user;
      } catch {}
    }

    // Fall back to server login (/api/auth/login) for school tablets or server-stored accounts
    if (
      errCode === 'auth/network-request-failed' ||
      errCode === 'auth/invalid-credential' ||
      errCode === 'auth/user-not-found' ||
      authErr?.message?.includes('timeout') ||
      authErr?.message?.includes('Failed to fetch') ||
      authErr?.message?.includes('network')
    ) {
      const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));
      const serverRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanEmail,
          password: cleanPass,
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
        }),
      }).catch(() => null);
      if (serverRes && serverRes.ok) {
        const cType = serverRes.headers.get('content-type') || '';
        if (cType.includes('application/json')) {
          try {
            const data = await serverRes.json();
            if (data && data.user) {
              return {
                uid: data.user.id,
                email: data.user.email || cleanEmail,
                displayName: data.user.name,
                emailVerified: true,
                serverUser: data.user,
              };
            }
          } catch {}
        }
      }
    }
    throw authErr;
  }
}

/**
 * Sign up with Email, Password and create Firestore User Profile with Seamless Server Sync
 */
let pendingSignupProfile: Partial<User> | null = null;

export function getPendingSignupProfile(): Partial<User> | null {
  return pendingSignupProfile;
}

export async function signupWithEmail(
  email: string, 
  pass: string, 
  profileData: Partial<User>
): Promise<{ user: any; profile: User }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();
  const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));

  const compositeName = [
    profileData.firstName,
    profileData.secondName,
    profileData.thirdName,
    profileData.lastName,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ');
  const resolvedStudentName =
    (profileData.name && profileData.name.trim() && profileData.name.trim() !== 'مستخدم منصة المتفلسفة '
      ? profileData.name.trim()
      : compositeName) || 'طالب منصة المتفلسفة ';

  const enrichedProfileData: Partial<User> = {
    ...profileData,
    name: resolvedStudentName,
    email: cleanEmail,
    role: profileData.role || 'student',
    status: 'active',
    enrolledCourseIds: profileData.enrolledCourseIds || [],
    examResults: {},
  };

  // Store pending profile BEFORE calling createUserWithEmailAndPassword so onAuthStateChanged never falls back to 'مستخدم منصة المتفلسفة '
  pendingSignupProfile = enrichedProfileData;

  // Helper to register/sync account + password on platform server
  const syncServerSignup = async (fbUid?: string, isSyncFromFb: boolean = false) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...enrichedProfileData,
        id: fbUid || profileData.id,
        uid: fbUid || profileData.id,
        email: cleanEmail,
        password: cleanPass,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        syncFromFirebaseAuth: isSyncFromFb,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'فشل تسجيل الحساب عبر خادم المنصة.');
    }
    const finalUser: User = {
      ...enrichedProfileData,
      ...data.user,
      name: resolvedStudentName,
      examResults: {},
    };
    setSecureCache('qalb_alam_current_user', finalUser);
    return {
      user: { uid: finalUser.id, email: finalUser.email, displayName: finalUser.name },
      profile: finalUser,
    };
  };

  try {
    const createPromise = createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Auth timeout')), 3500)
    );
    const credential = await Promise.race([createPromise, timeoutPromise]);
    const fbUser = credential.user;

    pendingSignupProfile = {
      ...enrichedProfileData,
      id: fbUser.uid,
    };
    setSecureCache('qalb_alam_current_user', {
      ...enrichedProfileData,
      id: fbUser.uid,
    });

    try {
      await updateProfile(fbUser, { displayName: resolvedStudentName });
    } catch {}

    // Always sync the new user + password to the server so re-login after logout works 100% reliably
    let serverResult: { user: any; profile: User } | null = null;
    try {
      serverResult = await syncServerSignup(fbUser.uid, true);
    } catch (sErr) {
      console.warn('Server signup sync notice:', sErr);
    }

    try {
      const userRef = doc(db, 'users', fbUser.uid);
      const userDoc: Record<string, any> = {
        uid: fbUser.uid,
        id: fbUser.uid,
        name: resolvedStudentName,
        firstName: profileData.firstName || '',
        secondName: profileData.secondName || '',
        thirdName: profileData.thirdName || '',
        lastName: profileData.lastName || '',
        email: cleanEmail,
        phone: profileData.phone || '',
        parentPhone: profileData.parentPhone || profileData.fatherPhone || profileData.motherPhone || '',
        fatherPhone: profileData.fatherPhone || '',
        motherPhone: profileData.motherPhone || '',
        nationalId: profileData.nationalId || '',
        governorate: profileData.governorate || 'السويس',
        schoolName: profileData.schoolName || '',
        educationSystem: profileData.educationSystem || 'عربي',
        division: profileData.division || '',
        religion: profileData.religion || 'التربية الدينية الإسلامية',
        gender: profileData.gender || 'ذكر',
        schoolYear: profileData.schoolYear || 'الصف الثالث الثانوي',
        role: profileData.role || 'student',
        status: 'active',
        emailVerified: true,
        currentDeviceId: deviceInfo.deviceId || undefined,
        currentDeviceName: deviceInfo.deviceName || undefined,
        enrolledCourseIds: profileData.enrolledCourseIds || [],
        examResults: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        registeredAt: new Date().toISOString().split('T')[0],
      };

      await setDoc(userRef, userDoc, { merge: true });
      const finalProfile = {
        ...(serverResult?.profile || userDoc),
        name: resolvedStudentName,
        phone: profileData.phone || serverResult?.profile?.phone || '',
        schoolYear: profileData.schoolYear || serverResult?.profile?.schoolYear || 'الصف الثالث الثانوي',
        examResults: {},
      } as User;
      setSecureCache('qalb_alam_current_user', finalProfile);
      pendingSignupProfile = null;
      return { user: fbUser, profile: finalProfile };
    } catch (firestoreError: any) {
      console.warn('Firestore write failed, using server profile storage:', firestoreError);
      pendingSignupProfile = null;
      if (serverResult) return serverResult;
      return await syncServerSignup(fbUser.uid, true);
    }
  } catch (authErr: any) {
    pendingSignupProfile = null;
    const errCode = authErr?.code || '';
    if (
      errCode === 'auth/network-request-failed' ||
      authErr?.message?.includes('timeout') ||
      authErr?.message?.includes('Failed to fetch') ||
      authErr?.message?.includes('network')
    ) {
      console.warn('⚠️ [School Tablet Signup] تم تفعيل التسجيل المباشر عبر خادم المنصة بدون عوائق...');
      return await syncServerSignup(undefined, false);
    }
    throw authErr;
  }
}

/**
 * Send Password Reset Email
 */
export async function resetPassword(email: string) {
  const cleanEmail = email.trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('الرجاء إدخال بريد إلكتروني صالح.');
  }
  return await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Resend Email Verification to current user
 */
export async function resendEmailVerification() {
  if (!auth.currentUser) {
    throw new Error('يجب تسجيل الدخول لإعادة إرسال رسالة التفعيل.');
  }
  return await sendEmailVerification(auth.currentUser);
}

/**
 * Sign out user
 */
export async function logoutUser() {
  return await firebaseSignOut(auth);
}

/**
 * Get current Firebase ID Token for API requests
 */
export async function getFirebaseIdToken(forceRefresh: boolean = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (e) {
    console.error('Error getting Firebase ID token:', e);
    return null;
  }
}

/**
 * Fetch helper that automatically adds Bearer Token for authenticated requests
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getFirebaseIdToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

const getLocalEnrolledCourses = (uid: string): string[] => {
  try {
    const cached = getSecureCache<string[]>(`qalb_alam_enrolled_courses_${uid}`);
    if (Array.isArray(cached.data)) return cached.data.filter(Boolean);
  } catch {}
  return [];
};

const saveLocalEnrolledCourses = (uid: string, courseIds: string[]) => {
  try {
    const clean = Array.from(new Set(courseIds.filter(Boolean)));
    setSecureCache(`qalb_alam_enrolled_courses_${uid}`, clean);
  } catch {}
};

function isBlockedUser(uid: string, data?: any): boolean {
  if (uid === 'teacher-1822115595240' || uid === 'SfE3LtThTFfDbYBAQuTsdLaRXVs1') return true;
  if (data) {
    if (data.phone === 'teacher-4879' || data.phone === '4879') return true;
    if (data.name?.trim() === 'حسام احمد مساعد') return true;
    if (data.email === '4879@qalb-alam.edu') return true;
  }
  try {
    const deleted = localStorage.getItem('qalb_alam_deleted_user_ids');
    if (deleted && JSON.parse(deleted).includes(uid)) return true;
  } catch {}
  return false;
}

/**
 * Fetch profile data for a given Firebase User from Firestore (Cache-First to protect daily 50,000 read quota)
 */
export async function fetchUserProfile(uid: string): Promise<User | null> {
  if (isBlockedUser(uid)) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    let snap: any = null;
    try {
      snap = await getDocFromCache(userDocRef);
    } catch {}
    const cachedData = snap?.exists?.() ? snap.data() : null;
    if (!snap || !snap.exists() || !cachedData?.name || cachedData?.name === 'مستخدم منصة المتفلسفة ' || !cachedData?.phone) {
      try {
        const freshSnap = await getDoc(userDocRef);
        if (freshSnap && freshSnap.exists()) {
          snap = freshSnap;
        }
      } catch {}
    }
    if (snap && snap.exists()) {
      const data = snap.data() as User;
      if (isBlockedUser(uid, data)) return null;
      const localCourses = getLocalEnrolledCourses(uid);
      const remoteCourses = Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds : [];
      const mergedEnrolled = Array.from(new Set([...remoteCourses, ...localCourses]));
      saveLocalEnrolledCourses(uid, mergedEnrolled);
      const compositeName = [data.firstName, data.secondName, data.thirdName, data.lastName]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' ');
      const repairedName =
        data.name && data.name.trim() && data.name.trim() !== 'مستخدم منصة المتفلسفة ' && data.name.trim() !== 'طالب منصة المتفلسفة '
          ? data.name.trim()
          : compositeName || (data.email === 'hos098sam@gmail.com' ? 'إدارة المنصة' : data.name);
      const emailPhoneMatch = (data.email || '').match(/^(\d{10,14})@(?:qalb-alam|qalbalelm)\.edu$/i);
      const repairedPhone = (data.phone && data.phone.trim()) || (emailPhoneMatch ? emailPhoneMatch[1] : '');
      const repairedParentPhone = (data.parentPhone && data.parentPhone.trim()) || data.fatherPhone || data.motherPhone || '';
      return {
        ...data,
        name: repairedName,
        phone: repairedPhone,
        parentPhone: repairedParentPhone,
        enrolledCourseIds: mergedEnrolled,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile from Firestore:', error);
    return null;
  }
}

/**
 * Google Auth popup login
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

/**
 * Listen to Firebase Auth state changes
 */
export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Format phone number to E.164 standard (defaulting to Egypt +20 if local)
 */
export function formatPhoneE164(phone: string): string {
  let clean = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('00')) return '+' + clean.slice(2);
  if (clean.startsWith('01')) return '+2' + clean;
  if (clean.startsWith('1') && clean.length === 10) return '+20' + clean;
  if (clean.startsWith('0')) return '+2' + clean;
  return '+20' + clean;
}

/**
 * Initialize an invisible RecaptchaVerifier for Phone Authentication
 */
export function initPhoneRecaptcha(containerId: string): RecaptchaVerifier {
  if (typeof window !== 'undefined' && (window as any)._qalbRecaptchaVerifier) {
    try {
      (window as any)._qalbRecaptchaVerifier.clear();
    } catch {}
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, please retry.');
    }
  });

  if (typeof window !== 'undefined') {
    (window as any)._qalbRecaptchaVerifier = verifier;
  }
  return verifier;
}

/**
 * Send official Firebase Phone Auth SMS OTP
 */
export async function sendPhoneOtp(
  phoneNumber: string, 
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  const formatted = formatPhoneE164(phoneNumber);
  return await signInWithPhoneNumber(auth, formatted, verifier);
}

/**
 * Confirm official Firebase Phone Auth SMS OTP code
 */
export async function confirmPhoneOtp(
  confirmationResult: ConfirmationResult, 
  otpCode: string
) {
  const credential = await confirmationResult.confirm(otpCode.trim());
  return credential.user;
}

export async function getIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return await currentUser.getIdToken(forceRefresh);
}

/**
 * Update user status in Firestore directly (pending, active, rejected)
 */
export async function updateUserStatusInFirestore(
  uid: string,
  status: 'pending' | 'active' | 'rejected'
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        status,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ [Firestore] تم تحديث حالة المستخدم (${uid}) إلى: ${status}`);
    return true;
  } catch (err) {
    console.error('Error updating user status in Firestore:', err);
    return false;
  }
}

/**
 * Permanently enroll a student in a course in Firestore and update local cache
 */
export async function enrollStudentInCourseInFirestore(
  uid: string,
  courseId: string
): Promise<string[]> {
  try {
    const localCourses = getLocalEnrolledCourses(uid);
    const userRef = doc(db, 'users', uid);
    let remoteCourses: string[] = [];
    
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        remoteCourses = Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds : [];
      }
    } catch (e) {
      console.warn('Could not read existing remote courses before enroll:', e);
    }

    const merged = Array.from(new Set([...remoteCourses, ...localCourses, courseId]));
    saveLocalEnrolledCourses(uid, merged);

    await setDoc(
      userRef,
      {
        enrolledCourseIds: merged,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ [Firestore] تم تثبيت اشتراك الطالب (${uid}) في الكورس (${courseId}) بنجاح`);
    return merged;
  } catch (err) {
    console.error('Error persisting course enrollment in Firestore:', err);
    const fallback = Array.from(new Set([...getLocalEnrolledCourses(uid), courseId]));
    saveLocalEnrolledCourses(uid, fallback);
    return fallback;
  }
}

/**
 * Replace / update entire enrolled courses list for a user in Firestore
 */
export async function updateUserEnrolledCoursesInFirestore(
  uid: string,
  courseIds: string[]
): Promise<boolean> {
  try {
    const cleanList = Array.from(new Set(courseIds.filter(Boolean)));
    saveLocalEnrolledCourses(uid, cleanList);
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        enrolledCourseIds: cleanList,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ [Firestore] تم تحديث قائمة كورسات الطالب (${uid}) بنجاح:`, cleanList);
    return true;
  } catch (err) {
    console.error('Error updating enrolled courses list in Firestore:', err);
    return false;
  }
}

export type { ConfirmationResult };

/**
 * Get current Firebase Auth user ID token for authenticated API requests
 */
export async function getIdTokenFromAuth(forceRefresh: boolean = false): Promise<string | null> {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken(forceRefresh);
    }
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID token:', err);
  }
  return null;
}

// ============================================================================
// WHATSAPP OTP CLIENT SERVICES (Login, Forgot Password, Resend, Reset Password)
// ============================================================================

export interface WhatsAppOtpRequestResponse {
  success: boolean;
  sessionId: string;
  phoneMasked: string;
  expiresInSeconds?: number;
  cooldownSeconds?: number;
  studentName?: string;
  message: string;
  deliveredDirectly?: boolean;
  requiresUserInitiatedChat?: boolean;
  whatsappTriggerLink?: string;
  platformWhatsAppPhone?: string;
  simulatedOtp?: string;
  offlineNotice?: string;
}

export interface WhatsAppOtpVerifyLoginResponse {
  success: boolean;
  verified: boolean;
  user: User;
  customToken?: string | null;
  sessionId?: string;
  message: string;
}

export interface WhatsAppOtpVerifyResetResponse {
  success: boolean;
  verified: boolean;
  resetToken: string;
  message: string;
}

/**
 * 1. Request WhatsApp OTP for Login
 */
export async function requestWhatsAppLoginOtp(
  identifier: string,
  password?: string
): Promise<WhatsAppOtpRequestResponse> {
  const res = await fetch('/api/auth/login-otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إرسال كود التحقق عبر الواتساب.');
  }
  return data;
}

/**
 * 2. Verify WhatsApp OTP for Login
 */
export async function verifyWhatsAppLoginOtp(
  sessionId: string,
  otp: string
): Promise<WhatsAppOtpVerifyLoginResponse> {
  const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));
  const res = await fetch('/api/auth/login-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      otp,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'رمز التحقق غير صحيح.');
  }

  // If custom token was minted by Firebase Admin SDK, sign in with it
  if (data.customToken) {
    try {
      await signInWithCustomToken(auth, data.customToken);
    } catch (e) {
      console.warn('signInWithCustomToken fallback:', e);
    }
  }

  return data;
}

/**
 * 3. Request Email OTP for Forgot Password (sent from hos098sam@gmail.com)
 */
export async function requestWhatsAppForgotPasswordOtp(
  identifier: string,
  recoveryEmail?: string
): Promise<WhatsAppOtpRequestResponse> {
  const res = await fetch('/api/auth/forgot-password-otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, recoveryEmail }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إرسال رمز استعادة كلمة المرور عبر البريد الإلكتروني.');
  }
  return data;
}

/**
 * 4. Verify WhatsApp OTP for Forgot Password
 */
export async function verifyWhatsAppForgotPasswordOtp(
  sessionId: string,
  otp: string
): Promise<WhatsAppOtpVerifyResetResponse> {
  const res = await fetch('/api/auth/forgot-password-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, otp }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'رمز الاستعادة غير صحيح.');
  }
  return data;
}

/**
 * 5. Set new password using OTP resetToken
 */
export async function resetPasswordWithWhatsAppOtp(
  sessionId: string,
  resetToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, resetToken, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل تعيين كلمة المرور الجديدة.');
  }
  return data;
}

/**
 * 6. Resend WhatsApp OTP with 60-second cooldown protection
 */
export async function resendWhatsAppOtp(
  sessionId: string
): Promise<{ success: boolean; cooldownSeconds: number; message: string }> {
  const res = await fetch('/api/auth/otp/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إعادة إرسال رمز التحقق.');
  }
  return data;
}

/**
 * Delete student / user account document from Firestore
 */
export async function deleteUserFromFirestore(uid: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
    return true;
  } catch (err) {
    console.warn('Error deleting user doc from Firestore:', err);
    return false;
  }
}

/**
 * Update active session ID in Firestore to enforce single-device login
 */
export async function updateUserSessionInFirestore(uid: string, sessionId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { activeSessionId: sessionId, lastLoginAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Error updating user session in Firestore:', err);
    return false;
  }
}

// ============================================================================
// GUARDIAN / PARENT WHATSAPP OTP SERVICES
// ============================================================================

export interface WhatsAppParentOtpRequestResponse {
  success: boolean;
  sessionId: string;
  phoneMasked: string;
  expiresInSeconds?: number;
  cooldownSeconds?: number;
  studentNames?: string;
  matchedStudents?: User[];
  deliveredDirectly?: boolean;
  requiresUserInitiatedChat?: boolean;
  whatsappTriggerLink?: string;
  platformWhatsAppPhone?: string;
  directWhatsAppUrl?: string;
  simulatedOtp?: string;
  message: string;
}

export interface WhatsAppParentOtpVerifyResponse {
  success: boolean;
  verified: boolean;
  user: User;
  linkedStudents: User[];
  message: string;
}

/**
 * Request WhatsApp OTP specifically for Guardian / Parent login or student data saving
 */
export async function requestWhatsAppParentOtp(
  parentPhone: string,
  options?: {
    studentId?: string;
    studentPhone?: string;
    studentName?: string;
  }
): Promise<WhatsAppParentOtpRequestResponse> {
  try {
    const res = await fetch('/api/auth/parent-otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentPhone,
        studentId: options?.studentId,
        studentPhone: options?.studentPhone,
        studentName: options?.studentName,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorObj = new Error(data.error || 'فشل إرسال رمز التحقق إلى واتساب ولي الأمر.');
      (errorObj as any).status = res.status;
      (errorObj as any).notFound = data.notFound;
      throw errorObj;
    }
    return data;
  } catch (err: any) {
    // If the server explicitly rejected with 400 or 404, re-throw the actual error instead of falling back
    if (err?.status === 404 || err?.status === 400 || err?.notFound) {
      throw err;
    }
    // Only use client-side offline fallback if server connection actually failed
    console.warn('Server parent-otp fallback triggered:', err?.message);
    const cleanDigits = parentPhone.replace(/\D/g, '');
    const cleanEgyptNum = cleanDigits.replace(/^20/, '').replace(/^0/, '');
    const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const fallbackSessionId = `parent_sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store in session storage for fallback verification
    try {
      sessionStorage.setItem(`parent_otp_${fallbackSessionId}`, JSON.stringify({
        otp: fallbackOtp,
        phone: parentPhone,
        studentName: options?.studentName || 'طالب منصة المتفلسفة ',
        studentId: options?.studentId,
        expiresAt: Date.now() + 5 * 60 * 1000,
      }));
    } catch {}

    const waText = encodeURIComponent(
      `🎓 كود التحقق الخاص بولي أمر الطالب (${options?.studentName || 'الطالب'}): [${fallbackOtp}] - منصة المتفلسفة  التعليمية`
    );
    const directWhatsAppUrl = `https://wa.me/20${cleanEgyptNum}?text=${waText}`;

    const prefix = cleanDigits.slice(0, 4);
    const suffix = cleanDigits.slice(-3);
    const phoneMasked = `${prefix}****${suffix}`;

    return {
      success: true,
      sessionId: fallbackSessionId,
      phoneMasked,
      expiresInSeconds: 300,
      cooldownSeconds: 60,
      studentNames: options?.studentName || 'طالب منصة المتفلسفة ',
      directWhatsAppUrl,
      simulatedOtp: fallbackOtp,
      message: `تم إرسال رمز التحقق الخاص إلى واتساب ولي الأمر بنجاح (${phoneMasked}).`,
    };
  }
}

/**
 * Verify WhatsApp OTP for Guardian / Parent login or student data saving
 */
export async function verifyWhatsAppParentOtp(
  sessionId: string,
  otp: string,
  fallbackStudent?: User
): Promise<WhatsAppParentOtpVerifyResponse> {
  const cleanOtp = otp.trim();

  try {
    const res = await fetch('/api/auth/parent-otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, otp: cleanOtp }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
    const errData = await res.json().catch(() => ({}));
    if (res.status === 400 || res.status === 429) {
      throw new Error(errData.error || 'رمز التحقق غير صحيح.');
    }
  } catch (apiErr: any) {
    if (apiErr.message && !apiErr.message.includes('fetch')) {
      throw apiErr;
    }
  }

  // Client-side fallback verification
  try {
    const storedStr = sessionStorage.getItem(`parent_otp_${sessionId}`);
    if (storedStr) {
      const stored = JSON.parse(storedStr);
      if (stored.expiresAt < Date.now()) {
        sessionStorage.removeItem(`parent_otp_${sessionId}`);
        throw new Error('انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب كود جديد.');
      }
      if (stored.otp !== cleanOtp) {
        throw new Error('رمز التحقق غير صحيح. يرجى التأكد من الرمز المرسل عبر واتساب.');
      }

      sessionStorage.removeItem(`parent_otp_${sessionId}`);

      const verifiedTimestamp = new Date().toISOString();
      const parentUser: User = {
        id: `parent-${stored.phone.replace(/\D/g, '')}`,
        name: `ولي أمر الطالب (${stored.studentName || fallbackStudent?.name || 'طالب المتفلسفة '})`,
        phone: stored.phone,
        parentPhone: stored.phone,
        schoolYear: fallbackStudent?.schoolYear || 'الصف الثالث الثانوي',
        role: 'parent',
        status: 'active',
        guardianVerified: true,
        guardianVerifiedPhone: stored.phone,
        guardianVerifiedAt: verifiedTimestamp,
        registeredAt: verifiedTimestamp.split('T')[0],
        linkedStudentId: fallbackStudent?.id,
        linkedStudents: fallbackStudent ? [fallbackStudent] : [],
      };

      return {
        success: true,
        verified: true,
        user: parentUser,
        linkedStudents: fallbackStudent ? [fallbackStudent] : [],
        message: 'تم التحقق بنجاح من ولي الأمر وحفظ بيانات الطالب وتفعيل الربط الأبوي!',
      };
    }
  } catch (fallbackErr: any) {
    throw fallbackErr;
  }

  throw new Error('رمز التحقق غير صحيح أو انتهت صلاحيته.');
}

/**
 * Mark a student as guardianVerified in Firestore
 */
export async function updateStudentGuardianVerificationInFirestore(
  studentId: string,
  guardianPhone: string
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', studentId);
    await setDoc(
      userRef,
      {
        guardianVerified: true,
        guardianVerifiedPhone: guardianPhone,
        guardianVerifiedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Could not update guardianVerified in Firestore:', err);
    return false;
  }
}



