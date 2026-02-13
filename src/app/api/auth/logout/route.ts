import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    // Logic to invalidate token if possible
    // For now, client-side token removal is primary mechanism
    const response = NextResponse.json({ message: 'Logged out successfully' });

    response.cookies.delete('access_token');
    response.cookies.delete('refresh_token');

    return response;
}
