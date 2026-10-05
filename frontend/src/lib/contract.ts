import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  http,
  keccak256,
  parseEventLogs,
  parseEther,
  formatEther,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { config } from './config';

export const ACTION_TRANSFER = 0;

const localChain = {
  id: config.chainId,
  name: 'Moa Local Network',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
} as const;

export const factoryAbi = [
  {
    type: 'function',
    name: 'createAccount',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owners', type: 'address[5]' },
    ],
    outputs: [{ name: 'account', type: 'address' }],
  },
  {
    type: 'event',
    name: 'AccountCreated',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'owners', type: 'address[5]', indexed: false },
      { name: 'threshold', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const accountAbi = [
  {
    type: 'function',
    name: 'owners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[5]' }],
  },
  {
    type: 'function',
    name: 'THRESHOLD',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getProposal',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'proposer', type: 'address' },
        { name: 'target', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'intentHash', type: 'bytes32' },
        { name: 'approvalCount', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'createdAt', type: 'uint256' },
      ],
    }],
  },
  {
    type: 'function',
    name: 'hasApproved',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'computeIntentHash',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'createProposal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: 'proposalId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approveProposal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeProposal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelProposal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'balance', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'proposer', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
      { name: 'intentHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalApproved',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'approvalCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalExecuted',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'executor', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
      { name: 'intentHash', type: 'bytes32', indexed: false },
    ],
  },
] as const;

type OnchainProposal = {
  proposer: Address;
  target: Address;
  value: bigint;
  data: Hex;
  intentHash: Hex;
  approvalCount: bigint;
  status: number;
  createdAt: bigint;
};

export const publicClient = createPublicClient({
  chain: localChain,
  transport: http(config.rpcUrl),
});

export async function readAccountState(accountAddress: Address) {
  const [owners, threshold, balance] = await Promise.all([
    publicClient.readContract({
      address: accountAddress,
      abi: accountAbi,
      functionName: 'owners',
    }),
    publicClient.readContract({
      address: accountAddress,
      abi: accountAbi,
      functionName: 'THRESHOLD',
    }),
    publicClient.getBalance({ address: accountAddress }),
  ]);

  return {
    owners: Array.from(owners),
    threshold: Number(threshold),
    balance: formatEther(balance),
  };
}

export async function readProposal(accountAddress: Address, proposalId: number) {
  return publicClient.readContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
  }) as Promise<OnchainProposal>;
}

export async function readProposalCount(accountAddress: Address) {
  return publicClient.readContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'proposalCount',
  });
}

export async function readApproval(accountAddress: Address, proposalId: number, owner: Address) {
  return publicClient.readContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'hasApproved',
    args: [BigInt(proposalId), owner],
  });
}

export async function readCanExecute(accountAddress: Address, proposalId: number) {
  const [proposal, balance] = await Promise.all([
    readProposal(accountAddress, proposalId),
    publicClient.getBalance({ address: accountAddress }),
  ]);
  return proposal.status === 0 && proposal.approvalCount >= 3n && balance >= proposal.value;
}

export function getWalletClient() {
  if (!window.ethereum) {
    throw new Error('브라우저 지갑을 찾을 수 없습니다.');
  }

  return createWalletClient({
    chain: localChain,
    transport: custom(window.ethereum),
  });
}

export async function connectWallet() {
  const walletClient = getWalletClient();
  const [address] = await walletClient.requestAddresses();
  return address;
}

async function waitForTransaction(client: WalletClient, hash: Hex) {
  await (publicClient as PublicClient).waitForTransactionReceipt({ hash });
  return hash;
}

export async function createAccount(owners: Address[]) {
  if (owners.length !== 5) throw new Error('공동계좌에는 Owner 5명이 필요합니다.');
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const { request } = await publicClient.simulateContract({
    address: config.factoryAddress,
    abi: factoryAbi,
    functionName: 'createAccount',
    args: [owners as [Address, Address, Address, Address, Address]],
    account,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: 'AccountCreated' });
  const log = logs[0];
  if (!log) throw new Error('AccountCreated 이벤트를 찾지 못했습니다.');
  return { hash, accountAddress: log.args.account };
}

export async function deposit(accountAddress: Address, amount: string) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.sendTransaction({
    account,
    to: accountAddress,
    value: parseEther(amount),
  });
  return waitForTransaction(walletClient, hash);
}

export async function createProposal(
  accountAddress: Address,
  recipient: Address,
  amount: string,
) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'createProposal',
    args: [recipient, parseEther(amount), '0x'],
    account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: accountAbi, logs: receipt.logs, eventName: 'ProposalCreated' });
  const log = logs[0];
  if (!log) throw new Error('ProposalCreated 이벤트를 찾지 못했습니다.');
  return { hash, proposalId: Number(log.args.proposalId), intentHash: log.args.intentHash };
}

export async function approveTransaction(accountAddress: Address, proposalId: number) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'approveProposal',
    args: [BigInt(proposalId)],
    account,
  });
  return waitForTransaction(walletClient, hash);
}

export async function executeTransaction(accountAddress: Address, proposalId: number) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const proposal = await readProposal(accountAddress, proposalId);
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'executeProposal',
    args: [BigInt(proposalId), proposal.target, proposal.value, proposal.data],
    account,
  });
  return waitForTransaction(walletClient, hash);
}

export async function executeWithPayload(
  accountAddress: Address,
  proposalId: number,
  recipient: Address,
  amount: string,
) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'executeProposal',
    args: [BigInt(proposalId), recipient, parseEther(amount), '0x'],
    account,
  });
  return waitForTransaction(walletClient, hash);
}

export function makeIntentHash(
  accountAddress: Address,
  proposalId: number,
  recipient: Address,
  amount: string,
  data: Hex = '0x',
) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [
        accountAddress,
        BigInt(config.chainId),
        BigInt(proposalId),
        recipient,
        parseEther(amount),
        keccak256(data),
      ],
    ),
  );
}
