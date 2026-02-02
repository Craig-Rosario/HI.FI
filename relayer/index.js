///////////////////////////////////////////////////////////////////////////////
// HIFI RELAYER - Crosschain Pooled Investment Coordinator
// Arc Testnet (Treasury) ↔ Ethereum Sepolia (Execution)
///////////////////////////////////////////////////////////////////////////////

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import { GatewayClient } from '../gateway/unified-balance-quickstart/gateway-client.js';
import { burnIntent, burnIntentTypedData } from '../gateway/unified-balance-quickstart/typed-data.js';

dotenv.config();

///////////////////////////////////////////////////////////////////////////////
// CONFIGURATION
///////////////////////////////////////////////////////////////////////////////

const CONFIG = {
  // Arc (Treasury Layer)
  arc: {
    rpc: process.env.ARC_RPC_URL,
    poolVault: process.env.ARC_POOL_VAULT,
    usdc: process.env.ARC_USDC,
    domain: parseInt(process.env.ARC_DOMAIN_ID || '26'),
  },
  // Sepolia (Execution Layer)
  sepolia: {
    rpc: process.env.SEPOLIA_RPC_URL,
    aaveAdapter: process.env.SEPOLIA_AAVE_ADAPTER,
    usdc: process.env.SEPOLIA_USDC,
    aUsdc: process.env.SEPOLIA_AUSDC,
    domain: parseInt(process.env.SEPOLIA_DOMAIN_ID || '0'),
    gatewayMinter: process.env.SEPOLIA_GATEWAY_MINTER || '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B', // Circle Gateway Minter on Sepolia
  },
  // Relayer
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
  circleApiKey: process.env.CIRCLE_API_KEY,
  navSyncInterval: parseInt(process.env.NAV_SYNC_INTERVAL_MS || '600000'),
};

// Validate configuration
function validateConfig() {
  const required = [
    ['ARC_RPC_URL', CONFIG.arc.rpc],
    ['ARC_POOL_VAULT', CONFIG.arc.poolVault],
    ['SEPOLIA_RPC_URL', CONFIG.sepolia.rpc],
    ['SEPOLIA_AAVE_ADAPTER', CONFIG.sepolia.aaveAdapter],
    ['RELAYER_PRIVATE_KEY', CONFIG.relayerPrivateKey],
  ];

  for (const [name, value] of required) {
    if (!value) {
      console.error(`❌ Missing required environment variable: ${name}`);
      process.exit(1);
    }
  }
}

validateConfig();

///////////////////////////////////////////////////////////////////////////////
// PROVIDERS & CONTRACTS
///////////////////////////////////////////////////////////////////////////////

console.log('🔧 Initializing providers...');

// Arc provider
const arcProvider = new ethers.JsonRpcProvider(CONFIG.arc.rpc);

// Sepolia provider
const sepoliaProvider = new ethers.JsonRpcProvider(CONFIG.sepolia.rpc);

// Relayer wallet
const relayerWallet = new ethers.Wallet(CONFIG.relayerPrivateKey);
const arcSigner = relayerWallet.connect(arcProvider);
const sepoliaSigner = relayerWallet.connect(sepoliaProvider);

console.log(`✅ Relayer address: ${relayerWallet.address}`);

// Load contract ABIs
const poolVaultABI = JSON.parse(
  fs.readFileSync('./contracts/PoolVault.json', 'utf8')
).abi;

const aaveAdapterABI = JSON.parse(
  fs.readFileSync('./contracts/AaveAdapter.json', 'utf8')
).abi;

// Contract instances
const poolVault = new ethers.Contract(
  CONFIG.arc.poolVault,
  poolVaultABI,
  arcProvider
);

const poolVaultSigner = poolVault.connect(arcSigner);

const aaveAdapter = new ethers.Contract(
  CONFIG.sepolia.aaveAdapter,
  aaveAdapterABI,
  sepoliaProvider
);

const aaveAdapterSigner = aaveAdapter.connect(sepoliaSigner);

console.log(`✅ Arc PoolVault: ${CONFIG.arc.poolVault}`);
console.log(`✅ Sepolia AaveAdapter: ${CONFIG.sepolia.aaveAdapter}`);

///////////////////////////////////////////////////////////////////////////////
// RELAYER STATE
///////////////////////////////////////////////////////////////////////////////

let isProcessing = false;

