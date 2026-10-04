import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../account/account.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { normalizeAddress } from '../common/input';
import { CreateProposalDto } from './proposal.dto';
@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountService,
    private readonly blockchain: BlockchainService,
  ) {}
  async list(address: string) {
    await this.accounts.requireMetadata(address);
    return {
      ...this.blockchain.metadataContext(),
      items: await this.prisma.proposalMetadata.findMany({
        where: { accountAddress: normalizeAddress(address) },
        orderBy: [{ createdAt: 'desc' }, { proposalId: 'asc' }],
      }),
    };
  }
  async requireMetadata(address: string, proposalId: string) {
    await this.accounts.requireMetadata(address);
    const metadata = await this.prisma.proposalMetadata.findUnique({
      where: {
        accountAddress_proposalId: {
          accountAddress: normalizeAddress(address),
          proposalId,
        },
      },
    });
    if (!metadata)
      throw new NotFoundException({
        code: 'PROPOSAL_NOT_FOUND',
        message: '지출 제안 metadata를 찾을 수 없습니다.',
      });
    return metadata;
  }
  async get(address: string, proposalId: string) {
    return {
      ...this.blockchain.metadataContext(),
      metadata: await this.requireMetadata(address, proposalId),
    };
  }
  async create(address: string, dto: CreateProposalDto) {
    await this.accounts.requireMetadata(address);
    const data = {
      accountAddress: normalizeAddress(address),
      proposalId: dto.proposalId,
      purpose: dto.purpose,
      recipientLabel: dto.recipientLabel ?? null,
      memo: dto.memo ?? null,
      creationTxHash: dto.creationTxHash?.toLowerCase() ?? null,
    };
    const existing = await this.prisma.proposalMetadata.findUnique({
      where: {
        accountAddress_proposalId: {
          accountAddress: data.accountAddress,
          proposalId: data.proposalId,
        },
      },
    });
    if (existing) {
      if (
        existing.purpose === data.purpose &&
        existing.recipientLabel === data.recipientLabel &&
        existing.memo === data.memo &&
        existing.creationTxHash === data.creationTxHash
      )
        return { ...this.blockchain.metadataContext(), metadata: existing };
      throw new ConflictException({
        code: 'PROPOSAL_METADATA_CONFLICT',
        message: '다른 지출 제안 metadata가 이미 등록되어 있습니다.',
      });
    }
    return {
      ...this.blockchain.metadataContext(),
      metadata: await this.prisma.proposalMetadata.create({ data }),
    };
  }
  security(address: string, proposalId: string) {
    return this.blockchain.getProposalSecurity(
      normalizeAddress(address),
      proposalId,
    );
  }
}
