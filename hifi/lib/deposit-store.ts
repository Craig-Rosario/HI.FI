// In-memory storage for deposits - in production use database
export const deposits = new Map<string, {
  txId: string;
  status: 'pending' | 'gateway_complete' | 'vault_complete' | 'failed';
  sourceChain: string;
  destinationChain: string;
  amount: string;
  userAddress: string;
  gatewayTx?: string;
  vaultTx?: string;
  error?: string;
  createdAt: number;
}>();
