'use client';

import { useState, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';

// Contract addresses
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // USDC on Ethereum Sepolia
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // USDC on Base Sepolia
const GATEWAY_WALLET = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9'; // Circle Gateway Wallet
const GATEWAY_MINTER = '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B'; // Circle Gateway Minter
const ARC_USDC_BASE_SEPOLIA = '0x0DD76fB7C83A84C57C81A4353B565f34016aBaf8'; // arcUSDC on Base Sepolia (fallback)

// Chain IDs
const ETH_SEPOLIA_CHAIN_ID = 11155111;
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Bridge fee in USDC (6 decimals) - Circle Gateway max fee + buffer
const BRIDGE_FEE = BigInt(2100000); // 2.1 USDC to cover maxFee of 2.01 + small buffer
const MIN_DEPOSIT_AMOUNT = BigInt(3000000); // Minimum 3 USDC to ensure meaningful deposit after fees

// Contract ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const GATEWAY_WALLET_ABI = [
  'function deposit(address token, uint256 amount) external',
];

const GATEWAY_MINTER_ABI = [
  'function gatewayMint(bytes calldata attestation, bytes calldata signature) external',
];

const ARC_USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function deposit(uint256 amount) external',
];

const POOL_VAULT_ABI = [
  'function deposit(uint256 amount) external',
  'function shares(address user) external view returns (uint256)',
  'function totalShares() external view returns (uint256)',
  'function state() external view returns (uint8)',
];

export type InvestmentStep =
  | 'idle'
  | 'connecting'
  | 'switching_to_eth'
  | 'checking_balance'
  | 'approving_usdc'
  | 'depositing_gateway'
  | 'bridging'
  | 'switching_to_base'
  | 'minting_usdc'
  | 'wrapping_arcusdc'
  | 'approving_arcusdc'
  | 'depositing_vault'
  | 'complete'
  | 'error';

interface InvestmentState {
  step: InvestmentStep;
  message: string;
  txHash?: string;
  error?: string;
}

interface UseInvestReturn {
  state: InvestmentState;
  invest: (amount: string, poolId: string, poolContractAddress?: string) => Promise<void>;
  reset: () => void;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
    };
  }
}

