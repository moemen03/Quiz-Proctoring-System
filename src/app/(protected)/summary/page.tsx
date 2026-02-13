'use client';

import { useState, useEffect } from 'react';
import { BarChart3, User, Calendar, TrendingUp, Search } from 'lucide-react';
import { userApi, User as TaUser, ProctorSummary, exchangeApi } from '@/lib/api-client';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';

export default function ProctorSummaryPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  if (authLoading) return <PageLoader />;
  const [tas, setTas] = useState<TaUser[]>([]);
  const [selectedTa, setSelectedTa] = useState<string>('');
  const [summary, setSummary] = useState<ProctorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Only load if user is defined
    if (!user) return;

    if (isAdmin) {
      // Admins: load all TAs to select from
      loadTas();
    } else {
      // TAs: load their own summary directly
      setSelectedTa(user.id);
      loadSummary(user.id);
      setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (selectedTa && isAdmin) {
      loadSummary(selectedTa);
    }
  }, [selectedTa, isAdmin]);

  const loadTas = async () => {
    try {
      const data = await userApi.getAll('ta');
      setTas(data);
      if (data.length > 0) {
        setSelectedTa(data[0].id);
      }
    } catch (error) {
      console.error('Error loading TAs:', error);
    } finally {
      setLoading(false);
    }
  };

  const [requests, setRequests] = useState<any[]>([]); // Use appropriate type if available, using any to avoid import issues for now
  const [loadingRequests, setLoadingRequests] = useState(false);

  // ... imports need to be checked if ExchangeRequest is exported from api-client
  // It is exported.

  const loadSummary = async (taId: string) => {
    setLoadingSummary(true);
    setLoadingRequests(true);
    try {
      const data = await userApi.getSummary(taId);
      setSummary(data);
      
      // Fetch requests only if viewing own summary (or if admin implementation allows filtering by user ID in fetch)
      // The API currently returns "My Requests" for TA, or "All Pending" for Admin. 
      // Admin viewing a specific TA's requests isn't directly supported by GET /api/exchange-requests yet (it returns ALL pending).
      // So for now, we only show this detailed list for the TA themselves.
      if (!isAdmin) {
          const reqs = await exchangeApi.getAll();
          setRequests(reqs);
      } else {
          setRequests([]); // Or implement admin-side filtering if needed
      }

    } catch (error) {
      console.error('Error loading summary:', error);
    } finally {
      setLoadingSummary(false);
      setLoadingRequests(false);
    }
  };

  if (loading) return <PageLoader />;

  // Filter TAs based on search term
  const filteredTas = tas.filter(ta => 
    ta.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ta.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <BarChart3 className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {isAdmin ? 'Proctor Summary' : 'My Summary'}
          </h1>
          <p className="text-slate-400">
            {isAdmin ? 'View assignment statistics and workload' : 'Your assignment statistics'}
          </p>
        </div>
      </div>

      <div className={`grid gap-8 ${isAdmin ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {/* TA Selector - Admin Only */}
        {isAdmin && (
          <div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sticky top-6">
              <h2 className="font-semibold text-white mb-4">Select TA</h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search TAs..."
                  className="input pl-9 text-xs h-9 placeholder:text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {filteredTas.length === 0 ? (
                  <p className="text-slate-400 text-sm italic py-4 text-center">
                    {searchTerm ? 'No matching TAs found' : 'No TAs found'}
                  </p>
                ) : (
                  filteredTas.map((ta) => (
                    <button
                      key={ta.id}
                      onClick={() => setSelectedTa(ta.id)}
                      className={`w-full p-2 rounded-lg text-left transition-colors ${
                        selectedTa === ta.id
                          ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300'
                          : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                           {ta.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{ta.name}</p>
                          <p className="text-[10px] text-slate-400">{ta.email}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary Content */}
        <div className={isAdmin ? 'lg:col-span-2' : ''}>
          {loadingSummary ? (
            <PageLoader />
          ) : summary ? (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{summary.total_assignments}</p>
                  <p className="text-sm text-slate-400">Total</p>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{summary.upcoming_assignments}</p>
                  <p className="text-sm text-slate-400">Upcoming</p>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">{summary.completed_assignments}</p>
                  <p className="text-sm text-slate-400">Completed</p>
                </div>
              </div>

              {/* Assignments List */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-semibold text-white mb-4">Assignment History</h3>
                {summary.assignments.length === 0 ? (
                  <p className="text-slate-400">No assignments yet</p>
                ) : (
                  <div className="space-y-3">
                    {summary.assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/50"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {assignment.quizzes?.course_name}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                            <span>
                              {assignment.quizzes?.date && new Date(assignment.quizzes.date).toLocaleDateString()}
                            </span>
                            <span>{assignment.quizzes?.start_time}</span>
                            <span>{assignment.locations?.name}</span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${
                          assignment.status === 'completed' 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : assignment.status === 'confirmed'
                            ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {assignment.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mt-6">
                <h3 className="font-semibold text-white mb-4">Exchange Requests</h3>
                 {loadingRequests ? (
                    <div className="flex justify-center py-4"><PageLoader /></div>
                 ) : requests.length === 0 ? (
                    <p className="text-slate-400">No exchange requests found</p>
                 ) : (
                    <div className="space-y-3">
                      {requests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/50">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${
                                    req.status === 'approved' ? 'bg-emerald-500' :
                                    req.status === 'rejected' ? 'bg-red-500' :
                                    'bg-amber-500'
                                }`} />
                                <span className="font-medium text-white">
                                    {req.assignments?.quizzes?.course_name}
                                </span>
                            </div>
                            <div className="text-sm text-slate-400 flex items-center gap-3">
                                <span>{req.assignments?.quizzes?.date}</span>
                                <span>{req.assignments?.quizzes?.start_time}</span>
                            </div>
                            {req.reason && <p className="text-xs text-slate-500 mt-1 italic">"{req.reason}"</p>}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full border border-opacity-30 ${
                              req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' :
                              req.status === 'rejected' ? 'bg-red-500/20 text-red-400 border-red-500' :
                              'bg-amber-500/20 text-amber-400 border-amber-500'
                          }`}>
                              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
                {isAdmin ? 'Select a TA to view their summary' : 'No summary data available'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
