/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Award, 
  HeartHandshake, 
  CheckCircle2, 
  ArrowLeft, 
  Quote, 
  Zap, 
  BookOpen, 
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Smartphone,
  Trophy,
  Layers,
  MessageCircle,
  ExternalLink,
  Facebook,
  AlertCircle,
  RefreshCw,
  Cloud,
  Check,
  CheckCircle,
  Clock,
  X
} from 'lucide-react';
import {
  BacBranch,
  ActiveTab,
  AppView,
  User,
  Course,
  Competition,
  PlatformSettings
} from './types';
import { Navbar } from './components/Navbar';
import { Logo } from './components/Logo';
import { TikTokIcon } from './components/TikTokIcon';
import { LandingHome } from './components/LandingHome';
import { CoursesView } from './components/CoursesView';
import { CourseDetailView } from './components/CourseDetailView';
import { CompetitionsView } from './components/CompetitionsView';
import { CompetitionTakeView } from './components/CompetitionTakeView';
import { AdminDashboard } from './components/AdminDashboard';
import { ParentPortalView } from './components/ParentPortalView';
import { AuthModal } from './components/AuthModal';
import { Header } from './components/Header';
import { ChatTutor } from './components/ChatTutor';
import { LessonSummarizer } from './components/LessonSummarizer';
import { ExamGenerator } from './components/ExamGenerator';
import { ProblemSolver } from './components/ProblemSolver';
import { StudyPlanner } from './components/StudyPlanner';
import { BookExamsHub } from './components/BookExamsHub';
import { ForumView } from './components/ForumView';
import { NotificationsView } from './components/NotificationsView';
import { MyCoursesView } from './components/MyCoursesView';
import { MyAccountView } from './components/MyAccountView';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { TeacherPermissionsDashboard } from './components/TeacherPermissionsDashboard';
import { TeacherShowcaseView } from './components/TeacherShowcaseView';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';
import { TeacherAddCoursePage } from './components/TeacherAddCoursePage';
import { TeacherStudentsPage } from './components/TeacherStudentsPage';
import { TeacherStudentProgressPage } from './components/TeacherStudentProgressPage';
import { TeacherEssayGradingPage } from './components/TeacherEssayGradingPage';
import { IdentityModal } from './components/IdentityModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { FlutterMobileAppPreviewModal } from './components/FlutterMobileAppPreviewModal';
import { StudentReviewStatus } from './components/StudentReviewStatus';
import { PrivacyTermsModal } from './components/PrivacyTermsModal';
import { FloatingSupportChat } from './components/FloatingSupportChat';
import { AssistantWorkspaceView } from './components/AssistantWorkspaceView';
import { getDeviceInfoPayload } from './utils/deviceFingerprint';
import {
  getSavedPlatformSettings,
  savePlatformSettings,
  getSavedCourses,
  saveCourses,
  mergeCourses,
  getSavedCompetitions,
  saveCompetitions,
  getSavedUsers,
  saveUsers,
  mergeUsers,
  addDeletedUserId,
  saveSingleUserToServer,
  getCurrentUser,
  saveCurrentUser,
  getStudentEnrolledCourses,
  saveStudentEnrolledCourses,
  saveStudentEnrolledCourse,
  loadAllFromFirebase,
  subscribeToFirebaseRealtime,
  getSavedNotifications,
  getCloudSyncStatus,
  forcePushAllToFirebase,
  deleteCourseFromServer,
  deleteUserFromServer,
  syncDeletedIds,
  getDeletedNotificationIds,
  saveNotifications,
  CloudSyncState
} from './data/initialData';
import { playNotificationSound } from './utils/notifications';
import { DAILY_MOTIVATION, IDENTITY_NOTICE } from './data/bacData';
import { subscribeToAuthChanges, fetchUserProfile, logoutUser, enrollStudentInCourseInFirestore, deleteUserFromFirestore, getPendingSignupProfile, db, auth } from './auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

/**
 * Determine the user's primary/main control dashboard according to their role.
 * Ensures the destination is never rigidly confined to a single view.
 */
export const getMainDashboardView = (user: User | null): AppView => {
  if (!user) return 'home';
  if (user.role === 'admin' || user.email === 'hos098sam@gmail.com') return 'admin';
  if (user.role === 'assistant' || user.isAssistant || Boolean(user.assistantSpecialty)) return 'assistant_workspace';
  if (user.role === 'teacher') return 'teacher_dashboard';
  if (user.role === 'parent') return 'parent_portal';
  if (user.role === 'student') return 'student_dashboard';
  return 'courses';
};

/**
 * Ensure administrative supervisor privileges for the platform owner
 * and guarantee all enrolled course IDs are preserved across local and remote states.
 */
