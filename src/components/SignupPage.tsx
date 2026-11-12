import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  GraduationCap,
  Home,
  AlertCircle,
  CheckCircle2,
  Phone,
  School,
  IdCard,
  MapPin,
  Check,
  RotateCcw
} from 'lucide-react';
import { User, AppView } from '../types';
import { signupWithEmail } from '../auth';
import { getSavedUsers, saveUsers, saveCurrentUser } from '../data/initialData';
import registerIllustration from '../assets/images/register_page_illustration_1790724483777.jpg';
import qalbAlElmLogo from '../assets/images/logo_1791663594965.jpg';

interface SignupPageProps {
  onNavigate: (view: AppView) => void;
  onAuthSuccess: (user: User) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigate, onAuthSuccess }) => {
  // Step State: 1 (30%), 2 (60%), 3 (100%)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Personal Info
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [thirdName, setThirdName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolYear, setSchoolYear] = useState('الصف الثالث الثانوي');
  const [division, setDivision] = useState('علمي علوم');

  // Step 2: Parent & School Info
  const [fatherPhone, setFatherPhone] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [governorate, setGovernorate] = useState('السويس');
  const [educationSystem, setEducationSystem] = useState('عربي');

  // Step 3: Credentials & Final Info
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('ذكر');
  const [religion, setReligion] = useState('التربية الدينية الإسلامية');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);

  // Feedback & Loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Full name combined
  const fullName = `${firstName.trim()} ${secondName.trim()} ${thirdName.trim()} ${lastName.trim()}`.trim();

  // Validate Step 1
  const handleNextStep1 = () => {
    setError(null);
    if (!firstName.trim() || !secondName.trim() || !thirdName.trim() || !lastName.trim()) {
      setError('يرجى إدخال الاسم الرباعي بالكامل لضمان توثيق الحساب والشهادات.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('يرجى إدخال رقم هاتف الطالب الصحيح (11 رقم).');
      return;
    }
    setStep(2);
  };

  // Validate Step 2
  const handleNextStep2 = () => {
    setError(null);
    const cleanFather = fatherPhone.replace(/\D/g, '');
    const cleanMother = motherPhone.replace(/\D/g, '');
    if (!cleanFather && !cleanMother) {
      setError('يرجى إدخال رقم هاتف ولي الأمر (الأب أو الأم) لمتابعة المستوى والتقارير.');
      return;
    }
    setStep(3);
  };

  // Submit Final Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!termsAgreed) {
      setError('يرجى الموافقة على شروط الاستخدام وسياسة المنصة للمتابعة.');
      return;
    }

    if (!password || password.length < 6) {
      setError('كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام.');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const targetEmail = email.trim() || `${cleanPhone}@qalbalelm.edu`;

      const isPrimaryOrPrep = schoolYear.includes('الابتدائي') || schoolYear.includes('الإعدادي');
      const effectiveDivision = isPrimaryOrPrep ? undefined : division;

      // 1. Create in Firebase Auth or local store
      let newUser: User;
      try {
        const res = await signupWithEmail(targetEmail, password, {
          name: fullName,
          firstName: firstName.trim(),
          secondName: secondName.trim(),
          thirdName: thirdName.trim(),
          lastName: lastName.trim(),
          role: 'student',
          phone: cleanPhone,
          parentPhone: fatherPhone.trim() || motherPhone.trim(),
          fatherPhone: fatherPhone.trim(),
          motherPhone: motherPhone.trim(),
          schoolYear,
          division: effectiveDivision,
          schoolName: schoolName.trim(),
          governorate,
          educationSystem,
          gender,
          religion,
          status: 'active',
        });
        newUser = res.profile;
      } catch (authErr: any) {
        // Fallback local create if network or offline
        console.warn('Firebase signup notice:', authErr);
        newUser = {
          id: `student_${Date.now()}`,
          name: fullName,
          firstName: firstName.trim(),
          secondName: secondName.trim(),
          thirdName: thirdName.trim(),
          lastName: lastName.trim(),
          phone: cleanPhone,
          parentPhone: fatherPhone.trim() || motherPhone.trim(),
          fatherPhone: fatherPhone.trim(),
          motherPhone: motherPhone.trim(),
          email: targetEmail,
          password: password,
          schoolYear,
          division: effectiveDivision,
          schoolName: schoolName.trim(),
          governorate,
          educationSystem,
          gender,
          religion,
          role: 'student',
          status: 'active',
          registeredAt: new Date().toISOString().split('T')[0],
          enrolledCourseIds: [],
        };
      }

      // Save to local list
      const prevUsers = getSavedUsers();
      const updatedList = [newUser, ...prevUsers.filter((u) => u.id !== newUser.id)];
      saveUsers(updatedList);
      saveCurrentUser(newUser);

      setSuccessMsg('🎉 تم إنشاء حسابك بنجاح! يتم الآن توجيهك للمنصة...');
      setTimeout(() => {
        onAuthSuccess(newUser);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#060b1e] text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-x-hidden"
      dir="rtl"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-indigo-700/15 rounded-full blur-[160px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-8 py-5 flex items-center justify-between">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-black transition-all cursor-pointer shadow-lg backdrop-blur-md text-slate-200 hover:text-white"
        >
          <Home className="w-4 h-4 text-blue-400" />
          <span>الرئيسية</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('login')}
            className="text-xs sm:text-sm font-bold text-blue-300 hover:text-white transition-colors cursor-pointer"
          >
            لديك حساب بالفعل؟ <b>تسجيل الدخول</b>
          </button>
        </div>
      </header>

      {/* Main Full Page Stage: 2-Columns Layout with Generated Artwork */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 py-4 sm:py-8 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* LEFT COLUMN: 3D Cute Student Illustration at Desk with glowing Emblem */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-center justify-center text-center relative select-none">
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-blue-500/30 group">
              <img
                src={registerIllustration}
                alt="إنشاء حساب جديد - منصة المتفلسفة "
                className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-blue-400/40 text-blue-300 text-xs font-black flex items-center gap-2 shadow-xl">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>انضم لأسرة المتفلسفة  🌟</span>
              </div>

              <div className="absolute bottom-4 inset-x-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 rounded-2xl text-right">
                <p className="text-sm font-black text-white">رحلة التفوق تبدأ من هنا</p>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  امتحانات تفاعلية، فيديوهات عالية الجودة، ومتابعة دقيقة لكل درس
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Multi-Step Registration Form */}
          <div className="col-span-1 lg:col-span-7 flex justify-center w-full">
            <div className="w-full max-w-xl bg-[#0b132b]/95 border border-blue-500/40 rounded-[32px] p-6 sm:p-9 shadow-2xl shadow-blue-900/30 backdrop-blur-xl relative overflow-hidden text-right">
              {/* Top Neon Title */}
              <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white border border-blue-400/50 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                    <img
                      src={qalbAlElmLogo}
                      alt="شعار منصة المتفلسفة "
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">إنشاء حساب طالب جديد</h2>
                    <p className="text-xs text-blue-300 font-medium">منصة المتفلسفة  التعليمية 2027</p>
                  </div>
                </div>

                {/* Step percentage badge */}
                <div className="px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-black">
                  {step === 1 ? 'المرحلة 1 من 3 (30%)' : step === 2 ? 'المرحلة 2 من 3 (60%)' : 'المرحلة الأخيرة (100%)'}
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 bg-slate-800 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400 transition-all duration-300"
                  style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
                />
              </div>

              {/* Error & Success Messages */}
              {error && (
                <div className="mb-5 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      الاسم الرباعي للطالب بالكامل (باللغة العربية) *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="الاسم الأول"
                        className="p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs placeholder:text-slate-500 text-right focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={secondName}
                        onChange={(e) => setSecondName(e.target.value)}
                        placeholder="اسم الأب"
                        className="p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs placeholder:text-slate-500 text-right focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={thirdName}
                        onChange={(e) => setThirdName(e.target.value)}
                        placeholder="اسم الجد"
                        className="p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs placeholder:text-slate-500 text-right focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="اللقب / العائلة"
                        className="p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs placeholder:text-slate-500 text-right focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      رقم هاتف الطالب (واتساب للتنبيهات والدرجات) *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute top-3.5 right-3.5 text-blue-400 pointer-events-none" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full pr-10 pl-4 py-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-sm text-right focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={`space-y-1 ${(schoolYear.includes('الابتدائي') || schoolYear.includes('الإعدادي')) ? 'sm:col-span-2' : ''}`}>
                      <label className="text-xs font-bold text-slate-300 block">
                        السنة الدراسية
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
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                      >
                        
                        
                        <optgroup label="المرحلة الثانوية">
                          <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                          <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                          <option value="الصف الثالث الثانوي">الصف الثالث الثانوي (دفعة 2027)</option>
                        </optgroup>
                      </select>
                    </div>

                    {!(schoolYear.includes('الابتدائي') || schoolYear.includes('الإعدادي')) && (
                      <div className="space-y-1 animate-fadeIn">
                        <label className="text-xs font-bold text-slate-300 block">
                          {schoolYear === 'الصف الثالث الثانوي' ? 'الشعبة الدراسية (تالتة ثانوي)' : 'الشعبة (المرحلة الثانوية)'}
                        </label>
                        {schoolYear === 'الصف الثالث الثانوي' ? (
                          <select
                            value={division}
                            onChange={(e) => setDivision(e.target.value)}
                            className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                          >
                            <optgroup label="شعب الصف الثالث الثانوي">
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
                        ) : (
                          <select
                            value={division}
                            onChange={(e) => setDivision(e.target.value)}
                            className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                          >
                            <option value="بكالوريا">بكالوريا</option>
                            <option value="عام">عام</option>
                            <option value="أزهر">أزهر</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleNextStep1}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-blue-600/20"
                    >
                      <span>متابعة لبيانات ولي الأمر والمدرسة ➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Parent & School Info */}
              {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        رقم هاتف الأب (واتساب) *
                      </label>
                      <input
                        type="tel"
                        value={fatherPhone}
                        onChange={(e) => setFatherPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-sm text-right focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        رقم هاتف الأم (إضافي)
                      </label>
                      <input
                        type="tel"
                        value={motherPhone}
                        onChange={(e) => setMotherPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-sm text-right focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        المحافظة
                      </label>
                      <select
                        value={governorate}
                        onChange={(e) => setGovernorate(e.target.value)}
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                      >
                        <option value="السويس">السويس</option>
                        <option value="القاهرة">القاهرة</option>
                        <option value="الجيزة">الجيزة</option>
                        <option value="الإسكندرية">الإسكندرية</option>
                        <option value="الإسماعيلية">الإسماعيلية</option>
                        <option value="بورسعيد">بورسعيد</option>
                        <option value="الشرقية">الشرقية</option>
                        <option value="الدقهلية">الدقهلية</option>
                        <option value="المنوفية">المنوفية</option>
                        <option value="الغربية">الغربية</option>
                        <option value="كفر الشيخ">كفر الشيخ</option>
                        <option value="البحيرة">البحيرة</option>
                        <option value="دمياط">دمياط</option>
                        <option value="بني سويف">بني سويف</option>
                        <option value="الفيوم">الفيوم</option>
                        <option value="المنيا">المنيا</option>
                        <option value="أسيوط">أسيوط</option>
                        <option value="سوهاج">سوهاج</option>
                        <option value="قنا">قنا</option>
                        <option value="الأقصر">الأقصر</option>
                        <option value="أسوان">أسوان</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        نظام التعليم
                      </label>
                      <select
                        value={educationSystem}
                        onChange={(e) => setEducationSystem(e.target.value)}
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                      >
                        <option value="عربي">عام / عربي</option>
                        <option value="لغات تجريبي">لغات تجريبي</option>
                        <option value="لغات خاص">لغات خاص</option>
                        <option value="أزهر">أزهر شريف</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      اسم المدرسة المقيد بها الطالب
                    </label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="مثال: مدرسة السويس الثانوية العسكرية بنين"
                      className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      ← الرجوع
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep2}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
                    >
                      <span>متابعة لكلمة المرور والأمان ➔</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Credentials & Final Info */}
              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        النوع (الجنس)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setGender('ذكر')}
                          className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            gender === 'ذكر'
                              ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                              : 'bg-[#0d1b3e] border-blue-500/30 text-slate-400'
                          }`}
                        >
                          طالب (بنين)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender('أنثى')}
                          className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            gender === 'أنثى'
                              ? 'bg-rose-600 border-rose-400 text-white shadow-md'
                              : 'bg-[#0d1b3e] border-blue-500/30 text-slate-400'
                          }`}
                        >
                          طالبة (بنات)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        البريد الإلكتروني (اختياري)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-xs text-right focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        كلمة المرور *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-sm text-right focus:outline-none focus:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-300 block">
                        تأكيد كلمة المرور *
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full p-3 bg-[#0d1b3e] border border-blue-500/30 rounded-xl text-white text-sm text-right focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="w-4 h-4 rounded border-blue-500/50 bg-[#0d1b3e] accent-blue-600"
                    />
                    <span>
                      أوافق على <b>شروط الاستخدام</b> وسياسة حماية المحتوى والامتحانات بمنصة المتفلسفة .
                    </span>
                  </label>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      ← الرجوع
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50"
                    >
                      <span>{loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والبدء الآن 🚀'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Already have account footer link */}
              <div className="text-center pt-4 mt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="text-xs text-blue-300 hover:text-white transition-colors font-bold cursor-pointer"
                >
                  لديك حساب مسجل بالفعل؟ <b>تسجيل الدخول هنا ➔</b>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500 border-t border-white/5">
        <p>جميع الحقوق محفوظة © لمنصة المتفلسفة  التعليمية 2027</p>
      </footer>
    </div>
  );
};

export default SignupPage;
