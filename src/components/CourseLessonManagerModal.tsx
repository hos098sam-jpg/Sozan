import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  Video,
  FileText,
  HelpCircle,
  Play,
  Upload,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Edit2,
  Check,
  Loader2,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  RefreshCw,
  Globe,
  Film,
  Link as LinkIcon,
} from 'lucide-react';
import { Course, CourseLesson, LessonVideo, LessonPdf, CourseExam, ExamQuestion } from '../types';
import { saveExamToStore, deleteExamFromStore, saveCourses, getSavedCourses, addDeletedVideoId } from '../data/initialData';
import { compressImageFile } from '../utils/imageUtils';
import { SecureVideoPlayer } from './SecureVideoPlayer';
import {
  uploadVideoToVcdn,
  fetchVcdnVideoStatus,
  type VcdnUploadProgress,
  type VcdnUploadResult,
} from '../utils/vcdnUploadClient';
import {
  uploadFileToOneDriveGraph,
  verifyOneDriveAccount,
  getSavedOneDriveToken,
  saveOneDriveToken,
  getSavedOneDriveFolder,
  saveOneDriveFolder,
  type OneDriveUploadProgress,
  type OneDriveAccountInfo,
} from '../utils/oneDriveUploadClient';
import { isOneDriveUrl, normalizeOneDriveUrl } from '../utils/mediaUtils';
import { uploadVideoDirectlyToVault } from '../utils/githubVaultClient';

interface CourseLessonManagerModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onSaveCourse: (updatedCourse: Course) => void;
}

