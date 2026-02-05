'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useMetaMask } from '@/hooks/use-metamask';
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminPage() {
    const { account } = useMetaMask();
    const [loading, setLoading] = useState(false);

    // Treasury Funder
    const [treasuryAmount, setTreasuryAmount] = useState('');
    const [treasuryBalance, setTreasuryBalance] = useState('0');
    const [totalFunded, setTotalFunded] = useState('0');

    // Yield Controller
    const [poolAddress, setPoolAddress] = useState(CONTRACT_ADDRESSES.poolVaultHighRisk);
    const [yieldPreview, setYieldPreview] = useState<any>(null);

    const getTreasuryContract = useCallback(async () => {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const signer = await provider.getSigner();
        return new ethers.Contract(CONTRACT_ADDRESSES.treasuryFunder, ABIS.treasuryFunder, signer);
    }, []);

    const getYieldControllerContract = useCallback(async () => {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const signer = await provider.getSigner();
        return new ethers.Contract(CONTRACT_ADDRESSES.demoYieldController, ABIS.demoYieldController, signer);
    }, []);

    const fetchTreasuryData = async () => {
        try {
            const contract = await getTreasuryContract();
            const [balance, funded] = await Promise.all([
                contract.totalTreasury(),
                contract.totalFunded(),
            ]);
            setTreasuryBalance(ethers.formatUnits(balance, 6));
            setTotalFunded(ethers.formatUnits(funded, 6));
        } catch (err: any) {
            alert(`Failed to fetch treasury data: ${err.message}`);
        }
    };

    const handleDepositTreasury = async () => {
        if (!treasuryAmount || parseFloat(treasuryAmount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        setLoading(true);
        try {
            const amount = ethers.parseUnits(treasuryAmount, 6);

            // Approve USDC
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.usdc, ABIS.erc20, signer);

            const approveTx = await usdcContract.approve(CONTRACT_ADDRESSES.treasuryFunder, amount);
            await approveTx.wait();

            // Deposit
            const treasuryContract = await getTreasuryContract();
            const depositTx = await treasuryContract.depositTreasury(amount);
            await depositTx.wait();

            alert('Treasury deposit successful!');
            setTreasuryAmount('');
            await fetchTreasuryData();
        } catch (err: any) {
            alert(`Deposit failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewYield = async () => {
        if (!poolAddress) {
            alert('Please enter pool address');
            return;
        }

        setLoading(true);
        try {
            const contract = await getYieldControllerContract();
            const principal = ethers.parseUnits('100', 6);
            const result = await contract.previewYield(poolAddress, principal);

            setYieldPreview({
                expectedYield: ethers.formatUnits(result.expectedYield, 6),
                confidence: result.confidence.toString(),
            });
        } catch (err: any) {
            alert(`Preview failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!account) {
        return (
            <div className="p-6 md:p-8">
                <div className="text-center py-12">
                    <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
                    <p className="text-gray-600">Please connect your wallet to access admin functions</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold mb-2">⚙️ Admin Panel</h1>
                <p className="text-foreground/70">
                    Manage treasury funding and yield controller configuration
                </p>
            </div>

            {/* Treasury Funder Management */}
            <div className="bg-card border border-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Treasury Funder</h2>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-1">Treasury Balance</p>
                        <p className="text-2xl font-bold">{treasuryBalance} USDC</p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-1">Total Funded</p>
                        <p className="text-2xl font-bold">{totalFunded} USDC</p>
                    </div>
                    <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-1">Contract</p>
                        <p className="text-xs font-mono">
                            {CONTRACT_ADDRESSES.treasuryFunder.slice(0, 6)}...{CONTRACT_ADDRESSES.treasuryFunder.slice(-4)}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 mb-4">
                    <Button onClick={fetchTreasuryData} variant="outline" disabled={loading}>
                        Refresh Data
                    </Button>
                </div>

                <div className="border-t border-gray-800 pt-6">
                    <h3 className="font-semibold mb-4">Deposit to Treasury</h3>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            placeholder="Amount (USDC)"
                            value={treasuryAmount}
                            onChange={(e) => setTreasuryAmount(e.target.value)}
                            disabled={loading}
                            step="0.01"
                            min="0"
                        />
                        <Button onClick={handleDepositTreasury} disabled={loading}>
                            {loading ? 'Processing...' : 'Deposit'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Yield Controller */}
            <div className="bg-card border border-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Demo Yield Controller</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Pool Address</label>
                        <Input
                            type="text"
                            value={poolAddress}
                            onChange={(e) => setPoolAddress(e.target.value)}
                            disabled={loading}
                            placeholder="0x..."
                        />
                    </div>

                    <Button onClick={handlePreviewYield} disabled={loading}>
                        Preview Yield (100 USDC)
                    </Button>

                    {yieldPreview && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                            <h4 className="font-semibold mb-2">Yield Preview Results</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>Expected Yield:</span>
                                    <span className="font-bold">{yieldPreview.expectedYield} USDC</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Confidence:</span>
                                    <span className="font-bold">{yieldPreview.confidence}%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Contract Addresses */}
            <div className="bg-card border border-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Contract Addresses</h2>
                <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Treasury Funder:</span>
                        <span>{CONTRACT_ADDRESSES.treasuryFunder}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Yield Controller:</span>
                        <span>{CONTRACT_ADDRESSES.demoYieldController}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">High Risk Pool:</span>
                        <span>{CONTRACT_ADDRESSES.poolVaultHighRisk}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Agent Manager:</span>
                        <span>{CONTRACT_ADDRESSES.agentPermissionManager}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">USDC:</span>
                        <span>{CONTRACT_ADDRESSES.usdc}</span>
                    </div>
                </div>
            </div>

            {/* Warning */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <h3 className="font-semibold text-orange-400 mb-2">⚠️ Admin Access Required</h3>
                <p className="text-sm text-foreground/70">
                    These functions require contract owner privileges. Ensure you are connected with the deployer wallet.
                </p>
            </div>
        </div>
    );
}
