import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * POST /api/agent/permissions
 * Grant or update agent permissions
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, permissions } = body;

        if (!address) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Update user permissions
        const user = await User.findOneAndUpdate(
            { address: address.toLowerCase() },
            {
                $set: {
                    agentPermissions: permissions,
                    agentPermissionsUpdatedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({
            success: true,
            permissions: user.agentPermissions,
        });
    } catch (error) {
        console.error('Error updating permissions:', error);
        return NextResponse.json(
            { error: 'Failed to update permissions' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/agent/permissions?address=0x...
 * Get user's agent permissions
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const user = await User.findOne({ address: address.toLowerCase() });

        if (!user || !user.agentPermissions) {
            return NextResponse.json({
                hasPermissions: false,
                permissions: [],
            });
        }

        return NextResponse.json({
            hasPermissions: true,
            permissions: user.agentPermissions,
            updatedAt: user.agentPermissionsUpdatedAt,
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch permissions' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agent/permissions
 * Revoke all agent permissions
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json(
                { error: 'Wallet address required' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        await User.findOneAndUpdate(
            { address: address.toLowerCase() },
            {
                $set: {
                    agentPermissions: [],
                    agentPermissionsUpdatedAt: new Date(),
                },
            }
        );

        return NextResponse.json({
            success: true,
            message: 'All permissions revoked',
        });
    } catch (error) {
        console.error('Error revoking permissions:', error);
        return NextResponse.json(
            { error: 'Failed to revoke permissions' },
            { status: 500 }
        );
    }
}
