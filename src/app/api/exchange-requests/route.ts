import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('access_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user profile id
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        const body = await req.json();
        const { assignment_id, reason } = body;

        if (!assignment_id) {
            return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
        }

        // Verify assignment belongs to user
        const { data: assignment } = await supabaseAdmin
            .from('assignments')
            .select('id, ta_id')
            .eq('id', assignment_id)
            .single();

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (assignment.ta_id !== profile.id) {
            return NextResponse.json({ error: 'You can only request exchange for your own assignments' }, { status: 403 });
        }

        // Check if request already exists
        const { data: existing } = await supabaseAdmin
            .from('exchange_requests')
            .select('id')
            .eq('assignment_id', assignment_id)
            .eq('status', 'pending')
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Pending request already exists for this assignment' }, { status: 409 });
        }

        const { data, error } = await supabaseAdmin
            .from('exchange_requests')
            .insert({
                assignment_id,
                original_ta_id: profile.id,
                reason,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error) {
        console.error('Create exchange request error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('access_token')?.value;
        const url = new URL(req.url);
        const statusFilter = url.searchParams.get('status'); // 'pending', 'history' (approved/rejected), or 'all'

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user profile to check role
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .eq('auth_id', user.id)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        let query = supabaseAdmin
            .from('exchange_requests')
            .select(`
                *,
                assignments (
                    *,
                    quizzes ( course_name, date, start_time, duration_minutes ),
                    locations ( name )
                ),
                original_ta:users!original_ta_id ( name, email )
            `);

        if (profile.role === 'admin') {
            if (statusFilter === 'pending') {
                query = query.eq('status', 'pending');
            } else if (statusFilter === 'history') {
                query = query.in('status', ['approved', 'rejected']);
            }
            // else ('all' or undefined) - return everything
        } else {
            // TA sees THEIR OWN requests (any status)
            query = query.eq('original_ta_id', profile.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error) {
        console.error('List exchange requests error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
