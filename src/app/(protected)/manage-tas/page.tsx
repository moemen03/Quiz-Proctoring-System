'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Plus,
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  FileText, 
  X, 
  Calendar, 
  ClipboardCheck, 
  BookOpen, 
  Briefcase, 
  Heart, 
  User as UserIcon,
  AlertTriangle,
  Copy,
  Clock,
  Search,
  Loader
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { userApi, excuseApi, scheduleApi, User, Excuse, ScheduleSlot, CreateExcuseInput } from '@/lib/api-client';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const EXCUSE_TYPES = [
  { value: 'grading', label: 'Heavy Grading', icon: ClipboardCheck, color: 'text-amber-400' },
  { value: 'research', label: 'Research Obligations', icon: BookOpen, color: 'text-blue-400' },
  { value: 'administrative', label: 'Administrative Tasks', icon: Briefcase, color: 'text-purple-400' },
  { value: 'medical', label: 'Medical', icon: Heart, color: 'text-red-400' },
  { value: 'personal', label: 'Personal', icon: UserIcon, color: 'text-slate-400' },
] as const;

export default function ManageTAsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExcuseForm, setShowExcuseForm] = useState<string | null>(null); // TA ID
  const [expandedTa, setExpandedTa] = useState<string | null>(null);
  const [excuseFormData, setExcuseFormData] = useState<CreateExcuseInput>({
    ta_id: '',
    excuse_type: 'grading',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTaCount, setVisibleTaCount] = useState(4);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin) {
        toast.error('Access denied. Admins only.');
        router.push('/dashboard');
        return;
      }
      loadData();
    }
  }, [authLoading, isAdmin, router]);

  const loadData = async () => {
    try {
      const [usersData, excusesData, schedulesData] = await Promise.all([
        userApi.getAll(),
        excuseApi.getAll(),
        scheduleApi.getAll()
      ]);
      setUsers(usersData);
      setExcuses(excusesData);
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleExcuseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await excuseApi.create({
        ...excuseFormData,
        ta_id: showExcuseForm!,
        end_date: excuseFormData.end_date || undefined,
      });
      await loadData();
      setShowExcuseForm(null);
      setExcuseFormData({
        ta_id: '',
        excuse_type: 'grading',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
      });
      toast.success('Excuse added successfully');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleRevokeExcuse = async (excuseId: string) => {
    if (!confirm('Are you sure you want to revoke this excuse?')) return;
    try {
      await excuseApi.delete(excuseId);
      await loadData();
      toast.success('Excuse revoked');
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const getActiveExcuses = (taId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return excuses.filter(e => 
      e.ta_id === taId && 
      e.status === 'active' &&
      e.start_date <= today &&
      (!e.end_date || e.end_date >= today)
    );
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[240px]">
        <div>
          <p className="font-semibold text-slate-900">Delete {userName}?</p>
          <p className="text-sm text-slate-500">This action cannot be undone.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await userApi.delete(userId);
                await loadData();
                toast.success('User deleted successfully');
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm shadow-red-500/30"
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-center',
      className: '!bg-white !p-4 !rounded-xl !shadow-xl !border !border-slate-100',
    });
  };

  const tas = users.filter(u => u.role === 'ta');
  const admins = users.filter(u => u.role === 'admin');

  // Filter & Paginate TAs
  const filteredTas = tas.filter(ta => 
    ta.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ta.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const displayedTas = filteredTas.slice(0, visibleTaCount);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleTaCount(prev => prev + 5);
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => observer.disconnect();
  }, [observerTarget, filteredTas.length, visibleTaCount]); // Dependencies updated to ensure re-observation

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleTaCount(4);
  }, [searchQuery]);

  if (authLoading || loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Manage TAs</h1>
            <p className="text-slate-400">View TAs, administrators, and workload excuses</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-8">
        {/* TAs */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Teaching Assistants ({filteredTas.length})
          </h2>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search TAs by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="space-y-3">
            {displayedTas.map((ta) => {
              const activeExcuses = getActiveExcuses(ta.id);
              const isExpanded = expandedTa === ta.id;
              
              return (
                <div key={ta.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors">
                    <div 
                      className="flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-4 sm:gap-0"
                      onClick={() => setExpandedTa(isExpanded ? null : ta.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold shrink-0">
                          {ta.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-white truncate">{ta.name}</p>
                            {!schedules.some(s => s.ta_id === ta.id) && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold border border-amber-500/30 whitespace-nowrap">
                                <AlertTriangle className="w-3 h-3" />
                                MISSING SCHEDULE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 group/email">
                            <p className="text-sm text-slate-400 truncate max-w-[200px] sm:max-w-none">{ta.email}</p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(ta.email);
                                toast.success('Email copied!', { position: 'bottom-right' });
                              }}
                              className="opacity-50 cursor-pointer group-hover/email:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                              title="Copy email"
                            >
                              <Copy className="w-3 h-3 text-slate-500" />
                            </button>
                          </div>
                          {ta.last_schedule_update && (
                            <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              <p className="text-xs">
                                Updated {formatDistanceToNow(new Date(ta.last_schedule_update), { addSuffix: true })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pl-[64px] sm:pl-0">
                        <div className="flex items-center gap-3">
                          {activeExcuses.length > 0 && (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {activeExcuses.length}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">{ta.major || 'CS'}</span>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(ta.id, ta.name);
                            }}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
                            title="Delete TA"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      {/* Workload Info */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 mb-1">Current Workload</p>
                          <p className="text-lg font-semibold text-white">
                            {(ta.total_workload_points || 0).toFixed(1)}
                          </p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400 mb-1">Target</p>
                          <p className="text-lg font-semibold text-white">
                            {((ta.target_workload || 14) ).toFixed(1)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Active Excuses */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-slate-300">Active Excuses</h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExcuseForm(ta.id);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Excuse
                          </button>
                        </div>
                        {activeExcuses.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No active excuses</p>
                        ) : (
                          <div className="space-y-2">
                            {activeExcuses.map(excuse => {
                              const typeInfo = EXCUSE_TYPES.find(t => t.value === excuse.excuse_type);
                              const Icon = typeInfo?.icon || FileText;
                              return (
                                <div 
                                  key={excuse.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${typeInfo?.color || 'text-slate-400'}`} />
                                    <div>
                                      <p className="text-sm text-white">{typeInfo?.label}</p>
                                      <p className="text-xs text-slate-400">
                                        {excuse.start_date}
                                        {excuse.end_date ? ` to ${excuse.end_date}` : ' (ongoing)'}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevokeExcuse(excuse.id);
                                    }}
                                    className="text-red-400 hover:text-red-300 p-1"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTas.length === 0 && (
              <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">No TAs found matching "{searchQuery}"</p>
              </div>
            )}
            
            {/* Infinite Scroll Trigger & Load More */}
            {displayedTas.length < filteredTas.length && (
              <div 
                ref={observerTarget} 
                className="py-4 flex flex-col items-center justify-center gap-2"
              >
                <Loader className="w-6 h-6 animate-spin text-slate-500" />
                <button 
                  onClick={() => setVisibleTaCount(prev => prev + 5)}
                  className="text-xs text-slate-500 hover:text-white underline md:hidden"
                >
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Admins */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Administrators ({admins.length})
          </h2>
          <div className="space-y-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                    {admin.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{admin.name}</p>
                    <div className="flex items-center gap-2 group/admin-email">
                      <p className="text-slate-400 text-[10px]">{admin.email}</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(admin.email);
                          toast.success('Email copied!', { position: 'bottom-right' });
                        }}
                        className="opacity-50 cursor-pointer group-hover/admin-email:opacity-100 p-0.5 hover:bg-slate-700 rounded transition-all"
                        title="Copy email"
                      >
                        <Copy className="w-2.5 h-2.5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 mr-2">{admin.major || 'CS'}</span>
                  <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded textxs font-medium border border-indigo-500/30">Admin</span>
                </div>
              </div>
            ))}
            {admins.length === 0 && (
              <p className="text-slate-400 text-center py-8">No admins added yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Excuse Modal */}
      {showExcuseForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Add Workload Excuse</h2>
              <button 
                onClick={() => setShowExcuseForm(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              For: {tas.find(t => t.id === showExcuseForm)?.name}
            </p>
            <form onSubmit={handleExcuseSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Excuse Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXCUSE_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setExcuseFormData({ ...excuseFormData, excuse_type: type.value })}
                        className={`p-3 rounded-lg flex items-center gap-2 transition-colors ${
                          excuseFormData.excuse_type === type.value
                            ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                            : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${type.color}`} />
                        <span className="text-sm">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Description (optional)</label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Additional details..."
                  rows={2}
                  value={excuseFormData.description}
                  onChange={(e) => setExcuseFormData({ ...excuseFormData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={excuseFormData.start_date}
                    onChange={(e) => setExcuseFormData({ ...excuseFormData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Leave empty for ongoing"
                    value={excuseFormData.end_date}
                    onChange={(e) => setExcuseFormData({ ...excuseFormData, end_date: e.target.value })}
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave empty for ongoing</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowExcuseForm(null)} className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                  Add Excuse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
