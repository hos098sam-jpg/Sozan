import {
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
  ConfirmationResult,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocFromCache,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { app, auth, db, handleFirestoreError, OperationType } from './firebase';
import type { User } from './types';
import { getSecureCache, setSecureCache } from './utils/secureStorage';
import { getDeviceInfoPayload } from './utils/deviceFingerprint';

export { app, auth, db };

export function getFriendlyAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات أو استعادة كلمة المرور.';
    case 'auth/email-already-in-use':
      return 'هذا الرقم أو البريد الإلكتروني مسجل مسبقاً في المنصة، يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.';
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
      return 'حدث خطأ أثناء التحقق من الحساب، يرجى المحاولة مرة أخرى.';
  }
}

function isJsonResponse(res: Response | null): res is Response {
  if (!res) return false;
  const cType = res.headers.get('content-type') || '';
  return cType.includes('application/json');
}

/**
 * Login with Email and Password strictly verified by Firebase Authentication.
 * Never creates or returns unverified fallback users.
 */
export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    return credential.user;
  } catch (authErr: any) {
    // Support legacy synthetic domain aliases strictly via real Firebase Auth verification
    const syntheticDomains = ['@al-motafalsifa.edu', '@qalb-alam.edu', '@qalbalelm.edu', '@qalbalam.edu'];
    const matchedDomain = syntheticDomains.find((d) => cleanEmail.endsWith(d));
    if (matchedDomain) {
      const localPart = cleanEmail.slice(0, -matchedDomain.length);
      for (const altDomain of syntheticDomains) {
        if (altDomain === matchedDomain) continue;
        try {
          const altCred = await signInWithEmailAndPassword(auth, `${localPart}${altDomain}`, cleanPass);
          return altCred.user;
        } catch {}
      }
    }
    throw authErr;
  }
}

let pendingSignupProfile: Partial<User> | null = null;

export function getPendingSignupProfile(): Partial<User> | null {
  return pendingSignupProfile;
}

/**
 * Sign up with Email, Password and create verified Firestore User Profile.
 * Strictly enforces role='student', status='active', schoolYear='الصف الأول الثانوي',
 * and NEVER stores plaintext passwords in browser storage or Firestore.
 */
export async function signupWithEmail(
  email: string,
  pass: string,
  profileData: Partial<User>
): Promise<{ user: FirebaseUser; profile: User }> {
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
    (profileData.name &&
    profileData.name.trim() &&
    !profileData.name.includes('قلب العلم') &&
    profileData.name.trim() !== 'مستخدم منصة المتفلسفة'
      ? profileData.name.trim()
      : compositeName) || 'طالب منصة المتفلسفة';

  // Enforce strict student-only defaults on public signup (prevent role/status/grade escalation)
  const enrichedProfileData: Partial<User> = {
    firstName: (profileData.firstName || '').trim(),
    secondName: (profileData.secondName || '').trim(),
    thirdName: (profileData.thirdName || '').trim(),
    lastName: (profileData.lastName || '').trim(),
    name: resolvedStudentName,
    email: cleanEmail,
    phone: (profileData.phone || '').trim(),
    parentPhone: (profileData.parentPhone || profileData.fatherPhone || profileData.motherPhone || '').trim(),
    fatherPhone: (profileData.fatherPhone || '').trim(),
    motherPhone: (profileData.motherPhone || '').trim(),
    governorate: profileData.governorate || 'السويس',
    schoolName: (profileData.schoolName || '').trim(),
    educationSystem: profileData.educationSystem || 'عربي',
    religion: profileData.religion || 'التربية الدينية الإسلامية',
    gender: profileData.gender || 'ذكر',
    schoolYear: 'الصف الأول الثانوي',
    role: 'student',
    status: 'active',
    enrolledCourseIds: [],
    examResults: {},
  };

  pendingSignupProfile = enrichedProfileData;

  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const fbUser = credential.user;

    pendingSignupProfile = {
      ...enrichedProfileData,
      id: fbUser.uid,
    };

    try {
      await updateProfile(fbUser, { displayName: resolvedStudentName });
    } catch {}

    const userRef = doc(db, 'users', fbUser.uid);
    const userDoc: Record<string, any> = {
      uid: fbUser.uid,
      id: fbUser.uid,
      name: resolvedStudentName,
      firstName: enrichedProfileData.firstName,
      secondName: enrichedProfileData.secondName,
      thirdName: enrichedProfileData.thirdName,
      lastName: enrichedProfileData.lastName,
      email: cleanEmail,
      phone: enrichedProfileData.phone,
      parentPhone: enrichedProfileData.parentPhone,
      fatherPhone: enrichedProfileData.fatherPhone,
      motherPhone: enrichedProfileData.motherPhone,
      governorate: enrichedProfileData.governorate,
      schoolName: enrichedProfileData.schoolName,
      educationSystem: enrichedProfileData.educationSystem,
      religion: enrichedProfileData.religion,
      gender: enrichedProfileData.gender,
      schoolYear: 'الصف الأول الثانوي',
      role: 'student',
      status: 'active',
      emailVerified: fbUser.emailVerified,
      currentDeviceId: deviceInfo.deviceId || '',
      currentDeviceName: deviceInfo.deviceName || '',
      enrolledCourseIds: [],
      examResults: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      registeredAt: new Date().toISOString().split('T')[0],
    };

    try {
      await setDoc(userRef, userDoc);
    } catch (firestoreError) {
      handleFirestoreError(firestoreError, OperationType.CREATE, `users/${fbUser.uid}`);
      throw firestoreError;
    }

    const finalProfile: User = {
      ...(userDoc as unknown as User),
      id: fbUser.uid,
      registeredAt: userDoc.registeredAt,
    };
    setSecureCache('al_motafalsifa_current_user', finalProfile);
    pendingSignupProfile = null;
    return { user: fbUser, profile: finalProfile };
  } catch (authErr) {
    pendingSignupProfile = null;
    throw authErr;
  }
}

