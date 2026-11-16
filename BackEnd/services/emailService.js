const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const SENDER_EMAIL = process.env.EMAIL_USER || 'dawatdesk.official@gmail.com';
const SENDER_NAME = 'DawatDesk Official';

class EmailService {
  getTransporter() {
    const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
    if (!pass) {
      return null;
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SENDER_EMAIL,
        pass: pass.replace(/\s+/g, ''), // Strip spaces from Google App Password
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtpEmail(toEmail, otp, purpose = 'login', userName = '') {
    const cleanEmail = (toEmail || '').toLowerCase().trim();
    const isRegistration = purpose === 'registration';
    const subject = isRegistration
      ? 'DawatDesk - Staff Registration Verification OTP'
      : 'DawatDesk - Your Login One-Time Password';

    const greeting = userName ? `Hello ${userName},` : 'Hello,';
    const actionText = isRegistration
      ? 'A new staff account registration has been requested for this email address by the system administrator.'
      : 'A sign-in request has been initiated for your DawatDesk account.';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px;">DawatDesk POS</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Restaurant Management & Point of Sale System</p>
        </div>

        <div style="padding: 24px 0;">
          <p style="font-size: 15px; margin: 0 0 12px; font-weight: 600;">${greeting}</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
            ${actionText} Please use the following 6-digit One-Time Password (OTP) to complete the verification:
          </p>

          <div style="background-color: #fff7ed; border: 2px dashed #fb923c; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #c2410c; display: inline-block;">
              ${otp}
            </span>
            <div style="font-size: 12px; color: #9a3412; margin-top: 8px; font-weight: 500;">
              Valid for 10 minutes
            </div>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 8px;">
            ⚠️ If you did not request this OTP, you can safely disregard this email. Never share your OTP with anyone.
          </p>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          Sent from <strong>${SENDER_EMAIL}</strong> &bull; DawatDesk Automated Authentication
        </div>
      </div>
    `;

    // Always log OTP prominently in console for development & real-time visibility
    console.log('\n======================================================');
    console.log(`  [DAWATDESK OTP AUTH]`);
    console.log(`  Target Email : ${cleanEmail}`);
    console.log(`  OTP Code     : ${otp}`);
    console.log(`  Purpose      : ${purpose}`);
    console.log(`  Sender       : ${SENDER_EMAIL}`);
    console.log(`  Expires In   : 10 minutes`);
    console.log('======================================================\n');

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn(`Email password (EMAIL_PASS) not configured in .env. OTP displayed in server logs for testing.`);
      return {
        success: true,
        delivered: false,
        warning: 'EMAIL_PASS not configured in .env. OTP logged to server terminal for testing.',
        otp, // included for dev convenience
      };
    }

    try {
      const info = await transporter.sendMail({
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: cleanEmail,
        subject,
        html: htmlContent,
      });

      logger.info(`OTP email successfully dispatched to ${cleanEmail}. MessageId: ${info.messageId}`);
      return { success: true, delivered: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`Error sending email to ${cleanEmail}: ${err.message}`);
      return {
        success: true,
        delivered: false,
        warning: `Gmail delivery warning: ${err.message}. OTP is logged in server console.`,
        otp,
      };
    }
  }

  async sendWelcomeCredentialsEmail(toEmail, { name, role, restaurantName, password }) {
    const cleanEmail = (toEmail || '').toLowerCase().trim();
    const subject = `Welcome to DawatDesk POS - Your Staff Account Credentials`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #fed7aa;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px;">DawatDesk POS</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #64748b; font-weight: 500;">Restaurant Management & Point of Sale System</p>
        </div>

        <div style="padding: 24px 0;">
          <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 10px;">Hello ${name || 'Team Member'},</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px;">
            You have been successfully registered as <strong>${role}</strong> at <strong>${restaurantName}</strong> on DawatDesk POS.
          </p>

          <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 1px solid #fed7aa; border-radius: 14px; padding: 20px; margin: 20px 0;">
            <div style="font-size: 12px; font-weight: 700; color: #ea580c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
              Your Account & Login Details
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 120px;">Role:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${role}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Restaurant:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${restaurantName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Login Email:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${cleanEmail}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Password:</td>
                <td style="padding: 6px 0; color: #ea580c; font-weight: 700; font-family: monospace; font-size: 15px;">${password}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 28px 0 20px;">
            <a href="http://localhost:5173/login" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
              Sign In to Your Dashboard
            </a>
          </div>

          <div style="background-color: #f8fafc; border-left: 4px solid #ea580c; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12.5px; color: #475569; line-height: 1.5;">
              💡 <strong>Login Options:</strong> You can sign in directly using your <strong>Password</strong> above, or use the <strong>Email OTP Login</strong> tab on the login screen to receive a real-time OTP code on your Gmail anytime.
            </p>
          </div>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          Sent from <strong>${SENDER_EMAIL}</strong> &bull; DawatDesk POS Management System
        </div>
      </div>
    `;

    console.log('\n======================================================');
    console.log(`  [DAWATDESK WELCOME CREDENTIALS EMAIL]`);
    console.log(`  To:         ${cleanEmail}`);
    console.log(`  Name:       ${name}`);
    console.log(`  Role:       ${role}`);
    console.log(`  Restaurant: ${restaurantName}`);
    console.log(`  Password:   ${password}`);
    console.log(`  Sender:     ${SENDER_EMAIL}`);
    console.log('======================================================\n');

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn(`Email password (EMAIL_PASS) not configured. Welcome email logged to console.`);
      return { success: true, delivered: false };
    }

    try {
      const info = await transporter.sendMail({
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: cleanEmail,
        subject,
        html: htmlContent,
      });

      logger.info(`Welcome credentials email sent to ${cleanEmail}. MessageId: ${info.messageId}`);
      return { success: true, delivered: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`Error sending welcome email to ${cleanEmail}: ${err.message}`);
      return { success: true, delivered: false, warning: err.message };
    }
  }
}

module.exports = new EmailService();
