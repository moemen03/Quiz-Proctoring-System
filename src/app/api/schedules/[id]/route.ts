import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const profile = await getUserProfileFromRequest(req);
        if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (profile.role !== 'admin') {
            const { data: schedule } = await supabaseAdmin
                .from('ta_schedules')
                .select('ta_id')
                .eq('id', id)
                .single();

            if (!schedule || schedule.ta_id !== profile.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        const body = await req.json();
        const { data, error } = await supabaseAdmin
            .from('ta_schedules')
            .update(body)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update last_schedule_update for the user
        // We need to know the TA ID. If admin is updating, we need to fetch the schedule first to know the TA ID, 
        // OR rely on the return data if it includes ta_id.
        // The return data from .update().select() should have it.
        if (data && data.ta_id) {
            await supabaseAdmin
                .from('users')
                .update({ last_schedule_update: new Date().toISOString() })
                .eq('id', data.ta_id);

            // Notification for schedule update
            if (profile.role !== 'admin') {
                await supabaseAdmin.from('admin_notifications').insert({
                    type: 'schedule_change',
                    message: `TA ${profile.name} updated a slot on ${data.day_of_week} at Slot ${data.slot_number}.`,
                    ta_id: data.ta_id,
                });
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const profile = await getUserProfileFromRequest(req);
        if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch the schedule first to get details for notification and validation
        const { data: scheduleToDelete } = await supabaseAdmin
            .from('ta_schedules')
            .select('*') // Select all to get day and slot for notification
            .eq('id', id)
            .single();

        if (!scheduleToDelete) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
        }

        if (profile.role !== 'admin') {
            if (scheduleToDelete.ta_id !== profile.id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
            }
        }

        const { error } = await supabaseAdmin
            .from('ta_schedules')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if (scheduleToDelete.ta_id) {
            await supabaseAdmin
                .from('users')
                .update({ last_schedule_update: new Date().toISOString() })
                .eq('id', scheduleToDelete.ta_id);

            // Notification for schedule deletion
            if (profile.role !== 'admin') {
                await supabaseAdmin.from('admin_notifications').insert({
                    type: 'schedule_change',
                    message: `TA ${profile.name} removed a slot on ${scheduleToDelete.day_of_week} at Slot ${scheduleToDelete.slot_number}.`,
                    ta_id: scheduleToDelete.ta_id,
                });
            }
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
