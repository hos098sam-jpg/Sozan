import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Pin,
  Send,
  Heart,
  Search,
  Plus,
  ShieldCheck,
  User as UserIcon,
  Filter,
  CheckCircle2,
  Trash2,
  Share2,
  Sparkles,
  BookOpen,
  HelpCircle,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ForumPost, ForumReply, User } from '../types';

interface ForumViewProps {
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'signup' | 'parent') => void;
}

const STORAGE_KEY_FORUM = 'qalb_alam_forum_posts_live';

const INITIAL_FORUM_POSTS: ForumPost[] = [
  {
    id: 'post-admin-welcome',
    title: 'توجيهات المشرف العام: خطة العمل وتوزيع المناهج والامتحانات لدفعة 2027 🎯',
    content: 'أهلاً بكم جميعاً أبنائي وبناتي طلاب دفعة 2027 وأولياء الأمور الأفاضل. تم إعداد المنصة بنظام تسلسلي محكم، يضمن أن كل حصة يتبعها امتحان إلكتروني ونماذج مقالية مصححة بدقة. نرجو الالتزام بالجدول الأسبوعي وعدم مراكمة الدروس. الكنترول يتابع حضوركم وإجاباتكم لحظة بلحظة.',
    category: 'announcement',
    subjectName: 'توجيهات عامة',
    authorId: 'admin-main',
    authorName: 'إدارة المنصة',
    authorRole: 'admin',
    createdAt: 'اليوم • 09:30 صباحاً',
    isPinned: true,
    likesCount: 38,
    likedBy: [],
    viewsCount: 245,
    replies: [
      {
        id: 'reply-1',
        authorId: 'student-seed-1',
        authorName: 'عمر خالد المنشاوي',
        authorRole: 'student',
        content: 'شكراً جزيلاً يا إدارة المنصة، النظام التسلسلي ممتاز جداً وبيشجعنا نذاكر أول بأول وما نراكمش أي محاضرة.',
        createdAt: 'اليوم • 10:15 صباحاً',
        likesCount: 12,
      },
      {
        id: 'reply-2',
        authorId: 'admin-main',
        authorName: 'إدارة المنصة',
        authorRole: 'admin',
        content: 'بالتوفيق يا بطل، ومستعدين لأي سؤال تواجهك في الامتحانات أو الشرح.',
        createdAt: 'اليوم • 11:00 صباحاً',
        isAdminVerified: true,
        likesCount: 18,
      },
    ],
  },
  {
    id: 'post-student-calc',
    title: 'سؤال في مسائل الاتزان الكيميائي وقوانين لوشاتيليه 🧪',
    content: 'يا شباب وأستاذنا الفاضل، عندي استفسار في تأثير زيادة الضغط على التفاعل الغازي لما يكون عدد مولات المتفاعلات مساوياً لعدد مولات النواتج. هل يؤثر على موضع الاتزان أو قيمة ثابت الاتزان؟',
    category: 'academic',
    subjectName: 'الكيمياء',
    authorId: 'student-seed-2',
    authorName: 'مريم أحمد عبد الرحمن',
    authorRole: 'student',
    createdAt: 'منذ ساعتين',
    isPinned: false,
    likesCount: 15,
    likedBy: [],
    viewsCount: 112,
    replies: [
      {
        id: 'reply-chem-admin',
        authorId: 'admin-main',
        authorName: 'إدارة المنصة',
        authorRole: 'admin',
        content: 'إجابة نموذجية: عندما يتساوى عدد مولات الغازات في طرفي المعادلة (المتفاعلات والنواتج)، فإن تغير الضغط لا يؤثر إطلاقاً على موضع الاتزان ولا يزيح التفاعل لأي اتجاه، كما أن قيمة ثابت الاتزان (Kc) لا تتغير إلا بتغير درجة الحرارة فقط.',
        createdAt: 'منذ ساعة',
        isAdminVerified: true,
        likesCount: 24,
      },
    ],
  },
  {
    id: 'post-student-tips',
    title: 'نصيحة لتنظيم وقت المذاكرة اليومي لدفعة الثانوية 2027 ⏰',
    content: 'حبيت أشارك معاكم طريقتي بعد توجيهات الإدارة المنصة: تقسيم اليوم لفترات 50 دقيقة مذاكرة و10 دقائق راحة، مع حل امتحان الكورس في نفس اليوم مباشرة قبل النوم. فرقت جداً في تثبيت المعلومة!',
    category: 'discussion',
    subjectName: 'تنظيم المذاكرة',
    authorId: 'student-seed-3',
    authorName: 'يوسف محمود الشناوي',
    authorRole: 'student',
    createdAt: 'منذ 4 ساعات',
    isPinned: false,
    likesCount: 22,
    likedBy: [],
    viewsCount: 189,
    replies: [],
  },
];

