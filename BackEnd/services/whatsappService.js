const axios = require('axios');
const FormData = require('form-data');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const logger = require('../utils/logger');
const { formatAndValidatePhone } = require('../utils/phoneFormatter');

class WhatsAppService {
  /**
   * Resolves credentials for a specific restaurant or system default.
   * @param {string} restaurantId
   * @returns {Promise<{
   *   isConfigured: boolean,
   *   isTestMode: boolean,
   *   phoneNumberId: string,
   *   businessAccountId: string,
   *   accessToken: string,
   *   apiVersion: string,
   *   templateName: string,
   *   templateLanguage: string,
   *   autoSendDefault: boolean,
   *   source: 'RESTAURANT' | 'SYSTEM' | 'MOCK'
   * }>}
   */
  async resolveCredentials(restaurantId) {
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';

    if (restaurantId) {
      try {
        const config = await WhatsAppConfig.findOne({ restaurantId });
        if (config && config.isEnabled) {
          if (config.status === 'TEST_MODE') {
            return {
              isConfigured: true,
              isTestMode: true,
              phoneNumberId: config.phoneNumberId || 'TEST_PHONE_ID',
              businessAccountId: config.businessAccountId || 'TEST_WABA_ID',
              accessToken: config.accessToken || 'TEST_TOKEN',
              apiVersion,
              templateName: config.templateName || 'dawatdesk_invoice_v1',
              templateLanguage: config.templateLanguage || 'en',
              autoSendDefault: config.autoSendDefault !== false,
              source: 'RESTAURANT',
            };
          }

          if (config.phoneNumberId && config.accessToken) {
            return {
              isConfigured: true,
              isTestMode: false,
              phoneNumberId: config.phoneNumberId,
              businessAccountId: config.businessAccountId,
              accessToken: config.accessToken,
              apiVersion,
              templateName: config.templateName || 'dawatdesk_invoice_v1',
              templateLanguage: config.templateLanguage || 'en',
              autoSendDefault: config.autoSendDefault !== false,
              source: 'RESTAURANT',
            };
          }
        }
      } catch (err) {
        logger.error(`Error resolving restaurant WhatsApp config: ${err.message}`);
      }
    }

    // System-wide fallback
    const sysPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const sysToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const sysWabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (sysPhoneId && sysToken) {
      return {
        isConfigured: true,
        isTestMode: process.env.WHATSAPP_TEST_MODE === 'true',
        phoneNumberId: sysPhoneId,
        businessAccountId: sysWabaId,
        accessToken: sysToken,
        apiVersion,
        templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'dawatdesk_invoice_v1',
        templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en',
        autoSendDefault: true,
        source: 'SYSTEM',
      };
    }

    // Unconfigured mock/test fallback
    return {
      isConfigured: false,
      isTestMode: true,
      phoneNumberId: '',
      businessAccountId: '',
      accessToken: '',
      apiVersion,
      templateName: 'dawatdesk_invoice_v1',
      templateLanguage: 'en',
      autoSendDefault: true,
      source: 'MOCK',
    };
  }

