import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Pool from '@/models/Pool';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const pool = await Pool.findById(id).lean();
    
    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }
    
    return NextResponse.json({ pool });
  } catch (error) {
    console.error('Error fetching pool:', error);
    return NextResponse.json({ error: 'Failed to fetch pool' }, { status: 500 });
  }
}
