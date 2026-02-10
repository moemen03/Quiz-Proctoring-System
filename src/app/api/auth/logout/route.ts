import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    // Logic to invalidate token if possible
    // For now, client-side token removal is primary mechanism
    return NextResponse.json({ message: 'Logged out successfully' });
}
