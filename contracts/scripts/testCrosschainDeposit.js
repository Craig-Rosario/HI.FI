// Test crosschain deposit flow
// Simulates a user depositing USDC from Sepolia to Arc Pool

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

const ARC_RPC = 'https://rpc.testnet.arc.network';
const ARC_USDC = '0x8d28df956801068aa8f3a45edf92d58ea1f0b3f1';
const RELAYER_ADDRESS = process.env.ARC_RELAYER_ADDRESS || '0xC11291d70fE1Efeddeb013544abBeF49B14981B8';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function testCrosschainDeposit() {
  console.log('🧪 TESTING CROSSCHAIN DEPOSIT FLOW');
  console.log('=====================================\n');

  // Connect to Arc
  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const wallet = new ethers.Wallet(process.env.ARC_PRIVATE_KEY, provider);
  const userAddress = wallet.address;

  console.log(`👤 User address: ${userAddress}`);
  console.log(`🤖 Relayer address: ${RELAYER_ADDRESS}\n`);

  // Check USDC balance
  const usdc = new ethers.Contract(ARC_USDC, USDC_ABI, wallet);
  const balance = await usdc.balanceOf(userAddress);
  console.log(`💰 User USDC balance: ${ethers.formatUnits(balance, 6)} USDC\n`);

  // Step 1: Register deposit with backend
  const depositAmount = '2'; // 2 USDC
  console.log('📝 Step 1: Registering deposit with backend...');
  
  // For MVP, we'll send USDC first, then register
  // In production with Circle Gateway, registration happens first

  // Step 2: Transfer USDC to relayer
  console.log('\n💸 Step 2: Transferring USDC to relayer...');
  const amountInUSDC = ethers.parseUnits(depositAmount, 6);
  const transferTx = await usdc.transfer(RELAYER_ADDRESS, amountInUSDC);
  console.log(`   Tx hash: ${transferTx.hash}`);
  console.log('   Waiting for confirmation...');
  
  const receipt = await transferTx.wait();
  console.log(`✅ Transfer confirmed (Block ${receipt.blockNumber})`);

  // Step 3: Register with backend
  console.log('\n📤 Step 3: Calling backend API...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/deposit/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        txHash: receipt.hash,
        amount: depositAmount,
        sourceChain: 'Arc (Direct)',
        destinationChain: 'Arc',
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Backend registered deposit: ${data.depositId}`);
  } catch (error) {
    console.error('⚠️  Backend registration failed (relayer might still detect):', error.message);
  }

  // Step 4: Wait for relayer
  console.log('\n⏳ Step 4: Waiting for relayer to process...');
  console.log('   The relayer should:');
  console.log('   1. Detect the USDC transfer');
  console.log('   2. Query backend for user address');
  console.log('   3. Call depositFor(user, amount) on PoolVault');
  console.log('   4. Mint shares to user\n');
  console.log('⏰ Check relayer logs to verify processing...\n');

  console.log('✅ TEST DEPOSIT INITIATED');
  console.log('=====================================');
  console.log(`📊 View relayer terminal for processing status`);
  console.log(`🔍 Tx hash: ${receipt.hash}`);
}

testCrosschainDeposit().catch(error => {
  console.error('\n❌ TEST FAILED:', error);
  process.exit(1);
});