export const ForumView: React.FC<ForumViewProps> = ({ currentUser, onOpenAuth }) => {
  const [posts, setPosts] = useState<ForumPost[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FORUM);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_FORUM_POSTS;
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({
    'post-admin-welcome': true,
    'post-student-calc': true,
  });

  // Reply inputs state
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // New post form state
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<'announcement' | 'academic' | 'subject' | 'discussion' | 'exam'>('academic');
  const [newPostSubject, setNewPostSubject] = useState('عام');
  const [newPostIsPinned, setNewPostIsPinned] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FORUM, JSON.stringify(posts));
    } catch (e) {
      console.error(e);
    }
  }, [posts]);

  // Toggle post expanded
  const toggleExpand = (postId: string) => {
    setExpandedPostIds((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  // Like post
  const handleLikePost = (postId: string) => {
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const userId = currentUser.id || currentUser.phone;
          const alreadyLiked = p.likedBy?.includes(userId);
          const updatedLikedBy = alreadyLiked
            ? (p.likedBy || []).filter((id) => id !== userId)
            : [...(p.likedBy || []), userId];

          return {
            ...p,
            likesCount: alreadyLiked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1,
            likedBy: updatedLikedBy,
          };
        }
        return p;
      })
    );
  };

  // Submit reply
  const handleAddReply = (postId: string) => {
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }

    const text = (replyInputs[postId] || '').trim();
    if (!text) return;

    const newReply: ForumReply = {
      id: `reply-${Date.now()}`,
      authorId: currentUser.id || currentUser.phone,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      content: text,
      createdAt: 'الآن',
      isAdminVerified: currentUser.role === 'admin',
      likesCount: 0,
    };

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            replies: [...p.replies, newReply],
          };
        }
        return p;
      })
    );

    setReplyInputs((prev) => ({ ...prev, [postId]: '' }));
    setExpandedPostIds((prev) => ({ ...prev, [postId]: true }));
  };

  // Delete post (Admin only)
  const handleDeletePost = (postId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (window.confirm('هل تريد حذف هذا الموضوع من المنتدى؟')) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  // Toggle Pin post (Admin only)
  const handleTogglePin = (postId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isPinned: !p.isPinned } : p))
    );
  };

  // Submit new post
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }

    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    const newPost: ForumPost = {
      id: `post-${Date.now()}`,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      category: currentUser.role === 'admin' ? newPostCategory : 'academic',
      subjectName: newPostSubject.trim() || 'عام',
      authorId: currentUser.id || currentUser.phone,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      createdAt: 'الآن',
      isPinned: currentUser.role === 'admin' && newPostIsPinned,
      replies: [],
      likesCount: 0,
      likedBy: [],
      viewsCount: 1,
    };

    setPosts((prev) => [newPost, ...prev]);
    setIsNewPostModalOpen(false);
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostSubject('عام');
    setNewPostIsPinned(false);
  };

  // Filtered posts
  const filteredPosts = posts
    .filter((p) => {
      if (activeCategory === 'all') return true;
      return p.category === activeCategory;
    })
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        (p.subjectName && p.subjectName.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      // Pinned posts always stay on top
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const categories = [
    { id: 'all', label: 'جميع المناقشات', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'announcement', label: 'إعلانات الإدارة 📢', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'academic', label: 'أسئلة واستفسارات الطلاب ❓', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'subject', label: 'مناقشات المواد الدراسية 📚', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'discussion', label: 'تنظيم المذاكرة والنصائح 💡', icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Forum Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                ملتقى الطلاب والإدارة 2027
              </span>
              <span className="text-xs text-indigo-300 font-medium">
                بإشراف إدارة المنصة
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              منتدى المنصة التعليمي التفاعلي 💬
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              المساحة المعتمدة للتواصل المباشر بين المشرف العام وإدارة الكنترول وأبنائنا الطلاب.
              اطرح أسئلتك، شارك استفسارات الامتحانات، وتابع التوجيهات الرسمية أولاً بأول.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenAuth('login');
                } else {
                  setIsNewPostModalOpen(true);
                }
              }}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>طرح سؤال أو موضوع جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في المنتدى والأسئلة..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-black text-slate-800 dark:text-slate-200 text-base">لا توجد مناقشات مطابقة</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              كن أول من يطرح سؤالاً أو استفساراً دراسياً في هذا القسم.
            </p>
            <button
              onClick={() => {
                if (!currentUser) onOpenAuth('login');
                else setIsNewPostModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة موضوع جديد</span>
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isExpanded = expandedPostIds[post.id] ?? false;
            const hasLiked = currentUser
              ? post.likedBy?.includes(currentUser.id || currentUser.phone)
              : false;

            return (
              <div
                key={post.id}
                className={`rounded-3xl transition-all border ${
                  post.isPinned
                    ? 'bg-gradient-to-b from-amber-50/70 to-white dark:from-amber-950/20 dark:to-slate-900 border-amber-300 dark:border-amber-700/80 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-md'
                }`}
              >
                {/* Post Header */}
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${
                          post.authorRole === 'admin'
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 dark:ring-amber-600'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {post.authorRole === 'admin' ? (
                          <ShieldCheck className="w-5 h-5" />
                        ) : (
                          (post.authorName || 'م').charAt(0)
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900 dark:text-white">
                            {post.authorName || 'مستخدم المنصة'}
                          </span>
                          {post.authorRole === 'admin' && (
                            <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                              <span>المشرف العام</span>
                              👑
                            </span>
                          )}
                          {post.isPinned && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                              <Pin className="w-2.5 h-2.5" />
                              <span>مثبت من الإدارة</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{post.createdAt}</span>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            قسم: {post.subjectName || 'عام'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Admin Controls */}
                    {currentUser?.role === 'admin' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePin(post.id)}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${
                            post.isPinned
                              ? 'text-amber-600 bg-amber-100 dark:bg-amber-950/60'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                          }`}
                          title={post.isPinned ? 'إلغاء التثبيت' : 'تثبيت الموضوع'}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="حذف الموضوع"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title & Body */}
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                    {post.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                    {post.content}
                  </p>

                  {/* Actions bar (Like, Replies count, Expand) */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors ${
                          hasLiked
                            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        <span>{post.likesCount} إعجاب</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(post.id)}
                        className="px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-4 h-4 text-indigo-500" />
                        <span>{post.replies.length} ردود ومناقشات</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium">
                      منصة دفعة 2027
                    </span>
                  </div>
                </div>

                {/* Collapsible Replies Section */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-3xl border-t border-slate-100 dark:border-slate-800 space-y-4">
                    {/* Replies List */}
                    {post.replies.length > 0 && (
                      <div className="space-y-3">
                        {post.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`p-3.5 rounded-2xl text-xs transition-all ${
                              reply.authorRole === 'admin'
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs">{reply.authorName}</span>
                                {reply.authorRole === 'admin' && (
                                  <span className="text-[9px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>رد الإدارة المعتمد ⭐</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">{reply.createdAt}</span>
                            </div>
                            <p className="leading-relaxed font-medium whitespace-pre-line text-xs">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Reply Box */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        value={replyInputs[post.id] || ''}
                        onChange={(e) =>
                          setReplyInputs({ ...replyInputs, [post.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddReply(post.id);
                          }
                        }}
                        placeholder={
                          currentUser?.role === 'admin'
                            ? 'اكتب رد الإدارة والتوجيه المعتمد...'
                            : 'اكتب تعليقك أو استفسارك هنا...'
                        }
                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={() => handleAddReply(post.id)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Post Modal */}
      {isNewPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 text-right space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">طرح سؤال أو موضوع جديد</h3>
                  <p className="text-[11px] text-slate-500">منتدى منصة قلب العلم التعليمية</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewPostModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان الموضوع / السؤال:
                </label>
                <input
                  type="text"
                  required
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="مثال: استفسار حول حل مسألة في مادة..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    القسم / المادة:
                  </label>
                  <select
                    value={newPostSubject}
                    onChange={(e) => setNewPostSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="عام">عام وتوجيهات</option>
                    <option value="اللغة العربية">اللغة العربية</option>
                    <option value="اللغة الإنجليزية">اللغة الإنجليزية</option>
                    <option value="الرياضيات">الرياضيات</option>
                    <option value="الفيزياء">الفيزياء</option>
                    <option value="الكيمياء">الكيمياء</option>
                    <option value="الأحياء">الأحياء</option>
                    <option value="الجيولوجيا">الجيولوجيا</option>
                    <option value="التاريخ والجغرافيا">التاريخ والجغرافيا</option>
                    <option value="الفلسفة وعلم النفس">الفلسفة وعلم النفس</option>
                  </select>
                </div>

                {currentUser?.role === 'admin' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نوع المنشور:
                    </label>
                    <select
                      value={newPostCategory}
                      onChange={(e) => setNewPostCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="announcement">إعلان إداري رسمي 📢</option>
                      <option value="academic">سؤال وتوجيه أكاديمي</option>
                      <option value="discussion">نصائح ومناقشة عامة</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص المشاركة أو تفاصيل السؤال:
                </label>
                <textarea
                  required
                  rows={4}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="اكتب سؤالك أو مشاركتك بوضوح..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                />
              </div>

              {currentUser?.role === 'admin' && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-600">
                  <input
                    type="checkbox"
                    checked={newPostIsPinned}
                    onChange={(e) => setNewPostIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>تثبيت هذا الموضوع في قمة المنتدى لجميع الطلاب 📌</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewPostModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>نشر الموضوع الآن</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
