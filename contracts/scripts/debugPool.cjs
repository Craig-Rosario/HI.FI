const { ethers } = require('ethers');

async function debugPool() {
  const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
  
  const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'; // Arc native USDC
  const POOL_ADDRESS = '0x2Ab5B38Cc67D3B23677d3e3A6C726baf0dBed65c';
  
  const poolABI = [
    'function nav() view returns (uint256)',
    'function threshold() view returns (uint256)',
    'function state() view returns (uint8)',
    'function totalShares() view returns (uint256)',
    'function usdc() view returns (address)',
  ];
  
  const usdcABI = [
    'function balanceOf(address) view returns (uint256)',
  ];
  
  console.log('Pool Address:', POOL_ADDRESS);
  console.log('USDC Address:', USDC_ADDRESS);
  console.log('='.repeat(60));
  
  const pool = new ethers.Contract(POOL_ADDRESS, poolABI, provider);
  const usdc = new ethers.Contract(USDC_ADDRESS, usdcABI, provider);
  
  const [nav, threshold, state, totalShares, poolUsdcAddr, usdcBalance] = await Promise.all([
    pool.nav(),
    pool.threshold(),
    pool.state(),
    pool.totalShares(),
    pool.usdc(),
    usdc.balanceOf(POOL_ADDRESS),
  ]);
  
  console.log('\nContract State:');
  console.log(`NAV (from contract): ${ethers.formatUnits(nav, 6)} USDC`);
  console.log(`USDC Balance (actual): ${ethers.formatUnits(usdcBalance, 6)} USDC`);
  console.log(`Threshold: ${ethers.formatUnits(threshold, 6)} USDC`);
  console.log(`Total Shares: ${ethers.formatUnits(totalShares, 6)}`);
  console.log(`State: ${state === 0n ? 'Collecting' : 'Active'}`);
  console.log(`Pool's USDC address: ${poolUsdcAddr}`);
  console.log(`Expected USDC address: ${USDC_ADDRESS}`);
  console.log(`USDC address matches: ${poolUsdcAddr.toLowerCase() === USDC_ADDRESS.toLowerCase()}`);
}

debugPool().catch(console.error);
