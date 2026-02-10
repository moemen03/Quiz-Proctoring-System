'use client';

import { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';
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

export default function ManageProctorsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
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

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    loadData();
  }, [authLoading, isAdmin]);

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

  const getTotalReduction = (taId: string) => {
    const active = getActiveExcuses(taId);
    return active.length; // Returns count of active excuses
  };

  const tas = users.filter(u => u.role === 'ta');
  const admins = users.filter(u => u.role === 'admin');

  if (authLoading || loading) return <PageLoader />;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Manage Proctors</h1>
            <p className="text-slate-400">View TAs, administrators, and workload excuses</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-8">
        {/* TAs */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Teaching Assistants ({tas.length})
          </h2>
          <div className="space-y-3">
            {tas.map((ta) => {
              const activeExcuses = getActiveExcuses(ta.id);
              const totalReduction = getTotalReduction(ta.id);
              const isExpanded = expandedTa === ta.id;
              
              
             
              return (
                <div key={ta.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 transition-all hover:border-slate-600">
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedTa(isExpanded ? null : ta.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold">
                          {ta.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{ta.name}</p>
                            {!schedules.some(s => s.ta_id === ta.id) && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold border border-amber-500/30">
                                <AlertTriangle className="w-3 h-3" />
                                MISSING SCHEDULE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 group/email">
                            <p className="text-sm text-slate-400">{ta.email}</p>
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
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {activeExcuses.length > 0 && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {activeExcuses.length}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">{ta.major || 'CS'}</span>
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
                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <p className="text-xs text-slate-400 mb-1">Current Workload</p>
                          <p className="text-lg font-semibold text-white">
                            {(ta.total_workload_points || 0).toFixed(1)}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <p className="text-xs text-slate-400 mb-1">Target</p>
                          <p className="text-lg font-semibold text-white">
                            {((ta.target_workload || 10) ).toFixed(1)}
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
                                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-700/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${typeInfo?.color || 'text-slate-400'}`} />
                                    <div>
                                      <p className="text-xs font-medium text-white">{typeInfo?.label}</p>
                                      <p className="text-[10px] text-slate-400">
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
            {tas.length === 0 && (
              <p className="text-slate-400 text-center py-8">No TAs added yet</p>
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
                className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                    {admin.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{admin.name}</p>
                    <div className="flex items-center gap-2 group/admin-email">
                      <p className="text-sm text-slate-400 text-[10px]">{admin.email}</p>
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
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">Admin</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-slate-700">
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
                <label className="label text-xs">Excuse Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXCUSE_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setExcuseFormData({ ...excuseFormData, excuse_type: type.value })}
                        className={`p-3 rounded-lg flex items-center gap-2 transition-colors border ${
                          excuseFormData.excuse_type === type.value
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                            : 'bg-slate-700/50 border-transparent hover:bg-slate-700 text-slate-300'
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
                <label className="label text-xs">Description (optional)</label>
                <textarea
                  className="input"
                  placeholder="Additional details..."
                  rows={2}
                  value={excuseFormData.description}
                  onChange={(e) => setExcuseFormData({ ...excuseFormData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1 text-xs">
                    <Calendar className="w-4 h-4" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={excuseFormData.start_date}
                    onChange={(e) => setExcuseFormData({ ...excuseFormData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label flex items-center gap-1 text-xs">
                    <Calendar className="w-4 h-4" />
                    End Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    placeholder="Leave empty for ongoing"
                    value={excuseFormData.end_date}
                    onChange={(e) => setExcuseFormData({ ...excuseFormData, end_date: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Leave empty for ongoing</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowExcuseForm(null)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
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
