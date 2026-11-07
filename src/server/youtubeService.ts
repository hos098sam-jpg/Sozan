import axios from 'axios';
import * as fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

// ============================================================================
// 1. إعداد خيارات المصادقة مع جوجل (OAuth2) & YouTube API v3 (REST)
// ============================================================================
async function getGoogleAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    return res.data?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * دالة رفع الفيديو برمجياً من خادمك إلى يوتيوب وجعله غير مدرج تلقائياً (Unlisted)
 * @param filePath المسار الفعلي لملف الفيديو المرفوع على الخادم
 * @param title عنوان الدرس/المحاضرة
 * @param description وصف المحاضرة وروابط الملازم
 * @returns معرف الفيديو على يوتيوب (Video ID)
 */
export const uploadVideoToYouTube = async (
  filePath: string,
  title: string,
  description: string
): Promise<string | null> => {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`ملف الفيديو غير موجود في المسار: ${filePath}`);
      return null;
    }

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      console.error('لم يتم إعداد بيانات مصادقة YouTube OAuth2.');
      return null;
    }

    const stat = fs.statSync(filePath);
    const initRes = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        snippet: {
          title,
          description,
          categoryId: '27',
        },
        status: {
          privacyStatus: 'unlisted',
          embeddable: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(stat.size),
          'X-Upload-Content-Type': 'video/mp4',
        },
      }
    );

    const uploadUrl = initRes.headers?.location;
    if (!uploadUrl) return null;

    const uploadRes = await axios.put(uploadUrl, fs.createReadStream(filePath), {
      headers: {
        'Content-Length': String(stat.size),
        'Content-Type': 'video/mp4',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const videoId = uploadRes.data?.id || null;
    console.log(`[YouTube API] تم رفع الفيديو بنجاح بمعرف: ${videoId}`);
    return videoId;
  } catch (error) {
    console.error('خطأ أثناء رفع الفيديو إلى YouTube:', error);
    return null;
  }
};


// ============================================================================
// 2. دوال التحقق من اشتراك الطالب وجلب معرف الفيديو من قاعدة بيانات المنصة
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');

/**
 * التحقق من اشتراك الطالب في الكورس والدرس من قاعدة بيانات المنصة
 */
export async function checkStudentSubscriptionInDB(studentId?: string, lessonOrVideoId?: string): Promise<boolean> {
  if (!lessonOrVideoId) return false;

  // 1. قراءة الكورسات من قاعدة البيانات للتعرف على الكورس التابع له هذا الدرس
  let courses: any[] = [];
  try {
    if (fs.existsSync(COURSES_FILE)) {
      courses = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
    }
  } catch {}

  let matchedCourse: any = null;
  for (const c of courses) {
    if (Array.isArray(c.lessons)) {
      for (const l of c.lessons) {
        if (l.id === lessonOrVideoId) {
          matchedCourse = c;
          break;
        }
        if (Array.isArray(l.videos)) {
          if (l.videos.some((v: any) => v.id === lessonOrVideoId || v.youtubeId === lessonOrVideoId)) {
            matchedCourse = c;
            break;
          }
        }
      }
    }
    if (matchedCourse) break;
  }

  // إذا كان الكورس مجانياً للجميع
  if (matchedCourse && matchedCourse.isFree) {
    return true;
  }

  if (!studentId) return false;

  // 2. قراءة بيانات المستخدمين من قاعدة البيانات
  let users: any[] = [];
  try {
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch {}

  const user = users.find((u: any) => u.id === studentId || u.phone === studentId || u.email === studentId);
  if (!user) return false;

  // المشرف والمعلم لهما صلاحية الوصول المباشر
  if (user.role === 'admin' || user.role === 'teacher' || user.email === 'hos098sam@gmail.com') {
    return true;
  }

  // إذا لم يتم تحديد كورس معين وكان الدرس غير موجود، نتحقق من وجود أي كورس مفعل للطالب
  if (!matchedCourse) {
    return Array.isArray(user.enrolledCourseIds) && user.enrolledCourseIds.length > 0;
  }

  // التحقق من اشتراك الطالب في الكورس المحدد
  const enrolledIds: string[] = Array.isArray(user.enrolledCourseIds) ? user.enrolledCourseIds : [];
  return enrolledIds.includes(matchedCourse.id);
}

/**
 * جلب معرف فيديو اليوتيوب المخزن في قاعدة بيانات المنصة لهذا الدرس
 */
export async function getVideoIdFromDB(lessonOrVideoId: string): Promise<string> {
  let courses: any[] = [];
  try {
    if (fs.existsSync(COURSES_FILE)) {
      courses = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
    }
  } catch {}

  for (const c of courses) {
    if (Array.isArray(c.lessons)) {
      for (const l of c.lessons) {
        if (Array.isArray(l.videos)) {
          for (const v of l.videos) {
            if (v.id === lessonOrVideoId || l.id === lessonOrVideoId) {
              if (v.youtubeId) return v.youtubeId;
              if (v.url) {
                // استخراج معرف اليوتيوب إذا كان الرابط كاملاً
                const match = v.url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                if (match && match[1]) return match[1];
                return v.url;
              }
            }
          }
        }
      }
    }
  }

  // فحص مباشر إذا كان المعرف الممرر رابط يوتيوب مباشر أو كود فيديو
  if (lessonOrVideoId) {
    const match = lessonOrVideoId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match && match[1]) return match[1];
  }

  // معرف افتراضي آمن أو المعرف الممرر مباشرة إذا كان بطول معرفات اليوتيوب (11 حرف)
  if (lessonOrVideoId && lessonOrVideoId.length === 11 && !lessonOrVideoId.includes('/') && !lessonOrVideoId.includes(' ')) {
    return lessonOrVideoId;
  }

  return "dQw4w9WgXcQ";
}

// ============================================================================
// 3. نقطة التحقق من الاشتراك واستخراج توكن الفيديو المشفر (Base64 Secure Token)
// ============================================================================

export const checkSubscriptionAndGetVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    // استخراج معرف الطالب من التوكن أو الهيدر أو الـ Session
    const user = (req as any).user;
    const studentId: string =
      user?.id ||
      user?.uid ||
      (req.headers['x-student-id'] as string) ||
      (req.query.studentId as string) ||
      '';

    const lessonId = req.params.lessonId || (req.query.lessonId as string);

    if (!lessonId) {
      res.status(400).json({ status: 'blocked', message: 'معرف الدرس غير محدد.' });
      return;
    }

    // 1. التحقق من قاعدة البيانات: هل الطالب مشترك ومفعل؟
    const isSubscribed: boolean = await checkStudentSubscriptionInDB(studentId, lessonId);

    if (!isSubscribed) {
      res.status(403).json({
        status: 'blocked',
        message: 'عذراً، هذا الفيديو متاح للمشتركين فقط. يرجى تفعيل اشتراكك.',
      });
      return;
    }

    // 2. إذا كان مشتركاً، نجلب الـ Video ID الخاص بيوتيوب والمخزن مسبقاً في قاعدة بياناتك
    const realVideoId: string = await getVideoIdFromDB(lessonId);

    // 3. تشفير الـ ID بصيغة Base64 لحجبه عن العين المجردة ومنع نسخ الرابط المباشر
    const secureToken: string = Buffer.from(realVideoId).toString('base64');

    // 4. إرسال الإذن والتوكن للفرونت إند للتشغيل
    res.status(200).json({
      status: 'allowed',
      secureToken: secureToken,
    });
  } catch (error) {
    console.error('خطأ في التحقق من فيديو الدرس:', error);
    res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
  }
};