///////////////////////////////////////////////////////////////////////////////
// BRIDGE SERVICE (Arc → Sepolia via Circle Gateway)
///////////////////////////////////////////////////////////////////////////////

/**
 * Bridge USDC from Arc to Sepolia using Circle Gateway / CCTP
 * 
 * Flow:
 * 1. PoolVault holds USDC on Arc
 * 2. Relayer burns USDC on Arc (via Gateway)
 * 3. Circle Gateway provides attestation
 * 4. Relayer mints USDC on Sepolia to AaveAdapter
 * 
 * @param {bigint} amount - USDC amount to bridge (6 decimals)
 * @returns {Promise<void>}
 */
async function bridgeUSDC(amount) {
  console.log('\n🌉 BRIDGING USDC');
  console.log('=====================================');
  console.log(`Source: Arc (Domain ${CONFIG.arc.domain})`);
  console.log(`Destination: Sepolia (Domain ${CONFIG.sepolia.domain})`);
  console.log(`Amount: ${ethers.formatUnits(amount, 6)} USDC`);
  console.log(`Recipient: ${CONFIG.sepolia.aaveAdapter}`);

  try {
    // Initialize Gateway client
    const gatewayClient = new GatewayClient();
    
    // Get relayer wallet on Arc
    const arcWallet = new ethers.Wallet(CONFIG.relayerPrivateKey, arcProvider);
    
    // Construct burn intent using the Gateway helper
    console.log('\n📝 Constructing burn intent...');
    
    // Get contract addresses for Arc and Sepolia
    const gatewayInfo = await gatewayClient.info();
    const arcInfo = gatewayInfo.domains?.find(c => c.domain === CONFIG.arc.domain);
    const sepoliaInfo = gatewayInfo.domains?.find(c => c.domain === CONFIG.sepolia.domain);
    
    if (!arcInfo || !sepoliaInfo) {
      throw new Error('Unable to get Gateway domain info. Check if Arc and Sepolia are supported.');
    }
    
    // Construct transfer objects matching gateway-client format
    const fromChain = {
      domain: CONFIG.arc.domain,
      gatewayWallet: { address: arcInfo.walletContract.address },
      usdc: { address: CONFIG.arc.usdc },
    };
    
    const toChain = {
      domain: CONFIG.sepolia.domain,
      gatewayMinter: { address: sepoliaInfo.minterContract.address },
      usdc: { address: CONFIG.sepolia.usdc },
    };
    
    const intent = burnIntent({
      account: { address: arcWallet.address },
      from: fromChain,
      to: toChain,
      amount: Number(ethers.formatUnits(amount, 6)), // Convert to decimal USDC
      recipient: CONFIG.sepolia.aaveAdapter, // Mint to AaveAdapter on Sepolia
    });
    
    const typedData = burnIntentTypedData(intent);
    
    // Sign burn intent with relayer wallet
    console.log('✍️  Signing burn intent...');
    
    // Ethers requires types without EIP712Domain
    const { EIP712Domain, ...typesWithoutDomain } = typedData.types;
    
    const signature = await arcWallet.signTypedData(
      typedData.domain,
      typesWithoutDomain,
      typedData.message
    );
    
    // Request attestation from Gateway API
    console.log('⏳ Requesting attestation from Circle Gateway...');
    const startTime = performance.now();
    const response = await gatewayClient.transfer([
      { burnIntent: typedData.message, signature },
    ]);
    const endTime = performance.now();
    
    if (response.success === false) {
      throw new Error(`Gateway API error: ${response.message}`);
    }
    
    console.log(`✅ Attestation received in ${(endTime - startTime).toFixed(2)}ms`);
    
    // Mint on Sepolia
    console.log('\n💸 Minting USDC on Sepolia...');
    const gatewayMinterAbi = [
      'function gatewayMint(bytes attestation, bytes signature) external'
    ];
    
    const gatewayMinter = new ethers.Contract(
      CONFIG.sepolia.gatewayMinter,
      gatewayMinterAbi,
      sepoliaSigner
    );
    
    const mintTx = await gatewayMinter.gatewayMint(
      response.attestation,
      response.signature
    );
    
    console.log(`   Tx: ${mintTx.hash}`);
    const receipt = await mintTx.wait();
    console.log(`✅ Mint complete (Block: ${receipt.blockNumber})`);
    
    // Verify USDC arrived
    const usdcContract = new ethers.Contract(
      CONFIG.sepolia.usdc,
      ['function balanceOf(address) view returns (uint256)'],
      sepoliaProvider
    );
    
    const balance = await usdcContract.balanceOf(CONFIG.sepolia.aaveAdapter);
    console.log(`\n📊 AaveAdapter USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);
    
  } catch (error) {
    console.error('\n❌ Bridge failed:', error.message);
    console.error('   This might be a Gateway API issue or incorrect configuration');
    console.error('\n⚠️  Falling back to manual bridge mode');
    console.error(`   Please manually bridge ${ethers.formatUnits(amount, 6)} USDC to:`);
    console.error(`   Address: ${CONFIG.sepolia.aaveAdapter}`);
    console.error(`   Network: Sepolia`);
    throw error;
  }
}

///////////////////////////////////////////////////////////////////////////////
// AAVE EXECUTION (Sepolia)
///////////////////////////////////////////////////////////////////////////////

/**
 * Deposit USDC to Aave via AaveAdapter on Sepolia
 * 
 * Prerequisites:
 * - USDC must be in AaveAdapter contract
 * - AaveAdapter.deposit() is permissionless (anyone can call)
 * 
 * @param {bigint} amount - USDC amount to deposit
 * @returns {Promise<void>}
 */
async function depositToAave(amount) {
  console.log('\n💰 DEPOSITING TO AAVE');
  console.log('=====================================');
  console.log(`Amount: ${ethers.formatUnits(amount, 6)} USDC`);
  
  try {
    // Check USDC balance in AaveAdapter
    const usdcContract = new ethers.Contract(
      CONFIG.sepolia.usdc,
      ['function balanceOf(address) view returns (uint256)'],
      sepoliaProvider
    );
    
    const balance = await usdcContract.balanceOf(CONFIG.sepolia.aaveAdapter);
    console.log(`Current USDC in AaveAdapter: ${ethers.formatUnits(balance, 6)} USDC`);
    
    if (balance < amount) {
      console.log(`⚠️  Insufficient USDC in AaveAdapter`);
      console.log(`   Required: ${ethers.formatUnits(amount, 6)} USDC`);
      console.log(`   Available: ${ethers.formatUnits(balance, 6)} USDC`);
      console.log(`   Skipping Aave deposit for now`);
      return;
    }
    
    console.log('⏳ Calling AaveAdapter.deposit()...');
    const tx = await aaveAdapterSigner.deposit(amount);
    console.log(`   Tx hash: ${tx.hash}`);
    
    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`✅ Deposited to Aave (Block ${receipt.blockNumber})`);
    
    // Log YieldDeployed event
    const yieldEvent = receipt.logs.find(
      log => log.topics[0] === ethers.id('YieldDeployed(uint256,uint256)')
    );
    
    if (yieldEvent) {
      console.log(`   Event: YieldDeployed`);
    }
    
  } catch (error) {
    console.error(`❌ Aave deposit failed: ${error.message}`);
    throw error;
  }
}

///////////////////////////////////////////////////////////////////////////////
// NAV SYNC (Sepolia → Arc)
///////////////////////////////////////////////////////////////////////////////

/**
 * Sync NAV from Sepolia back to Arc
 * 
 * Flow:
 * 1. Read aUSDC balance from AaveAdapter on Sepolia
 * 2. Call PoolVault.updateNAV() on Arc with new balance
 * 
 * Requires: RELAYER_ROLE on PoolVault
 * 
 * @returns {Promise<void>}
 */
async function syncNAV() {
  console.log('\n📊 NAV SYNC');
  console.log('=====================================');
  
  try {
    // Read aUSDC balance
    const aUSDCBalance = await aaveAdapter.getBalance();
    console.log(`Sepolia aUSDC balance: ${ethers.formatUnits(aUSDCBalance, 6)} USDC`);
    
    // Read current NAV on Arc
    const currentNAV = await poolVault.nav();
    console.log(`Current Arc NAV: ${ethers.formatUnits(currentNAV, 6)} USDC`);
    
    // Only update if different
    if (aUSDCBalance === currentNAV) {
      console.log('✅ NAV already in sync, no update needed');
      return;
    }
    
    console.log('⏳ Updating NAV on Arc PoolVault...');
    const tx = await poolVaultSigner.updateNAV(aUSDCBalance);
    console.log(`   Tx hash: ${tx.hash}`);
    
    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`✅ NAV updated (Block ${receipt.blockNumber})`);
    console.log(`   Old NAV: ${ethers.formatUnits(currentNAV, 6)} USDC`);
    console.log(`   New NAV: ${ethers.formatUnits(aUSDCBalance, 6)} USDC`);
    
  } catch (error) {
    console.error(`❌ NAV sync failed: ${error.message}`);
    
    // Check if relayer has RELAYER_ROLE
    if (error.message.includes('AccessControl')) {
      console.error('⚠️  Relayer may not have RELAYER_ROLE on PoolVault');
      console.error(`   Relayer address: ${relayerWallet.address}`);
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
// DEPOSIT MONITORING (Crosschain User Deposits)
///////////////////////////////////////////////////////////////////////////////

/**
 * Monitor incoming USDC transfers to relayer address
 * Triggers depositFor() when user deposits from other chains
 */
function monitorIncomingDeposits() {
  console.log('👀 Monitoring incoming USDC for crosschain deposits...\n');
  
  const arcUSDC = new ethers.Contract(
    CONFIG.arc.usdc,
    ['event Transfer(address indexed from, address indexed to, uint256 value)'],
    arcProvider
  );
  
  arcUSDC.on('Transfer', async (from, to, amount, event) => {
    // Only process transfers TO relayer
    if (to.toLowerCase() !== relayerWallet.address.toLowerCase()) return;
    
    // Skip if from PoolVault (that's NAV updates, not deposits)
    if (from.toLowerCase() === CONFIG.arc.poolVault.toLowerCase()) return;
    
    console.log('\n💰 INCOMING USDC DETECTED');
    console.log('=====================================');
    console.log(`Amount: ${ethers.formatUnits(amount, 6)} USDC`);
    console.log(`From: ${from}`);
    console.log(`Tx: ${event.log.transactionHash}`);
    console.log(`Block: ${event.log.blockNumber}`);
    
    // Query backend for user address
    try {
      const userAddress = await fetchUserForDeposit(event.log.transactionHash);
      
      if (!userAddress) {
        console.log('⚠️  Unknown deposit - no user mapping found');
        console.log('   This USDC will remain in relayer wallet');
        return;
      }
      
      console.log(`User: ${userAddress}`);
      
      // Execute depositFor
      await executeDepositFor(userAddress, amount);
      
    } catch (error) {
      console.error('❌ Deposit processing error:', error.message);
    }
  });
}

/**
 * Fetch user address from backend by transaction hash
 */
async function fetchUserForDeposit(txHash) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/deposit/lookup?tx=${txHash}`);
    
    if (!response.ok) {
      console.log('⚠️  Backend lookup failed');
      return null;
    }
    
    const data = await response.json();
    return data.userAddress;
  } catch (error) {
    console.error('Backend fetch error:', error.message);
    return null;
  }
}

