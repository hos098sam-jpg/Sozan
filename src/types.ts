export type BacBranch = 'scientific' | 'literary';

export type SchoolYearGrade = 
  | 'الصف الأول الابتدائي'
  | 'الصف الثاني الابتدائي'
  | 'الصف الثالث الابتدائي'
  | 'الصف الرابع الابتدائي'
  | 'الصف الخامس الابتدائي'
  | 'الصف السادس الابتدائي'
  | 'الصف الأول الإعدادي'
  | 'الصف الثاني الإعدادي'
  | 'الصف الثالث الإعدادي'
  | 'الصف الأول الثانوي'
  | 'الصف الثاني الثانوي'
  | 'الصف الثالث الثانوي'
  | 'بكالوريا 2027 (علمي)'
  | 'بكالوريا 2027 (أدبي)'
  | string;

export interface TeacherPermissions {
  viewEnrollmentCount: true;
  viewStudentExamScores: true;
  gradeEssayAnswers: true;
}

export const TEACHER_PERMISSIONS: TeacherPermissions = {
  viewEnrollmentCount: true,
  viewStudentExamScores: true,
  gradeEssayAnswers: true,
};

export type AssistantSpecialty = 'student_support' | 'essay_grading' | 'content_management';

export interface User {
  id: string;
  uid?: string;
  name: string;
  firstName?: string;
  secondName?: string;
  thirdName?: string;
  lastName?: string;
  nationalId?: string;
  governorate?: string;
  phone: string;
  parentPhone: string;
  fatherPhone?: string;
  motherPhone?: string;
  schoolName?: string;
  parentJob?: string;
  educationSystem?: string;
  division?: 'شعبة علمي علوم' | 'شعبة علمي رياضة' | 'شعبة أدبي' | string;
  religion?: string;
  gender?: 'ذكر' | 'أنثى' | string;
  email?: string;
  emailVerified?: boolean;
  password?: string;
  schoolYear: string;
  role: 'student' | 'admin' | 'parent' | 'teacher' | 'assistant';
  authProvider?: 'whatsapp' | 'email' | 'parent' | 'phone';
  teacherPermissions?: TeacherPermissions;
  status?: 'active' | 'pending' | 'rejected' | 'approved';
  // Teacher-specific properties
  subject?: string; // المادة (فيزياء، كيمياء، أحياء، إلخ)
  specialty?: string; // التخصص (علمي علوم، علمي رياضة، أدبي، عام)
  avatarUrl?: string; // الصورة الشخصية للمعلم
  accountNumber?: string; // رقم الحساب أو الهاتف للدخول
  teacherBio?: string;
  // Teaching Assistant properties
  isAssistant?: boolean;
  assistantSpecialty?: AssistantSpecialty;
  assistantForTeacherId?: string;
  assistantForTeacherName?: string;
  registeredAt: string;
  enrolledCourseIds?: string[];
  activeSessionId?: string; // لمعرفة الجلسة النشطة ومنع فتح الحساب على أكثر من جهاز في وقت واحد
  currentDeviceId?: string; // معرف الجهاز المقترن حالياً لمنع مشاركة الحسابات
  currentDeviceName?: string; // وصف الجهاز (نظام التشغيل والمتصفح)
  deviceChangesHistory?: Array<{
    deviceId: string;
    deviceName?: string;
    changedAt: string;
    ipAddress?: string;
    isChange?: boolean;
    type?: string;
  }>; // سجل تغيير الأجهزة (بحد أقصى مرتان شهرياً)
  isOnline?: boolean;
  lastLoginAt?: string;
  linkedStudentId?: string;
  linkedStudents?: User[];
  guardianVerified?: boolean;
  guardianVerifiedPhone?: string;
  guardianVerifiedAt?: string;
  completedVideos?: Record<string, boolean>; // سجل الفيديوهات المكتملة للطالب
  examResults?: Record<string, {
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    status?: 'submitted' | 'under_review' | 'graded';
    completedAt: string;
    startedAt?: string;
    submittedAt?: string;
    durationTakenSeconds?: number;
    durationTakenFormatted?: string;
    attemptsCount?: number;
    maxAttempts?: number;
  }>;
  walletBalance?: number; // رصيد محفظة الطالب بالمنصة (بالجنيه المصري)
  walletTransactions?: WalletTransaction[]; // سجل عمليات الشحن والخصم بمحفظة الطالب
  referralCode?: string; // كود دعوة الأصدقاء الخاص بالطالب
  redeemedReferralCode?: string; // كود الدعوة الذي استخدمه الطالب
  referralsCount?: number; // عدد الأصدقاء الذين دعاهم الطالب
  referralEarnings?: number; // إجمالي أرباح الطالب من دعوة الأصدقاء
  videoNotes?: Record<string, VideoTimestampNote[]>; // ملاحظات الطالب الزمنية تحت الفيديوهات
}

