'use client';

import { useState, useEffect } from 'react';
import { 
    LayoutDashboard, 
    Bell, 
    Check, 
    X, 
    UserPlus, 
    Users, 
    Calendar,
    ArrowRight,
    Search,
    Loader,
    Clock,
    Moon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/LoadingSpinner';
import { exchangeApi, assignmentApi, notificationApi, settingsApi, ExchangeRequest, TASuggestion, Notification } from '@/lib/api-client';
import confetti from 'canvas-confetti';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [requests, setRequests] = useState<ExchangeRequest[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Assign Modal State
    const [selectedRequest, setSelectedRequest] = useState<ExchangeRequest | null>(null);
    const [suggestions, setSuggestions] = useState<TASuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

    const [notificationError, setNotificationError] = useState<string | null>(null);
    const [ramadanMode, setRamadanMode] = useState(false);
    const [showRamadanModal, setShowRamadanModal] = useState(false);
    const [ramadanDates, setRamadanDates] = useState({ start: '', end: '' });

    useEffect(() => {
        if (!authLoading) {
            if (!isAdmin) {
                router.push('/quizzes');
                return;
            }
            loadData();
        }
    }, [authLoading, isAdmin, router, viewMode]);

    const loadData = async () => {
        setLoading(true);
        setNotificationError(null);
        try {
            // Load requests separately to ensure main dashboard functionality always works
            const reqs = await exchangeApi.getAll(viewMode);
            setRequests(reqs);

            try {
                const notifs = await notificationApi.getAll(true); // Get only unread notifications
                // Filter out invalid notifications
                const validNotifs = notifs.filter(n => n.id && n.id !== 'undefined');
                console.log('Loaded notifications:', validNotifs);
                setNotifications(validNotifs);
            } catch (error) {
                console.error('Failed to load notifications:', error);
                setNotificationError('Failed to load alerts');
            }
            loadSettings();
        } catch (error) {
            console.error('Failed to load requests:', error);
            toast.error('Failed to load exchange requests');
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const { enabled, start_date, end_date } = await settingsApi.getRamadanMode();
            setRamadanMode(enabled);
            if (start_date && end_date) {
                setRamadanDates({ start: start_date, end: end_date });
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    };

    const handleRamadanToggle = () => {
        if (!ramadanMode) {
            // Enabling: Show modal
            setShowRamadanModal(true);
        } else {
            // Disabling: Direct API call
            toggleRamadanMode(false);
        }
    };

    const toggleRamadanMode = async (enabled: boolean, dates?: { start: string, end: string }) => {
        setRamadanMode(enabled); // Optimistic
        try {
            await settingsApi.setRamadanMode(enabled, dates?.start, dates?.end);
            toast.success(`Ramadan Mode ${enabled ? 'Enabled' : 'Disabled'}`);
            setShowRamadanModal(false);
            if (dates) setRamadanDates(dates);
            
            if (enabled) {
                const duration = 3 * 1000;
                const animationEnd = Date.now() + duration;
                const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

                const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                const interval: any = setInterval(function() {
                    const timeLeft = animationEnd - Date.now();

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    const particleCount = 50 * (timeLeft / duration);
                    // since particles fall down, start a bit higher than random
                    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#fbbf24', '#10b981'] });
                    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#fbbf24', '#10b981'] });
                }, 250);
            }
        } catch (e) {
            setRamadanMode(!enabled);
            toast.error('Failed to update setting');
        }
    };

    const processMarkRead = async (id: string) => {
        console.log('processMarkRead called', id);
        if (!id || id === 'undefined' || id.includes('undefined')) return;
        try {
            await notificationApi.markRead(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Failed to mark read', error);
        }
    };

    const handleMarkAllRead = async (category?: 'schedule' | 'system') => {
        // ... (existing code, ensure it calls notificationApi explicitly or keep helper)
        try {
            await notificationApi.markAllRead(category);
            // ... (rest of logic)
            if (category === 'schedule') {
                setNotifications(prev => prev.filter(n => n.type !== 'schedule_change'));
            } else if (category === 'system') {
                setNotifications(prev => prev.filter(n => n.type === 'schedule_change'));
            } else {
                setNotifications([]);
            }
            toast.success('Notifications marked as read');
        } catch (error) {
            toast.error('Failed to mark notifications as read');
        }
    };



    const handleOpenAssignModal = async (req: ExchangeRequest) => {
        setSelectedRequest(req);
        setLoadingSuggestions(true);
        try {
            // Fetch suggestions based on the quiz ID
            const res = await assignmentApi.getSuggestions(req.assignments!.quiz_id);
            setSuggestions(res.suggestions);
        } catch (error) {
            toast.error('Failed to load TA suggestions');
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleAssign = async (newTaId: string) => {
        if (!selectedRequest) return;
        try {
            await exchangeApi.approve(selectedRequest.id, newTaId);
            toast.success('Request approved and TA assigned');
            setSelectedRequest(null);
            setSuggestions([]);
            loadData(); 
        } catch (error) {
            toast.error((error as Error).message);
        }
    };

    if (authLoading) return <PageLoader />;

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
            <Toaster position="top-center" />
            
            <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
                    <p className="text-slate-400">Overview and pending actions</p>
                </div>

                <button
                    onClick={handleRamadanToggle}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        ramadanMode 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                    }`}
                >
                    <Moon className="w-4 h-4" />
                    <span className="font-medium text-sm">Ramadan Vibes</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors relative ${
                        ramadanMode ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                            ramadanMode ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                    </div>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* System Alerts Panel */}
                <div className={`border rounded-xl overflow-hidden flex flex-col ${
                    notificationError ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                    <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
                        notificationError ? 'border-red-500/20 bg-red-500/5' : 'border-amber-500/20 bg-amber-500/5'
                    }`}>
                        <div className="flex items-center gap-3">
                            <Bell className={`w-5 h-5 ${notificationError ? 'text-red-500' : 'text-amber-500'}`} />
                            <h2 className="text-lg font-semibold text-white">System Alerts</h2>
                            {!notificationError && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold">
                                    {notifications.filter(n => n.type !== 'schedule_change').length}
                                </span>
                            )}
                        </div>
                        {!notificationError && notifications.some(n => n.type !== 'schedule_change') && (
                            <button 
                                onClick={() => handleMarkAllRead('system')}
                                className="text-xs text-amber-400 hover:text-amber-300 underline whitespace-nowrap ml-2"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                        {notificationError ? (
                        <div className="p-4 text-red-400 text-sm flex items-center gap-2">
                            <X className="w-4 h-4" />
                            {notificationError}
                            <button onClick={loadData} className="ml-4 underline hover:text-red-300">Retry</button>
                        </div>
                        ) : (
                            <div className="divide-y divide-amber-500/10">
                                {notifications.filter(n => n.type !== 'schedule_change').length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 italic text-sm">
                                        No system alerts
                                    </div>
                                ) : (
                                    notifications
                                        .filter(n => n.type !== 'schedule_change' && n.id && n.id !== 'undefined')
                                        .map(notif => (
                                        <div key={notif.id} className="p-4 flex items-start justify-between gap-4">
                                            <div className="flex gap-3">
                                                <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                <div>
                                                    <p className="text-sm text-slate-200">{notif.message}</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {new Date(notif.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => processMarkRead(notif.id)}
                                                className="p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded shrink-0"
                                                title="Mark as read"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Schedule Updates Panel */}
                <div className="border border-blue-500/20 bg-blue-500/10 rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-blue-500/20 bg-blue-500/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-blue-500" />
                            <h2 className="text-lg font-semibold text-white">Schedule Updates</h2>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold">
                                {notifications.filter(n => n.type === 'schedule_change').length}
                            </span>
                        </div>
                        {notifications.some(n => n.type === 'schedule_change') && (
                            <button 
                                onClick={() => handleMarkAllRead('schedule')}
                                className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap ml-2"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar divide-y divide-blue-500/10">
                        {notifications.filter(n => n.type === 'schedule_change').length === 0 ? (
                            <div className="p-8 text-center text-slate-500 italic text-sm">
                                No schedule updates
                            </div>
                        ) : (
                            notifications
                                .filter(n => n.type === 'schedule_change' && n.id && n.id !== 'undefined')
                                .map(notif => (
                                <div key={notif.id} className="p-4 flex items-start justify-between gap-4">
                                    <div className="flex gap-3">
                                        <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-sm text-slate-200">{notif.message}</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(notif.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => processMarkRead(notif.id)}
                                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded shrink-0"
                                        title="Mark as read"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>


            {/* Exchange Requests Panel */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {/* ... (rest of UI remains same) ... */}
                <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-indigo-500" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Exchange Requests</h2>
                    </div>
                    
                    {/* View Toggles */}
                    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50 self-start sm:self-auto">
                        <button
                            onClick={() => setViewMode('pending')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                viewMode === 'pending' 
                                    ? 'bg-indigo-500 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                viewMode === 'history' 
                                    ? 'bg-slate-700 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            History
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-slate-700/50 min-h-[200px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-full py-12">
                            <PageLoader />
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <Check className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No {viewMode} requests found.</p>
                        </div>
                    ) : (
                        requests.map((req) => (
                            <div key={req.id} className="p-4 hover:bg-slate-700/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                                            req.status === 'approved' ? 'bg-emerald-500' :
                                            req.status === 'rejected' ? 'bg-red-500' :
                                            'bg-amber-500'
                                        }`} />
                                        <span className="text-white font-medium">{req.original_ta?.name}</span>
                                        <ArrowRight className="w-4 h-4 text-slate-500" />
                                        <span className="text-slate-400 text-sm italic">
                                            {req.status === 'pending' ? 'Requesting exchange' : `Request ${req.status}`}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {req.assignments?.quizzes?.course_name}
                                        </span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="w-full sm:w-auto block sm:inline">{req.assignments?.quizzes?.date} @ {req.assignments?.quizzes?.start_time}</span>
                                    </div>
                                    {req.reason && (
                                        <p className="text-xs text-slate-500 mt-2 bg-slate-900/30 p-2 rounded border border-slate-700/30 inline-block">
                                            "{req.reason}"
                                        </p>
                                    )}
                                </div>

                                {viewMode === 'pending' && (
                                    <button
                                        onClick={() => handleOpenAssignModal(req)}
                                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20 mt-2 md:mt-0"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Assign Replacement
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Assignment Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-700 mx-auto">
                        <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-700">
                            <div>
                                <h2 className="text-lg font-bold text-white">Select Replacement</h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Original TA will receive <strong>+0.5 workload penalty</strong>
                                </p>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-white p-1 -mr-2">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
                            {loadingSuggestions ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                    <Loader className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                                    <p className="text-sm">Finding best matches...</p>
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="p-4 text-center text-slate-500">
                                    No available TAs found.
                                </div>
                            ) : (
                                suggestions.map((ta) => (
                                    <button
                                        key={ta.id}
                                        onClick={() => handleAssign(ta.id)}
                                        disabled={ta.id === selectedRequest.original_ta_id}
                                        className={`w-full p-3 rounded-lg border transition-all text-left group ${
                                            ta.id === selectedRequest.original_ta_id 
                                            ? 'opacity-50 cursor-not-allowed bg-slate-800 border-slate-700'
                                            : 'bg-slate-700/30 hover:bg-slate-700/60 border-slate-600/30 hover:border-indigo-500/50'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                                                {ta.name} {ta.id === selectedRequest.original_ta_id && '(Original)'}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                ta.recommendation === 'highly_recommended' ? 'bg-emerald-500/20 text-emerald-400' :
                                                ta.recommendation === 'recommended' ? 'bg-indigo-500/20 text-indigo-400' :
                                                'bg-slate-600/30 text-slate-400'
                                            }`}>
                                                {(ta.fairnessScore * 100).toFixed(0)}% Match
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-slate-400">
                                            <span>Workload: {ta.currentWorkload.toFixed(1)} / {ta.targetWorkload}</span>
                                            {ta.recentHeavyAssignments > 0 && (
                                                <span className="text-amber-400">Has heavy tasks</span>
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Ramadan Date Modal */}
            {showRamadanModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-xl p-6 max-w-sm w-full border border-slate-700 shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-4">Enable Ramadan Mode</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                                <input 
                                    type="date" 
                                    value={ramadanDates.start}
                                    onChange={(e) => setRamadanDates({ ...ramadanDates, start: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                                <input 
                                    type="date" 
                                    value={ramadanDates.end}
                                    onChange={(e) => setRamadanDates({ ...ramadanDates, end: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button 
                                    onClick={() => setShowRamadanModal(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => {
                                        if (!ramadanDates.start || !ramadanDates.end) {
                                            toast.error('Please select both dates');
                                            return;
                                        }
                                        toggleRamadanMode(true, ramadanDates);
                                    }}
                                    className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-bold"
                                >
                                    Enable
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
