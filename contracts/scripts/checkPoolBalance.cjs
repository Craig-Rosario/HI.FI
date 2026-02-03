const { ethers } = require('ethers');
require('dotenv').config();

async function checkPoolBalance() {
  const arcProvider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL);
  
  const poolAddress = '0x84A7329d0e6AC7f088e0b8E99A73E7033F7AfEfB';
  const arcUSDC = '0x3600000000000000000000000000000000000000';
  
  const usdcABI = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract(arcUSDC, usdcABI, arcProvider);
  
  const balance = await usdc.balanceOf(poolAddress);
  
  console.log('Pool Contract USDC Balance:', ethers.formatUnits(balance, 6), 'USDC');
}

checkPoolBalance().catch(console.error);
