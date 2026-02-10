'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PageLoader } from '@/components/LoadingSpinner';
import { SidebarLayout } from '@/components/SidebarLayout';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return null; // Will redirect
  }

  return <SidebarLayout>{children}</SidebarLayout>;
}
