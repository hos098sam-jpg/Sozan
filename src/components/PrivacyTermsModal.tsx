import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  Lock, 
  UserCheck, 
  AlertTriangle, 
  Scale, 
  CheckCircle2, 
  HelpCircle, 
  X, 
  Phone, 
  Mail, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                السياسات والأحكام القانونية
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                منصة قلب العلم التعليمية • إشراف إدارة المنصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-5 sm:px-8 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>سياسة الخصوصية (Privacy Policy)</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>الشروط والأحكام (Terms of Service)</span>
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-5 sm:p-8 overflow-y-auto space-y-6 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
          {activeTab === 'privacy' ? (
            /* ========================================================================= */
            /* 1. PRIVACY POLICY */
            /* ========================================================================= */
            <div className="space-y-6 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm leading-relaxed font-medium">
                  نحن في <strong>منصة قلب العلم التعليمية</strong> نضع خصوصية وأمان بيانات الطلاب وأولياء الأمور والمعلمين في مقدمة أولوياتنا. توضح هذه الوثيقة كيف نقوم بجمع، واستخدام، وحماية بياناتكم وفقاً لأعلى معايير الأمن السيبراني.
                </p>
              </div>

              {/* Section 1 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                  البيانات التي نجمعها
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  عند التسجيل واستخدام المنصة، نجمع البيانات الضرورية لتقديم التجربة التعليمية ومتابعة المستوى الأكاديمي:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-600 dark:text-slate-400">
                  <li><strong>بيانات التعريف الشخصية:</strong> الاسم الرباعي، رقم الهاتف، المحافظة، والمدرسة.</li>
                  <li><strong>بيانات التواصل:</strong> رقم هاتف الطالب، ورقم هاتف ولي الأمر (لإرسال درجات الامتحانات والتقارير الأكاديمية عبر واتساب).</li>
                  <li><strong>المستوى الأكاديمي:</strong> الصف الدراسي والشعبة (علمي علوم / علمي رياضة / أدبي).</li>
                  <li><strong>السجل التعليمي:</strong> نتائج الامتحانات الإلكترونية، عدد المحاولات، نسبة مشاهدة الدروس، حلول بنك الأسئلة، ومشاركات المنتدى التعليمي.</li>
                  <li><strong>بيانات الأمان التقنية:</strong> معرّف الجلسة النشطة (Device Session ID) لفرض حماية الحساب من الفتح على أكثر من جهاز في نفس الوقت.</li>
                </ul>
              </section>

              {/* Section 2 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                  كيفية استخدام البيانات
                </h3>
                <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-600 dark:text-slate-400">
                  <li>إتاحة الوصول للكورسات المشترك بها والامتحانات التفاعلية.</li>
                  <li>ربط حساب الطالب بحساب ولي الأمر عبر <strong>بوابة ولي الأمر</strong> لتمكينه من متابعة درجات الامتحانات والغياب أولاً بأول.</li>
                  <li>إرسال تقارير النتائج الدورية والتنبيهات المدرسية للمساعدين والمعلمين المعتمدين.</li>
                  <li>عرض لوحة الشرف وتكريم الطلاب الأوائل في مسابقات المنصة.</li>
                  <li>التحقق من أمان الحساب ومنع مشاركة كلمات المرور أو الدخول المتزامن من أجهزة متعددة.</li>
                </ul>
              </section>

              {/* Section 3 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                  حماية البيانات وعدم مشاركتها مع أطراف ثالثة
                </h3>
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">
                    تتعهد منصة قلب العلم التعليمية بعدم بيع، أو تأجير، أو مشاركة أي بيانات شخصية تخص الطلاب أو أولياء أمورهم لأي جهة إعلانية أو تجارية أو أطراف ثالثة إطلاقاً.
                  </p>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  يتم حفظ البيانات وتشفيرها سحابياً بالكامل باستخدام بروتوكولات حماية متقدمة (SSL/TLS)، ولا يملك صلاحية الاطلاع على الدرجات الأكاديمية سوى المعلم والمشرف وولي الأمر المسجل.
                </p>
              </section>

              {/* Section 4 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
                  حقوق الطالب والمستخدم
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  يحق لكل مستخدم مراجعة بياناته المسجلة وتحديث رقم الهاتف أو المحافظة من خلال صفحة "حسابي"، كما يحق له طلب حذف الحساب نهائياً في أي وقت عبر التواصل مع إدارة المنصة.
                </p>
              </section>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. TERMS OF SERVICE */
            /* ========================================================================= */
            <div className="space-y-6 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm leading-relaxed font-medium">
                  استخدامك لمنصة قلب العلم التعليمية يعني موافقتك الكاملة وغير المشروطة على هذه الشروط والأحكام. يرجى قراءتها بعناية لضمان حقوقك وحقوق المنصة.
                </p>
              </div>

              {/* Term 1 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                  الملكية الفكرية وحماية المحتوى التعليمي
                </h3>
                <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-600 dark:text-slate-400">
                  <li>جميع المحتويات التعليمية المعروضة على المنصة — بما في ذلك فيديوهات الشرح، مذكرات الشرح والتدريبات (PDF)، بنوك الأسئلة، والامتحانات التفاعلية — هي <strong>ملكية فكرية حصرية ومحمية</strong> لمنصة قلب العلم وإدارة المنصة.</li>
                  <li><strong>يحظر تماماً:</strong> تصوير الشاشة (Screen Recording / Screenshot)، أو إعادة بث الفيديوهات، أو تنزيل المحتوى، أو توزيعه على مجموعات تليجرام أو منصات التواصل الاجتماعي.</li>
                  <li>أي انتهاك لحقوق الملكية الفكرية يعرض صاحبه <strong>للحظر النهائي الفوري</strong> للحساب وإلغاء الاشتراك دون استرداد الرسوم، مع احتفاظ المنصة بحقها في اتخاذ كافة الإجراءات القانونية والملاحقة الجنائية والمدنية.</li>
                </ul>
              </section>

              {/* Term 2 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                  سياسة الحساب الشخصي والجهاز الواحد (Single Device)
                </h3>
                <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-600 dark:text-slate-400">
                  <li>الحساب الدراسي مخصص لطالب واحد فقط، ولا يجوز تشاركه مع أي طالب آخر.</li>
                  <li>تطبق المنصة نظام الحماية الصارم للجهاز الواحد؛ بحيث لا يُسمح بتسجيل الدخول إلى الحساب من أكثر من جهاز في نفس اللحظة. في حال تم فتح الحساب من جهاز آخر، يتم تسجيل الخروج التلقائي للجهاز الأول فوراً.</li>
                  <li>محاولات اختراق جلسات الحسابات أو استغلال الثغرات البرمجية تؤدي للإيقاف الفوري للحساب.</li>
                </ul>
              </section>

              {/* Term 3 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                  الاشتراكات وأكواد التفعيل
                </h3>
                <ul className="list-disc list-inside space-y-1.5 pr-2 text-slate-600 dark:text-slate-400">
                  <li>أكواد شحن الرصيد والاشتراك في الكورسات صالحة للاستخدام لمرة واحدة فقط وترتبط بحساب الطالب الذي قام بتفعيلها.</li>
                  <li>المبالغ المسددة نظير تفعيل الكورسات التعليمية غير قابلة للاسترداد بعد تفعيل الكورس واستهلاك المحتوى التعليمي.</li>
                </ul>
              </section>

              {/* Term 4 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
                  ضوابط الامتحانات والمسابقات ولوحة الشرف
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  يلتزم الطالب بالأمانة العلمية أثناء أداء الامتحانات الدورية ومسابقات أوائل الجمهورية. تحتفظ إدارة الكنترول بالحق في إلغاء نتائج أي طالب يثبت تلاعبه بالوقت أو محاولته الغش، واستبعاده من لوحة الشرف والجوائز المالية والعينية.
                </p>
              </section>

              {/* Term 5 */}
              <section className="space-y-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs flex items-center justify-center font-bold">5</span>
                  تعديل وتحديث الشروط
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  يحق لإدارة المنصة تعديل أو تحديث هذه الشروط عند الحاجة لمواكبة التطورات التقنية والتنظيمية، ويتم إشعار الطلاب بأي تحديث جوهري عبر مركز الإشعارات بالمنصة.
                </p>
              </section>
            </div>
          )}

          {/* Contact / Inquiries Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                لديك أي استفسار حول سياسة الخصوصية أو الشروط؟
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://wa.me/201040672314"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>واتساب الدعم: 01040672314</span>
              </a>
              <a
                href="mailto:hos098sam@gmail.com"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black hover:bg-slate-300 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>البريد الإلكتروني</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            آخر تحديث للسياسات: سبتمبر 2026
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            إغلاق وقبول
          </button>
        </div>
      </div>
    </div>
  );
};
