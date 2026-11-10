import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Award,
  CheckCircle2,
  ArrowLeft,
  BookOpen,
  Trophy,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  GraduationCap,
  Key,
  Layers,
  Clock,
  Lock,
  Unlock,
  Play,
  Users,
  Check,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  X,
  Upload,
  Layout,
  Video,
  Image as ImageIcon,
  FileText,
  Edit3,
} from 'lucide-react';
import { PlatformSettings, Course, Competition, AppView, User, SchoolYearGrade, HomeSectionConfig, CustomHomeBlock, HeroExtraItem } from '../types';
import { getStudentEnrolledCourses } from '../data/initialData';
import { compressImageFile } from '../utils/imageUtils';
import { SecureVideoPlayer } from './SecureVideoPlayer';

interface LandingHomeProps {
  platformSettings: PlatformSettings;
  courses: Course[];
  competitions: Competition[];
  currentUser: User | null;
  teachers?: User[];
  onNavigate: (view: AppView) => void;
  onSelectCourse: (course: Course) => void;
  onSelectCompetition: (comp: Competition) => void;
  onSelectTeacher?: (teacher: User) => void;
  onOpenAuth: (mode?: 'login' | 'signup' | 'parent') => void;
  onEnrollCourse?: (course: Course) => void;
  onDeleteTeacher?: (teacher: User) => void;
  isVisualEditMode?: boolean;
  onSaveVisualSettings?: (newSettings: PlatformSettings) => void;
  onExitVisualEditMode?: () => void;
}

const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { id: 'hero', label: 'الواجهة الترحيبية الرئيسية (Hero Banner)', visible: true },
  { id: 'stats', label: 'شريط الإحصائيات السريعة للمنصة', visible: true },
  { id: 'teachers', label: 'قسم نخبة المعلمين المعتمدين', visible: true },
  { id: 'courses', label: 'قسم استكشف الكورسات والمواد الدراسية', visible: true },
  { id: 'competitions', label: 'قسم المسابقات المجانية ولوحة الشرف', visible: true },
  { id: 'features', label: 'قسم لماذا تختار المنصة؟ (المميزات)', visible: true },
];

