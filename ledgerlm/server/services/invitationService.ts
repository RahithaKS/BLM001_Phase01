import crypto from 'crypto';
import { db } from '../db';
import { invitations, users, validatePasswordStrength } from '@shared/schema';
import { emailService } from './emailService';
import { eq, and, lt } from 'drizzle-orm';

class InvitationService {
  
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async createInvitation(email: string, invitedByUserId: string): Promise<string> {
    const existingUser = await db.select().from(users).where(eq(users.username, email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error('User already exists with this email');
    }

    const existingInvitation = await db.select()
      .from(invitations)
      .where(eq(invitations.email, email))
      .limit(1);

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const inviter = await db.select().from(users).where(eq(users.id, invitedByUserId)).limit(1);
    const inviterName = inviter[0]?.displayName || 'A team member';

    let invitation;

    if (existingInvitation.length > 0) {
      const existing = existingInvitation[0];
      
      if (existing.status === 'pending') {
        throw new Error('Invitation already sent to this email. Please wait for it to be accepted or resend.');
      }

      [invitation] = await db.update(invitations)
        .set({
          token,
          invitedBy: invitedByUserId,
          expiresAt,
          status: 'pending',
          acceptedAt: null,
          createdAt: new Date(),
        })
        .where(eq(invitations.id, existing.id))
        .returning();

      console.log(`♻️  Reusing invitation record for ${email} (was ${existing.status})`);
    } else {
      [invitation] = await db.insert(invitations).values({
        email,
        token,
        invitedBy: invitedByUserId,
        expiresAt,
        status: 'pending',
      }).returning();
    }

    try {
      await emailService.sendInvitation(email, token, inviterName);
      console.log(`✅ Invitation sent to ${email}`);
    } catch (error) {
      if (!existingInvitation.length) {
        await db.delete(invitations).where(eq(invitations.id, invitation.id));
      }
      console.error('❌ Failed to send invitation email:', error);
      throw new Error('Failed to send invitation email. Please check SMTP configuration.');
    }

    return token;
  }

  async validateToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
    const [invitation] = await db.select()
      .from(invitations)
      .where(and(
        eq(invitations.token, token),
        eq(invitations.status, 'pending')
      ))
      .limit(1);

    if (!invitation) {
      return { valid: false, error: 'Invalid or expired invitation' };
    }

    if (new Date() > invitation.expiresAt) {
      await db.update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invitation.id));
      
      return { valid: false, error: 'Invitation has expired. Please request a new invitation.' };
    }

    return { valid: true, email: invitation.email };
  }

  async acceptInvitation(token: string, displayName: string): Promise<any> {
    const validation = await this.validateToken(token);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid invitation');
    }

    const email = validation.email!;

    const [user] = await db.insert(users).values({
      username: email,
      password: null,
      displayName,
      role: 'standard',
    }).returning();

    await db.update(invitations)
      .set({ 
        status: 'accepted',
        acceptedAt: new Date(),
      })
      .where(eq(invitations.token, token));

    console.log(`✅ User ${email} registered successfully via invitation (passwordless)`);

    return user;
  }

  async cleanupExpired(): Promise<number> {
    const result = await db.update(invitations)
      .set({ status: 'expired' })
      .where(and(
        eq(invitations.status, 'pending'),
        lt(invitations.expiresAt, new Date())
      ))
      .returning();

    if (result.length > 0) {
      console.log(`🧹 Cleaned up ${result.length} expired invitations`);
    }

    return result.length;
  }

  async getPendingInvitations(): Promise<any[]> {
    return db.select({
      id: invitations.id,
      email: invitations.email,
      invitedBy: users.displayName,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
      status: invitations.status,
    })
    .from(invitations)
    .leftJoin(users, eq(invitations.invitedBy, users.id))
    .where(eq(invitations.status, 'pending'));
  }

  async resendInvitation(invitationId: string): Promise<boolean> {
    const [invitation] = await db.select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const newToken = this.generateToken();
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 48);

    await db.update(invitations)
      .set({ 
        token: newToken,
        expiresAt: newExpiresAt,
        status: 'pending',
      })
      .where(eq(invitations.id, invitationId));

    const inviter = await db.select().from(users).where(eq(users.id, invitation.invitedBy)).limit(1);
    const inviterName = inviter[0]?.displayName || 'A team member';

    await emailService.sendInvitation(invitation.email, newToken, inviterName);

    console.log(`✅ Invitation resent to ${invitation.email}`);

    return true;
  }

  async deleteInvitation(invitationId: string): Promise<boolean> {
    await db.delete(invitations).where(eq(invitations.id, invitationId));
    console.log(`🗑️  Invitation deleted: ${invitationId}`);
    return true;
  }
}

export const invitationService = new InvitationService();