export async function resetPassword(email: string) {
  const cleanEmail = email.trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('الرجاء إدخال بريد إلكتروني صالح.');
  }
  return await sendPasswordResetEmail(auth, cleanEmail);
}

export async function resendEmailVerification() {
  if (!auth.currentUser) {
    throw new Error('يجب تسجيل الدخول لإعادة إرسال رسالة التفعيل.');
  }
  return await sendEmailVerification(auth.currentUser);
}

export async function logoutUser() {
  return await firebaseSignOut(auth);
}

export async function getFirebaseIdToken(forceRefresh: boolean = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch (e) {
    console.error('Error getting Firebase ID token:', e);
    return null;
  }
}

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
    const cached = getSecureCache<string[]>(`al_motafalsifa_enrolled_courses_${uid}`);
    if (Array.isArray(cached.data)) return cached.data.filter(Boolean);
  } catch {}
  return [];
};

const saveLocalEnrolledCourses = (uid: string, courseIds: string[]) => {
  try {
    const clean = Array.from(new Set(courseIds.filter(Boolean)));
    setSecureCache(`al_motafalsifa_enrolled_courses_${uid}`, clean);
  } catch {}
};

function isBlockedUser(uid: string, data?: any): boolean {
  if (uid === 'teacher-1822115595240' || uid === 'SfE3LtThTFfDbYBAQuTsdLaRXVs1') return true;
  if (data) {
    if (data.phone === 'teacher-4879' || data.phone === '4879') return true;
    if (data.name?.trim() === 'حسام احمد مساعد') return true;
  }
  try {
    const deleted = localStorage.getItem('al_motafalsifa_deleted_user_ids');
    if (deleted && JSON.parse(deleted).includes(uid)) return true;
  } catch {}
  return false;
}

