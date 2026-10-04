import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  http,
  keccak256,
  parseEther,
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
      { name: 'owners', type: 'address[]' },
      { name: 'threshold', type: 'uint256' },
    ],
    outputs: [{ name: 'account', type: 'address' }],
  },
] as const;

export const accountAbi = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'threshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getProposal',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'proposer', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'action', type: 'uint8' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'intentHash', type: 'bytes32' },
      { name: 'approvalCount', type: 'uint256' },
      { name: 'executed', type: 'bool' },
    ],
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
    name: 'canExecute',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'proposeTransaction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'action', type: 'uint8' },
      { name: 'expiresAt', type: 'uint256' },
    ],
    outputs: [{ name: 'proposalId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approveTransaction',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeTransaction',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeWithPayload',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'action', type: 'uint8' },
    ],
    outputs: [],
  },
] as const;

export const publicClient = createPublicClient({
  chain: localChain,
  transport: http(config.rpcUrl),
});

export async function readAccountState(accountAddress: Address) {
  const [owners, threshold, balance] = await Promise.all([
    publicClient.readContract({
      address: accountAddress,
      abi: accountAbi,
      functionName: 'getOwners',
    }),
    publicClient.readContract({
      address: accountAddress,
      abi: accountAbi,
      functionName: 'threshold',
    }),
    publicClient.getBalance({ address: accountAddress }),
  ]);

  return {
    owners,
    threshold: Number(threshold),
    balance,
  };
}

export async function readProposal(accountAddress: Address, proposalId: number) {
  return publicClient.readContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
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
  return publicClient.readContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'canExecute',
    args: [BigInt(proposalId)],
  });
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

export async function createAccount(owners: Address[], threshold = 3) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const { request, result } = await publicClient.simulateContract({
    address: config.factoryAddress,
    abi: factoryAbi,
    functionName: 'createAccount',
    args: [owners, BigInt(threshold)],
    account,
  });
  const hash = await walletClient.writeContract(request);
  await waitForTransaction(walletClient, hash);
  return { hash, accountAddress: result as Address };
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

export async function proposeTransaction(
  accountAddress: Address,
  recipient: Address,
  amount: string,
  expiresAt: number,
) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'proposeTransaction',
    args: [recipient, parseEther(amount), ACTION_TRANSFER, BigInt(expiresAt)],
    account,
  });
  return waitForTransaction(walletClient, hash);
}

export async function approveTransaction(accountAddress: Address, proposalId: number) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'approveTransaction',
    args: [BigInt(proposalId)],
    account,
  });
  return waitForTransaction(walletClient, hash);
}

export async function executeTransaction(accountAddress: Address, proposalId: number) {
  const walletClient = getWalletClient();
  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    address: accountAddress,
    abi: accountAbi,
    functionName: 'executeTransaction',
    args: [BigInt(proposalId)],
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
    functionName: 'executeWithPayload',
    args: [BigInt(proposalId), recipient, parseEther(amount), ACTION_TRANSFER],
    account,
  });
  return waitForTransaction(walletClient, hash);
}

export function makeIntentHash(
  accountAddress: Address,
  proposalId: number,
  recipient: Address,
  amount: string,
  expiresAt: number,
  nonce: number,
) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint8' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [
        accountAddress,
        BigInt(proposalId),
        recipient,
        parseEther(amount),
        ACTION_TRANSFER,
        BigInt(expiresAt),
        BigInt(nonce),
        BigInt(config.chainId),
      ],
    ),
  );
}
