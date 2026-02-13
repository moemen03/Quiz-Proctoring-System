import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const token = cookieStore.get('access_token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify admin
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        // In a real app, check role here
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { new_ta_id } = body;

        if (!new_ta_id) {
            return NextResponse.json({ error: 'New TA ID is required' }, { status: 400 });
        }

        // 1. Get the request details
        const { data: request, error: fetchError } = await supabaseAdmin
            .from('exchange_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (request.status !== 'pending') {
            return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
        }

        // 2. Perform Transaction (Simulated with sequential ops, could use RPC for atomicity)

        // A. Update the Assignment
        const { error: assignError } = await supabaseAdmin
            .from('assignments')
            .update({ ta_id: new_ta_id, status: 'assigned' })
            .eq('id', request.assignment_id);

        if (assignError) throw assignError;

        // B. Update User Workloads
        // We need to:
        // 1. Increase Original TA's target_workload (+0.5 penalty)
        // 2. Decrease Original TA's total_workload_points (remove assignment weight)
        // 3. Increase New TA's total_workload_points (add assignment weight)

        // Get Quiz Weight from Assignment
        const { data: assignmentData } = await supabaseAdmin
            .from('assignments')
            .select(`
                *,
                quizzes ( weight )
            `)
            .eq('id', request.assignment_id)
            .single();

        const quizWeight = assignmentData?.quizzes?.weight || 1;

        // Update Original TA
        const { data: originalTA } = await supabaseAdmin
            .from('users')
            .select('target_workload, total_workload_points')
            .eq('id', request.original_ta_id)
            .single();

        if (originalTA) {
            await supabaseAdmin
                .from('users')
                .update({
                    target_workload: (originalTA.target_workload || 0) + 0.5,
                    total_workload_points: Math.max(0, (originalTA.total_workload_points || 0) - quizWeight)
                })
                .eq('id', request.original_ta_id);
        }

        // Update New TA
        const { data: newTA } = await supabaseAdmin
            .from('users')
            .select('total_workload_points')
            .eq('id', new_ta_id)
            .single();

        if (newTA) {
            await supabaseAdmin
                .from('users')
                .update({
                    total_workload_points: (newTA.total_workload_points || 0) + quizWeight
                })
                .eq('id', new_ta_id);
        }

        // C. Update Request Status
        const { data: updatedRequest, error: updateError } = await supabaseAdmin
            .from('exchange_requests')
            .update({
                status: 'approved',
                new_ta_id: new_ta_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        return NextResponse.json(updatedRequest);

    } catch (error) {
        console.error('Approve exchange request error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
