import React, { useEffect, useState } from 'react';
import { 
  Smartphone, 
  Download, 
  CheckCircle2, 
  X, 
  ShieldCheck,
  Zap,
  Sparkles
} from 'lucide-react';
const qalbAlElmLogo = '/logo.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const handleDirectInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a094c] via-[#31107a] to-indigo-800 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 left-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center border border-white/20 shrink-0 shadow-md">
              <img src={qalbAlElmLogo} alt="شعار منصة المتفلسفة  التعليمية" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900">
                تطبيق الهاتف والكمبيوتر (PWA)
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-1">
                تثبيت تطبيق منصة المتفلسفة  على هاتفك أو جهازك
              </h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Official App Splash Screen Preview */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="relative w-full max-w-[260px] rounded-[28px] overflow-hidden border-4 border-indigo-900/80 shadow-2xl bg-[#0b0726]">
                <img
                  src="/hero-banner-qalbalelm.jpg"
                  alt="أهلاً في المتفلسفة  - شاشة تشغيل التطبيق"
                  className="w-full h-auto block object-cover"
                />
              </div>
              <span className="mt-2.5 text-[11px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>واجهة تشغيل التطبيق الرسمية على الهاتف</span>
              </span>
            </div>

            {/* Instructions & Direct Install */}
            <div className="md:col-span-7 space-y-4">
              {deferredPrompt && !isInstalled && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg space-y-3">
                  <div className="font-black text-sm sm:text-base flex items-center gap-2">
                    <Download className="w-5 h-5 text-amber-300 animate-bounce" />
                    <span>تثبيت مباشر بضغطة واحدة على جهازك الآن!</span>
                  </div>
                  <p className="text-xs text-indigo-100 leading-relaxed">
                    اضغط على الزر بالأسفل ليتم تثبيت تطبيق <strong>المتفلسفة </strong> مباشرة على شاشتك الرئيسية ويفتح بهذه الواجهة الترحيبية بكامل الشاشة.
                  </p>
                  <button
                    onClick={handleDirectInstall}
                    className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تثبيت تطبيق المتفلسفة  الآن 📲</span>
                  </button>
                </div>
              )}

              {/* Method 1: PWA Add to Homescreen (Best & Fastest) */}
              <div className="bg-indigo-50/70 dark:bg-slate-800/70 border border-indigo-100 dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">1</span>
                    <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                      التثبيت على الهاتف (أندرويد وآيفون) أو الكمبيوتر
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                    موصى به للطلاب ⭐
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  التطبيق مجهز كـ <strong>تطبيق ويب تقدمي (PWA)</strong>، وعند تثبيته يظهر بأيقونة وشاشة ترحيب <strong>"أهلاً في المتفلسفة "</strong> بكامل الشاشة:
                </p>

                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>في <strong>أندرويد (Chrome)</strong>: اضغط على <strong>النقاط الثلاث (⋮)</strong> أعلى المتصفح ثم اختر <strong>"تثبيت التطبيق" (Install App)</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>في <strong>آيفون (Safari)</strong>: اضغط على زر <strong>المشاركة (Share)</strong> بالأسفل ثم اختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>ستظهر أيقونة <strong>"المتفلسفة "</strong> على شاشة جهازك ويفتح التطبيق بشاشة الترحيب الخاصة بالمنصة.</span>
                  </li>
                </ul>
              </div>

              {/* Direct APK Download Card */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                      تحميل ملف التثبيت المباشر للأندرويد (APK جاهز)
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black">
                    ملف APK جاهز 📲
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  يمكنك تحميل ملف الـ APK المباشر وتثبيته فوراً على أي هاتف أو تابلت أندرويد ليعمل التطبيق بدون متصفح:
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <a
                    href="https://raw.githubusercontent.com/hos098sam-jpg/x3bb48b-c76c300b/main/qalbalelm.apk"
                    target="_blank"
                    rel="noopener noreferrer"
                    download="qalbalelm.apk"
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل ملف qalbalelm.apk الآن (مباشر)</span>
                  </a>
                  <a
                    href="https://raw.githubusercontent.com/hos098sam-jpg/x3bb48b-c76c300b/main/flutter_app.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    download="qalbalelm_flutter_app.zip"
                    className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-slate-200 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 text-center border border-slate-700"
                    title="تحميل كود المشروع Flutter كاملاً"
                  >
                    <span>كود Flutter (ZIP)</span>
                  </a>
                </div>
              </div>

              {/* Method 2: Additional Info */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center">2</span>
                  <h4 className="font-black text-slate-900 dark:text-white text-sm">
                    الحصول على ملف بصيغة (APK) للمشاركة
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black text-xs">
                      <Zap className="w-3.5 h-3.5" />
                      <span>عبر موقع PWABuilder (مجاني)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      افتح رابط المنصة في <a href="https://www.pwabuilder.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline">PWABuilder.com</a> واضغط <strong>Package for stores</strong> لتوليد ملف APK.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-black text-xs">
                      <Download className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                      <span>يعمل على جميع الأجهزة</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      يدعم التثبيت المباشر على هواتف الأندرويد، الآيفون، الآيباد، وأجهزة الكمبيوتر.
                    </p>
                  </div>
                </div>
              </div>

              {/* Supervisor footer banner inside modal */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>منصة المتفلسفة  - منصة تعليمية حديثة</span>
                </div>
                <span className="text-amber-700 dark:text-amber-300">دعم متواصل للطلاب</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all shadow-sm cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