export async function fetchUserProfile(uid: string): Promise<User | null> {
  if (isBlockedUser(uid)) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    let snap: any = null;
    try {
      snap = await getDocFromCache(userDocRef);
    } catch {}
    const cachedData = snap?.exists?.() ? snap.data() : null;
    if (!snap || !snap.exists() || !cachedData?.name || !cachedData?.phone) {
      try {
        const freshSnap = await getDoc(userDocRef);
        if (freshSnap && freshSnap.exists()) {
          snap = freshSnap;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    }
    if (snap && snap.exists()) {
      const data = snap.data() as User;
      if (isBlockedUser(uid, data)) return null;
      // Never read unverified client enrolledCourseIds ahead of authoritative Firestore data
      const remoteCourses = Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds : [];
      saveLocalEnrolledCourses(uid, remoteCourses);
      const compositeName = [data.firstName, data.secondName, data.thirdName, data.lastName]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' ');
      const repairedName =
        data.name && data.name.trim() && data.name.trim() !== 'مستخدم منصة المتفلسفة'
          ? data.name.trim()
          : compositeName || (data.email === 'hos098sam@gmail.com' ? 'إدارة المنصة' : data.name);
      const emailPhoneMatch = (data.email || '').match(/^(\d{10,14})@(?:al-motafalsifa|qalb-alam|qalbalelm|qalbalam)\.edu$/i);
      const repairedPhone = (data.phone && data.phone.trim()) || (emailPhoneMatch ? emailPhoneMatch[1] : '');
      const repairedParentPhone = (data.parentPhone && data.parentPhone.trim()) || data.fatherPhone || data.motherPhone || '';
      const cleanUser: User = {
        ...data,
        id: data.id || uid,
        name: repairedName,
        phone: repairedPhone,
        parentPhone: repairedParentPhone,
        enrolledCourseIds: remoteCourses,
      };
      delete (cleanUser as any).password;
      return cleanUser;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function formatPhoneE164(phone: string): string {
  let clean = phone.trim().replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('00')) return '+' + clean.slice(2);
  if (clean.startsWith('01')) return '+2' + clean;
  if (clean.startsWith('1') && clean.length === 10) return '+20' + clean;
  if (clean.startsWith('0')) return '+2' + clean;
  return '+20' + clean;
}

export function initPhoneRecaptcha(containerId: string): RecaptchaVerifier {
  if (typeof window !== 'undefined' && (window as any)._motafalsifaRecaptchaVerifier) {
    try {
      (window as any)._motafalsifaRecaptchaVerifier.clear();
    } catch {}
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, please retry.');
    },
  });

  if (typeof window !== 'undefined') {
    (window as any)._motafalsifaRecaptchaVerifier = verifier;
  }
  return verifier;
}

export async function sendPhoneOtp(
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  const formatted = formatPhoneE164(phoneNumber);
  return await signInWithPhoneNumber(auth, formatted, verifier);
}

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
 * Admin/Teacher status update in Firestore (enforced by firestore.rules)
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
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    return false;
  }
}

/**
 * Authorized enrollment persistence in Firestore (Admin/Teacher or server-verified flows).
 * Firestore rules reject unauthorized student self-enrollment in paid courses.
 */
export async function enrollStudentInCourseInFirestore(
  uid: string,
  courseId: string
): Promise<string[]> {
  try {
    const userRef = doc(db, 'users', uid);
    let remoteCourses: string[] = [];
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        remoteCourses = Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds : [];
      }
    } catch {}

    const merged = Array.from(new Set([...remoteCourses, courseId]));
    await setDoc(
      userRef,
      {
        enrolledCourseIds: merged,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    saveLocalEnrolledCourses(uid, merged);
    return merged;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    return getLocalEnrolledCourses(uid);
  }
}

export async function updateUserEnrolledCoursesInFirestore(
  uid: string,
  courseIds: string[]
): Promise<boolean> {
  try {
    const cleanList = Array.from(new Set(courseIds.filter(Boolean)));
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        enrolledCourseIds: cleanList,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    saveLocalEnrolledCourses(uid, cleanList);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    return false;
  }
}

export type { ConfirmationResult };

export async function getIdTokenFromAuth(forceRefresh: boolean = false): Promise<string | null> {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken(forceRefresh);
    }
  } catch {}
  return null;
}

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

