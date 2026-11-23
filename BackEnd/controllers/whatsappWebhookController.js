const crypto = require('crypto');
const WhatsAppDelivery = require('../models/WhatsAppDelivery');
const logger = require('../utils/logger');

const STATUS_PRIORITY = {
  PENDING: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  SENT: 4,
  DELIVERED: 5,
  READ: 6,
  FAILED: 7,
};

class WhatsAppWebhookController {
  /**
   * Verifies webhook URL during Meta App setup.
   * Responds to GET request with hub.challenge.
   */
  verifyWebhook(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const expectedToken =
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'dawatdesk_webhook_token';

      if (mode === 'subscribe' && token === expectedToken) {
        logger.info('Meta WhatsApp Webhook verified successfully');
        return res.status(200).send(challenge);
      }

      logger.warn(`Meta Webhook verification mismatch. Expected: ${expectedToken}, Got: ${token}`);
      return res.status(403).send('Verification token mismatch');
    } catch (err) {
      logger.error(`Webhook verification error: ${err.message}`);
      return res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Verifies HMAC-SHA256 signature if app secret is provided.
   */
  verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret || !signature) {
      return true; // Skip signature check if app secret not configured
    }

    try {
      const hmac = crypto.createHmac('sha256', appSecret);
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
      return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch (err) {
      logger.error(`Signature verification failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Handles incoming delivery status events from Meta WhatsApp Cloud API.
   */
  async handleWebhook(req, res) {
    // 1. Immediately acknowledge Meta to prevent timeout/retries
    res.status(200).json({ status: 'ok' });

    try {
      if (!this.verifySignature(req)) {
        logger.warn('Meta Webhook rejected: Invalid signature');
        return;
      }

      const body = req.body;
      if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body?.entry)) {
        return;
      }

      for (const entry of body.entry) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value || value.messaging_product !== 'whatsapp') continue;

          // Status updates (sent, delivered, read, failed)
          const statuses = value.statuses || [];
          for (const statusItem of statuses) {
            await this.processStatusUpdate(statusItem);
          }
        }
      }
    } catch (err) {
      logger.error(`Webhook event processing error: ${err.message}`);
    }
  }

  /**
   * Updates WhatsAppDelivery record based on Meta status event.
   * @param {Object} statusItem
   */
  async processStatusUpdate(statusItem) {
    const messageId = statusItem.id;
    const metaStatus = (statusItem.status || '').toLowerCase();
    const timestamp = statusItem.timestamp ? new Date(Number(statusItem.timestamp) * 1000) : new Date();

    if (!messageId) return;

    try {
      const delivery = await WhatsAppDelivery.findOne({ providerMessageId: messageId });
      if (!delivery) {
        logger.info(`Webhook status received for untracked messageId: ${messageId} (${metaStatus})`);
        return;
      }

      let targetStatus = null;
      if (metaStatus === 'sent') targetStatus = 'SENT';
      else if (metaStatus === 'delivered') targetStatus = 'DELIVERED';
      else if (metaStatus === 'read') targetStatus = 'READ';
      else if (metaStatus === 'failed') targetStatus = 'FAILED';

      if (!targetStatus) return;

      // Idempotency & monotonic state check
      const currentPriority = STATUS_PRIORITY[delivery.deliveryStatus] || 0;
      const newPriority = STATUS_PRIORITY[targetStatus] || 0;

      // If already at higher state (e.g. READ), don't regress to DELIVERED or SENT
      if (currentPriority >= newPriority && targetStatus !== 'FAILED') {
        return;
      }

      delivery.deliveryStatus = targetStatus;

      if (targetStatus === 'SENT' && !delivery.sentAt) {
        delivery.sentAt = timestamp;
      } else if (targetStatus === 'DELIVERED') {
        delivery.deliveredAt = timestamp;
      } else if (targetStatus === 'READ') {
        delivery.readAt = timestamp;
        if (!delivery.deliveredAt) delivery.deliveredAt = timestamp;
      } else if (targetStatus === 'FAILED') {
        delivery.failedAt = timestamp;
        if (Array.isArray(statusItem.errors) && statusItem.errors.length > 0) {
          const errObj = statusItem.errors[0];
          delivery.errorCode = errObj.code ? `META_${errObj.code}` : 'META_FAILED';
          delivery.errorMessage = errObj.message || errObj.title || 'Message delivery failed';
        }
      }

      delivery.statusHistory.push({
        status: targetStatus,
        timestamp,
        details: `Meta Webhook: ${metaStatus.toUpperCase()}`,
      });

      await delivery.save();
      logger.info(`WhatsApp delivery updated via Webhook: ${messageId} -> ${targetStatus}`);
    } catch (err) {
      logger.error(`Error processing status update for ${messageId}: ${err.message}`);
    }
  }
}

module.exports = new WhatsAppWebhookController();
