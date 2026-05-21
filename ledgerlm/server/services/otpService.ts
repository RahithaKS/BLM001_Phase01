import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { storage } from '../storage';
import { emailService, DomainEmailConfig } from './emailService';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const DEVICE_TRUST_DAYS = 10;

export class OtpService {
  generateOtpCode(): string {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  async createAndSendOtp(userId: string, email: string, userName: string, context: 'login' | 'password_reset', domainConfig?: DomainEmailConfig | null): Promise<void> {
    const otpCode = this.generateOtpCode();
    const codeHash = await bcrypt.hash(otpCode, 10);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    await storage.createOtpCode({
      userId,
      codeHash,
      expiresAt,
      context,
      attempts: 0,
      consumedAt: null,
    });

    await emailService.sendOtpCode(email, otpCode, userName, domainConfig);
  }

  async verifyOtp(userId: string, otpCode: string, context: 'login' | 'password_reset'): Promise<{
    success: boolean;
    error?: string;
  }> {
    const activeOtp = await storage.getActiveOtpCode(userId, context);

    if (!activeOtp) {
      return { success: false, error: 'No active verification code found. Please request a new one.' };
    }

    if (activeOtp.attempts >= MAX_OTP_ATTEMPTS) {
      return { success: false, error: 'Too many failed attempts. Please request a new verification code.' };
    }

    if (new Date() > new Date(activeOtp.expiresAt)) {
      return { success: false, error: 'Verification code has expired. Please request a new one.' };
    }

    const isValid = await bcrypt.compare(otpCode, activeOtp.codeHash);

    if (!isValid) {
      await storage.incrementOtpAttempts(activeOtp.id);
      const attemptsLeft = MAX_OTP_ATTEMPTS - (activeOtp.attempts + 1);
      return { 
        success: false, 
        error: attemptsLeft > 0 
          ? `Invalid verification code. ${attemptsLeft} attempt(s) remaining.`
          : 'Too many failed attempts. Please request a new verification code.'
      };
    }

    await storage.consumeOtpCode(activeOtp.id);
    return { success: true };
  }

  async checkTrustedDevice(userId: string, deviceToken: string): Promise<boolean> {
    if (!deviceToken) {
      return false;
    }

    const userDevices = await storage.getUserDevices(userId);

    for (const device of userDevices) {
      const isMatch = await bcrypt.compare(deviceToken, device.deviceTokenHash);
      
      if (isMatch) {
        if (new Date() > new Date(device.expiresAt)) {
          await storage.deleteDeviceTrust(device.id);
          return false;
        }
        
        await storage.updateDeviceLastUsed(device.id);
        return true;
      }
    }

    return false;
  }

  async createTrustedDevice(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
    deviceFingerprint?: string
  ): Promise<string> {
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceTokenHash = await bcrypt.hash(deviceToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEVICE_TRUST_DAYS);

    await storage.createDeviceTrust({
      userId,
      deviceTokenHash,
      deviceFingerprint,
      userAgent,
      ipAddress,
      expiresAt,
      lastUsedAt: new Date(),
    });

    return deviceToken;
  }

  async shouldRequireOtp(userId: string, deviceToken?: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    if (!user) {
      return true;
    }

    if (!deviceToken) {
      return true;
    }

    const isTrustedDevice = await this.checkTrustedDevice(userId, deviceToken);
    
    if (isTrustedDevice) {
      return false;
    }

    if (!user.lastLoginAt) {
      return true;
    }

    return true;
  }

  async cleanupExpired(): Promise<void> {
    await Promise.all([
      storage.cleanupExpiredOtpCodes(),
      storage.cleanupExpiredDevices(),
    ]);
  }
}

export const otpService = new OtpService();
