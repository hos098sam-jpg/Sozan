import React from 'react';
import { Award, CheckCircle2, X, Sparkles, ShieldCheck, Heart, ExternalLink, Facebook, MessageCircle } from 'lucide-react';
import { TikTokIcon } from './TikTokIcon';
import { IDENTITY_NOTICE } from '../data/bacData';
import qalbAlElmLogo from '../assets/images/qalb_alelm_official_logo_1791663594965.jpg';

interface IdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IdentityModal: React.FC<IdentityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-2xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="w-20 h-20 rounded-full bg-white border-2 border-indigo-400/40 flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 overflow-hidden">
            <img
              src={qalbAlElmLogo}
              alt="شعار منصة قلب العلم"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">
            {IDENTITY_NOTICE.name}
          </h2>
          <p className="text-indigo-600 font-bold text-sm">
            {IDENTITY_NOTICE.tagline}
          </p>
        </div>

        {/* Identity & Supervision Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 mb-5 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              🌟
            </div>
            <div>
              <span className="text-xs text-slate-500 block font-medium">الإشراف العلمي والتطوير</span>
              <span className="text-base font-black text-slate-900">
                المشرف الأستاذ / {IDENTITY_NOTICE.supervisor}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900 font-bold">إجابات دقيقة علمياً:</strong> متوافقة مع المنهج المعتمد لبكالوريا 2027 في الفرعين العلمي والأدبي.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900 font-bold">شرح مبسط ومركز:</strong> تقسيم الدروس إلى نقاط وخطوات واضحة لتسهيل الفهم والحفظ.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900 font-bold">تلخيص بدون حشو:</strong> التركيز على الأفكار الأساسية والتعريفات المهمة والقوانين الرئيسية.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900 font-bold">اختبارات وسلالم تصحيح:</strong> محاكاة امتحانات البكالوريا الرسمية مع حلولها النموذجية المعتمدة.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900 font-bold">دعم نفسي وتحفيز دائم:</strong> تقليل التوتر وبث الثقة في نفوس الطلاب لتحقيق التفوق.
              </p>
            </div>
          </div>
        </div>

        {/* Social & Contact Channels */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <a
            href="https://www.facebook.com/profile.php?id=61594492453139"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors text-center"
          >
            <Facebook className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>فيسبوك: قلب العلم</span>
          </a>
          <a
            href="https://www.facebook.com/share/g/1KcP6KBSRC/"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors text-center"
          >
            <Facebook className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>جروب طلاب قلب العلم</span>
          </a>
          <a
            href="https://www.tiktok.com/@qalbalelm"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors text-center"
          >
            <TikTokIcon className="w-3.5 h-3.5 shrink-0" />
            <span>تيك توك: قلب العلم</span>
          </a>
          <a
            href="https://wa.me/201040672314"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors text-center"
            title="الدعم الفني للمنصة"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span>الدعم الفني للمنصة</span>
          </a>
        </div>

        {/* Footer info & confirm */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>منصة معتمدة لطلاب 2027</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>ابدأ رحلة التفوق</span>
          </button>
        </div>
      </div>
    </div>
  );
};
