import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'ramadan_mode')
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return NextResponse.json(data?.value || { enabled: false });
    } catch (error) {
        console.error('Error fetching ramadan settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { enabled, start_date, end_date } = await req.json();

        // If enabled is true, validate dates
        if (enabled && (!start_date || !end_date)) {
            return NextResponse.json({ error: 'Start and end dates are required when enabling' }, { status: 400 });
        }

        const value = enabled
            ? { enabled, start_date, end_date }
            : { enabled: false, start_date: null, end_date: null };

        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'ramadan_mode',
                value
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating ramadan settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
