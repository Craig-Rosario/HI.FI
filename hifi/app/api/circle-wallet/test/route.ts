import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const circleApiKey = process.env.CIRCLE_API_KEY;
    
    if (!circleApiKey) {
      return NextResponse.json(
        { error: 'CIRCLE_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // Test Circle API connectivity
    const response = await fetch('https://api.circle.com/v1/w3s/developer/wallets?pageSize=10', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${circleApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: 'Circle API test failed',
          status: response.status,
          details: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Circle API connection successful',
      apiKeyConfigured: true,
      walletsCount: data.data?.length || 0,
    });

  } catch (error) {
    console.error('Circle API test error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to test Circle API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}