  /**
   * Uploads a PDF invoice document to Meta WhatsApp Cloud Media API.
   * @param {Object} params
   * @param {Buffer} params.pdfBuffer
   * @param {string} params.fileName
   * @param {string} params.phoneNumberId
   * @param {string} params.accessToken
   * @param {string} params.apiVersion
   * @returns {Promise<string>} mediaId
   */
  async uploadMedia({ pdfBuffer, fileName, phoneNumberId, accessToken, apiVersion }) {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`;

    const form = new FormData();
    form.append('file', pdfBuffer, {
      filename: fileName,
      contentType: 'application/pdf',
    });
    form.append('type', 'application/pdf');
    form.append('messaging_product', 'whatsapp');

    const response = await axios.post(url, form, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...form.getHeaders(),
      },
      timeout: 25000,
    });

    if (response.data && response.data.id) {
      return response.data.id;
    }

    throw new Error('Meta Media API did not return an upload ID');
  }

  /**
   * Sends an invoice via official Meta WhatsApp Business Cloud API.
   *
   * @param {Object} params
   * @param {string} params.restaurantId
   * @param {string} params.toPhone - Customer phone number (raw or normalized)
   * @param {string} params.customerName
   * @param {string} params.restaurantName
   * @param {string} params.receiptNumber
   * @param {string} params.orderRef
   * @param {number} params.totalAmount
   * @param {string} params.paymentMethod
   * @param {Buffer} [params.pdfBuffer]
   * @param {string} [params.pdfUrl]
   * @param {string} [params.fileName]
   * @returns {Promise<{
   *   success: boolean,
   *   messageId: string,
   *   status: string,
   *   deliveryMethod: string,
   *   isMock: boolean,
   *   error?: string,
   *   errorCode?: string
   * }>}
   */
  async sendInvoice({
    restaurantId,
    toPhone,
    customerName,
    restaurantName,
    receiptNumber,
    orderRef,
    totalAmount,
    paymentMethod,
    pdfBuffer,
    pdfUrl,
    fileName,
  }) {
    // 1. Phone validation
    const phoneRes = formatAndValidatePhone(toPhone);
    if (!phoneRes.isValid) {
      return {
        success: false,
        messageId: '',
        status: 'FAILED',
        deliveryMethod: 'AUTOMATIC',
        isMock: false,
        errorCode: 'INVALID_PHONE_NUMBER',
        error: phoneRes.error || 'Invalid recipient phone number',
      };
    }

    const recipient = phoneRes.normalizedNumber;
    const creds = await this.resolveCredentials(restaurantId);

    // 2. Test / Mock Mode handling
    if (!creds.isConfigured || creds.isTestMode) {
      const mockMsgId = `wamid.MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      logger.info(
        `[WhatsApp TEST_MODE] Simulated delivery to ${recipient} for ${receiptNumber} (MsgId: ${mockMsgId})`
      );
      return {
        success: true,
        messageId: mockMsgId,
        status: 'ACCEPTED',
        deliveryMethod: 'AUTOMATIC',
        isMock: true,
      };
    }

