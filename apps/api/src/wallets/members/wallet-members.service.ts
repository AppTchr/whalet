import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MemberResponseDto, MemberListResponseDto } from './dto/member-response.dto';
import { WalletMember, WalletMemberRole } from '@prisma/client';

export interface UserVerifiedEvent {
  userId: string;
  email: string;
}

@Injectable()
export class WalletMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveMembership(
    walletId: string,
    userId: string,
  ): Promise<WalletMember | null> {
    return this.prisma.walletMember.findFirst({
      where: { walletId, userId, status: 'active' },
    });
  }

  async invite(
    walletId: string,
    invitedByUserId: string,
    dto: InviteMemberDto,
  ): Promise<MemberResponseDto> {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    try {
      const member = await this.prisma.walletMember.create({
        data: {
          walletId,
          role: dto.role,
          invitedByUserId,
          invitedAt: new Date(),
          ...(existingUser
            ? {
                userId: existingUser.id,
                status: 'active',
                // FIX M5: don't store invitedEmail for registered users — PII not needed
                invitedEmail: null,
              }
            : {
                userId: null,
                status: 'invited',
                invitedEmail: email,
              }),
        },
      });

      return this.toDto(member);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('MEMBER_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async findAllByWallet(walletId: string): Promise<MemberListResponseDto> {
    const members = await this.prisma.walletMember.findMany({
      where: { walletId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      members: members.map((m) => this.toDto(m)),
      total: members.length,
    };
  }

  async ensureNotLastOwner(walletId: string, targetMemberId: string): Promise<void> {
    // FIX L2: scope lookup to walletId to prevent cross-wallet confusion
    const targetMember = await this.prisma.walletMember.findFirst({
      where: { id: targetMemberId, walletId },
      select: { role: true, status: true },
    });

    if (!targetMember || targetMember.status !== 'active' || targetMember.role !== 'owner') {
      return;
    }

    const ownerCount = await this.prisma.walletMember.count({
      where: { walletId, role: 'owner', status: 'active' },
    });

    if (ownerCount <= 1) {
      throw new UnprocessableEntityException('LAST_OWNER_CANNOT_BE_REVOKED');
    }
  }

  async changeRole(
    walletId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberResponseDto> {
    const member = await this.prisma.walletMember.findFirst({
      where: { id: memberId, walletId },
    });

    if (!member) {
      throw new NotFoundException('MEMBER_NOT_FOUND');
    }

    if (
      member.role === 'owner' &&
      dto.role !== ('owner' as WalletMemberRole)
    ) {
      await this.ensureNotLastOwner(walletId, memberId);
    }

    // FIX C1: include walletId in where to prevent cross-wallet write
    const updated = await this.prisma.walletMember.update({
      where: { id: memberId, walletId },
      data: { role: dto.role },
    });

    return this.toDto(updated);
  }

  async revoke(walletId: string, memberId: string): Promise<void> {
    const member = await this.prisma.walletMember.findFirst({
      where: { id: memberId, walletId },
    });

    if (!member) {
      throw new NotFoundException('MEMBER_NOT_FOUND');
    }

    // FIX M3: prevent silent revokedAt overwrite on already-revoked member
    if (member.status === 'revoked') {
      throw new UnprocessableEntityException('MEMBER_ALREADY_REVOKED');
    }

    // FIX C2: wrap last-owner check + update in a serializable transaction
    // to prevent race condition where two concurrent requests both revoke owners
    await this.prisma.$transaction(
      async (tx) => {
        const ownerCount = await tx.walletMember.count({
          where: { walletId, role: 'owner', status: 'active' },
        });

        if (member.role === 'owner' && ownerCount <= 1) {
          throw new UnprocessableEntityException('LAST_OWNER_CANNOT_BE_REVOKED');
        }

        // FIX C1: include walletId in where to prevent cross-wallet write
        await tx.walletMember.update({
          where: { id: memberId, walletId },
          data: { status: 'revoked', revokedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async activatePendingInvitesByEmail(
    email: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.walletMember.updateMany({
      where: {
        invitedEmail: email.toLowerCase().trim(),
        status: 'invited',
        userId: null,
      },
      data: {
        userId,
        status: 'active',
        // FIX M5: clear invitedEmail once identity is resolved — no lingering PII
        invitedEmail: null,
      },
    });
  }

  @OnEvent('user.verified')
  async handleUserVerified(event: UserVerifiedEvent): Promise<void> {
    await this.activatePendingInvitesByEmail(event.email, event.userId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toDto(member: WalletMember): MemberResponseDto {
    // FIX H2: normalize status — 'invited' becomes 'pending' externally so the
    // API never reveals whether the invited email is registered in the system
    const externalStatus: 'active' | 'pending' | 'revoked' =
      member.status === 'invited' ? 'pending' : member.status;

    return {
      id: member.id,
      walletId: member.walletId,
      userId: member.userId,
      role: member.role,
      status: externalStatus,
      invitedEmail: member.invitedEmail,
      invitedByUserId: member.invitedByUserId,
      invitedAt: member.invitedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