export async function requestWhatsAppLoginOtp(
  identifier: string,
  password?: string
): Promise<WhatsAppOtpRequestResponse> {
  const res = await fetch('/api/auth/login-otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!isJsonResponse(res)) {
    throw new Error('خدمة إرسال كود الواتساب تتطلب تفعيل السيرفر الخلفي، يمكنك تسجيل الدخول مباشرة بكلمة المرور.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إرسال كود التحقق عبر الواتساب.');
  }
  return data;
}

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
  if (!isJsonResponse(res)) {
    throw new Error('تعذر التحقق من كود الواتساب لعدم توفر السيرفر الخلفي حالياً.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'رمز التحقق غير صحيح.');
  }
  if (data.customToken) {
    await signInWithCustomToken(auth, data.customToken);
  }
  return data;
}

export async function requestWhatsAppForgotPasswordOtp(
  identifier: string,
  recoveryEmail?: string
): Promise<WhatsAppOtpRequestResponse> {
  const res = await fetch('/api/auth/forgot-password-otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, recoveryEmail }),
  });
  if (!isJsonResponse(res)) {
    throw new Error('يرجى استخدام بريدك الإلكتروني لاستعادة كلمة المرور عبر Firebase أو التواصل مع إدارة المنصة.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إرسال رمز استعادة كلمة المرور.');
  }
  return data;
}

export async function verifyWhatsAppForgotPasswordOtp(
  sessionId: string,
  otp: string
): Promise<WhatsAppOtpVerifyResetResponse> {
  const res = await fetch('/api/auth/forgot-password-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, otp }),
  });
  if (!isJsonResponse(res)) {
    throw new Error('خدمة التحقق عبر السيرفر الخلفي غير متاحة حالياً.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'رمز الاستعادة غير صحيح.');
  }
  return data;
}

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
  if (!isJsonResponse(res)) {
    throw new Error('خدمة إعادة التعيين عبر السيرفر الخلفي غير متاحة حالياً.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل تعيين كلمة المرور الجديدة.');
  }
  return data;
}

export async function resendWhatsAppOtp(
  sessionId: string
): Promise<{ success: boolean; cooldownSeconds: number; message: string }> {
  const res = await fetch('/api/auth/otp/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!isJsonResponse(res)) {
    throw new Error('خدمة إعادة الإرسال غير متاحة حالياً.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'فشل إعادة إرسال رمز التحقق.');
  }
  return data;
}

export async function deleteUserFromFirestore(uid: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    return false;
  }
}

export async function updateUserSessionInFirestore(uid: string, sessionId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { activeSessionId: sessionId, lastLoginAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    return false;
  }
}

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
 * Server-verified Parent WhatsApp OTP request.
 * Never fabricates or returns client-side OTP secrets.
 */
export async function requestWhatsAppParentOtp(
  parentPhone: string,
  options?: {
    studentId?: string;
    studentPhone?: string;
    studentName?: string;
  }
): Promise<WhatsAppParentOtpRequestResponse> {
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
  if (!isJsonResponse(res)) {
    throw new Error('بوابة التحقق عبر الواتساب تتطلب ربط السيرفر الخلفي، يرجى استخدام تسجيل الدخول بحساب ولي الأمر أو التواصل مع إدارة المنصة.');
  }
  const data = await res.json();
  if (!res.ok) {
    const errorObj = new Error(data.error || 'فشل إرسال رمز التحقق إلى واتساب ولي الأمر.');
    (errorObj as any).status = res.status;
    (errorObj as any).notFound = data.notFound;
    throw errorObj;
  }
  return data;
}

/**
 * Server-verified Parent WhatsApp OTP verification.
 */
export async function verifyWhatsAppParentOtp(
  sessionId: string,
  otp: string,
  _fallbackStudent?: User
): Promise<WhatsAppParentOtpVerifyResponse> {
  const cleanOtp = otp.trim();
  const res = await fetch('/api/auth/parent-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, otp: cleanOtp }),
  });
  if (!isJsonResponse(res)) {
    throw new Error('تعذر التحقق من الرمز لعدم توفر السيرفر الخلفي حالياً.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'رمز التحقق غير صحيح أو انتهت صلاحيته.');
  }
  return data;
}

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
    handleFirestoreError(err, OperationType.UPDATE, `users/${studentId}`);
    return false;
  }
}
