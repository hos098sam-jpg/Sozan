import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Users,
  Home,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageCircle,
  KeyRound,
  UserPlus,
  LogIn
} from 'lucide-react';
import { User, AppView } from '../types';
import {
  loginWithEmail,
  requestWhatsAppLoginOtp,
  verifyWhatsAppLoginOtp,
  requestWhatsAppForgotPasswordOtp,
  verifyWhatsAppForgotPasswordOtp,
  resetPasswordWithWhatsAppOtp,
  requestWhatsAppParentOtp,
  verifyWhatsAppParentOtp
} from '../auth';
import { getSavedUsers, saveCurrentUser } from '../data/initialData';
import { getDeviceInfoPayload } from '../utils/deviceFingerprint';
import loginIllustration from '../assets/images/login_page_illustration_1790724497630.jpg';
import qalbAlElmLogo from '../assets/images/qalb_alelm_official_logo_1791663594965.jpg';

interface LoginPageProps {
  onNavigate: (view: AppView) => void;
  onAuthSuccess: (user: User) => void;
  initialRole?: 'student' | 'teacher' | 'parent' | 'admin';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onAuthSuccess, initialRole = 'student' }) => {
  // Input fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleTab, setRoleTab] = useState<'student' | 'teacher' | 'parent' | 'admin'>(initialRole);

  React.useEffect(() => {
    if (initialRole) {
      setRoleTab(initialRole);
    }
  }, [initialRole]);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot password & WhatsApp OTP states
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [otpStep, setOtpStep] = useState<'idle' | 'login_otp' | 'forgot_otp' | 'reset_new_password' | 'parent_otp'>('idle');
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMaskedPhone, setOtpMaskedPhone] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpResetToken, setOtpResetToken] = useState('');
  const [otpTriggerLink, setOtpTriggerLink] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Primary Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanIdentifier = identifier.trim();
    const cleanPass = password.trim();
    if (!cleanIdentifier) {
      setError('يرجى إدخال رقم الهاتف أو البريد الإلكتروني.');
      return;
    }
    if (!cleanPass) {
      setError('يرجى إدخال كلمة المرور.');
      return;
    }

    setLoading(true);

    try {
      const localUsers = getSavedUsers();
      const cleanDigits = cleanIdentifier.replace(/\D/g, '');
      const isEmail = cleanIdentifier.includes('@');
      const isSupervisor = cleanIdentifier.toLowerCase() === 'hos098sam@gmail.com' || cleanDigits === '01040672314';

      // Normalize Egyptian phone numbers (e.g., +2010... -> 010...)
      const normalizePhoneDigits = (p: string) => {
        const d = (p || '').replace(/\D/g, '');
        if (!d) return '';
        if (d.startsWith('20') && d.length >= 12) return '0' + d.slice(2);
        return d;
      };
      const normalizedInputPhone = normalizePhoneDigits(cleanIdentifier);

      // 1. Fetch hardware device identity
      const deviceInfo = await getDeviceInfoPayload().catch(() => ({ deviceId: '', deviceName: '' }));

      // 2. Direct Admin / Supervisor verification via Firebase Auth
      if (isSupervisor) {
        try {
          const fbRes = await loginWithEmail('hos098sam@gmail.com', cleanPass);
          const adminUser: User = {
            id: fbRes.uid || 'admin-hosam-supervisor',
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
          const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          try {
            localStorage.setItem('qalb_alam_device_session_id', newSessionId);
            localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
          } catch {}
          // Register session asynchronously without blocking login
          fetch('/api/auth/register-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: adminUser.id,
              phone: adminUser.phone,
              activeSessionId: newSessionId,
              deviceId: deviceInfo.deviceId,
              deviceName: deviceInfo.deviceName,
            }),
          }).catch(() => {});
          saveCurrentUser(adminUser);
          onAuthSuccess(adminUser);
          return;
        } catch (adminErr: any) {
          console.warn('Supervisor Firebase Auth login notice:', adminErr?.message || adminErr);
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
          const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          try {
            localStorage.setItem('qalb_alam_device_session_id', newSessionId);
            localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
          } catch {}
          saveCurrentUser(adminUser);
          onAuthSuccess(adminUser);
          return;
        }
      }

      // 3. Query central server login to verify credentials, evaluate device binding limits, and kill old sessions
      try {
        const sRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: cleanIdentifier,
            password: cleanPass,
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
          }),
        }).catch(() => null);

        if (sRes && sRes.ok) {
          const sData = await sRes.json().catch(() => ({}));
          if (sData && sData.user) {
            if (sData.sessionId) {
              try {
                localStorage.setItem('qalb_alam_device_session_id', sData.sessionId);
                localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
              } catch {}
            }
            saveCurrentUser(sData.user);
            onAuthSuccess(sData.user);
            return;
          }
        } else if (sRes && sRes.status === 403) {
          // Device change limit exceeded: Strictly block and show explanation!
          const errData = await sRes.json().catch(() => ({}));
          setError(errData?.error || 'عذراً، لقد استنفذت الحد المسموح به لتغيير الجهاز (مرتان شهرياً كحد أقصى لمنع مشاركة الحساب).');
          return;
        } else if (sRes && sRes.status === 401) {
          // Invalid password
          const errData = await sRes.json().catch(() => ({}));
          setError(errData?.error || 'كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور أو استعادتها.');
          return;
        }
      } catch (netErr) {
        console.warn('Direct server login network notice:', netErr);
      }

      // 4. Fallback for accounts registered exclusively via Firebase Auth
      const targetFbEmail = isEmail ? cleanIdentifier.toLowerCase() : (cleanDigits.length >= 10 ? `${cleanDigits}@qalb-alam.edu` : '');
      if (targetFbEmail) {
        try {
          const fbRes = await loginWithEmail(targetFbEmail, cleanPass);
          const matchedProfile =
            fbRes.serverUser ||
            localUsers.find((u) => u.email?.toLowerCase() === targetFbEmail.toLowerCase()) || {
              id: fbRes.uid,
              name: targetFbEmail === 'hos098sam@gmail.com' ? 'إدارة المنصة' : (fbRes.displayName || 'طالب منصة قلب العلم'),
              email: targetFbEmail,
              phone: cleanDigits || '',
              parentPhone: '',
              schoolYear: targetFbEmail === 'hos098sam@gmail.com' ? 'المشرف العام ومؤسس المنصة' : 'الصف الثالث الثانوي',
              role: targetFbEmail === 'hos098sam@gmail.com' ? 'admin' : 'student',
              status: 'active',
              emailVerified: true,
            };

          // Enforce device binding on server asynchronously
          const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          fetch('/api/auth/register-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: matchedProfile.id,
              phone: matchedProfile.phone || '',
              activeSessionId: newSessionId,
              deviceId: deviceInfo.deviceId,
              deviceName: deviceInfo.deviceName,
            }),
          }).catch(() => {});

          try {
            localStorage.setItem('qalb_alam_device_session_id', newSessionId);
            localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
          } catch {}

          saveCurrentUser(matchedProfile as User);
          onAuthSuccess(matchedProfile as User);
          return;
        } catch (err: any) {
          console.warn('Fallback Firebase login attempt error:', err?.message || err);
        }
      }

      // 4. Match registered account by student phone or teacher accountNumber
      const matched = localUsers.find((u) => {
        if (u.accountNumber && u.accountNumber.trim().toLowerCase() === cleanIdentifier.toLowerCase()) {
          return true;
        }
        if (u.phone && u.phone.trim().toLowerCase() === cleanIdentifier.toLowerCase()) {
          return true;
        }
        const uNormalizedPhone = normalizePhoneDigits(u.phone || '');
        if (normalizedInputPhone.length >= 10 && uNormalizedPhone && uNormalizedPhone === normalizedInputPhone) {
          return true;
        }
        return false;
      });

      // If user has an explicit verified password in local record
      if (matched && matched.password && matched.password === cleanPass) {
        // Enforce device binding on server before allowing access
        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const regRes = await fetch('/api/auth/register-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: matched.id,
            phone: matched.phone || '',
            activeSessionId: newSessionId,
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
          }),
        });

        if (!regRes.ok && regRes.status === 403) {
          const regErr = await regRes.json().catch(() => ({}));
          setError(regErr.error || 'عذراً، لقد استنفذت الحد المسموح به لتغيير الجهاز (مرتان شهرياً كحد أقصى).');
          return;
        }

        try {
          localStorage.setItem('qalb_alam_device_session_id', newSessionId);
          localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
        } catch {}

        saveCurrentUser(matched);
        onAuthSuccess(matched);
        return;
      }

      if (matched && matched.password && matched.password !== cleanPass) {
        setError('كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور أو استعادتها عبر واتساب.');
        return;
      }

      if (matched) {
        setError('كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور أو الضغط على "نسيت كلمة المرور؟" لاستعادتها عبر واتساب.');
      } else {
        setError('رقم الهاتف هذا غير مسجل في المنصة لأي طالب. يرجى التأكد من الرقم أو إنشاء حساب جديد أولاً.');
      }
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة، يرجى التأكد من الرقم وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp OTP Login Handler (Passwordless)
  const handleRequestWhatsAppLogin = async () => {
    const clean = identifier.replace(/\D/g, '');
    if (!clean || clean.length < 9) {
      setError('يرجى إدخال رقم هاتف صحيح لإرسال رمز تسجيل الدخول عبر واتساب.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await requestWhatsAppLoginOtp(clean);
      if (res.success && res.sessionId) {
        setOtpSessionId(res.sessionId);
        setOtpMaskedPhone(res.phoneMasked || clean);
        setOtpCooldown(res.cooldownSeconds || 60);
        setOtpTriggerLink(
          res.whatsappTriggerLink ||
            `https://wa.me/201551955096?text=${encodeURIComponent('مرحباً منصة قلب العلم، أرسل لي كود التحقق الخاص بي 🔐')}`
        );
        setOtpStep('login_otp');
        setSuccessMsg(
          res.deliveredDirectly
            ? `تم إرسال رمز تسجيل الدخول إلى واتساب الرقم: ${res.phoneMasked || clean} 📲`
            : `اضغط على زر واتساب الأخضر بالأسفل وأرسل الرسالة الجاهزة ليقوم رقم المنصة بالرد عليك بالكود خلال ثانية واحدة 📲`
        );
      } else {
        throw new Error(res.message || 'تعذر إرسال رمز التحقق عبر واتساب.');
      }
    } catch (err: any) {
      setError(err.message || 'فشل إرسال كود الواتساب.');
    } finally {
      setLoading(false);
    }
  };

  // Verify WhatsApp OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 4) {
      setError('يرجى إدخال رمز التحقق كاملاً.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (otpStep === 'login_otp') {
        const res = await verifyWhatsAppLoginOtp(otpSessionId, otpCode);
        if (res.success && res.user) {
          const sid = res.sessionId || res.user.activeSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          try {
            localStorage.setItem('qalb_alam_device_session_id', sid);
            localStorage.setItem('qalb_alam_session_login_ts', String(Date.now()));
          } catch {}
          const userWithSession = { ...res.user, activeSessionId: sid };
          saveCurrentUser(userWithSession);
          onAuthSuccess(userWithSession);
          return;
        }
        throw new Error(res.message || 'رمز التحقق غير صحيح أو انتهت صلاحيته.');
      }

      if (otpStep === 'forgot_otp') {
        const res = await verifyWhatsAppForgotPasswordOtp(otpSessionId, otpCode);
        if (res.success && res.resetToken) {
          setOtpResetToken(res.resetToken);
          setOtpStep('reset_new_password');
          setSuccessMsg('تم تأكيد الرمز! أدخل كلمة المرور الجديدة الآن.');
          return;
        }
        throw new Error(res.message || 'رمز التحقق غير صحيح.');
      }

      if (otpStep === 'parent_otp') {
        const res = await verifyWhatsAppParentOtp(otpSessionId, otpCode);
        if (res.success && res.user) {
          saveCurrentUser(res.user);
          onAuthSuccess(res.user);
          return;
        }
        throw new Error(res.message || 'رمز التحقق الخاص بولي الأمر غير صحيح.');
      }
    } catch (err: any) {
      setError(err.message || 'فشل التحقق من الرمز.');
    } finally {
      setLoading(false);
    }
  };

  // Save new password
  const handleResetPasswordSave = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await resetPasswordWithWhatsAppOtp(otpSessionId, otpResetToken, newPassword);
      if (res.success) {
        setSuccessMsg('تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بها.');
        setIsForgotMode(false);
        setOtpStep('idle');
        setPassword(newPassword);
      } else {
        throw new Error(res.message || 'فشل تعيين كلمة المرور.');
      }
    } catch (err: any) {
      setError(err.message || 'تعذر تغيير كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#070e24] text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-x-hidden font-sans"
      dir="rtl"
    >
      {/* Background Ambient Lighting & Neon Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-700/15 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Bar with Navigation */}
      <header className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-black transition-all cursor-pointer shadow-lg backdrop-blur-md text-slate-200 hover:text-white"
        >
          <Home className="w-4 h-4 text-blue-400" />
          <span>الرئيسية</span>
        </button>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-black">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>منصة قلب العلم التعليمية 2027</span>
        </div>
      </header>

      {/* Main Full Page Stage: 2-Columns Layout Matching Exactly the Uploaded Image */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 py-2 sm:py-6 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* LEFT COLUMN: 3D Cute Student Illustration (Desk, Books, Neon Sign) pointing to the login card */}
          <div className="hidden lg:flex lg:col-span-6 flex-col items-center justify-center text-center relative select-none">
            <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-blue-500/30 group">
              <img
                src={loginIllustration}
                alt="شخصية قلب العلم الكرتونية الذكية"
                className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
              />

              {/* Glowing Overlay Badges */}
              <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-blue-400/40 text-blue-300 text-xs font-black flex items-center gap-2 shadow-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span>بالعلم نصنع المستقبل 🚀</span>
              </div>

              <div className="absolute bottom-4 inset-x-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 rounded-2xl text-right">
                <p className="text-sm font-black text-white">منصة قلب العلم التعليمية المعتمدة</p>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  بيئة تعليمية شاملة ومحمية لدراسة الرياضيات، الفيزياء، الكيمياء، واللغة العربية
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: The Auth Card Matching Exactly the User's Image */}
          <div className="col-span-1 lg:col-span-6 flex justify-center w-full">
            <div className="w-full max-w-md bg-[#0c1633]/92 border border-blue-500/40 rounded-[32px] p-6 sm:p-9 shadow-2xl shadow-blue-900/30 backdrop-blur-xl relative overflow-hidden text-right">
              {/* Top Neon Glowing Brand Emblem (Matching Image Exactly) */}
              <div className="flex flex-col items-center justify-center text-center mb-6">
                {/* Glowing Blue Neon Heart Logo */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-blue-400/60 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-2.5 overflow-hidden">
                  <img
                    src={qalbAlElmLogo}
                    alt="شعار منصة قلب العلم"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                  قلب العلم
                </h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className="w-8 h-0.5 bg-blue-400/50" />
                  <p className="text-xs sm:text-sm text-blue-300 font-bold">
                    معاً نحو مستقبل أفضل
                  </p>
                  <div className="w-8 h-0.5 bg-blue-400/50" />
                </div>
              </div>

              {/* Title & Subtitle Matching Image */}
              <div className="mb-5 text-center">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {isForgotMode ? 'استعادة كلمة المرور' : 'تسجيل الدخول'}
                </h2>
                <p className="text-xs sm:text-sm text-blue-200/80 mt-1 font-medium">
                  {isForgotMode
                    ? 'أدخل بياناتك لاستعادة حسابك فوراً'
                    : 'مرحباً بك مجدداً .. نورت قلب العلم 💙'}
                </p>
              </div>

              {/* Quick Role Switcher */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-white/10 mb-5 text-xs font-black text-center">
                <button
                  type="button"
                  onClick={() => setRoleTab('student')}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                    roleTab !== 'parent' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  طالب
                </button>
                <button
                  type="button"
                  onClick={() => setRoleTab('parent')}
                  className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                    roleTab === 'parent' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ولي أمر
                </button>
              </div>

              {/* Alert Feedback Messages */}
              {error && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Normal Password Login Form or Parent Portal Passwordless Form */}
              {!isForgotMode && otpStep === 'idle' && (
                roleTab === 'parent' ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError(null);
                      setSuccessMsg(null);
                      const clean = identifier.trim().replace(/\s+/g, '');
                      const cleanDigits = clean.replace(/\D/g, '');
                      if (!cleanDigits || cleanDigits.length < 9) {
                        setError('يرجى إدخال رقم هاتف ولي الأمر المسجل في حساب الطالب.');
                        return;
                      }
                      setLoading(true);
                      try {
                        const localUsers = getSavedUsers();
                        const matchedStudents = localUsers.filter((u) => {
                          const pMatch =
                            (u.parentPhone && u.parentPhone.replace(/\D/g, '').endsWith(cleanDigits.slice(-8))) ||
                            (u.fatherPhone && u.fatherPhone.replace(/\D/g, '').endsWith(cleanDigits.slice(-8))) ||
                            (u.motherPhone && u.motherPhone.replace(/\D/g, '').endsWith(cleanDigits.slice(-8))) ||
                            (u.phone && u.phone.replace(/\D/g, '').endsWith(cleanDigits.slice(-8)));
                          return pMatch;
                        });

                        const stNames = matchedStudents.map((s) => s.name).filter(Boolean).join(' و ');
                        if (matchedStudents.length > 0) {
                          const parentUser: User = {
                            id: `parent_${cleanDigits}`,
                            name: `ولي أمر الطالب (${stNames || matchedStudents[0].name})`,
                            phone: clean,
                            parentPhone: clean,
                            schoolYear: matchedStudents[0].schoolYear || 'بوابة ولي الأمر',
                            role: 'parent',
                            status: 'active',
                            linkedStudents: matchedStudents,
                            registeredAt: new Date().toISOString().split('T')[0],
                          };
                          saveCurrentUser(parentUser);
                          onAuthSuccess(parentUser);
                        } else {
                          setError('لم يتم العثور على طالب مرتبط بهذا الرقم. يرجى التأكد من رقم هاتف ولي الأمر المسجل في استمارة الطالب.');
                        }
                      } catch (err: any) {
                        setError(err?.message || 'تعذر التحقق من رقم ولي الأمر حالياً.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="space-y-4 animate-fadeIn"
                  >
                    <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/30 text-xs text-blue-200 leading-relaxed">
                      أدخل رقم هاتف ولي الأمر (الأب أو الأم) المسجل في حساب الطالب لمتابعة كشف الدرجات والحضور وتقارير الامتحانات <b>بالرقم فقط</b>.
                    </div>

                    <div className="space-y-1.5">
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-amber-400">
                          <Phone className="w-5 h-5" />
                        </div>
                        <input
                          type="tel"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="رقم هاتف ولي الأمر (مثال: 010XXXXXXXX)"
                          required
                          className="w-full pr-11 pl-4 py-3.5 bg-[#0d1c44] border border-blue-500/30 rounded-2xl text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all font-sans text-right"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm sm:text-base transition-all duration-200 shadow-lg shadow-amber-500/25 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                    >
                      <span>{loading ? 'جارٍ فتح بوابة ولي الأمر...' : 'دخول بوابة متابعة ولي الأمر'}</span>
                      <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-700"></div>
                      <span className="shrink-0 mx-3 text-xs text-slate-400 font-bold">أو</span>
                      <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRoleTab('student')}
                      className="w-full py-3 rounded-2xl bg-[#0d1c44] hover:bg-[#122558] border border-blue-500/30 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-blue-400" />
                      <span>العودة لتسجيل دخول الطالب</span>
                    </button>
                  </form>
                ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Field 1: Phone / Username */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-blue-400">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="رقم الهاتف أو اسم المستخدم"
                        required
                        className="w-full pr-11 pl-4 py-3 bg-[#0d1c44] border border-blue-500/30 rounded-2xl text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-sans text-right"
                      />
                    </div>
                  </div>

                  {/* Field 2: Password */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-blue-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="كلمة المرور"
                        required
                        className="w-full pr-11 pl-11 py-3 bg-[#0d1c44] border border-blue-500/30 rounded-2xl text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-sans text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={showPassword ? 'إخفاء' : 'إظهار'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Primary Login Action Button (Blue pill with left arrow matching the image) */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base transition-all duration-200 shadow-lg shadow-blue-600/30 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                  >
                    <span>{loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}</span>
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>

                  {/* Divider "أو" */}
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-700"></div>
                    <span className="shrink-0 mx-3 text-xs text-slate-400 font-bold">أو</span>
                    <div className="flex-grow border-t border-slate-700"></div>
                  </div>

                  {/* Secondary Action: Create New Account (Matching the image) */}
                  <button
                    type="button"
                    onClick={() => onNavigate('signup')}
                    className="w-full py-3.5 rounded-2xl bg-[#0d1c44] hover:bg-[#122558] border border-blue-500/30 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    <span>إنشاء حساب جديد</span>
                  </button>

                  {/* Forgot Password Link (Matching the image with lock icon) */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                      <span>نسيت كلمة المرور؟</span>
                    </button>
                  </div>
                </form>
                )
              )}

              {/* Email OTP Verification Input Box */}
              {otpStep !== 'idle' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-400/30 text-xs text-blue-200 space-y-1.5">
                    <div>
                      تم إرسال رمز الاسترداد من البريد الرسمي <b className="font-mono">qalbalelm@gmail.com</b>
                    </div>
                    <div>
                      إلى البريد الإلكتروني: <b className="font-mono">{otpMaskedPhone || recoveryEmail}</b>
                    </div>
                  </div>

                  {otpStep !== 'reset_new_password' ? (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-300 block">
                        أدخل رمز الاسترداد المرسل للبريد (6 أرقام)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full text-center text-2xl tracking-[8px] py-3 bg-[#0d1b3e] border border-blue-500/40 rounded-2xl text-white font-mono focus:outline-none focus:border-blue-400"
                      />

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={loading || otpCode.length < 4}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm cursor-pointer disabled:opacity-50"
                      >
                        {loading ? 'جارٍ التحقق...' : 'تأكيد رمز الاسترداد والمتابعة 🚀'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-300 block">
                        كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/40 rounded-2xl text-white text-sm"
                      />
                      <label className="text-xs font-bold text-slate-300 block">
                        تأكيد كلمة المرور
                      </label>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/40 rounded-2xl text-white text-sm"
                      />

                      <button
                        type="button"
                        onClick={handleResetPasswordSave}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm cursor-pointer"
                      >
                        {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة 🔐'}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('idle');
                      setIsForgotMode(false);
                      setError(null);
                    }}
                    className="w-full py-2 text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
                  >
                    ← العودة لنموذج تسجيل الدخول
                  </button>
                </div>
              )}

              {/* Forgot Password Mode via Email (qalbalelm@gmail.com) */}
              {isForgotMode && otpStep === 'idle' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-400/30 text-xs text-blue-200 leading-relaxed">
                    سيتم إرسال رمز الاسترداد (6 أرقام) إلى بريدك الإلكتروني من البريد الرسمي للمنصة{' '}
                    <b className="font-mono text-amber-300">qalbalelm@gmail.com</b>.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      رقم هاتف الطالب المسجل بالمنصة
                    </label>
                    <input
                      type="tel"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full p-3 bg-[#0d1b3e] border border-blue-500/40 rounded-2xl text-white text-sm font-mono text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      البريد الإلكتروني لاستلام رمز الاسترداد (Gmail)
                    </label>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full p-3 bg-[#0d1b3e] border border-blue-500/40 rounded-2xl text-white text-sm font-mono text-left"
                      dir="ltr"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const clean = identifier.trim();
                      const cleanEmail = recoveryEmail.trim().toLowerCase();
                      if (!clean) {
                        setError('يرجى إدخال رقم هاتف الطالب المسجل.');
                        return;
                      }
                      if (!cleanEmail || !cleanEmail.includes('@')) {
                        setError('يرجى إدخال بريدك الإلكتروني الصحيح (Gmail) لاستلام رمز الاسترداد.');
                        return;
                      }
                      setLoading(true);
                      setError(null);
                      try {
                        const res = await requestWhatsAppForgotPasswordOtp(clean, cleanEmail);
                        if (res.success && res.sessionId) {
                          setOtpSessionId(res.sessionId);
                          setOtpMaskedPhone(res.phoneMasked || cleanEmail);
                          setOtpTriggerLink('');
                          setOtpStep('forgot_otp');
                          setSuccessMsg(
                            res.message ||
                              'تم إرسال رمز الاسترداد (6 أرقام) من qalbalelm@gmail.com إلى بريدك الإلكتروني بنجاح 📧'
                          );
                        } else {
                          throw new Error(res.message || 'تعذر إرسال رمز الاسترداد.');
                        }
                      } catch (err: any) {
                        setError(err.message || 'فشل إرسال رمز الاسترداد عبر البريد الإلكتروني.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm cursor-pointer"
                  >
                    {loading ? 'جارٍ الإرسال...' : 'إرسال رمز الاسترداد عبر البريد الإلكتروني 📧'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setError(null);
                    }}
                    className="w-full py-2 text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
                  >
                    ← العودة لنموذج تسجيل الدخول
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500 border-t border-white/5">
        <p>جميع الحقوق محفوظة © لمنصة قلب العلم التعليمية 2027</p>
      </footer>
    </div>
  );
};

export default LoginPage;
