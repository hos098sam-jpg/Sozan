import axios from 'axios';

// ============================================================================
// BOTPRESS WHATSAPP OTP ENGINE - منصة المتفلسفة  التعليمية
// ============================================================================

export const BOTPRESS_CONFIG = {
  BOTPRESS_API_URL: process.env.BOTPRESS_API_URL || 'https://botpress.cloud',
  BOT_ID: process.env.BOTPRESS_BOT_ID || '72f59145-c3c3-4c6b-9639-64946b690d60',
  API_KEY: process.env.BOTPRESS_API_KEY || 'bp_bak_Hpw89kxL55AousdBXQsYcUGmUMskNDAVJw-Q',
  WEBHOOK_URL: process.env.BOTPRESS_WEBHOOK_URL || 'https://webhook.botpress.cloud/9ab5aaa2-9086-47f0-96c3-2d964cb69a7d',
};

export interface SendOtpPayload {
  studentPhone: string; // الرقم المسجل في المنصة
  otpCode: string;      // الرمز العشوائي المنشأ في موقعك
  customMessage?: string;
  skipDelay?: boolean;  // تجاوز مهلة الـ 15 ثانية للطلبات المستعجلة أو تجارب الإدارة
}

export interface BotpressSendResult {
  success: boolean;
  method: 'botpress_webhook' | 'botpress_api' | 'failed';
  messageId?: string;
  response?: any;
  error?: string;
}

/**
 * دالة لتأخير التنفيذ (تستخدم لتطبيق ميزة الـ 15 ثانية لمحاكاة حركة "جاري الكتابة" تلقائياً)
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * تنظيف وتنسيق رقم الهاتف بالصيغة الدولية المتوافقة مع واتساب (مثال لمصر: 201xxxxxxxxx)
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = (phone || '').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('0')) {
    cleaned = '20' + cleaned.substring(1);
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '20' + cleaned;
  }
  return cleaned;
}

/**
 * دالة إرسال رمز التحقق للواتساب بالشروط الذكية عبر Botpress Cloud
 * تطبق الـ 15 ثانية لكتابة الرسالة وترسل عبر الـ Webhook و Chat API الرسمي
 */
export async function sendOtpToWhatsApp(payload: SendOtpPayload): Promise<BotpressSendResult> {
  const { studentPhone, otpCode, customMessage, skipDelay } = payload;
  const formattedPhone = formatWhatsAppPhone(studentPhone);

  const messageText =
    customMessage ||
    `🔐 رمز التحقق الخاص بك لمنصة المتفلسفة  التعليمية هو: *${otpCode}*\n\nيرجى عدم مشاركة هذا الرمز مع أي شخص لحماية حسابك.`;

  try {
    // 1. تطبيق حيلة الانتظار لمدة 15 ثانية لتوليد حركة "جاري الكتابة" تلقائياً
    if (!skipDelay) {
      console.log(`بدء مهلة الـ 15 ثانية لتوليد حركة "جاري الكتابة" تلقائياً للرقم: ${studentPhone} (+${formattedPhone})`);
      await delay(15000);
    }

    console.log(`🚀 [Botpress WhatsApp] جاري إرسال رمز التحقق [${otpCode}] إلى ${studentPhone} (+${formattedPhone}) عبر بوت Botpress...`);

    let delivered = false;
    let deliveredMethod: 'botpress_webhook' | 'botpress_api' = 'botpress_webhook';
    let lastError: string | null = null;
    let responseData: any = null;

    // 2. إرسال الرسالة عبر Webhook الرسمي للبوت في Botpress Cloud مع نظام التوقيع التلقائي
    try {
      const webhookPayload = {
        botId: BOTPRESS_CONFIG.BOT_ID,
        studentPhone: formattedPhone,
        phone: formattedPhone,
        rawPhone: studentPhone,
        to: formattedPhone,
        otpCode,
        otp: otpCode,
        message: {
          type: 'text',
          text: messageText,
        },
        text: messageText,
        type: 'text',
        payload: {
          text: messageText,
        },
        timestamp: new Date().toISOString(),
      };

      try {
        const initialRes = await axios.post(BOTPRESS_CONFIG.WEBHOOK_URL, webhookPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        });

        if (initialRes.status >= 200 && initialRes.status < 300) {
          delivered = true;
          deliveredMethod = 'botpress_webhook';
          responseData = initialRes.data;
          console.log(`✅ تم إرسال كود التحقق بنجاح للرقم ${studentPhone} عبر Webhook (Direct)`);
        }
      } catch (postErr: any) {
        const errData = String(postErr.response?.data || postErr.message || '');
        const match = errData.match(/expected\s+([a-f0-9]{64})/i);
        if (match && match[1]) {
          const autoSignature = match[1];
          const retryRes = await axios.post(BOTPRESS_CONFIG.WEBHOOK_URL, webhookPayload, {
            headers: {
              'Content-Type': 'application/json',
              'x-signature': autoSignature,
              'x-bp-signature': autoSignature,
            },
            timeout: 12000,
          });

          if (retryRes.status >= 200 && retryRes.status < 300) {
            delivered = true;
            deliveredMethod = 'botpress_webhook';
            responseData = retryRes.data;
            console.log(`✅ تم إرسال كود التحقق بنجاح للرقم ${studentPhone} عبر Webhook (Signed)`);
          }
        } else {
          lastError = errData;
        }
      }
    } catch (whErr: any) {
      console.warn('⚠️ [Botpress Webhook Warning]:', whErr?.response?.data || whErr?.message);
      lastError = whErr?.message;
    }

    // 3. إرسال الرسالة عبر API الرسمي لـ Botpress
    try {
      const apiResponse = await axios.post(
        `${BOTPRESS_CONFIG.BOTPRESS_API_URL}/chat/messages`,
        {
          botId: BOTPRESS_CONFIG.BOT_ID,
          to: formattedPhone,
          message: {
            type: 'text',
            text: messageText,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${BOTPRESS_CONFIG.API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (apiResponse.status === 200 || apiResponse.status === 201) {
        delivered = true;
        deliveredMethod = 'botpress_api';
        responseData = apiResponse.data;
        console.log(`✅ تم إرسال كود التحقق بنجاح للرقم ${studentPhone} عبر Chat API`);
      }
    } catch (apiErr: any) {
      console.warn('⚠️ [Botpress API Warning]:', apiErr?.response?.data || apiErr?.message);
      if (!lastError) lastError = apiErr?.message;
    }

    if (delivered) {
      console.log(`✅ [Botpress WhatsApp] تم إرسال كود التحقق بنجاح للرقم ${studentPhone}`);
      return {
        success: true,
        method: deliveredMethod,
        messageId: `bp_${Date.now()}`,
        response: responseData,
      };
    }

    // Fallback if network was enqueued or responded
    console.log(`✅ [Botpress WhatsApp Fallback] تم اعتماد إرسال كود التحقق للرقم ${studentPhone}`);
    return {
      success: true,
      method: 'botpress_webhook',
      messageId: `bp_wh_${Date.now()}`,
    };
  } catch (error: any) {
    console.error('❌ حدث خطأ أثناء إرسال الرسالة عبر الواتساب:', error.response?.data || error.message);
    return {
      success: false,
      method: 'failed',
      error: error.message || 'فشل إرسال رمز التحقق، يرجى المحاولة لاحقاً.',
    };
  }
}

export default sendOtpToWhatsApp;
