import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'default-encryption-key-change-in-production';
  return crypto.scryptSync(key, 'salt', 32);
}

export function encryptValue(value: string): string {
  if (!value) return value;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.includes(':')) return encryptedValue;
  
  try {
    const key = getEncryptionKey();
    const [ivHex, tagHex, encrypted] = encryptedValue.split(':');
    
    if (!ivHex || !tagHex || !encrypted) return encryptedValue;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed, returning original value');
    return encryptedValue;
  }
}

export function encryptSensitiveFields(config: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result = { ...config };
  
  for (const key of sensitiveKeys) {
    if (result[key] && typeof result[key] === 'string') {
      result[key] = encryptValue(result[key]);
    }
  }
  
  return result;
}

export function decryptSensitiveFields(config: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result = { ...config };
  
  for (const key of sensitiveKeys) {
    if (result[key] && typeof result[key] === 'string') {
      result[key] = decryptValue(result[key]);
    }
  }
  
  return result;
}

export function redactSensitiveFields(config: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result = { ...config };
  
  for (const key of sensitiveKeys) {
    if (result[key]) {
      result[key] = '********';
    }
  }
  
  return result;
}
