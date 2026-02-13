import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function GET(req: Request) {
    try {
        const profile = await getUserProfileFromRequest(req);
        if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        return NextResponse.json({ day_off: profile.day_off });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