/**
 * Execute depositFor on behalf of user
 */
async function executeDepositFor(userAddress, amount) {
  console.log('\n📝 EXECUTING DEPOSIT FOR USER');
  console.log('=====================================');
  console.log(`User: ${userAddress}`);
  console.log(`Amount: ${ethers.formatUnits(amount, 6)} USDC`);
  
  try {
    // Approve PoolVault
    const usdc = new ethers.Contract(
      CONFIG.arc.usdc,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      arcSigner
    );
    
    console.log('⏳ Approving PoolVault...');
    const approveTx = await usdc.approve(CONFIG.arc.poolVault, amount);
    await approveTx.wait();
    console.log('✅ Approved');
    
    // Call depositFor
    const poolVaultWithSigner = poolVaultSigner;
    
    console.log('⏳ Calling depositFor()...');
    const depositTx = await poolVaultWithSigner.depositFor(userAddress, amount);
    console.log(`   Tx hash: ${depositTx.hash}`);
    
    const receipt = await depositTx.wait();
    console.log(`✅ Deposit completed (Block ${receipt.blockNumber})`);
    
    // Check new shares
    const userShares = await poolVault.shares(userAddress);
    console.log(`   User now has: ${ethers.formatUnits(userShares, 6)} shares`);
    
    console.log('\n✅ USER DEPOSIT COMPLETED');
    console.log('=====================================\n');
    
  } catch (error) {
    console.error('❌ depositFor failed:', error.message);
    throw error;
  }
}

