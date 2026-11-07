import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export const OFFICIAL_RECOVERY_EMAIL = "qalbalelm@gmail.com";
export const DAILY_GMAIL_LIMIT = 500;

export interface EmailConfigData {
  senderEmail: string;
  appPassword: string;
  senderName: string;
  updatedAt: string;
  dailyDate: string;
  sentCountToday: number;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    toEmail: string;
    studentName: string;
    status: "sent" | "failed";
    error?: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const EMAIL_CONFIG_PATH = path.join(DATA_DIR, "email_config.json");

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function loadEmailConfig(): EmailConfigData {
  const today = getTodayDateString();
  const defaultCfg: EmailConfigData = {
    senderEmail: OFFICIAL_RECOVERY_EMAIL,
    appPassword: (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
    senderName: "منصة قلب العلم التعليمية",
    updatedAt: new Date().toISOString(),
    dailyDate: today,
    sentCountToday: 0,
    recentLogs: [],
  };

  try {
    if (fs.existsSync(EMAIL_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(EMAIL_CONFIG_PATH, "utf-8"));
      const appPass = (
        raw.appPassword ||
        process.env.GMAIL_APP_PASSWORD ||
        process.env.EMAIL_APP_PASSWORD ||
        ""
      ).replace(/\s+/g, "");
      const isSameDay = raw.dailyDate === today;
      return {
        senderEmail: OFFICIAL_RECOVERY_EMAIL,
        appPassword: appPass,
        senderName: raw.senderName || "منصة قلب العلم التعليمية",
        updatedAt: raw.updatedAt || defaultCfg.updatedAt,
        dailyDate: today,
        sentCountToday: isSameDay ? Number(raw.sentCountToday || 0) : 0,
        recentLogs: Array.isArray(raw.recentLogs) ? raw.recentLogs.slice(0, 40) : [],
      };
    }
  } catch (err) {
    console.warn("Could not read email_config.json:", err);
  }
  return defaultCfg;
}

export function saveEmailConfig(partial: Partial<EmailConfigData>): EmailConfigData {
  const current = loadEmailConfig();
  const updated: EmailConfigData = {
    ...current,
    ...partial,
    senderEmail: OFFICIAL_RECOVERY_EMAIL, // Strictly locked to qalbalelm@gmail.com for Qalb El-Elm
    appPassword:
      partial.appPassword !== undefined
        ? String(partial.appPassword).replace(/\s+/g, "")
        : current.appPassword,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(EMAIL_CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write email_config.json:", err);
  }

  return updated;
}

export function maskEmailAddress(email: string): string {
  const clean = String(email || "").trim();
  const [localPart, domain] = clean.split("@");
  if (!localPart || !domain) return clean;
  if (localPart.length <= 2) return `${localPart[0]}***@${domain}`;
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

export async function sendPasswordRecoveryEmail(params: {
  toEmail: string;
  otpCode: string;
  studentName?: string;
  studentPhone?: string;
}): Promise<{
  success: boolean;
  delivered: boolean;
  senderEmail: string;
  recipientEmail: string;
  maskedEmail: string;
  remainingToday: number;
  error?: string;
}> {
  const cfg = loadEmailConfig();
  const recipient = String(params.toEmail || "").trim().toLowerCase();
  const studentName = params.studentName || "طالب منصة قلب العلم";

  if (!recipient || !recipient.includes("@")) {
    return {
      success: false,
      delivered: false,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      recipientEmail: recipient,
      maskedEmail: maskEmailAddress(recipient),
      remainingToday: Math.max(0, DAILY_GMAIL_LIMIT - cfg.sentCountToday),
      error: "يرجى إدخال عنوان بريد إلكتروني صحيح لاستلام رمز الاسترداد.",
    };
  }

  if (!cfg.appPassword || cfg.appPassword.length < 8) {
    return {
      success: false,
      delivered: false,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      recipientEmail: recipient,
      maskedEmail: maskEmailAddress(recipient),
      remainingToday: Math.max(0, DAILY_GMAIL_LIMIT - cfg.sentCountToday),
      error:
        "لم يتم تفعيل كلمة مرور التطبيقات (App Password) للبريد الرسمي qalbalelm@gmail.com بعد في لوحة الإدارة.",
    };
  }

  if (cfg.sentCountToday >= DAILY_GMAIL_LIMIT) {
    return {
      success: false,
      delivered: false,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      recipientEmail: recipient,
      maskedEmail: maskEmailAddress(recipient),
      remainingToday: 0,
      error: "تم الوصول إلى الحد الأقصى اليومي المجاني لإرسال رسائل البريد الإلكتروني (500 رسالة/يوم). يتجدد الرصيد تلقائياً كل 24 ساعة.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: OFFICIAL_RECOVERY_EMAIL,
        pass: cfg.appPassword,
      },
    });

    const htmlBody = `
      <div dir="rtl" style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; max-width: 560px; margin: 0 auto; background-color: #f8fafc; padding: 24px; border-radius: 20px; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; padding: 24px; border-radius: 16px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800;">منصة قلب العلم التعليمية 🎓</h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #c7d2fe;">استرداد كلمة المرور عبر البريد الإلكتروني الرسمي</p>
        </div>

        <div style="background-color: #ffffff; padding: 24px; border-radius: 16px; margin-top: 16px; border: 1px solid #e2e8f0; color: #1e293b;">
          <p style="font-size: 15px; font-weight: 700; margin-top: 0;">مرحباً بك يا <span style="color: #4f46e5;">${studentName}</span>،</p>
          <p style="font-size: 13px; line-height: 1.7; color: #475569;">
            تلقينا طلباً لاستعادة وتغيير كلمة المرور الخاصة بحسابك في <strong>منصة قلب العلم</strong>${params.studentPhone ? ` (المرتبط برقم: <span dir="ltr">${params.studentPhone}</span>)` : ""}.
            استخدم رمز الاسترداد المكون من 6 أرقام التالي لإتمام العملية:
          </p>

          <div style="margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #eef2ff; border: 2px dashed #4f46e5; border-radius: 16px; padding: 16px 32px;">
              <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #312e81;">
                ${params.otpCode}
              </span>
            </div>
          </div>

          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">
            ⏳ هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط. لا تشارك هذا الرمز مع أي شخص حفاظاً على أمان حسابك.
          </p>
        </div>

        <div style="text-align: center; margin-top: 16px; font-size: 11px; color: #94a3b8;">
          تم الإرسال تلقائياً من البريد الرسمي لمنصة قلب العلم (${OFFICIAL_RECOVERY_EMAIL})
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${cfg.senderName}" <${OFFICIAL_RECOVERY_EMAIL}>`,
      to: recipient,
      subject: `رمز استرداد كلمة المرور: [${params.otpCode}] - منصة قلب العلم`,
      text: `مرحباً ${studentName}، رمز استرداد كلمة المرور لحسابك في منصة قلب العلم هو: ${params.otpCode} (صالح لمدة 10 دقائق).`,
      html: htmlBody,
    });

    const newCount = cfg.sentCountToday + 1;
    const newLogs = [
      {
        id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        toEmail: recipient,
        studentName,
        status: "sent" as const,
      },
      ...cfg.recentLogs,
    ].slice(0, 40);

    saveEmailConfig({
      dailyDate: getTodayDateString(),
      sentCountToday: newCount,
      recentLogs: newLogs,
    });

    return {
      success: true,
      delivered: true,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      recipientEmail: recipient,
      maskedEmail: maskEmailAddress(recipient),
      remainingToday: Math.max(0, DAILY_GMAIL_LIMIT - newCount),
    };
  } catch (err: any) {
    console.error("Nodemailer send error:", err?.message || err);
    const newLogs = [
      {
        id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        toEmail: recipient,
        studentName,
        status: "failed" as const,
        error: err?.message || "SMTP Error",
      },
      ...cfg.recentLogs,
    ].slice(0, 40);

    saveEmailConfig({ recentLogs: newLogs });

    return {
      success: false,
      delivered: false,
      senderEmail: OFFICIAL_RECOVERY_EMAIL,
      recipientEmail: recipient,
      maskedEmail: maskEmailAddress(recipient),
      remainingToday: Math.max(0, DAILY_GMAIL_LIMIT - cfg.sentCountToday),
      error:
        "تعذر إرسال البريد الإلكتروني. يرجى التأكد من صحة كلمة مرور التطبيقات (App Password) المكونة من 16 حرفاً الخاصة بحساب qalbalelm@gmail.com في لوحة الإدارة.",
    };
  }
}