export const useInvest = (): UseInvestReturn => {
  const [state, setState] = useState<InvestmentState>({
    step: 'idle',
    message: '',
  });

  const updateState = (step: InvestmentStep, message: string, txHash?: string) => {
    setState({ step, message, txHash });
  };

  const setError = (error: string) => {
    setState({ step: 'error', message: error, error });
  };

  const reset = useCallback(() => {
    setState({ step: 'idle', message: '' });
  }, []);

  const switchNetwork = async (chainId: number): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      return true;
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        try {
          if (chainId === ETH_SEPOLIA_CHAIN_ID) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${chainId.toString(16)}`,
                chainName: 'Ethereum Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              }],
            });
          } else if (chainId === BASE_SEPOLIA_CHAIN_ID) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${chainId.toString(16)}`,
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            });
          }
          return true;
        } catch (addError) {
          console.error('Failed to add network:', addError);
          return false;
        }
      }
      throw switchError;
    }
  };

  const invest = async (amount: string, poolId: string, poolContractAddress?: string) => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    // Use env variables with fallbacks
    const arcUsdcAddress = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS || ARC_USDC_BASE_SEPOLIA;
    // Use pool-specific contract address if provided, otherwise fall back to env variable
    const poolVaultAddress = poolContractAddress || process.env.NEXT_PUBLIC_POOL_VAULT_ADDRESS;

    console.log('Contract addresses:', {
      arcUsdcAddress,
      poolVaultAddress,
      usdcBaseSepolia: USDC_BASE_SEPOLIA,
      poolId,
      usingPoolSpecificAddress: !!poolContractAddress
    });

    if (!poolVaultAddress) {
      setError('Pool vault address not configured. Please check NEXT_PUBLIC_POOL_VAULT_ADDRESS environment variable.');
      return;
    }

    try {
      // Convert amount to USDC units (6 decimals)
      const inputAmount = ethers.parseUnits(amount, 6);
<<<<<<< Updated upstream
      
      // Validate minimum amount (must cover fees + have something left)
      if (inputAmount <= BRIDGE_FEE + MIN_DEPOSIT_AMOUNT) {
        throw new Error(`Minimum deposit is ${ethers.formatUnits(BRIDGE_FEE + MIN_DEPOSIT_AMOUNT, 6)} USDC (to cover ~2.1 USDC bridge fees)`);
      }
      
      // Calculate net amount after bridge fees
      // User deposits full inputAmount to Gateway, but bridge request is for (inputAmount - fees)
      const netAmountAfterFees = inputAmount - BRIDGE_FEE;
      
=======

      // Only apply bridge fees if bridging is required
      let netAmountAfterFees: bigint;
      if (needsBridge) {
        // Validate minimum amount (must cover fees + have something left)
        if (inputAmount <= BRIDGE_FEE + MIN_DEPOSIT_AMOUNT) {
          throw new Error(`Minimum deposit is ${ethers.formatUnits(BRIDGE_FEE + MIN_DEPOSIT_AMOUNT, 6)} USDC (to cover ~2.1 USDC bridge fees)`);
        }
        // Calculate net amount after bridge fees
        netAmountAfterFees = inputAmount - BRIDGE_FEE;
      } else {
        // No bridge needed - direct deposit on Base
        netAmountAfterFees = inputAmount;
      }

>>>>>>> Stashed changes
      console.log('Investment calculation:', {
        inputAmount: ethers.formatUnits(inputAmount, 6) + ' USDC',
        bridgeFee: ethers.formatUnits(BRIDGE_FEE, 6) + ' USDC',
        netAmountAfterFees: ethers.formatUnits(netAmountAfterFees, 6) + ' USDC'
      });

      // Step 1: Connect MetaMask
      updateState('connecting', 'Connecting to MetaMask...');

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const userAddress = accounts[0];

<<<<<<< Updated upstream
      // Step 2: Switch to Ethereum Sepolia
      updateState('switching_to_eth', 'Switching to Ethereum Sepolia...');
      await switchNetwork(ETH_SEPOLIA_CHAIN_ID);
=======
      // Different flow based on source chain
      if (needsBridge) {
        // ===== ETHEREUM → BASE BRIDGE FLOW =====

        // Step 2: Switch to Ethereum Sepolia
        updateState('switching_to_eth', 'Switching to Ethereum Sepolia...');
        await switchNetwork(ETH_SEPOLIA_CHAIN_ID);
>>>>>>> Stashed changes

      // Wait for network switch
      await new Promise(resolve => setTimeout(resolve, 1000));

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

<<<<<<< Updated upstream
      // Step 3: Check USDC balance on Ethereum Sepolia
      updateState('checking_balance', 'Checking USDC balance...');
      
      const usdcContract = new Contract(USDC_SEPOLIA, ERC20_ABI, signer);
      const balance = await usdcContract.balanceOf(userAddress);
      
      if (balance < inputAmount) {
        throw new Error(`Insufficient USDC balance. You have ${ethers.formatUnits(balance, 6)} USDC`);
      }

      // Step 4: Approve USDC for Gateway Wallet (full input amount)
      updateState('approving_usdc', 'Approve USDC for Gateway (MetaMask popup)...');
      
      const currentAllowance = await usdcContract.allowance(userAddress, GATEWAY_WALLET);
      
      if (currentAllowance < inputAmount) {
        const approveTx = await usdcContract.approve(GATEWAY_WALLET, inputAmount);
        updateState('approving_usdc', 'Waiting for USDC approval confirmation...', approveTx.hash);
        await approveTx.wait();
      }

      // Step 5: Deposit USDC into Gateway Wallet (full input amount - fees come from this)
      updateState('depositing_gateway', 'Deposit USDC to Gateway (MetaMask popup)...');
      
      console.log('Calling gatewayWallet.deposit() with:', {
        token: USDC_SEPOLIA,
        amount: inputAmount.toString(),
        amountFormatted: ethers.formatUnits(inputAmount, 6) + ' USDC (includes fees)'
      });
      
      const gatewayWallet = new Contract(GATEWAY_WALLET, GATEWAY_WALLET_ABI, signer);
      const depositGatewayTx = await gatewayWallet.deposit(USDC_SEPOLIA, inputAmount);
      console.log('Gateway deposit transaction submitted:', depositGatewayTx.hash);
      updateState('depositing_gateway', 'Waiting for Gateway deposit confirmation...', depositGatewayTx.hash);
      const depositReceipt = await depositGatewayTx.wait();
      console.log('Gateway deposit confirmed! Block:', depositReceipt.blockNumber);
=======
        // Step 3: Check USDC balance on Ethereum Sepolia
        updateState('checking_balance', 'Checking USDC balance...');

        const usdcContract = new Contract(USDC_SEPOLIA, ERC20_ABI, signer);
        const balance = await usdcContract.balanceOf(userAddress);

        if (balance < inputAmount) {
          throw new Error(`Insufficient USDC balance. You have ${ethers.formatUnits(balance, 6)} USDC`);
        }

        // Step 4: Approve USDC for Gateway Wallet (full input amount)
        updateState('approving_usdc', 'Approve USDC for Gateway (MetaMask popup)...');

        const currentAllowance = await usdcContract.allowance(userAddress, GATEWAY_WALLET);

        if (currentAllowance < inputAmount) {
          const approveTx = await usdcContract.approve(GATEWAY_WALLET, inputAmount);
          updateState('approving_usdc', 'Waiting for USDC approval confirmation...', approveTx.hash);
          await approveTx.wait();
        }

        // Step 5: Deposit USDC into Gateway Wallet (full input amount - fees come from this)
        updateState('depositing_gateway', 'Deposit USDC to Gateway (MetaMask popup)...');

        console.log('Calling gatewayWallet.deposit() with:', {
          token: USDC_SEPOLIA,
          amount: inputAmount.toString(),
          amountFormatted: ethers.formatUnits(inputAmount, 6) + ' USDC (includes fees)'
        });
>>>>>>> Stashed changes

        const gatewayWallet = new Contract(GATEWAY_WALLET, GATEWAY_WALLET_ABI, signer);
        const depositGatewayTx = await gatewayWallet.deposit(USDC_SEPOLIA, inputAmount);
        console.log('Gateway deposit transaction submitted:', depositGatewayTx.hash);
        updateState('depositing_gateway', 'Waiting for Gateway deposit confirmation...', depositGatewayTx.hash);
        const depositReceipt = await depositGatewayTx.wait();
        console.log('Gateway deposit confirmed! Block:', depositReceipt.blockNumber);

        // Verify Gateway balance after deposit
        console.log('Verifying Gateway balance...');
        const gatewayBalanceResponse = await fetch(
          `https://gateway-api-testnet.circle.com/v1/balances`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: 'USDC',
              sources: [{ depositor: userAddress, domain: 0 }]
            })
          }
        );
        const gatewayBalanceData = await gatewayBalanceResponse.json();
        console.log('Gateway balance after deposit:', gatewayBalanceData);

        // Step 6: Get burn intent typed data from API and sign with MetaMask
        updateState('bridging', 'Preparing cross-chain transfer...');

        // Use net amount (after fees) for the bridge request
        const bridgeAmount = ethers.formatUnits(netAmountAfterFees, 6);
        console.log('Bridge request amount (after fees):', bridgeAmount, 'USDC');

        // Get the burn intent typed data
        const burnIntentResponse = await fetch(
          `/api/bridge?amount=${bridgeAmount}&userAddress=${userAddress}&sourceChain=ethereum&destinationChain=base`
        );
        const burnIntentData = await burnIntentResponse.json();

        if (!burnIntentData.success) {
          throw new Error(burnIntentData.error || 'Failed to prepare bridge');
        }

        // Sign the burn intent with MetaMask (EIP-712)
        updateState('bridging', 'Sign bridge request (MetaMask popup)...');

        const typedData = burnIntentData.typedData;

        // Use eth_signTypedData_v4 for EIP-712 signing
        const signature = await window.ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [userAddress, JSON.stringify(typedData)],
        });

        // Send signature to API to get attestation from Circle Gateway
        updateState('bridging', 'Getting attestation from Circle Gateway...');

        const bridgeResponse = await fetch('/api/bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: bridgeAmount,
            userAddress,
            sourceChain: 'ethereum',
            destinationChain: 'base',
            signedBurnIntent: {
              burnIntent: typedData.message,
              signature,
            },
          }),
        });

        const bridgeResult = await bridgeResponse.json();

        if (!bridgeResult.success) {
          throw new Error(bridgeResult.error || 'Bridge failed');
        }

