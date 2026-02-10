import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getUser(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];

    // Auth - simple verification for now, optimizing by not fetching profile if not needed for role?
    // Actually we need profile for role
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !authUser) return null;

    const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

    return userProfile;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getUser(req);
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
        const user = await getUser(req);
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
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getUser(req);
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
