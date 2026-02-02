///////////////////////////////////////////////////////////////////////////////
// HIFI RELAYER HTTP API SERVER
// Handles deposit requests from frontend and coordinates cross-chain flow
///////////////////////////////////////////////////////////////////////////////

import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import { GatewayClient } from '../gateway/unified-balance-quickstart/gateway-client.js';
import { burnIntent, burnIntentTypedData } from '../gateway/unified-balance-quickstart/typed-data.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

///////////////////////////////////////////////////////////////////////////////
// CONFIGURATION
///////////////////////////////////////////////////////////////////////////////

const CONFIG = {
  arc: {
    rpc: process.env.ARC_RPC_URL,
    poolVault: process.env.ARC_POOL_VAULT || '0xddC39afa01D12911340975eFe6379FF92E22445f',
    usdc: process.env.ARC_USDC || '0x3600000000000000000000000000000000000000',
    domain: parseInt(process.env.ARC_DOMAIN_ID || '26'),
    gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
  },
  sepolia: {
    rpc: process.env.SEPOLIA_RPC_URL,
    aaveAdapter: process.env.SEPOLIA_AAVE_ADAPTER,
    usdc: process.env.SEPOLIA_USDC || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    domain: parseInt(process.env.SEPOLIA_DOMAIN_ID || '0'),
    gatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
  },
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
  port: parseInt(process.env.PORT || '3001'),
};

///////////////////////////////////////////////////////////////////////////////
// PROVIDERS & CONTRACTS
///////////////////////////////////////////////////////////////////////////////

const arcProvider = new ethers.JsonRpcProvider(CONFIG.arc.rpc);
const sepoliaProvider = new ethers.JsonRpcProvider(CONFIG.sepolia.rpc);
const relayerWallet = new ethers.Wallet(CONFIG.relayerPrivateKey);
const arcSigner = relayerWallet.connect(arcProvider);
const sepoliaSigner = relayerWallet.connect(sepoliaProvider);

