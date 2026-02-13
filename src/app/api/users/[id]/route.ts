import { NextResponse } from 'next/server';
import { supabaseAdmin, getUserProfileFromRequest } from '@/lib/supabase-admin';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const requesterProfile = await getUserProfileFromRequest(req);

        if (!requesterProfile || requesterProfile.role !== 'admin') {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        // Get the auth_id of the user to delete using the public ID
        const { data: targetUser, error: targetUserError } = await supabaseAdmin
            .from('users')
            .select('auth_id')
            .eq('id', id)
            .single();

        if (targetUserError || !targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }


        // Delete from public.users first (if foreign key constraints don't cascade automatically, 
        // but usually we delete auth user which cascades to public user. 
        // However, Supabase recommendation is often: delete auth user -> trigger deletes public user 
        // OR delete public user -> trigger or manual delete auth user.
        // Let's try deleting the auth user, which should be the source of truth.)

        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
            targetUser.auth_id
        );

        if (deleteAuthError) {
            console.warn('Error deleting auth user (might already be deleted):', deleteAuthError);
        }

        // Explicitly delete from public.users if not handled by cascade
        // (It's safer to ensure it's gone)
        const { error: deletePublicError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', id);

        if (deletePublicError) {
            console.error('Error deleting public user profile:', deletePublicError);
            // We already deleted the auth user (or tried to), so it's partially done. 
            return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 });
        }

        return new NextResponse(null, { status: 204 });

    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