///////////////////////////////////////////////////////////////////////////////
// EVENT LISTENER (Arc PoolVault)
///////////////////////////////////////////////////////////////////////////////

/**
 * Handle DeploymentRequested event from PoolVault
 * 
 * Triggered when:
 * - User calls activatePool() on PoolVault
 * - Pool threshold is met
 * - Pool state transitions from Collecting → Active
 * 
 * @param {bigint} amount - USDC amount to deploy
 * @param {Event} event - Ethereum event object
 */
async function handleDeploymentRequested(amount, event) {
  console.log('\n🚨 DEPLOYMENT REQUESTED EVENT DETECTED');
  console.log('=====================================');
  console.log(`Block: ${event.log.blockNumber}`);
  console.log(`Amount: ${ethers.formatUnits(amount, 6)} USDC`);
  console.log(`Transaction: ${event.log.transactionHash}`);
  
  // Prevent concurrent processing
  if (isProcessing) {
    console.log('⚠️  Already processing a deployment request, skipping...');
    return;
  }
  
  isProcessing = true;
  
  try {
    // STEP 1: Bridge USDC from Arc to Sepolia
    await bridgeUSDC(amount);
    
    // STEP 2: Deposit USDC to Aave on Sepolia
    await depositToAave(amount);
    
    // STEP 3: Sync NAV back to Arc
    await syncNAV();
    
    console.log('\n✅ DEPLOYMENT FLOW COMPLETED');
    console.log('=====================================\n');
    
  } catch (error) {
    console.error('\n❌ DEPLOYMENT FLOW FAILED');
    console.error('=====================================');
    console.error(error);
    console.error('');
  } finally {
    isProcessing = false;
  }
}