<<<<<<< Updated upstream
      // Step 6: Get burn intent typed data from API and sign with MetaMask
      updateState('bridging', 'Preparing cross-chain transfer...');
      
      // Use net amount (after fees) for the bridge request
      const bridgeAmount = ethers.formatUnits(netAmountAfterFees, 6);
      console.log('Bridge request amount (after fees):', bridgeAmount, 'USDC');
      
      // Get the burn intent typed data
      const burnIntentResponse = await fetch(
        `/api/bridge?amount=${bridgeAmount}&userAddress=${userAddress}&sourceChain=ethereum&destinationChain=base`
      );
      const burnIntentData = await burnIntentResponse.json();
      
      if (!burnIntentData.success) {
        throw new Error(burnIntentData.error || 'Failed to prepare bridge');
      }

      // Sign the burn intent with MetaMask (EIP-712)
      updateState('bridging', 'Sign bridge request (MetaMask popup)...');
      
      const typedData = burnIntentData.typedData;
      
      // Use eth_signTypedData_v4 for EIP-712 signing
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [userAddress, JSON.stringify(typedData)],
      });

      // Send signature to API to get attestation from Circle Gateway
      updateState('bridging', 'Getting attestation from Circle Gateway...');
      
      const bridgeResponse = await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bridgeAmount,
          userAddress,
          sourceChain: 'ethereum',
          destinationChain: 'base',
          signedBurnIntent: {
            burnIntent: typedData.message,
            signature,
          },
        }),
      });

      const bridgeResult = await bridgeResponse.json();
      
      if (!bridgeResult.success) {
        throw new Error(bridgeResult.error || 'Bridge failed');
      }

      // Verify we got attestation
      if (!bridgeResult.attestation || !bridgeResult.signature) {
        throw new Error('Failed to get attestation from Circle Gateway. Please ensure you have deposited USDC to Gateway Wallet first.');
      }

      // Step 7: Switch to Base Sepolia
      updateState('switching_to_base', 'Switching to Base Sepolia...');
      await switchNetwork(BASE_SEPOLIA_CHAIN_ID);

      // Wait for network switch
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get new provider/signer for Base
      const baseProvider = new BrowserProvider(window.ethereum);
      const baseSigner = await baseProvider.getSigner();

      // Step 8: Mint USDC on Base using attestation (this is required)
      updateState('minting_usdc', 'Minting USDC on Base (MetaMask popup)...');
      
      const gatewayMinter = new Contract(GATEWAY_MINTER, GATEWAY_MINTER_ABI, baseSigner);
      const mintTx = await gatewayMinter.gatewayMint(bridgeResult.attestation, bridgeResult.signature);
      updateState('minting_usdc', 'Waiting for mint confirmation...', mintTx.hash);
      await mintTx.wait();

      // Step 9: Check Base USDC balance after mint
      updateState('wrapping_arcusdc', 'Checking USDC balance on Base...');
      
      const baseUsdc = new Contract(USDC_BASE_SEPOLIA, ERC20_ABI, baseSigner);
      const baseUsdcBalance = await baseUsdc.balanceOf(userAddress);
      
      console.log('Base USDC balance after mint:', ethers.formatUnits(baseUsdcBalance, 6));
      
      // Use the actual received amount (may be less due to bridge fees)
      const wrapAmount = baseUsdcBalance < netAmountAfterFees ? baseUsdcBalance : netAmountAfterFees;
      
      if (wrapAmount === BigInt(0)) {
        throw new Error('No USDC received from bridge. The mint transaction may have failed.');
      }

      // Step 10: Approve USDC for arcUSDC wrapping
      updateState('wrapping_arcusdc', 'Approve USDC for arcUSDC (MetaMask popup)...');
      console.log('Approving USDC for arcUSDC wrapping:', ethers.formatUnits(wrapAmount, 6), 'USDC');
      
      const approveArcTx = await baseUsdc.approve(arcUsdcAddress, wrapAmount);
      updateState('wrapping_arcusdc', 'Waiting for approval confirmation...', approveArcTx.hash);
      await approveArcTx.wait();

      // Step 11: Wrap USDC to arcUSDC
      updateState('wrapping_arcusdc', 'Wrapping USDC to arcUSDC (MetaMask popup)...');
      console.log('Wrapping to arcUSDC at:', arcUsdcAddress);
      
      const arcUsdc = new Contract(arcUsdcAddress, ARC_USDC_ABI, baseSigner);
      const wrapTx = await arcUsdc.deposit(wrapAmount);
      updateState('wrapping_arcusdc', 'Waiting for wrap confirmation...', wrapTx.hash);
      await wrapTx.wait();
      console.log('arcUSDC wrap confirmed');

      // depositAmount = wrapAmount (1:1 ratio)
      const depositAmount = wrapAmount;

      // Step 12: Check PoolVault state before depositing
      updateState('approving_arcusdc', 'Checking pool status...');
      const poolVault = new Contract(poolVaultAddress, POOL_VAULT_ABI, baseSigner);
      
      try {
        const vaultState = await poolVault.state();
        console.log('PoolVault state:', vaultState);
        // State 0 = Collecting, State 1 = Deployed, State 2 = Withdraw
        if (vaultState !== BigInt(0)) {
          throw new Error(`Pool is not accepting deposits. Current state: ${vaultState === BigInt(1) ? 'Deployed' : 'Withdraw'}`);
=======
        // Verify we got attestation
        if (!bridgeResult.attestation || !bridgeResult.signature) {
          throw new Error('Failed to get attestation from Circle Gateway. Please ensure you have deposited USDC to Gateway Wallet first.');
>>>>>>> Stashed changes
        }

<<<<<<< Updated upstream
      // Step 13: Approve arcUSDC for PoolVault
      updateState('approving_arcusdc', 'Approve arcUSDC for PoolVault (MetaMask popup)...');
      console.log('Approving arcUSDC for PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');
      console.log('PoolVault address:', poolVaultAddress);
      
      const approveVaultTx = await arcUsdc.approve(poolVaultAddress, depositAmount);
      updateState('approving_arcusdc', 'Waiting for approval confirmation...', approveVaultTx.hash);
      await approveVaultTx.wait();
      console.log('arcUSDC approval for vault confirmed');

      // Step 14: Deposit arcUSDC into PoolVault
      updateState('depositing_vault', 'Deposit to PoolVault (MetaMask popup)...');
      console.log('Depositing to PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');
      
      const vaultDepositTx = await poolVault.deposit(depositAmount);
      updateState('depositing_vault', 'Waiting for vault deposit confirmation...', vaultDepositTx.hash);
      await vaultDepositTx.wait();

      // Complete!
      updateState('complete', `Successfully invested ${ethers.formatUnits(depositAmount, 6)} USDC!`, vaultDepositTx.hash);

      // Record the investment in our backend
      await fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: depositAmount.toString(),
          sourceChain: 'ethereum',
          destinationChain: 'base',
          userAddress,
          poolId,
          txHash: vaultDepositTx.hash,
          inputAmount: inputAmount.toString(), // Original input amount
          bridgeFee: BRIDGE_FEE.toString(), // Fee deducted
        }),
      });