    // 3. Real Meta Cloud API execution
    try {
      const docFileName = fileName || `Invoice_${receiptNumber}.pdf`;
      let docHeaderParam = null;

      // Prefer Media ID upload for reliability, fallback to link
      if (pdfBuffer && pdfBuffer.length > 0) {
        try {
          const mediaId = await this.uploadMedia({
            pdfBuffer,
            fileName: docFileName,
            phoneNumberId: creds.phoneNumberId,
            accessToken: creds.accessToken,
            apiVersion: creds.apiVersion,
          });
          docHeaderParam = {
            type: 'document',
            document: {
              id: mediaId,
              filename: docFileName,
            },
          };
        } catch (mediaErr) {
          logger.warn(`Media upload failed: ${mediaErr.message}. Attempting public link fallback.`);
        }
      }

      if (!docHeaderParam && pdfUrl) {
        docHeaderParam = {
          type: 'document',
          document: {
            link: pdfUrl,
            filename: docFileName,
          },
        };
      }

      // Format body parameters for approved template:
      // {{1}}: Customer Name
      // {{2}}: Restaurant Name
      // {{3}}: Invoice Number
      // {{4}}: Order Number
      // {{5}}: Total Amount
      // {{6}}: Payment Method
      const bodyParameters = [
        { type: 'text', text: customerName || 'Valued Guest' },
        { type: 'text', text: restaurantName ? `${restaurantName} (via DawatDesk)` : 'DawatDesk Restaurant' },
        { type: 'text', text: String(receiptNumber) },
        { type: 'text', text: String(orderRef) },
        { type: 'text', text: Number(totalAmount || 0).toFixed(2) },
        { type: 'text', text: String(paymentMethod || 'Cash').replace(/_/g, ' ') },
      ];

      const components = [];
      if (docHeaderParam) {
        components.push({
          type: 'header',
          parameters: [docHeaderParam],
        });
      }
      components.push({
        type: 'body',
        parameters: bodyParameters,
      });

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: creds.templateName,
          language: {
            code: creds.templateLanguage || 'en',
          },
          components,
        },
      };

      const messagesUrl = `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/messages`;
      const response = await axios.post(messagesUrl, payload, {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      const data = response.data;
      const messageId = data?.messages?.[0]?.id || `wamid.${Date.now()}`;

      logger.info(`WhatsApp Cloud API Accepted: ${messageId} to ${recipient}`);

      return {
        success: true,
        messageId,
        status: 'ACCEPTED',
        deliveryMethod: 'AUTOMATIC',
        isMock: false,
      };
    } catch (apiErr) {
      const metaError = apiErr.response?.data?.error;
      const statusCode = apiErr.response?.status;
      const errorCode = metaError?.code ? `META_${metaError.code}` : (statusCode ? `HTTP_${statusCode}` : 'API_ERROR');
      const errorMessage = metaError?.message || apiErr.message;

      logger.error(`Meta WhatsApp API Error [${errorCode}]: ${errorMessage}`);

      return {
        success: false,
        messageId: '',
        status: 'FAILED',
        deliveryMethod: 'AUTOMATIC',
        isMock: false,
        errorCode,
        error: errorMessage,
      };
    }
  }

  /**
   * Generates a wa.me pre-filled message and direct chat link for manual sending.
   * @param {Object} params
   * @param {string} params.toPhone
   * @param {string} params.customerName
   * @param {string} params.restaurantName
   * @param {string} params.receiptNumber
   * @param {string} params.orderRef
   * @param {number} params.totalAmount
   * @param {string} params.paymentMethod
   * @param {string} [params.pdfUrl]
   * @returns {{
   *   waMeUrl: string,
   *   messageText: string,
   *   normalizedPhone: string,
   *   formattedDisplay: string
   * }}
   */
  generateWaMeLink({
    toPhone,
    customerName,
    restaurantName,
    receiptNumber,
    orderRef,
    totalAmount,
    paymentMethod,
    pdfUrl,
    date,
  }) {
    const phoneRes = formatAndValidatePhone(toPhone);
    const recipient = phoneRes.isValid ? phoneRes.normalizedNumber : toPhone.replace(/\D/g, '');

    const restName = restaurantName || 'Hariom Restaurant';
    const guestName = customerName || 'Valued Guest';
    const amountStr = Number(totalAmount || 0).toFixed(2);
    const mode = String(paymentMethod || 'Cash').replace(/_/g, ' ');

    const dateObj = date ? new Date(date) : new Date();
    const formattedDate = dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const lines = [
      `✨ *${restName}*`,
      '',
      `Dear ${guestName},`,
      '',
      'Thank you for dining with us! Your payment has been received successfully. 🎉',
      '',
      '🧾 *PAYMENT RECEIPT*',
      '━━━━━━━━━━━━━━',
      `*Amount Paid:* ₹${amountStr}`,
      `*Payment Mode:* ${mode}`,
      '*Status:* ✅ PAID',
      '━━━━━━━━━━━━━━',
      '',
      '📄 *Your Digital Invoice*',
      `🔗 Download PDF: ${pdfUrl}`,
      '',
      `Thank you for choosing *${restName}* ❤️`,
      '',
      `*Team ${restName}*`,
      '',
      '_Powered by DawatDesk POS_',
      '🌐 https://dawatdesk-marketing.vercel.app/',
    ];

    const messageText = lines.join('\n');
    const waMeUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(messageText)}`;

    return {
      waMeUrl,
      messageText,
      normalizedPhone: recipient,
      formattedDisplay: phoneRes.formattedDisplay || recipient,
    };
  }
}

module.exports = new WhatsAppService();