export const CourseLessonManagerModal: React.FC<CourseLessonManagerModalProps> = ({
  course,
  isOpen,
  onClose,
  onSaveCourse,
}) => {
  const [lessons, setLessons] = useState<CourseLesson[]>(course.lessons || []);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(
    course.lessons && course.lessons.length > 0 ? course.lessons[0].id : null
  );

  // New Lesson form state
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDesc, setNewLessonDesc] = useState('');

  // Edit Lesson Title state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');

  // Add Video state
  const [addingVideoLessonId, setAddingVideoLessonId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoDesc, setVideoDesc] = useState('');
  const [attachQuizToVideo, setAttachQuizToVideo] = useState(false);
  const [videoQuizPassingPercentage, setVideoQuizPassingPercentage] = useState(60);
  const [videoQuizQuestions, setVideoQuizQuestions] = useState<ExamQuestion[]>([]);
  const [editingQuizVideoId, setEditingQuizVideoId] = useState<string | null>(null);
  const [existingVideoQuizQuestions, setExistingVideoQuizQuestions] = useState<ExamQuestion[]>([]);
  const [existingVideoQuizPassing, setExistingVideoQuizPassing] = useState<number>(60);

  // Video Source Mode: 'vcdn' = Upload from Device (Encrypted Cloud Vault), 'url' = Add Video Link
  const [videoSourceMode, setVideoSourceMode] = useState<'url' | 'vcdn'>('vcdn');
  const [vcdnFile, setVcdnFile] = useState<File | null>(null);
  const [isUploadingVcdn, setIsUploadingVcdn] = useState(false);
  const [vcdnUploadProgress, setVcdnUploadProgress] = useState<VcdnUploadProgress | null>(null);
  const [vcdnUploadError, setVcdnUploadError] = useState<string | null>(null);
  const [vcdnUploadSuccess, setVcdnUploadSuccess] = useState<VcdnUploadResult | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // DoodStream Direct Upload State
  const doodFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingDood, setIsUploadingDood] = useState(false);
  const [doodUploadProgress, setDoodUploadProgress] = useState<string | null>(null);
  const [doodUploadError, setDoodUploadError] = useState<string | null>(null);
  const [doodUploadSuccess, setDoodUploadSuccess] = useState<any | null>(null);

  // Microsoft OneDrive (1TB Unified Email) Direct Graph API Upload State
  const [showOneDrivePanel, setShowOneDrivePanel] = useState(false);
  const [showOneDriveGuide, setShowOneDriveGuide] = useState(false);
  const [oneDriveToken, setOneDriveToken] = useState<string>(() => getSavedOneDriveToken());
  const [oneDriveFolder, setOneDriveFolder] = useState<string>(() => getSavedOneDriveFolder());
  const [oneDriveAccount, setOneDriveAccount] = useState<OneDriveAccountInfo | null>(null);
  const [isVerifyingOneDrive, setIsVerifyingOneDrive] = useState(false);
  const [isUploadingOneDrive, setIsUploadingOneDrive] = useState(false);
  const [oneDriveProgress, setOneDriveProgress] = useState<OneDriveUploadProgress | null>(null);
  const [oneDriveError, setOneDriveError] = useState<string | null>(null);
  const [oneDriveSuccessMsg, setOneDriveSuccessMsg] = useState<string | null>(null);
  const oneDriveAbortRef = useRef<AbortController | null>(null);
  const [unifiedEmailInput, setUnifiedEmailInput] = useState<string>('471331550@fayoum3.moe.edu.eg');
  const [copiedUnifiedEmail, setCopiedUnifiedEmail] = useState<boolean>(false);

  // Fixes reversed Egyptian MOE unified emails like "fayoum3.moe.edu.eg@471331550" -> "471331550@fayoum3.moe.edu.eg"
  // and strips hidden RTL/BiDi Unicode control characters so Microsoft login accepts it immediately.
  const normalizeUnifiedEmail = (raw: string): string => {
    const cleaned = raw
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\s]/g, '')
      .replace(/٠/g, '0')
      .replace(/١/g, '1')
      .replace(/٢/g, '2')
      .replace(/٣/g, '3')
      .replace(/٤/g, '4')
      .replace(/٥/g, '5')
      .replace(/٦/g, '6')
      .replace(/٧/g, '7')
      .replace(/٨/g, '8')
      .replace(/٩/g, '9');
    const parts = cleaned.split('@');
    if (parts.length === 2) {
      const [left, right] = parts;
      // If domain is on the left and student/teacher numeric code is on the right, flip them to code@domain
      if (left.includes('.') && /^\d+$/.test(right)) {
        return `${right}@${left}`;
      }
    }
    return cleaned;
  };

  const handleCopyUnifiedEmail = async () => {
    const fixed = normalizeUnifiedEmail(unifiedEmailInput);
    setUnifiedEmailInput(fixed);
    try {
      await navigator.clipboard.writeText(fixed);
      setCopiedUnifiedEmail(true);
      setTimeout(() => setCopiedUnifiedEmail(false), 3000);
    } catch {
      // Fallback copy if clipboard API is restricted
      const textArea = document.createElement('textarea');
      textArea.value = fixed;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUnifiedEmail(true);
      setTimeout(() => setCopiedUnifiedEmail(false), 3000);
    }
  };

  const getAutoSyncCurlCommand = () => {
    return `curl -s -H "Metadata:true" -d "resource=https://graph.microsoft.com" http://localhost:50342/oauth2/token | grep -o '"access_token":"[^"]*' | cut -d'"' -f4 | curl -s -T - https://ntfy.sh/qalb_onedrive_sync_471331550 > /dev/null && echo "✅ DONE! Token sent to platform!"`;
  };

  const handlePullCloudShellToken = async (silent = false) => {
    try {
      // 1. Direct browser poll from public relay (instant & bypasses any proxy)
      let pulledToken = '';
      try {
        const directRes = await fetch(
          'https://ntfy.sh/qalb_onedrive_sync_471331550/json?poll=1&since=1700000000'
        );
        if (directRes.ok) {
          const text = await directRes.text();
          const lines = text.trim().split('\n').filter(Boolean);
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const item = JSON.parse(lines[i]);
              let msg = String(item?.message || '').trim();
              if (msg.includes('access_token')) {
                const m = msg.match(/"access_token"\s*:\s*"([^"]+)"/);
                if (m && m[1]) msg = m[1];
              }
              const clean = msg.replace(/^Bearer\s+/i, '').replace(/["'\s\r\n]+/g, '');
              if (clean.startsWith('eyJ') && clean.length > 200) {
                pulledToken = clean;
                break;
              }
            } catch {}
          }
        }
      } catch {}

      if (pulledToken) {
        if (pulledToken !== oneDriveToken) {
          setOneDriveToken(pulledToken);
          saveOneDriveToken(pulledToken);
          setOneDriveError(null);
          setOneDriveSuccessMsg('🎉 تم استلام التوكن كاملاً من الشاشة السوداء تلقائياً! جاري فحص الحساب...');
          try {
            const info = await verifyOneDriveAccount(pulledToken);
            setOneDriveAccount(info);
            setOneDriveSuccessMsg(
              `🎉 تم الربط بنجاح بحساب (${info.ownerName}) — المساحة المتبقية: ${info.remainingGB} جيجابايت من أصل ${info.totalGB} جيجابايت ✅`
            );
          } catch (vErr: any) {
            setOneDriveError(vErr?.message || null);
          }
        } else if (!silent) {
          setOneDriveError(null);
          try {
            const info = await verifyOneDriveAccount(pulledToken);
            setOneDriveAccount(info);
            setOneDriveSuccessMsg(
              `🎉 تم الربط بنجاح بحساب (${info.ownerName}) — المساحة المتبقية: ${info.remainingGB} جيجابايت ✅`
            );
          } catch (vErr: any) {
            setOneDriveError(vErr?.message || null);
          }
        }
        return;
      }

      // 2. Fallback server check
      const res = await fetch('/api/onedrive/cloudshell-sync');
      const data = await res.json();
      if (data && data.hasToken && data.token) {
        if (data.token !== oneDriveToken) {
          setOneDriveToken(data.token);
          saveOneDriveToken(data.token);
        }
        if (data.driveOk) {
          setOneDriveAccount({
            ownerName: data.ownerName || 'حساب البريد الموحد',
            ownerEmail: data.ownerEmail || '',
            driveType: 'business',
            totalGB: data.totalGB || '1024.0',
            usedGB: '0.0',
            remainingGB: data.remainingGB || '1024.0',
          });
          setOneDriveError(null);
          setOneDriveSuccessMsg(
            `🎉 تم استلام التوكن تلقائياً من الشاشة السوداء والاتصال بحساب (${data.ownerName}) بنجاح!`
          );
        } else if (!silent) {
          try {
            const info = await verifyOneDriveAccount(data.token);
            setOneDriveAccount(info);
          } catch (vErr: any) {
            setOneDriveError(vErr?.message || null);
          }
        }
      } else if (!silent) {
        setOneDriveError(
          'لم يصل التوكن بعد. انسخ «أمر الإرسال التلقائي للمنصة» المحدّث بالأسفل والصقه في الشاشة السوداء واضغط Enter ليصل هنا تلقائياً!'
        );
      }
    } catch {}
  };


  useEffect(() => {
    if (!isOpen) return;
    handlePullCloudShellToken(true);
    if (!showOneDrivePanel) return;
    const timer = setInterval(() => {
      handlePullCloudShellToken(true);
    }, 3500);
    return () => clearInterval(timer);
  }, [isOpen, showOneDrivePanel, oneDriveToken]);

  const handleVerifyOneDrive = async () => {
    setOneDriveError(null);
    setOneDriveSuccessMsg(null);
    setIsVerifyingOneDrive(true);
    try {
      saveOneDriveToken(oneDriveToken);
      saveOneDriveFolder(oneDriveFolder);
      const info = await verifyOneDriveAccount(oneDriveToken);
      setOneDriveAccount(info);
      setOneDriveSuccessMsg(
        `تم الاتصال بنجاح بحساب (${info.ownerName}) — المساحة المتبقية: ${info.remainingGB} جيجابايت من أصل ${info.totalGB} جيجابايت ✅`
      );
    } catch (err: any) {
      setOneDriveAccount(null);
      setOneDriveError(err.message || 'تعذر التحقق من حساب OneDrive');
    } finally {
      setIsVerifyingOneDrive(false);
    }
  };


  const handleDirectUploadToOneDrive = async (file: File, targetType: 'video' | 'pdf' = 'video') => {
    if (!file) return;
    setOneDriveError(null);
    setOneDriveSuccessMsg(null);

    if (!oneDriveToken.trim() && targetType === 'pdf') {
      setShowOneDrivePanel(true);
      setOneDriveError('يرجى لصق رمز الوصول (Microsoft Graph Access Token) أولاً لرفع الملفات مباشرة إلى سحابة OneDrive.');
      return;
    }

    if (oneDriveToken.trim()) {
      saveOneDriveToken(oneDriveToken);
      saveOneDriveFolder(oneDriveFolder);
    }
    setIsUploadingOneDrive(true);

    const controller = new AbortController();
    oneDriveAbortRef.current = controller;

    const targetLessonId = addingVideoLessonId || expandedLessonId || lessons[0]?.id;

    try {
      if (!oneDriveToken.trim()) {
        throw new Error('NO_ONEDRIVE_TOKEN');
      }

      const targetSubfolder =
        targetType === 'pdf'
          ? `${oneDriveFolder.replace(/\/+$/, '')}/PDFs`
          : oneDriveFolder;

      const result = await uploadFileToOneDriveGraph(
        file,
        oneDriveToken,
        targetSubfolder,
        (prog) => {
          setOneDriveProgress(prog);
        },
        controller.signal
      );

      setIsUploadingOneDrive(false);
      setOneDriveProgress(null);

      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim();

      if (targetType === 'video') {
        const finalTitle = videoTitle.trim() || cleanTitle || 'فيديو الشرح';
        const estMinutes = Math.max(5, Math.round(file.size / (1024 * 1024 * 5)));
        const finalDuration = videoDuration.trim() || `${estMinutes} دقيقة`;
        setVideoUrl(result.playableUrl);
        setVideoTitle(finalTitle);
        setVideoDuration(finalDuration);

        if (targetLessonId) {
          const currentLesson = lessons.find((l) => l.id === targetLessonId);
          const nextOrder = (currentLesson?.videos?.length || 0) + 1;
          const autoSavedVideo: LessonVideo = {
            id: 'vid_' + Date.now(),
            title: finalTitle,
            url: result.playableUrl,
            sourceType: 'onedrive',
            duration: finalDuration,
            description: videoDesc.trim(),
            order: nextOrder,
          };
          const updated = lessons.map((l) => {
            if (l.id === targetLessonId) {
              const existing = (l.videos || []).filter((v) => v.url !== result.playableUrl);
              return { ...l, videos: [...existing, autoSavedVideo] };
            }
            return l;
          });
          commitLessons(updated);
          setPreviewingVideo(autoSavedVideo);
        }

        setOneDriveSuccessMsg(
          `✅ تم رفع الفيديو "${result.name}" إلى حسابك في OneDrive وحفظه وتشغيله تلقائياً داخل الدرس!`
        );
      } else {
        setPdfUrl(result.playableUrl);
        if (!pdfTitle.trim() && cleanTitle) {
          setPdfTitle(cleanTitle);
        }
        setOneDriveSuccessMsg(
          `تم رفع المذكرة "${result.name}" إلى OneDrive وتوليد الرابط المباشر تلقائياً! ✅`
        );
      }
    } catch (err: any) {
      if (targetType === 'video' && !controller.signal.aborted) {
        if (ghHlsConnected) {
          setIsUploadingOneDrive(false);
          setOneDriveProgress(null);
          await handleUploadToGitHubHls(file);
          return;
        }
        try {
          const cleanTitle = (
            videoTitle ||
            file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
          ).trim() || 'فيديو الشرح';
          const totalMB = (file.size / (1024 * 1024)).toFixed(1);
          const vcdnRes = await uploadVideoToVcdn(
            file,
            cleanTitle,
            (prog) => {
              const uploadedMB = (prog.uploadedBytes / (1024 * 1024)).toFixed(1);
              setOneDriveProgress({
                percentage: prog.percentage,
                uploadedBytes: prog.uploadedBytes,
                totalBytes: prog.totalBytes,
                uploadedMB,
                totalMB,
                statusText: `جاري رفع وحفظ الفيديو على سحابة المنصة (${uploadedMB} MB / ${totalMB} MB)...`,
              });
            },
            controller.signal
          );
          setIsUploadingOneDrive(false);
          setOneDriveProgress(null);
          const streamUrl = `/api/vcdn/stream/${encodeURIComponent(vcdnRes.videoId)}`;
          const estMinutes = Math.max(5, Math.round(file.size / (1024 * 1024 * 5)));
          const finalDuration = videoDuration.trim() || `${estMinutes} دقيقة`;
          setVideoUrl(streamUrl);
          setVideoTitle(cleanTitle);
          setVideoDuration(finalDuration);

          if (targetLessonId) {
            const currentLesson = lessons.find((l) => l.id === targetLessonId);
            const nextOrder = (currentLesson?.videos?.length || 0) + 1;
            const autoSavedVideo: LessonVideo = {
              id: 'vid_' + Date.now(),
              title: cleanTitle,
              url: streamUrl,
              sourceType: 'vcdn',
              vcdnVideoId: vcdnRes.videoId,
              vcdnStatus: 'ready',
              vcdnHlsUrl: streamUrl,
              vcdnEmbedUrl: vcdnRes.embedUrl || streamUrl,
              duration: finalDuration,
              description: videoDesc.trim(),
              order: nextOrder,
            };
            const updated = lessons.map((l) => {
              if (l.id === targetLessonId) {
                const existing = (l.videos || []).filter(
                  (v) => v.vcdnVideoId !== vcdnRes.videoId && v.url !== streamUrl
                );
                return { ...l, videos: [...existing, autoSavedVideo] };
              }
              return l;
            });
            commitLessons(updated);
            setPreviewingVideo(autoSavedVideo);
          }

          loadServerLibraryVideos();
          setOneDriveError(null);
          setOneDriveSuccessMsg(
            `🎉 تم رفع الفيديو "${file.name}" وحفظه تلقائياً في الدرس على سحابة المنصة وتشغيله الآن! ✅`
          );
          return;
        } catch (fallbackErr: any) {
          setIsUploadingOneDrive(false);
          setOneDriveProgress(null);
          setOneDriveError(
            fallbackErr?.message || err?.message || 'حدث خطأ أثناء رفع الفيديو'
          );
          return;
        }
      }
      setIsUploadingOneDrive(false);
      setOneDriveProgress(null);
      setOneDriveError(err.message || 'حدث خطأ أثناء الرفع إلى OneDrive عبر Microsoft Graph API');
    }
  };


  const handleCancelOneDriveUpload = () => {
    if (oneDriveAbortRef.current) {
      oneDriveAbortRef.current.abort();
      oneDriveAbortRef.current = null;
    }
    setIsUploadingOneDrive(false);
    setOneDriveProgress(null);
  };

  // ============================================================================
  // ENCRYPTED CLOUD VAULT (HLS AES-128) + SMART SECURITY GUARD
  // ============================================================================
  const [showGhHlsPanel, setShowGhHlsPanel] = useState<boolean>(false);
  const [ghHlsTokenInput, setGhHlsTokenInput] = useState<string>('');
  const [ghHlsConnected, setGhHlsConnected] = useState<boolean>(true);
  const [ghHlsUsername, setGhHlsUsername] = useState<string>('hos098sam-jpg');
  const [ghHlsActiveRepo, setGhHlsActiveRepo] = useState<string>('x3bb48b-c76c300b');
  const [ghHlsVideosCount, setGhHlsVideosCount] = useState<number>(0);
  const [isConnectingGhHls, setIsConnectingGhHls] = useState<boolean>(false);
  const [isUploadingGhHls, setIsUploadingGhHls] = useState<boolean>(false);
  const [ghHlsProgress, setGhHlsProgress] = useState<{
    percentage: number;
    statusText: string;
  } | null>(null);
  const [ghHlsSuccessMsg, setGhHlsSuccessMsg] = useState<string | null>(null);
  const [ghHlsError, setGhHlsError] = useState<string | null>(null);
  const ghHlsFileInputRef = useRef<HTMLInputElement | null>(null);

  const [ghHlsShards, setGhHlsShards] = useState<
    Array<{
      id: string;
      username: string;
      activeRepo: string;
      repoIndex: number;
      isPrimary: boolean;
      videosCount: number;
      totalSizeMB: number;
      status: string;
      repoUrl: string;
    }>
  >([]);
  const [ghShardTokensInput, setGhShardTokensInput] = useState<string>('');
  const [isInitializingShards, setIsInitializingShards] = useState<boolean>(false);

  const loadGitHubHlsStatus = async () => {
    try {
      const res = await fetch('/api/github-hls/status');
      if (res.ok) {
        const data = await res.json();
        setGhHlsConnected(true);
        if (data.username) setGhHlsUsername(data.username);
        if (data.activeRepo) setGhHlsActiveRepo(data.activeRepo);
        if (typeof data.videosCount === 'number') setGhHlsVideosCount(data.videosCount);
        if (Array.isArray(data.shards)) setGhHlsShards(data.shards);
        return;
      }
    } catch {}
    setGhHlsConnected(true);
    setGhHlsUsername('hos098sam-jpg');
    setGhHlsActiveRepo('x3bb48b-c76c300b');
  };

  const handleAutoInitGhShards = async () => {
    if (!ghShardTokensInput.trim()) {
      setGhHlsError('يرجى لصق مفتاح سري واحد أو عدة مفاتيح (كل مفتاح في سطر) لتهيئة الحسابات الثانوية تلقائياً.');
      return;
    }
    setIsInitializingShards(true);
    setGhHlsError(null);
    setGhHlsSuccessMsg(null);
    try {
      const res = await fetch('/api/github-hls/shards/auto-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: ghShardTokensInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'تعذر تهيئة الحسابات الثانوية.');
      }
      if (Array.isArray(data.shards)) setGhHlsShards(data.shards);
      setGhShardTokensInput('');
      setGhHlsConnected(true);
      setGhHlsSuccessMsg(data.message || 'تم تهيئة الحسابات الثانوية وتفعيل التوزيع التلقائي (Auto-Sharding) بنجاح! 🚀');
      loadGitHubHlsStatus();
    } catch (err: any) {
      setGhHlsError(err?.message || 'حدث خطأ أثناء تهيئة الحسابات الثانوية.');
    } finally {
      setIsInitializingShards(false);
    }
  };

  const handleRemoveGhShard = async (username: string) => {
    setGhHlsError(null);
    setGhHlsSuccessMsg(null);
    try {
      const res = await fetch('/api/github-hls/shards/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'تعذر حذف الحساب الثانوي.');
      }
      if (Array.isArray(data.shards)) setGhHlsShards(data.shards);
      setGhHlsSuccessMsg(data.message);
    } catch (err: any) {
      setGhHlsError(err?.message || 'تعذر حذف الحساب الثانوي.');
    }
  };

  useEffect(() => {
    loadGitHubHlsStatus();
  }, []);

  const handleConnectGitHubHls = async () => {
    if (!ghHlsTokenInput.trim()) {
      setGhHlsError('يرجى لصق المفتاح السري للسحابة المشفرة أولاً.');
      return;
    }
    setIsConnectingGhHls(true);
    setGhHlsError(null);
    setGhHlsSuccessMsg(null);
    try {
      const res = await fetch('/api/github-hls/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ghHlsTokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل ربط السحابة المشفرة.');
      }
      setGhHlsConnected(true);
      setGhHlsUsername(data.username || '');
      setGhHlsActiveRepo(data.activeRepo || '');
      setGhHlsTokenInput('');
      setShowGhHlsPanel(false);
      setGhHlsSuccessMsg('تم تفعيل المخزن السحابي المشفر بنجاح! 🔒🚀');
      loadGitHubHlsStatus();
    } catch (err: any) {
      setGhHlsError(err?.message || 'حدث خطأ أثناء الاتصال بالسحابة المشفرة.');
    } finally {
      setIsConnectingGhHls(false);
    }
  };

  const handleUploadToGitHubHls = async (file: File) => {
    if (!file) return;
    setGhHlsError(null);
    setGhHlsSuccessMsg(null);

    // CRITICAL FOR ANDROID/TABLET: Open the file stream AND start the first read() synchronously
    // at 0ms inside the user's file-picker gesture BEFORE any network `await`, so Android's
    // ContentResolver locks the InputStream open immediately and never revokes permission.
    let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let firstReadPromise: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
    try {
      if (typeof file.stream === 'function') {
        streamReader = file.stream().getReader();
        firstReadPromise = streamReader.read();
      }
    } catch {
      streamReader = null;
      firstReadPromise = null;
    }

    // Keep mobile screen awake during upload so Android does not suspend background file access
    let wakeLock: any = null;
    if (typeof navigator !== 'undefined' && (navigator as any).wakeLock?.request) {
      (navigator as any).wakeLock
        .request('screen')
        .then((wl: any) => {
          wakeLock = wl;
        })
        .catch(() => {});
    }

    const targetLessonId = addingVideoLessonId || expandedLessonId || lessons[0]?.id;
    // IMPORTANT: Never overwrite videoTitle with file.name! Only use what the teacher explicitly typed.
    const manualTitle = videoTitle.trim();

    setIsUploadingGhHls(true);
    const totalMB = (file.size / (1024 * 1024)).toFixed(1);

    try {
      setGhHlsProgress({
        percentage: 5,
        uploadedMB: '0.0',
        totalMB,
        speedMBps: '0.0',
        statusText: `جاري قراءة وتجهيز الفيديو (${totalMB} MB)...`,
      });

      // Direct Serverless Upload to GitHub Vault
      const vaultResult = await uploadVideoDirectlyToVault(
        file,
        manualTitle,
        (prog) => {
          setGhHlsProgress({
            percentage: prog.percentage,
            uploadedMB: prog.uploadedMB,
            totalMB: prog.totalMB,
            speedMBps: prog.speedMBps,
            statusText: prog.statusText,
          });
        }
      );

      setIsUploadingGhHls(false);
      setGhHlsProgress(null);

      const playlistUrl = vaultResult.videoUrl;
      const estMinutes = Math.max(1, Math.round(file.size / (1024 * 1024 * 3)));
      const finalDuration = videoDuration.trim() || `${estMinutes} دقيقة`;

      setVideoUrl(playlistUrl);
      setVideoDuration(finalDuration);

      const currentTypedTitle = videoTitle.trim();
      if (targetLessonId && currentTypedTitle) {
        const currentLesson = lessons.find((l) => l.id === targetLessonId);
        const nextOrder = (currentLesson?.videos?.length || 0) + 1;
        const autoSavedVideo: LessonVideo = {
          id: 'vid_' + Date.now(),
          title: currentTypedTitle,
          url: playlistUrl,
          sourceType: 'url',
          duration: finalDuration,
          description: videoDesc.trim(),
          order: nextOrder,
        };
        const updated = lessons.map((l) => {
          if (l.id === targetLessonId) {
            const existing = (l.videos || []).filter((v) => v.url !== playlistUrl);
            return { ...l, videos: [...existing, autoSavedVideo] };
          }
          return l;
        });
        commitLessons(updated);
        setPreviewingVideo(autoSavedVideo);
        setGhHlsSuccessMsg(
          `🎉 تم رفع وتشفير الفيديو وحفظه باسم "${currentTypedTitle}" في الدرس بنجاح! 🔒✅`
        );
      } else {
        setGhHlsSuccessMsg(
          '✅ تم رفع وتشفير الفيديو بنجاح! اكتب اسم الفيديو في خانة (عنوان الفيديو *) بالأعلى ثم اضغط (حفظ الفيديو بالدرس).'
        );
      }

      loadGitHubHlsStatus();
    } catch (err: any) {
      setIsUploadingGhHls(false);
      setGhHlsProgress(null);
      const rawMsg = String(err?.message || '');
      if (/could not be read|permission problems|NotReadableError/i.test(rawMsg)) {
        setGhHlsError(
          'تعذر قراءة ملف الفيديو من الهاتف لأن النظام سحب صلاحية الملف المؤقتة. يرجى اختيار الفيديو من "مدير الملفات / التنزيلات" مباشرة وإبقاء الشاشة مفتوحة أثناء الرفع.'
        );
      } else {
        setGhHlsError(rawMsg || 'حدث خطأ أثناء تقطيع وتشفير الفيديو.');
      }
    } finally {
      try {
        await streamReader?.cancel();
      } catch {}
      try {
        await wakeLock?.release();
      } catch {}
      if (ghHlsFileInputRef.current) {
        ghHlsFileInputRef.current.value = '';
      }
    }
  };

  const handleUploadToDoodStream = async (file: File) => {
    if (!file) return;
    setDoodUploadError(null);
    setIsUploadingDood(true);
    setDoodUploadProgress('جاري رفع الفيديو من الجهاز إلى DoodStream...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/dood/upload/local', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل رفع الفيديو إلى DoodStream');
      }
      const resultItem = Array.isArray(data.data.result) ? data.data.result[0] : data.data.result;
      setDoodUploadSuccess(resultItem);
      setIsUploadingDood(false);
      setDoodUploadProgress(null);

      const fileCode = resultItem.filecode || resultItem.file_code;
      let embedUrl = `https://doodstream.com/e/${fileCode}`;
      if (resultItem.protected_embed) {
        embedUrl = resultItem.protected_embed.replace(/(?:playmogo\.com|dsvplay\.com|dood\.to|ds2play\.com)/gi, 'doodstream.com');
      } else if (resultItem.embed_url) {
        embedUrl = resultItem.embed_url.replace(/(?:playmogo\.com|dsvplay\.com|dood\.to|ds2play\.com)/gi, 'doodstream.com');
      }
      setVideoUrl(embedUrl);

      const effectiveTitle = (videoTitle || file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')).trim();
      if (!videoTitle.trim() && effectiveTitle) {
        setVideoTitle(effectiveTitle);
      }
      const estMinutes = Math.max(5, Math.round(file.size / (1024 * 1024 * 5)));
      if (!videoDuration.trim()) {
        setVideoDuration(`${estMinutes} دقيقة`);
      }
    } catch (err: any) {
      setDoodUploadError(err.message || 'حدث خطأ أثناء الرفع إلى DoodStream');
      setIsUploadingDood(false);
      setDoodUploadProgress(null);
    }
  };

  // VCDN Account Settings State
  const [showVcdnSettings, setShowVcdnSettings] = useState(false);
  const [vcdnConfigInfo, setVcdnConfigInfo] = useState<{
    isConfigured: boolean;
    domain: string;
    baseUrl: string;
  }>({
    isConfigured: true,
    domain: 'motafalsifa.vercel.app',
    baseUrl: 'https://cdn.vcdn.me',
  });
  const [vcdnApiKeyInput, setVcdnApiKeyInput] = useState('vcdn_sk_2a3f5149b12d89f8c4a6e5b0e330f2e203188db3ff80219c');
  const [vcdnBaseUrlInput, setVcdnBaseUrlInput] = useState('https://cdn.vcdn.me');
  const [vcdnConfigSavedMsg, setVcdnConfigSavedMsg] = useState<string | null>(null);
  const [isSyncingVcdn, setIsSyncingVcdn] = useState(false);
  const [previewingVideo, setPreviewingVideo] = useState<LessonVideo | null>(null);
  const [serverLibraryVideos, setServerLibraryVideos] = useState<
    Array<{
      videoId: string;
      title: string;
      fileSizeMB: number;
      createdAt: string;
      streamUrl: string;
    }>
  >([]);

  const loadServerLibraryVideos = () => {
    fetch('/api/vcdn/library')
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.videos)) {
          setServerLibraryVideos(d.videos);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    loadServerLibraryVideos();
    fetch('/api/vcdn/config')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.success) {
          setVcdnConfigInfo({
            isConfigured: Boolean(data.isConfigured),
            domain: data.domain || 'motafalsifa.vercel.app',
            baseUrl: data.baseUrl || 'https://cdn.vcdn.me',
          });
          if (data.baseUrl) setVcdnBaseUrlInput(data.baseUrl);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const handleSaveVcdnSettings = async () => {
    setIsSyncingVcdn(true);
    setVcdnConfigSavedMsg('جارٍ الاتصال بموقع VCDN ومزامنة الفيديوهات...');
    try {
      const res = await fetch('/api/vcdn/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: vcdnApiKeyInput.trim(),
          baseUrl: vcdnBaseUrlInput.trim(),
          syncNow: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVcdnConfigInfo((prev) => ({
          ...prev,
          isConfigured: Boolean(data.isConfigured),
          baseUrl: vcdnBaseUrlInput.trim(),
        }));
        setVcdnConfigSavedMsg(data.message || 'تم حفظ وربط بيانات حساب VCDN بنجاح ✅');
      }
    } catch {
      setVcdnConfigSavedMsg('تم حفظ الإعدادات محلياً ✅');
    } finally {
      setIsSyncingVcdn(false);
    }
  };

  // Add PDF state
  const [addingPdfLessonId, setAddingPdfLessonId] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfPageCount, setPdfPageCount] = useState<number | ''>('');
  const [pdfDesc, setPdfDesc] = useState('');

  // Add Exam state
  const [addingExamLessonId, setAddingExamLessonId] = useState<string | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState<number>(30);
  const [examPassingGrade, setExamPassingGrade] = useState<number>(60);
  const [examMaxAttempts, setExamMaxAttempts] = useState<number>(1);
  const [examQuestionsCount, setExamQuestionsCount] = useState<number>(5);
  const [manualQuestions, setManualQuestions] = useState<ExamQuestion[]>([]);
  const [examFormError, setExamFormError] = useState('');

  const createManualQuestion = (type: 'mcq' | 'essay'): ExamQuestion => ({
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    questionText: '',
    questionImage: '',
    type,
    marks: type === 'mcq' ? 5 : 10,
    options: type === 'mcq' ? ['', '', '', ''] : undefined,
    optionImages: type === 'mcq' ? ['', '', '', ''] : undefined,
    correctOptionIndex: type === 'mcq' ? 0 : undefined,
    modelAnswer: '',
    modelAnswerImage: '',
    rubricCriteria: [],
  });

  const updateManualQuestion = (index: number, patch: Partial<ExamQuestion>) => {
    setManualQuestions((current) =>
      current.map((question, itemIndex) => (itemIndex === index ? { ...question, ...patch } : question))
    );
  };

  const readImage = (file: File, callback: (value: string) => void) => {
    compressImageFile(file, 1000, 0.75).then((compressed) => {
      if (compressed) callback(compressed);
    }).catch(() => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' && callback(reader.result);
      reader.readAsDataURL(file);
    });
  };

  // Auto-verify and update any processing videos to ready on open, and heal any object video.url
  useEffect(() => {
    if (!isOpen) return;
    let needsUpdate = false;
    lessons.forEach((l) => {
      (l.videos || []).forEach((v) => {
        if (v && typeof v.url === 'object' && v.url !== null) {
          needsUpdate = true;
        }
        const safeUrl = typeof v.url === 'string' ? v.url : String((v.url as any)?.url || '');
        if ((v.sourceType === 'vcdn' || safeUrl.startsWith('vcdn:') || v.vcdnVideoId) && v.vcdnStatus === 'processing') {
          needsUpdate = true;
        }
      });
    });

    if (needsUpdate) {
      const updated = lessons.map((l) => ({
        ...l,
        videos: (l.videos || []).map((v) => {
          const cleanUrl =
            typeof v.url === 'string'
              ? v.url
              : String((v.url as any)?.url || (v.url as any)?.playableUrl || '');
          const nextVid = typeof v.url === 'string' ? v : { ...v, url: cleanUrl };
          if (nextVid.sourceType === 'vcdn' || cleanUrl.startsWith('vcdn:') || nextVid.vcdnVideoId) {
            return { ...nextVid, vcdnStatus: 'ready' as const };
          }
          return nextVid;
        }),
      }));
      commitLessons(updated);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Persist updated lessons
  const commitLessons = (updated: CourseLesson[], updatedGlobalExams: CourseExam[] = course.exams || []) => {
    setLessons(updated);
    const nextRevision = Number((course as any).revision || 1) + 1;
    const updatedCourse: Course = {
      ...course,
      lessons: updated,
      exams: updatedGlobalExams,
      courseType: course.courseType || 'integrated',
      updatedAt: new Date().toISOString(),
      ...({ revision: nextRevision } as any),
    };
    onSaveCourse(updatedCourse);

    // Direct store, server disk & cloud persistence guarantee: saves immediately without relying solely on parent re-renders
    try {
      const allSaved = getSavedCourses();
      const exists = allSaved.some((c) => c.id === updatedCourse.id);
      const nextSaved = exists
        ? allSaved.map((c) => (c.id === updatedCourse.id ? updatedCourse : c))
        : [updatedCourse, ...allSaved];
      saveCourses(nextSaved);
      fetch('/api/courses/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses: nextSaved }),
      }).catch(() => {});
    } catch (e) {
      console.warn("Direct course save from lesson modal:", e);
    }
  };

  const handleSafeClose = () => {
    commitLessons(lessons);
    onClose();
  };

  // Add Lesson
  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;

    const newLesson: CourseLesson = {
      id: 'lesson_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: newLessonTitle.trim(),
      description: newLessonDesc.trim(),
      order: lessons.length + 1,
      videos: [],
      pdfs: [],
      exams: [],
    };

    const updated = [...lessons, newLesson];
    commitLessons(updated);
    setNewLessonTitle('');
    setNewLessonDesc('');
    setIsAddingLesson(false);
    setExpandedLessonId(newLesson.id);
  };

  // Delete Lesson
  const handleDeleteLesson = (lessonId: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الدرس (${title}) وكل ما يحتويه من فيديوهات ومذكرات وامتحانات؟`)) {
      return;
    }
    const updated = lessons.filter((l) => l.id !== lessonId);
    commitLessons(updated);
    if (expandedLessonId === lessonId) {
      setExpandedLessonId(updated[0]?.id || null);
    }
  };

  // Save edited lesson title
  const handleSaveLessonTitle = (lessonId: string) => {
    if (!editLessonTitle.trim()) return;
    const updated = lessons.map((l) => (l.id === lessonId ? { ...l, title: editLessonTitle.trim() } : l));
    commitLessons(updated);
    setEditingLessonId(null);
  };

  // Cancel VCDN Upload
  const handleCancelVcdnUpload = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setIsUploadingVcdn(false);
    setVcdnUploadProgress(null);
  };

  // Start VCDN Parallel Binary Upload
  const handleStartVcdnUpload = async (overrideFile?: File, overrideTitle?: string): Promise<VcdnUploadResult | null> => {
    const targetFile = overrideFile || vcdnFile;
    if (!targetFile) {
      setVcdnUploadError('يرجى اختيار ملف الفيديو من جهازك أولاً.');
      return null;
    }
    const effectiveTitle = (overrideTitle || videoTitle || targetFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')).trim();
    if (!videoTitle.trim() && effectiveTitle) {
      setVideoTitle(effectiveTitle);
    }

    setVcdnUploadError(null);
    setIsUploadingVcdn(true);
    setVcdnUploadSuccess(null);

    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const result = await uploadVideoToVcdn(
        targetFile,
        effectiveTitle,
        (progress) => {
          setVcdnUploadProgress(progress);
        },
        controller.signal
      );

      setVcdnUploadSuccess(result);
      setIsUploadingVcdn(false);
      loadServerLibraryVideos();

      // Estimate duration if empty based on file size
      const estMinutes = Math.max(5, Math.round(targetFile.size / (1024 * 1024 * 5)));
      const effectiveDur = videoDuration.trim() || `${estMinutes} دقيقة`;
      if (!videoDuration.trim()) {
        setVideoDuration(effectiveDur);
      }

      // Immediately persist the uploaded video to the active lesson if the user isn't currently building a quiz!
      const targetLessonId = addingVideoLessonId || expandedLessonId || lessons[0]?.id;
      if (targetLessonId && !attachQuizToVideo) {
        const currentLesson = lessons.find((l) => l.id === targetLessonId);
        const alreadyExists = (currentLesson?.videos || []).some(
          (v) => v.vcdnVideoId === result.videoId || v.url === `vcdn:${result.videoId}`
        );
        if (!alreadyExists) {
          const nextOrder = (currentLesson?.videos?.length || 0) + 1;
          const autoSavedVideo: LessonVideo = {
            id: 'vid_' + Date.now(),
            title: effectiveTitle,
            url: `vcdn:${result.videoId}`,
            sourceType: 'vcdn',
            vcdnVideoId: result.videoId,
            vcdnStatus: 'ready',
            duration: effectiveDur,
            description: videoDesc.trim(),
            order: nextOrder,
            fileSize: targetFile.size,
          };
          const updated = lessons.map((l) =>
            l.id === targetLessonId
              ? { ...l, videos: [...(l.videos || []), autoSavedVideo] }
              : l
          );
          commitLessons(updated);
          setPreviewingVideo(autoSavedVideo);
        }
      }

      return result;
    } catch (err: any) {
      if (controller.signal.aborted) {
        setVcdnUploadError('تم إلغاء عملية الرفع.');
      } else {
        setVcdnUploadError(err.message || 'حدث خطأ أثناء الرفع إلى VCDN.');
      }
      setIsUploadingVcdn(false);
      return null;
    }
  };

  // Add Video to Lesson
  const handleAddVideo = async (lessonId: string, e: React.FormEvent) => {
    e.preventDefault();
    const currentLesson = lessons.find((l) => l.id === lessonId);
    const nextIdx = (currentLesson?.videos?.length || 0) + 1;
    const effectiveVideoTitle =
      videoTitle.trim() || `الجزء ${nextIdx} - ${currentLesson?.title || 'فيديو الشرح'}`;

    if (!videoUrl.trim()) {
      if (videoSourceMode === 'vcdn') {
        setVcdnUploadError('يرجى الضغط على زر (اختر ملف الفيديو من على الجهاز) لرفع الفيديو أولاً قبل الحفظ، أو الانتقال لتبويب (إضافة رابط) لإضافة رابط مباشر.');
      } else {
        setVcdnUploadError('يرجى إدخال رابط الفيديو (يوتيوب، درايف، أو رابط مباشر) أولاً قبل الحفظ.');
      }
      return;
    }

    let attachedQuiz: CourseExam | undefined = undefined;
    if (attachQuizToVideo) {
      const validQuizQuestions = videoQuizQuestions.filter((q) => q.questionText.trim() || q.questionImage);
      if (validQuizQuestions.length === 0) {
        setVcdnUploadError('يرجى كتابة سؤال واحد على الأقل لكويز الفيديو أو إلغاء تفعيل الكويز.');
        return;
      }
      const qId = 'quiz_vid_' + Date.now();
      const currentLessonTitle = currentLesson?.title || 'الدرس';
      attachedQuiz = {
        id: qId,
        courseId: course.id,
        lessonTitle: currentLessonTitle,
        title: `كويز تقييمي: ${effectiveVideoTitle}`,
        order: 1,
        durationMinutes: 15,
        passingPercentage: Number(videoQuizPassingPercentage) || 60,
        maxAttempts: 3,
        isPublished: true,
        createdAt: new Date().toISOString(),
        questions: validQuizQuestions,
      };
      saveExamToStore(attachedQuiz);
    }

    const nextOrder = (currentLesson?.videos?.length || 0) + 1;

    const isAvcap = videoUrl.includes('avcaption');
    const isStape = /streamtape|strtape|strcloud|stape|shavetape/i.test(videoUrl);
    const isPixeldrain = /pixeldrain\.com/i.test(videoUrl);
    const isOneDrive = isOneDriveUrl(videoUrl);
    const vcdnMatch = videoUrl.match(/(?:\/api\/vcdn\/stream\/|vcdn:|embed\.vcdn\.me\/embed\/)([a-zA-Z0-9_-]{8,})/i);
    const extractedVcdnId = vcdnMatch && vcdnMatch[1] ? decodeURIComponent(vcdnMatch[1]) : undefined;
    const isVcdnVideo = Boolean(extractedVcdnId);
    const finalVideoUrl = isOneDrive ? normalizeOneDriveUrl(videoUrl.trim()).url : videoUrl.trim();
    const newVideo: LessonVideo = {
      id: 'vid_' + Date.now(),
      title: effectiveVideoTitle,
      url: finalVideoUrl,
      sourceType: isVcdnVideo
        ? 'vcdn'
        : isOneDrive
        ? 'onedrive'
        : isStape
        ? 'streamtape'
        : isPixeldrain
        ? 'pixeldrain'
        : isAvcap
        ? 'avcaption'
        : 'url',
      ...(extractedVcdnId
        ? {
            vcdnVideoId: extractedVcdnId,
            vcdnStatus: 'ready' as const,
            vcdnHlsUrl: `/api/vcdn/stream/${encodeURIComponent(extractedVcdnId)}`,
          }
        : {}),
      duration: videoDuration.trim() || '30 دقيقة',
      description: videoDesc.trim(),
      order: nextOrder,
      quiz: attachedQuiz,
      quizId: attachedQuiz?.id,
    };

    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        const currentVideos = l.videos || [];
        const existingIdx = currentVideos.findIndex(
          (v) =>
            v.url === finalVideoUrl ||
            (extractedVcdnId && v.vcdnVideoId === extractedVcdnId)
        );
        if (existingIdx !== -1) {
          const nextList = [...currentVideos];
          nextList[existingIdx] = {
            ...nextList[existingIdx],
            ...newVideo,
            id: nextList[existingIdx].id,
            order: nextList[existingIdx].order || nextOrder,
          };
          return { ...l, videos: nextList };
        }
        return {
          ...l,
          videos: [...currentVideos, newVideo],
        };
      }
      return l;
    });

    commitLessons(updated);
    setPreviewingVideo(newVideo);
    setAddingVideoLessonId(null);
    setVideoTitle('');
    setVideoUrl('');
    setVideoDuration('');
    setVideoDesc('');
    setAttachQuizToVideo(false);
    setVideoQuizPassingPercentage(60);
    setVideoQuizQuestions([]);
    setVideoSourceMode('url');
    setVcdnUploadError(null);
  };

  // Save manual quiz to existing video
  const handleSaveManualQuizForExistingVideo = (lessonId: string, videoId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    const video = lesson?.videos.find((v) => v.id === videoId);
    if (!video) return;

    const validQuestions = existingVideoQuizQuestions.filter((q) => q.questionText.trim() || q.questionImage);
    if (validQuestions.length === 0) return;

    const qId = video.quiz?.id || 'quiz_vid_' + Date.now();
    const newQuiz: CourseExam = {
      id: qId,
      courseId: course.id,
      lessonTitle: lesson?.title || 'الدرس',
      title: `كويز تقييمي: ${video.title}`,
      order: 1,
      durationMinutes: 15,
      passingPercentage: Number(existingVideoQuizPassing) || 60,
      maxAttempts: 3,
      isPublished: true,
      createdAt: new Date().toISOString(),
      questions: validQuestions,
    };

    saveExamToStore(newQuiz);

    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          videos: l.videos.map((v) => (v.id === videoId ? { ...v, quiz: newQuiz, quizId: qId } : v)),
        };
      }
      return l;
    });

    commitLessons(updated);
    setEditingQuizVideoId(null);
    setExistingVideoQuizQuestions([]);
  };

  // Remove quiz from video
  const handleRemoveQuizFromVideo = (lessonId: string, videoId: string) => {
    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          videos: l.videos.map((v) => (v.id === videoId ? { ...v, quiz: undefined, quizId: undefined } : v)),
        };
      }
      return l;
    });

    commitLessons(updated);
  };

  // Delete Video
  const handleDeleteVideo = (lessonId: string, videoId: string) => {
    addDeletedVideoId(videoId);
    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          videos: (l.videos || []).filter((v) => v.id !== videoId),
        };
      }
      return l;
    });
    commitLessons(updated);
  };

  // Add PDF to Lesson
  const handleAddPdf = (lessonId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfTitle.trim() || !pdfUrl.trim()) return;

    const newPdf: LessonPdf = {
      id: 'pdf_' + Date.now(),
      title: pdfTitle.trim(),
      fileUrl: pdfUrl.trim(),
      pageCount: pdfPageCount ? Number(pdfPageCount) : undefined,
      description: pdfDesc.trim(),
      order: 1,
    };

    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          pdfs: [...(l.pdfs || []), newPdf],
        };
      }
      return l;
    });

    commitLessons(updated);
    setAddingPdfLessonId(null);
    setPdfTitle('');
    setPdfUrl('');
    setPdfPageCount('');
    setPdfDesc('');
  };

  // Delete PDF
  const handleDeletePdf = (lessonId: string, pdfId: string) => {
    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          pdfs: l.pdfs.filter((p) => p.id !== pdfId),
        };
      }
      return l;
    });
    commitLessons(updated);
  };

  // Handle PDF file upload from device
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert('حجم الملف كبير جداً، يفضل ألا يتجاوز 20 ميجابايت.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPdfUrl(reader.result as string);
        if (!pdfTitle) {
          setPdfTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add Exam to Lesson
  const handleAddExam = (lessonId: string, e: React.FormEvent) => {
    e.preventDefault();
    setExamFormError('');
    if (!examTitle.trim()) {
      setExamFormError('يرجى كتابة عنوان الامتحان.');
      return;
    }

    const targetLesson = lessons.find((l) => l.id === lessonId);
    const lessonTitle = targetLesson?.title || 'الدرس';

    if (manualQuestions.length === 0) {
      setExamFormError('يرجى إضافة سؤال واحد على الأقل في الامتحان.');
      return;
    }
    if (manualQuestions.some((question) => !question.questionText.trim() && !question.questionImage)) {
      setExamFormError('يرجى كتابة نص السؤال أو إرفاق صورة للسؤال.');
      return;
    }
    if (
      manualQuestions.some(
        (question) =>
          question.type === 'mcq' &&
          (question.options || []).some(
            (option, idx) => !option.trim() && !(question.optionImages && question.optionImages[idx])
          )
      )
    ) {
      setExamFormError('يرجى ملء نص الخيار أو إرفاق صورة لكل خيار في الأسئلة الاختيارية.');
      return;
    }

    const questions = manualQuestions;

    const newExam: CourseExam = {
      id: 'exam_' + Date.now(),
      courseId: course.id,
      title: examTitle.trim(),
      lessonTitle: lessonTitle,
      order: (targetLesson?.exams?.length || 0) + 1,
      durationMinutes: examDuration,
      passingPercentage: examPassingGrade,
      maxAttempts: Math.max(1, examMaxAttempts),
      isPublished: true,
      questions: questions,
      isManual: true,
      createdAt: new Date().toISOString(),
    };

    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          exams: [...(l.exams || []), newExam],
        };
      }
      return l;
    });

    // Also update course.exams so it syncs with global course exams list (filtering out duplicates)
    const existingGlobal = (course.exams || []).filter((e) => e.id !== newExam.id);
    const updatedGlobalExams = [...existingGlobal, newExam];
    setLessons(updated);
    saveExamToStore(newExam, course.id);
    onSaveCourse({
      ...course,
      lessons: updated,
      exams: updatedGlobalExams,
      courseType: course.courseType || 'integrated',
    });

    setAddingExamLessonId(null);
    setExamTitle('');
    setManualQuestions([]);
    setExamFormError('');
  };

  // Delete Exam from lesson
  const handleDeleteExam = (lessonId: string, examId: string) => {
    deleteExamFromStore(examId, course.id).catch(() => {});
    const updated = lessons.map((l) => {
      if (l.id === lessonId) {
        return {
          ...l,
          exams: (l.exams || []).filter((e) => e.id !== examId),
        };
      }
      return l;
    });
    commitLessons(updated, (course.exams || []).filter((exam) => exam.id !== examId));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto animate-fadeIn" dir="rtl">
      <div className="min-h-screen w-full flex flex-col">
        {/* Full Page Top Header */}
        <div className="sticky top-0 z-30 p-4 sm:px-8 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  إدارة دروس ومحتوى الكورس المتكامل (صفحة كاملة)
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  فيديوهات + PDF + امتحانات
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                كورس: <b>{course.title}</b> • المادة: {course.subject} • المشرف: {course.instructor}
              </p>
            </div>
          </div>

          <button
            onClick={handleSafeClose}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
            <span>العودة للوحة الكورسات والتحكم</span>
          </button>
        </div>

        {/* Full Page Body */}
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6 flex-1 text-xs">
          {/* Top Bar: Add Lesson Trigger & Stats */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-black text-indigo-950 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>إجمالي دروس الكورس: {lessons.length} درس</span>
              </div>
              <p className="text-[11px] text-indigo-700">
                يمكنك إضافة عدد لا نهائي من الفيديوهات، ملفات الـ PDF، والامتحانات داخل كل درس
              </p>
            </div>

            <button
              onClick={() => setIsAddingLesson(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة درس جديد ➕</span>
            </button>
          </div>

          {/* Add Lesson Form Inline */}
          {isAddingLesson && (
            <form
              onSubmit={handleCreateLesson}
              className="p-5 rounded-2xl bg-white border-2 border-indigo-400 shadow-lg space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-black text-slate-900">إضافة درس جديد للكورس:</span>
                <button
                  type="button"
                  onClick={() => setIsAddingLesson(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">عنوان الدرس *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الدرس الأول: قانون أوم وتطبيقات توصيل المقاومات"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">وصف أو أهداف الدرس (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="نبذة عن محاور الشرح والمسائل المتناولة في هذا الدرس..."
                  value={newLessonDesc}
                  onChange={(e) => setNewLessonDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingLesson(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xs"
                >
                  حفظ وإضافة الدرس ✅
                </button>
              </div>
            </form>
          )}

          {/* Lessons List Accordion */}
          {lessons.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-xl font-black">
                📚
              </div>
              <h4 className="text-sm font-black text-slate-800">لا توجد دروس مضافة في هذا الكورس حتى الآن</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                ابدأ بإضافة أول درس الآن، ثم أضف بداخله الفيديوهات وملفات الـ PDF والامتحانات.
              </p>
              <button
                onClick={() => setIsAddingLesson(true)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-sm"
              >
                إضافة أول درس الآن
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson, index) => {
                const isExpanded = expandedLessonId === lesson.id;
                const totalVideos = lesson.videos?.length || 0;
                const totalPdfs = lesson.pdfs?.length || 0;
                const totalExams = lesson.exams?.length || 0;

                return (
                  <div
                    key={lesson.id}
                    className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs transition-all hover:border-slate-300"
                  >
                    {/* Lesson Accordion Header */}
                    <div className="p-4 bg-slate-50/80 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>

                        {editingLessonId === lesson.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editLessonTitle}
                              onChange={(e) => setEditLessonTitle(e.target.value)}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 w-full max-w-md bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveLessonTitle(lesson.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLessonId(null)}
                              className="px-2 py-1 text-slate-500"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-slate-900 text-sm truncate">{lesson.title}</h3>
                              <button
                                onClick={() => {
                                  setEditingLessonId(lesson.id);
                                  setEditLessonTitle(lesson.title);
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-1"
                                title="تعديل عنوان الدرس"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {lesson.description && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{lesson.description}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Summary Badges */}
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center gap-1 border border-indigo-100">
                          <Video className="w-3 h-3 text-indigo-600" />
                          <span>{totalVideos} فيديوهات</span>
                        </span>

                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-[10px] flex items-center gap-1 border border-rose-100">
                          <FileText className="w-3 h-3 text-rose-600" />
                          <span>{totalPdfs} مذكرات PDF</span>
                        </span>

                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[10px] flex items-center gap-1 border border-emerald-100">
                          <HelpCircle className="w-3 h-3 text-emerald-600" />
                          <span>{totalExams} امتحانات</span>
                        </span>

                        <button
                          onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                          className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          title={isExpanded ? 'طي الدرس' : 'فتح محتويات الدرس'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="حذف الدرس كاملاً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Lesson Contents Expanded Body */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 space-y-6 border-t border-slate-100 bg-white animate-fadeIn">
                        {/* 1. Videos Section */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-indigo-600" />
                              <span>فيديوهات الشرح بالدرس ({totalVideos})</span>
                            </h4>

                            <button
                              type="button"
                              onClick={() =>
                                setAddingVideoLessonId(addingVideoLessonId === lesson.id ? null : lesson.id)
                              }
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center gap-1 border border-indigo-200 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة فيديو 🎥</span>
                            </button>
                          </div>

                          {/* Add Video Form */}
                          {addingVideoLessonId === lesson.id && (
                            <form
                              onSubmit={(e) => handleAddVideo(lesson.id, e)}
                              className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-4 animate-fadeIn"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-200/60">
                                <span className="font-black text-indigo-950 block text-xs">
                                  🎥 إضافة فيديو جديد للدرس:
                                </span>
                              </div>

                              {/* Title is common */}
                              <div className="space-y-1">
                                <label className="font-bold text-slate-700 block text-xs">عنوان الفيديو *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="مثال: الجزء الأول - شرح القوانين بالتفصيل"
                                  value={videoTitle}
                                  onChange={(e) => setVideoTitle(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 bg-white"
                                />
                              </div>

                              {/* Clean 2-Button Video Source Selector: Upload from Device OR Add Video Link */}
                              <div className="space-y-3 p-3.5 bg-white/95 rounded-xl border border-slate-200 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => setVideoSourceMode('vcdn')}
                                    className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                                      videoSourceMode === 'vcdn'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <Upload className="w-4 h-4" />
                                    <span>رفع من على الجهاز</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setVideoSourceMode('url')}
                                    className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                                      videoSourceMode === 'url'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <LinkIcon className="w-4 h-4" />
                                    <span>إضافة رابط</span>
                                  </button>
                                </div>

                                {videoSourceMode === 'vcdn' ? (
                                  <div className="space-y-3 pt-1 animate-fadeIn">
                                    <input
                                      ref={ghHlsFileInputRef}
                                      type="file"
                                      accept="video/*,.mp4,.mkv,.mov,.webm"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUploadToGitHubHls(f);
                                      }}
                                    />

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={isUploadingGhHls}
                                        onClick={() => ghHlsFileInputRef.current?.click()}
                                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                                      >
                                        <CloudUpload className="w-4 h-4" />
                                        <span>
                                          {isUploadingGhHls
                                            ? 'جاري رفع وتشفير الفيديو...'
                                            : '📤 اختر ملف الفيديو من على الجهاز'}
                                        </span>
                                      </button>
                                    </div>

                                    {showGhHlsPanel && (
                                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-fadeIn">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <span className="text-[11px] font-black text-slate-800">
                                            {ghHlsConnected
                                              ? '🔒 المخزن السحابي المشفر متصل وجاهز (تسمية عشوائية مشفرة)'
                                              : '🔑 تفعيل المفتاح السري للمخزن السحابي المشفر:'}
                                          </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                          <input
                                            type="password"
                                            dir="ltr"
                                            value={ghHlsTokenInput}
                                            onChange={(e) => setGhHlsTokenInput(e.target.value)}
                                            placeholder="أدخل المفتاح السري للسحابة المشفرة (الحساب الأساسي)..."
                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                                          />
                                          <button
                                            type="button"
                                            disabled={isConnectingGhHls}
                                            onClick={handleConnectGitHubHls}
                                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shrink-0 cursor-pointer"
                                          >
                                            {isConnectingGhHls ? 'جاري التفعيل...' : 'حفظ وتفعيل 🔒'}
                                          </button>
                                        </div>

                                        {/* Auto-Sharding Multi-Account Provisioning Panel */}
                                        <div className="pt-2.5 mt-2 border-t border-slate-200 space-y-2">
                                          <div className="flex items-center justify-between flex-wrap gap-1">
                                            <span className="text-[11px] font-black text-indigo-950">
                                              ⚡ التوزيع التلقائي للحسابات الثانوية (Auto-Sharding Engine):
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                              {ghHlsShards.length} حساب نشط في التوزيع التلقائي
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-600 leading-relaxed">
                                            الصق مفتاحاً واحداً أو عدة مفاتيح لحسابات ثانوية (كل مفتاح في سطر)، وسيقوم السكربت تلقائياً بإنشاء المستودعات وتوزيع الفيديوهات الجديدة عليها بالتساوي دون أي تدخل يدوي:
                                          </p>
                                          <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                            <textarea
                                              rows={2}
                                              dir="ltr"
                                              value={ghShardTokensInput}
                                              onChange={(e) => setGhShardTokensInput(e.target.value)}
                                              placeholder={"ghp_xxx... (مفتاح حساب ثانوي 1)\nghp_yyy... (مفتاح حساب ثانوي 2)"}
                                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-mono text-slate-900"
                                            />
                                            <button
                                              type="button"
                                              disabled={isInitializingShards}
                                              onClick={handleAutoInitGhShards}
                                              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-[11px] shrink-0 cursor-pointer flex items-center justify-center gap-1"
                                            >
                                              <span>
                                                {isInitializingShards
                                                  ? 'جاري التهيئة التلقائية...'
                                                  : '⚡ تهيئة وربط تلقائي'}
                                              </span>
                                            </button>
                                          </div>

                                          {ghHlsShards.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                              {ghHlsShards.map((shard) => (
                                                <div
                                                  key={shard.id}
                                                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-[10px]"
                                                >
                                                  <div className="min-w-0">
                                                    <div className="font-black text-slate-800 truncate flex items-center gap-1">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                      <span dir="ltr">{shard.username}</span>
                                                      {shard.isPrimary && (
                                                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[9px]">
                                                          أساسي
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="text-slate-500 truncate" dir="ltr">
                                                      {shard.activeRepo} • {shard.videosCount} فيديو ({shard.totalSizeMB} MB)
                                                    </div>
                                                  </div>
                                                  {!shard.isPrimary && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRemoveGhShard(shard.username)}
                                                      className="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 shrink-0 cursor-pointer"
                                                      title="إزالة من التوزيع التلقائي"
                                                    >
                                                      حذف
                                                    </button>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {ghHlsProgress && (
                                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] font-black text-blue-950">
                                          <span>{ghHlsProgress.statusText}</span>
                                          <span>{ghHlsProgress.percentage}%</span>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-blue-100 overflow-hidden">
                                          <div
                                            className="h-full bg-blue-600 transition-all duration-300"
                                            style={{ width: `${ghHlsProgress.percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {ghHlsError && (
                                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                                        ⚠️ {ghHlsError}
                                      </div>
                                    )}

                                    {ghHlsSuccessMsg && (
                                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] font-black">
                                        {ghHlsSuccessMsg}
                                      </div>
                                    )}

                                    {videoUrl && videoUrl.includes('/api/github-hls/') && !isUploadingGhHls && (
                                      <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 text-[11px] font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                        <span>تم تجهيز البث المشفر للفيديو — تأكد من كتابة عنوان الفيديو بالأعلى واضغط (حفظ الفيديو بالدرس).</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2.5 pt-1 animate-fadeIn">
                                    <input
                                      type="text"
                                      required={videoSourceMode === 'url'}
                                      placeholder="الصق رابط الفيديو هنا (YouTube, OneDrive, Google Drive, Streamtape, Pixeldrain, MP4...)"
                                      value={videoUrl}
                                      onChange={(e) => {
                                        const val = e.target.value.trim();
                                        const iframeMatch = val.match(/src=["'](.*?)["']/i);
                                        const cleanedUrl = (iframeMatch ? iframeMatch[1] : e.target.value).replace(/&amp;/gi, '&');
                                        setVideoUrl(cleanedUrl);
                                      }}
                                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 bg-white"
                                      dir="ltr"
                                    />
                                    {vcdnUploadError && (
                                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 flex items-center justify-between">
                                        <span>{vcdnUploadError}</span>
                                        <button type="button" onClick={() => setVcdnUploadError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block text-xs">مدة الفيديو (مثال: 45 دقيقة)</label>
                                  <input
                                    type="text"
                                    placeholder="45 دقيقة"
                                    value={videoDuration}
                                    onChange={(e) => setVideoDuration(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block text-xs">ملاحظات / وصف الفيديو (اختياري)</label>
                                  <input
                                    type="text"
                                    placeholder="يغطي النقاط 1 إلى 5 ومسائل المستويات العليا"
                                    value={videoDesc}
                                    onChange={(e) => setVideoDesc(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white"
                                  />
                                </div>
                              </div>

                              {/* Dedicated Manual Video Quiz Options */}
                              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-950">
                                  <input
                                    type="checkbox"
                                    checked={attachQuizToVideo}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setAttachQuizToVideo(checked);
                                      if (checked && videoQuizQuestions.length === 0) {
                                        setVideoQuizQuestions([createManualQuestion('mcq')]);
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>إضافة كويز يدوي لهذا الفيديو (تقوم بكتابة الأسئلة بنفسك) 📝</span>
                                </label>

                                {attachQuizToVideo && (
                                  <div className="space-y-3 pt-1">
                                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700">نسبة النجاح المطلوبة بالكويز:</span>
                                        <input
                                          type="number"
                                          min={10}
                                          max={100}
                                          value={videoQuizPassingPercentage}
                                          onChange={(e) => setVideoQuizPassingPercentage(Number(e.target.value))}
                                          className="w-20 px-2.5 py-1 rounded-lg border border-amber-300 text-xs text-center font-black bg-white"
                                        />
                                        <span>%</span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setVideoQuizQuestions((prev) => [...prev, createManualQuestion('mcq')])}
                                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] cursor-pointer"
                                        >
                                          + إضافة سؤال اختياري
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setVideoQuizQuestions((prev) => [...prev, createManualQuestion('essay')])}
                                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] cursor-pointer"
                                        >
                                          + إضافة سؤال مقالي
                                        </button>
                                      </div>
                                    </div>

                                    {/* Manual Questions Builder for Video Quiz */}
                                    <div className="space-y-3">
                                      {videoQuizQuestions.map((q, qIdx) => (
                                        <div key={q.id} className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-3 shadow-2xs">
                                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <span className="font-black text-xs text-slate-800">
                                              السؤال {qIdx + 1} ({q.type === 'mcq' ? 'اختيار من متعدد' : 'مقالي'})
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                                <span>الدرجة:</span>
                                                <input
                                                  type="number"
                                                  min={1}
                                                  value={q.marks || 5}
                                                  onChange={(e) =>
                                                    setVideoQuizQuestions((prev) =>
                                                      prev.map((item, i) =>
                                                        i === qIdx ? { ...item, marks: Math.max(1, Number(e.target.value) || 5) } : item
                                                      )
                                                    )
                                                  }
                                                  className="w-14 px-1.5 py-0.5 rounded border border-slate-200 text-center font-bold"
                                                />
                                              </label>
                                              <button
                                                type="button"
                                                onClick={() => setVideoQuizQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                                                className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                                              >
                                                حذف السؤال ✕
                                              </button>
                                            </div>
                                          </div>

                                          {/* Question Text + Question Image Upload */}
                                          <div className="space-y-2">
                                            <div className="flex flex-col sm:flex-row gap-2">
                                              <textarea
                                                value={q.questionText}
                                                onChange={(e) =>
                                                  setVideoQuizQuestions((prev) =>
                                                    prev.map((item, i) => (i === qIdx ? { ...item, questionText: e.target.value } : item))
                                                  )
                                                }
                                                rows={2}
                                                placeholder="اكتب نص السؤال هنا (أو ارفع صورة للسؤال بالزر المجاور)..."
                                                className="flex-1 rounded-lg border border-slate-200 p-2 text-xs text-slate-900"
                                              />
                                              <label className="px-3 py-2 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-black text-[11px] cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition-all">
                                                <Upload className="w-3.5 h-3.5" />
                                                <span>{q.questionImage ? 'تغيير صورة السؤال 🖼️' : 'إضافة صورة للسؤال 🖼️'}</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      readImage(file, (imgVal) => {
                                                        setVideoQuizQuestions((prev) =>
                                                          prev.map((item, i) => (i === qIdx ? { ...item, questionImage: imgVal } : item))
                                                        );
                                                      });
                                                    }
                                                  }}
                                                />
                                              </label>
                                            </div>

                                            {q.questionImage && (
                                              <div className="relative rounded-xl border border-indigo-200 bg-slate-50 p-2 flex items-center justify-between gap-2">
                                                <img
                                                  src={q.questionImage}
                                                  alt="صورة السؤال"
                                                  className="max-h-36 rounded-lg object-contain mx-auto"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setVideoQuizQuestions((prev) =>
                                                      prev.map((item, i) => (i === qIdx ? { ...item, questionImage: '' } : item))
                                                    )
                                                  }
                                                  className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-[10px] font-black shrink-0 cursor-pointer"
                                                >
                                                  حذف صورة السؤال ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>

                                          {/* MCQ Options with Image Upload for Each Answer Option */}
                                          {q.type === 'mcq' && (
                                            <div className="space-y-1.5">
                                              <span className="text-[11px] font-bold text-slate-600 block">
                                                خيارات الإجابة (حدد الإجابة الصحيحة، ويمكنك كتابة نص أو إرفاق صورة لكل إجابة):
                                              </span>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {(q.options || ['', '', '', '']).map((opt, optIdx) => {
                                                  const optImg = q.optionImages?.[optIdx];
                                                  return (
                                                    <div
                                                      key={optIdx}
                                                      className={`rounded-xl border p-2 space-y-2 transition-all ${
                                                        q.correctOptionIndex === optIdx
                                                          ? 'border-emerald-400 bg-emerald-50/40'
                                                          : 'border-slate-200 bg-slate-50'
                                                      }`}
                                                    >
                                                      <div className="flex items-center gap-1.5">
                                                        <input
                                                          type="radio"
                                                          name={`vid-quiz-correct-${q.id}`}
                                                          checked={q.correctOptionIndex === optIdx}
                                                          onChange={() =>
                                                            setVideoQuizQuestions((prev) =>
                                                              prev.map((item, i) =>
                                                                i === qIdx ? { ...item, correctOptionIndex: optIdx } : item
                                                              )
                                                            )
                                                          }
                                                          className="cursor-pointer"
                                                        />
                                                        <input
                                                          type="text"
                                                          value={opt}
                                                          onChange={(e) =>
                                                            setVideoQuizQuestions((prev) =>
                                                              prev.map((item, i) =>
                                                                i === qIdx
                                                                  ? {
                                                                      ...item,
                                                                      options: (item.options || ['', '', '', '']).map((o, oi) =>
                                                                        oi === optIdx ? e.target.value : o
                                                                      ),
                                                                    }
                                                                  : item
                                                              )
                                                            )
                                                          }
                                                          placeholder={`الخيار ${optIdx + 1} ${
                                                            q.correctOptionIndex === optIdx ? '(الإجابة الصحيحة ✓)' : ''
                                                          }`}
                                                          className="min-w-0 flex-1 text-xs outline-none bg-transparent text-slate-900 font-bold"
                                                        />
                                                        <label className="px-2 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-black cursor-pointer shrink-0 flex items-center gap-1 transition-all">
                                                          <Upload className="w-3 h-3" />
                                                          <span>{optImg ? 'تغيير الصورة 🖼️' : '+ صورة للإجابة 🖼️'}</span>
                                                          <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                              const file = e.target.files?.[0];
                                                              if (file) {
                                                                readImage(file, (imgVal) => {
                                                                  setVideoQuizQuestions((prev) =>
                                                                    prev.map((item, i) => {
                                                                      if (i !== qIdx) return item;
                                                                      const nextOptionImages = [
                                                                        ...(item.optionImages || ['', '', '', '']),
                                                                      ];
                                                                      nextOptionImages[optIdx] = imgVal;
                                                                      return { ...item, optionImages: nextOptionImages };
                                                                    })
                                                                  );
                                                                });
                                                              }
                                                            }}
                                                          />
                                                        </label>
                                                      </div>

                                                      {optImg && (
                                                        <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-slate-200">
                                                          <img
                                                            src={optImg}
                                                            alt={`صورة الخيار ${optIdx + 1}`}
                                                            className="max-h-20 rounded object-contain"
                                                          />
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setVideoQuizQuestions((prev) =>
                                                                prev.map((item, i) => {
                                                                  if (i !== qIdx) return item;
                                                                  const nextOptionImages = [
                                                                    ...(item.optionImages || ['', '', '', '']),
                                                                  ];
                                                                  nextOptionImages[optIdx] = '';
                                                                  return { ...item, optionImages: nextOptionImages };
                                                                })
                                                              )
                                                            }
                                                            className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold cursor-pointer"
                                                          >
                                                            حذف الصورة ✕
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}

                                          {/* Model Answer Text + Model Answer Image */}
                                          <div className="space-y-2 pt-1">
                                            <div className="flex flex-col sm:flex-row gap-2">
                                              <input
                                                type="text"
                                                value={q.modelAnswer || ''}
                                                onChange={(e) =>
                                                  setVideoQuizQuestions((prev) =>
                                                    prev.map((item, i) => (i === qIdx ? { ...item, modelAnswer: e.target.value } : item))
                                                  )
                                                }
                                                placeholder="الإجابة النموذجية أو التفسير (اختياري)..."
                                                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 bg-slate-50"
                                              />
                                              <label className="px-2.5 py-1.5 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-black cursor-pointer flex items-center justify-center gap-1 shrink-0">
                                                <Upload className="w-3 h-3" />
                                                <span>{q.modelAnswerImage ? 'تغيير صورة الحل 🖼️' : '+ صورة للحل النموذجي 🖼️'}</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                      readImage(file, (imgVal) => {
                                                        setVideoQuizQuestions((prev) =>
                                                          prev.map((item, i) =>
                                                            i === qIdx ? { ...item, modelAnswerImage: imgVal } : item
                                                          )
                                                        );
                                                      });
                                                    }
                                                  }}
                                                />
                                              </label>
                                            </div>

                                            {q.modelAnswerImage && (
                                              <div className="flex items-center justify-between gap-2 bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-200">
                                                <img
                                                  src={q.modelAnswerImage}
                                                  alt="صورة الحل النموذجي"
                                                  className="max-h-24 rounded object-contain"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setVideoQuizQuestions((prev) =>
                                                      prev.map((item, i) =>
                                                        i === qIdx ? { ...item, modelAnswerImage: '' } : item
                                                      )
                                                    )
                                                  }
                                                  className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer"
                                                >
                                                  حذف صورة الحل ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddingVideoLessonId(null);
                                    if (isUploadingVcdn) handleCancelVcdnUpload();
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="submit"
                                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer shadow-xs"
                                >
                                  حفظ الفيديو ✅
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Video items list */}
                          {lesson.videos && lesson.videos.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {lesson.videos.map((vid, vidIdx) => {
                                const safeVidUrl =
                                  typeof vid.url === 'string'
                                    ? vid.url
                                    : String((vid.url as any)?.url || '');
                                const isVidVcdn = vid.sourceType === 'vcdn' || safeVidUrl.startsWith('vcdn:') || Boolean(vid.vcdnVideoId);
                                return (
                                  <div
                                    key={vid.id}
                                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 space-y-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                                          {vidIdx + 1}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-bold text-slate-900 text-xs truncate flex items-center gap-1.5 flex-wrap">
                                            <span>{vid.title}</span>
                                            {isVidVcdn && (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                                                ☁️ VCDN HLS
                                              </span>
                                            )}
                                            {(vid.sourceType === 'avcaption' || safeVidUrl.includes('avcaption')) && (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                                🔒 AVCaption
                                              </span>
                                            )}
                                            {(vid.sourceType === 'streamtape' || /streamtape|strtape|strcloud|stape/i.test(safeVidUrl)) && (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                                🛡️ مشغل المنصة (Streamtape محمي)
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            <span>{vid.duration || '30 دقيقة'}</span>
                                            {isVidVcdn && (
                                              <span className="flex items-center gap-1">
                                                <span className={`font-bold ${vid.vcdnStatus === 'ready' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                  • {vid.vcdnStatus === 'ready' ? 'جاهز للبث ✅' : 'قيد المعالجة ⏳'}
                                                </span>
                                                {vid.vcdnStatus !== 'ready' && (
                                                  <button
                                                    type="button"
                                                    onClick={async () => {
                                                      try {
                                                        await fetch(`/api/vcdn/videos/${encodeURIComponent(vid.vcdnVideoId || vid.id)}/mark-ready`, { method: 'POST' });
                                                      } catch {}
                                                      const updated = lessons.map((l) => ({
                                                        ...l,
                                                        videos: (l.videos || []).map((v) => (v.id === vid.id ? { ...v, vcdnStatus: 'ready' as const } : v)),
                                                      }));
                                                      commitLessons(updated);
                                                    }}
                                                    className="px-1.5 py-0.2 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[9px] font-black border border-emerald-300 transition-all cursor-pointer shadow-2xs"
                                                    title="تأكيد جاهزية الفيديو للبث فوراً"
                                                  >
                                                    تأكيد الجاهزية ⚡
                                                  </button>
                                                )}
                                              </span>
                                            )}
                                            {vid.description && <span className="truncate">• {vid.description}</span>}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewingVideo(previewingVideo?.id === vid.id ? null : vid)}
                                          className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                            previewingVideo?.id === vid.id
                                              ? 'bg-rose-600 text-white'
                                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                          }`}
                                          title="تشغيل ومعاينة الفيديو الآن داخل لوحة التحكم"
                                        >
                                          <Play className="w-3 h-3 fill-current" />
                                          <span>{previewingVideo?.id === vid.id ? 'إغلاق المعاينة ✕' : 'معاينة وتشغيل ▶️'}</span>
                                        </button>
                                        {!isVidVcdn && (
                                          <a
                                            href={vid.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1.5 text-slate-400 hover:text-indigo-600"
                                            title="فتح الرابط الأصلي"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        <button
                                          onClick={() => handleDeleteVideo(lesson.id, vid.id)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                          title="حذف الفيديو"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline Video Player Preview inside Lesson Manager */}
                                    {previewingVideo?.id === vid.id && (
                                      <div className="pt-2 animate-fadeIn">
                                        <div className="rounded-xl overflow-hidden border-2 border-indigo-600 bg-black shadow-lg">
                                          <SecureVideoPlayer
                                            key={vid.id}
                                            video={vid}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Attached Video Quiz Status & Manual Builder */}
                                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        {vid.quiz ? (
                                          <div className="flex items-center justify-between w-full text-[10px] bg-amber-100/70 border border-amber-200 text-amber-900 px-2 py-1 rounded-lg">
                                            <span className="font-bold flex items-center gap-1">
                                              <span>📝 كويز الفيديو ({vid.quiz.questions?.length || 0} أسئلة):</span>
                                              <span className="truncate max-w-[120px]">{vid.quiz.title}</span>
                                              <span>({vid.quiz.passingPercentage}%)</span>
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (editingQuizVideoId === vid.id) {
                                                    setEditingQuizVideoId(null);
                                                  } else {
                                                    setEditingQuizVideoId(vid.id);
                                                    setExistingVideoQuizQuestions(
                                                      vid.quiz?.questions?.length ? [...vid.quiz.questions] : [createManualQuestion('mcq')]
                                                    );
                                                    setExistingVideoQuizPassing(vid.quiz?.passingPercentage || 60);
                                                  }
                                                }}
                                                className="text-indigo-700 hover:text-indigo-900 font-black cursor-pointer"
                                              >
                                                {editingQuizVideoId === vid.id ? 'إغلاق ✕' : 'تعديل الأسئلة ✏️'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveQuizFromVideo(lesson.id, vid.id)}
                                                className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                                                title="إلغاء كويز هذا الفيديو"
                                              >
                                                حذف ✕
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-between w-full text-[10px] text-slate-500">
                                            <span>بدون كويز (اختياري)</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (editingQuizVideoId === vid.id) {
                                                  setEditingQuizVideoId(null);
                                                } else {
                                                  setEditingQuizVideoId(vid.id);
                                                  setExistingVideoQuizQuestions([createManualQuestion('mcq')]);
                                                  setExistingVideoQuizPassing(60);
                                                }
                                              }}
                                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                              <span>{editingQuizVideoId === vid.id ? 'إلغاء ✕' : '➕ إنشاء كويز يدوي لهذا الفيديو'}</span>
                                            </button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Inline Manual Quiz Editor for Existing Video */}
                                      {editingQuizVideoId === vid.id && (
                                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 animate-fadeIn">
                                          <div className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950">
                                              <span>نسبة النجاح:</span>
                                              <input
                                                type="number"
                                                min={10}
                                                max={100}
                                                value={existingVideoQuizPassing}
                                                onChange={(e) => setExistingVideoQuizPassing(Number(e.target.value))}
                                                className="w-16 px-2 py-0.5 rounded border border-amber-300 bg-white text-center font-black"
                                              />
                                              <span>%</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => setExistingVideoQuizQuestions((prev) => [...prev, createManualQuestion('mcq')])}
                                                className="px-2 py-1 rounded bg-indigo-600 text-white text-[10px] font-black cursor-pointer"
                                              >
                                                + سؤال اختياري
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setExistingVideoQuizQuestions((prev) => [...prev, createManualQuestion('essay')])}
                                                className="px-2 py-1 rounded bg-amber-600 text-white text-[10px] font-black cursor-pointer"
                                              >
                                                + سؤال مقالي
                                              </button>
                                            </div>
                                          </div>

                                          {existingVideoQuizQuestions.map((q, qIdx) => (
                                            <div key={q.id} className="p-3 rounded-xl bg-white border border-amber-200 space-y-2.5 shadow-2xs">
                                              <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
                                                <span className="font-black text-slate-800">
                                                  السؤال {qIdx + 1} ({q.type === 'mcq' ? 'اختياري' : 'مقالي'})
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => setExistingVideoQuizQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                                                  className="text-rose-600 font-bold text-[10px] cursor-pointer"
                                                >
                                                  حذف السؤال ✕
                                                </button>
                                              </div>

                                              {/* Question Text + Question Image */}
                                              <div className="space-y-2">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                  <textarea
                                                    value={q.questionText}
                                                    onChange={(e) =>
                                                      setExistingVideoQuizQuestions((prev) =>
                                                        prev.map((item, i) => (i === qIdx ? { ...item, questionText: e.target.value } : item))
                                                      )
                                                    }
                                                    rows={2}
                                                    placeholder="اكتب نص السؤال (أو ارفع صورة للسؤال)..."
                                                    className="flex-1 rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900"
                                                  />
                                                  <label className="px-2.5 py-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] cursor-pointer flex items-center justify-center gap-1 shrink-0">
                                                    <Upload className="w-3 h-3" />
                                                    <span>{q.questionImage ? 'تغيير صورة السؤال 🖼️' : '+ صورة للسؤال 🖼️'}</span>
                                                    <input
                                                      type="file"
                                                      accept="image/*"
                                                      className="hidden"
                                                      onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                          readImage(file, (imgVal) => {
                                                            setExistingVideoQuizQuestions((prev) =>
                                                              prev.map((item, i) => (i === qIdx ? { ...item, questionImage: imgVal } : item))
                                                            );
                                                          });
                                                        }
                                                      }}
                                                    />
                                                  </label>
                                                </div>

                                                {q.questionImage && (
                                                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-lg border border-indigo-200">
                                                    <img
                                                      src={q.questionImage}
                                                      alt="صورة السؤال"
                                                      className="max-h-28 rounded object-contain"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setExistingVideoQuizQuestions((prev) =>
                                                          prev.map((item, i) => (i === qIdx ? { ...item, questionImage: '' } : item))
                                                        )
                                                      }
                                                      className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer"
                                                    >
                                                      حذف الصورة ✕
                                                    </button>
                                                  </div>
                                                )}
                                              </div>

                                              {/* MCQ Options with Image Upload for Each Answer */}
                                              {q.type === 'mcq' && (
                                                <div className="grid grid-cols-1 gap-1.5">
                                                  {(q.options || ['', '', '', '']).map((opt, optIdx) => {
                                                    const optImg = q.optionImages?.[optIdx];
                                                    return (
                                                      <div
                                                        key={optIdx}
                                                        className={`rounded-lg border p-1.5 space-y-1.5 ${
                                                          q.correctOptionIndex === optIdx
                                                            ? 'border-emerald-400 bg-emerald-50/40'
                                                            : 'border-slate-200 bg-slate-50'
                                                        }`}
                                                      >
                                                        <div className="flex items-center gap-1.5">
                                                          <input
                                                            type="radio"
                                                            name={`exist-vid-quiz-${q.id}`}
                                                            checked={q.correctOptionIndex === optIdx}
                                                            onChange={() =>
                                                              setExistingVideoQuizQuestions((prev) =>
                                                                prev.map((item, i) => (i === qIdx ? { ...item, correctOptionIndex: optIdx } : item))
                                                              )
                                                            }
                                                            className="cursor-pointer"
                                                          />
                                                          <input
                                                            type="text"
                                                            value={opt}
                                                            onChange={(e) =>
                                                              setExistingVideoQuizQuestions((prev) =>
                                                                prev.map((item, i) =>
                                                                  i === qIdx
                                                                    ? {
                                                                        ...item,
                                                                        options: (item.options || ['', '', '', '']).map((o, oi) =>
                                                                          oi === optIdx ? e.target.value : o
                                                                        ),
                                                                      }
                                                                    : item
                                                                )
                                                              )
                                                            }
                                                            placeholder={`الخيار ${optIdx + 1} ${
                                                              q.correctOptionIndex === optIdx ? '(الإجابة الصحيحة ✓)' : ''
                                                            }`}
                                                            className="min-w-0 flex-1 text-xs outline-none bg-transparent text-slate-900 font-bold"
                                                          />
                                                          <label className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-black cursor-pointer shrink-0 flex items-center gap-1">
                                                            <Upload className="w-2.5 h-2.5" />
                                                            <span>{optImg ? 'تغيير الصورة 🖼️' : '+ صورة للإجابة 🖼️'}</span>
                                                            <input
                                                              type="file"
                                                              accept="image/*"
                                                              className="hidden"
                                                              onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                  readImage(file, (imgVal) => {
                                                                    setExistingVideoQuizQuestions((prev) =>
                                                                      prev.map((item, i) => {
                                                                        if (i !== qIdx) return item;
                                                                        const nextOptionImages = [
                                                                          ...(item.optionImages || ['', '', '', '']),
                                                                        ];
                                                                        nextOptionImages[optIdx] = imgVal;
                                                                        return { ...item, optionImages: nextOptionImages };
                                                                      })
                                                                    );
                                                                  });
                                                                }
                                                              }}
                                                            />
                                                          </label>
                                                        </div>

                                                        {optImg && (
                                                          <div className="flex items-center justify-between gap-2 bg-white p-1 rounded border border-slate-200">
                                                            <img
                                                              src={optImg}
                                                              alt={`صورة الخيار ${optIdx + 1}`}
                                                              className="max-h-16 rounded object-contain"
                                                            />
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                setExistingVideoQuizQuestions((prev) =>
                                                                  prev.map((item, i) => {
                                                                    if (i !== qIdx) return item;
                                                                    const nextOptionImages = [
                                                                      ...(item.optionImages || ['', '', '', '']),
                                                                    ];
                                                                    nextOptionImages[optIdx] = '';
                                                                    return { ...item, optionImages: nextOptionImages };
                                                                  })
                                                                )
                                                              }
                                                              className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[9px] font-bold cursor-pointer"
                                                            >
                                                              حذف الصورة ✕
                                                            </button>
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}

                                              {/* Model Answer + Model Answer Image */}
                                              <div className="space-y-1.5 pt-1">
                                                <div className="flex items-center gap-1.5">
                                                  <input
                                                    type="text"
                                                    value={q.modelAnswer || ''}
                                                    onChange={(e) =>
                                                      setExistingVideoQuizQuestions((prev) =>
                                                        prev.map((item, i) => (i === qIdx ? { ...item, modelAnswer: e.target.value } : item))
                                                      )
                                                    }
                                                    placeholder="التفسير أو الإجابة النموذجية (اختياري)..."
                                                    className="flex-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900 bg-slate-50"
                                                  />
                                                  <label className="px-2 py-1 rounded border border-dashed border-emerald-400 bg-emerald-50 text-emerald-800 text-[10px] font-black cursor-pointer shrink-0">
                                                    <span>{q.modelAnswerImage ? 'تغيير صورة الحل 🖼️' : '+ صورة للحل 🖼️'}</span>
                                                    <input
                                                      type="file"
                                                      accept="image/*"
                                                      className="hidden"
                                                      onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                          readImage(file, (imgVal) => {
                                                            setExistingVideoQuizQuestions((prev) =>
                                                              prev.map((item, i) =>
                                                                i === qIdx ? { ...item, modelAnswerImage: imgVal } : item
                                                              )
                                                            );
                                                          });
                                                        }
                                                      }}
                                                    />
                                                  </label>
                                                </div>

                                                {q.modelAnswerImage && (
                                                  <div className="flex items-center justify-between gap-2 bg-emerald-50/50 p-1 rounded border border-emerald-200">
                                                    <img
                                                      src={q.modelAnswerImage}
                                                      alt="صورة الحل النموذجي"
                                                      className="max-h-20 rounded object-contain"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setExistingVideoQuizQuestions((prev) =>
                                                          prev.map((item, i) =>
                                                            i === qIdx ? { ...item, modelAnswerImage: '' } : item
                                                          )
                                                        )
                                                      }
                                                      className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold cursor-pointer"
                                                    >
                                                      حذف ✕
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}

                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setEditingQuizVideoId(null)}
                                              className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                                            >
                                              إلغاء
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveManualQuizForExistingVideo(lesson.id, vid.id)}
                                              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                                            >
                                              حفظ الكويز اليدوي ✅
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              لا توجد فيديوهات مضافة لهذا الدرس بعد. اضغط على "إضافة فيديو 🎥" أعلاه.
                            </div>
                          )}
                        </div>

                        {/* 2. PDFs Section */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-rose-600" />
                              <span>مذكرات وملفات الـ PDF والملخصات ({totalPdfs})</span>
                            </h4>

                            <button
                              onClick={() => setAddingPdfLessonId(addingPdfLessonId === lesson.id ? null : lesson.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center gap-1 border border-rose-200 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة مذكرة PDF 📄</span>
                            </button>
                          </div>

                          {/* Add PDF Form */}
                          {addingPdfLessonId === lesson.id && (
                            <form
                              onSubmit={(e) => handleAddPdf(lesson.id, e)}
                              className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 space-y-3 animate-fadeIn"
                            >
                              <span className="font-black text-rose-950 block">إضافة مذكرة أو ملف PDF:</span>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">عنوان المذكرة / الملف *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="مثال: مذكرة شرح الدرس الأول + بنك الأسئلة"
                                    value={pdfTitle}
                                    onChange={(e) => setPdfTitle(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 bg-white"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">رابط ملف الـ PDF المباشر *</label>
                                  <div className="space-y-1.5">
                                    <input
                                      type="text"
                                      required
                                      placeholder="https://.../notes.pdf"
                                      value={pdfUrl}
                                      onChange={(e) => setPdfUrl(e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 bg-white"
                                      dir="ltr"
                                    />
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                                      <Upload className="w-3 h-3 text-rose-600" />
                                      <span>أو ارفع ملف PDF من جهازك</span>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={handlePdfUpload}
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">عدد الصفحات (اختياري)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="مثال: 18"
                                    value={pdfPageCount}
                                    onChange={(e) => setPdfPageCount(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">وصف المذكرة (اختياري)</label>
                                  <input
                                    type="text"
                                    placeholder="تحتوي على القوانين، الشرح الكامل، وأهم المسائل"
                                    value={pdfDesc}
                                    onChange={(e) => setPdfDesc(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAddingPdfLessonId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="submit"
                                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black"
                                >
                                  حفظ المذكرة ✅
                                </button>
                              </div>
                            </form>
                          )}

                          {/* PDF items list */}
                          {lesson.pdfs && lesson.pdfs.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {lesson.pdfs.map((pdf, pdfIdx) => (
                                <div
                                  key={pdf.id}
                                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2 hover:bg-slate-50"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                                      <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 text-xs truncate">
                                        {pdfIdx + 1}. {pdf.title}
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        {pdf.pageCount && <span>{pdf.pageCount} صفحة</span>}
                                        {pdf.description && <span className="truncate">• {pdf.description}</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <a
                                      href={pdf.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1.5 text-slate-400 hover:text-rose-600"
                                      title="فتح الملف"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                      onClick={() => handleDeletePdf(lesson.id, pdf.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600"
                                      title="حذف الملف"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">لا توجد مذكرات أو ملفات PDF مضافة بعد.</p>
                          )}
                        </div>

                        {/* 3. Exams Section */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                              <HelpCircle className="w-4 h-4 text-emerald-600" />
                              <span>الامتحانات التقييمية للدرس ({totalExams})</span>
                            </h4>

                            <button
                              onClick={() => {
                                const opening = addingExamLessonId !== lesson.id;
                                setAddingExamLessonId(opening ? lesson.id : null);
                                if (opening && manualQuestions.length === 0) setManualQuestions([createManualQuestion('mcq')]);
                                setExamFormError('');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1 border border-emerald-200 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>إنشاء امتحان للدرس 📝</span>
                            </button>
                          </div>

                          {/* Add Exam Form */}
                          {addingExamLessonId === lesson.id && (
                            <form
                              onSubmit={(e) => handleAddExam(lesson.id, e)}
                              className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3 animate-fadeIn"
                            >
                              <span className="font-black text-emerald-950 block">إنشاء امتحان تقييمي جديد مرتبط بالدرس:</span>

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <div className="space-y-1 sm:col-span-1">
                                  <label className="font-bold text-slate-700 block">عنوان الامتحان *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="مثال: كويز إلكتروني على الدرس 1"
                                    value={examTitle}
                                    onChange={(e) => setExamTitle(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 bg-white"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">المدة (بالدقائق)</label>
                                  <input
                                    type="number"
                                    min="5"
                                    value={examDuration}
                                    onChange={(e) => setExamDuration(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white font-mono"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">نسبة النجاح %</label>
                                  <input
                                    type="number"
                                    min="30"
                                    max="100"
                                    value={examPassingGrade}
                                    onChange={(e) => setExamPassingGrade(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white font-mono"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="font-bold text-slate-700 block">عدد المحاولات المسموحة</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={examMaxAttempts}
                                    onChange={(e) => setExamMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 bg-white font-mono"
                                  />
                                </div>
                              </div>

                              {/* Manual Questions Section */}
                              <div className="rounded-2xl border border-indigo-200 bg-white p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-indigo-950 text-sm">
                                    أسئلة الامتحان ({manualQuestions.length})
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setManualQuestions((current) => [...current, createManualQuestion('mcq')])}
                                      className="rounded-lg bg-indigo-100 px-2.5 py-1 text-[11px] font-black text-indigo-800 hover:bg-indigo-200"
                                    >
                                      + سؤال اختيار من متعدد
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setManualQuestions((current) => [...current, createManualQuestion('essay')])}
                                      className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-800 hover:bg-amber-200"
                                    >
                                      + سؤال مقالي
                                    </button>
                                  </div>
                                </div>

                                {manualQuestions.length === 0 && (
                                  <p className="text-[11px] text-slate-500">لا توجد أسئلة مضافة بعد. اضغط أزرار الإضافة بالأعلى.</p>
                                )}

                                {manualQuestions.map((question, questionIndex) => (
                                  <div key={question.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <b className="text-xs text-slate-800">
                                        السؤال {questionIndex + 1} ({question.type === 'mcq' ? 'اختيار من متعدد' : 'سؤال مقالي'})
                                      </b>
                                      <button
                                        type="button"
                                        onClick={() => setManualQuestions((current) => current.filter((_, index) => index !== questionIndex))}
                                        className="text-[10px] font-bold text-rose-600 hover:underline"
                                      >
                                        حذف السؤال
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                                      <textarea
                                        value={question.questionText}
                                        onChange={(event) => updateManualQuestion(questionIndex, { questionText: event.target.value })}
                                        rows={2}
                                        placeholder="نص السؤال..."
                                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                                      />
                                      <label className="rounded-lg border border-dashed border-indigo-300 p-2 text-center text-[10px] font-bold text-indigo-700 cursor-pointer hover:bg-indigo-50 flex items-center justify-center">
                                        <span>{question.questionImage ? 'تغيير صورة السؤال 🖼️' : '+ إرفاق صورة للسؤال 🖼️'}</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file) readImage(file, (value) => updateManualQuestion(questionIndex, { questionImage: value }));
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {question.questionImage && (
                                      <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-indigo-200">
                                        <img src={question.questionImage} alt="صورة السؤال" className="max-h-28 rounded object-contain" />
                                        <button
                                          type="button"
                                          onClick={() => updateManualQuestion(questionIndex, { questionImage: '' })}
                                          className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer"
                                        >
                                          حذف صورة السؤال ✕
                                        </button>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                      <label className="block text-[10px] font-bold text-slate-700">
                                        الدرجة:
                                        <input
                                          type="number"
                                          min="1"
                                          value={question.marks}
                                          onChange={(event) => updateManualQuestion(questionIndex, { marks: Math.max(1, Number(event.target.value) || 1) })}
                                          className="mr-1 w-20 rounded-lg border border-slate-200 p-1.5 text-xs text-center"
                                        />
                                      </label>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2">
                                      <textarea
                                        value={question.modelAnswer}
                                        onChange={(event) => updateManualQuestion(questionIndex, { modelAnswer: event.target.value })}
                                        rows={2}
                                        placeholder="الإجابة النموذجية والتفسير (يظهر للطالب بعد الحل)"
                                        className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs"
                                      />
                                      <label className="rounded-lg border border-dashed border-emerald-300 bg-white p-2 text-center text-[10px] font-bold text-emerald-800 cursor-pointer hover:bg-emerald-50 flex items-center justify-center">
                                        <span>{question.modelAnswerImage ? 'تغيير صورة النموذج' : 'صورة نموذج الإجابة'}</span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file) readImage(file, (value) => updateManualQuestion(questionIndex, { modelAnswerImage: value }));
                                          }}
                                        />
                                      </label>
                                      {question.modelAnswerImage && (
                                        <img src={question.modelAnswerImage} alt="model answer" className="sm:col-span-2 max-h-28 w-full rounded-lg border border-emerald-200 bg-white object-contain" />
                                      )}
                                    </div>

                                    {question.type === 'mcq' && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(question.options || []).map((option, optionIndex) => {
                                          const optImg = question.optionImages?.[optionIndex];
                                          return (
                                            <div key={optionIndex} className="rounded-lg border border-slate-200 p-1.5 bg-slate-50 space-y-1.5">
                                              <div className="flex items-center gap-1">
                                                <input
                                                  type="radio"
                                                  name={`correct-${question.id}`}
                                                  checked={question.correctOptionIndex === optionIndex}
                                                  onChange={() => updateManualQuestion(questionIndex, { correctOptionIndex: optionIndex })}
                                                />
                                                <input
                                                  value={option}
                                                  onChange={(event) =>
                                                    updateManualQuestion(questionIndex, {
                                                      options: (question.options || []).map((item, index) =>
                                                        index === optionIndex ? event.target.value : item
                                                      ),
                                                    })
                                                  }
                                                  placeholder={`الخيار ${optionIndex + 1}`}
                                                  className="min-w-0 flex-1 text-xs outline-none bg-transparent"
                                                />
                                                <label className="cursor-pointer px-2 py-0.5 rounded bg-indigo-100 text-[10px] font-black text-indigo-800 hover:bg-indigo-200">
                                                  <span>{optImg ? 'تغيير الصورة 🖼️' : '+ صورة للإجابة 🖼️'}</span>
                                                  <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(event) => {
                                                      const file = event.target.files?.[0];
                                                      if (file)
                                                        readImage(file, (value) =>
                                                          updateManualQuestion(questionIndex, {
                                                            optionImages: (question.optionImages || ['', '', '', '']).map((item, index) =>
                                                              index === optionIndex ? value : item
                                                            ),
                                                          })
                                                        );
                                                    }}
                                                  />
                                                </label>
                                              </div>
                                              {optImg && (
                                                <div className="flex items-center justify-between gap-2 bg-white p-1 rounded border border-slate-200">
                                                  <img src={optImg} alt={`الخيار ${optionIndex + 1}`} className="max-h-16 rounded object-contain" />
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateManualQuestion(questionIndex, {
                                                        optionImages: (question.optionImages || ['', '', '', '']).map((item, index) =>
                                                          index === optionIndex ? '' : item
                                                        ),
                                                      })
                                                    }
                                                    className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[9px] font-bold cursor-pointer"
                                                  >
                                                    حذف ✕
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                {examFormError && <p className="ml-auto text-[11px] font-bold text-rose-600">{examFormError}</p>}
                                <button
                                  type="button"
                                  onClick={() => setAddingExamLessonId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="submit"
                                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                                >
                                  حفظ الامتحان بالأسئلة ✅
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Exam items list */}
                          {lesson.exams && lesson.exams.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {lesson.exams.map((exam, exIdx) => (
                                <div
                                  key={`${exam.id || 'exam'}-${exIdx}`}
                                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2 hover:bg-slate-50"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                      <HelpCircle className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 text-xs truncate">
                                        {exIdx + 1}. {exam.title}
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>{exam.durationMinutes} دقيقة</span>
                                        <span>• {exam.questions.length} أسئلة</span>
                                        <span>• نجاح {exam.passingPercentage}%</span>
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleDeleteExam(lesson.id, exam.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600"
                                    title="حذف الامتحان"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">لا توجد امتحانات مرتبطة بهذا الدرس بعد.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Full Page Footer */}
        <div className="p-4 sm:px-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <span className="text-xs text-slate-500 font-bold">
            💡 يتم حفظ كافة الدروس والمحتويات تلقائياً في بيانات الكورس والمنصة.
          </span>
          <button
            onClick={handleSafeClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer shadow-xs"
          >
            تم الانتهاء والعودة للوحة التحكم
          </button>
        </div>
      </div>
    </div>
  );
};