export const ensureUserPrivileges = (u: User): User => {
  if (!u) return u;
  const localEnrolled = u.id ? getStudentEnrolledCourses(u.id) : [];
  const remoteEnrolled = Array.isArray(u.enrolledCourseIds) ? u.enrolledCourseIds : [];
  const mergedEnrolled = Array.from(new Set([...remoteEnrolled, ...localEnrolled]));

  if (mergedEnrolled.length > 0 && u.id) {
    saveStudentEnrolledCourses(u.id, mergedEnrolled);
  }

  const combinedPartsName = [u.firstName, u.secondName, u.thirdName, u.lastName]
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(' ');

  const rawName = (u.name || '').trim();
  const isPlaceholderName =
    !rawName ||
    rawName === 'مستخدم منصة المتفلسفة' ||
    rawName === 'طالب منصة المتفلسفة' ||
    rawName === 'مستخدم المنصة';

  let resolvedPhone = (u.phone || '').trim();
  if (!resolvedPhone && u.email && (u.email.endsWith('@qalb-alam.edu') || u.email.endsWith('@qalbalelm.edu'))) {
    resolvedPhone = u.email.split('@')[0];
  }

  const resolvedParentPhone = (u.parentPhone || u.fatherPhone || u.motherPhone || '').trim();

  const fallbackName =
    u.email === 'hos098sam@gmail.com' || u.role === 'admin'
      ? 'إدارة المنصة'
      : u.role === 'parent'
      ? 'ولي أمر'
      : combinedPartsName
      ? combinedPartsName
      : resolvedPhone
      ? `طالب (${resolvedPhone})`
      : 'مستخدم منصة المتفلسفة';

  const resolvedName = !isPlaceholderName ? rawName : fallbackName;

  const rawSchoolYear = (u.schoolYear || '').trim();
  const resolvedSchoolYear =
    rawSchoolYear && rawSchoolYear !== 'طالب منصة المتفلسفة' && rawSchoolYear !== 'طالب منصة المتفلسفة'
      ? rawSchoolYear
      : u.role === 'admin' || u.email === 'hos098sam@gmail.com'
      ? 'إدارة المنصة'
      : (u.grade || 'الصف الأول الثانوي');

  const updatedUser: User = {
    ...u,
    name: resolvedName,
    phone: resolvedPhone || u.phone || '',
    parentPhone: resolvedParentPhone || u.parentPhone || '',
    schoolYear: resolvedSchoolYear,
    enrolledCourseIds: mergedEnrolled,
  };

  if (u.email === 'hos098sam@gmail.com') {
    return {
      ...updatedUser,
      role: 'admin',
      status: 'active',
      name: updatedUser.name && updatedUser.name !== 'مستخدم منصة المتفلسفة' ? updatedUser.name : 'إدارة المنصة',
    };
  }
  return updatedUser;
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [activeToolTab, setActiveToolTab] = useState<ActiveTab>('book_exams');
  const [branch, setBranch] = useState<BacBranch>('scientific');

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(getSavedPlatformSettings());
  const [courses, setCourses] = useState<Course[]>(getSavedCourses());
  const [competitions, setCompetitions] = useState<Competition[]>(getSavedCompetitions());
  const [students, setStudents] = useState<User[]>(getSavedUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = getCurrentUser();
    return saved ? ensureUserPrivileges(saved) : null;
  });
  const currentUserRef = useRef<User | null>(currentUser);
  currentUserRef.current = currentUser;
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncState>(getCloudSyncStatus());

  // Realtime notification banner when status transitions to 'active'
  const [accountActivatedNotice, setAccountActivatedNotice] = useState<{
    show: boolean;
    message: string;
    targetView: AppView;
  } | null>(null);

  // Single-device session conflict notification
  const [sessionConflictNotice, setSessionConflictNotice] = useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [selectedTeacherForView, setSelectedTeacherForView] = useState<User | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup' | 'parent'>('login');
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [isFlutterAppModalOpen, setIsFlutterAppModalOpen] = useState(false);
  const [isPrivacyTermsModalOpen, setIsPrivacyTermsModalOpen] = useState(false);
  const [privacyTermsInitialTab, setPrivacyTermsInitialTab] = useState<'privacy' | 'terms'>('privacy');
  const [isHomeVisualEditorOpen, setIsHomeVisualEditorOpen] = useState(false);
  const [paymentToast, setPaymentToast] = useState<{ type: 'success' | 'failed'; message: string } | null>(null);

  // === URL QUERY PARAM LISTENER (e.g. ?view=privacy or ?payment_status=success) ===
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      const paymentStatus = urlParams.get('payment_status');
      const paymentCourseId = urlParams.get('courseId') || urlParams.get('course_id');
      const isFawaterakCheckout = urlParams.get('fawaterak_checkout');

      if (paymentStatus === 'success' || paymentStatus === 'paid') {
        if (currentUser && paymentCourseId) {
          const prev = currentUser.enrolledCourseIds || [];
          if (!prev.includes(paymentCourseId)) {
            const updated: User = {
              ...currentUser,
              enrolledCourseIds: Array.from(new Set([...prev, paymentCourseId])),
            };
            setCurrentUser(updated);
            saveCurrentUser(updated);
            saveStudentEnrolledCourse(currentUser.id, paymentCourseId);
            enrollStudentInCourseInFirestore(currentUser.id, paymentCourseId).catch(() => {});
          }
        }
        setPaymentToast({
          type: 'success',
          message: '🎉 تم تأكيد الدفع بنجاح عبر بوابة فواتيرك! تم تفعيل واشتراك الكورس فوراً في حسابك.',
        });
        if (paymentCourseId) {
          const matchedCourse = courses.find((c) => c.id === paymentCourseId);
          if (matchedCourse) {
            setSelectedCourse(matchedCourse);
            setCurrentView('course_detail');
          }
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (isFawaterakCheckout === '1') {
        if (paymentCourseId) {
          const matchedCourse = courses.find((c) => c.id === paymentCourseId);
          if (matchedCourse) {
            setSelectedCourse(matchedCourse);
            setCurrentView('course_detail');
          }
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === 'failed') {
        setPaymentToast({
          type: 'failed',
          message: 'عفواً، تم إلغاء عملية الدفع أو لم تكتمل. يمكنك المحاولة مجدداً في أي وقت.',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (viewParam === 'privacy') {
        setPrivacyTermsInitialTab('privacy');
        setIsPrivacyTermsModalOpen(true);
      } else if (viewParam === 'terms') {
        setPrivacyTermsInitialTab('terms');
        setIsPrivacyTermsModalOpen(true);
      } else if (viewParam === 'courses') {
        setCurrentView('courses');
      } else if (viewParam === 'competitions') {
        setCurrentView('competitions');
      }
    } catch (e) {}
  }, [courses]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  // === FIREBASE CLOUD STATUS LISTENER ===
  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail) setCloudStatus(e.detail);
    };
    window.addEventListener('qalb_alam_cloud_status', handleStatus);
    return () => window.removeEventListener('qalb_alam_cloud_status', handleStatus);
  }, []);

  const isLoggingOutRef = useRef<boolean>(false);

  // Helper to force logout when another device logs into the same student account
  const triggerConcurrentDeviceLogout = () => {
    if (isLoggingOutRef.current) return;
    const activeMe = currentUserRef.current;
    // Enforce strictly on student accounts as requested
    if (!activeMe || activeMe.role !== 'student') return;

    console.warn('🚨 [Single-Device Guard] تم اكتشاف تسجيل دخول لحساب الطالب من جهاز آخر! جاري تسجيل الخروج من هذا الجهاز...');
    setSessionConflictNotice(
      'تم تسجيل الخروج من هذا الجهاز تلقائياً لأنه تم فتح حسابك وتسجيل الدخول من جهاز آخر الآن. يُسمح بفتح حساب الطالب على جهاز واحد فقط في نفس الوقت لحماية حسابك.'
    );
    handleLogout();
  };

  // === FIREBASE AUTH STATE LISTENER (onAuthStateChanged) ===
  useEffect(() => {
    const unsubAuth = subscribeToAuthChanges(async (fbUser) => {
      if (isLoggingOutRef.current) return;
      if (fbUser) {
        try {
          const profile = await fetchUserProfile(fbUser.uid);
          if (isLoggingOutRef.current) return;
          const pendingSignup = getPendingSignupProfile();
          const savedLocal = getCurrentUser();
          const savedUsersMatch = getSavedUsers().find(
            (u) => u.id === fbUser.uid || (fbUser.email && u.email === fbUser.email)
          );
          const localCandidate =
            (pendingSignup && (!pendingSignup.id || pendingSignup.id === fbUser.uid || pendingSignup.email === fbUser.email)
              ? { ...pendingSignup, id: fbUser.uid }
              : null) ||
            (currentUserRef.current &&
            (currentUserRef.current.id === fbUser.uid || currentUserRef.current.email === fbUser.email)
              ? currentUserRef.current
              : null) ||
            (savedLocal && (savedLocal.id === fbUser.uid || savedLocal.email === fbUser.email) ? savedLocal : null) ||
            savedUsersMatch ||
            null;

          if (profile) {
            let localSessionId = localStorage.getItem('qalb_alam_device_session_id');
            if (!localSessionId && profile.activeSessionId) {
              localSessionId = profile.activeSessionId;
              try {
                localStorage.setItem('qalb_alam_device_session_id', localSessionId);
              } catch {}
            }
            const verifiedUser: User = ensureUserPrivileges({
              ...localCandidate,
              ...profile,
              name:
                profile.name && profile.name !== 'مستخدم منصة المتفلسفة'
                  ? profile.name
                  : localCandidate?.name || fbUser.displayName || profile.name,
              phone: profile.phone || localCandidate?.phone || '',
              parentPhone: profile.parentPhone || localCandidate?.parentPhone || '',
              schoolYear:
                profile.schoolYear && profile.schoolYear !== 'طالب منصة المتفلسفة'
                  ? profile.schoolYear
                  : profile.schoolYear || localCandidate?.schoolYear || 'الصف الأول الثانوي',
              activeSessionId: localSessionId || profile.activeSessionId,
              emailVerified: fbUser.emailVerified,
            });
            setCurrentUser(verifiedUser);
            saveCurrentUser(verifiedUser);
          } else {
            if (localCandidate) {
              const verifiedLocal = ensureUserPrivileges({
                name: localCandidate.name,
                phone: localCandidate.phone,
                schoolYear: localCandidate.schoolYear,
                role: localCandidate.role,
                parentPhone: localCandidate.parentPhone || "",
                registeredAt: localCandidate.registeredAt || new Date().toISOString(),
                ...localCandidate,
                id: fbUser.uid,
                emailVerified: fbUser.emailVerified,
              });
              setCurrentUser(verifiedLocal);
              saveCurrentUser(verifiedLocal);
              return;
            }
            // New or minimal user
            const fallbackUser: User = ensureUserPrivileges({
              id: fbUser.uid,
              name: fbUser.displayName || 'مستخدم منصة المتفلسفة',
              email: fbUser.email || '',
              phone: '',
              parentPhone: '',
              schoolYear: localCandidate?.schoolYear || 'الصف الأول الثانوي',
              role: fbUser.email === 'hos098sam@gmail.com' ? 'admin' : 'student',
              status: 'active',
              registeredAt: new Date().toISOString().split('T')[0],
              emailVerified: fbUser.emailVerified,
            });
            setCurrentUser(fallbackUser);
            saveCurrentUser(fallbackUser);
          }
        } catch (err) {
          console.error('Error synchronizing authenticated user profile:', err);
        }
      } else {
        // Firebase Auth session is null: keep any saved persistent user session intact!
        const saved = getCurrentUser();
        if (saved && saved.id) {
          const privileged = ensureUserPrivileges(saved);
          setCurrentUser(privileged);
          return;
        }
        setCurrentUser((prev) => {
          if (prev && prev.id) {
            return prev;
          }
          return null;
        });
      }
    });

    return () => unsubAuth();
  }, []);

  // === REALTIME FIRESTORE LISTENER FOR CURRENT USER & SINGLE-DEVICE SESSION ENFORCEMENT ===
  useEffect(() => {
    if (!currentUser?.id) return;

    let unsubSnap: (() => void) | null = null;

    const unsubAuth = subscribeToAuthChanges((fbUser) => {
      if (unsubSnap) {
        try {
          unsubSnap();
        } catch {}
        unsubSnap = null;
      }

      // Only attach Firestore listener when Firebase Auth is signed in and matches currentUser.id (or user is admin)
      const isAuthorizedForDoc =
        Boolean(fbUser) &&
        (fbUser!.uid === currentUser.id || fbUser!.email === 'hos098sam@gmail.com');

      if (!isAuthorizedForDoc) return;

      const userDocRef = doc(db, 'users', currentUser.id);
      unsubSnap = onSnapshot(
        userDocRef,
        (snap) => {
          if (!snap.exists()) {
            // Document does not exist yet in Firestore.
            // Only write user data if it is a complete profile (never overwrite with placeholder 'مستخدم منصة المتفلسفة')
            const me = currentUserRef.current;
            if (me?.id && me.name && me.name !== 'مستخدم منصة المتفلسفة') {
              try {
                const { password, ...safeMe } = me as any;
                setDoc(
                  userDocRef,
                  {
                    ...safeMe,
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                ).catch((e) => console.warn('Could not upsert user doc in Firestore:', e));
              } catch {}
            }
            return;
          }

          const freshData = snap.data() as User;

          // Single-device session check for students
          if (freshData.activeSessionId) {
            try {
              const localSessionId = localStorage.getItem('qalb_alam_device_session_id');
              const loginTs = Number(localStorage.getItem('qalb_alam_session_login_ts') || '0');
              const isPastLoginGrace = Date.now() - loginTs > 10000;

              if (!localSessionId) {
                localStorage.setItem('qalb_alam_device_session_id', freshData.activeSessionId);
              } else if (
                localSessionId !== freshData.activeSessionId &&
                isPastLoginGrace &&
                (freshData.role === 'student' || currentUserRef.current?.role === 'student')
              ) {
                const remoteTsMatch = String(freshData.activeSessionId).match(/sess_(\d+)_/);
                const localTsMatch = String(localSessionId).match(/sess_(\d+)_/);
                const remoteTs = remoteTsMatch ? Number(remoteTsMatch[1]) : 0;
                const localTs = localTsMatch ? Number(localTsMatch[1]) : loginTs;

                // If this is a cached snapshot or older session from before our latest login, sync our localSessionId instead of logging out
                if (snap.metadata?.fromCache || remoteTs <= localTs + 2000) {
                  setDoc(userDocRef, { activeSessionId: localSessionId }, { merge: true }).catch(() => {});
                } else {
                  triggerConcurrentDeviceLogout();
                  return;
                }
              }
            } catch {}
          }

          const previousStatus = currentUserRef.current?.status;
          const currentMe = currentUserRef.current;
          const freshUser: User = ensureUserPrivileges({
            ...currentMe,
            ...freshData,
            name:
              freshData.name && freshData.name !== 'مستخدم منصة المتفلسفة'
                ? freshData.name
                : currentMe?.name && currentMe.name !== 'مستخدم منصة المتفلسفة'
                ? currentMe.name
                : freshData.name,
            phone: freshData.phone || currentMe?.phone || '',
            parentPhone: freshData.parentPhone || currentMe?.parentPhone || '',
            schoolYear:
              freshData.schoolYear && freshData.schoolYear !== 'طالب منصة المتفلسفة'
                ? freshData.schoolYear
                : currentMe?.schoolYear && currentMe.schoolYear !== 'طالب منصة المتفلسفة'
                ? currentMe.schoolYear
                : freshData.schoolYear,
            id: currentMe?.id || freshData.id || snap.id,
            role: freshData.role || currentMe?.role || 'student',
            authProvider: freshData.authProvider || currentMe?.authProvider,
            emailVerified: auth.currentUser?.emailVerified ?? freshData.emailVerified ?? currentMe?.emailVerified,
          });

          // Self-heal Firestore document if it had placeholder values that were repaired from 4-part name / email
          if (
            (freshData.name === 'مستخدم منصة المتفلسفة' && freshUser.name !== 'مستخدم منصة المتفلسفة') ||
            (!freshData.phone && freshUser.phone) ||
            (freshData.schoolYear === 'طالب منصة المتفلسفة' && freshUser.schoolYear !== 'طالب منصة المتفلسفة')
          ) {
            setDoc(
              userDocRef,
              {
                name: freshUser.name,
                phone: freshUser.phone,
                parentPhone: freshUser.parentPhone,
                schoolYear: freshUser.schoolYear,
              },
              { merge: true }
            ).catch(() => {});
          }

          setCurrentUser(freshUser);
          saveCurrentUser(freshUser);

          // Check if status transitioned to 'active' from pending/rejected or any non-active state
          if (freshUser.status === 'active' && previousStatus !== 'active') {
            console.log('🎉 [Firebase Status] تم قبول وتفعيل الحساب من قِبل الإدارة! توجيه فوري للوحة التحكم الرئيسية...');
            playNotificationSound();
            const targetDashboard = getMainDashboardView(freshUser);
            setCurrentView(targetDashboard);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setAccountActivatedNotice({
              show: true,
              message: `تم اعتماد وتفعيل حسابك بنجاح (${freshUser.name || 'مرحباً بك'})! تم التوجيه للوحة التحكم.`,
              targetView: targetDashboard,
            });
          }
        },
        (err) => {
          console.warn('Firestore current user snapshot listener error:', err?.message || err);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubSnap) {
        try {
          unsubSnap();
        } catch {}
      }
    };
  }, [currentUser?.id]);

  // === FIREBASE SYNC & REALTIME SUBSCRIPTION ===
  useEffect(() => {
    let isMounted = true;
    const syncFromCloud = async () => {
      try {
        let fastRes = await fetch('/api/platform-data').then((r) => r.ok ? r.json() : null).catch(() => null);
        if (!fastRes) {
          fastRes = await fetch('/initial_platform_data.json').then((r) => r.ok ? r.json() : null).catch(() => null);
        }
        if (isMounted && fastRes) {
          syncDeletedIds(
            fastRes.deletedCourseIds,
            fastRes.deletedUserIds,
            fastRes.deletedExamIds,
            fastRes.deletedNotificationIds,
            fastRes.deletedCouponIds
          );
          if (Array.isArray(fastRes.courses) && fastRes.courses.length > 0) {
            setCourses((prev) => mergeCourses(prev, fastRes.courses));
          }
          if (Array.isArray(fastRes.users) && fastRes.users.length > 0) {
            setStudents((prev) => mergeUsers(prev, fastRes.users));
          }
          if (fastRes.settings && fastRes.settings.platformName) {
            setPlatformSettings(fastRes.settings);
          }
          if (Array.isArray(fastRes.notifications)) {
            const delNotifs = getDeletedNotificationIds();
            const cleanNotifs = fastRes.notifications.filter((n: any) => n && n.id && !delNotifs.includes(n.id));
            saveNotifications(cleanNotifs);
          }
        }
      } catch {}

      try {
        console.log("☁️ جاري التحميل من سحابة Firebase...");
        const data = await loadAllFromFirebase();
        if (isMounted) {
          if (Array.isArray(data.courses) && data.courses.length > 0) {
            setCourses((prev) => mergeCourses(prev, data.courses));
            console.log("✅ تم اعتماد الكورسات من السحابة:", data.courses.length);
          }
          if (Array.isArray(data.users) && data.users.length > 0) {
            setStudents((prev) => mergeUsers(prev, data.users));
            console.log("✅ تم اعتماد المستخدمين من السحابة:", data.users.length);
          }
          if (Array.isArray(data.competitions)) {
            setCompetitions(data.competitions);
          }
          if (data.settings) {
            setPlatformSettings(data.settings);
          }
        }
      } catch (e) {
        console.error("Firebase sync error", e);
      } finally {
        if (isMounted) setIsFirebaseLoading(false);
      }
    };
    syncFromCloud();

    // Track initial notifications so we don't alert on initial page load
    const knownNotifIds = new Set<string>();
    try {
      getSavedNotifications().forEach((n) => knownNotifIds.add(n.id));
    } catch {}

    // Subscribe to realtime changes in Firebase
    const unsubscribe = subscribeToFirebaseRealtime({
      onCourses: (newCourses) => {
        if (isMounted) setCourses(newCourses);
      },
      onUsers: (newUsers) => {
        if (isMounted) {
          setStudents((prev) => mergeUsers(prev, newUsers));
          const currentMe = currentUserRef.current;
          if (currentMe) {
            const fresh = newUsers.find((u) => u.id === currentMe.id || (u.phone && u.phone === currentMe.phone));
            if (fresh) {
              const previousStatus = currentMe.status;
              const freshUser: User = ensureUserPrivileges({
                ...currentMe,
                ...fresh,
                activeSessionId: currentMe.activeSessionId || fresh.activeSessionId,
              });
              setCurrentUser(freshUser);
              saveCurrentUser(freshUser);

              if (freshUser.status === 'active' && previousStatus !== 'active') {
                console.log('🎉 [Firebase Users Sync] تم تفعيل الحساب من قِبل الإدارة! توجيه فوري للوحة التحكم الرئيسية...');
                playNotificationSound();
                const targetDashboard = getMainDashboardView(freshUser);
                setCurrentView(targetDashboard);
                window.scrollTo({ top: 0, behavior: 'smooth' });

                setAccountActivatedNotice({
                  show: true,
                  message: `تم اعتماد تفعيل الحساب من السحابة بنجاح! تم التوجيه للوحة التحكم.`,
                  targetView: targetDashboard,
                });
              }
            }
          }
        }
      },
      onSettings: (newSettings) => {
        if (isMounted) setPlatformSettings(newSettings);
      },
      onCompetitions: (newComps) => {
        if (isMounted) setCompetitions(newComps);
      },
      onNotifications: (newNotifs) => {
        if (!isMounted) return;
        // Check if any incoming notification is new and was not in the initial set
        const brandNew = newNotifs.find((n) => !knownNotifIds.has(n.id));
        if (brandNew) {
          playNotificationSound();
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(brandNew.title, {
                body: brandNew.message,
                icon: '/logo.png',
                dir: 'rtl',
                lang: 'ar',
              });
            } catch (err) {}
          }
        }
        // Keep known IDs updated
        newNotifs.forEach((n) => knownNotifIds.add(n.id));
      },
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const handleUpdateSettings = (newSettings: PlatformSettings) => {
    setPlatformSettings(newSettings);
    savePlatformSettings(newSettings);
  };

  const handleUpdateCourses = (newCourses: Course[]) => {
    setCourses(newCourses);
    saveCourses(newCourses);
    if (selectedCourse) {
      const updated = newCourses.find((c) => c.id === selectedCourse.id);
      if (updated) setSelectedCourse(updated);
    }
  };

  const handleUpdateCompetitions = (newCompetitions: Competition[]) => {
    setCompetitions(newCompetitions);
    saveCompetitions(newCompetitions);
  };

  const handleUpdateStudents = (newStudents: User[]) => {
    setStudents(newStudents);
    saveUsers(newStudents);
    if (currentUser) {
      const freshMe = newStudents.find((s) => s.id === currentUser.id || (s.phone && s.phone === currentUser.phone));
      if (freshMe) { setCurrentUser(freshMe); saveCurrentUser(freshMe); }
    }
  };

  const handleDeleteTeacherAndCourses = (teacher: User) => {
    const teacherId = teacher.id;
    const teacherNameTrimmed = (teacher.name || '').trim();
    const teacherAccount = teacher.accountNumber || teacher.phone || '';

    addDeletedUserId(teacherId);
    if (teacher.phone) addDeletedUserId(teacher.phone);
    if (teacher.accountNumber) addDeletedUserId(teacher.accountNumber);

    const updatedUsers = students.filter((s) => s.id !== teacherId);
    setStudents(updatedUsers);
    saveUsers(updatedUsers);
    deleteUserFromFirestore(teacherId).catch(() => {});
    deleteUserFromServer(teacherId).catch(() => {});

    const isTeacherCourse = (c: Course) => {
      if (c.instructorId && (c.instructorId === teacherId || (teacherAccount && c.instructorId === teacherAccount))) {
        return true;
      }
      if (teacherNameTrimmed) {
        if (c.instructor && c.instructor.trim() === teacherNameTrimmed) return true;
        if (c.teacherName && c.teacherName.trim() === teacherNameTrimmed) return true;
      }
      return false;
    };

    const teacherCoursesToDelete = courses.filter(isTeacherCourse);
    const remainingCourses = courses.filter((c) => !isTeacherCourse(c));
    setCourses(remainingCourses);
    saveCourses(remainingCourses);
    teacherCoursesToDelete.forEach((tc) => {
      deleteCourseFromServer(tc.id).catch(() => {});
    });

    if (selectedTeacherForView?.id === teacherId) {
      setSelectedTeacherForView(null);
      if (currentView === 'teacher_profile') {
        setCurrentView('home');
      }
    }
  };

  const handleRefreshStudentStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const fresh = await fetchUserProfile(currentUser.id);
      if (fresh) {
        const freshUser = ensureUserPrivileges(fresh);
        setCurrentUser(freshUser);
        saveCurrentUser(freshUser);

        if (freshUser.status === 'active') {
          playNotificationSound();
          const targetDashboard = getMainDashboardView(freshUser);
          setCurrentView(targetDashboard);
          window.scrollTo({ top: 0, behavior: 'smooth' });

          setAccountActivatedNotice({
            show: true,
            message: 'تم تفعيل الحساب بنجاح من السحابة! تم التوجيه فوراً للوحة التحكم الرئيسية.',
            targetView: targetDashboard,
          });
        }
      }
    } catch (e) {
      console.error('Error refreshing student status:', e);
    }
  };

  const handleReSignupAfterRejection = () => { handleLogout(); handleOpenAuth('signup'); };

  const handleEnrollCourseClick = (course: Course) => {
    if (!currentUser) {
      sessionStorage.setItem('pending_enroll_course_id', course.id);
      handleOpenAuth('login');
      return;
    }
    // Already logged in: directly navigate to course detail and scroll to payment section
    setSelectedCourse(course);
    setCurrentView('course_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      const el = document.getElementById('wallet-checkout') || document.getElementById('fawaterak-checkout');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  };

  // === SERVER HEARTBEAT FOR SINGLE-DEVICE STUDENT SESSION & ROLE INTEGRITY ENFORCEMENT ===
  useEffect(() => {
    if (!currentUser?.id) return;

    // Ensure current device has a session ID registered if missing
    try {
      let localSessionId = localStorage.getItem('qalb_alam_device_session_id');
      if (!localSessionId) {
        localSessionId = currentUser.activeSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem('qalb_alam_device_session_id', localSessionId);
        localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
      }
    } catch {}

    const verifyActiveSession = async () => {
      if (isLoggingOutRef.current) return;
      const activeMe = currentUserRef.current;
      if (!activeMe?.id) return;

      const localSessionId = localStorage.getItem('qalb_alam_device_session_id') || activeMe.activeSessionId || '';
      const loginTs = Number(localStorage.getItem('qalb_alam_session_login_ts') || '0');
      if (Date.now() - loginTs <= 3000) return;

      try {
        const res = await fetch(
          `/api/auth/check-session/${encodeURIComponent(activeMe.id)}?phone=${encodeURIComponent(activeMe.phone || '')}&sessionId=${encodeURIComponent(localSessionId)}&role=${encodeURIComponent(activeMe.role || '')}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success) {
          // Immediate security ejection if client role was tampered with in DevTools/storage
          if (data.roleTampered) {
            console.error('🚨 [Security Guard] تم اكتشاف محاولة تلاعب بصلاحيات الحساب. جاري تسجيل الخروج الفوري.');
            handleLogout();
            return;
          }

          if (activeMe.role !== 'student') return;

          if (!data.activeSessionId) {
            // Register this device's session on server if server restarted
            fetch('/api/auth/register-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: activeMe.id,
                phone: activeMe.phone || '',
                activeSessionId: localSessionId,
              }),
            }).catch(() => {});
          } else if (data.sessionKilled || (localSessionId && data.activeSessionId !== localSessionId)) {
            // Extract timestamp from session ID (e.g. sess_1791351705066_xxx or dev_sess_1791351705066_xxx)
            const remoteTsMatch = String(data.activeSessionId).match(/sess_(\d+)_/);
            const localTsMatch = String(localSessionId).match(/sess_(\d+)_/);
            const remoteTs = remoteTsMatch ? Number(remoteTsMatch[1]) : 0;
            const localTs = localTsMatch ? Number(localTsMatch[1]) : loginTs;

            // Only trigger logout if the server's session ID is genuinely NEWER than our local session
            if (data.sessionKilled || remoteTs > localTs + 1500) {
              triggerConcurrentDeviceLogout();
            } else {
              // Our local session is newer (e.g. server had an older disk record before our latest login finished syncing)
              fetch('/api/auth/register-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: activeMe.id,
                  phone: activeMe.phone || '',
                  activeSessionId: localSessionId,
                }),
              }).catch(() => {});
            }
          }
        }
      } catch {}
    };

    const checkSessionInterval = setInterval(verifyActiveSession, 4000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifyActiveSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(checkSessionInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.id, currentUser?.role]);

  const handleAuthSuccess = async (user: User) => {
    isLoggingOutRef.current = false;
    const rawUser = (user as any)?.serverUser ? (user as any).serverUser : user;

    // Use server-provided activeSessionId or generate a fresh unique session ID
    const newSessionId = rawUser.activeSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem('qalb_alam_device_session_id', newSessionId);
      localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
    } catch {}

    const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));

    const privileged = ensureUserPrivileges({
      ...rawUser,
      activeSessionId: newSessionId,
      currentDeviceId: rawUser.currentDeviceId || deviceInfo.deviceId,
      currentDeviceName: rawUser.currentDeviceName || deviceInfo.deviceName,
      lastLoginAt: nowIso,
    });

    setCurrentUser(privileged);
    saveCurrentUser(privileged);

    // Sync the new activeSessionId and device binding to server, local users cache, and Firestore immediately
    saveSingleUserToServer(privileged).catch(() => {});
    const regRes = await fetch('/api/auth/register-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: privileged.id,
        phone: privileged.phone || '',
        activeSessionId: newSessionId,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
      }),
    }).catch(() => null);

    if (regRes && !regRes.ok && regRes.status === 403) {
      const regErr = await regRes.json().catch(() => ({}));
      setSessionConflictNotice(
        regErr.error || 'عذراً، لقد استنفذت الحد المسموح به لتغيير الجهاز (مرتان شهرياً كحد أقصى لمنع مشاركة الحساب).'
      );
      handleLogout();
      return;
    }

    if (privileged.id) {
      try {
        setDoc(
          doc(db, 'users', privileged.id),
          {
            activeSessionId: newSessionId,
            currentDeviceId: privileged.currentDeviceId || null,
            currentDeviceName: privileged.currentDeviceName || null,
            lastLoginAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        ).catch(() => {});
      } catch {}
    }

    const allUsers = getSavedUsers();
    setStudents(allUsers);

    // Check if user clicked "اشتراك في الكورس" and needs immediate checkout redirect!
    const pendingCourseId = sessionStorage.getItem('pending_enroll_course_id');
    if (pendingCourseId) {
      sessionStorage.removeItem('pending_enroll_course_id');
      const targetCourse = courses.find((c) => c.id === pendingCourseId);
      if (targetCourse) {
        setSelectedCourse(targetCourse);
        setCurrentView('course_detail');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          const el = document.getElementById('wallet-checkout') || document.getElementById('fawaterak-checkout');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 350);
        return;
      }
    }

    if (
      privileged.status === 'active' ||
      privileged.role === 'admin' ||
      privileged.role === 'teacher' ||
      privileged.role === 'assistant' ||
      privileged.isAssistant ||
      Boolean(privileged.assistantSpecialty) ||
      privileged.role === 'parent'
    ) {
      const target = getMainDashboardView(privileged);
      setCurrentView(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    currentUserRef.current = null;
    try {
      localStorage.removeItem('qalb_alam_device_session_id');
      localStorage.removeItem('qalb_alam_current_user');
    } catch {}
    setCurrentUser(null);
    saveCurrentUser(null);
    setSelectedTeacherForView(null);
    setSelectedCourse(null);
    setSelectedCompetition(null);
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      await logoutUser();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 600);
    }
  };

  const handleOpenAuth = (mode: 'login' | 'signup' | 'parent' = 'login') => {
    setAuthInitialMode(mode);
    if (mode === 'login') {
      setCurrentView('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (mode === 'signup') {
      setCurrentView('signup');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (mode === 'parent') {
      setCurrentView('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleExamCompleted = (
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
  ) => {
    if (!currentUser) return;
    const prevResult = currentUser.examResults?.[examId];
    const newAttemptsCount = (Number(prevResult?.attemptsCount) || 0) + 1;
    const nowStr = timingMeta?.submittedAt || new Date().toLocaleString('ar-EG');
    const updatedResults = {
      ...(currentUser.examResults || {}),
      [examId]: {
        score,
        maxScore,
        percentage,
        passed: timingMeta?.status === 'under_review' ? false : (prevResult?.passed ? true : passed),
        status: timingMeta?.status || 'graded',
        attemptsCount: newAttemptsCount,
        completedAt: nowStr,
        startedAt: timingMeta?.startedAt || prevResult?.startedAt,
        submittedAt: nowStr,
        durationTakenSeconds: timingMeta?.durationTakenSeconds ?? prevResult?.durationTakenSeconds,
        durationTakenFormatted: timingMeta?.durationTakenFormatted || prevResult?.durationTakenFormatted,
      },
    };
    const updatedUser: User = { ...currentUser, examResults: updatedResults };
    setCurrentUser(updatedUser);
    saveCurrentUser(updatedUser);
    const updatedStudents = students.map((s) => (s.id === updatedUser.id ? updatedUser : s));
    setStudents(updatedStudents);
    saveUsers(updatedStudents);
    saveSingleUserToServer(updatedUser);

    // Explicitly persist updated examResults to user's Firestore document
    if (updatedUser.id) {
      try {
        setDoc(
          doc(db, 'users', updatedUser.id),
          {
            examResults: updatedResults,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch((err) => console.warn('Sync examResults to Firestore warning:', err));
      } catch {}
    }
  };

  const handleSelectCourse = (course: Course) => { setSelectedCourse(course); setCurrentView('course_detail'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleSelectCompetition = (competition: Competition) => {
    if (!currentUser) { handleOpenAuth('login'); return; }
    setSelectedCompetition(competition); setCurrentView('competition_take'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderBoostTab = () => {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-fadeIn">
        <div className="bg-white border border-slate-200 rounded-[40px] p-8 sm:p-12 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black mb-6 tracking-wide border border-indigo-100">
              <HeartHandshake className="w-4 h-4" /><span>الدعم النفسي والتحفيز المستمر</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-4">طاقتك النفسية هي وقود التفوق في البكالوريا</h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6">تم إعداد هذه الجرعات التحفيزية لتجديد نشاطك اليومي، وتقليل التوتر قبل الامتحانات، مع نصائح ذهبية لتنظيم ساعات النوم والمذاكرة.</p>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600"><Award className="w-4 h-4" /><span>إشراف وتوجيه: الأستاذ {platformSettings.supervisorName}</span></div>
          </div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-50 rounded-full blur-[100px] opacity-60" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DAILY_MOTIVATION.map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><Quote className="w-6 h-6" /></div>
                <p className="text-lg font-bold text-slate-900 leading-relaxed">"{item.quote}"</p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-black text-indigo-600 px-3 py-1 bg-indigo-50 rounded-full">نصيحة اليوم</span>
                <span className="text-xs text-slate-400 font-medium">{item.author}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (currentView === 'login') {
    return (
      <LoginPage
        initialRole={authInitialMode === 'parent' ? 'parent' : 'student'}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  if (currentView === 'signup') {
    return (
      <SignupPage
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  // Strictly lock Teaching Assistants to their assigned specialty workspace ONLY, hiding all other platform UI
  if (
    currentUser &&
    (currentUser.role === 'assistant' || currentUser.isAssistant || Boolean(currentUser.assistantSpecialty))
  ) {
    return (
      <AssistantWorkspaceView
        assistant={currentUser}
        allCourses={courses}
        allUsers={students}
        onUpdateCourses={handleUpdateCourses}
        onUpdateUsers={handleUpdateStudents}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLogout={handleLogout}
      />
    );
  }

  const effectiveTeacher =
    currentUser?.role === 'teacher'
      ? currentUser
      : currentUser?.role === 'admin'
      ? selectedTeacherForView || currentUser
      : null;

  if (
    currentView === 'teacher_add_course' ||
    currentView === 'teacher_students' ||
    currentView === 'teacher_progress' ||
    currentView === 'teacher_grading'
  ) {
    if (!effectiveTeacher) {
      return (
        <div className="min-h-screen bg-[#060b1e] text-white flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[#0b132b] border border-blue-500/30 max-w-md w-full p-8 rounded-3xl text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">تسجيل الدخول كمعلم مطلوب</h2>
            <p className="text-xs text-slate-300 font-medium">
              هذه الصفحة مخصصة لحسابات المدرسين فقط. يرجى تسجيل الدخول بحساب المعلم أولاً للوصول لصلاحيات إدارة الكورسات والطلاب.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setCurrentView('login');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-colors cursor-pointer"
              >
                تسجيل الدخول كمعلم
              </button>
              <button
                onClick={() => {
                  setCurrentView('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 selection:bg-indigo-500/20 text-slate-900 dark:text-slate-100 transition-colors" dir="rtl">
        {currentView === 'teacher_add_course' && (
          <TeacherAddCoursePage
            currentTeacher={effectiveTeacher}
            allCourses={courses}
            onUpdateCourses={handleUpdateCourses}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        {currentView === 'teacher_students' && (
          <TeacherStudentsPage
            currentTeacher={effectiveTeacher}
            allCourses={courses}
            allStudents={students}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        {currentView === 'teacher_progress' && (
          <TeacherStudentProgressPage
            currentTeacher={effectiveTeacher}
            allCourses={courses}
            allStudents={students}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
        {currentView === 'teacher_grading' && (
          <TeacherEssayGradingPage
            currentTeacher={effectiveTeacher}
            allCourses={courses}
            allStudents={students}
            onUpdateStudents={handleUpdateStudents}
            onNavigate={(view) => {
              setCurrentView(view);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-800 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Realtime Cloud Status Banner (only shown if explicit error) */}
      {cloudStatus.status === 'error' ? (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-200" />
            <span>
              <strong>تنبيه السحابة:</strong> {cloudStatus.errorDetails || 'فشل الاتصال بقاعدة بيانات Firebase. يعمل الموقع حالياً بالبيانات الاحتياطية.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const ok = await forcePushAllToFirebase();
                if (ok) alert('تمت المزامنة بنجاح مع سحابة Firebase!');
              }}
              className="px-3 py-1 bg-white text-amber-900 rounded-lg text-xs font-black hover:bg-amber-100 transition-colors shadow-xs"
            >
              إعادة محاولة المزامنة بالسحابة 🔄
            </button>
          </div>
        </div>
      ) : null}

      <Navbar
        currentView={currentView}
        onNavigate={(view) => { setCurrentView(view); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={handleOpenAuth}
        platformSettings={platformSettings}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenFlutterApp={() => setIsFlutterAppModalOpen(true)}
      />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Fawaterak Payment Result Toast Banner */}
        {paymentToast && (
          <div className={`mb-6 p-4 sm:p-5 rounded-3xl text-white shadow-xl flex items-center justify-between gap-4 border animate-fadeIn ${
            paymentToast.type === 'success'
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 border-emerald-400/50'
              : 'bg-gradient-to-r from-rose-600 to-amber-600 border-rose-400/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                {paymentToast.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-white" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-white" />
                )}
              </div>
              <span className="font-black text-sm sm:text-base">{paymentToast.message}</span>
            </div>
            <button
              onClick={() => setPaymentToast(null)}
              className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Realtime Account Activation Notice Banner */}
        {accountActivatedNotice && accountActivatedNotice.show && (
          <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-400/40 animate-fadeIn">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-sm sm:text-base flex items-center gap-2">
                  <span>🎉 تم تفعيل واعتماد الحساب رسمياً (Active)!</span>
                </div>
                <div className="text-white/90 text-xs sm:text-sm font-medium">
                  {accountActivatedNotice.message}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setCurrentView(accountActivatedNotice.targetView);
                  setAccountActivatedNotice(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>الانتقال للوحة التحكم الرئيسية 🚀</span>
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-white/30"
                title="إعادة تحميل التطبيق كاملاً"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة تحميل التطبيق (Reload) 🔄</span>
              </button>
              <button
                onClick={() => setAccountActivatedNotice(null)}
                className="p-2 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentUser && currentUser.role === 'student' && (currentUser.status === 'pending' || currentUser.status === 'rejected') && currentView !== 'home' ? (
          <StudentReviewStatus
            currentUser={currentUser}
            platformSettings={platformSettings}
            onRefreshStatus={handleRefreshStudentStatus}
            onLogout={handleLogout}
            onReSignup={handleReSignupAfterRejection}
            onGoToDashboard={() => {
              const target = getMainDashboardView(currentUser);
              setCurrentView(target);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateHome={() => {
              setCurrentView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          <>
            {/* If pending and viewing home, display a non-restrictive notification banner */}
            {currentUser && currentUser.role === 'student' && (currentUser.status === 'pending' || currentUser.status === 'rejected') && currentView === 'home' && (
              <div className="mb-6 p-4 rounded-3xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="text-xs sm:text-sm">
                    <div className="font-black">حسابك قيد مراجعة وتدقيق الإدارة حالياً</div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      يمكنك متابعة حالة الطلب أو إعادة تحميل التطبيق بمجرد اعتماد وتفعيل الحساب في Firebase.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleRefreshStudentStatus}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>التحقق من التفعيل</span>
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-black text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة تحميل التطبيق 🔄</span>
                  </button>
                  <button
                    onClick={() => {
                      setCurrentView('courses');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-3.5 py-2 rounded-xl border border-amber-400/50 hover:bg-amber-200/50 text-amber-900 dark:text-amber-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    صفحة تفاصيل الطلب
                  </button>
                </div>
              </div>
            )}
            {currentView === 'home' && (
              <LandingHome
                platformSettings={platformSettings}
                courses={courses}
                competitions={competitions}
                currentUser={currentUser}
                teachers={students.filter((s) => s.role === 'teacher')}
                onNavigate={(view) => {
                  setIsHomeVisualEditorOpen(false);
                  setCurrentView(view);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onSelectCourse={handleSelectCourse}
                onSelectCompetition={handleSelectCompetition}
                onSelectTeacher={(teacher) => {
                  setSelectedTeacherForView(teacher);
                  setCurrentView('teacher_profile');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenAuth={(mode) => handleOpenAuth(mode)}
                onEnrollCourse={handleEnrollCourseClick}
                onDeleteTeacher={handleDeleteTeacherAndCourses}
                isVisualEditMode={isHomeVisualEditorOpen && (currentUser?.role === 'admin' || currentUser?.email === 'hos098sam@gmail.com')}
                onSaveVisualSettings={(updatedSettings) => {
                  if (currentUser?.role === 'admin' || currentUser?.email === 'hos098sam@gmail.com') {
                    handleUpdateSettings(updatedSettings);
                  }
                }}
                onExitVisualEditMode={() => {
                  setIsHomeVisualEditorOpen(false);
                }}
              />
            )}
            {currentView === 'courses' && (
              <CoursesView
                courses={courses}
                currentUser={currentUser}
                teachers={students.filter((s) => s.role === 'teacher')}
                onSelectCourse={handleSelectCourse}
                onSelectTeacher={(teacher) => {
                  setSelectedTeacherForView(teacher);
                  setCurrentView('teacher_profile');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenAuth={() => handleOpenAuth('login')}
                onUpdateUser={(updated) => {
                  handleUpdateStudents(students.map((s) => (s.id === updated.id ? updated : s)));
                  setCurrentUser(updated);
                  saveCurrentUser(updated);
                }}
              />
            )}
            {currentView === 'my_courses' && <MyCoursesView currentUser={currentUser} courses={courses} onSelectCourse={handleSelectCourse} onNavigate={setCurrentView} onOpenAuth={(mode) => handleOpenAuth(mode)} />}
            {currentView === 'forum' && <ForumView currentUser={currentUser} onOpenAuth={(mode) => handleOpenAuth(mode)} />}
            {currentView === 'notifications' && (
              <NotificationsView
                currentUser={currentUser}
                platformSettings={platformSettings}
                onNavigateHome={() => setCurrentView('home')}
                onNavigateToAdmin={() => setCurrentView('admin')}
                onNavigateToCourses={() => setCurrentView('courses')}
              />
            )}
            {currentView === 'my_account' && <MyAccountView currentUser={currentUser} allCourses={courses} platformSettings={platformSettings} onLogout={handleLogout} onNavigate={setCurrentView} onUpdateUser={(updated) => { handleUpdateStudents(students.map((s) => (s.id === updated.id ? updated : s))); setCurrentUser(updated); saveCurrentUser(updated); }} onUpdateCourses={handleUpdateCourses} onOpenAuth={(mode) => handleOpenAuth(mode)} />}
            {currentView === 'course_detail' && selectedCourse && (
              <CourseDetailView
                course={selectedCourse}
                currentUser={currentUser}
                onBack={() => setCurrentView('courses')}
                onOpenAuth={() => handleOpenAuth('login')}
                onUpdateUserResults={handleExamCompleted}
                onUpdateUser={(updated) => {
                  handleUpdateStudents(students.map((s) => (s.id === updated.id ? updated : s)));
                  setCurrentUser(updated);
                  saveCurrentUser(updated);
                }}
              />
            )}
            {currentView === 'student_dashboard' && currentUser && (
              <StudentDashboard
                currentUser={currentUser}
                courses={courses}
                onSelectCourse={handleSelectCourse}
                onNavigate={setCurrentView}
                onTakeExam={(exam, course) => {
                  setSelectedCourse(course);
                  setCurrentView('course_detail');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onUpdateUser={(updated) => {
                  handleUpdateStudents(students.map((s) => (s.id === updated.id ? updated : s)));
                  setCurrentUser(updated);
                  saveCurrentUser(updated);
                }}
              />
            )}
            {currentView === 'competitions' && <CompetitionsView competitions={competitions} currentUser={currentUser} onSelectCompetition={handleSelectCompetition} onOpenAuth={() => handleOpenAuth('login')} />}
            {currentView === 'competition_take' && selectedCompetition && <CompetitionTakeView competition={selectedCompetition} currentUser={currentUser} onBack={() => setCurrentView('competitions')} onCompetitionSubmitted={(updatedComp) => { const updatedList = competitions.map((c) => (c.id === updatedComp.id ? updatedComp : c)); handleUpdateCompetitions(updatedList); }} onOpenAuth={() => handleOpenAuth('login')} />}
            {currentView === 'admin' && (
              <AdminDashboard
                currentUser={currentUser}
                courses={courses}
                competitions={competitions}
                students={students}
                platformSettings={platformSettings}
                onUpdateCourses={handleUpdateCourses}
                onUpdateCompetitions={handleUpdateCompetitions}
                onUpdateStudents={handleUpdateStudents}
                onUpdateSettings={handleUpdateSettings}
                onOpenAuth={() => handleOpenAuth('login')}
                onSelectTeacher={(teacher) => {
                  setSelectedTeacherForView(teacher);
                  setCurrentView('teacher_dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onViewTeacherProfile={(teacher) => {
                  setSelectedTeacherForView(teacher);
                  setCurrentView('teacher_profile');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenHomeVisualEditor={() => {
                  setIsHomeVisualEditorOpen(true);
                  setCurrentView('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
            {currentView === 'teacher_dashboard' && (
              effectiveTeacher ? (
                <TeacherPermissionsDashboard
                  currentTeacher={effectiveTeacher}
                  allCourses={courses}
                  allStudents={students}
                  onUpdateCourses={handleUpdateCourses}
                  onUpdateStudents={handleUpdateStudents}
                  onNavigate={setCurrentView}
                  onLogout={handleLogout}
                />
              ) : (
                <div className="max-w-md mx-auto py-16 text-center space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm" dir="rtl">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">لوحة تحكم المعلم</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    يرجى تسجيل الدخول بحساب المعلم أولاً لعرض كورساتك ومتابعة طلابك وتصحيح الأسئلة المقالية.
                  </p>
                  <button
                    onClick={() => {
                      setCurrentView('login');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer"
                  >
                    تسجيل الدخول كمعلم
                  </button>
                </div>
              )
            )}
            {currentView === 'teacher_profile' && (
              (selectedTeacherForView || students.find((s) => s.role === 'teacher')) ? (
                <TeacherShowcaseView
                  teacher={(selectedTeacherForView || students.find((s) => s.role === 'teacher'))!}
                  allTeachers={students.filter((s) => s.role === 'teacher')}
                  courses={courses}
                  currentUser={currentUser}
                  platformSettings={platformSettings}
                  onBack={() => setCurrentView('home')}
                  onSelectCourse={handleSelectCourse}
                  onSelectTeacher={(teacher) => {
                    setSelectedTeacherForView(teacher);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onDeleteTeacher={handleDeleteTeacherAndCourses}
                />
              ) : (
                <div className="py-20 text-center space-y-4 max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-xs">
                  <p className="text-slate-700 font-bold text-base">لا يوجد مدرس محدد لعرض صفحته حالياً</p>
                  <button
                    onClick={() => setCurrentView('home')}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors"
                  >
                    العودة للرئيسية
                  </button>
                </div>
              )
            )}
            {currentView === 'parent_portal' && <ParentPortalView parentPhone={currentUser?.phone || ''} linkedStudents={currentUser?.linkedStudents && currentUser.linkedStudents.length > 0 ? currentUser.linkedStudents : students.filter((s) => (s.parentPhone && currentUser?.phone && s.parentPhone.replace(/\s+/g, '') === currentUser.phone.replace(/\s+/g, '')) || (s.fatherPhone && currentUser?.phone && s.fatherPhone.replace(/\s+/g, '') === currentUser.phone.replace(/\s+/g, '')) || (s.motherPhone && currentUser?.phone && s.motherPhone.replace(/\s+/g, '') === currentUser.phone.replace(/\s+/g, '')) || (s.phone && currentUser?.phone && s.phone.replace(/\s+/g, '') === currentUser.phone.replace(/\s+/g, '')))} allCourses={courses} platformSettings={platformSettings} onLogout={handleLogout} onBackToHome={() => setCurrentView('home')} />}
            {currentView === 'smart_tools' && (
              <div className="space-y-6 animate-fadeIn">
                <Header activeTab={activeToolTab} onTabChange={setActiveToolTab} branch={branch} onBranchChange={setBranch} onShowIdentityModal={() => setIsIdentityModalOpen(true)} onShowAndroidModal={() => setIsAndroidModalOpen(true)} />
                <div className="pt-2">
                  {activeToolTab === 'tutor' && <ChatTutor branch={branch} onShowIdentityModal={() => setIsIdentityModalOpen(true)} />}
                  {activeToolTab === 'book_exams' && <BookExamsHub branch={branch} />}
                  {activeToolTab === 'summarizer' && <LessonSummarizer branch={branch} />}
                  {activeToolTab === 'exams' && <ExamGenerator branch={branch} />}
                  {activeToolTab === 'solver' && <ProblemSolver branch={branch} />}
                  {activeToolTab === 'planner' && <StudyPlanner branch={branch} />}
                  {activeToolTab === 'boost' && renderBoostTab()}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 px-4 sm:px-6 mt-auto transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div
            onClick={() => {
              setCurrentView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="cursor-pointer transition-opacity hover:opacity-90"
          >
            <Logo size="md" subtitle={platformSettings.platformName !== 'منصة المتفلسفة التعليمية' && platformSettings.platformName !== 'منصة المتفلسفة' ? platformSettings.platformName : 'المنصة التعليمية الحديثة • إشراف إدارة المنصة'} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <a href="https://www.facebook.com/profile.php?id=61594492453139" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-colors shadow-xs" title="صفحة فيسبوك قلب العلم"><Facebook className="w-3.5 h-3.5 fill-current" /><span>فيسبوك: قلب العلم</span></a>
            <a href="https://www.facebook.com/share/g/1KcP6KBSRC/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors shadow-xs" title="جروب طلاب قلب العلم"><Facebook className="w-3.5 h-3.5 fill-current" /><span>جروب طلاب قلب العلم</span></a>
            <a href="https://www.tiktok.com/@qalbalelm" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs transition-colors shadow-xs" title="تيك توك قلب العلم"><TikTokIcon className="w-3.5 h-3.5" /><span>تيك توك: قلب العلم</span></a>
            <a href="https://wa.me/201040672314" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-xs" title="الدعم الفني للمنصة"><MessageCircle className="w-3.5 h-3.5" /><span>الدعم الفني للمنصة</span></a>
            <button onClick={() => { if (currentUser?.role === 'admin') setCurrentView('admin'); else handleOpenAuth('login'); }} className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors" title="دخول المشرف / لوحة الكنترول"><ShieldCheck className="w-4 h-4" /></button>
          </div>
          <div className="text-slate-400 dark:text-slate-500 font-medium">جميع الحقوق محفوظة للمنصة التعليمية © 2027</div>
        </div>
      </footer>
      <AuthModal isOpen={isAuthModalOpen} initialMode={authInitialMode} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={handleAuthSuccess} />
      <IdentityModal isOpen={isIdentityModalOpen} onClose={() => setIsIdentityModalOpen(false)} />
      <AndroidInstallModal isOpen={isAndroidModalOpen} onClose={() => setIsAndroidModalOpen(false)} />
      <FlutterMobileAppPreviewModal isOpen={isFlutterAppModalOpen} onClose={() => setIsFlutterAppModalOpen(false)} currentUser={currentUser} />
      <PrivacyTermsModal isOpen={isPrivacyTermsModalOpen} initialTab={privacyTermsInitialTab} onClose={() => setIsPrivacyTermsModalOpen(false)} />
      <FloatingSupportChat
        currentUser={currentUser}
        platformName={platformSettings.platformName}
        onOpenAdminSupport={() => {
          setCurrentView('admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Concurrent Device / Session Conflict Notification Modal */}
      {sessionConflictNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-[32px] w-full max-w-md shadow-2xl p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                تنبيه أمان الحساب
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {sessionConflictNotice}
              </p>
            </div>
            <button
              onClick={() => {
                setSessionConflictNotice(null);
                handleOpenAuth('login');
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md cursor-pointer"
            >
              تسجيل الدخول من جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