export interface VideoTimestampNote {
  id: string;
  videoId: string;
  timestampSeconds: number;
  timestampFormatted: string;
  noteText: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  type: 'recharge_code' | 'admin_topup' | 'course_purchase' | 'referral_bonus';
  amount: number;
  balanceAfter: number;
  description: string;
  codeUsed?: string;
  courseId?: string;
  courseTitle?: string;
  createdAt: string;
}

export interface WalletRechargeCode {
  code: string;
  amount: number;
  isUsed: boolean;
  usedByStudentId?: string;
  usedByStudentName?: string;
  usedByStudentPhone?: string;
  createdAt: string;
  usedAt?: string;
  notes?: string;
}

export interface SubjectInfo {
  id: string;
  name: string;
  iconName: string;
  branch: 'scientific' | 'literary' | 'both';
  color: string;
  chapters: string[];
  quickFormulas?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  subject?: string;
  isIdentityAnswer?: boolean;
}

export interface SummaryResult {
  topic: string;
  subject: string;
  branch: BacBranch;
  content: string;
}

export interface ExamResult {
  id: string;
  subject: string;
  chapter: string;
  difficulty: string;
  content: string;
  timestamp: string;
}

export interface ProblemSolution {
  problemText: string;
  subject: string;
  content: string;
}

export interface StudyPlanResult {
  branch: string;
  hours: number;
  focus: string;
  content: string;
}

export interface BookLesson {
  id: string;
  lessonNumber: number;
  title: string;
  keyConcepts: string[];
  pageRange?: string;
  summary?: string;
}

export interface BookAnalysisResult {
  bookTitle: string;
  subject: string;
  branch: BacBranch;
  overview: string;
  totalLessons: number;
  lessons: BookLesson[];
}

export interface ExamQuestion {
  id: string;
  type: 'mcq' | 'essay';
  questionText: string;
  questionImage?: string; // صورة السؤال (رابط أو base64)
  marks: number;
  options?: string[]; // 4 choices for MCQ
  optionImages?: string[]; // Optional image for each MCQ choice
  correctOptionIndex?: number; // 0, 1, 2, 3 (تحديد الإجابة الصح)
  modelAnswer: string;
  modelAnswerImage?: string; // صورة الإجابة النموذجية المعتمدة
  bookReference?: string;
  rubricCriteria?: string[]; // Checklist for essay grading
}

export interface CourseExam {
  id: string;
  courseId: string;
  title: string;
  lessonTitle: string;
  order: number; // 1, 2, 3... used for sequential lock
  durationMinutes: number;
  passingPercentage: number; // default 60%
  maxAttempts?: number; // Maximum attempts per student; defaults to 1
  isPublished: boolean;
  questions: ExamQuestion[];
  bookReference?: string;
  createdAt: string;
  isManual?: boolean;
}

export interface CourseAccessCode {
  code: string;
  courseId: string;
  courseTitle: string;
  teacherName?: string;
  isUsed: boolean;
  usedByStudentId?: string;
  usedByStudentName?: string;
  usedByStudentPhone?: string;
  createdAt: string;
  usedAt?: string;
  notes?: string;
}

export type CourseType = 'integrated' | 'exams_only' | 'revision';

export interface LessonVideo {
  id: string;
  title: string;
  url: string; // YouTube, MP4, Vimeo, Google Drive, or embed link
  duration?: string; // e.g. "35 دقيقة"
  description?: string;
  order: number;
  quiz?: CourseExam; // كويز اختباري خاص بهذا الفيديو يوضع تحته مباشرة
  quizId?: string;
  // VCDN & Platform Video Integration
  sourceType?: 'url' | 'vcdn' | 'avcaption' | 'streamtape' | 'pixeldrain' | 'onedrive';
  vcdnVideoId?: string;
  vcdnStatus?: 'uploading' | 'processing' | 'ready' | 'failed';
  vcdnThumbnailUrl?: string;
  fileSize?: number;
}

