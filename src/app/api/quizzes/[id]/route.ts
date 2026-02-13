import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';
import { AssignmentService } from '@/services/AssignmentService';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserMajor = user.major;

        let query = supabaseAdmin
            .from('quizzes')
            .select(`
        *,
        locations (*),
        assignments (
          *,
          users (*)
        )
      `)
            .eq('id', id);

        if (currentUserMajor) {
            query = query.eq('major', currentUserMajor);
        }

        const { data, error } = await query.single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can update quizzes' }, { status: 403 });
        }

        const body = await req.json();
        const { locations, ...quizData } = body;

        const { data, error } = await supabaseAdmin
            .from('quizzes')
            .update(quizData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update locations if provided
        if (locations) {
            // Delete existing locations
            await supabaseAdmin
                .from('locations')
                .delete()
                .eq('quiz_id', id);

            // Insert new locations
            const locationsWithQuizId = locations.map((loc: any) => ({
                ...loc,
                quiz_id: id
            }));

            await supabaseAdmin
                .from('locations')
                .insert(locationsWithQuizId);

            // Auto-assign proctors for the new locations
            try {
                await AssignmentService.autoAssign(id);
                // Fetch updated quiz with new assignments to return
                const { data: updatedQuiz } = await supabaseAdmin
                    .from('quizzes')
                    .select(`
                        *,
                        locations (*),
                        assignments (
                            *,
                            users (*)
                        )
                    `)
                    .eq('id', id)
                    .single();

                if (updatedQuiz) {
                    return NextResponse.json(updatedQuiz);
                }
            } catch (assignError) {
                console.error('Auto-assignment failed during update:', assignError);
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
        const user = await getUserProfileFromRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can delete quizzes' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('quizzes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
