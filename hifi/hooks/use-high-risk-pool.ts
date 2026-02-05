import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS, PoolState } from '@/lib/contracts';

export interface RiskMetrics {
    currentPnL: bigint;
    volatilityIndex: bigint;
    atRisk: boolean;
    liquidationThreshold: bigint;
}

export interface PoolInfo {
    state: PoolState;
    cap: bigint;
    totalDeposited: bigint;
    deployedAt: bigint;
    isWithdrawOpen: boolean;
    timeUntilWithdraw: bigint;
}

export function useHighRiskPool(account?: string) {
    const [userShares, setUserShares] = useState<bigint>(BigInt(0));
    const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
    const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if contract is deployed
    const isContractDeployed = CONTRACT_ADDRESSES.poolVaultHighRisk !== "0x0000000000000000000000000000000000000000";

    const getContract = useCallback((signer?: ethers.Signer) => {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const contractWithProvider = new ethers.Contract(
            CONTRACT_ADDRESSES.poolVaultHighRisk,
            ABIS.poolVaultHighRisk,
            signer || provider
        );
        return contractWithProvider;
    }, []);

    // Fetch pool info
    const fetchPoolInfo = useCallback(async () => {
        if (!isContractDeployed) {
            setError('Contract not deployed. Please deploy contracts first.');
            return;
        }
        try {
            const contract = getContract();
            const [state, cap, totalDeposited, deployedAt, isWithdrawOpen, timeUntilWithdraw] = await Promise.all([
                contract.state(),
                contract.cap(),
                contract.totalDeposited(),
                contract.deployedAt(),
                contract.isWithdrawOpen(),
                contract.timeUntilWithdraw(),
            ]);

            setPoolInfo({
                state: Number(state),
                cap,
                totalDeposited,
                deployedAt,
                isWithdrawOpen,
                timeUntilWithdraw,
            });
        } catch (err: any) {
            console.error('Error fetching pool info:', err);
            setError(err.message);
        }
    }, [getContract, isContractDeployed]);

    // Fetch risk metrics
    const fetchRiskMetrics = useCallback(async () => {
        if (!isContractDeployed) return;
        try {
            const contract = getContract();
            const metrics = await contract.getRiskMetrics();
            setRiskMetrics({
                currentPnL: metrics.currentPnL,
                volatilityIndex: metrics.volatilityIndex,
                atRisk: metrics.atRisk,
                liquidationThreshold: metrics.liquidationThreshold,
            });
        } catch (err: any) {
            console.error('Error fetching risk metrics:', err);
        }
    }, [getContract, isContractDeployed]);

    // Fetch user shares
    const fetchUserShares = useCallback(async () => {
        if (!account || !isContractDeployed) return;
        try {
            const contract = getContract();
            const shares = await contract.balanceOf(account);
            setUserShares(shares);
        } catch (err: any) {
            console.error('Error fetching user shares:', err);
        }
    }, [account, getContract, isContractDeployed]);

    // Deposit to pool
    const deposit = useCallback(async (amount: bigint) => {
        if (!account) throw new Error('No account connected');

        setLoading(true);
        setError(null);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();

            // Approve USDC first
            const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.usdc, ABIS.erc20, signer);
            const allowance = await usdcContract.allowance(account, CONTRACT_ADDRESSES.poolVaultHighRisk);

            if (allowance < amount) {
                const approveTx = await usdcContract.approve(CONTRACT_ADDRESSES.poolVaultHighRisk, amount);
                await approveTx.wait();
            }

            // Deposit
            const poolContract = getContract(signer);
            const tx = await poolContract.deposit(amount);
            await tx.wait();

            // Refresh data
            await Promise.all([fetchUserShares(), fetchPoolInfo()]);
            return tx.hash;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [account, getContract, fetchUserShares, fetchPoolInfo]);

    // Withdraw from pool
    const withdraw = useCallback(async (shares: bigint) => {
        if (!account) throw new Error('No account connected');

        setLoading(true);
        setError(null);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const poolContract = getContract(signer);

            const tx = await poolContract.withdraw(shares);
            await tx.wait();

            // Refresh data
            await Promise.all([fetchUserShares(), fetchPoolInfo()]);
            return tx.hash;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [account, getContract, fetchUserShares, fetchPoolInfo]);

    // Force PnL update (anyone can call)
    const forceUpdatePnL = useCallback(async () => {
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const poolContract = getContract(signer);

            const tx = await poolContract.forceUpdatePnL();
            await tx.wait();

            await fetchRiskMetrics();
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getContract, fetchRiskMetrics]);

    // Initial load
    useEffect(() => {
        fetchPoolInfo();
        fetchRiskMetrics();
    }, [fetchPoolInfo, fetchRiskMetrics]);

    useEffect(() => {
        if (account) {
            fetchUserShares();
        }
    }, [account, fetchUserShares]);

    return {
        userShares,
        poolInfo,
        riskMetrics,
        loading,
        error,
        deposit,
        withdraw,
        forceUpdatePnL,
        refresh: () => Promise.all([fetchPoolInfo(), fetchRiskMetrics(), fetchUserShares()]),
    };
}
