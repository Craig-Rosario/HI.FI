'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useAgentPermissions } from '@/hooks/use-agent-permissions';
import { useMetaMask } from '@/hooks/use-metamask';
import { PermissionType } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AgentPermissionsManager() {
    const { account } = useMetaMask();
    const {
        permissions,
        loading,
        error,
        grantPermission: grant,
        revokePermission,
        revokeAllPermissions,
    } = useAgentPermissions(account ?? undefined);

    const [showGrantForm, setShowGrantForm] = useState(false);
    const [grantForm, setGrantForm] = useState({
        permissionType: PermissionType.WITHDRAW,
        agentAddress: '',
        durationDays: '7',
        maxAmount: '',
        maxUses: '0',
    });
    const [txLoading, setTxLoading] = useState(false);

    const handleGrantPermission = async () => {
        if (!grantForm.agentAddress || !grantForm.maxAmount) {
            alert('Please fill all required fields');
            return;
        }

        setTxLoading(true);
        try {
            const maxAmount = ethers.parseUnits(grantForm.maxAmount, 6);
            await grant(
                grantForm.permissionType,
                grantForm.agentAddress,
                parseInt(grantForm.durationDays),
                maxAmount,
                parseInt(grantForm.maxUses)
            );
            setShowGrantForm(false);
            setGrantForm({
                permissionType: PermissionType.WITHDRAW,
                agentAddress: '',
                durationDays: '7',
                maxAmount: '',
                maxUses: '0',
            });
            alert('Permission granted successfully!');
        } catch (err: any) {
            alert(`Failed to grant permission: ${err.message}`);
        } finally {
            setTxLoading(false);
        }
    };

    const handleRevokePermission = async (permType: PermissionType) => {
        if (!confirm('Are you sure you want to revoke this permission?')) return;

        setTxLoading(true);
        try {
            await revokePermission(permType);
            alert('Permission revoked successfully!');
        } catch (err: any) {
            alert(`Failed to revoke permission: ${err.message}`);
        } finally {
            setTxLoading(false);
        }
    };

    const handleRevokeAll = async () => {
        if (!confirm('Are you sure you want to revoke ALL permissions?')) return;

        setTxLoading(true);
        try {
            await revokeAllPermissions();
            alert('All permissions revoked successfully!');
        } catch (err: any) {
            alert(`Failed to revoke permissions: ${err.message}`);
        } finally {
            setTxLoading(false);
        }
    };

    const getPermissionTypeName = (type: number) => {
        const names = ['Withdraw', 'Stop Loss', 'Take Profit', 'Rebalance', 'Compound'];
        return names[type] || 'Unknown';
    };

    const formatDate = (timestamp: bigint) => {
        return new Date(Number(timestamp) * 1000).toLocaleString();
    };

    if (error?.includes('not deployed')) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-2xl font-bold mb-4">Agent Permissions</h3>
                <div className="bg-yellow-100 border border-yellow-400 p-4 rounded-lg">
                    <p className="text-yellow-800 font-semibold mb-2">⚠️ Contracts Not Deployed</p>
                    <p className="text-sm text-yellow-700">
                        Please deploy the contracts first to manage agent permissions.
                    </p>
                </div>
            </div>
        );
    }

    if (!account) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">Agent Permissions</h3>
                <p className="text-gray-600">Connect wallet to manage agent permissions</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-2xl font-bold">Agent Permissions</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Delegate actions to AI agents for automated management
                    </p>
                </div>
                {!showGrantForm && (
                    <Button onClick={() => setShowGrantForm(true)} disabled={txLoading}>
                        Grant New Permission
                    </Button>
                )}
            </div>

            {/* Grant Permission Form */}
            {showGrantForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h4 className="font-semibold text-lg mb-4">Grant Agent Permission</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Permission Type
                            </label>
                            <select
                                value={grantForm.permissionType}
                                onChange={(e) =>
                                    setGrantForm({ ...grantForm, permissionType: parseInt(e.target.value) })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                disabled={txLoading}
                            >
                                <option value={PermissionType.WITHDRAW}>Withdraw</option>
                                <option value={PermissionType.STOP_LOSS}>Stop Loss</option>
                                <option value={PermissionType.TAKE_PROFIT}>Take Profit</option>
                                <option value={PermissionType.REBALANCE}>Rebalance</option>
                                <option value={PermissionType.COMPOUND}>Compound</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Agent Address *
                            </label>
                            <Input
                                type="text"
                                placeholder="0x..."
                                value={grantForm.agentAddress}
                                onChange={(e) => setGrantForm({ ...grantForm, agentAddress: e.target.value })}
                                disabled={txLoading}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Duration (days) *
                                </label>
                                <Input
                                    type="number"
                                    value={grantForm.durationDays}
                                    onChange={(e) => setGrantForm({ ...grantForm, durationDays: e.target.value })}
                                    disabled={txLoading}
                                    min="1"
                                    max="30"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Amount (USDC) *
                                </label>
                                <Input
                                    type="number"
                                    placeholder="100"
                                    value={grantForm.maxAmount}
                                    onChange={(e) => setGrantForm({ ...grantForm, maxAmount: e.target.value })}
                                    disabled={txLoading}
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Uses (0=unlimited)
                                </label>
                                <Input
                                    type="number"
                                    value={grantForm.maxUses}
                                    onChange={(e) => setGrantForm({ ...grantForm, maxUses: e.target.value })}
                                    disabled={txLoading}
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button onClick={handleGrantPermission} disabled={txLoading}>
                                {txLoading ? 'Granting...' : 'Grant Permission'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowGrantForm(false)}
                                disabled={txLoading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Permissions */}
            <div>
                <h4 className="font-semibold text-lg mb-3">Active Permissions</h4>
                {permissions.size === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No active agent permissions</p>
                        <p className="text-sm mt-1">Grant permissions to enable automated management</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {Array.from(permissions.entries()).map(([type, perm]) => (
                            <div
                                key={type}
                                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h5 className="font-semibold text-gray-800">
                                            {getPermissionTypeName(type)}
                                        </h5>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Agent: {perm.agent.slice(0, 6)}...{perm.agent.slice(-4)}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleRevokePermission(type)}
                                        disabled={txLoading}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                                    <div>
                                        <span className="text-gray-600">Expires:</span>
                                        <p className="font-medium">{formatDate(perm.expiresAt)}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Max Amount:</span>
                                        <p className="font-medium">
                                            {ethers.formatUnits(perm.maxAmount, 6)} USDC
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Uses:</span>
                                        <p className="font-medium">
                                            {perm.usedCount.toString()}{' '}
                                            {perm.maxUses > 0 ? `/ ${perm.maxUses.toString()}` : '(unlimited)'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Status:</span>
                                        <p className="font-medium text-green-600">Active ✓</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {permissions.size > 0 && (
                    <Button
                        variant="outline"
                        onClick={handleRevokeAll}
                        disabled={txLoading}
                        className="mt-4 w-full"
                    >
                        Revoke All Permissions
                    </Button>
                )}
            </div>

            {error && (
                <div className="mt-4 bg-red-100 border border-red-300 p-3 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-semibold text-blue-900 mb-2">💡 About Agent Permissions</h5>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Reduce signatures from 8 to 1 by delegating to agents</li>
                    <li>• Set time limits, amount limits, and usage limits</li>
                    <li>• Revoke permissions instantly at any time</li>
                    <li>• Agents can only execute within granted permissions</li>
                    <li>• You always maintain full control of your funds</li>
                </ul>
            </div>
        </div>
    );
}