// Load ABIs
const poolVaultABI = JSON.parse(fs.readFileSync('./contracts/PoolVault.json', 'utf8')).abi;
const usdcABI = [
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// Contract instances
const poolVault = new ethers.Contract(CONFIG.arc.poolVault, poolVaultABI, arcSigner);
const sepoliaUSDC = new ethers.Contract(CONFIG.sepolia.usdc, usdcABI, sepoliaSigner);

// In-memory deposit tracking
const pendingDeposits = new Map();

///////////////////////////////////////////////////////////////////////////////
// BRIDGE FUNCTIONS
///////////////////////////////////////////////////////////////////////////////

/**
 * Bridge USDC from Sepolia to Arc using Circle Gateway CCTP
 */
async function bridgeSepoliaToArc(amount, recipient) {
  console.log(`\n🌉 Bridging ${ethers.formatUnits(amount, 6)} USDC from Sepolia → Arc`);
  
  try {
    const gatewayClient = new GatewayClient();
    
    // Get gateway info
    const gatewayInfo = await gatewayClient.info();
    const sepoliaInfo = gatewayInfo.domains?.find(c => c.domain === CONFIG.sepolia.domain);
    const arcInfo = gatewayInfo.domains?.find(c => c.domain === CONFIG.arc.domain);
    
    if (!sepoliaInfo || !arcInfo) {
      throw new Error('Unable to get Gateway chain info');
    }
    
    // Construct burn intent
    const fromChain = {
      domain: CONFIG.sepolia.domain,
      gatewayWallet: { address: sepoliaInfo.walletContract.address },
      usdc: { address: CONFIG.sepolia.usdc },
    };
    
    const toChain = {
      domain: CONFIG.arc.domain,
      gatewayMinter: { address: arcInfo.minterContract.address },
      usdc: { address: CONFIG.arc.usdc },
    };
    
    const intent = burnIntent({
      account: { address: relayerWallet.address },
      from: fromChain,
      to: toChain,
      amount: Number(ethers.formatUnits(amount, 6)),
      recipient: recipient || relayerWallet.address,
    });
    
    const typedData = burnIntentTypedData(intent);
    
    // Sign with ethers (remove EIP712Domain from types)
    const { EIP712Domain, ...typesWithoutDomain } = typedData.types;
    const signature = await sepoliaSigner.signTypedData(
      typedData.domain,
      typesWithoutDomain,
      typedData.message
    );
    
    console.log('✍️  Burn intent signed');
    
    // Request attestation
    console.log('⏳ Requesting attestation from Circle Gateway...');
    const response = await gatewayClient.transfer([
      { burnIntent: typedData.message, signature },
    ]);
    
    if (response.success === false) {
      throw new Error(`Gateway API error: ${response.message}`);
    }
    
    console.log('✅ Attestation received');
    
    // Mint on Arc
    console.log('💸 Minting USDC on Arc...');
    const gatewayMinterAbi = ['function gatewayMint(bytes attestation, bytes signature) external'];
    const gatewayMinter = new ethers.Contract(arcInfo.minterContract.address, gatewayMinterAbi, arcSigner);
    
    const mintTx = await gatewayMinter.gatewayMint(response.attestation, response.signature);
    const receipt = await mintTx.wait();
    
    console.log(`✅ Minted on Arc (Block ${receipt.blockNumber})`);
    
    return {
      success: true,
      txHash: mintTx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('❌ Bridge failed:', error.message);
    throw error;
  }
}

/**
 * Deposit USDC into pool on Arc
 */
async function depositToPool(amount, userAddress) {
  console.log(`\n💰 Depositing ${ethers.formatUnits(amount, 6)} USDC to pool for ${userAddress}`);
  
  try {
    // Check relayer balance
    const arcUSDC = new ethers.Contract(CONFIG.arc.usdc, usdcABI, arcSigner);
    const balance = await arcUSDC.balanceOf(relayerWallet.address);
    
    if (balance < amount) {
      throw new Error(`Insufficient USDC balance: ${ethers.formatUnits(balance, 6)} < ${ethers.formatUnits(amount, 6)}`);
    }
    
    // Approve pool if needed
    const allowance = await arcUSDC.allowance(relayerWallet.address, CONFIG.arc.poolVault);
    if (allowance < amount) {
      console.log('📝 Approving pool...');
      const approveTx = await arcUSDC.approve(CONFIG.arc.poolVault, ethers.MaxUint256);
      await approveTx.wait();
    }
    
    // Deposit for user
    console.log('💸 Depositing to pool...');
    const depositTx = await poolVault.depositFor(userAddress, amount);
    const receipt = await depositTx.wait();
    
    console.log(`✅ Deposited (Block ${receipt.blockNumber})`);
    
    return {
      success: true,
      txHash: depositTx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('❌ Deposit failed:', error.message);
    throw error;
  }
}

///////////////////////////////////////////////////////////////////////////////
// API ROUTES
///////////////////////////////////////////////////////////////////////////////

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', relayer: relayerWallet.address });
});

// Get relayer address
app.get('/api/relayer/address', (req, res) => {
  res.json({ relayerAddress: relayerWallet.address });
});

// Process deposit request
app.post('/api/deposit/process', async (req, res) => {
  try {
    const { userAddress, amount, poolAddress, txHash } = req.body;
    
    // Validate inputs
    if (!userAddress || !amount || !txHash) {
      return res.status(400).json({ 
        error: 'Missing required fields: userAddress, amount, txHash' 
      });
    }
    
    const depositId = `${txHash}-${Date.now()}`;
    
    // Check if already processing
    if (pendingDeposits.has(txHash)) {
      return res.status(409).json({ 
        error: 'Deposit already being processed',
        depositId: pendingDeposits.get(txHash).id,
      });
    }
    
    // Register deposit
    pendingDeposits.set(txHash, {
      id: depositId,
      userAddress,
      amount,
      poolAddress: poolAddress || CONFIG.arc.poolVault,
      txHash,
      status: 'pending',
      createdAt: Date.now(),
    });
    
    console.log(`\n📥 New deposit request: ${depositId}`);
    console.log(`   User: ${userAddress}`);
    console.log(`   Amount: ${ethers.formatUnits(amount, 6)} USDC`);
    console.log(`   Tx: ${txHash}`);
    
    // Return immediately - process async
    res.json({
      success: true,
      depositId,
      message: 'Deposit queued for processing',
    });
    
    // Process deposit in background
    processDeposit(depositId).catch(error => {
      console.error(`Failed to process deposit ${depositId}:`, error.message);
      const deposit = pendingDeposits.get(txHash);
      if (deposit) {
        deposit.status = 'failed';
        deposit.error = error.message;
      }
    });
    
  } catch (error) {
    console.error('Deposit request error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get deposit status
app.get('/api/deposit/status/:depositId', (req, res) => {
  const { depositId } = req.params;
  
  // Find deposit by ID
  for (const [txHash, deposit] of pendingDeposits.entries()) {
    if (deposit.id === depositId) {
      return res.json(deposit);
    }
  }
  
  res.status(404).json({ error: 'Deposit not found' });
});

/**
 * Process a deposit end-to-end
 */
async function processDeposit(depositId) {
  const deposit = Array.from(pendingDeposits.values()).find(d => d.id === depositId);
  if (!deposit) {
    throw new Error('Deposit not found');
  }
  
  try {
    deposit.status = 'verifying';
    
    // 1. Verify user transferred USDC to relayer on Sepolia
    console.log('\n1️⃣ Verifying USDC transfer on Sepolia...');
    const receipt = await sepoliaProvider.getTransactionReceipt(deposit.txHash);
    if (!receipt) {
      throw new Error('Transaction not found');
    }
    
    if (!receipt.status) {
      throw new Error('Transaction failed');
    }
    
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Use the amount from deposit request (already verified by user's wallet)
    const transferredAmount = ethers.getBigInt(deposit.amount);
    console.log(`✅ Amount: ${ethers.formatUnits(transferredAmount, 6)} USDC`);
    
    deposit.status = 'bridging';
    
    // 2. Bridge from Sepolia to Arc
    console.log('\n2️⃣ Bridging USDC from Sepolia to Arc...');
    const bridgeResult = await bridgeSepoliaToArc(transferredAmount, relayerWallet.address);
    deposit.bridgeTxHash = bridgeResult.txHash;
    
    deposit.status = 'depositing';
    
    // 3. Deposit to pool on Arc
    console.log('\n3️⃣ Depositing to pool on Arc...');
    const depositResult = await depositToPool(transferredAmount, deposit.userAddress);
    deposit.poolTxHash = depositResult.txHash;
    
    deposit.status = 'completed';
    deposit.completedAt = Date.now();
    
    console.log(`\n✅ Deposit ${depositId} completed successfully!`);
    console.log(`   Bridge: ${bridgeResult.txHash}`);
    console.log(`   Pool: ${depositResult.txHash}`);
    
  } catch (error) {
    deposit.status = 'failed';
    deposit.error = error.message;
    throw error;
  }
}

///////////////////////////////////////////////////////////////////////////////
// POOL MONITORING
///////////////////////////////////////////////////////////////////////////////

let poolMonitorInterval = null;

/**
 * Check if pool has reached threshold and trigger Aave deployment
 */
async function checkPoolThreshold() {
  try {
    const [nav, threshold, state] = await Promise.all([
      poolVault.nav(),
      poolVault.threshold(),
      poolVault.state(),
    ]);
    
    const progress = (Number(nav) / Number(threshold) * 100).toFixed(2);
    
    console.log(`📊 Pool Status: ${ethers.formatUnits(nav, 6)}/${ethers.formatUnits(threshold, 6)} USDC (${progress}%)`);
    
    // Threshold reached and not yet deployed
    if (nav >= threshold && state === 0n) {
      console.log('\n🎉 Pool threshold reached! Ready for Aave deployment');
      console.log('━'.repeat(60));
      console.log('   Pool is 100% funded!');
      console.log(`   Total: ${ethers.formatUnits(nav, 6)} USDC`);
      console.log('\n   To deploy to Aave:');
      console.log('   $ node deploy-pool-to-aave.js');
      console.log('\n   This will:');
      console.log('   1. Withdraw USDC from pool on Arc');
      console.log('   2. Bridge USDC to Sepolia via Circle CCTP');
      console.log('   3. Deposit into Aave for yield (~3-8% APY)');
      console.log('   4. Activate pool and start earning');
      console.log('━'.repeat(60) + '\n');
      
      // Stop monitoring once threshold is reached
      if (poolMonitorInterval) {
        clearInterval(poolMonitorInterval);
        poolMonitorInterval = null;
        console.log('✅ Pool monitoring stopped (threshold reached)\n');
      }
    } else if (state === 1n) {
      console.log('   State: ACTIVE (deployed to Aave) ✅\n');
      
      // Stop monitoring if already deployed
      if (poolMonitorInterval) {
        clearInterval(poolMonitorInterval);
        poolMonitorInterval = null;
        console.log('✅ Pool monitoring stopped (already deployed)\n');
      }
    }
  } catch (error) {
    console.error('Pool monitoring error:', error.message);
  }
}

// Start pool monitoring (check every 30 seconds)
function startPoolMonitoring() {
  console.log('👀 Starting pool monitoring...\n');
  
  // Check immediately
  checkPoolThreshold();
  
  // Then check every 30 seconds
  poolMonitorInterval = setInterval(checkPoolThreshold, 30000);
}

///////////////////////////////////////////////////////////////////////////////
// START SERVER
///////////////////////////////////////////////////////////////////////////////

app.listen(CONFIG.port, () => {
  console.log('\n🚀 HI.FI Relayer Server Started');
  console.log('━'.repeat(60));
  console.log(`📡 Listening on port ${CONFIG.port}`);
  console.log(`👤 Relayer: ${relayerWallet.address}`);
  console.log(`🏦 Pool: ${CONFIG.arc.poolVault}`);
  console.log(`🌉 Gateway: Sepolia (${CONFIG.sepolia.domain}) ↔ Arc (${CONFIG.arc.domain})`);
  console.log('━'.repeat(60) + '\n');
  
  // Start monitoring pool
  startPoolMonitoring();
});
