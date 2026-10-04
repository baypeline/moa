import { Injectable, ServiceUnavailableException } from '@nestjs/common';
/** Read-only integration boundary. No ABI or Contract signatures have been agreed yet. */
@Injectable()
export class BlockchainService {
  metadataContext() {
    return {
      source: 'offchain_metadata',
      blockchain: { status: 'not_configured' },
    };
  }
  // TODO: discover accounts and filter using actual on-chain owners, never DB creator.
  async findAccountAddressesByOwner(_owner: string): Promise<string[]> {
    return this.unavailable();
  }
  // TODO: use actual Contract reads for threshold, Intent, expiration and executionMatch.
  async getProposalSecurity(
    _address: string,
    _proposalId: string,
  ): Promise<unknown> {
    return this.unavailable();
  }
  private unavailable(): never {
    throw new ServiceUnavailableException({
      code: 'BLOCKCHAIN_NOT_CONFIGURED',
      message: 'Smart Contract 조회 연동이 아직 구성되지 않았습니다.',
    });
  }
}