// ============================================================================
// 4. دالة استخراج بيانات الدرس والتوكن المشفر (Base64 Video.js Payload)
// ============================================================================

export interface LessonPayload {
  lessonTitle: string;
  secureToken: string; // الرابط المشفر الذي سيقرأه المتصفح
}

export const getSecureLessonVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const lessonId = req.params.lessonId || (req.query.lessonId as string) || "102";

    // 1. ضع هنا الـ ID الحقيقي للفيديو من يوتيوب (يتم جلبها عادةً من قاعدة البيانات)
    const youtubeVideoId: string = (await getVideoIdFromDB(lessonId)) || "dQw4w9WgXcQ";

    // محاولة جلب عنوان الدرس الفعلي من قاعدة البيانات
    let lessonTitle = "الدرس الأول: بنية البيانات وخوارزميات البحث";
    try {
      if (fs.existsSync(COURSES_FILE)) {
        const courses = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
        for (const c of courses) {
          if (Array.isArray(c.lessons)) {
            const found = c.lessons.find((l: any) => l.id === lessonId);
            if (found && found.title) {
              lessonTitle = found.title;
              break;
            }
          }
        }
      }
    } catch {}

    // 2. تشفير الـ ID برمجياً إلى صيغة Base64 لتغيير معالمه تماماً
    const secureToken: string = Buffer.from(youtubeVideoId).toString('base64');

    // 3. إرسال البيانات للواجهة الأمامية
    const responseData: LessonPayload = {
      lessonTitle: lessonTitle,
      secureToken: secureToken, // النتيجة ستكون نصاً مبهماً مثل: ZFF3NHc5V2dYY1E=
    };

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء معالجة بيانات الفيديو" });
  }
};
