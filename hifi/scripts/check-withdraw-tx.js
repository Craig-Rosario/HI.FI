require('dotenv').config();
const { ethers } = require('ethers');

const RPC = 'https://sepolia.base.org';
const provider = new ethers.JsonRpcProvider(RPC);

const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const ARC_USDC = '0xa2C75790AEC2d0cE701a34197E3c5947A83C5D4e';
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

async function main() {
  // Check the latest withdrawal tx
  const txHash = '0x713916cbf361c101a416f2fea992aae2249c22f4c0b485bda843a3ad65d93895';
  
  console.log('=== Checking withdrawal tx:', txHash, '===\n');
  
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log('Transaction not found');
    return;
  }
  
  console.log('From:', receipt.from);
  console.log('To:', receipt.to);
  console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
  console.log('Logs count:', receipt.logs.length);
  
  // Parse ERC20 Transfer events
  const transferTopic = ethers.id('Transfer(address,address,uint256)');
  
  console.log('\n=== Token Transfer Events ===');
  for (const log of receipt.logs) {
    if (log.topics[0] === transferTopic && log.topics.length >= 3) {
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const amount = BigInt(log.data);
      const tokenAddr = log.address.toLowerCase();
      
      let tokenName = tokenAddr;
      if (tokenAddr === ARC_USDC.toLowerCase()) tokenName = 'arcUSDC';
      else if (tokenAddr === USDC.toLowerCase()) tokenName = 'USDC';
      
      console.log(`${tokenName}: ${from} → ${to} (${Number(amount) / 1e6} units)`);
      
      if (to.toLowerCase() === ENTRY_POINT.toLowerCase()) {
        console.log('  ⚠️  TOKENS SENT TO ENTRYPOINT!');
      }
    }
  }
  
  // Check current balances
  const arcUsdc = new ethers.Contract(ARC_USDC, ERC20_ABI, provider);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);
  
  const circleWalletAddr = '0xa1c4ad1a1fffba940df7e271fee25f5efb115d3b'; // from tx record
  
  console.log('\n=== Current Balances ===');
  console.log('Circle Wallet:', circleWalletAddr);
  console.log('  arcUSDC:', ethers.formatUnits(await arcUsdc.balanceOf(circleWalletAddr), 6));
  console.log('  USDC:', ethers.formatUnits(await usdc.balanceOf(circleWalletAddr), 6));
  
  console.log('EntryPoint:', ENTRY_POINT);
  console.log('  arcUSDC:', ethers.formatUnits(await arcUsdc.balanceOf(ENTRY_POINT), 6));
  console.log('  USDC:', ethers.formatUnits(await usdc.balanceOf(ENTRY_POINT), 6));
}

main().catch(console.error);
