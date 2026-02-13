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
  AlertTriangle,
  Flag,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { quizApi, assignmentApi, exchangeApi, Quiz, TASuggestion } from '@/lib/api-client';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import { QuizForm } from '@/components/QuizForm';
import { AddToCalendarButton } from '@/components/AddToCalendarButton';

// Calculate required proctors based on capacity
const calculateProctorsForCapacity = (capacity: number): number => {
 if (capacity <= 25) return 2;
  if (capacity <= 40) return 3;
  if (capacity <= 65) return 4;
  if (capacity <= 100) return 5;
  return Math.ceil(capacity / 20); // For larger capacities
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
    
    // Close menus on click outside
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
    toast((t) => (
      <div className="flex flex-col gap-2">
        <p className="font-medium text-slate-800 ">
          Are you sure you want to delete this quiz?
        </p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await quizApi.delete(id);
                await loadQuizzes();
                toast.success('Quiz deleted successfully');
              } catch (error) {
                console.error('Error deleting quiz:', error);
                toast.error('Failed to delete quiz');
              }
            }}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 5000, id: 'delete-quiz-confirm' });
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

  // Calculate end time from start time + duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  // Dynamically determine quiz status based on current time
  const getQuizStatus = (quiz: Quiz): string => {
    const now = new Date();
    const [startHours, startMinutes] = quiz.start_time.split(':').map(Number);
    
    // Create quiz start datetime
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

  // Filter and Search Logic
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(quiz => {
      const matchesSearch = quiz.course_name.toLowerCase().includes(searchQuery.toLowerCase());
      const status = getQuizStatus(quiz);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      const assignedCount = quiz.assignments?.length || 0;
      // Calculate required proctors dynamically
      const requiredCount = quiz.locations?.reduce((total, loc) => {
        return total + calculateProctorsForCapacity(loc.capacity || 10);
      }, 0) || quiz.min_proctors || 1;
      
      const isIncomplete = assignedCount < requiredCount;
      const matchesIncomplete = showIncompleteOnly ? isIncomplete : true;

      return matchesSearch && matchesStatus && matchesIncomplete;
    });
  }, [quizzes, searchQuery, statusFilter, showIncompleteOnly]);

  // Group by Date for Display
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

  // Request Exchange State
  const [requestingExchange, setRequestingExchange] = useState<{ id: string, name: string } | null>(null);
  const [exchangeReason, setExchangeReason] = useState('');

  const handleRequestExchange = async () => {
    if (!requestingExchange) return;
    try {
      await exchangeApi.create({
        assignment_id: requestingExchange.id,
        reason: exchangeReason
      });
      toast.success('Exchange request sent! An admin will review it.');
      setRequestingExchange(null);
      setExchangeReason('');
      await loadQuizzes(); // Refresh to show pending status if needed (optional UI update)
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  // Check if current user has an assignment in this location
  const getUserAssignment = (assignments: any[]) => {
    return assignments.find(a => a.users?.email === user?.email);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Toaster position="top-center" />
      {/* Header & Tools */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Quizzes</h1>
          </div>
          <p className="text-slate-400 text-sm">Manage assignments and schedules</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ... existing search and filters ... */}
          <div className="relative grow sm:grow-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search Quiz"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800  border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-32 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 overflow-x-auto max-w-full">
            {['all', 'upcoming', 'started', 'finished'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
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
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all text-xs font-medium whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Quiz Add
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
                  
                  // Calculate required proctors by summing requirements of all locations
                  const requiredCount = quiz.locations?.reduce((total, loc) => {
                    return total + calculateProctorsForCapacity(loc.capacity || 10);
                  }, 0) || quiz.min_proctors || 1;

                  const progress = Math.min((assignedCount / requiredCount) * 100, 100);
                  const isComplete = assignedCount >= requiredCount;
                  const isInsufficient = assignedCount < requiredCount;
                  const status = getQuizStatus(quiz);
                  const badge = getStatusBadge(status);

                  return (
                    <div 
                      key={quiz.id} 
                      className={`relative rounded-xl transition-all duration-200 group border ${
                        activeMenuQuiz === quiz.id ? 'z-20 ring-1 ring-indigo-500/50' : 'z-0'
                      } ${
                        isInsufficient 
                          ? 'bg-red-950/20 border-red-500/40 hover:border-red-500/60 shadow-[0_0_15px_-5px_theme(colors.red.900)]' 
                          : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-4 pb-0">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-white text-lg truncate pr-2 w-full" title={quiz.course_name}>
                            {quiz.course_name}
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={badge.className}>{badge.label}</span>
                            
                            {isAdmin && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const res = await fetch(`/api/quizzes/${quiz.id}/notify`, { method: 'POST' });
                                    const data = await res.json();
                                    if (res.ok) {
                                      toast.success(`Notified ${data.count} proctors via email`);
                                    } else {
                                      toast.error(data.error || 'Failed to send notifications');
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    toast.error('Error sending notifications');
                                  }
                                }}
                                className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                                title="Notify Proctors via Email"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                              </button>
                            )}

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
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.nativeEvent.stopImmediatePropagation();
                                    console.log('Toggling menu for quiz:', quiz.id, 'Current active:', activeMenuQuiz);
                                    setActiveMenuQuiz(activeMenuQuiz === quiz.id ? null : quiz.id);
                                  }}
                                  className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-700 transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                
                                {activeMenuQuiz === quiz.id && (
                                  <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                                    <button 
                                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingQuiz(quiz);
                                        setActiveMenuQuiz(null);
                                      }}
                                    >
                                      <Edit className="w-3 h-3" /> Edit
                                    </button>
                                    <button 
                                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
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

                        {/* Proctor Progress */}
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

                      {/* Always Visible Locations */}
                      <div className="bg-slate-900/20 px-3 pb-3 pt-3 border-t border-slate-700/20 rounded-b-xl">
                          <div className="space-y-2">
                            {quiz.locations?.map((loc) => {
                              const locationAssignments = quiz.assignments?.filter(a => a.location_id === loc.id) || [];
                              const locRequired = calculateProctorsForCapacity(loc.capacity || 10);
                              const isLocFull = locationAssignments.length >= locRequired;
                              
                              // Check if current user is assigned here
                              const myAssignment = getUserAssignment(locationAssignments);

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
                                      
                                      {/* Request Exchange Button for Assigned TA */}
                                      {myAssignment && !isAdmin && (
                                        <div className="flex items-center gap-2">
                                            <AddToCalendarButton 
                                              quiz={quiz} 
                                              locationName={loc.name} 
                                              isHeadProctor={locationAssignments.length > 0 && locationAssignments[0].id === myAssignment.id}
                                            />
                                            <button
                                                onClick={() => setRequestingExchange({ id: myAssignment.id, name: quiz.course_name })}
                                                className="px-2 py-1 bg-amber-500/10 text-amber-400 text-[10px] rounded border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                                Request Exchange
                                            </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Assigned TAs List */}
                                  {locationAssignments.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pl-1 mt-3">
                                      {locationAssignments.map((a, index) => {
                                        const isFirst = index === 0;
                                        const isMe = a.users?.email === user?.email;
                                        
                                        return (
                                          <div 
                                            key={a.id} 
                                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[14px] border transition-colors ${
                                              isFirst 
                                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                                                : 'bg-slate-700/50 text-slate-300 border-slate-600/30'
                                            } ${isMe ? 'ring-1 ring-amber-500/50' : ''}`}
                                            title={isFirst ? "Head Proctor" : "Proctor"}
                                          >
                                            {isFirst && <Flag className={`w-3 h-3 ${isMe ? 'text-amber-400' : 'text-indigo-400'}`} fill={isMe ? "currentColor" : "none"} />}
                                            <span className="truncate max-w-[200px]">{a.users?.name.split(' ').slice(0, 2).join(' ')}</span>
                                            {isAdmin && (
                                              <button 
                                                className={`hover:text-red-400 ${isFirst ? 'text-indigo-400/70' : 'text-slate-500'}`}
                                                onClick={() => {
                                                  toast((t) => (
                                                    <div className="flex flex-col gap-2">
                                                      <p className="font-medium text-slate-800 dark:text-slate-500">
                                                        Remove proctor {a.users?.name}?
                                                      </p>
                                                      <div className="flex gap-2">
                                                        <button
                                                          onClick={() => {
                                                            toast.dismiss(t.id);
                                                            assignmentApi.delete(a.id).then(loadQuizzes);
                                                          }}
                                                          className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm transition-colors"
                                                        >
                                                          Remove
                                                        </button>
                                                        <button
                                                          onClick={() => toast.dismiss(t.id)}
                                                          className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded text-sm transition-colors"
                                                        >
                                                          Cancel
                                                        </button>
                                                      </div>
                                                    </div>
                                                  ), { duration: 5000, id: `remove-proctor-${a.id}` });
                                                }}
                                              >
                                                <X className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
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

      {/* Assignment Modal */}
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
                  suggestions.map((ta, index) => (
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

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 scale-80 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-700 custom-scrollbar">
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

      {/* Request Exchange Modal */}
      {requestingExchange && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="text-lg font-bold">Request Shift Exchange</h3>
                </div>
                
                <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                    You are requesting to be replaced for <span className="text-white font-medium">{requestingExchange.name}</span>.
                </p>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Warning: Proceeding with this exchange will add <strong>+0.5 points</strong> to your target workload penalty.</span>
                    </p>
                </div>

                <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">Reason (Optional)</label>
                    <textarea 
                        className="w-full bg-slate-800 border-slate-700 rounded-md text-sm text-white p-2 focus:ring-1 focus:ring-amber-500 outline-none"
                        rows={2}
                        placeholder="Why do you need to exchange?"
                        value={exchangeReason}
                        onChange={(e) => setExchangeReason(e.target.value)}
                    />
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setRequestingExchange(null)}
                        className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleRequestExchange}
                        className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors text-sm font-medium"
                    >
                        Confirm Request
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