=======
        // Step 7: Switch to Base Sepolia
        updateState('switching_to_base', 'Switching to Base Sepolia...');
        await switchNetwork(BASE_SEPOLIA_CHAIN_ID);

        // Wait for network switch
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get new provider/signer for Base
        const baseProvider = new BrowserProvider(window.ethereum);
        const baseSigner = await baseProvider.getSigner();

        // Step 8: Mint USDC on Base using attestation (this is required)
        updateState('minting_usdc', 'Minting USDC on Base (MetaMask popup)...');

        const gatewayMinter = new Contract(GATEWAY_MINTER, GATEWAY_MINTER_ABI, baseSigner);
        const mintTx = await gatewayMinter.gatewayMint(bridgeResult.attestation, bridgeResult.signature);
        updateState('minting_usdc', 'Waiting for mint confirmation...', mintTx.hash);
        await mintTx.wait();

        // Step 9: Check Base USDC balance after mint
        updateState('wrapping_arcusdc', 'Checking USDC balance on Base...');

        const baseUsdc = new Contract(USDC_BASE_SEPOLIA, ERC20_ABI, baseSigner);
        const baseUsdcBalance = await baseUsdc.balanceOf(userAddress);

        console.log('Base USDC balance after mint:', ethers.formatUnits(baseUsdcBalance, 6));

        // Use the actual received amount (may be less due to bridge fees)
        const wrapAmount = baseUsdcBalance < netAmountAfterFees ? baseUsdcBalance : netAmountAfterFees;

        if (wrapAmount === BigInt(0)) {
          throw new Error('No USDC received from bridge. The mint transaction may have failed.');
        }

        // Step 10: Approve USDC for arcUSDC wrapping
        updateState('wrapping_arcusdc', 'Approve USDC for arcUSDC (MetaMask popup)...');
        console.log('Approving USDC for arcUSDC wrapping:', ethers.formatUnits(wrapAmount, 6), 'USDC');

        let approveArcTx = await baseUsdc.approve(arcUsdcAddress, wrapAmount);
        updateState('wrapping_arcusdc', 'Waiting for approval confirmation...', approveArcTx.hash);
        await approveArcTx.wait();

        // Step 11: Wrap USDC to arcUSDC
        updateState('wrapping_arcusdc', 'Wrapping USDC to arcUSDC (MetaMask popup)...');
        console.log('Wrapping to arcUSDC at:', arcUsdcAddress);

        let arcUsdc = new Contract(arcUsdcAddress, ARC_USDC_ABI, baseSigner);
        let wrapTx = await arcUsdc.deposit(wrapAmount);
        updateState('wrapping_arcusdc', 'Waiting for wrap confirmation...', wrapTx.hash);
        await wrapTx.wait();
        console.log('arcUSDC wrap confirmed');

        // depositAmount = wrapAmount (1:1 ratio)
        let depositAmount = wrapAmount;

        // Step 12: Check PoolVault state before depositing
        updateState('approving_arcusdc', 'Checking pool status...');
        let poolVault = new Contract(poolVaultAddress, POOL_VAULT_ABI, baseSigner);

        try {
          const vaultState = await poolVault.state();
          console.log('PoolVault state:', vaultState);
          // State 0 = Collecting, State 1 = Deployed, State 2 = Withdraw
          if (vaultState !== BigInt(0)) {
            throw new Error(`Pool is not accepting deposits. Current state: ${vaultState === BigInt(1) ? 'Deployed' : 'Withdraw'}`);
          }
        } catch (stateError: any) {
          console.warn('Could not check vault state:', stateError.message);
          // Continue anyway
        }

        // Step 13: Approve arcUSDC for PoolVault
        updateState('approving_arcusdc', 'Approve arcUSDC for PoolVault (MetaMask popup)...');
        console.log('Approving arcUSDC for PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');
        console.log('PoolVault address:', poolVaultAddress);

        let approveVaultTx = await arcUsdc.approve(poolVaultAddress, depositAmount);
        updateState('approving_arcusdc', 'Waiting for approval confirmation...', approveVaultTx.hash);
        await approveVaultTx.wait();
        console.log('arcUSDC approval for vault confirmed');

        // Step 14: Deposit arcUSDC into PoolVault
        updateState('depositing_vault', 'Deposit to PoolVault (MetaMask popup)...');
        console.log('Depositing to PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');

        let vaultDepositTx = await poolVault.deposit(depositAmount);
        updateState('depositing_vault', 'Waiting for vault deposit confirmation...', vaultDepositTx.hash);
        await vaultDepositTx.wait();

        // Complete!
        updateState('complete', `Successfully invested ${ethers.formatUnits(depositAmount, 6)} USDC!`, vaultDepositTx.hash);

        // Record the investment in our backend
        await fetch('/api/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: depositAmount.toString(),
            sourceChain: 'ethereum',
            destinationChain: 'base',
            userAddress,
            poolId,
            txHash: vaultDepositTx.hash,
            inputAmount: inputAmount.toString(), // Original input amount
            bridgeFee: BRIDGE_FEE.toString(), // Fee deducted
          }),
        });

      } else {
        // ===== BASE DIRECT DEPOSIT FLOW (no bridging) =====

        // Step 2: Switch to Base Sepolia
        updateState('switching_to_source', 'Switching to Base Sepolia...');
        await switchNetwork(BASE_SEPOLIA_CHAIN_ID);

        // Wait for network switch
        await new Promise(resolve => setTimeout(resolve, 1000));

        const baseProvider = new BrowserProvider(window.ethereum);
        const baseSigner = await baseProvider.getSigner();

        // Step 3: Check USDC balance on Base Sepolia
        updateState('checking_balance', 'Checking USDC balance on Base...');

        const baseUsdc = new Contract(USDC_BASE_SEPOLIA, ERC20_ABI, baseSigner);
        const baseUsdcBalance = await baseUsdc.balanceOf(userAddress);

        if (baseUsdcBalance < inputAmount) {
          throw new Error(`Insufficient USDC balance on Base. You have ${ethers.formatUnits(baseUsdcBalance, 6)} USDC`);
        }

        // Step 4: Check allowance and approve USDC for arcUSDC wrapping if needed
        updateState('wrapping_arcusdc', 'Checking USDC approval for arcUSDC...');
        console.log('Checking USDC allowance for arcUSDC wrapping:', ethers.formatUnits(inputAmount, 6), 'USDC');

        const currentUsdcAllowance = await baseUsdc.allowance(userAddress, arcUsdcAddress);
        console.log('Current USDC allowance for arcUSDC:', ethers.formatUnits(currentUsdcAllowance, 6));

        if (currentUsdcAllowance < inputAmount) {
          updateState('wrapping_arcusdc', 'Approve USDC for arcUSDC (MetaMask popup)...');
          console.log('Approving USDC for arcUSDC:', ethers.formatUnits(inputAmount, 6), 'USDC');

          // Approve max amount to avoid future approval issues
          const maxApproval = ethers.MaxUint256;
          let approveArcTx = await baseUsdc.approve(arcUsdcAddress, maxApproval);
          updateState('wrapping_arcusdc', 'Waiting for approval confirmation...', approveArcTx.hash);
          await approveArcTx.wait();
          console.log('USDC approval for arcUSDC confirmed');
        } else {
          console.log('Sufficient USDC allowance already exists');
        }

        // Step 5: Wrap USDC to arcUSDC
        updateState('wrapping_arcusdc', 'Wrapping USDC to arcUSDC (MetaMask popup)...');
        console.log('Wrapping to arcUSDC at:', arcUsdcAddress);

        let arcUsdc = new Contract(arcUsdcAddress, ARC_USDC_ABI, baseSigner);
        let wrapTx = await arcUsdc.deposit(inputAmount);
        updateState('wrapping_arcusdc', 'Waiting for wrap confirmation...', wrapTx.hash);
        await wrapTx.wait();
        console.log('arcUSDC wrap confirmed');

        // depositAmount = inputAmount (1:1 ratio, no bridge fees)
        let depositAmount = inputAmount;

        // Step 6: Check PoolVault state before depositing
        updateState('approving_arcusdc', 'Checking pool status...');
        let poolVault = new Contract(poolVaultAddress, POOL_VAULT_ABI, baseSigner);

        try {
          const vaultState = await poolVault.state();
          console.log('PoolVault state:', vaultState);
          // State 0 = Collecting, State 1 = Deployed, State 2 = Withdraw
          if (vaultState !== BigInt(0)) {
            throw new Error(`Pool is not accepting deposits. Current state: ${vaultState === BigInt(1) ? 'Deployed' : 'Withdraw'}`);
          }
        } catch (stateError: any) {
          console.warn('Could not check vault state:', stateError.message);
          // Continue anyway
        }

        // Step 7: Check allowance and approve arcUSDC for PoolVault if needed
        updateState('approving_arcusdc', 'Checking arcUSDC approval for PoolVault...');
        console.log('Checking arcUSDC allowance for PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');
        console.log('PoolVault address:', poolVaultAddress);

        const currentArcAllowance = await arcUsdc.allowance(userAddress, poolVaultAddress);
        console.log('Current arcUSDC allowance for PoolVault:', ethers.formatUnits(currentArcAllowance, 6));

        if (currentArcAllowance < depositAmount) {
          updateState('approving_arcusdc', 'Approve arcUSDC for PoolVault (MetaMask popup)...');
          console.log('Approving arcUSDC for PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');

          // Approve max amount to avoid future approval issues
          const maxApproval = ethers.MaxUint256;
          let approveVaultTx = await arcUsdc.approve(poolVaultAddress, maxApproval);
          updateState('approving_arcusdc', 'Waiting for approval confirmation...', approveVaultTx.hash);
          await approveVaultTx.wait();
          console.log('arcUSDC approval for vault confirmed');
        } else {
          console.log('Sufficient arcUSDC allowance already exists');
        }

        // Step 8: Deposit arcUSDC into PoolVault
        updateState('depositing_vault', 'Deposit to PoolVault (MetaMask popup)...');
        console.log('Depositing to PoolVault:', ethers.formatUnits(depositAmount, 6), 'arcUSDC');

        let vaultDepositTx = await poolVault.deposit(depositAmount);
        updateState('depositing_vault', 'Waiting for vault deposit confirmation...', vaultDepositTx.hash);
        await vaultDepositTx.wait();

        // Complete!
        updateState('complete', `Successfully invested ${ethers.formatUnits(depositAmount, 6)} USDC!`, vaultDepositTx.hash);

        // Record the investment in our backend
        await fetch('/api/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: depositAmount.toString(),
            sourceChain: 'base',
            destinationChain: 'base',
            userAddress,
            poolId,
            txHash: vaultDepositTx.hash,
            inputAmount: inputAmount.toString(), // Original input amount
            bridgeFee: '0', // No bridge fee for direct deposit
          }),
        });
      }
>>>>>>> Stashed changes

    } catch (error: any) {
      console.error('Investment error:', error);

      if (error.code === 4001) {
        setError('Transaction cancelled by user');
      } else if (error.code === 'ACTION_REJECTED') {
        setError('Transaction rejected by user');
      } else {
        setError(error.message || 'Investment failed');
      }
    }
  };

  return {
    state,
    invest,
    reset,
  };
};
