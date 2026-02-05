'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useHighRiskPool } from '@/hooks/use-high-risk-pool';
import { useMetaMask } from '@/hooks/use-metamask';
import { PoolState, RISK_LEVELS } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function HighRiskPoolCard() {
    const { account } = useMetaMask();
    const {
        userShares,
        poolInfo,
        riskMetrics,
        loading,
        error,
        deposit,
        withdraw,
        forceUpdatePnL,
    } = useHighRiskPool(account || undefined);

    const [depositAmount, setDepositAmount] = useState('');
    const [withdrawShares, setWithdrawShares] = useState('');
    const [txLoading, setTxLoading] = useState(false);

    const handleDeposit = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return;

        setTxLoading(true);
        try {
            const amount = ethers.parseUnits(depositAmount, 6);
            await deposit(amount);
            setDepositAmount('');
            alert('Deposit successful!');
        } catch (err: any) {
            alert(`Deposit failed: ${err.message}`);
        } finally {
            setTxLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!withdrawShares || parseFloat(withdrawShares) <= 0) return;

        setTxLoading(true);
        try {
            const shares = ethers.parseUnits(withdrawShares, 6);
            await withdraw(shares);
            setWithdrawShares('');
            alert('Withdrawal initiated!');
        } catch (err: any) {
            alert(`Withdrawal failed: ${err.message}`);
        } finally {
            setTxLoading(false);
        }
    };

    const handleForceUpdate = async () => {
        setTxLoading(true);
        try {
            await forceUpdatePnL();
            alert('PnL updated!');
        } catch (err: any) {
            alert(`Update failed: ${err.message}`);
        } finally {
            setTxLoading(false);
        }
    };

    const getStateLabel = (state: PoolState) => {
        switch (state) {
            case PoolState.COLLECTING:
                return 'Collecting';
            case PoolState.DEPLOYED:
                return 'Deployed';
            case PoolState.WITHDRAW_WINDOW:
                return 'Withdraw Window';
            case PoolState.CLOSED:
                return 'Closed';
            default:
                return 'Unknown';
        }
    };

    const getPnLColor = (pnl: bigint) => {
        const pnlValue = Number(ethers.formatUnits(pnl, 6));
        if (pnlValue > 0) return 'text-green-500';
        if (pnlValue < 0) return 'text-red-500';
        return 'text-gray-500';
    };

    if (error?.includes('not deployed')) {
        return (
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg shadow-lg p-6 border-2 border-red-300">
                <h3 className="text-2xl font-bold text-red-700 mb-4">High Risk Pool</h3>
                <div className="bg-yellow-100 border border-yellow-400 p-4 rounded-lg">
                    <p className="text-yellow-800 font-semibold mb-2">⚠️ Contracts Not Deployed</p>
                    <p className="text-sm text-yellow-700 mb-3">
                        The High Risk Pool contracts haven't been deployed yet. Please deploy them first.
                    </p>
                    <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                        cd contracts<br />
                        npx hardhat run scripts/deploy-agent-system.js --network baseSepolia
                    </div>
                </div>
            </div>
        );
    }

    if (!poolInfo) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        );
    }

    const fillPercentage = Number((poolInfo.totalDeposited * BigInt(100)) / poolInfo.cap);
    const pnlValue = riskMetrics ? Number(ethers.formatUnits(riskMetrics.currentPnL, 6)) : 0;

    return (
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg shadow-lg p-6 border-2 border-red-300">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-2xl font-bold text-red-700">High Risk Pool</h3>
                    <p className="text-sm text-gray-600">{RISK_LEVELS.HIGH.apy} APY (Variable)</p>
                </div>
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    HIGH RISK
                </div>
            </div>

            {/* Pool Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/70 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Pool State</p>
                    <p className="text-lg font-bold text-gray-800">
                        {getStateLabel(poolInfo.state)}
                    </p>
                </div>
                <div className="bg-white/70 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Fill Status</p>
                    <p className="text-lg font-bold text-gray-800">{fillPercentage}%</p>
                </div>
                <div className="bg-white/70 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Your Shares</p>
                    <p className="text-lg font-bold text-gray-800">
                        {ethers.formatUnits(userShares, 6)} USDC
                    </p>
                </div>
                <div className="bg-white/70 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Current P&L</p>
                    <p className={`text-lg font-bold ${getPnLColor(riskMetrics?.currentPnL || BigInt(0))}`}>
                        {pnlValue > 0 ? '+' : ''}{pnlValue.toFixed(2)} USDC
                    </p>
                </div>
            </div>

            {/* Risk Indicators */}
            {riskMetrics && (
                <div className="bg-white/70 p-4 rounded-lg mb-6">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Risk Metrics</p>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Volatility Index:</span>
                            <span className="font-semibold">{riskMetrics.volatilityIndex.toString()}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">At Risk:</span>
                            <span className={`font-semibold ${riskMetrics.atRisk ? 'text-red-600' : 'text-green-600'}`}>
                                {riskMetrics.atRisk ? 'Yes ⚠️' : 'No ✓'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Liquidation Threshold:</span>
                            <span className="font-semibold text-red-600">
                                {ethers.formatUnits(riskMetrics.liquidationThreshold, 6)} USDC
                            </span>
                        </div>
                    </div>
                    <Button
                        onClick={handleForceUpdate}
                        disabled={txLoading}
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                    >
                        Update P&L
                    </Button>
                </div>
            )}

            {/* Withdraw Window Timer */}
            {poolInfo.state === PoolState.DEPLOYED && !poolInfo.isWithdrawOpen && (
                <div className="bg-yellow-100 border border-yellow-300 p-3 rounded-lg mb-4">
                    <p className="text-sm font-semibold text-yellow-800">
                        Withdraw window opens in: {poolInfo.timeUntilWithdraw.toString()}s
                    </p>
                </div>
            )}

            {/* Actions */}
            {account ? (
                <div className="space-y-4">
                    {/* Deposit */}
                    {poolInfo.state === PoolState.COLLECTING && (
                        <div className="bg-white/70 p-4 rounded-lg">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Deposit USDC
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    disabled={txLoading}
                                    step="0.01"
                                    min="0"
                                />
                                <Button onClick={handleDeposit} disabled={txLoading || loading}>
                                    {txLoading ? 'Depositing...' : 'Deposit'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Withdraw */}
                    {poolInfo.isWithdrawOpen && userShares > 0 && (
                        <div className="bg-white/70 p-4 rounded-lg">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Withdraw Shares
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Shares"
                                    value={withdrawShares}
                                    onChange={(e) => setWithdrawShares(e.target.value)}
                                    disabled={txLoading}
                                    step="0.01"
                                    min="0"
                                />
                                <Button
                                    onClick={handleWithdraw}
                                    disabled={txLoading || loading}
                                    variant="destructive"
                                >
                                    {txLoading ? 'Withdrawing...' : 'Withdraw'}
                                </Button>
                            </div>
                            <Button
                                onClick={() => setWithdrawShares(ethers.formatUnits(userShares, 6))}
                                variant="link"
                                size="sm"
                                className="mt-1"
                            >
                                Withdraw All
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-gray-100 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Connect wallet to interact</p>
                </div>
            )}

            {error && (
                <div className="mt-4 bg-red-100 border border-red-300 p-3 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Warning */}
            <div className="mt-6 bg-red-100 border-l-4 border-red-500 p-3 rounded">
                <p className="text-xs font-semibold text-red-700 mb-1">⚠️ HIGH RISK WARNING</p>
                <p className="text-xs text-red-600">
                    This pool uses simulated high volatility yields. You can lose up to 50% of your principal.
                    Demo/testnet only - not for production use.
                </p>
            </div>
        </div>
    );
}
