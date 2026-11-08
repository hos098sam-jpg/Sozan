import fs from "fs";
import path from "path";

export const DEFAULT_PLATFORM_PHONE = "";

/**
 * Formats any Egyptian or international phone number to WhatsApp standard digits (e.g., 201012345678)
 * Used ONLY for generating direct click-to-chat wa.me links for teachers.
 */
export function formatWhatsAppPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("01") && digits.length === 11) {
    digits = "2" + digits;
  } else if (digits.length === 10 && digits.startsWith("1")) {
    digits = "20" + digits;
  }
  return digits;
}

export interface WhatsAppSendResult {
  success: boolean;
  deliveredDirectly: boolean;
  requiresUserInitiatedChat?: boolean;
  whatsappTriggerLink?: string;
  platformWhatsAppPhone?: string;
  mode: "disabled";
  recipient: string;
  messageId?: string;
  error?: string;
}

export interface WhatsAppDeliveryLog {
  id: string;
  timestamp: string;
  phone: string;
  otp: string;
  status: "disabled";
  message: string;
}

/**
 * Automated WhatsApp Bot has been permanently disabled and removed
 * to protect phone numbers from WhatsApp bans.
 * Password recovery now operates exclusively via Email (hos098sam@gmail.com).
 */
class WhatsAppBaileysManager {
  constructor() {
    // Clean up any old Baileys session directory so it never reconnects
    try {
      const authDir = path.join(process.cwd(), "whatsapp_session_auth");
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }

  public setBotpressConfig(_cfg: any) {}
  public clearBotpressConfig() {}
  public getBotpressConfig() {
    return { pat: "", botId: "", webhookId: "", conversationId: "" };
  }
  public setMetaConfig(_cfg: any) {}
  public clearMetaConfig() {}
  public getMetaConfig() {
    return { hasToken: false, phoneNumberId: "", wabaId: "", templateName: "" };
  }
  public getConfiguredPhone(): string {
    return "";
  }
  public setConfiguredPhone(_phone: string) {}

  public async connect(_phoneForPairing?: string): Promise<void> {
    // No-op: Automated WhatsApp connection is permanently disabled
  }

  public async requestQrCode(_phoneNumber?: string): Promise<{
    success: boolean;
    qrDataUrl?: string;
    error?: string;
  }> {
    return {
      success: false,
      error: "تم إيقاف ربط الواتساب التلقائي نهائياً لحماية الأرقام من الحظر. المنصة تعمل الآن عبر البريد الإلكتروني الرسمي.",
    };
  }

  public async changePhoneNumber(_newPhone: string): Promise<{
    success: boolean;
    configuredPhone: string;
    error?: string;
  }> {
    return {
      success: false,
      configuredPhone: "",
      error: "تم إيقاف ربط الواتساب التلقائي نهائياً.",
    };
  }

  public async requestPairingCode(_phoneNumber?: string): Promise<{
    success: boolean;
    code?: string;
    error?: string;
  }> {
    return {
      success: false,
      error: "تم إيقاف ربط الواتساب التلقائي نهائياً لحماية الأرقام من الحظر.",
    };
  }

  public async sendOtp(
    rawRecipientPhone: string,
    _otpCode: string,
    _customMessage?: string,
    _forceDirectSend: boolean = false
  ): Promise<WhatsAppSendResult> {
    return {
      success: false,
      deliveredDirectly: false,
      mode: "disabled",
      recipient: formatWhatsAppPhone(rawRecipientPhone),
      error: "تم إيقاف إرسال رسائل الواتساب التلقائية. يتم إرسال رمز الاسترداد عبر البريد الإلكتروني.",
    };
  }

  public getStatus() {
    return {
      configuredPhone: "",
      formattedPhone: "",
      status: "disconnected",
      isConnected: false,
      isBaileysConnected: false,
      connectedNumber: null,
      connectedAt: null,
      qrDataUrl: null,
      pairingCode: null,
      lastError: null,
      lastMetaError: null,
      lastBotpressError: null,
      sessionExists: false,
      metaCloudApiConfigured: false,
      metaPhoneNumberId: null,
      botpressConfigured: false,
      botpressBotId: "",
      botpressWebhookUrl: "",
      activeProvider: "offline",
      recentLogs: [] as WhatsAppDeliveryLog[],
    };
  }

  public async restart(_phone?: string): Promise<void> {}
  public async logout(): Promise<void> {}
}

export const whatsappManager = new WhatsAppBaileysManager();

export async function sendOtpViaBaileys(
  rawRecipientPhone: string,
  otpCode: string
): Promise<WhatsAppSendResult> {
  return whatsappManager.sendOtp(rawRecipientPhone, otpCode);
}

export async function sendParentOtpViaBaileys(
  rawParentPhone: string,
  otpCode: string,
  _studentName: string = "الطالب"
): Promise<WhatsAppSendResult> {
  return whatsappManager.sendOtp(rawParentPhone, otpCode);
}
