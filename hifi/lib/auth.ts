import crypto from 'crypto-js';
import { ethers } from 'ethers';

export function generateNonce(): string {
  return crypto.lib.WordArray.random(128/8).toString();
}

export function generateUsername(walletAddress: string): string {
  return walletAddress.slice(0, 6).toUpperCase();
}

export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}