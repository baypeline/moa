import { config } from './config';

export type Activity = {
  id: string;
  type: string;
  actor?: { address: string; name?: string };
  createdAt: string;
};

export async function getAccountMetadata(address: string) {
  if (!config.backendUrl) return null;
  const response = await fetch(config.backendUrl + '/api/accounts/' + address);
  if (!response.ok) throw new Error('Account 정보를 불러오지 못했습니다.');
  const body = await response.json();
  return body.data;
}

export async function getActivities(address: string): Promise<Activity[]> {
  if (!config.backendUrl) return [];
  const response = await fetch(config.backendUrl + '/api/accounts/' + address + '/activities');
  if (!response.ok) throw new Error('Activity를 불러오지 못했습니다.');
  const body = await response.json();
  return body.data.items || body.data;
}

export async function saveAccountMetadata(address: string, name: string, creator: string, txHash: string) {
  if (!config.backendUrl) return;
  await fetch(config.backendUrl + '/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, name, creator, txHash }),
  });
}

export async function saveProposalMetadata(
  address: string,
  proposalId: number,
  purpose: string,
  recipientLabel: string,
  memo: string,
  txHash: string,
) {
  if (!config.backendUrl) return;
  await fetch(config.backendUrl + '/api/accounts/' + address + '/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId, purpose, recipientLabel, memo, txHash }),
  });
}