export interface LessonPdf {
  id: string;
  title: string;
  fileUrl: string; // PDF link or uploaded base64
  pageCount?: number;
  fileSize?: string;
  description?: string;
  order: number;
}

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  order: number;
  videos: LessonVideo[];
  pdfs: LessonPdf[];
  exams: CourseExam[];
}

export interface Course {
  accessCode?: string;
  id: string;
  title: string; // اسم الكورس
  courseType?: CourseType; // نوع الكورس: شرح متكامل / امتحانات فقط / مراجعة
  schoolYear: string; // السنة الدراسية
  division?: 'شعبة علمي علوم' | 'شعبة علمي رياضة' | 'شعبة أدبي' | 'عام لجميع الشعب' | string; // الشعبة
  coverImage: string; // صورة للكورس
  price: number; // تحديد السعر الحالي بعد الخصم إن وجد (0 = مجاني)
  originalPrice?: number; // السعر القديم قبل الخصم (يظهر مشطوباً عليه للطلاب)
  discountPercentage?: number; // نسبة الخصم بالمية (%)
  priceCurrency: string;
  paymentPhone?: string; // رقم محفظة استلام الاشتراكات الخاص بالكورس (فودافون كاش / إنستا باي)
  paymentQrCode?: string; // صورة الباركود QR Code للمحفظة الخاصة بالكورس
  description: string;
  instructor: string;
  instructorId?: string; // ID المعلم صاحب الكورس
  teacherName?: string;
  teacherSubject?: string;
  subject: string;
  branch: BacBranch | 'both';
  isLocked?: boolean; // عدم فتح الكورس إلا بعد الاشتراك بالكود المولد من لوحة الإدارة
  lessons?: CourseLesson[]; // دروس الكورس المتكامل مع فيديوهات وملفات PDF وامتحانات لا نهائية
  exams: CourseExam[]; // امتحانات الكورس
  isPublished: boolean;
  requireSequentialLessons?: boolean;
  createdAt: string;
  updatedAt?: string | number;
}