///////////////////////////////////////////////////////////////////////////////
// MAIN: START RELAYER
///////////////////////////////////////////////////////////////////////////////

async function main() {
  console.log('\n🚀 HIFI RELAYER STARTING');
  console.log('=====================================');
  console.log('Arc → Sepolia Crosschain Coordinator');
  console.log('');
  
  // Verify network connections
  try {
    const arcNetwork = await arcProvider.getNetwork();
    console.log(`✅ Arc network: ${arcNetwork.name} (Chain ID: ${arcNetwork.chainId})`);
    
    const sepoliaNetwork = await sepoliaProvider.getNetwork();
    console.log(`✅ Sepolia network: ${sepoliaNetwork.name} (Chain ID: ${sepoliaNetwork.chainId})`);
  } catch (error) {
    console.error('❌ Network connection failed:', error.message);
    process.exit(1);
  }
  
  // Verify relayer has funds
  try {
    const arcBalance = await arcProvider.getBalance(relayerWallet.address);
    console.log(`💰 Arc balance: ${ethers.formatEther(arcBalance)} ARC`);
    
    const sepoliaBalance = await sepoliaProvider.getBalance(relayerWallet.address);
    console.log(`💰 Sepolia balance: ${ethers.formatEther(sepoliaBalance)} ETH`);
  } catch (error) {
    console.error('❌ Balance check failed:', error.message);
  }
  
  // Verify PoolVault state
  try {
    const state = await poolVault.state();
    const nav = await poolVault.nav();
    const threshold = await poolVault.threshold();
    
    console.log('\n📊 PoolVault State:');
    console.log(`   State: ${state === 0n ? 'Collecting' : 'Active'}`);
    console.log(`   NAV: ${ethers.formatUnits(nav, 6)} USDC`);
    console.log(`   Threshold: ${ethers.formatUnits(threshold, 6)} USDC`);
  } catch (error) {
    console.error('❌ PoolVault state check failed:', error.message);
  }
  
  console.log('\n✅ RELAYER READY');
  console.log('=====================================');
  console.log('Listening for DeploymentRequested events on Arc...');
  console.log('');
  
  // Listen to DeploymentRequested events
  poolVault.on('DeploymentRequested', handleDeploymentRequested);
  
  // NEW: Monitor incoming USDC for crosschain deposits
  monitorIncomingDeposits();
  
  // Periodic NAV sync (every 10 minutes)
  console.log(`📅 NAV sync scheduled every ${CONFIG.navSyncInterval / 1000 / 60} minutes\n`);
  setInterval(async () => {
    if (!isProcessing) {
      await syncNAV();
    }
  }, CONFIG.navSyncInterval);
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\n\n🛑 RELAYER SHUTTING DOWN');
    console.log('=====================================');
    poolVault.removeAllListeners();
    process.exit(0);
  });
}

// Start relayer
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
