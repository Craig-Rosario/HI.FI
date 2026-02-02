const { ethers } = require('ethers');

async function checkPoolStatus() {
  const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
  
  const poolABI = [
    'function nav() view returns (uint256)',
    'function threshold() view returns (uint256)',
    'function state() view returns (uint8)',
    'function totalShares() view returns (uint256)',
  ];
  
  const pools = [
    { name: 'Pool 1', address: '0x5BF5868E09D9395968F7C2A989679F4a5b415683' },
    { name: 'Pool 2', address: '0x2Ab5B38Cc67D3B23677d3e3A6C726baf0dBed65c' },
  ];
  
  for (const pool of pools) {
    console.log(`\n${pool.name} (${pool.address}):`);
    console.log('='.repeat(60));
    
    try {
      const contract = new ethers.Contract(pool.address, poolABI, provider);
      
      const [nav, threshold, state, totalShares] = await Promise.all([
        contract.nav(),
        contract.threshold(),
        contract.state(),
        contract.totalShares(),
      ]);
      
      console.log(`NAV: ${ethers.formatUnits(nav, 6)} USDC`);
      console.log(`Threshold: ${ethers.formatUnits(threshold, 6)} USDC`);
      console.log(`Progress: ${(Number(nav) / Number(threshold) * 100).toFixed(2)}%`);
      console.log(`State: ${state === 0n ? 'Collecting' : state === 1n ? 'Active' : 'Unknown'}`);
      console.log(`Total Shares: ${ethers.formatUnits(totalShares, 6)}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

checkPoolStatus().catch(console.error);