const ScrollRevealItem: React.FC<{
  children: React.ReactNode;
  delayIndex?: number;
  side?: 'right' | 'left';
  className?: string;
  disabled?: boolean;
}> = ({ children, delayIndex = 0, side = 'right', className = '', disabled = false }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(disabled);

  useEffect(() => {
    if (disabled) {
      setIsVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          } else if (entry.boundingClientRect.top > 60) {
            // Reset when element is below viewport so scrolling down drops items one after another
            setIsVisible(false);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [disabled]);

  const delayMs = delayIndex > 0 ? Math.min(delayIndex * 140, 980) : 0;

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`reveal-on-scroll ${side === 'left' ? 'from-left-side' : ''} ${
        isVisible ? 'is-visible' : ''
      } ${className}`}
    >
      {children}

      {/* Platform Theme Color Customizer Modal */}
      {showColorPickerModal && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">تخصيص ألوان أجزاء المنصة</h3>
                  <p className="text-xs text-slate-400">تحكم كامل في الألوان والأزرار وخلفيات المنصة</p>
                </div>
              </div>
              <button
                onClick={() => setShowColorPickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Primary Accent Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-300">لون الأزرار والعناصر الرئيسية (Gold/Accent)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customPrimaryColor}
                    onChange={(e) => setCustomPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-xl cursor-pointer bg-slate-800 border border-slate-700"
                  />
                  <input
                    type="text"
                    value={customPrimaryColor}
                    onChange={(e) => setCustomPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-300">لون الخلفية العامة للمنصة (Background)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    className="w-12 h-10 rounded-xl cursor-pointer bg-slate-800 border border-slate-700"
                  />
                  <input
                    type="text"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-black text-slate-400">نماذج ألوان جاهزة بضغطة زر:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyColors('#d4af37', '#0d0824', '#ffffff')}
                    className="p-2 rounded-xl bg-[#0d0824] border border-[#d4af37]/60 text-xs font-bold text-amber-400 hover:scale-102 transition-transform"
                  >
                    🏛️ المتفلسفة الملكي (ذهبي ونيلي)
                  </button>
                  <button
                    onClick={() => applyColors('#f59e0b', '#0f172a', '#ffffff')}
                    className="p-2 rounded-xl bg-[#0f172a] border border-amber-500/60 text-xs font-bold text-amber-300 hover:scale-102 transition-transform"
                  >
                    🌌 كلاسيك داكن (Dark Slate)
                  </button>
                  <button
                    onClick={() => applyColors('#8b5cf6', '#090514', '#ffffff')}
                    className="p-2 rounded-xl bg-[#090514] border border-purple-500/60 text-xs font-bold text-purple-300 hover:scale-102 transition-transform"
                  >
                    🔮 بنفسجي ملكي عميق
                  </button>
                  <button
                    onClick={() => applyColors('#10b981', '#06130e', '#ffffff')}
                    className="p-2 rounded-xl bg-[#06130e] border border-emerald-500/60 text-xs font-bold text-emerald-300 hover:scale-102 transition-transform"
                  >
                    🌿 زمردي إسلامي
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  applyColors(customPrimaryColor, customBgColor, customTextColor);
                  setShowColorPickerModal(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                تطبيق وحفظ الألوان الآن ✅
              </button>
              <button
                onClick={() => setShowColorPickerModal(false)}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const LandingHome: React.FC<LandingHomeProps> = ({
  platformSettings,
  courses,
  competitions,
  currentUser,
  teachers = [],
  onNavigate,
  onSelectCourse,
  onSelectCompetition,
  onSelectTeacher,
  onOpenAuth,
  onEnrollCourse,
  onDeleteTeacher,
  isVisualEditMode = false,
  onSaveVisualSettings,
  onExitVisualEditMode,
}) => {
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<'all' | 'primary' | 'prep' | 'secondary' | SchoolYearGrade>('all');
  const [draftSettings, setDraftSettings] = useState<PlatformSettings>(platformSettings);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [customPrimaryColor, setCustomPrimaryColor] = useState(() => localStorage.getItem('sozan_primary_color') || '#d4af37');
  const [customBgColor, setCustomBgColor] = useState(() => localStorage.getItem('sozan_bg_color') || '#0d0824');
  const [customTextColor, setCustomTextColor] = useState(() => localStorage.getItem('sozan_text_color') || '#ffffff');

  const applyColors = (pColor: string, bColor: string, tColor: string) => {
    setCustomPrimaryColor(pColor);
    setCustomBgColor(bColor);
    setCustomTextColor(tColor);
    try {
      localStorage.setItem('sozan_primary_color', pColor);
      localStorage.setItem('sozan_bg_color', bColor);
      localStorage.setItem('sozan_text_color', tColor);
      document.documentElement.style.setProperty('--motafalsifa-accent', pColor);
      document.documentElement.style.setProperty('--motafalsifa-gold', pColor);
      document.body.style.backgroundColor = bColor;
    } catch {}
    setSaveToast('✅ تم تطبيق وتخصيص ألوان المنصة بنجاح!');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const [teacherPendingDelete, setTeacherPendingDelete] = useState<User | null>(null);

  // Sub-editor states inside visual mode (so original layout stays 100% intact until clicked)
  const [editingHeroBox, setEditingHeroBox] = useState(false);

  // Hero Extra Item Modal State (add images, videos, text, or buttons directly inside the Hero section)
  const [showHeroExtraModal, setShowHeroExtraModal] = useState(false);
  const [editingHeroItemId, setEditingHeroItemId] = useState<string | null>(null);
  const [heroItemTitle, setHeroItemTitle] = useState('');
  const [heroItemSubtitle, setHeroItemSubtitle] = useState('');
  const [heroItemBadge, setHeroItemBadge] = useState('');
  const [heroItemImageUrl, setHeroItemImageUrl] = useState('');
  const [heroItemVideoUrl, setHeroItemVideoUrl] = useState('');
  const [heroItemButtonText, setHeroItemButtonText] = useState('');
  const [heroItemTargetView, setHeroItemTargetView] = useState<AppView>('courses');
  const [heroItemPlacement, setHeroItemPlacement] = useState<'left_card' | 'right_column' | 'bottom_full'>('left_card');

  // Add / Edit Custom Media Block Modal (Text + Image + Video anywhere)
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [insertPositionIndex, setInsertPositionIndex] = useState<number | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockSubtitle, setNewBlockSubtitle] = useState('');
  const [newBlockBadge, setNewBlockBadge] = useState('');
  const [newBlockImageUrl, setNewBlockImageUrl] = useState('');
  const [newBlockVideoUrl, setNewBlockVideoUrl] = useState('');
  const [newBlockButtonText, setNewBlockButtonText] = useState('');
  const [newBlockTargetView, setNewBlockTargetView] = useState<AppView>('courses');
  const [newBlockTheme, setNewBlockTheme] = useState<'indigo' | 'emerald' | 'amber' | 'rose' | 'slate'>('indigo');

  useEffect(() => {
    setDraftSettings(platformSettings);
  }, [platformSettings]);

  const activeSettings = isVisualEditMode ? draftSettings : platformSettings;

  const customBlocks: CustomHomeBlock[] = activeSettings.customHomeBlocks || [];
  const heroExtraItems: HeroExtraItem[] = activeSettings.heroExtraItems || [];

  const commitHeroSettings = (nextSettings: PlatformSettings) => {
    setDraftSettings(nextSettings);
    onSaveVisualSettings?.(nextSettings);
  };

  const handleOpenAddHeroItem = (defaultPlacement: 'left_card' | 'right_column' | 'bottom_full' = 'left_card') => {
    setEditingHeroItemId(null);
    setHeroItemTitle('');
    setHeroItemSubtitle('');
    setHeroItemBadge('');
    setHeroItemImageUrl('');
    setHeroItemVideoUrl('');
    setHeroItemButtonText('');
    setHeroItemTargetView('courses');
    setHeroItemPlacement(defaultPlacement);
    setShowHeroExtraModal(true);
  };

  const handleOpenEditHeroItem = (item: HeroExtraItem) => {
    setEditingHeroItemId(item.id);
    setHeroItemTitle(item.title || '');
    setHeroItemSubtitle(item.subtitle || '');
    setHeroItemBadge(item.badge || '');
    setHeroItemImageUrl(item.imageUrl || '');
    setHeroItemVideoUrl(item.videoUrl || '');
    setHeroItemButtonText(item.buttonText || '');
    setHeroItemTargetView(item.buttonTargetView || 'courses');
    setHeroItemPlacement(item.placement || 'left_card');
    setShowHeroExtraModal(true);
  };

  const handleSaveHeroExtraItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroItemTitle.trim() && !heroItemSubtitle.trim() && !heroItemImageUrl.trim() && !heroItemVideoUrl.trim()) {
      return;
    }

    const updatedItems: HeroExtraItem[] = editingHeroItemId
      ? heroExtraItems.map((it) =>
          it.id === editingHeroItemId
            ? {
                ...it,
                title: heroItemTitle.trim() || undefined,
                subtitle: heroItemSubtitle.trim() || undefined,
                badge: heroItemBadge.trim() || undefined,
                imageUrl: heroItemImageUrl.trim() || undefined,
                videoUrl: heroItemVideoUrl.trim() || undefined,
                buttonText: heroItemButtonText.trim() || undefined,
                buttonTargetView: heroItemTargetView,
                placement: heroItemPlacement,
              }
            : it
        )
      : [
          ...heroExtraItems,
          {
            id: `hero_item_${Date.now()}`,
            title: heroItemTitle.trim() || undefined,
            subtitle: heroItemSubtitle.trim() || undefined,
            badge: heroItemBadge.trim() || undefined,
            imageUrl: heroItemImageUrl.trim() || undefined,
            videoUrl: heroItemVideoUrl.trim() || undefined,
            buttonText: heroItemButtonText.trim() || undefined,
            buttonTargetView: heroItemTargetView,
            placement: heroItemPlacement,
          },
        ];

    const nextSettings: PlatformSettings = {
      ...draftSettings,
      heroExtraItems: updatedItems,
    };
    commitHeroSettings(nextSettings);
    setShowHeroExtraModal(false);
    setEditingHeroItemId(null);
    setSaveToast('✅ تم حفظ العنصر / الصورة داخل المنطقة الترحيبية بنجاح!');
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleDeleteHeroExtraItem = (itemId: string) => {
    const nextSettings: PlatformSettings = {
      ...draftSettings,
      heroExtraItems: heroExtraItems.filter((it) => it.id !== itemId),
    };
    commitHeroSettings(nextSettings);
  };

  const renderHeroExtraItemCard = (item: HeroExtraItem) => (
    <div
      key={item.id}
      className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-4 sm:p-5 space-y-3 shadow-xl relative overflow-hidden"
    >
      {isVisualEditMode && (
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/15">
          <span className="text-[10px] font-black text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>عنصر مضاف في هذه المنطقة</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenEditHeroItem(item)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>تعديل ✏️</span>
            </button>
            <button
              type="button"
              onClick={() => handleDeleteHeroExtraItem(item.id)}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>حذف</span>
            </button>
          </div>
        </div>
      )}

      {(item.badge || item.title || item.subtitle) && (
        <div className="space-y-1.5">
          {item.badge && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black">
              {item.badge}
            </span>
          )}
          {item.title && <h3 className="text-base sm:text-lg font-black text-white">{item.title}</h3>}
          {item.subtitle && <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed">{item.subtitle}</p>}
        </div>
      )}

      {item.imageUrl && (
        <div className="rounded-2xl overflow-hidden border border-white/15 bg-slate-950/50 max-h-80 flex items-center justify-center">
          <img
            src={item.imageUrl}
            alt={item.title || 'صورة مضافة'}
            className="w-full max-h-80 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {item.videoUrl && (
        <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-lg">
          <SecureVideoPlayer
            video={{
              id: `hero_extra_vid_${item.id}`,
              title: item.title || 'فيديو المنطقة الترحيبية',
              url: item.videoUrl,
              sourceType: item.videoUrl.startsWith('vcdn:') ? 'vcdn' : 'url',
              duration: '',
              order: 1,
            }}
            currentUser={currentUser}
          />
        </div>
      )}

      {item.buttonText && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => !isVisualEditMode && onNavigate(item.buttonTargetView || 'courses')}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <span>{item.buttonText}</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  // Build ordered sections list (combining default sections + any custom blocks)
  const buildSectionsList = (): HomeSectionConfig[] => {
    const base =
      activeSettings.homeSections && activeSettings.homeSections.length > 0
        ? activeSettings.homeSections.filter((s) => s.id !== 'custom_blocks')
        : [...DEFAULT_HOME_SECTIONS];

    // Ensure all customBlocks are represented in the sections ordering list
    const existingIds = new Set(base.map((s) => s.id));
    const missingBlockSections: HomeSectionConfig[] = customBlocks
      .filter((b) => !existingIds.has(b.id))
      .map((b) => ({
        id: b.id,
        label: `قسم مضاف: ${b.title || 'نص / صورة / فيديو'}`,
        visible: true,
      }));

    if (missingBlockSections.length === 0) return base;
    // Insert right after hero by default if not positioned yet
    const heroIdx = base.findIndex((s) => s.id === 'hero');
    if (heroIdx !== -1) {
      const copy = [...base];
      copy.splice(heroIdx + 1, 0, ...missingBlockSections);
      return copy;
    }
    return [...base, ...missingBlockSections];
  };

  const sectionsList = buildSectionsList();

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const list = [...sectionsList];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setDraftSettings({ ...draftSettings, homeSections: list });
  };

  const handleToggleSectionVisibility = (id: string) => {
    const list = sectionsList.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s));
    setDraftSettings({ ...draftSettings, homeSections: list });
  };

  const handleOpenAddModalAtPosition = (indexAfter: number) => {
    setEditingBlockId(null);
    setInsertPositionIndex(indexAfter);
    setNewBlockTitle('');
    setNewBlockSubtitle('');
    setNewBlockBadge('');
    setNewBlockImageUrl('');
    setNewBlockVideoUrl('');
    setNewBlockButtonText('');
    setNewBlockTargetView('courses');
    setNewBlockTheme('indigo');
    setShowAddBlockModal(true);
  };

  const handleOpenEditBlockModal = (block: CustomHomeBlock) => {
    setEditingBlockId(block.id);
    setNewBlockTitle(block.title || '');
    setNewBlockSubtitle(block.subtitle || '');
    setNewBlockBadge(block.badge || '');
    setNewBlockImageUrl(block.imageUrl || '');
    setNewBlockVideoUrl(block.videoUrl || '');
    setNewBlockButtonText(block.buttonText || '');
    setNewBlockTargetView(block.buttonTargetView || 'courses');
    setNewBlockTheme(block.themeColor || 'indigo');
    setShowAddBlockModal(true);
  };

  const handleSaveCustomBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockTitle.trim() && !newBlockSubtitle.trim() && !newBlockImageUrl.trim() && !newBlockVideoUrl.trim()) {
      return;
    }

    if (editingBlockId) {
      const updatedBlocks = customBlocks.map((b) =>
        b.id === editingBlockId
          ? {
              ...b,
              title: newBlockTitle.trim(),
              subtitle: newBlockSubtitle.trim(),
              badge: newBlockBadge.trim(),
              imageUrl: newBlockImageUrl.trim() || undefined,
              videoUrl: newBlockVideoUrl.trim() || undefined,
              buttonText: newBlockButtonText.trim() || undefined,
              buttonTargetView: newBlockTargetView,
              themeColor: newBlockTheme,
            }
          : b
      );
      const updatedSections = sectionsList.map((s) =>
        s.id === editingBlockId
          ? { ...s, label: `قسم مضاف: ${newBlockTitle.trim() || 'صورة / فيديو / نص'}` }
          : s
      );
      setDraftSettings({
        ...draftSettings,
        customHomeBlocks: updatedBlocks,
        homeSections: updatedSections,
      });
    } else {
      const newId = `block_${Date.now()}`;
      const newBlock: CustomHomeBlock = {
        id: newId,
        title: newBlockTitle.trim(),
        subtitle: newBlockSubtitle.trim(),
        badge: newBlockBadge.trim() || undefined,
        imageUrl: newBlockImageUrl.trim() || undefined,
        videoUrl: newBlockVideoUrl.trim() || undefined,
        buttonText: newBlockButtonText.trim() || undefined,
        buttonTargetView: newBlockTargetView,
        themeColor: newBlockTheme,
      };
      const updatedBlocks = [...customBlocks, newBlock];
      const newSectionItem: HomeSectionConfig = {
        id: newId,
        label: `قسم مضاف: ${newBlock.title || 'صورة / فيديو / نص'}`,
        visible: true,
      };
      const nextSections = [...sectionsList];
      if (insertPositionIndex !== null && insertPositionIndex >= 0 && insertPositionIndex <= nextSections.length) {
        nextSections.splice(insertPositionIndex, 0, newSectionItem);
      } else {
        nextSections.push(newSectionItem);
      }
      const nextSettings = {
        ...draftSettings,
        customHomeBlocks: updatedBlocks,
        homeSections: nextSections,
      };
      setDraftSettings(nextSettings);
      onSaveVisualSettings?.(nextSettings);
      setSaveToast('✅ تم إضافة القسم وحفظه في الصفحة الرئيسية بنجاح!');
      setTimeout(() => setSaveToast(null), 3500);
    }

    setShowAddBlockModal(false);
    setEditingBlockId(null);
    setInsertPositionIndex(null);
  };

  const handleDeleteCustomBlock = (blockId: string) => {
    setDraftSettings({
      ...draftSettings,
      customHomeBlocks: customBlocks.filter((b) => b.id !== blockId),
      homeSections: sectionsList.filter((s) => s.id !== blockId),
    });
  };

  const handleSaveAllChanges = () => {
    onSaveVisualSettings?.(draftSettings);
    setEditingHeroBox(false);
    setSaveToast('✅ تم حفظ جميع التعديلات بنجاح ونشرها لجميع الطلاب على المنصة!');
    setTimeout(() => setSaveToast(null), 4000);
  };

  const publishedCourses = courses.filter((c) => c.isPublished);
  const filteredHomeCourses =
    selectedGradeFilter === 'all'
      ? publishedCourses
      : selectedGradeFilter === 'primary'
      ? publishedCourses.filter((c) => c.schoolYear.includes('الابتدائي'))
      : selectedGradeFilter === 'prep'
      ? publishedCourses.filter((c) => c.schoolYear.includes('الإعدادي'))
      : selectedGradeFilter === 'secondary'
      ? publishedCourses.filter((c) => c.schoolYear.includes('الثانوي') || c.schoolYear.includes('بكالوريا'))
      : publishedCourses.filter((c) => c.schoolYear === selectedGradeFilter);
  const publishedCompetitions = competitions.filter((c) => c.isPublished);

  const isCourseEnrolled = (courseId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'teacher') return true;
    const localIds = getStudentEnrolledCourses(currentUser.id);
    return Boolean(
      (currentUser.enrolledCourseIds && currentUser.enrolledCourseIds.includes(courseId)) ||
      localIds.includes(courseId)
    );
  };

  const statsList = activeSettings.customStats && activeSettings.customStats.length === 4
    ? activeSettings.customStats
    : [
        { label: 'الكورسات التعليمية والاختبارات', value: `${publishedCourses.length}` },
        { label: 'الامتحانات المتاحة بالكورسات', value: `${publishedCourses.reduce((acc, c) => acc + c.exams.length, 0)}` },
        { label: 'المسابقات المجانية المنشورة', value: `${publishedCompetitions.length}` },
        { label: 'متابعة وتقييم فوري بالدرجات', value: '100%' },
      ];

  const featuresList = activeSettings.customFeatures && activeSettings.customFeatures.length === 3
    ? activeSettings.customFeatures
    : [
        {
          title: 'نظام القفل المتسلسل للامتحانات',
          desc: 'لا يمكن للطالب الانتقال إلى امتحان الحصة الجديدة إلا بعد اجتياز الامتحان السابق بنسبة النجاح المحددة، مما يضمن إتقان كل درس.',
        },
        {
          title: 'تأمين الكورسات بأكواد تفعيل خاصة',
          desc: 'كل كورس محمي بكود تفعيل فريد يحصل عليه الطالب من المشرف عند الاشتراك، لفتح محتوى الكورس والامتحانات المرتبطة به.',
        },
        {
          title: 'تصحيح فوري + مراجعة المقالي بالصور',
          desc: 'تصحيح إلكتروني فوري لأسئلة الاختيار من متعدد، مع إمكانية كتابة أو تصوير الإجابات المقالية ليقوم المعلم بتصحيحها وإرسال نموذج الإجابة.',
        },
      ];

  // Render an "Add Section Here" button between sections when in visual edit mode
  const renderInsertHereButton = (positionIdx: number) => {
    if (!isVisualEditMode) return null;
    return (
      <div className="flex items-center justify-center my-2">
        <button
          type="button"
          onClick={() => handleOpenAddModalAtPosition(positionIdx)}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-md border border-indigo-400/40 cursor-pointer transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>+ أضف هنا في هذا الجزء (نص / صورة / فيديو) 🖼️🎬📝</span>
        </button>
      </div>
    );
  };

  // Render a custom block (Text + Image + Video) anywhere in the page
  const renderCustomMediaBlock = (block: CustomHomeBlock) => {
    const themeClasses =
      block.themeColor === 'emerald'
        ? 'from-emerald-950 via-teal-900 to-slate-900 border-emerald-500/30 text-white'
        : block.themeColor === 'amber'
        ? 'from-amber-950 via-orange-950 to-slate-900 border-amber-500/30 text-white'
        : block.themeColor === 'rose'
        ? 'from-rose-950 via-pink-950 to-slate-900 border-rose-500/30 text-white'
        : block.themeColor === 'slate'
        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
        : 'from-indigo-950 via-blue-950 to-slate-900 border-indigo-500/30 text-white';

    const isLight = block.themeColor === 'slate';

    return (
      <section
        className={`rounded-[40px] ${
          isLight ? themeClasses : `bg-gradient-to-br ${themeClasses}`
        } p-6 sm:p-10 border shadow-xl space-y-6 relative overflow-hidden`}
      >
        {isVisualEditMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/15">
            <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>قسم مخصص (نصوص / صور / فيديوهات)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenEditBlockModal(block)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل المحتوى أو الصورة أو الفيديو ✏️</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomBlock(block.id)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف هذا القسم نهائياً</span>
              </button>
            </div>
          </div>
        )}

        {/* Text Header */}
        {(block.badge || block.title || block.subtitle) && (
          <div className="space-y-3 max-w-4xl">
            {block.badge && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30 text-xs font-black">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{block.badge}</span>
              </span>
            )}
            {block.title && (
              <h2 className={`text-2xl sm:text-3xl font-black leading-tight ${isLight ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                {block.title}
              </h2>
            )}
            {block.subtitle && (
              <p className={`text-sm sm:text-base leading-relaxed whitespace-pre-line ${isLight ? 'text-slate-600 dark:text-slate-300' : 'text-slate-200'}`}>
                {block.subtitle}
              </p>
            )}
          </div>
        )}

        {/* Image Display if present */}
        {block.imageUrl && (
          <div className="rounded-3xl overflow-hidden border border-white/15 bg-slate-950/40 max-h-[540px] flex items-center justify-center shadow-lg">
            <img
              src={block.imageUrl}
              alt={block.title || 'صورة توضيحية'}
              className="w-full max-h-[540px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Video Display if present (plays in platform's SecureVideoPlayer!) */}
        {block.videoUrl && (
          <div className="rounded-3xl overflow-hidden border border-slate-700 bg-black shadow-2xl">
            <SecureVideoPlayer
              video={{
                id: `home_vid_${block.id}`,
                title: block.title || 'فيديو الصفحة الرئيسية',
                url: block.videoUrl,
                sourceType: block.videoUrl.startsWith('vcdn:') ? 'vcdn' : 'url',
                duration: '',
                order: 1,
              }}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* Optional CTA Button */}
        {block.buttonText && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => !isVisualEditMode && onNavigate(block.buttonTargetView || 'courses')}
              className="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-400/20 transition-all"
            >
              <span>{block.buttonText}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderSection = (sectionConfig: HomeSectionConfig, sectionIndex: number) => {
    if (!sectionConfig.visible && !isVisualEditMode) return null;

    const wrapperClass = isVisualEditMode
      ? `relative rounded-[44px] border-2 transition-all p-2 sm:p-4 ${
          sectionConfig.visible
            ? 'border-indigo-500/50 bg-indigo-950/5'
            : 'border-rose-400/60 bg-rose-950/10 opacity-60'
        }`
      : '';

    const renderAdminControls = () => {
      if (!isVisualEditMode) return null;
      const isCustom = sectionConfig.id.startsWith('block_');
      return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl border border-slate-700 shadow-md z-30">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-[11px] font-black">
              ترتيب #{sectionIndex + 1}
            </span>
            <span className="text-xs sm:text-sm font-black text-amber-300">{sectionConfig.label}</span>
            {!sectionConfig.visible && (
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black">
                مخفي عن الطلاب
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {sectionConfig.id === 'hero' && (
              <button
                type="button"
                onClick={() => setEditingHeroBox(!editingHeroBox)}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{editingHeroBox ? 'إغلاق تعديل الواجهة' : 'تعديل نصوص وصورة الواجهة ✏️'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleMoveSection(sectionIndex, 'up')}
              disabled={sectionIndex === 0}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white cursor-pointer transition-all"
              title="تحريك القسم لأعلى"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleMoveSection(sectionIndex, 'down')}
              disabled={sectionIndex === sectionsList.length - 1}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white cursor-pointer transition-all"
              title="تحريك القسم لأسفل"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            {isCustom ? (
              <button
                type="button"
                onClick={() => handleDeleteCustomBlock(sectionConfig.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف القسم</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleSectionVisibility(sectionConfig.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  sectionConfig.visible
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {sectionConfig.visible ? (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إخفاء / حذف القسم</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>إظهار القسم للطلاب</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      );
    };

    // Check if this section is a custom block
    if (sectionConfig.id.startsWith('block_')) {
      const foundBlock = customBlocks.find((b) => b.id === sectionConfig.id);
      if (!foundBlock) return null;
      return (
        <ScrollRevealItem key={sectionConfig.id} disabled={isVisualEditMode} className={wrapperClass}>
          {renderAdminControls()}
          {renderCustomMediaBlock(foundBlock)}
        </ScrollRevealItem>
      );
    }

    switch (sectionConfig.id) {
      case 'hero':
        return (
          <div key="hero" className={wrapperClass}>
            {renderAdminControls()}

            {/* Optional collapsible editor drawer when Admin clicks "تعديل نصوص وصورة الواجهة" */}
            {isVisualEditMode && editingHeroBox && (
              <div className="mb-4 p-5 rounded-3xl bg-slate-900 text-white border-2 border-amber-400/60 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-sm font-black text-amber-300">تعديل بيانات الواجهة الترحيبية وإضافة صور في البطاقة</h4>
                  <button
                    type="button"
                    onClick={() => setEditingHeroBox(false)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">الشريط الإعلاني العلوي:</label>
                    <input
                      type="text"
                      value={draftSettings.announcementText}
                      onChange={(e) => setDraftSettings({ ...draftSettings, announcementText: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">العنوان الرئيسي الكبير:</label>
                    <input
                      type="text"
                      value={draftSettings.heroTitle}
                      onChange={(e) => setDraftSettings({ ...draftSettings, heroTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-300 mb-1">الوصف الفرعي تحت العنوان:</label>
                    <textarea
                      rows={2}
                      value={draftSettings.heroSubtitle}
                      onChange={(e) => setDraftSettings({ ...draftSettings, heroSubtitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">اسم المشرف العام (في البطاقة الجانبية):</label>
                    <input
                      type="text"
                      value={draftSettings.supervisorName}
                      onChange={(e) => setDraftSettings({ ...draftSettings, supervisorName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">لقب المشرف العام:</label>
                    <input
                      type="text"
                      value={draftSettings.supervisorTitle}
                      onChange={(e) => setDraftSettings({ ...draftSettings, supervisorTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-300"
                    />
                  </div>

                  {/* Supervisor Avatar Image Upload */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">صورة المشرف / الأيقونة في البطاقة الجانبية:</label>
                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة للمشرف 🖼️</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              compressImageFile(file, 800, 0.8).then((img) => {
                                if (img) commitHeroSettings({ ...draftSettings, supervisorImage: img });
                              });
                            }
                          }}
                        />
                      </label>
                      {draftSettings.supervisorImage && (
                        <button
                          type="button"
                          onClick={() => commitHeroSettings({ ...draftSettings, supervisorImage: '' })}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          إزالة الصورة ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Additional Side Card Featured Image */}
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">إضافة صورة بارزة داخل البطاقة الجانبية:</label>
                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة داخل البطاقة 🖼️</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              compressImageFile(file, 1000, 0.8).then((img) => {
                                if (img) commitHeroSettings({ ...draftSettings, heroSideImage: img });
                              });
                            }
                          }}
                        />
                      </label>
                      {draftSettings.heroSideImage && (
                        <button
                          type="button"
                          onClick={() => commitHeroSettings({ ...draftSettings, heroSideImage: '' })}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          حذف الصورة ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-300 mb-1">صورة خلفية الواجهة الرئيسية:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftSettings.heroBannerImage}
                        onChange={(e) => setDraftSettings({ ...draftSettings, heroBannerImage: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-[11px]"
                      />
                      <label className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة من جهازك</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              compressImageFile(file, 1200, 0.75).then((img) => {
                                if (img) commitHeroSettings({ ...draftSettings, heroBannerImage: img });
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      commitHeroSettings(draftSettings);
                      setEditingHeroBox(false);
                      setSaveToast('✅ تم حفظ تعديلات المنطقة الترحيبية بنجاح!');
                      setTimeout(() => setSaveToast(null), 3500);
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ التعديلات الآن ✅</span>
                  </button>
                </div>
              </div>
            )}

            {/* RESPONSIVE HERO BANNER WITH FULL AL-MOTAFALSIFA LOGO & TITLE */}
            <ScrollRevealItem delayIndex={1} disabled={isVisualEditMode}>
              <section
                onClick={() => !isVisualEditMode && onNavigate('courses')}
                className="relative rounded-3xl sm:rounded-[36px] bg-gradient-to-b from-[#160d38] via-[#10072b] to-[#0a041c] text-white overflow-hidden shadow-2xl border-2 border-amber-500/40 cursor-pointer group p-4 sm:p-8"
              >
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-10">
                  {/* Right side: Welcome text & buttons */}
                  <div className="flex-1 text-center lg:text-right space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-black shadow-xs">
                      <span>🏛️ المنصة الرسمية لشهادة الثانوية العامة 2027</span>
                    </div>
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                      منصة <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">المتفلسفة</span> التعليمية
                    </h1>
                    <p className="text-amber-200/90 text-sm sm:text-lg font-bold">
                      تحت إشراف: <span className="text-white font-black underline decoration-amber-400 decoration-2">أ/ سوزان كريم الخولى</span>
                    </p>
                    <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
                      المنظومة التعليمية المتكاملة والمتخصصة في مادتي الفلسفة والمنطق، وعلم النفس والاجتماع للمرحلة الثانوية العامة (أولى، تانية، وتالتة ثانوي).
                    </p>
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate('courses'); }}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition-transform active:scale-95 flex items-center gap-2 cursor-pointer"
                      >
                        <span>استعراض الكورسات والمحاضرات 📚</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenAuth('signup'); }}
                        className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                      >
                        <span>إنشاء حساب طالب جديد ✨</span>
                      </button>
                    </div>
                  </div>

                  {/* Left side: Full Official Al-Motafalsifa Logo without any clipping */}
                  <div className="w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 relative shrink-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-purple-600/20 to-transparent rounded-full blur-2xl -z-10 animate-pulse"></div>
                    <img
                      src="/logo.png"
                      alt="شعار منصة المتفلسفة الرسمي"
                      className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(212,175,55,0.35)] group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>

                {/* Optional Extra Items if Admin added any */}
                {heroExtraItems.length > 0 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-6 sm:p-8 space-y-4 bg-slate-950/90 border-t border-white/10"
                  >
                    {heroExtraItems.map((it) => renderHeroExtraItemCard(it))}
                  </div>
                )}
              </section>
            </ScrollRevealItem>
          </div>
        );

      case 'stats':
        return (
          <div key="stats" className={wrapperClass}>
            {renderAdminControls()}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statsList.map((stat, idx) => (
                <ScrollRevealItem
                  key={idx}
                  delayIndex={idx + 1}
                  disabled={isVisualEditMode}
                  className="bg-white border border-slate-200/90 rounded-3xl p-6 flex items-center gap-4 shadow-xs"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    {idx === 0 ? <BookOpen className="w-6 h-6" /> : idx === 1 ? <Layers className="w-6 h-6" /> : idx === 2 ? <Trophy className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {isVisualEditMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={stat.value}
                          onChange={(e) => {
                            const nextStats = [...statsList];
                            nextStats[idx] = { ...nextStats[idx], value: e.target.value };
                            setDraftSettings({ ...draftSettings, customStats: nextStats });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-sm font-black text-slate-900"
                        />
                        <input
                          type="text"
                          value={stat.label}
                          onChange={(e) => {
                            const nextStats = [...statsList];
                            nextStats[idx] = { ...nextStats[idx], label: e.target.value };
                            setDraftSettings({ ...draftSettings, customStats: nextStats });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-[10px] font-bold text-slate-600"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                        <div className="text-xs text-slate-500 font-bold">{stat.label}</div>
                      </>
                    )}
                  </div>
                </ScrollRevealItem>
              ))}
            </section>
          </div>
        );

      case 'teachers':
        if (teachers.length === 0 && !isVisualEditMode) return null;
        return (
          <div key="teachers" className={wrapperClass}>
            {renderAdminControls()}
            <section className="space-y-6">
              <ScrollRevealItem disabled={isVisualEditMode}>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-full mb-2 border border-indigo-100">
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>نخبة المعلمين والأساتذة المعتمدين</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      {activeSettings.teachersSectionTitle || 'اختر معلمك وتابع أقوى الشروحات والكورسات'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {activeSettings.teachersSectionSubtitle || 'اضغط على بطاقة المعلم لاستعراض ملفه الأكاديمي وجميع كورساته المنشورة على المنصة'}
                    </p>
                  </div>
                </div>
              </ScrollRevealItem>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {teachers.map((teacher, idx) => {
                  const teacherCourseCount = publishedCourses.filter(
                    (c) =>
                      c.instructorId === teacher.id ||
                      c.instructor === teacher.name ||
                      c.teacherName === teacher.name
                  ).length;

                  return (
                    <ScrollRevealItem
                      key={teacher.id}
                      delayIndex={(idx % 3) + 1}
                      disabled={isVisualEditMode}
                    >
                      <div
                        onClick={() => !isVisualEditMode && onSelectTeacher?.(teacher)}
                        className="group h-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[32px] p-6 shadow-xs hover:shadow-xl hover:border-indigo-400 transition-all cursor-pointer flex flex-col justify-between gap-5 relative overflow-hidden"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative w-20 h-20 rounded-3xl overflow-hidden bg-slate-100 border-2 border-indigo-100 shrink-0 shadow-md group-hover:scale-105 transition-transform">
                            <img
                              src={
                                teacher.avatarUrl ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'
                              }
                              alt={teacher.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                              teacher.gender === 'أنثى'
                                ? 'bg-pink-50 text-pink-800 border-pink-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              <Award className={`w-3 h-3 ${teacher.gender === 'أنثى' ? 'text-pink-500' : 'text-amber-500'}`} />
                              <span>{teacher.gender === 'أنثى' ? '👩‍🏫 معلمة معتمدة بالمنصة' : '👨‍🏫 معلم معتمد بالمنصة'}</span>
                            </span>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                              {teacher.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg">
                                📚 {teacher.subject || 'مادة علمية'}
                              </span>
                              {teacher.schoolYear && (
                                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                                  🎓 {teacher.schoolYear}
                                </span>
                              )}
                              {teacher.specialty &&
                                !(teacher.schoolYear?.includes('الابتدائي') || teacher.schoolYear?.includes('الإعدادي')) && (
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                  🎯 {teacher.specialty}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            الكورسات المنشورة:{' '}
                            <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                              {teacherCourseCount} كورس
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {currentUser?.role === 'admin' && onDeleteTeacher && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTeacherPendingDelete(teacher);
                                }}
                                className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 font-black text-xs transition-all flex items-center gap-1 cursor-pointer"
                                title="حذف المدرس وكورساته نهائياً"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف المدرس 🗑️</span>
                              </button>
                            )}
                            <span className="px-4 py-2 rounded-xl bg-slate-900 group-hover:bg-indigo-600 text-white font-black text-xs transition-colors flex items-center gap-1.5 shadow-xs">
                              <span>استعراض الكورسات</span>
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </ScrollRevealItem>
                  );
                })}
              </div>

              {teacherPendingDelete && (
                <div
                  onClick={() => setTeacherPendingDelete(null)}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white border border-slate-200 rounded-[28px] w-full max-w-md shadow-2xl p-6 space-y-4 text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">تأكيد حذف المدرس وكورساته</h4>
                        <p className="text-xs text-slate-500">سيتم حذف حساب المدرس وجميع كورساته من المنصة نهائياً</p>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900">
                      هل أنت متأكد من حذف حساب <strong>{teacherPendingDelete.name}</strong> وجميع الكورسات الخاصة به؟
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setTeacherPendingDelete(null)}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = teacherPendingDelete;
                          setTeacherPendingDelete(null);
                          onDeleteTeacher?.(target);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>تأكيد الحذف النهائي 🗑️</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        );

      case 'courses':
        return (
          <div key="courses" className={wrapperClass}>
            {renderAdminControls()}
            <section className="space-y-6">
              <ScrollRevealItem disabled={isVisualEditMode}>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-black text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-full mb-2 border border-indigo-100">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>الكورسات والمواد الدراسية</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                      {activeSettings.coursesSectionTitle || 'استكشف الكورسات حسب صفك الدراسي'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      {activeSettings.coursesSectionSubtitle || 'اختر سنتك الدراسية وتصفح الكورسات المتكاملة وبنوك الامتحانات المتسلسلة'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
                    {(
                      [
                        { id: 'all', label: 'جميع الصفوف' },
                        { id: 'primary', label: 'الابتدائية (1-6)' },
                        { id: 'prep', label: 'الإعدادية (1-3)' },
                        { id: 'secondary', label: 'الثانوية (1-3)' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedGradeFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          selectedGradeFilter === tab.id
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <select
                      value={selectedGradeFilter}
                      onChange={(e) => setSelectedGradeFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200 focus:outline-none cursor-pointer"
                    >
                      <option value="all">اختر صفاً محدداً (1 ابتدائي - 3 ثانوي)...</option>
                      
                      
                      <optgroup label="المرحلة الثانوية">
                        <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                        <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                        <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </ScrollRevealItem>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHomeCourses.slice(0, 6).map((course, idx) => {
                  const enrolled = isCourseEnrolled(course.id);
                  const totalLessonsCount = course.lessons?.length || 0;
                  const totalVideosCount =
                    course.lessons?.reduce((sum, l) => sum + (l.videos?.length || 0), 0) || 0;
                  const totalExamsCount =
                    (course.exams?.length || 0) +
                    (course.lessons?.reduce((sum, l) => sum + (l.exams?.length || 0), 0) || 0);
                  const hasDiscount =
                    typeof course.originalPrice === 'number' &&
                    course.originalPrice > course.price &&
                    course.originalPrice > 0;
                  const discountPercent = hasDiscount
                    ? course.discountPercentage && course.discountPercentage > 0
                      ? Math.round(course.discountPercentage)
                      : Math.round(((course.originalPrice! - course.price) / course.originalPrice!) * 100)
                    : 0;

                  return (
                    <ScrollRevealItem
                      key={course.id}
                      delayIndex={(idx % 3) + 1}
                      disabled={isVisualEditMode}
                    >
                      <div
                        onClick={() => !isVisualEditMode && onSelectCourse(course)}
                        className="group h-full bg-white border border-slate-200/90 rounded-[32px] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                            <img
                              src={course.coverImage}
                              alt={`كورس ${course.title} - ${course.schoolYear} - ${course.subject}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=800&auto=format&fit=crop';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                            <div className="absolute top-4 right-4 left-4 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-indigo-600/95 text-white backdrop-blur-md shadow-sm">
                                  {course.schoolYear}
                                </span>
                                {course.division &&
                                  !(course.schoolYear?.includes('الابتدائي') || course.schoolYear?.includes('الإعدادي')) && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400/95 text-slate-950 backdrop-blur-md shadow-sm">
                                    {course.division}
                                  </span>
                                )}
                              </div>

                              {enrolled ? (
                                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500 text-white flex items-center gap-1 shadow-sm">
                                  <Unlock className="w-3 h-3" />
                                  <span>مفتوح</span>
                                </span>
                              ) : hasDiscount ? (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 text-white border border-white/15 shadow-md">
                                  <span className="text-[10px] font-bold text-rose-300 line-through decoration-rose-400 decoration-2">
                                    {course.originalPrice} ج.م
                                  </span>
                                  <span className="text-xs font-black text-emerald-400">
                                    {course.price === 0 ? 'مجاني' : `${course.price} ${course.priceCurrency}`}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black">
                                    -{discountPercent}%
                                  </span>
                                </div>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm">
                                  <Key className="w-3 h-3" />
                                  <span>{course.price} {course.priceCurrency}</span>
                                </span>
                              )}
                            </div>

                            <div className="absolute bottom-3 right-4 left-4 flex items-center justify-between text-white">
                              <span className="text-xs font-bold text-amber-300 bg-slate-900/70 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                                {course.subject}
                              </span>
                              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                                {totalLessonsCount > 0 ? `${totalLessonsCount} دروس • ${totalVideosCount} فيديو` : `${totalExamsCount} امتحانات`}
                              </span>
                            </div>
                          </div>

                          <div className="p-6 space-y-3">
                            <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
                              {course.title}
                            </h3>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {course.description}
                            </p>

                            {hasDiscount && (
                              <div className="p-2.5 rounded-2xl bg-gradient-to-l from-rose-50 via-amber-50/60 to-emerald-50 border border-rose-200/80 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-400 line-through decoration-rose-500 decoration-2">
                                    {course.originalPrice} {course.priceCurrency || 'ج.م'}
                                  </span>
                                  <span className="text-base font-black text-emerald-700">
                                    {course.price === 0 ? 'مجاني' : `${course.price} ${course.priceCurrency || 'ج.م'}`}
                                  </span>
                                </div>
                                <span className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-black shadow-xs">
                                  خصم {discountPercent}% 🔥
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500 font-bold truncate">
                            إشراف: <span className="text-slate-800">{course.instructor}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {enrolled ? (
                              <span className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3.5 h-3.5" />
                                <span>مشترك بالكورس</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isVisualEditMode) return;
                                  if (onEnrollCourse) {
                                    onEnrollCourse(course);
                                  } else {
                                    onSelectCourse(course);
                                  }
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-300" />
                                <span>اشتراك في الكورس</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollRevealItem>
                  );
                })}
              </div>
            </section>
          </div>
        );

      case 'competitions':
        return (
          <div key="competitions" className={wrapperClass}>
            {renderAdminControls()}
            <ScrollRevealItem disabled={isVisualEditMode}>
              <section className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 rounded-[40px] p-8 sm:p-12 text-white shadow-xl border border-indigo-900/40 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>المسابقات العلمية المجانية لجميع الصفوف</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black">
                      {activeSettings.competitionsSectionTitle || 'تحديات ومسابقات أوائل الطلبة 🏆'}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                      {activeSettings.competitionsSectionSubtitle || 'شارك مجاناً في المسابقات الدورية التي ينظمها المشرف وتصدر لوحة الشرف'}
                    </p>
                  </div>

                  <button
                    onClick={() => !isVisualEditMode && onNavigate('competitions')}
                    className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
                  >
                    <span>دخول ساحة المسابقات</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {publishedCompetitions.map((comp, idx) => (
                    <ScrollRevealItem key={comp.id} delayIndex={(idx % 2) + 1} disabled={isVisualEditMode}>
                      <div
                        onClick={() => !isVisualEditMode && onSelectCompetition(comp)}
                        className="h-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-6 transition-all cursor-pointer flex flex-col justify-between space-y-5 group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              مسابقة مجانية متاحة للجميع
                            </span>
                            <span className="text-xs text-slate-300 flex items-center gap-1 font-bold">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>{comp.durationMinutes} دقيقة</span>
                            </span>
                          </div>

                          <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors">
                            {comp.title}
                          </h3>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {comp.description}
                          </p>

                          {comp.prizeInfo && (
                            <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/25 text-amber-300 text-xs font-bold flex items-center gap-2">
                              <Award className="w-4 h-4 shrink-0 text-amber-400" />
                              <span>الجائزة: {comp.prizeInfo}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-bold">
                            الصف المستهدف: <strong className="text-white">{comp.schoolYear}</strong>
                          </span>
                          <span className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 group-hover:bg-amber-300 transition-all">
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>ابدأ التحدي الآن</span>
                          </span>
                        </div>
                      </div>
                    </ScrollRevealItem>
                  ))}
                </div>
              </section>
            </ScrollRevealItem>
          </div>
        );

      case 'features':
        return (
          <div key="features" className={wrapperClass}>
            {renderAdminControls()}
            <ScrollRevealItem disabled={isVisualEditMode}>
              <section className="bg-white border border-slate-200 rounded-[40px] p-8 sm:p-12 shadow-xs">
                <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    {activeSettings.featuresSectionTitle || `لماذا تختار ${activeSettings.platformName}؟`}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {activeSettings.featuresSectionSubtitle || 'منظومة تعليمية متكاملة مصممة لضمان التزام الطالب وتحقيق أعلى الدرجات'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {featuresList.map((feat, idx) => (
                    <ScrollRevealItem
                      key={idx}
                      delayIndex={idx + 1}
                      disabled={isVisualEditMode}
                      className="p-6 rounded-3xl bg-slate-50 border border-slate-200/70 space-y-3"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                        {idx === 0 ? <Lock className="w-6 h-6" /> : idx === 1 ? <Key className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                      </div>
                      <h3 className="text-base font-black text-slate-900">{feat.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{feat.desc}</p>
                    </ScrollRevealItem>
                  ))}
                </div>
              </section>
            </ScrollRevealItem>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-12 pb-28">
      {/* Render All Ordered Sections with "+ Add Here" buttons in between when in Visual Edit Mode */}
      {renderInsertHereButton(0)}
      {sectionsList.map((sec, idx) => (
        <React.Fragment key={sec.id}>
          {renderSection(sec, idx)}
          {renderInsertHereButton(idx + 1)}
        </React.Fragment>
      ))}

      {/* FIXED BOTTOM BUTTONS FOR VISUAL EDIT MODE ONLY */}
      {isVisualEditMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl pointer-events-none flex flex-col items-center gap-2">
          {saveToast && (
            <div className="pointer-events-auto px-5 py-2.5 rounded-2xl bg-emerald-600 text-white border border-emerald-400 text-xs font-black shadow-xl animate-bounce">
              {saveToast}
            </div>
          )}
          <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-xl border border-amber-400/50 rounded-2xl px-3 py-2.5 shadow-2xl flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddHeroItem('left_card')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>🖼️ + إضافة صور أو عناصر بالواجهة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingHeroBox(!editingHeroBox);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editingHeroBox ? 'إغلاق تعديل الواجهة' : '✏️ تعديل نصوص وصور البطاقة'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModalAtPosition(1)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ إضافة قسم (نص / صورة / فيديو) 🎬</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllChanges}
              className="px-4 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ التغييرات ✅</span>
            </button>

            {onExitVisualEditMode && (
              <button
                type="button"
                onClick={onExitVisualEditMode}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>العودة للأدمن</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal to Add / Edit Extra Item (Images / Videos / Text / Button) Directly Inside the Hero Section */}
      {showHeroExtraModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-8 flex items-center justify-center animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-2xl p-6 sm:p-8 space-y-5 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {editingHeroItemId ? 'تعديل العنصر في المنطقة الترحيبية' : 'إضافة صور أو عناصر أخرى في المنطقة الترحيبية'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    أضف صورة، فيديو، نص، أو زر تفاعلي ليظهر مباشرة داخل البانر الرئيسي العلوي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHeroExtraModal(false)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHeroExtraItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  موضع الظهور داخل المنطقة الترحيبية:
                </label>
                <select
                  value={heroItemPlacement}
                  onChange={(e) => setHeroItemPlacement(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="left_card">في جانب البطاقة اليسرى (أسفل بطاقة المشرف)</option>
                  <option value="right_column">في الجانب الأيمن (أسفل النص والأزرار)</option>
                  <option value="bottom_full">بعرض المنطقة الترحيبية بالكامل (أسفل النص والبطاقة معاً)</option>
                </select>
              </div>

              {/* Image Upload or URL */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                <label className="block font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>إرفاق صورة (رفع من جهازك أو رابط مباشر):</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={heroItemImageUrl.startsWith('data:') ? 'تم رفع الصورة من الجهاز ✅' : heroItemImageUrl}
                    onChange={(e) => setHeroItemImageUrl(e.target.value)}
                    placeholder="ضع رابط الصورة أو ارفعها من جهازك بالزر المجاور..."
                    className="flex-1 w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-[11px]"
                    dir="ltr"
                  />
                  <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة من جهازك 🖼️</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImageFile(file, 1200, 0.8).then((base64) => {
                            if (base64) setHeroItemImageUrl(base64);
                          });
                        }
                      }}
                    />
                  </label>
                  {heroItemImageUrl && (
                    <button
                      type="button"
                      onClick={() => setHeroItemImageUrl('')}
                      className="px-3 py-2.5 rounded-xl bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer"
                    >
                      مسح
                    </button>
                  )}
                </div>
                {heroItemImageUrl && (
                  <div className="max-h-40 overflow-hidden rounded-xl border border-emerald-200 bg-white p-1 flex justify-center">
                    <img src={heroItemImageUrl} alt="preview" className="max-h-36 object-contain" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    عنوان العنصر (اختياري):
                  </label>
                  <input
                    type="text"
                    value={heroItemTitle}
                    onChange={(e) => setHeroItemTitle(e.target.value)}
                    placeholder="مثال: جدول المراجعات أو تهنئة الأوائل"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    شارة صغيرة أعلى العنوان (اختياري):
                  </label>
                  <input
                    type="text"
                    value={heroItemBadge}
                    onChange={(e) => setHeroItemBadge(e.target.value)}
                    placeholder="مثال: هام جداً 🔥"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  نص أو وصف إضافي (اختياري):
                </label>
                <textarea
                  rows={2}
                  value={heroItemSubtitle}
                  onChange={(e) => setHeroItemSubtitle(e.target.value)}
                  placeholder="اكتب أي تفاصيل أو نصوص تريد إظهارها مع الصورة..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    رابط فيديو (اختياري - يوتيوب أو MP4):
                  </label>
                  <input
                    type="text"
                    value={heroItemVideoUrl}
                    onChange={(e) => setHeroItemVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-[11px]"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    نص زر التوجيه (اختياري):
                  </label>
                  <input
                    type="text"
                    value={heroItemButtonText}
                    onChange={(e) => setHeroItemButtonText(e.target.value)}
                    placeholder="مثال: اشترك الآن"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHeroExtraModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer shadow-md"
                >
                  {editingHeroItemId ? 'حفظ التعديلات ✅' : 'إضافة وحفظ في المنطقة الترحيبية الآن +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Page Modal to Add or Edit Text + Image + Video Block at Any Position */}
      {showAddBlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-8 flex items-center justify-center animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] w-full max-w-3xl p-6 sm:p-8 space-y-5 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {editingBlockId ? 'تعديل محتوى القسم المخصص' : 'إضافة نص أو صورة أو فيديو في الصفحة الرئيسية'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    يمكنك إضافة عنوان ونص، أو رفع صورة من جهازك، أو وضع رابط فيديو (يوتيوب / VCDN / MP4) ليشتغل في الصفحة الرئيسية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBlockModal(false)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomBlock} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>العنوان الرئيسي (اختياري):</span>
                  </label>
                  <input
                    type="text"
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    placeholder="مثال: فيديو تعريفي بالمنصة أو إعلان هام للطلاب"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                    شارة صغيرة أعلى العنوان (اختياري):
                  </label>
                  <input
                    type="text"
                    value={newBlockBadge}
                    onChange={(e) => setNewBlockBadge(e.target.value)}
                    placeholder="مثال: جديد وحصري ✨"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  النص أو الشرح التفصيلي (اختياري):
                </label>
                <textarea
                  rows={3}
                  value={newBlockSubtitle}
                  onChange={(e) => setNewBlockSubtitle(e.target.value)}
                  placeholder="اكتب أي نصوص أو تفاصيل تريد إظهارها للطلاب في هذا الجزء..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Image Upload or URL */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <label className="block font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>إضافة صورة في هذا الجزء (رفع من جهازك أو رابط مباشر):</span>
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={newBlockImageUrl.startsWith('data:') ? 'تم رفع صورة من الجهاز ✅' : newBlockImageUrl}
                    onChange={(e) => setNewBlockImageUrl(e.target.value)}
                    placeholder="ضع رابط الصورة هنا أو ارفعها من جهازك..."
                    className="flex-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-[11px]"
                    dir="ltr"
                  />
                  <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة من الجهاز 🖼️</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImageFile(file, 1200, 0.8).then((base64) => {
                            if (base64) setNewBlockImageUrl(base64);
                          });
                        }
                      }}
                    />
                  </label>
                  {newBlockImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewBlockImageUrl('')}
                      className="px-3 py-2.5 rounded-xl bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer"
                    >
                      مسح الصورة
                    </button>
                  )}
                </div>
                {newBlockImageUrl && (
                  <div className="max-h-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 flex justify-center">
                    <img src={newBlockImageUrl} alt="preview" className="max-h-36 object-contain" />
                  </div>
                )}
              </div>

              {/* Video URL or Upload */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
                <label className="block font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-indigo-600" />
                  <span>إضافة فيديو يعمل بمشغل المنصة (رابط يوتيوب / VCDN / Google Drive / MP4):</span>
                </label>
                <input
                  type="text"
                  value={newBlockVideoUrl}
                  onChange={(e) => setNewBlockVideoUrl(e.target.value)}
                  placeholder="مثال: https://www.youtube.com/watch?v=... أو vcdn:... أو رابط الفيديو"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-[11px]"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">نص الزر (اتركه فارغاً بدون زر):</label>
                  <input
                    type="text"
                    value={newBlockButtonText}
                    onChange={(e) => setNewBlockButtonText(e.target.value)}
                    placeholder="مثال: تصفح الكورسات"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">وجهة الزر عند الضغط:</label>
                  <select
                    value={newBlockTargetView}
                    onChange={(e) => setNewBlockTargetView(e.target.value as AppView)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="courses">صفحة الكورسات</option>
                    <option value="competitions">صفحة المسابقات</option>
                    <option value="signup">صفحة إنشاء حساب</option>
                    <option value="login">صفحة تسجيل الدخول</option>
                    <option value="forum">منتدى النقاش</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">لون خلفية القسم:</label>
                  <select
                    value={newBlockTheme}
                    onChange={(e) => setNewBlockTheme(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="indigo">أزرق ملكي داكن (Indigo)</option>
                    <option value="slate">أبيض فاتح كلاسيكي (Light Card)</option>
                    <option value="emerald">أخضر زمردي (Emerald)</option>
                    <option value="amber">ذهبي دافئ (Amber)</option>
                    <option value="rose">وردي داكن (Rose)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddBlockModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black cursor-pointer shadow-md"
                >
                  {editingBlockId ? 'حفظ تعديلات القسم ✅' : 'إضافة القسم في الصفحة الرئيسية الآن +'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Platform Theme Color Customizer Modal */}
      {showColorPickerModal && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">تخصيص ألوان أجزاء المنصة</h3>
                  <p className="text-xs text-slate-400">تحكم كامل في الألوان والأزرار وخلفيات المنصة</p>
                </div>
              </div>
              <button
                onClick={() => setShowColorPickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Primary Accent Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-300">لون الأزرار والعناصر الرئيسية (Gold/Accent)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customPrimaryColor}
                    onChange={(e) => setCustomPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-xl cursor-pointer bg-slate-800 border border-slate-700"
                  />
                  <input
                    type="text"
                    value={customPrimaryColor}
                    onChange={(e) => setCustomPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-300">لون الخلفية العامة للمنصة (Background)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    className="w-12 h-10 rounded-xl cursor-pointer bg-slate-800 border border-slate-700"
                  />
                  <input
                    type="text"
                    value={customBgColor}
                    onChange={(e) => setCustomBgColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 font-mono text-xs text-white"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-black text-slate-400">نماذج ألوان جاهزة بضغطة زر:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyColors('#d4af37', '#0d0824', '#ffffff')}
                    className="p-2 rounded-xl bg-[#0d0824] border border-[#d4af37]/60 text-xs font-bold text-amber-400 hover:scale-102 transition-transform"
                  >
                    🏛️ المتفلسفة الملكي (ذهبي ونيلي)
                  </button>
                  <button
                    onClick={() => applyColors('#f59e0b', '#0f172a', '#ffffff')}
                    className="p-2 rounded-xl bg-[#0f172a] border border-amber-500/60 text-xs font-bold text-amber-300 hover:scale-102 transition-transform"
                  >
                    🌌 كلاسيك داكن (Dark Slate)
                  </button>
                  <button
                    onClick={() => applyColors('#8b5cf6', '#090514', '#ffffff')}
                    className="p-2 rounded-xl bg-[#090514] border border-purple-500/60 text-xs font-bold text-purple-300 hover:scale-102 transition-transform"
                  >
                    🔮 بنفسجي ملكي عميق
                  </button>
                  <button
                    onClick={() => applyColors('#10b981', '#06130e', '#ffffff')}
                    className="p-2 rounded-xl bg-[#06130e] border border-emerald-500/60 text-xs font-bold text-emerald-300 hover:scale-102 transition-transform"
                  >
                    🌿 زمردي إسلامي
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  applyColors(customPrimaryColor, customBgColor, customTextColor);
                  setShowColorPickerModal(false);
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                تطبيق وحفظ الألوان الآن ✅
              </button>
              <button
                onClick={() => setShowColorPickerModal(false)}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
