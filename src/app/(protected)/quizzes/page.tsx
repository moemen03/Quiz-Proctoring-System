'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Edit, 
  Trash2, 
  UserPlus,
  Sparkles,
  X,
  Search,
  Filter,
  MoreVertical,
  AlertCircle,
  Loader,
  Copy,
  Check,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { quizApi, assignmentApi, Quiz, TASuggestion } from '@/lib/api-client';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { QuizForm } from '@/components/QuizForm';

// Calculate required proctors based on capacity
const calculateProctorsForCapacity = (capacity: number): number => {
  if (capacity <= 10) return 1;
  if (capacity <= 30) return 2;
  if (capacity <= 60) return 3;
  if (capacity <= 100) return 4;
  return Math.ceil(capacity / 25);
};

export default function QuizzesPage() {
  const { isAdmin, user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningQuiz, setAssigningQuiz] = useState<string | null>(null);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [suggestions, setSuggestions] = useState<TASuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [activeMenuQuiz, setActiveMenuQuiz] = useState<string | null>(null);
  const [copiedQuizId, setCopiedQuizId] = useState<string | null>(null);

  useEffect(() => {
    loadQuizzes();
    
    const handleClickOutside = () => setActiveMenuQuiz(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadQuizzes = async () => {
    try {
      const data = await quizApi.getAll();
      setQuizzes(data);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async (quizId: string) => {
    try {
      const response = await assignmentApi.getSuggestions(quizId);
      setSuggestions(response.suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleAssign = (quizId: string, locationId: string) => {
    setAssigningQuiz(quizId);
    setSelectedLocation(locationId);
    loadSuggestions(quizId);
  };

  const assignProctor = async (taId: string) => {
    if (!assigningQuiz || !selectedLocation) return;

    try {
      await assignmentApi.create({
        quiz_id: assigningQuiz,
        ta_id: taId,
        location_id: selectedLocation,
      });
      await loadQuizzes();
      setAssigningQuiz(null);
      setSelectedLocation(null);
      setSuggestions([]);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    const loadingToast = toast.loading('Deleting quiz...');
    try {
      await quizApi.delete(id);
      await loadQuizzes();
      toast.success('Quiz deleted successfully', { id: loadingToast });
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('Failed to delete quiz', { id: loadingToast });
    }
  };

  const handleCopyQuiz = async (quiz: Quiz) => {
    const dateStr = new Date(quiz.date).toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    let message = `Hi Shabab, \nthere is a Quiz "${quiz.course_name}" at ${dateStr}  |  ${quiz.start_time}\n`;
    
    quiz.locations?.forEach((loc, idx) => {
      const locAssignments = quiz.assignments?.filter(a => a.location_id === loc.id) || [];
      const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][idx] || '📍';
      
      message += `\n${emoji} location ${loc.name}: \n`;
      
      if (locAssignments.length > 0) {
        locAssignments.forEach((a, i) => {
          const proctorEmoji = i === 0 ? '🔸 ' : '☻ ';
          const isLast = i === locAssignments.length - 1;
          message += `\n${proctorEmoji}${a.users?.name}${isLast ? '' : ','}`;
        });
        message += '\n';
      } else {
        message += 'No proctors assigned';
      }
      message += '\n ➖➖➖➖➖➖➖➖➖➖➖\n';
    });
    
    message += `\nthanks,\n${user?.name || 'Admin'}`;

    try {
      await navigator.clipboard.writeText(message);
      setCopiedQuizId(quiz.id);
      setTimeout(() => setCopiedQuizId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      started: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      finished: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    const labels: Record<string, string> = {
      upcoming: 'Upcoming',
      started: 'Ongoing',
      finished: 'Completed',
      in_progress: 'Ongoing',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return { 
      className: `text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[status] || 'bg-slate-700 text-slate-400'}`, 
      label: labels[status] || status 
    };
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const getQuizStatus = (quiz: Quiz): string => {
    const now = new Date();
    const [startHours, startMinutes] = quiz.start_time.split(':').map(Number);
    
    const quizStart = new Date(quiz.date);
    quizStart.setHours(startHours, startMinutes, 0, 0);
    
    // Create quiz end datetime
    const quizEnd = new Date(quizStart.getTime() + quiz.duration_minutes * 60 * 1000);
    
    if (now < quizStart) {
      return 'upcoming';
    } else if (now >= quizStart && now <= quizEnd) {
      return 'started';
    } else {
      return 'finished';
    }
  };

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(quiz => {
      const matchesSearch = quiz.course_name.toLowerCase().includes(searchQuery.toLowerCase());
      const status = getQuizStatus(quiz);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      const assignedCount = quiz.assignments?.length || 0;
      const requiredCount = quiz.min_proctors;
      const isIncomplete = assignedCount < requiredCount;
      const matchesIncomplete = showIncompleteOnly ? isIncomplete : true;

      return matchesSearch && matchesStatus && matchesIncomplete;
    });
  }, [quizzes, searchQuery, statusFilter, showIncompleteOnly]);

  const groupedQuizzes = useMemo(() => {
    return Object.entries(
      filteredQuizzes.reduce((groups, quiz) => {
        const date = quiz.date.split('T')[0];
        if (!groups[date]) groups[date] = [];
        groups[date].push(quiz);
        return groups;
      }, {} as Record<string, Quiz[]>)
    ).sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime());
  }, [filteredQuizzes]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Toaster />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Quizzes</h1>
          <p className="text-slate-400 text-sm">Manage assignments and schedules</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search Quiz"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-32 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
            {['all', 'upcoming', 'started', 'finished'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  statusFilter === status 
                    ? 'bg-slate-700 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showIncompleteOnly 
                ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Incomplete Only
          </button>

          {isAdmin && (
             <Link 
               href="/add-quiz"
               className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
             >
               <Plus className="w-3.5 h-3.5" />
               Add Quiz
             </Link>
          )}
        </div>
      </div>

      {filteredQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Filter className="w-8 h-8 mb-3 opacity-50" />
          <p className="text-lg font-medium">No quizzes found</p>
          <p className="text-sm">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedQuizzes.map(([date, dateQuizzes]) => (
            <div key={date}>
              <h2 className="text-base font-semibold text-slate-400 mb-3 flex items-center gap-2 sticky top-0 bg-slate-900/95 py-3 z-10 backdrop-blur-sm border-b border-slate-800/50">
                <Calendar className="w-4 h-4 text-indigo-400" />
                {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                <span className="bg-slate-800 text-slate-500 text-sm px-1.5 py-0.5 rounded-full ml-1">
                  {dateQuizzes.length}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {dateQuizzes.map((quiz) => {
                  const assignedCount = quiz.assignments?.length || 0;
                  const requiredCount = quiz.min_proctors;
                  const progress = requiredCount > 0 ? Math.min((assignedCount / requiredCount) * 100, 100) : 100;
                  const isComplete = assignedCount >= requiredCount;
                  const isInsufficient = assignedCount < requiredCount;
                  const status = getQuizStatus(quiz);
                  const badge = getStatusBadge(status);

                  return (
                    <div 
                      key={quiz.id} 
                      className={`relative rounded-xl overflow-hidden transition-all duration-200 group border ${
                        isInsufficient 
                          ? 'bg-red-950/20 border-red-500/40 hover:border-red-500/60 shadow-[0_0_15px_-5px_theme(colors.red.900)]' 
                          : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="p-4 pb-0">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-white text-lg truncate pr-2 w-full" title={quiz.course_name}>
                            {quiz.course_name}
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={badge.className}>{badge.label}</span>
                            
                            <button
                              onClick={() => handleCopyQuiz(quiz)}
                              className={`p-1 rounded transition-colors ${
                                copiedQuizId === quiz.id 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'text-slate-500 hover:text-white hover:bg-slate-700'
                              }`}
                              title="Copy details"
                            >
                              {copiedQuizId === quiz.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>

                            {isAdmin && (
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuQuiz(activeMenuQuiz === quiz.id ? null : quiz.id);
                                  }}
                                  className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-700 transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                
                                {activeMenuQuiz === quiz.id && (
                                  <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                                    <button 
                                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                      onClick={() => {
                                        setEditingQuiz(quiz);
                                        setActiveMenuQuiz(null);
                                      }}
                                    >
                                      <Edit className="w-3 h-3" /> Edit
                                    </button>
                                    <button 
                                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                      onClick={() => {
                                        deleteQuiz(quiz.id);
                                        setActiveMenuQuiz(null);
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-slate-400 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {quiz.start_time} - {calculateEndTime(quiz.start_time, quiz.duration_minutes)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              {quiz.locations?.length || 0} Locations
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 mb-3 max-w-[40%]">
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className={`font-medium ${isInsufficient ? 'text-red-400' : 'text-slate-400'}`}>
                              {isInsufficient ? 'Insufficient Proctors' : 'Proctors Assigned'}
                            </span>
                            <span className={isComplete ? 'text-emerald-400' : 'text-slate-300'}>
                              <span className="font-semibold">{assignedCount}</span>/{requiredCount}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${
                                isComplete ? 'bg-emerald-500' : isInsufficient ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900/20 px-3 pb-3 pt-3 border-t border-slate-700/20">
                          <div className="space-y-2">
                            {quiz.locations?.map((loc) => {
                              const locationAssignments = quiz.assignments?.filter(a => a.location_id === loc.id) || [];
                              const locRequired = calculateProctorsForCapacity(loc.capacity || 10);
                              const isLocFull = locationAssignments.length >= locRequired;

                              return (
                                <div key={loc.id} className="flex flex-col gap-1.5 p-2 rounded bg-slate-800/50 border border-slate-700/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-slate-300">{loc.name}</span>
                                      <span className="text-xs text-slate-500">Capacity: {loc.capacity}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs ${isLocFull ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {locationAssignments.length}/{locRequired}
                                      </span>
                                      {isAdmin && !isLocFull && (
                                        <button 
                                          className="p-1 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30"
                                          title="Assign Proctor"
                                          onClick={() => handleAssign(quiz.id, loc.id)}
                                        >
                                          <UserPlus className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {locationAssignments.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pl-1">
                                      {locationAssignments.map((a) => (
                                        <div key={a.id} className="flex items-center gap-1 bg-slate-700/50 px-1.5 py-0.5 rounded text-[14px] text-slate-300 border border-slate-600/30">
                                          <span className="truncate max-w-[200px]">{a.users?.name.split(' ').slice(0, 2).join(' ')}</span>
                                          {isAdmin && (
                                            <button 
                                              className="text-slate-500 hover:text-red-400"
                                              onClick={() => {
                                                if(confirm('Remove proctor?')) {
                                                  assignmentApi.delete(a.id).then(loadQuizzes);
                                                }
                                              }}
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {assigningQuiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Suggested Proctors</h2>
              </div>
              <button onClick={() => { setAssigningQuiz(null); setSuggestions([]); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
               {suggestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Loader className="w-6 h-6 animate-spin mb-2" />
                    <p className="text-sm">Analyzing schedules...</p>
                  </div>
               ) : (
                  suggestions.map((ta) => (
                    <button
                      key={ta.id}
                      onClick={() => assignProctor(ta.id)}
                      className="w-full p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/60 border border-slate-600/30 transition-all text-left group"
                    >
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{ta.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                             ta.recommendation === 'highly_recommended' ? 'bg-emerald-500/20 text-emerald-400' :
                             ta.recommendation === 'recommended' ? 'bg-indigo-500/20 text-indigo-400' :
                             'bg-slate-600/30 text-slate-400'
                          }`}>
                             {(ta.fairnessScore * 100).toFixed(0)}% Match
                          </span>
                       </div>
                       <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span>current workload: {ta.currentWorkload}</span>
                          {ta.recentHeavyAssignments > 0 && (
                             <span className="text-amber-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Heavy Assignment
                             </span>
                          )}
                       </div>
                    </button>
                  ))
               )}
            </div>
          </div>
        </div>
      )}

      {editingQuiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 scale-80 rounded-xl max-w-2xl w-full max-h-[110vh] overflow-y-auto shadow-2xl border border-slate-700">
             <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800 sticky top-0 z-10">
              <h2 className="text-lg font-bold text-white">Edit Quiz</h2>
              <button onClick={() => setEditingQuiz(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 ">
               <QuizForm 
                 editQuiz={editingQuiz}
                 onSuccess={() => { setEditingQuiz(null); loadQuizzes(); }}
                 onCancel={() => setEditingQuiz(null)}
               />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
