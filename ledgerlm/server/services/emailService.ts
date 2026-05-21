import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface DomainEmailConfig {
  emailProvider: string | null;
  emailSmtpUser: string | null;
  emailSmtpPass: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('⚠️  SMTP credentials not configured. Email service disabled.');
      console.warn('   Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.isConfigured = true;
      console.log('✅ Email service configured successfully');
      console.log(`   SMTP: ${smtpUser} via ${smtpHost}:${smtpPort}`);
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      this.isConfigured = false;
    }
  }

  private buildDomainTransporter(config: DomainEmailConfig): Transporter {
    const provider = config.emailProvider || 'default';

    if (provider === 'microsoft') {
      return nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
          user: config.emailSmtpUser!,
          pass: config.emailSmtpPass!,
        },
        tls: { rejectUnauthorized: false },
      });
    }

    if (provider === 'godaddy') {
      return nodemailer.createTransport({
        host: 'smtpout.secureserver.net',
        port: 465,
        secure: true,
        auth: {
          user: config.emailSmtpUser!,
          pass: config.emailSmtpPass!,
        },
        tls: { rejectUnauthorized: false },
      });
    }

    throw new Error(`Unknown email provider: ${provider}`);
  }

  async sendEmailWithDomainConfig(options: EmailOptions, domainConfig?: DomainEmailConfig | null): Promise<boolean> {
    const useCustom = domainConfig &&
      domainConfig.emailProvider &&
      domainConfig.emailProvider !== 'default' &&
      domainConfig.emailSmtpUser &&
      domainConfig.emailSmtpPass;

    if (useCustom) {
      try {
        const transporter = this.buildDomainTransporter(domainConfig!);
        const fromName = domainConfig!.emailFromName || 'LedgerLM';
        const fromEmail = domainConfig!.emailFromAddress || domainConfig!.emailSmtpUser;

        const info = await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || this.stripHtml(options.html),
        });

        console.log('✅ Email sent via domain SMTP:', info.messageId);
        console.log(`   Provider: ${domainConfig!.emailProvider} | To: ${options.to}`);
        return true;
      } catch (error) {
        console.error('❌ Domain SMTP sending failed:', error);
        throw error;
      }
    }

    return this.sendEmail(options);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      throw new Error('Email service is not configured');
    }

    try {
      const fromName = process.env.SMTP_FROM_NAME || 'LedgerLM';
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      console.log('✅ Email sent successfully:', info.messageId);
      console.log(`   To: ${options.to}`);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }

  async sendInvitation(email: string, token: string, inviterName: string): Promise<boolean> {
    let appUrl = process.env.APP_URL || 'http://localhost:5000';
    
    // In development, use Replit dev URL if available
    if (process.env.NODE_ENV === 'development' && process.env.REPLIT_DEV_DOMAIN) {
      appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    const invitationUrl = `${appUrl}/accept-invitation?token=${token}`;

    const html = this.getInvitationEmailTemplate(email, invitationUrl, inviterName);

    return this.sendEmail({
      to: email,
      subject: 'You\'re invited to join LedgerLM',
      html,
    });
  }

  async sendOtpCode(email: string, otpCode: string, userName: string, domainConfig?: DomainEmailConfig | null): Promise<boolean> {
    const html = this.getOtpEmailTemplate(otpCode, userName);

    return this.sendEmailWithDomainConfig({
      to: email,
      subject: 'LedgerLM - Your Verification Code',
      html,
    }, domainConfig);
  }

  async sendDomainAdminInvitation(email: string, domainName: string, hardcodedOtp: string | null, domainConfig?: DomainEmailConfig | null): Promise<boolean> {
    let appUrl = process.env.APP_URL || 'http://localhost:5000';
    
    if (process.env.NODE_ENV === 'development' && process.env.REPLIT_DEV_DOMAIN) {
      appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }

    const html = this.getDomainAdminInvitationTemplate(email, domainName, appUrl, hardcodedOtp);

    return this.sendEmailWithDomainConfig({
      to: email,
      subject: `You're a Domain Admin for ${domainName} on LedgerLM`,
      html,
    }, domainConfig);
  }

  async sendDomainUserInvitation(email: string, domainName: string, role: string, hardcodedOtp: string | null, domainConfig?: DomainEmailConfig | null): Promise<boolean> {
    let appUrl = process.env.APP_URL || 'http://localhost:5000';
    
    if (process.env.NODE_ENV === 'development' && process.env.REPLIT_DEV_DOMAIN) {
      appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }

    const html = this.getDomainUserInvitationTemplate(email, domainName, role, appUrl, hardcodedOtp);

    return this.sendEmailWithDomainConfig({
      to: email,
      subject: `You've been invited to join ${domainName} on LedgerLM`,
      html,
    }, domainConfig);
  }

  private getDomainAdminInvitationTemplate(email: string, domainName: string, appUrl: string, hardcodedOtp: string | null): string {
    const otpSection = hardcodedOtp ? `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;">Your verification code:</p>
        <div style="font-size: 32px; font-weight: bold; color: #15803d; letter-spacing: 4px; font-family: monospace;">${hardcodedOtp}</div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Use this code when signing in</p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); color: white; padding: 40px 30px; text-align: center; }
            .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }
            .content { padding: 40px 30px; }
            .content p { margin: 0 0 16px 0; color: #374151; }
            .button { display: inline-block; background: #0d9488; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; }
            .footer { text-align: center; padding: 24px 30px; font-size: 14px; color: #6b7280; background: #f9fafb; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">LedgerLM</div>
              <h1 style="margin: 0; font-size: 24px;">Domain Admin Invitation</h1>
              <div class="badge">ADMINISTRATOR</div>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You have been assigned as the <strong>Domain Administrator</strong> for <strong>${domainName}</strong> on LedgerLM.</p>
              <p>As a Domain Admin, you can:</p>
              <ul style="color: #374151; padding-left: 20px;">
                <li>Invite and manage users in your domain</li>
                <li>Upload and manage enterprise documents</li>
                <li>Configure user access and permissions</li>
              </ul>
              ${otpSection}
              <p style="text-align: center;">
                <a href="${appUrl}" class="button" style="color: white;">Sign In to LedgerLM</a>
              </p>
              <p style="font-size: 14px; color: #6b7280;">Simply enter your email address (${email}) to get started.</p>
            </div>
            <div class="footer">
              <p>LedgerLM - AI-Powered Financial Analysis</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getDomainUserInvitationTemplate(email: string, domainName: string, role: string, appUrl: string, hardcodedOtp: string | null): string {
    const otpSection = hardcodedOtp ? `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534;">Your verification code:</p>
        <div style="font-size: 32px; font-weight: bold; color: #15803d; letter-spacing: 4px; font-family: monospace;">${hardcodedOtp}</div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">Use this code when signing in</p>
      </div>
    ` : '';

    const roleDisplay = role === 'admin' ? 'Administrator' : 'User';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); color: white; padding: 40px 30px; text-align: center; }
            .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
            .content { padding: 40px 30px; }
            .content p { margin: 0 0 16px 0; color: #374151; }
            .button { display: inline-block; background: #0d9488; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 24px 0; }
            .footer { text-align: center; padding: 24px 30px; font-size: 14px; color: #6b7280; background: #f9fafb; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">LedgerLM</div>
              <h1 style="margin: 0; font-size: 24px;">Welcome to ${domainName}</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You have been invited to join <strong>${domainName}</strong> on LedgerLM as a <strong>${roleDisplay}</strong>.</p>
              <p>LedgerLM is an AI-powered financial analysis platform that helps you:</p>
              <ul style="color: #374151; padding-left: 20px;">
                <li>Analyze financial documents with AI assistance</li>
                <li>Access enterprise data and market intelligence</li>
                <li>Get insights from your organization's knowledge base</li>
              </ul>
              ${otpSection}
              <p style="text-align: center;">
                <a href="${appUrl}" class="button" style="color: white;">Get Started</a>
              </p>
              <p style="font-size: 14px; color: #6b7280;">Sign in with your email address (${email}) to access the platform.</p>
            </div>
            <div class="footer">
              <p>LedgerLM - AI-Powered Financial Analysis</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getOtpEmailTemplate(otpCode: string, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center;
            }
            .logo { 
              font-size: 32px; 
              font-weight: bold; 
              margin-bottom: 10px;
              letter-spacing: -0.5px;
            }
            .header h1 { 
              margin: 0; 
              font-size: 28px; 
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
              background: white;
              text-align: center;
            }
            .content p {
              margin: 0 0 16px 0;
              color: #374151;
              text-align: left;
            }
            .otp-container {
              background: #f9fafb;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              padding: 32px;
              margin: 32px 0;
              text-align: center;
            }
            .otp-label {
              font-size: 14px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 16px;
            }
            .otp-code {
              font-size: 48px;
              font-weight: bold;
              color: #0d9488;
              letter-spacing: 12px;
              font-family: 'Courier New', monospace;
              margin: 16px 0;
            }
            .expiry-notice {
              font-size: 14px;
              color: #6b7280;
              margin-top: 16px;
            }
            .warning {
              font-size: 14px; 
              color: #6b7280; 
              margin-top: 24px; 
              padding: 16px;
              background: #fffbeb;
              border-radius: 6px;
              border: 1px solid #fef3c7;
              text-align: left;
            }
            .warning strong {
              color: #92400e;
            }
            .footer { 
              text-align: center; 
              padding: 24px 30px; 
              font-size: 14px; 
              color: #6b7280; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 8px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">LedgerLM</div>
              <h1>Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We received a sign-in request for your LedgerLM account. Use the verification code below to continue:</p>
              
              <div class="otp-container">
                <div class="otp-label">Your Verification Code</div>
                <div class="otp-code">${otpCode}</div>
                <div class="expiry-notice">This code expires in 5 minutes</div>
              </div>
              
              <div class="warning">
                <strong>Security Notice:</strong><br>
                Never share this code with anyone. LedgerLM will never ask for this code via email or phone.
                If you didn't attempt to sign in, please ignore this email or contact support if you have concerns.
              </div>
            </div>
            <div class="footer">
              <p><strong>© ${new Date().getFullYear()} LedgerLM. All rights reserved.</strong></p>
              <p style="font-size: 12px; margin-top: 16px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getInvitationEmailTemplate(email: string, invitationUrl: string, inviterName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #0d9488 0%, #06b6d4 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center;
            }
            .logo { 
              font-size: 32px; 
              font-weight: bold; 
              margin-bottom: 10px;
              letter-spacing: -0.5px;
            }
            .header h1 { 
              margin: 0; 
              font-size: 28px; 
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
              background: white;
            }
            .content p {
              margin: 0 0 16px 0;
              color: #374151;
            }
            .content ul {
              margin: 20px 0;
              padding-left: 24px;
            }
            .content li {
              margin: 8px 0;
              color: #374151;
            }
            .button { 
              display: inline-block; 
              background: #0d9488; 
              color: white !important; 
              padding: 16px 32px; 
              text-decoration: none; 
              border-radius: 6px; 
              font-weight: 600; 
              margin: 24px 0;
              transition: background 0.2s;
            }
            .button:hover {
              background: #0f766e;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .link-fallback {
              font-size: 14px; 
              color: #6b7280; 
              margin-top: 20px;
              padding: 16px;
              background: #f9fafb;
              border-radius: 6px;
              word-break: break-all;
            }
            .link-fallback a {
              color: #0d9488;
              text-decoration: none;
            }
            .footer { 
              text-align: center; 
              padding: 24px 30px; 
              font-size: 14px; 
              color: #6b7280; 
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 8px 0;
            }
            .warning {
              font-size: 14px; 
              color: #6b7280; 
              margin-top: 24px; 
              padding-top: 24px; 
              border-top: 1px solid #e5e7eb;
              background: #fffbeb;
              padding: 16px;
              border-radius: 6px;
              border: 1px solid #fef3c7;
            }
            .warning strong {
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img
                                src="/Images - Logo/PNGs/120px.png"
                                alt="LedgerLM Logo"
                                className="h-7 w-9"
                              />
              <h1>You're Invited!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p><strong>${inviterName}</strong> has invited you to join <strong>LedgerLM</strong>, 
              the AI-powered financial analysis platform.</p>
              
              <p>LedgerLM helps you turn complex financial data into clear, actionable insights with:</p>
              <ul>
                <li>AI-powered document analysis with RAG technology</li>
                <li>Intelligent chat interface for financial queries</li>
                <li>Secure document vault with enterprise data access</li>
                <li>Real-time financial insights and reporting</li>
                <li>Multi-source intelligence (Documents + Google + Databases)</li>
              </ul>
              
              <p><strong>Click the button below to accept your invitation and create your account:</strong></p>
              
              <div class="button-container">
                <a href="${invitationUrl}" class="button">Accept Invitation</a>
              </div>
              
              <div class="link-fallback">
                Or copy and paste this link into your browser:<br>
                <a href="${invitationUrl}">${invitationUrl}</a>
              </div>
              
              <div class="warning">
                <strong> ALERT!! This invitation expires in 48 hours.</strong><br>
                If you didn't expect this invitation, you can safely ignore this email.
              </div>
            </div>
            <div class="footer">
              <p><strong>© ${new Date().getFullYear()} LedgerLM. All rights reserved.</strong></p>
              <p>Turn Financial Data into Clarity.</p>
              <p style="font-size: 12px; margin-top: 16px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async testConnection(): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      throw new Error('Email service is not configured');
    }

    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
