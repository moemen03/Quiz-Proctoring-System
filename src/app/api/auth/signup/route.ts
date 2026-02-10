import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const { email, password, name, major } = await req.json();

        if (!email || !password || !name || !major) {
            return NextResponse.json({ error: 'Email, password, name, and major are required' }, { status: 400 });
        }

        // Validate university email
        if (!email.endsWith('@giu-uni.de')) {
            return NextResponse.json({ error: 'Please use your GIU university email (xxxxx@giu-uni.de)' }, { status: 400 });
        }

        // Validate full name has at least 3 names
        const nameParts = name.trim().split(/\s+/);
        if (nameParts.length < 3) {
            return NextResponse.json({ error: 'Please enter your full name (first, middle, and last name)' }, { status: 400 });
        }

        // Create auth user with Supabase using isolated client
        const authClient = getAuthClient();
        const { data, error } = await authClient.auth.signUp({
            email,
            password,
            options: {
                data: { name, major } // Store major in metadata too
            }
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Create user profile immediately with major using ADMIN client
        if (data.user) {
            const { error: profileError } = await supabaseAdmin
                .from('users')
                .insert({
                    auth_id: data.user.id,
                    email: data.user.email,
                    name: name,
                    role: 'ta', // Default role
                    major: major
                });

            if (profileError) {
                console.error('Failed to create user profile:', profileError);
                // Don't fail the request, but log it. Auth user is created.
            }
        }

        return NextResponse.json({
            message: 'Signup successful! Please check your email to verify your account.',
            user: data.user
        }, { status: 201 });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
    }
}
