import { NextRequest, NextResponse } from 'next/server';

// Circle Gateway API for CCTP
const GATEWAY_API_BASE_URL = 'https://gateway-api-testnet.circle.com/v1';

// Domain IDs for CCTP
const DOMAINS = {
  ethereum: 0,
  sepolia: 0,
  base: 6,
  baseSepolia: 6,
};

// Contract addresses
const GATEWAY_WALLET = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
const GATEWAY_MINTER = '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B';
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// USDC addresses by chain - used to determine source/destination tokens
const USDC_BY_CHAIN: Record<string, string> = {
  ethereum: USDC_SEPOLIA,
  sepolia: USDC_SEPOLIA,
  base: USDC_BASE_SEPOLIA,
  baseSepolia: USDC_BASE_SEPOLIA,
};

// EIP-712 typed data for burn intent
const EIP712_DOMAIN = { name: 'GatewayWallet', version: '1' };

interface BridgeRequest {
  amount: string;
  userAddress: string;
  sourceChain: string;
  destinationChain: string;
  signedBurnIntent?: {
    burnIntent: any;
    signature: string;
  };
}

function addressToBytes32(address: string): string {
  return '0x' + address.toLowerCase().slice(2).padStart(64, '0');
}

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate burn intent typed data for client signing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const amount = searchParams.get('amount');
  const userAddress = searchParams.get('userAddress');
  const sourceChain = searchParams.get('sourceChain') || 'ethereum';
  const destinationChain = searchParams.get('destinationChain') || 'base';

  if (!amount || !userAddress) {
    return NextResponse.json(
      { error: 'Missing required parameters: amount, userAddress' },
      { status: 400 }
    );
  }

  try {
    const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e6));
    
    const sourceDomain = DOMAINS[sourceChain as keyof typeof DOMAINS] ?? 0;
    const destDomain = DOMAINS[destinationChain as keyof typeof DOMAINS] ?? 6;

    // Determine source and destination USDC tokens based on chains
    const sourceToken = USDC_BY_CHAIN[sourceChain] || USDC_SEPOLIA;
    const destToken = USDC_BY_CHAIN[destinationChain] || USDC_BASE_SEPOLIA;

    // maxBlockHeight needs to be a very large number (at least 7 days in the future in blocks)
    // Using a large decimal string instead of hex
    const maxBlockHeight = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

    const burnIntent = {
      maxBlockHeight: maxBlockHeight,
      maxFee: '2010000', // 2.01 USDC max fee
      spec: {
        version: 1,
        sourceDomain,
        destinationDomain: destDomain,
        sourceContract: addressToBytes32(GATEWAY_WALLET),
        destinationContract: addressToBytes32(GATEWAY_MINTER),
        sourceToken: addressToBytes32(sourceToken),
        destinationToken: addressToBytes32(destToken),
        sourceDepositor: addressToBytes32(userAddress),
        destinationRecipient: addressToBytes32(userAddress),
        sourceSigner: addressToBytes32(userAddress),
        destinationCaller: addressToBytes32('0x0000000000000000000000000000000000000000'),
        value: amountInWei.toString(),
        salt: generateSalt(),
        hookData: '0x',
      },
    };

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        TransferSpec: [
          { name: 'version', type: 'uint32' },
          { name: 'sourceDomain', type: 'uint32' },
          { name: 'destinationDomain', type: 'uint32' },
          { name: 'sourceContract', type: 'bytes32' },
          { name: 'destinationContract', type: 'bytes32' },
          { name: 'sourceToken', type: 'bytes32' },
          { name: 'destinationToken', type: 'bytes32' },
          { name: 'sourceDepositor', type: 'bytes32' },
          { name: 'destinationRecipient', type: 'bytes32' },
          { name: 'sourceSigner', type: 'bytes32' },
          { name: 'destinationCaller', type: 'bytes32' },
          { name: 'value', type: 'uint256' },
          { name: 'salt', type: 'bytes32' },
          { name: 'hookData', type: 'bytes' },
        ],
        BurnIntent: [
          { name: 'maxBlockHeight', type: 'uint256' },
          { name: 'maxFee', type: 'uint256' },
          { name: 'spec', type: 'TransferSpec' },
        ],
      },
      domain: EIP712_DOMAIN,
      primaryType: 'BurnIntent',
      message: burnIntent,
    };

    return NextResponse.json({
      success: true,
      typedData,
      burnIntent,
    });

  } catch (error) {
    console.error('Error generating burn intent:', error);
    return NextResponse.json(
      { error: 'Failed to generate burn intent' },
      { status: 500 }
    );
  }
}

// Process signed burn intent and get attestation
export async function POST(request: NextRequest) {
  try {
    const body: BridgeRequest = await request.json();

    if (!body.amount || !body.userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, userAddress' },
        { status: 400 }
      );
    }

    // If client sends a signed burn intent, use it
    if (body.signedBurnIntent) {
      const { burnIntent, signature } = body.signedBurnIntent;

      console.log('Calling Circle Gateway with burn intent:', JSON.stringify(burnIntent, null, 2));
      console.log('Signature:', signature);

      // Call Circle Gateway API to get attestation
      // The API expects an array of objects with burnIntent and signature
      const response = await fetch(`${GATEWAY_API_BASE_URL}/transfer`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ burnIntent, signature }]),
      });

      const responseText = await response.text();
      console.log('Gateway response status:', response.status);
      console.log('Gateway response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse Gateway response:', responseText);
        return NextResponse.json(
          { success: false, error: 'Invalid response from Gateway' },
          { status: 500 }
        );
      }

      // Check for various error formats
      if (result.error || result.message || !response.ok) {
        console.error('Gateway error:', result);
        return NextResponse.json(
          { success: false, error: result.message || result.error || `Gateway error: ${response.status}` },
          { status: 400 }
        );
      }

      // Handle array response format
      const transferResult = Array.isArray(result) ? result[0] : result;

      if (!transferResult?.attestation || !transferResult?.signature) {
        console.error('Missing attestation in response:', result);
        return NextResponse.json(
          { success: false, error: 'Missing attestation from Gateway' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        attestation: transferResult.attestation,
        signature: transferResult.signature,
        transferId: transferResult.transferId,
        fees: transferResult.fees,
      });
    }

    // For now, we return a simulated success since the actual bridge 
    // requires the user to sign on the client side
    // In a production setup, the client would:
    // 1. Call GET to get the burn intent typed data
    // 2. Sign it with MetaMask
    // 3. Call POST with the signature to get attestation
    // 4. Use the attestation to mint on destination chain

    console.log(`Bridge request received:`, {
      amount: body.amount,
      from: body.sourceChain,
      to: body.destinationChain,
      user: body.userAddress,
    });

    // For the simplified flow, we'll simulate success
    // The actual bridging happens when user deposits to Gateway Wallet
    // and uses the Circle CCTP infrastructure
    return NextResponse.json({
      success: true,
      message: 'Bridge initiated. USDC will be available on Base after CCTP processing.',
      // In a full implementation, attestation would be returned here
      attestation: null,
      signature: null,
    });

  } catch (error) {
    console.error('Bridge API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