export interface CompetitionParticipant {
  studentId: string;
  studentName: string;
  studentPhone: string;
  schoolYear: string;
  score: number;
  maxScore: number;
  percentage: number;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface Competition {
  id: string;
  title: string;
  schoolYear: string;
  durationMinutes: number;
  isFree: boolean; // Always free as requested
  description: string;
  prizeInfo?: string;
  isPublished: boolean;
  questions: ExamQuestion[];
  createdAt: string;
  leaderboard: CompetitionParticipant[];
  participantsCount?: number;
}

export interface HomeSectionConfig {
  id: string; // 'hero' | 'stats' | 'teachers' | 'courses' | 'competitions' | 'features' | 'custom_blocks' | 'block_...'
  label: string;
  visible: boolean;
}

export interface CustomHomeBlock {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  buttonText?: string;
  buttonTargetView?: AppView;
  imageUrl?: string;
  videoUrl?: string;
  videoSourceType?: 'url' | 'vcdn';
  vcdnVideoId?: string;
  sectionPosition?: string; // 'after_hero' | 'after_stats' | 'after_teachers' | 'after_courses' | 'after_competitions' | 'after_features' | 'standalone'
  themeColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}

export interface HeroExtraItem {
  id: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  imageUrl?: string;
  videoUrl?: string;
  buttonText?: string;
  buttonTargetView?: AppView;
  placement?: 'left_card' | 'right_column' | 'bottom_full';
}

export interface PlatformSettings {
  platformName: string;
  heroTitle: string;
  heroSubtitle: string;
  supervisorName: string;
  supervisorTitle: string;
  supervisorImage?: string;
  heroBannerImage: string;
  heroSideImage?: string;
  heroSideVideo?: string;
  heroExtraItems?: HeroExtraItem[];
  announcementText: string;
  contactPhone: string;
  supportWhatsapp: string;
  heroPrimaryButtonText?: string;
  heroSecondaryButtonText?: string;
  teachersSectionTitle?: string;
  teachersSectionSubtitle?: string;
  coursesSectionTitle?: string;
  coursesSectionSubtitle?: string;
  competitionsSectionTitle?: string;
  competitionsSectionSubtitle?: string;
  featuresSectionTitle?: string;
  featuresSectionSubtitle?: string;
  homeSections?: HomeSectionConfig[];
  customHomeBlocks?: CustomHomeBlock[];
  customStats?: { label: string; value: string }[];
  customFeatures?: { title: string; desc: string }[];
}

export interface LessonExam {
  id: string;
  lessonId: string;
  lessonTitle: string;
  examNumber: 1 | 2 | 3;
  examLevelName: string;
  durationMinutes: number;
  totalMarks: number;
  questions: ExamQuestion[];
}

export interface EssayGradingResult {
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  feedback: string;
  strengths: string[];
  missingPoints: string[];
  improvementTip: string;
  modelAnswerImage?: string;
}

export interface EssayReviewItem {
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  feedback?: string;
  modelAnswerImage?: string; // Released to student after admin review
  isReviewed: boolean;
}

export interface StudentExamSubmission {
  submissionId?: string;
  examId: string;
  courseId?: string;
  courseTitle?: string;
  lessonTitle?: string;
  examTitle?: string;
  studentId?: string;
  studentName?: string;
  studentPhone?: string;
  parentPhone?: string;
  studentSchoolYear?: string;
  mcqAnswers: Record<string, number>;
  essayAnswers: Record<string, string>;
  essayAnswerImages?: Record<string, string>; // Student uploaded answer photo
  essayAnswerAudio?: Record<string, string>; // Voice answer recording
  essayAnswerTranscripts?: Record<string, string>; // Speech-to-text transcript
  isSubmitted: boolean;
  status?: 'submitted' | 'under_review' | 'graded'; // قيد المراجعة للأسئلة المقالية
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed?: boolean;
  essayGrades?: Record<string, EssayGradingResult>;
  essayReviews?: Record<string, EssayReviewItem>;
  startedAt?: string; // وقت وتاريخ الدخول
  submittedAt: string; // وقت وتاريخ الخروج / التسليم
  attemptNumber?: number;
  durationMinutes?: number;
  durationTakenSeconds?: number;
  durationTakenFormatted?: string; // e.g. "18 دقيقة و 40 ثانية"
  reviewedAt?: string;
  reviewedBy?: string;
  isCompetition?: boolean;
  competitionId?: string;
  tabSwitchesCount?: number; // عدد مرات محاولة الخروج من شاشة الامتحان (نظام منع الغش)
  autoSubmittedByAntiCheat?: boolean; // هل تم التسليم تلقائياً بسبب تجاوز تحذيرات الغش؟
}

export type AppView = 
  | 'home'
  | 'courses'
  | 'course_detail'
  | 'my_courses'
  | 'forum'
  | 'my_account'
  | 'competitions'
  | 'competition_take'
  | 'exam_take'
  | 'login'
  | 'signup'
  | 'admin'
  | 'parent_portal'
  | 'student_dashboard'
  | 'teacher_dashboard'
  | 'teacher_add_course'
  | 'teacher_students'
  | 'teacher_progress'
  | 'teacher_grading'
  | 'teacher_profile'
  | 'assistant_workspace'
  | 'smart_tools'
  | 'notifications'
  | 'privacy'
  | 'terms';

export interface PlatformNotification {
  id: string;
  title: string;
  message: string;
  senderName: string;
  timestamp: string;
  priority?: 'normal' | 'urgent';
  target?: 'all' | 'students' | 'parents';
  read?: boolean;
}

export interface ForumReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'parent' | 'teacher' | 'assistant';
  content: string;
  createdAt: string;
  isAdminVerified?: boolean;
  likesCount?: number;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: 'announcement' | 'academic' | 'subject' | 'discussion' | 'exam';
  subjectName?: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'parent' | 'teacher' | 'assistant';
  createdAt: string;
  isPinned?: boolean;
  replies: ForumReply[];
  likesCount: number;
  likedBy?: string[];
  viewsCount?: number;
}

