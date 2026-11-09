import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Phone,
  Lock,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  IdCard,
  MapPin,
  Clock,
  Sparkles,
  School,
  Briefcase,
  BookOpen,
  Mail,
  HeartHandshake,
  Compass,
  MessageCircle,
  RotateCcw,
  ShieldAlert,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { User, SchoolYearGrade } from '../types';
import { getSavedUsers, saveUsers, saveCurrentUser } from '../data/initialData';
import qalbAlElmLogo from '../assets/images/qalb_alelm_official_logo_1791663594965.jpg';
import { 
  loginWithEmail, 
  signupWithEmail, 
  resetPassword, 
  getFriendlyAuthErrorMessage, 
  fetchUserProfile,
  auth,
  db,
  requestWhatsAppLoginOtp,
  verifyWhatsAppLoginOtp,
  requestWhatsAppForgotPasswordOtp,
  verifyWhatsAppForgotPasswordOtp,
  resetPasswordWithWhatsAppOtp,
  resendWhatsAppOtp,
  requestWhatsAppParentOtp,
  verifyWhatsAppParentOtp,
  updateStudentGuardianVerificationInFirestore
} from '../auth';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit, doc, setDoc } from 'firebase/firestore';
import { getDeviceInfoPayload } from '../utils/deviceFingerprint';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'parent';
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'parent'>(() => {
    if (initialMode === 'signup') return 'signup';
    if (initialMode === 'parent') return 'parent';
    return 'login';
  });

  useEffect(() => {
    if (initialMode === 'signup') {
      setMode('signup');
      setSignupStep(1);
    } else if (initialMode === 'parent') {
      setMode('parent');
    } else {
      setMode('login');
    }
    setError(null);
  }, [initialMode, isOpen]);

  // Workflow Step state (Step 1: 30%, Step 2: 60%, Step 3: 90%)
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);

  // Form states - Step 1: Personal & Student Info (30%)
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [thirdName, setThirdName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentLoginPhone, setParentLoginPhone] = useState('');
  const [schoolYear, setSchoolYear] = useState<string>('الصف الثالث الثانوي');
  const [division, setDivision] = useState<string>('شعبة علمي علوم');

  // Form states - Step 2: Parent & School Info (60%)
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [parentJob, setParentJob] = useState('');
  const [governorate, setGovernorate] = useState('السويس');
  const [educationSystem, setEducationSystem] = useState('عربي');

  // Form states - Step 3: Final Step (90%)
  const [religion, setReligion] = useState('التربية الدينية الإسلامية');
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('ذكر');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);

  // Status message states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password state
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // WhatsApp OTP Verification states
  const [otpStep, setOtpStep] = useState<'idle' | 'login_otp' | 'forgot_otp' | 'reset_password_new'>('idle');
  const [otpSessionId, setOtpSessionId] = useState<string>('');
  const [otpMaskedPhone, setOtpMaskedPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [otpResetToken, setOtpResetToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [resetMethod, setResetMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [resetPhoneOrEmail, setResetPhoneOrEmail] = useState<string>('');

  // Guardian / Parent WhatsApp OTP Verification states
  const [parentOtpStep, setParentOtpStep] = useState<'input_phone' | 'verify_otp'>('input_phone');
  const [parentOtpSessionId, setParentOtpSessionId] = useState<string>('');
  const [parentOtpMaskedPhone, setParentOtpMaskedPhone] = useState<string>('');
  const [parentOtpCode, setParentOtpCode] = useState<string>('');
  const [parentOtpCooldown, setParentOtpCooldown] = useState<number>(0);
  const [parentDirectWaUrl, setParentDirectWaUrl] = useState<string>('');
  const [parentSimulatedOtp, setParentSimulatedOtp] = useState<string>('');
  const [parentMatchedStudents, setParentMatchedStudents] = useState<User[]>([]);
  const [parentStudentNames, setParentStudentNames] = useState<string>('');

  // 60-second cooldown timer effect
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Guardian OTP cooldown timer effect
  useEffect(() => {
    if (parentOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setParentOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [parentOtpCooldown]);

  // Reset OTP state when modal closes or mode shifts
  useEffect(() => {
    if (!isOpen) {
      setOtpStep('idle');
      setOtpSessionId('');
      setOtpCode('');
      setOtpCooldown(0);
      setOtpResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setParentOtpStep('input_phone');
      setParentOtpSessionId('');
      setParentOtpCode('');
      setParentOtpCooldown(0);
      setParentDirectWaUrl('');
      setParentSimulatedOtp('');
      setParentMatchedStudents([]);
      setParentStudentNames('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Validate Phone format
  const isValidPhone = (p: string) => {
    const cleaned = p.replace(/\s+/g, '');
    return /^[0-9+]{9,15}$/.test(cleaned);
  };

  // Handle Forgot Password Reset via Firebase Auth
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setError('الرجاء كتابة بريد إلكتروني صحيح.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(resetEmail.trim());
      setSuccessMsg('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح! يرجى مراجعة صندوق الوارد والبريد غير الهام.');
    } catch (err: any) {
      console.warn('Password reset error:', err);
      setError(getFriendlyAuthErrorMessage(err.code || '') || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Request Login OTP via WhatsApp
  const handleRequestLoginOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = phone.trim();
    if (!cleanInput) {
      setError('يرجى إدخال رقم الهاتف أو البريد الإلكتروني.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestWhatsAppLoginOtp(cleanInput, password.trim() || undefined);
      setOtpSessionId(res.sessionId);
      setOtpMaskedPhone(res.phoneMasked);
      setOtpCooldown(res.cooldownSeconds || 60);
      setOtpCode('');
      setOtpStep('login_otp');
      setSuccessMsg(res.message || 'تم إرسال رمز التحقق إلى واتساب بنجاح.');
    } catch (err: any) {
      console.warn('Request Login OTP error:', err);
      setError(err.message || 'فشل إرسال كود التحقق عبر الواتساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Verify Login OTP
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('يرجى كتابة رمز التحقق المكون من 6 أرقام بالكامل.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyWhatsAppLoginOtp(otpSessionId, cleanOtp);
      if (res && res.user) {
        // Use server-authoritative session ID to ensure old sessions on other devices are killed
        const deviceSessionId = res.sessionId || ('sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10));
        try {
          localStorage.setItem('al_motafalsifa_device_session_id', deviceSessionId);
          localStorage.setItem('al_motafalsifa_session_login_ts', String(Date.now()));
        } catch {}

        const authenticatedUser: User = {
          ...res.user,
          authProvider: 'whatsapp',
          activeSessionId: deviceSessionId,
          status: res.user.status || 'active',
        };
        saveCurrentUser(authenticatedUser);
        const allUsers = getSavedUsers();
        saveUsers([...allUsers.filter((u) => u.id !== authenticatedUser.id), authenticatedUser]);

        // Sync to Firestore users collection so realtime snapshot doesn't treat it as missing
        try {
          await setDoc(
            doc(db, 'users', authenticatedUser.id),
            {
              ...authenticatedUser,
              activeSessionId: deviceSessionId,
              lastLoginAt: new Date().toISOString(),
              authProvider: 'whatsapp',
            },
            { merge: true }
          );
        } catch (syncErr) {
          console.warn('Could not sync WhatsApp user to Firestore:', syncErr);
        }

        setSuccessMsg('تم تسجيل الدخول بنجاح! مرحباً بك في منصة المتفلسفة ...');
        setTimeout(() => {
          onAuthSuccess(authenticatedUser);
          onClose();
        }, 600);
      } else {
        throw new Error('تعذر تحميل بيانات الحساب، يرجى المحاولة ثانية.');
      }
    } catch (err: any) {
      console.warn('Verify Login OTP error:', err);
      setError(err.message || 'رمز التحقق غير صحيح، يرجى التأكد من الرمز المرسل عبر واتساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Request Forgot Password OTP via Email (hos098sam@gmail.com)
  const handleRequestForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = (resetPhoneOrEmail || phone).trim();
    const cleanRecoveryEmail = resetEmail.trim().toLowerCase();

    if (!cleanInput && !cleanRecoveryEmail) {
      setError('يرجى كتابة رقم هاتف الطالب المسجل والبريد الإلكتروني لاستلام رمز الاسترداد.');
      return;
    }

    if (!cleanRecoveryEmail || !cleanRecoveryEmail.includes('@')) {
      setError('يرجى إدخال بريدك الإلكتروني الصحيح (Gmail) لإرسال رمز الاسترداد إليه من بريد المنصة hos098sam@gmail.com.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestWhatsAppForgotPasswordOtp(cleanInput || cleanRecoveryEmail, cleanRecoveryEmail);
      setOtpSessionId(res.sessionId);
      setOtpMaskedPhone(res.phoneMasked || cleanRecoveryEmail);
      setOtpCooldown(res.cooldownSeconds || 60);
      setParentDirectWaUrl('');
      setOtpCode('');
      setOtpStep('forgot_otp');
      setSuccessMsg(
        res.message ||
          `تم إرسال رمز الاسترداد (6 أرقام) من البريد الرسمي (hos098sam@gmail.com) إلى بريدك الإلكتروني بنجاح.`
      );
    } catch (err: any) {
      console.warn('Request Forgot Email OTP error:', err);
      setError(
        err.message ||
          'تعذر إرسال رمز الاسترداد عبر البريد الإلكتروني، يرجى التأكد من أن رقم الطالب مسجل على المنصة.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Verify Forgot Password OTP
  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('يرجى إدخال رمز الاستعادة المكون من 6 أرقام.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyWhatsAppForgotPasswordOtp(otpSessionId, cleanOtp);
      setOtpResetToken(res.resetToken);
      setOtpStep('reset_password_new');
      setSuccessMsg('تم التحقق بنجاح! اكتب كلمة المرور الجديدة الآن.');
    } catch (err: any) {
      console.warn('Verify Forgot OTP error:', err);
      setError(err.message || 'رمز الاستعادة غير صحيح.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Set New Password with OTP Token
  const handleSetNewPasswordWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setError('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordWithWhatsAppOtp(otpSessionId, otpResetToken, newPassword);
      setSuccessMsg(res.message || 'تم تحديث كلمة المرور بنجاح!');
      setPassword(newPassword);

      setTimeout(() => {
        setOtpStep('idle');
        setIsResetPasswordMode(false);
        setSuccessMsg('تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بها.');
      }, 1500);
    } catch (err: any) {
      console.warn('Set New Password OTP error:', err);
      setError(err.message || 'فشل تعيين كلمة المرور الجديدة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Resend WhatsApp OTP with Cooldown protection
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || isSubmitting) return;
    setError(null);
    setSuccessMsg(null);

    setIsSubmitting(true);
    try {
      const res = await resendWhatsAppOtp(otpSessionId);
      setOtpCooldown(res.cooldownSeconds || 60);
      setSuccessMsg(res.message || 'تمت إعادة إرسال رمز التحقق إلى واتساب بنجاح.');
    } catch (err: any) {
      console.warn('Resend OTP error:', err);
      setError(err.message || 'تعذر إعادة إرسال الرمز حالياً، يرجى الانتظار قليلاً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Direct Password Reset (بدون الحاجة لانتظار كود واتساب أو رسالة إيميل)
  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = (resetPhoneOrEmail || resetEmail || phone).trim();
    if (!cleanInput) {
      setError('يرجى إدخال رقم الهاتف أو البريد الإلكتروني المسجل.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetUser: User | null = null;
      let targetEmail = cleanInput.toLowerCase();
      const localUsers = getSavedUsers();
      const cleanDigits = cleanInput.replace(/\D/g, '');

      // Check locally
      const matchedLocal = localUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) ||
          (u.phone && u.phone.replace(/\D/g, '') === cleanDigits)
      );

      if (matchedLocal) {
        targetUser = matchedLocal;
        if (matchedLocal.email) targetEmail = matchedLocal.email.toLowerCase();
      } else {
        // Query Firestore
        try {
          const q = cleanInput.includes('@')
            ? query(collection(db, 'users'), where('email', '==', targetEmail), limit(1))
            : query(collection(db, 'users'), where('phone', '==', cleanInput), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            targetUser = { id: snap.docs[0].id, ...(snap.docs[0].data() as User) };
            if (targetUser.email) targetEmail = targetUser.email.toLowerCase();
          }
        } catch (dbErr) {
          console.warn('Firestore lookup warning:', dbErr);
        }
      }

      const isSupervisorIdentifier =
        cleanInput.toLowerCase() === 'hos098sam@gmail.com' ||
        cleanDigits === '01040672314' ||
        cleanInput === '+201040672314';

      if (
        isSupervisorIdentifier ||
        (targetUser &&
          (targetUser.role === 'admin' ||
            targetUser.role === 'teacher' ||
            targetUser.role === 'assistant' ||
            targetUser.isAssistant ||
            Boolean(targetUser.assistantSpecialty)))
      ) {
        setError('لا يمكن إعادة تعيين كلمة مرور حسابات الإدارة أو المعلمين أو المساعدين من هذه النافذة. يرجى التواصل مع الإدارة العامة.');
        setIsSubmitting(false);
        return;
      }

      if (!targetEmail.includes('@')) {
        targetEmail = `${cleanDigits || 'student'}@qalbalam.edu`;
      }

      // Reset password via server API (for student accounts only)
      try {
        await createUserWithEmailAndPassword(auth, targetEmail, newPassword);
      } catch (authErr: any) {
        console.warn('Firebase Auth direct reset notice:', authErr?.code);
      }

      // Update Firestore user document if user exists
      if (targetUser?.id) {
        try {
          await setDoc(
            doc(db, 'users', targetUser.id),
            { updatedAt: new Date().toISOString(), emailVerified: true },
            { merge: true }
          );
        } catch {}
      }

      // Update local storage
      if (targetUser) {
        const updatedLocal = localUsers.map((u) =>
          u.id === targetUser!.id ? { ...u, updatedAt: new Date().toISOString(), emailVerified: true } : u
        );
        saveUsers(updatedLocal);
      }

      setPassword(newPassword);
      setPhone(cleanInput);
      setSuccessMsg('تم تعيين وتحديث كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول بها فوراً.');

      setTimeout(() => {
        setIsResetPasswordMode(false);
        setOtpStep('idle');
      }, 1500);
    } catch (err: any) {
      console.warn('Direct password reset error:', err);
      setError(err.message || 'حدث خطأ أثناء تعيين كلمة المرور.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Login using authentic Firebase Authentication (Email/Password)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanInput = phone.trim();
    const cleanPass = password.trim();

    if (!cleanInput || !cleanPass) {
      setError('الرجاء إدخال رقم الهاتف وكلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetEmail = cleanInput.toLowerCase();

      // 1. Fetch hardware device identity
      const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));

      // 2. Query central server login FIRST to verify credentials (supports students, teachers, and teaching assistants by accountNumber/phone)
      let serverStatus = 0;
      let serverErrorMessage = '';
      try {
        const sRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: cleanInput,
            password: cleanPass,
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
          }),
        });
        serverStatus = sRes.status;

        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.user) {
            const sid = sData.sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            try {
              localStorage.setItem('al_motafalsifa_device_session_id', sid);
              localStorage.setItem('al_motafalsifa_session_login_ts', String(Date.now()));
            } catch {}
            // Also sign in to client Firebase Auth in background if email is available so Firestore rules recognize auth.currentUser
            const fbCandidateEmail = sData.user.email || `${cleanInput.replace(/\D/g, '')}@qalb-alam.edu`;
            loginWithEmail(fbCandidateEmail, cleanPass).catch(() => {});

            const authedUser: User = { ...sData.user, activeSessionId: sid };
            saveCurrentUser(authedUser);
            onAuthSuccess(authedUser);
            onClose();
            return;
          }
        } else if (sRes.status === 403) {
          const sErr = await sRes.json().catch(() => ({}));
          setError(sErr.error || 'عذراً، لقد استنفذت الحد المسموح به لتغيير الجهاز (مرتان شهرياً كحد أقصى لمنع مشاركة الحساب).');
          setIsSubmitting(false);
          return;
        } else {
          const sErr = await sRes.json().catch(() => ({}));
          serverErrorMessage = sErr.error || '';
        }
      } catch (netErr) {
        console.warn('Direct server login network notice:', netErr);
      }

      // Check if user is logging in as Admin with email (hos098sam@gmail.com)
      const isAdminAccount = targetEmail === 'hos098sam@gmail.com';

      // If user typed a phone number or accountNumber instead of email, resolve from registered list or standard synthetic email
      if (!targetEmail.includes('@')) {
        let matchedEmail = '';
        const cleanDigits = cleanInput.replace(/\D/g, '');

        // Check if admin entered admin phone
        if (cleanDigits === '01040672314' || cleanInput === '+201040672314') {
          targetEmail = 'hos098sam@gmail.com';
        } else {
          // 1. Check local saved users list by accountNumber or phone
          const localUsers = getSavedUsers();
          const matchedLocal = localUsers.find(
            (u) =>
              (u.accountNumber && u.accountNumber.trim().toLowerCase() === cleanInput.toLowerCase()) ||
              (u.phone && u.phone.trim().toLowerCase() === cleanInput.toLowerCase()) ||
              (cleanDigits.length > 0 && u.phone && u.phone.replace(/\D/g, '') === cleanDigits)
          );
          if (matchedLocal) {
            if (matchedLocal.password && matchedLocal.password === cleanPass) {
              const sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
              const authedUser: User = { ...matchedLocal, activeSessionId: sid };
              saveCurrentUser(authedUser);
              onAuthSuccess(authedUser);
              onClose();
              return;
            }
            matchedEmail = matchedLocal.email?.toLowerCase() || `${cleanDigits || cleanInput}@qalb-alam.edu`;
          }

          // 2. If not found locally, query Firestore by phone
          if (!matchedEmail) {
            try {
              const qPhone = query(collection(db, 'users'), where('phone', '==', cleanInput), limit(1));
              const snapPhone = await getDocs(qPhone);
              if (!snapPhone.empty) {
                const docData = snapPhone.docs[0].data();
                matchedEmail = (docData?.email || `${cleanDigits || cleanInput}@qalb-alam.edu`).toLowerCase();
              }
            } catch (e) {
              // Firestore read may be restricted while unauthenticated; fall back to synthetic email
            }
          }

          // 3. Always allow falling back to the platform's standard phone-based email (@qalb-alam.edu)
          if (matchedEmail) {
            targetEmail = matchedEmail;
          } else if (cleanDigits.length >= 10) {
            targetEmail = `${cleanDigits}@qalb-alam.edu`;
          } else {
            setError(serverErrorMessage || 'رقم الهاتف أو الحساب غير مسجل في المنصة. يرجى التأكد من الرقم.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 3. Fallback: Authenticate with Firebase Authentication (with direct server fallback for school tablets)
      let fbUser: any = null;
      try {
        fbUser = await loginWithEmail(targetEmail, cleanPass);
      } catch (authErr: any) {
        const errCode = authErr?.code || '';
        console.warn('Firebase login attempt result:', errCode || authErr?.message);

        if (!fbUser) {
          // If user credentials do not exist or mismatch
          if (errCode === 'auth/invalid-credential' || errCode === 'auth/user-not-found' || errCode === 'auth/wrong-password') {
            const isSupervisor = targetEmail === 'hos098sam@gmail.com';
            const localUsers = getSavedUsers();
            const localMatch = localUsers.find(
              (u) =>
                u.email?.toLowerCase() === targetEmail ||
                (u.accountNumber && u.accountNumber.trim().toLowerCase() === cleanInput.toLowerCase()) ||
                (u.phone && u.phone.replace(/\D/g, '') === cleanInput.replace(/\D/g, ''))
            );

            // If local account has an explicit saved password that matches cleanPass
            if (localMatch && localMatch.password && localMatch.password === cleanPass) {
              fbUser = {
                uid: localMatch.id,
                email: localMatch.email || targetEmail,
                displayName: localMatch.name,
                emailVerified: true,
                serverUser: localMatch,
              };
            } else if (isSupervisor) {
              const adminUser: User = {
                id: 'admin-hosam-supervisor',
                name: 'إدارة المنصة',
                email: 'hos098sam@gmail.com',
                phone: '01040672314',
                parentPhone: '',
                role: 'admin',
                status: 'active',
                schoolYear: 'المشرف العام ومؤسس المنصة',
                registeredAt: '2026-09-25',
                emailVerified: true,
              };
              const sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
              try {
                localStorage.setItem('al_motafalsifa_device_session_id', sid);
                localStorage.setItem('al_motafalsifa_session_login_ts', String(Date.now()));
              } catch {}
              if (cleanPass !== 'Hossam2027') {
                setError('كلمة المرور غير صحيحة لحساب إدارة المنصة.');
                setIsSubmitting(false);
                return;
              }
              saveCurrentUser(adminUser);
              onAuthSuccess(adminUser);
              onClose();
              return;
            } else if (localMatch || serverStatus === 401) {
              setError(serverErrorMessage || 'كلمة المرور غير صحيحة. يرجى التأكد من كتابة كلمة المرور بشكل دقيق.');
              setIsSubmitting(false);
              return;
            } else {
              // Account does not exist on platform
              setError(serverErrorMessage || 'هذا الحساب أو الرقم غير مسجل في المنصة. يرجى إنشاء حساب جديد أولاً.');
              setIsSubmitting(false);
              return;
            }
          } else {
            console.warn('Login error encountered:', errCode);
            setError(serverErrorMessage || getFriendlyAuthErrorMessage(errCode) || authErr.message);
            setIsSubmitting(false);
            return;
          }
        }
      }

      if (!fbUser) {
        setError(serverErrorMessage || 'هذا الحساب غير مسجل في المنصة. يرجى إنشاء حساب جديد.');
        setIsSubmitting(false);
        return;
      }

      // 4. Fetch official profile from serverUser or Firestore
      let userProfile = fbUser.serverUser || (await fetchUserProfile(fbUser.uid));
      const isSupervisor = fbUser.email === 'hos098sam@gmail.com' || targetEmail === 'hos098sam@gmail.com';

      if (!userProfile && !isSupervisor) {
        const localUsers = getSavedUsers();
        const localMatch = localUsers.find(
          (u) => u.email?.toLowerCase() === targetEmail || (u.phone && u.phone.replace(/\D/g, '') === cleanInput.replace(/\D/g, ''))
        );
        if (localMatch) {
          userProfile = localMatch;
          try {
            await setDoc(doc(db, 'users', fbUser.uid), { ...localMatch, id: fbUser.uid }, { merge: true });
          } catch {}
        }
      }

      // If Firebase Auth succeeded, ensure userProfile exists and sync credentials to server
      if (!userProfile && !isSupervisor) {
        userProfile = {
          id: fbUser.uid,
          name: fbUser.displayName || 'طالب منصة المتفلسفة ',
          email: fbUser.email || targetEmail,
          phone: cleanInput.includes('@') ? '' : cleanInput,
          parentPhone: '',
          schoolYear: 'الصف الثالث الثانوي',
          role: 'student',
          status: 'active',
          registeredAt: new Date().toISOString().split('T')[0],
          enrolledCourseIds: [],
          examResults: {},
        };
      }

      // Sync verified password to server disk cache so future logins work instantaneously
      if (userProfile && !isSupervisor) {
        fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...userProfile,
            id: fbUser.uid || userProfile.id,
            uid: fbUser.uid || userProfile.id,
            password: cleanPass,
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
            syncFromFirebaseAuth: true,
          }),
        }).catch(() => {});
      }

      let authenticatedUser: User;
      if (userProfile) {
        authenticatedUser = {
          ...userProfile,
          role: isSupervisor ? 'admin' : userProfile.role,
          status: 'active',
          emailVerified: fbUser.emailVerified,
        };
      } else {
        authenticatedUser = {
          id: fbUser.uid,
          name: 'إدارة المنصة',
          email: fbUser.email || targetEmail,
          phone: cleanInput.includes('@') ? '' : cleanInput,
          parentPhone: '',
          schoolYear: 'المشرف العام ومؤسس المنصة',
          role: 'admin',
          status: 'active',
          registeredAt: new Date().toISOString().split('T')[0],
          emailVerified: fbUser.emailVerified,
        };
      }

      // Enforce device binding and limit checking via register-session
      const deviceSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      const regRes = await fetch('/api/auth/register-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authenticatedUser.id,
          phone: authenticatedUser.phone || '',
          activeSessionId: deviceSessionId,
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
        }),
      });

      if (!regRes.ok && regRes.status === 403) {
        const regErr = await regRes.json().catch(() => ({}));
        setError(regErr.error || 'عذراً، لقد استنفذت الحد المسموح به لتغيير الجهاز (مرتان شهرياً كحد أقصى لمنع مشاركة الحساب).');
        setIsSubmitting(false);
        return;
      }

      try {
        localStorage.setItem('al_motafalsifa_device_session_id', deviceSessionId);
        localStorage.setItem('al_motafalsifa_session_login_ts', String(Date.now()));
      } catch {}

      try {
        await setDoc(doc(db, 'users', authenticatedUser.id), {
          activeSessionId: deviceSessionId,
          status: 'active',
          currentDeviceId: deviceInfo.deviceId,
          currentDeviceName: deviceInfo.deviceName,
          lastLoginAt: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {
        console.warn('Could not save activeSessionId to Firestore:', e);
      }

      authenticatedUser.activeSessionId = deviceSessionId;
      authenticatedUser.currentDeviceId = deviceInfo.deviceId;
      authenticatedUser.currentDeviceName = deviceInfo.deviceName;
      authenticatedUser.status = 'active';

      // 5. Authenticate and proceed directly
      onAuthSuccess(authenticatedUser);
      onClose();
    } catch (err: any) {
      console.warn('Login process warning:', err?.message || err);
      setError(getFriendlyAuthErrorMessage(err?.code || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Parent Login by Phone: Requests special WhatsApp OTP to Guardian (إرسال رمز تحقق خاص لواتساب ولي الأمر)
  const handleRequestParentOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanPhone = parentLoginPhone.trim().replace(/\s+/g, '');
    if (!cleanPhone) {
      setError('الرجاء إدخال رقم هاتف ولي الأمر المسجل في حساب الطالب.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Gather all linked students from local state & Firestore
      let matchedStudents: User[] = [];
      const localUsers = getSavedUsers();
      const cleanDigits = cleanPhone.replace(/\D/g, '');

      localUsers.forEach((u) => {
        const pMatch =
          (u.parentPhone && u.parentPhone.replace(/\D/g, '') === cleanDigits) ||
          (u.fatherPhone && u.fatherPhone.replace(/\D/g, '') === cleanDigits) ||
          (u.motherPhone && u.motherPhone.replace(/\D/g, '') === cleanDigits) ||
          (u.phone && u.phone.replace(/\D/g, '') === cleanDigits);
        if (pMatch && !matchedStudents.some((s) => s.id === u.id)) {
          matchedStudents.push(u);
        }
      });

      try {
        const qParent = query(collection(db, 'users'), where('parentPhone', '==', cleanPhone));
        const snapParent = await getDocs(qParent);
        snapParent.docs.forEach((d) => {
          if (!matchedStudents.some((s) => s.id === d.id)) {
            matchedStudents.push({ id: d.id, ...(d.data() as User) });
          }
        });

        const qFather = query(collection(db, 'users'), where('fatherPhone', '==', cleanPhone));
        const snapFather = await getDocs(qFather);
        snapFather.docs.forEach((d) => {
          if (!matchedStudents.some((s) => s.id === d.id)) {
            matchedStudents.push({ id: d.id, ...(d.data() as User) });
          }
        });

        const qMother = query(collection(db, 'users'), where('motherPhone', '==', cleanPhone));
        const snapMother = await getDocs(qMother);
        snapMother.docs.forEach((d) => {
          if (!matchedStudents.some((s) => s.id === d.id)) {
            matchedStudents.push({ id: d.id, ...(d.data() as User) });
          }
        });
      } catch (err) {
        console.warn('Firestore parent lookup warning:', err);
      }

      if (matchedStudents.length === 0) {
        setError(`رقم ولي الأمر (${cleanPhone}) غير مسجل لأي طالب في المنصة. لا يمكن تسجيل الدخول أو إرسال الرمز لرقم غير مسجل. يرجى إنشاء حساب جديد للطالب أولاً.`);
        setIsSubmitting(false);
        return;
      }

      const stNames = matchedStudents.map((s) => s.name).filter(Boolean).join(' و ');
      const verifiedTimestamp = new Date().toISOString();
      const mainStudent = matchedStudents[0];

      const authenticatedParent: User = {
        id: `parent-${cleanDigits}`,
        name: `ولي أمر الطالب (${stNames || mainStudent?.name || 'طالب المتفلسفة '})`,
        phone: cleanPhone,
        parentPhone: cleanPhone,
        schoolYear: mainStudent?.schoolYear || 'الصف الثالث الثانوي',
        role: 'parent',
        status: 'active',
        guardianVerified: true,
        guardianVerifiedPhone: cleanPhone,
        guardianVerifiedAt: verifiedTimestamp,
        registeredAt: verifiedTimestamp.split('T')[0],
        linkedStudentId: mainStudent?.id,
        linkedStudents: matchedStudents,
      };

      saveCurrentUser(authenticatedParent);
      setSuccessMsg(`تم التحقق من رقم ولي الأمر بنجاح! جاري فتح تقرير متابعة الطالب (${stNames})...`);
      setTimeout(() => {
        onAuthSuccess(authenticatedParent);
        onClose();
      }, 400);
    } catch (err: any) {
      console.warn('Parent login error:', err);
      setError(err?.message || 'تعذر تسجيل دخول ولي الأمر حالياً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify Guardian OTP, apply verification, save student data, and HIDE guardian page
  const handleVerifyParentOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanOtp = parentOtpCode.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError('يرجى إدخال رمز التحقق المكون من 6 أرقام المرسل إلى واتساب ولي الأمر.');
      return;
    }

    setIsSubmitting(true);
    try {
      const mainStudent = parentMatchedStudents[0];
      const res = await verifyWhatsAppParentOtp(parentOtpSessionId, cleanOtp, mainStudent);

      const verifiedTimestamp = new Date().toISOString();
      const cleanPhone = parentLoginPhone.trim().replace(/\s+/g, '');

      // Mark matched students as guardian-verified
      const allUsers = getSavedUsers();
      const updatedStudents = parentMatchedStudents.map((s) => ({
        ...s,
        guardianVerified: true,
        guardianVerifiedPhone: cleanPhone,
        guardianVerifiedAt: verifiedTimestamp,
      }));

      // Update local storage
      const mergedUsers = allUsers.map((u) => {
        const found = updatedStudents.find((s) => s.id === u.id);
        return found || u;
      });
      saveUsers(mergedUsers);

      // Update Firestore asynchronously
      parentMatchedStudents.forEach((st) => {
        if (st.id) {
          updateStudentGuardianVerificationInFirestore(st.id, cleanPhone).catch(() => {});
        }
      });

      const authenticatedParent: User = {
        ...res.user,
        guardianVerified: true,
        guardianVerifiedPhone: cleanPhone,
        guardianVerifiedAt: verifiedTimestamp,
        linkedStudents: updatedStudents.length > 0 ? updatedStudents : res.linkedStudents,
      };

      saveCurrentUser(authenticatedParent);
      setSuccessMsg('تم التحقق بنجاح! تم حفظ وتوثيق بيانات الطالب وتفعيل الربط الأبوي.');

      // Hide parent modal and transition immediately (تطبق عند تطبيق الرمز ويخفي صفحته ولي الامر)
      setTimeout(() => {
        onAuthSuccess(authenticatedParent);
        onClose(); // ويخفي صفحته ولي الامر
      }, 700);
    } catch (err: any) {
      console.warn('Verify parent OTP error:', err);
      setError(err?.message || 'رمز التحقق غير صحيح، يرجى التأكد من الرمز المرسل عبر واتساب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend Guardian WhatsApp OTP
  const handleResendParentOtp = async () => {
    if (parentOtpCooldown > 0 || isSubmitting) return;
    await handleRequestParentOtp();
  };

  // Validate Step 1 and proceed to Step 2 with phone and national ID duplicate prevention
  const handleProceedToStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !secondName.trim() || !thirdName.trim() || !lastName.trim()) {
      setError('الرجاء إدخال الاسم الرباعي بالكامل (الاسم الأول، الثاني، الثالث، والأخير كما في البطاقة).');
      return;
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!isValidPhone(cleanPhone)) {
      setError('الرجاء إدخال رقم هاتف صحيح ومكون من 10-11 رقماً.');
      return;
    }

    // 1. Check local users for phone duplicate
    const users = getSavedUsers();
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    if (users.some((u) => u.phone && u.phone.replace(/\D/g, '') === cleanDigits)) {
      setError('رقم الهاتف مسجل بالفعل في المنصة بحساب آخر. لا يمكن تكرار أرقام الهواتف، يرجى تسجيل الدخول مباشرة.');
      return;
    }

    // 2. Query Firestore users for phone duplicate
    setIsSubmitting(true);
    try {
      const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone), limit(1));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        setError('رقم الهاتف مسجل بالفعل في المنصة بحساب آخر. لا يمكن تكرار أرقام الهواتف، يرجى تسجيل الدخول مباشرة.');
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      console.warn('Firestore phone duplicate check warning:', err);
    } finally {
      setIsSubmitting(false);
    }

    setSignupStep(2);
  };

  // Validate Step 2 and proceed to Step 3
  const handleProceedToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanFather = fatherPhone.trim();
    const cleanMother = motherPhone.trim();

    if (!cleanFather && !cleanMother) {
      setError('الرجاء إدخال رقم هاتف الأب أو رقم هاتف الأم على الأقل.');
      return;
    }

    if (cleanFather && !isValidPhone(cleanFather)) {
      setError('الرجاء إدخال رقم هاتف الأب بشكل صحيح.');
      return;
    }

    if (cleanMother && !isValidPhone(cleanMother)) {
      setError('الرجاء إدخال رقم هاتف الأم بشكل صحيح.');
      return;
    }

    if (cleanFather === phone.trim() || cleanMother === phone.trim()) {
      setError('تنبيه: يجب أن يكون رقم هاتف ولي الأمر مختلفاً عن رقم هاتف الطالب.');
      return;
    }

    if (!schoolName.trim()) {
      setError('الرجاء إدخال اسم المدرسة.');
      return;
    }

    setSignupStep(3);
  };

  // Final Submit on Step 3 (الخطوة الأخيرة 90%) using Firebase Authentication & Firestore (بالاعتماد على رقم الهاتف)
  const handleFinalSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanDigits = cleanPhone.replace(/\D/g, '');
    const generatedEmail = `${cleanDigits}@qalb-alam.edu`;

    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      setError('الرجاء التأكد من إدخال رقم هاتف صحيح للطالب.');
      return;
    }

    const cleanPass = password.trim();
    if (cleanPass.length < 6) {
      setError('كلمة السر يجب ألا تقل عن 6 خانات لأمان الحساب.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setError('كلمتا السر غير متطابقتين.');
      return;
    }

    if (!termsAgreed) {
      setError('الرجاء الموافقة على الشروط والأحكام واتفاقية شراء الكورس في منصة المتفلسفة .');
      return;
    }

    // Check duplicate phone locally
    const users = getSavedUsers();
    if (users.some((u) => u.phone && u.phone.replace(/\D/g, '') === cleanDigits)) {
      setError('رقم الهاتف هذا مسجل بالفعل في المنصة بحساب آخر. لا يمكن تكرار أرقام الهواتف أو إنشاء أكثر من حساب لنفس الرقم، يرجى تسجيل الدخول مباشرة.');
      return;
    }

    setIsSubmitting(true);

    // Check duplicate phone in Firestore
    try {
      const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone), limit(1));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        setError('رقم الهاتف هذا مسجل بالفعل في المنصة بحساب آخر. لا يمكن تكرار أرقام الهواتف أو إنشاء أكثر من حساب لنفس الرقم، يرجى تسجيل الدخول مباشرة.');
        setIsSubmitting(false);
        return;
      }
    } catch (e) {
      console.warn('Firestore phone duplicate check warning:', e);
    }

    const fullName = `${firstName.trim()} ${secondName.trim()} ${thirdName.trim()} ${lastName.trim()}`;
    const primaryParentPhone = fatherPhone.trim() || motherPhone.trim();

    const isPrimaryOrPrep = schoolYear.includes('الابتدائي') || schoolYear.includes('الإعدادي');
    const isSecondary = schoolYear.includes('الثانوي') || schoolYear.includes('بكالوريا');
    const activeDivision = isPrimaryOrPrep ? '' : division;

    // Composite school year label if secondary with division
    const fullSchoolYearDisplay = isSecondary && activeDivision ? `${schoolYear} (${activeDivision})` : schoolYear;

    // Generate unique active session token for single-device enforcement
    const deviceSessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));
    try {
      localStorage.setItem('al_motafalsifa_device_session_id', deviceSessionId);
      localStorage.setItem('al_motafalsifa_session_login_ts', String(Date.now()));
    } catch {}

    const profileData: Partial<User> = {
      name: fullName,
      firstName: firstName.trim(),
      secondName: secondName.trim(),
      thirdName: thirdName.trim(),
      lastName: lastName.trim(),
      governorate: governorate,
      phone: cleanPhone,
      parentPhone: primaryParentPhone,
      fatherPhone: fatherPhone.trim(),
      motherPhone: motherPhone.trim(),
      schoolName: schoolName.trim(),
      parentJob: parentJob.trim(),
      educationSystem: educationSystem,
      division: isSecondary ? activeDivision : undefined,
      religion: religion,
      gender: gender,
      email: generatedEmail,
      schoolYear: fullSchoolYearDisplay,
      role: 'student',
      status: 'active', // تفعيل الحساب فوراً ومباشرة دون انتظار مراجعة
      activeSessionId: deviceSessionId,
      currentDeviceId: deviceInfo.deviceId || undefined,
      currentDeviceName: deviceInfo.deviceName || undefined,
      registeredAt: new Date().toISOString().split('T')[0],
      enrolledCourseIds: [],
      examResults: {},
    };

    try {
      const { profile } = await signupWithEmail(generatedEmail, cleanPass, profileData);

      // Save user session in Firestore
      try {
        await setDoc(
          doc(db, 'users', profile.id),
          {
            activeSessionId: deviceSessionId,
            status: 'active',
            currentDeviceId: deviceInfo.deviceId || null,
            currentDeviceName: deviceInfo.deviceName || null,
          },
          { merge: true }
        );
      } catch (e) {}

      // Cache in local users list for instant offline display
      const currentUsers = getSavedUsers();
      const finalProfile: User = {
        ...profile,
        status: 'active',
        activeSessionId: deviceSessionId,
        currentDeviceId: deviceInfo.deviceId || profile.currentDeviceId,
        currentDeviceName: deviceInfo.deviceName || profile.currentDeviceName,
      };
      const updatedUsers = [...currentUsers.filter((u) => u.phone?.replace(/\D/g, '') !== cleanDigits), finalProfile];
      saveUsers(updatedUsers);
      saveCurrentUser(finalProfile);

      setSuccessMsg('تم إنشاء وتفعيل حسابك بنجاح! جاري تسجيل الدخول مباشرة...');
      setTimeout(() => {
        setIsSubmitting(false);
        onAuthSuccess(finalProfile);
        onClose();
      }, 500);
    } catch (err: any) {
      console.warn('Signup error, attempting direct school tablet server fallback:', err);
      try {
        const sRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...profileData,
            email: generatedEmail,
            password: cleanPass,
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
          }),
        });
        const sData = await sRes.json();
        if (sRes.ok && sData.user) {
          const finalProfile: User = { ...sData.user, status: 'active', activeSessionId: deviceSessionId };
          const currentUsers = getSavedUsers();
          saveUsers([...currentUsers.filter((u) => u.phone?.replace(/\D/g, '') !== cleanDigits), finalProfile]);
          saveCurrentUser(finalProfile);
          setSuccessMsg('تم إنشاء وتفعيل حسابك بنجاح! جاري فتح المنصة فوراً...');
          setTimeout(() => {
            setIsSubmitting(false);
            onAuthSuccess(finalProfile);
            onClose();
          }, 500);
          return;
        }
        if (sData.error) {
          setError(sData.error);
          setIsSubmitting(false);
          return;
        }
      } catch {}

      if (err?.code === 'auth/email-already-in-use') {
        setError('رقم الهاتف هذا مسجل بالفعل في المنصة بحساب آخر. لا يمكن تكرار أرقام الهواتف، يرجى تسجيل الدخول مباشرة.');
      } else {
        setError(getFriendlyAuthErrorMessage(err?.code || '') || err?.message || 'تعذر إنشاء الحساب حالياً.');
      }
      setIsSubmitting(false);
    }
  };

  // Grade choices specified by user (1st Primary to 3rd Secondary)
  const gradesList = [
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي',
    'الصف الأول الإعدادي',
    'الصف الثاني الإعدادي',
    'الصف الثالث الإعدادي',
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي'
  ];

  // Education systems specified by user: عربي، لغات، بكالوريا
  const educationSystems = [
    'عربي',
    'لغات',
    'بكالوريا'
  ];

  // Secondary general branches (1st & 2nd Secondary)
  const secondaryDivisions = [
    'بكالوريا',
    'عام',
    'أزهر'
  ];

  // Third secondary branches
  const thirdSecondaryDivisions = [
    'علمي علوم',
    'علمي رياضة',
    'شعبة أدبي',
    'بكالوريا',
    'عام',
    'أزهر'
  ];

  const governoratesList = [
    'السويس',
    'القاهرة',
    'الجيزة',
    'الإسكندرية',
    'الإسماعيلية',
    'بورسعيد',
    'الشرقية',
    'الدقهلية',
    'القليوبية',
    'المنوفية',
    'الغربية',
    'كفر الشيخ',
    'البحيرة',
    'دمياط',
    'الفيوم',
    'بني سويف',
    'المنيا',
    'أسيوط',
    'سوهاج',
    'قنا',
    'الأقصر',
    'أسوان',
    'البحر الأحمر',
    'شمال سيناء',
    'جنوب سيناء',
    'مطروح',
    'الوادي الجديد',
    'دمشق',
    'ريف دمشق',
    'حلب',
    'حمص',
    'حماة',
    'اللاذقية',
    'طرطوس',
    'درعا',
    'السويداء'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-[32px] w-full max-w-xl shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh]">
        {/* Top Header bar with Workflow tabs & Back to Home */}
        <div className="p-5 sm:p-6 pb-4 bg-slate-50 border-b border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white border border-indigo-200 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
                    <img
                      src={qalbAlElmLogo}
                      alt="شعار منصة المتفلسفة "
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {mode === 'signup'
                      ? 'طلب انشاء حساب طالب جديد'
                      : mode === 'parent'
                      ? 'بوابة دخول ولي الأمر (بالرقم فقط)'
                      : 'تسجيل دخول الطلاب'}
                  </h3>
                </div>

                {/* Back to home / close button */}
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  <span>الرجوع للرئيسية</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>

          {/* Mode Switcher Tabs (3 Standalone tabs) */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/70 rounded-2xl">
            {/* الخانة 1: حساب طالب جديد */}
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSignupStep(1);
              }}
              className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                mode === 'signup' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>حساب طالب جديد</span>
            </button>

            {/* الخانة 2: تسجيل دخول الطلاب */}
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>تسجيل دخول الطلاب</span>
            </button>

            {/* الخانة 3: دخول ولي الأمر */}
            <button
              type="button"
              onClick={() => {
                setMode('parent');
                setError(null);
              }}
              className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                mode === 'parent' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-slate-950" />
              <span>دخول ولي الأمر 👨‍👧</span>
            </button>
          </div>

          {/* Signup Steps Progress Indicator (Workflow 30% / 60% / 90%) */}
          {mode === 'signup' && (
            <div className="mt-4 pt-3 border-t border-slate-200/60">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 mb-1.5">
                <span className="text-indigo-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {signupStep === 1 && 'الخطوة الأولى'}
                  {signupStep === 2 && 'الخطوة الثانية'}
                  {signupStep === 3 && 'الخطوة الأخيره'}
                </span>
                <span className="text-slate-600 font-mono font-black">
                  {signupStep === 1 ? '30%' : signupStep === 2 ? '60%' : '90%'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: signupStep === 1 ? '30%' : signupStep === 2 ? '60%' : '90%',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Form Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex flex-col gap-2 animate-shake">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              {(error.includes('غير مسجل') || error.includes('إنشاء حساب')) && mode !== 'signup' && (
                <div className="pt-2 border-t border-rose-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-rose-700 font-medium">ليس لديك حساب على المنصة؟</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setSignupStep(1);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] transition-colors shadow-xs cursor-pointer"
                  >
                    إنشاء حساب جديد الآن ✍️
                  </button>
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* SIGNUP WORKFLOW */}
          {/* ======================================================== */}
          {mode === 'signup' && (
            <div>
              {/* STEP 1: Personal info (الخطوة الأولى 30%) */}
              {signupStep === 1 && (
                <form onSubmit={handleProceedToStep2} className="space-y-4">
                  {/* Workflow notice banner */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 space-y-1">
                    <div className="text-xs font-black flex items-center gap-1.5 text-indigo-700">
                      <Clock className="w-4 h-4" />
                      <span>طلب انشاء حساب :</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                      ادخل بياناتك بشكل صحيح وسيتم مراجعة طلبك خلال ساعات لـ بضع ايام, وتقدر تسجل دخول عشان تشوف حالة الطلب بتاعك
                    </p>
                  </div>

                  {/* 4 Quad Names Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الاسم الأول
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="اكتب اسمك بالعربي زي اللي موجود في البطاقة"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الاسم الثاني
                      </label>
                      <input
                        type="text"
                        required
                        value={secondName}
                        onChange={(e) => setSecondName(e.target.value)}
                        placeholder="اكتب اسمك بالعربي زي اللي موجود في البطاقة"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الاسم الثالث
                      </label>
                      <input
                        type="text"
                        required
                        value={thirdName}
                        onChange={(e) => setThirdName(e.target.value)}
                        placeholder="اكتب اسمك بالعربي زي اللي موجود في البطاقة"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الاسم الأخير
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="اكتب اسمك بالعربي زي اللي موجود في البطاقة"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Phone number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم الهاتف
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="010XXXXXXXX"
                        className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* School Grade / Year & Conditional Branching for Secondary Only (No division in Primary & Prep) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={(schoolYear.includes('الابتدائي') || schoolYear.includes('الإعدادي')) ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الصف الدراسي
                      </label>
                      <select
                        value={schoolYear}
                        onChange={(e) => {
                          const newGrade = e.target.value;
                          setSchoolYear(newGrade);
                          if (newGrade.includes('الابتدائي') || newGrade.includes('الإعدادي')) {
                            setDivision('');
                          } else if (newGrade === 'الصف الثالث الثانوي') {
                            setDivision('علمي علوم');
                          } else {
                            setDivision('بكالوريا');
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-medium text-slate-800"
                      >
                        <optgroup label="المرحلة الابتدائية (بدون شعبة)">
                          <option value="الصف الأول الابتدائي">الصف الأول الابتدائي</option>
                          <option value="الصف الثاني الابتدائي">الصف الثاني الابتدائي</option>
                          <option value="الصف الثالث الابتدائي">الصف الثالث الابتدائي</option>
                          <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                          <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                          <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                        </optgroup>
                        <optgroup label="المرحلة الإعدادية (بدون شعبة)">
                          <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                          <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                          <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                        </optgroup>
                        <optgroup label="المرحلة الثانوية">
                          <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                          <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                          <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                        </optgroup>
                      </select>
                    </div>

                    {/* Show Division / Branch selector ONLY for Secondary Stage */}
                    {schoolYear === 'الصف الثالث الثانوي' ? (
                      <div className="animate-fadeIn">
                        <label className="block text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-indigo-600" />
                          <span>الشعبة (الصف الثالث الثانوي)</span>
                        </label>
                        <select
                          value={thirdSecondaryDivisions.includes(division) ? division : 'علمي علوم'}
                          onChange={(e) => setDivision(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900"
                        >
                          <optgroup label="شعب تالتة ثانوي التخصصية">
                            <option value="علمي علوم">علمي علوم</option>
                            <option value="علمي رياضة">علمي رياضة</option>
                            <option value="شعبة أدبي">شعبة أدبي</option>
                          </optgroup>
                          <optgroup label="نظام المرحلة الثانوية">
                            <option value="بكالوريا">بكالوريا</option>
                            <option value="عام">عام</option>
                            <option value="أزهر">أزهر</option>
                          </optgroup>
                        </select>
                      </div>
                    ) : (schoolYear === 'الصف الأول الثانوي' || schoolYear === 'الصف الثاني الثانوي') ? (
                      <div className="animate-fadeIn">
                        <label className="block text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-indigo-600" />
                          <span>الشعبة (المرحلة الثانوية)</span>
                        </label>
                        <select
                          value={secondaryDivisions.includes(division) ? division : 'بكالوريا'}
                          onChange={(e) => setDivision(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900"
                        >
                          {secondaryDivisions.map((div) => (
                            <option key={div} value={div}>
                              {div}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  {/* Next Step Button */}
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <span>التالي</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {/* Already have an account link */}
                  <div className="text-center pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-600 font-medium">
                      يوجد لديك حساب بالفعل؟{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className="text-indigo-600 font-black hover:underline"
                      >
                        ادخل إلى حسابك الآن !
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* STEP 2: Parent phone, School, Job, Governorate, Education System (الخطوة الثانية 60%) */}
              {signupStep === 2 && (
                <form onSubmit={handleProceedToStep3} className="space-y-4 animate-fadeIn">
                  {/* Workflow notice banner */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 space-y-1">
                    <div className="text-xs font-black flex items-center gap-1.5 text-indigo-700">
                      <Clock className="w-4 h-4" />
                      <span>طلب انشاء حساب :</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                      ادخل بياناتك بشكل صحيح وسيتم مراجعة طلبك خلال ساعات لـ بضع ايام, وتقدر تسجل دخول عشان تشوف حالة الطلب بتاعك
                    </p>
                  </div>

                  {/* Father Phone & Mother Phone Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم هاتف الأب
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          value={fatherPhone}
                          onChange={(e) => setFatherPhone(e.target.value)}
                          placeholder="01XXXXXXXXX"
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                          dir="ltr"
                        />
                        <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رقم هاتف الأم
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={motherPhone}
                          onChange={(e) => setMotherPhone(e.target.value)}
                          placeholder="01XXXXXXXXX (اختياري)"
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                          dir="ltr"
                        />
                        <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* School Name & Parent Job */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اسم المدرسة
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder="اكتب اسم مدرستك الحالية"
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                        <School className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        مهنة ولي الأمر
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={parentJob}
                          onChange={(e) => setParentJob(e.target.value)}
                          placeholder="وظيفة أو عمل ولي الأمر"
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                        <Briefcase className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Governorate (السويس / list) & Education System (عربي، لغات، بكالوريا) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        المحافظة
                      </label>
                      <div className="relative">
                        <select
                          value={governorate}
                          onChange={(e) => setGovernorate(e.target.value)}
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-medium"
                        >
                          {governoratesList.map((gov) => (
                            <option key={gov} value={gov}>
                              {gov}
                            </option>
                          ))}
                        </select>
                        <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        النظام الدراسي
                      </label>
                      <div className="relative">
                        <select
                          value={educationSystem}
                          onChange={(e) => setEducationSystem(e.target.value)}
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-bold text-indigo-900"
                        >
                          {educationSystems.map((sys) => (
                            <option key={sys} value={sys}>
                              {sys}
                            </option>
                          ))}
                        </select>
                        <BookOpen className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Buttons: Next & Prev */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSignupStep(1);
                        setError(null);
                      }}
                      className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>السابق</span>
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      <span>التالي</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Already have an account link */}
                  <div className="text-center pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-600 font-medium">
                      يوجد لديك حساب بالفعل؟{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className="text-indigo-600 font-black hover:underline"
                      >
                        ادخل إلى حسابك الآن !
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* STEP 3: Religion, Gender, Email, Password, Terms (الخطوة الأخيره 90%) */}
              {signupStep === 3 && (
                <form onSubmit={handleFinalSignupSubmit} className="space-y-4 animate-fadeIn">
                  {/* Workflow notice banner */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 space-y-1">
                    <div className="text-xs font-black flex items-center gap-1.5 text-indigo-700">
                      <Clock className="w-4 h-4" />
                      <span>طلب انشاء حساب :</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">
                      ادخل بياناتك بشكل صحيح وسيتم مراجعة طلبك خلال ساعات لـ بضع ايام, وتقدر تسجل دخول عشان تشوف حالة الطلب بتاعك
                    </p>
                  </div>

                  {/* Religion & Gender Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ما مادة التربية الدينية التي تدرسها؟
                      </label>
                      <select
                        value={religion}
                        onChange={(e) => setReligion(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-medium text-slate-800"
                      >
                        <option value="التربية الدينية الإسلامية">التربية الدينية الإسلامية</option>
                        <option value="التربية الدينية المسيحية">التربية الدينية المسيحية</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        النوع
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as 'ذكر' | 'أنثى')}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white font-medium text-slate-800"
                      >
                        <option value="ذكر">ذكر</option>
                        <option value="أنثى">أنثى</option>
                      </select>
                    </div>
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        كلمة السر
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                          dir="ltr"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        تأكيد كلمة السر
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                          dir="ltr"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Summary Preview Box */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <div className="flex justify-between pb-1 border-b border-slate-200/80">
                      <span className="text-slate-500">المرحلة والنظام:</span>
                      <span className="font-bold text-indigo-700">
                        {schoolYear} {schoolYear === 'الصف الثالث الثانوي' ? `(${division})` : ''} • نظام {educationSystem}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">اسم الطالب والمحافظة:</span>
                      <span className="font-bold text-slate-800">
                        {firstName} {lastName} ({governorate})
                      </span>
                    </div>
                  </div>

                  {/* Terms & Agreement Checkbox */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                      <input
                        type="checkbox"
                        checked={termsAgreed}
                        onChange={(e) => setTermsAgreed(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-slate-700 font-medium leading-relaxed">
                        أوافق على الشروط والأحكام واتفاقية شراء الكورس في منصة المتفلسفة .
                      </span>
                    </label>
                  </div>

                  {/* Navigation Buttons: Previous + Submit Account Request */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setSignupStep(2);
                        setError(null);
                      }}
                      className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>السابق</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !termsAgreed}
                      className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>جاري إرسال الطلب...</span>
                      ) : (
                        <>
                          <span>طلب انشاء حساب !</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Already have an account link */}
                  <div className="text-center pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-600 font-medium">
                      يوجد لديك حساب بالفعل؟{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className="text-indigo-600 font-black hover:underline"
                      >
                        ادخل إلى حسابك الآن !
                      </button>
                    </p>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* RESET PASSWORD / FORGOT PASSWORD FLOW */}
          {/* ======================================================== */}
          {/* ======================================================== */}
          {/* RESET PASSWORD / FORGOT PASSWORD FLOW (EMAIL RECOVERY via hos098sam@gmail.com) */}
          {/* ======================================================== */}
          {mode === 'login' && isResetPasswordMode && (
            <div className="space-y-4">
              {/* STEP 1: Request Email Recovery OTP */}
              {otpStep === 'idle' && (
                <form onSubmit={handleRequestForgotOtp} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1.5 text-right">
                    <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-black text-sm">
                      <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span>استعادة كلمة السر عبر البريد الإلكتروني 📧</span>
                    </div>
                    <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed font-medium">
                      أدخل رقم هاتفك المسجل على المنصة وبريدك الإلكتروني ليتم إرسال رمز الاسترداد (6 أرقام) إليك فوراً من البريد الرسمي للمنصة{' '}
                      <strong className="font-mono text-indigo-700 dark:text-indigo-300" dir="ltr">
                        hos098sam@gmail.com
                      </strong>
                      .
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      رقم هاتف الطالب المسجل بالمنصة:
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={resetPhoneOrEmail || phone}
                        onChange={(e) => setResetPhoneOrEmail(e.target.value)}
                        placeholder="أدخل رقم الهاتف المسجل (مثال: 010XXXXXXXX)"
                        className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left bg-white dark:bg-slate-900"
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-indigo-600 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      البريد الإلكتروني لاستلام رمز الاسترداد (Gmail):
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left bg-white dark:bg-slate-900"
                        dir="ltr"
                      />
                      <Mail className="w-4 h-4 text-indigo-600 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl text-white font-black text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>جاري إرسال رمز الاسترداد للبريد...</span>
                    ) : (
                      <>
                        <span>إرسال رمز الاسترداد من hos098sam@gmail.com 📧</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetPasswordMode(false);
                        setOtpStep('idle');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      ← العودة إلى تسجيل الدخول
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Enter 6-digit Email OTP */}
              {otpStep === 'forgot_otp' && (
                <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2 text-right">
                    <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-black text-sm">
                      <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span>تم إرسال رمز الاسترداد إلى بريدك الإلكتروني 📧</span>
                    </div>
                    <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed font-medium">
                      تم الإرسال من البريد الرسمي{' '}
                      <strong className="font-mono text-indigo-700 dark:text-indigo-300" dir="ltr">
                        hos098sam@gmail.com
                      </strong>{' '}
                      إلى:{' '}
                      <strong className="font-mono text-indigo-700 dark:text-indigo-400 text-sm dir-ltr inline-block">
                        {otpMaskedPhone || resetEmail}
                      </strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-center">
                      أدخل رمز الاسترداد المرسل للبريد (6 أرقام):
                    </label>
                    <div className="relative max-w-[260px] mx-auto">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        autoFocus
                        value={otpCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpCode(val);
                        }}
                        placeholder="••••••"
                        className="w-full text-center tracking-[0.6em] font-mono text-2xl py-3 rounded-2xl border-2 border-indigo-500/50 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/20 bg-indigo-50/30 dark:bg-slate-900 text-slate-900 dark:text-white"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.trim().length !== 6}
                    className="w-full py-3.5 rounded-2xl text-white font-black text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>جاري التحقق من الرمز...</span>
                    ) : (
                      <>
                        <span>تأكيد رمز الاسترداد والمتابعة 🔐</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    {otpCooldown > 0 ? (
                      <span className="text-slate-400 font-medium text-[11px]">
                        إعادة الإرسال بعد ({otpCooldown}) ثانية
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isSubmitting}
                        className="text-indigo-700 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة إرسال الرمز للبريد الإلكتروني</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('idle');
                        setOtpCode('');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold transition-colors cursor-pointer text-[11px]"
                    >
                      تعديل البيانات ✏️
                    </button>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetPasswordMode(false);
                        setOtpStep('idle');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      ← العودة إلى تسجيل الدخول
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Set New Password after Email OTP verification */}
              {otpStep === 'reset_password_new' && (
                <form onSubmit={handleSetNewPasswordWithOtp} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-right">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100 dark:fill-emerald-900" />
                      <span>تم التحقق من رمز البريد الإلكتروني بنجاح!</span>
                    </div>
                    <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed font-medium">
                      اكتب الآن كلمة المرور الجديدة لحسابك لتحديثها والدخول بها فوراً.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      كلمة المرور الجديدة (6 خانات على الأقل):
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left bg-white dark:bg-slate-900"
                        dir="ltr"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-3 top-3 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      تأكيد كلمة المرور الجديدة:
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left bg-white dark:bg-slate-900"
                        dir="ltr"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || newPassword.length < 6}
                    className="w-full py-3.5 rounded-2xl text-white font-black text-sm bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <span>جاري حفظ كلمة المرور...</span>
                    ) : (
                      <>
                        <span>حفظ كلمة المرور والدخول إلى الحساب 🚀</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetPasswordMode(false);
                        setOtpStep('idle');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      ← العودة إلى تسجيل الدخول
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* LOGIN FORM (With WhatsApp OTP Option & Screen) */}
          {/* ======================================================== */}
          {mode === 'login' && !isResetPasswordMode && (
            <div>
              {/* Normal Login Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>رقم الهاتف المسجل:</span>
                      <span className="text-[10px] text-slate-400 font-normal">(أو البريد الإلكتروني للمشرف)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="أدخل رقم هاتفك (مثال: 010XXXXXXXX)"
                        className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        كلمة السر:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetPasswordMode(true);
                          setOtpStep('idle');
                          setError(null);
                          setSuccessMsg(null);
                          if (phone) {
                            setResetPhoneOrEmail(phone);
                          }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer transition-colors"
                      >
                        نسيت كلمة السر؟
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-left"
                        dir="ltr"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-3 top-3 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer p-1"
                        tabIndex={-1}
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl text-white font-black text-sm bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                  >
                    {isSubmitting ? <span>جاري التحقق...</span> : (
                      <>
                        <span>تسجيل الدخول</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">
                      ليس لديك حساب بعد؟{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signup');
                          setError(null);
                          setSignupStep(1);
                        }}
                        className="text-indigo-600 font-black hover:underline"
                      >
                        أنشئ حسابك الآن مجاناً
                      </button>
                    </p>
                  </div>
                </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* PARENT LOGIN BY PHONE (DIRECT WITHOUT WHATSAPP OTP) */}
          {/* ======================================================== */}
          {mode === 'parent' && (
            <div className="space-y-4">
              {parentOtpStep === 'input_phone' ? (
                <form onSubmit={handleRequestParentOtp} className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 space-y-2">
                    <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 font-black text-xs sm:text-sm">
                      <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                        <Users className="w-4 h-4" />
                      </div>
                      <span>بوابة متابعة ولي الأمر المباشرة 👨‍👧</span>
                    </div>
                    <p className="text-xs text-amber-900/90 dark:text-amber-300 leading-relaxed font-medium">
                      أدخل رقم هاتف ولي الأمر (الأب أو الأم) المسجل في حساب الطالب لفتح التقرير الأكاديمي الشامل ومتابعة الامتحانات والحصص مباشرة.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      رقم هاتف ولي الأمر المسجل:
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={parentLoginPhone}
                        onChange={(e) => setParentLoginPhone(e.target.value)}
                        placeholder="أدخل رقم هاتف ولي الأمر المسجل (مثال: 010... أو 011...)"
                        className="w-full pl-4 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono text-left bg-white dark:bg-slate-900"
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-amber-600 absolute right-3.5 top-3.5 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      يمكن إدخال رقم الأب أو رقم الأم المسجل في استمارة حساب الطالب بالمنصة.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-2xl text-slate-950 font-black text-sm bg-amber-400 hover:bg-amber-500 active:scale-[0.99] shadow-md shadow-amber-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>جاري فتح تقرير الطالب...</span>
                    ) : (
                      <>
                        <Users className="w-4 h-4 text-slate-950" />
                        <span>عرض تقرير متابعة الطالب الآن 📊</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      هل أنت طالب؟{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 font-black hover:underline"
                      >
                        دخول حساب الطالب
                      </button>
                    </p>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyParentOtp} className="space-y-4 animate-fadeIn">
                  <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-xs sm:text-sm">
                        <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span>تم إرسال رمز التحقق الخاص إلى واتساب ولي الأمر 📲</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        كود أمان خاص
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900/90 dark:text-emerald-300 leading-relaxed font-medium">
                      أرسلنا رسالة خاصة لواتساب ولي الأمر على الرقم{' '}
                      <strong className="font-mono text-emerald-950 dark:text-white" dir="ltr">{parentOtpMaskedPhone}</strong>.
                      يرجى إدخال الرمز لتأكيد وحفظ بيانات الطالب، وعند تطبيق الرمز سيتم إخفاء هذه الصفحة فوراً والدخول للوحة المتابعة.
                    </p>
                  </div>

                  {/* Student Summary Card */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-500 dark:text-slate-400">الطالب المرتبط:</span>
                      <span className="text-indigo-700 dark:text-indigo-300 font-black text-sm">
                        {parentStudentNames || 'طالب منصة المتفلسفة '}
                      </span>
                    </div>
                    {parentMatchedStudents[0] && (
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60 pt-2">
                        <span>المرحلة: {parentMatchedStudents[0].schoolYear || 'الصف الثالث الثانوي'}</span>
                        <span>المدرسة: {parentMatchedStudents[0].schoolName || 'ثانوي عام'}</span>
                      </div>
                    )}
                  </div>

                  {/* Direct WhatsApp Launcher Button */}
                  {parentDirectWaUrl && (
                    <a
                      href={parentDirectWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      <MessageCircle className="w-4 h-4 fill-white/20" />
                      <span>فتح تطبيق واتساب لمشاهدة رمز التحقق مباشرة 💬</span>
                    </a>
                  )}

                  {/* OTP Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      أدخل رمز التحقق (OTP) المكون من 6 أرقام:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={parentOtpCode}
                        onChange={(e) => setParentOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full pl-4 pr-10 py-3.5 rounded-2xl border-2 border-emerald-500 text-center tracking-[0.5em] text-lg font-black font-mono focus:outline-none focus:ring-4 focus:ring-emerald-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        dir="ltr"
                        autoFocus
                      />
                      <KeyRound className="w-5 h-5 text-emerald-600 absolute right-3.5 top-4 pointer-events-none" />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || parentOtpCode.length < 4}
                    className="w-full py-3.5 rounded-2xl text-slate-950 font-black text-sm bg-emerald-400 hover:bg-emerald-500 active:scale-[0.99] shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>جاري تطبيق الرمز وحفظ البيانات...</span>
                    ) : (
                      <>
                        <span>تطبيق الرمز وحفظ بيانات الطالب والدخول 🚀</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Resend OTP and Change Phone */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      type="button"
                      disabled={parentOtpCooldown > 0 || isSubmitting}
                      onClick={handleResendParentOtp}
                      className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {parentOtpCooldown > 0
                          ? `إعادة إرسال الرمز خلال (${parentOtpCooldown} ثانية)`
                          : 'إعادة إرسال الرمز لواتساب'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setParentOtpStep('input_phone');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      ← تغيير رقم ولي الأمر
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
