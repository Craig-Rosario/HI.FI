import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS, PermissionType } from '@/lib/contracts';

export interface Permission {
    enabled: boolean;
    agent: string;
    expiresAt: bigint;
    maxAmount: bigint;
    maxUses: bigint;
    usedCount: bigint;
}

export function useAgentPermissions(account?: string) {
    const [permissions, setPermissions] = useState<Map<number, Permission>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if contract is deployed
    const isContractDeployed = CONTRACT_ADDRESSES.agentPermissionManager !== "0x0000000000000000000000000000000000000000";

    const getContract = useCallback((signer?: ethers.Signer) => {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        return new ethers.Contract(
            CONTRACT_ADDRESSES.agentPermissionManager,
            ABIS.agentPermissionManager,
            signer || provider
        );
    }, []);

    // Fetch user's permissions
    const fetchPermissions = useCallback(async () => {
        if (!account || !isContractDeployed) {
            if (!isContractDeployed) {
                setError('Contract not deployed. Please deploy contracts first.');
            }
            return;
        }

        try {
            const contract = getContract();
            const permissionsMap = new Map<number, Permission>();

            // Fetch each permission type for high-risk pool
            for (const permType of Object.values(PermissionType).filter(v => typeof v === 'number')) {
                const perm = await contract.getPermission(
                    account,
                    CONTRACT_ADDRESSES.poolVaultHighRisk,
                    permType as number
                );

                if (perm.enabled) {
                    permissionsMap.set(permType as number, {
                        enabled: perm.enabled,
                        agent: perm.agent,
                        expiresAt: perm.expiresAt,
                        maxAmount: perm.maxAmount,
                        maxUses: perm.maxUses,
                        usedCount: perm.usedCount,
                    });
                }
            }

            setPermissions(permissionsMap);
        } catch (err: any) {
            console.error('Error fetching permissions:', err);
            setError(err.message);
        }
    }, [account, getContract, isContractDeployed]);

    // Grant permission
    const grantPermission = useCallback(async (
        permissionType: PermissionType,
        agentAddress: string,
        durationDays: number,
        maxAmount: bigint,
        maxUses: number = 0
    ) => {
        if (!account) throw new Error('No account connected');

        setLoading(true);
        setError(null);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const contract = getContract(signer);

            const expiresAt = Math.floor(Date.now() / 1000) + (durationDays * 24 * 60 * 60);

            const tx = await contract.grantPermission(
                permissionType,
                CONTRACT_ADDRESSES.poolVaultHighRisk,
                agentAddress,
                expiresAt,
                maxAmount,
                maxUses
            );
            await tx.wait();

            await fetchPermissions();
            return tx.hash;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [account, getContract, fetchPermissions]);

    // Revoke specific permission
    const revokePermission = useCallback(async (permissionType: PermissionType) => {
        if (!account) throw new Error('No account connected');

        setLoading(true);
        setError(null);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const contract = getContract(signer);

            const tx = await contract.revokePermission(
                permissionType,
                CONTRACT_ADDRESSES.poolVaultHighRisk
            );
            await tx.wait();

            await fetchPermissions();
            return tx.hash;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [account, getContract, fetchPermissions]);

    // Revoke all permissions
    const revokeAllPermissions = useCallback(async () => {
        if (!account) throw new Error('No account connected');

        setLoading(true);
        setError(null);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const contract = getContract(signer);

            const tx = await contract.revokeAllPermissions();
            await tx.wait();

            await fetchPermissions();
            return tx.hash;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [account, getContract, fetchPermissions]);

    useEffect(() => {
        if (account) {
            fetchPermissions();
        }
    }, [account, fetchPermissions]);

    return {
        permissions,
        loading,
        error,
        grantPermission,
        revokePermission,
        revokeAllPermissions,
        refresh: fetchPermissions,
    };
}
