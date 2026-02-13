import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabaseAccessToken = req.cookies.get('access_token')?.value;

    // Paths that require authentication
    const protectedPaths = ['/dashboard', '/schedule', '/quizzes', '/users', '/profile', '/manage-tas'];

    // Check if current path is protected
    const isProtectedPath = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path));

    // If trying to access protected route without token, redirect to login
    if (isProtectedPath && !supabaseAccessToken) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    // If trying to access login/signup while logged in, redirect to dashboard
    if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') && supabaseAccessToken) {
        return NextResponse.redirect(new URL('/quizzes', req.url));
    }

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
