import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-indigo-500 ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <LoadingSpinner className="h-8 w-8" />
    </div>
  );
}
