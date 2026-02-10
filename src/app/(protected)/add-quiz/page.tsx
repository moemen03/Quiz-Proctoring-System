'use client';

import { CalendarPlus } from 'lucide-react';
import { QuizForm } from '@/components/QuizForm';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AddQuizPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  if (!isAdmin) {
    router.replace('/quizzes');
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <CalendarPlus className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Add New Quiz</h1>
          <p className="text-slate-400">Create a new quiz and assign proctors</p>
        </div>
      </div>

      <div className="glass p-8 rounded-2xl">
        <QuizForm onSuccess={() => router.push('/quizzes')} />
      </div>
    </div>
  );
}
