'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PageLoader } from '@/components/LoadingSpinner';
import { SidebarLayout } from '@/components/SidebarLayout';
import { RamadanWelcomeModal } from '@/components/RamadanWelcomeModal';

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

  return (
    <>
      <RamadanWelcomeModal />
      <SidebarLayout>{children}</SidebarLayout>
    </>
  );
}