export type ActiveTab = 
  | 'tutor'       // المساعد الذكي والشرح المبسط
  | 'book_exams'  // رفع كتاب PDF والامتحانات التفاعلية والتصحيح الفوري
  | 'summarizer'  // تلخيص الدروس بدون حشو
  | 'exams'       // نماذج الامتحانات والحل النموذجي
  | 'solver'      // حل المسائل خطوة بخطوة
  | 'planner'     // منظم الجدول الدراسي
  | 'boost';      // الدعم النفسي والتحفيز

export interface Coupon {
  id: string;
  code: string; // كود الخصم (e.g. "ALELM2027")
  discountType: 'percentage' | 'fixed'; // نسبة مئوية % أو مبلغ ثابت بالجنيه
  discountValue: number; // قيمة الخصم (مثال: 20 لـ 20% أو 50 لـ 50 جنيه)
  maxUses?: number; // الحد الأقصى لمرات الاستخدام
  usedCount: number; // عدد مرات الاستخدام الفعلية
  courseIds?: string[]; // مخصص لكورسات معينة أو متاح للكل
  minCoursePrice?: number; // أدنى سعر للكورس للاستفادة من الخصم
  expiresAt?: string; // تاريخ انتهاء الصلاحية
  isActive: boolean; // فعال أو معطل
  createdAt: string;
  note?: string; // ملاحظة للمشرف
}

export interface WalletOrder {
  id: string; // e.g. ord_12345
  studentId: string;
  studentName: string;
  studentPhone: string;
  senderPhone: string; // رقم المحفظة المحوّل منها
  targetWallet: string; // "01040672314"
  courseId: string;
  courseTitle: string;
  bundleId?: string;
  bundleCourseIds?: string[];
  originalPrice: number;
  discountAmount: number;
  finalAmount: number; // المبلغ المطلوب تحويله
  couponCode?: string;
  transactionId?: string; // رقم العملية الفريد المكون من أرقام
  receiptImageUrl?: string; // صورة إيصال التحويل المرفوعة من الطالب (فودافون كاش / إنستا باي)
  paymentMethod?: 'vodafone_cash' | 'instapay';
  rawSmsText?: string;
  status: 'Pending' | 'Completed' | 'Rejected';
  createdAt: string;
  paidAt?: string;
  reviewedBy?: string;
  notes?: string;
}

export interface CourseBundle {
  id: string;
  title: string;
  description: string;
  schoolYear: string;
  division?: string;
  subject: string;
  instructor: string;
  instructorId?: string;
  coverImage?: string;
  courseIds: string[]; // قائمة الكورسات المشمولة داخل الباقة
  originalTotalPrice: number; // مجموع أسعار الكورسات الأصلية
  bundlePrice: number; // سعر الباقة المخفض
  discountPercentage: number; // نسبة التوفير %
  isPublished: boolean;
  createdAt: string;
}

export interface LessonQAReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'teacher' | 'assistant';
  content: string;
  imageUrl?: string;
  createdAt: string;
}

export interface LessonQAItem {
  id: string;
  courseId: string;
  courseTitle?: string;
  lessonId: string;
  lessonTitle?: string;
  videoId?: string;
  videoTitle?: string;
  studentId: string;
  studentName: string;
  studentPhone?: string;
  questionText: string;
  questionImageUrl?: string;
  createdAt: string;
  isResolved?: boolean;
  replies: LessonQAReply[];
}

export interface FawaterakInvoice {
  id: string;
  invoiceId: number | string;
  invoiceKey?: string;
  invoiceUrl?: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  studentEmail?: string;
  courseId: string;
  courseTitle: string;
  originalPrice: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string;
  paymentMethod: 'wallet' | 'card' | 'fawry' | 'hosted';
  paymentMethodName?: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' | 'cancelled';
  providerKey: string;
  createdAt: string;
  paidAt?: string;
  fawaterakResponse?: any;
}

export interface SupportChatMessage {
  id: string;
  sender: 'student' | 'admin';
  senderName: string;
  text: string;
  imageUrl?: string;
  timestamp: string;
  createdAtMs: number;
}

export interface SupportChatTicket {
  id: string; // e.g. support_01012345678
  studentName: string;
  studentPhone: string;
  studentId?: string;
  schoolYear?: string;
  status: 'open' | 'resolved';
  unreadByAdmin: number;
  unreadByStudent: number;
  lastMessageText: string;
  lastMessageAt: string;
  updatedAtMs: number;
  messages: SupportChatMessage[];
}




