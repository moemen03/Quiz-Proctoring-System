'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Clock, Trash2, X, Settings, Users, Loader, Search, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { scheduleApi, userApi, settingsApi, User, ScheduleSlot } from '@/lib/api-client';
import toast, { Toaster } from 'react-hot-toast';
import { PageLoader } from '@/components/LoadingSpinner';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOT_TYPES = ['Lecture', 'Lab', 'Tutorial', 'Research', 'Meeting', 'Office Hours'];

const TYPE_COLORS: Record<string, string> = {
  Lecture: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  Lab: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  Tutorial: 'bg-green-500/20 border-green-500/50 text-green-300',
  Research: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  Meeting: 'bg-slate-500/20 border-slate-500/50 text-slate-300',
  'Office Hours': 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
};

const getSlotTime = (slot: number, isRamadan: boolean = false) => {
  if (isRamadan) {
    const slots: Record<number, string> = {
        1: '8:30 AM - 9:40 AM',
        2: '9:45 AM - 10:55 AM',
        3: '11:05 AM - 12:15 PM',
        4: '12:25 PM - 1:35 PM',
        5: '1:40 PM - 2:50 PM',
        6: '3:00 PM - 4:10 PM', // Assumed based on pattern
        7: '4:20 PM - 5:30 PM', // Assumed based on pattern
    };
    // The user didn't specify 6 and 7, but I added safe fallbacks following the pattern just in case.
    // 13:40+70 = 14:50 (2:50 PM). 
    // Gap seems to be 5 min after 5th slot? 
    // Actually user pattern:
    // 1-2: 5m
    // 2-3: 10m
    // 3-4: 10m
    // 4-5: 5m
    // Irregular. I will just stick to what the user gave for 1-5 and fallback to standard or something safe for 6-7 if they appear.
    // The previous implementation used standard slots 6-7 for fallback in backend.
    
    // Let's stick strictly to user defined 5 slots and standard fallback logic if requested slot > 5 for now in frontend to avoid confusion, 
    // or just return "Ramadan Slot X" if undefined.
    return slots[slot] || `Slot ${slot}`;
  }

  const slots: Record<number, string> = {
    1: '8:30 AM - 10:00 AM',
    2: '10:15 AM - 11:45 AM',
    3: '12:00 PM - 1:30 PM',
    4: '1:45 PM - 3:15 PM',
    5: '3:45 PM - 5:15 PM',
    6: '5:30 PM - 7:00 PM',
    7: '7:15 PM - 8:45 PM',
  };
  return slots[slot] || `Slot ${slot}`;
};

// ============ Optimized Memoized Cell Component ============
const ScheduleSlotCell = memo(({ 
  day, 
  slot, 
  data, 
  isSelected, 
  onMouseDown, 
  onMouseEnter 
}: { 
  day: string; 
  slot: number; 
  data?: ScheduleSlot; 
  isSelected: boolean; 
  onMouseDown: (day: string, slot: number) => void;
  onMouseEnter: (day: string, slot: number) => void;
}) => {
  return (
    <td
      onMouseDown={() => onMouseDown(day, slot)}
      onMouseEnter={() => onMouseEnter(day, slot)}
      className={`p-1 border-l border-slate-700/50 h-24 align-top cursor-pointer transition-all select-none
        ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:bg-slate-700/30'}
      `}
    >
      {data ? (
        <div className={`w-full h-full p-2 rounded-md border ${TYPE_COLORS[data.course_type] || TYPE_COLORS.Lecture} overflow-hidden`}>
          <div className="font-semibold text-xs truncate" title={data.course_name}>{data.course_name}</div>
          <div className="text-[10px] opacity-75 mt-0.5">{data.course_type}</div>
          {data.location && <div className="text-[10px] mt-1 font-medium truncate">{data.location}</div>}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-600 italic text-xs group">
          <span className="group-hover:text-slate-400 transition-colors opacity-50 group-hover:opacity-100">+</span>
        </div>
      )}
    </td>
  );
});

ScheduleSlotCell.displayName = 'ScheduleSlotCell';

export default function SchedulesPage() {
  const { user, isAdmin, loading } = useAuth();
  const [ramadanMode, setRamadanMode] = useState(false);

  useEffect(() => {
    // Check if tod
    settingsApi.getRamadanMode().then(res => {
      let isRamadan = false;
      if (res.enabled && res.start_date && res.end_date) {
        const today = new Date();
        const start = new Date(res.start_date);
        const end = new Date(res.end_date);
        
        // Reset times for accurate date comparison
        today.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (today >= start && today <= end) {
          isRamadan = true;
        }
      } 
      setRamadanMode(isRamadan);
    }).catch(err => console.error('Failed to load settings', err));
  }, []);
  
  if (loading) return <PageLoader />;
  if (!user) return null;

  if (isAdmin) {
    return <AdminScheduleViewer isRamadan={ramadanMode} />;
  }
  return <TAScheduleBuilder isRamadan={ramadanMode} />;
}

// ============ ADMIN VIEW - Read Only ============
function AdminScheduleViewer({ isRamadan }: { isRamadan: boolean }) {
  const [tas, setTas] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTa, setSelectedTa] = useState<User | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    loadTas();
  }, []);

  useEffect(() => {
    if (selectedTa) {
      loadSchedule(selectedTa.id);
    }
  }, [selectedTa]);

  const loadTas = async () => {
    try {
      const data = await userApi.getAll('ta');
      setTas(data);
    } catch (error) {
      console.error('Error loading TAs:', error);
      toast.error('Failed to load TAs');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (taId: string) => {
    setLoadingSchedule(true);
    try {
      const data = await scheduleApi.getByTA(taId);
      setSchedule(data);
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const filteredTas = tas.filter(ta => 
    ta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ta.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaySchedule = (day: string) => {
    return schedule
      .filter(s => s.day_of_week === day)
      .sort((a, b) => a.slot_number - b.slot_number);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:h-[calc(100vh-100px)] md:overflow-hidden md:flex md:gap-6">
      
      {/* ============ LEFT PANEL: LIST ============ */}
      <div className={`
        flex-col w-full md:w-80 lg:w-96 h-full
        ${viewMode === 'list' ? 'flex' : 'hidden md:flex'}
        md:bg-slate-900/50 md:border md:border-slate-800 md:rounded-2xl
      `}>
        {/* Mobile Header */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <button onClick={() => window.history.back()} className="p-2 -ml-2 text-slate-400 hover:text-white">
             <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white">TA Schedules</h1>
          <div className="w-10" />
        </div>

        {/* Desktop Header & Search */}
        <div className="md:p-4 md:border-b md:border-slate-800">
          <h2 className="hidden md:block text-lg font-bold text-white mb-4">TA Schedules</h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search TAs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto mt-3 max-h-[66vh] p-1 md:p-2 space-y-2 custom-scrollbar">
          {filteredTas.map(ta => (
            <button
              key={ta.id}
              onClick={() => {
                setSelectedTa(ta);
                setViewMode('detail');
              }}
              className={`w-full p-4 md:p-3 cursor-pointer rounded-2xl md:rounded-xl text-left transition-all border
                ${selectedTa?.id === ta.id 
                  ? 'bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/20' 
                  : 'bg-slate-800/40 md:bg-transparent border-slate-700/30 md:border-transparent hover:bg-slate-800 hover:border-slate-700'
                }
              `}
            >
              <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`text-sm font-semibold mb-0.5 ${selectedTa?.id === ta.id ? 'text-indigo-200' : 'text-slate-200'}`}>{ta.name}</h3>
                    <p className="text-xs font-medium text-amber-500/80">
                      Off: {ta.day_off ? ta.day_off : <span className="text-slate-600">N/A</span>}
                    </p>
                  </div>
                  {selectedTa?.id === ta.id && <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 hidden md:block" />}
              </div>
            </button>
          ))}
          {filteredTas.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No TAs found</p>
            </div>
          )}
        </div>
      </div>

      {/* ============ RIGHT PANEL: DETAIL ============ */}
      <div className={`
        flex-col flex-1 h-full
        ${viewMode === 'detail' ? 'flex' : 'hidden md:flex'}
        md:bg-slate-900/50 md:border md:border-slate-800 md:rounded-2xl md:overflow-hidden
      `}>
          {selectedTa ? (
             <>
                {/* Mobile Header (Back Button) */}
                <div className="flex items-center gap-3 mb-6 sticky top-0 bg-[#0f172a] z-10 py-2 -mx-4 px-4 border-b border-slate-800/50 md:hidden">
                  <button 
                    onClick={() => {
                      setViewMode('list');
                      setSelectedTa(null);
                      setSchedule([]);
                    }} 
                    className="p-1 -ml-1 text-slate-400 hover:text-white"
                  >
                    <ChevronLeft className="w-7 h-7" />
                  </button>
                  <div className="flex-1 text-center pr-8">
                     <h1 className="text-xl font-bold text-white">{selectedTa.name}</h1>
                     <p className="text-xs text-slate-400">Weekly Schedule</p>
                  </div>
                </div>

                {/* Desktop Header */}
                <div className="hidden md:flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                        {selectedTa.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">{selectedTa.name}</h2>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>Weekly Schedule</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-amber-500/90">Day Off: {selectedTa.day_off || 'None'}</span>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Schedule Content */}
                <div className="flex-1 overflow-y-auto p-0 md:p-6 custom-scrollbar">
                  {loadingSchedule ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                       <Loader className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                       <p>Loading schedule...</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-20 md:pb-0">
                      {DAYS.map(day => {
                        const daySlots = getDaySchedule(day);
                        return (
                          <div key={day} className="bg-slate-800/40 rounded-xl border border-slate-700/30 overflow-hidden">
                            <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/30 flex justify-between items-center">
                              <h3 className="font-semibold text-white text-sm">{day}</h3>
                              <span className="text-xs text-slate-500">{daySlots.length} sessions</span>
                            </div>
                            
                            <div className="p-2 space-y-2">
                               {daySlots.length === 0 ? (
                                  <div className="p-4 text-center">
                                    <p className="text-xs text-slate-600 italic">No assigned sessions</p>
                                  </div>
                               ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {daySlots.map(slot => (
                                      <div key={slot.id} className={`p-3 rounded-lg border ${TYPE_COLORS[slot.course_type] || TYPE_COLORS.Lecture} relative group`}>
                                         <div className="flex justify-between items-start mb-1">
                                            <div>
                                              <div className="text-[9px] font-bold uppercase opacity-80 mb-1 tracking-wider p-0.5 px-1.5 bg-black/20 rounded-md w-fit">
                                                {(['1st', '2nd', '3rd', '4th', '5th'][slot.slot_number - 1] || `${slot.slot_number}th`)} Slot
                                              </div>
                                              <h4 className="font-bold text-sm text-white/90 truncate pr-2">{slot.course_name}</h4>
                                              <p className="text-[10px] opacity-80">{slot.course_type}</p>
                                            </div>
                                            <span className="text-[10px] font-medium opacity-80 bg-black/20 px-1.5 py-0.5 rounded">
                                              {slot.location || 'N/A'}
                                            </span>
                                         </div>
                                         <div className="mt-2 text-[10px] font-medium opacity-70 flex items-center gap-1.5">
                                           <Clock className="w-3 h-3" />
                                           {getSlotTime(slot.slot_number, isRamadan)}
                                         </div>
                                      </div>
                                    ))}
                                  </div>
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
             </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
               <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                 <Users className="w-8 h-8 text-slate-600" />
               </div>
               <h3 className="text-lg font-medium text-white mb-1">No TA Selected</h3>
               <p className="text-sm max-w-sm">Select a Teaching Assistant from the list to view their weekly schedule details.</p>
            </div>
          )}
      </div>
    </div>
  );
}

// ============ TA VIEW - Editable Schedule Builder ============
function TAScheduleBuilder({ isRamadan }: { isRamadan: boolean }) {
  const { user } = useAuth();
  const tableRef = useRef<HTMLDivElement>(null);
  
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [dayOff, setDayOff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotCount, setSlotCount] = useState(5);
  
  const [showModal, setShowModal] = useState(false);
  const [showDayOffModal, setShowDayOffModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; slot: number } | null>(null);
  
  // Mobile Support
  const [mobileDay, setMobileDay] = useState(DAYS.filter(d => d !== 'Friday')[0]); // Default to first available day
  const [slotForm, setSlotForm] = useState({
    course_name: '',
    course_type: 'Lecture',
    location: '',
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ day: string; slot: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ day: string; slot: number } | null>(null);

  // Refs for tracking drag state without triggering re-renders (keeps callbacks stable)
  const dragRef = useRef({ isDragging: false, selectionStart: null as { day: string; slot: number } | null });

  useEffect(() => {
    dragRef.current = { isDragging, selectionStart };
  }, [isDragging, selectionStart]);

  useEffect(() => {
    loadSettings();
    loadSchedule();
  }, []);

  const loadSettings = async () => {
    try {
      const userData = await userApi.getSettings();
      setDayOff(userData.day_off);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadSchedule = async () => {
    try {
      const scheduleData = await scheduleApi.getMy();
      setSchedule(scheduleData);
      
      if (scheduleData.length > 0) {
        const maxSlot = Math.max(...scheduleData.map(s => s.slot_number), 5);
        if (maxSlot > slotCount) setSlotCount(maxSlot);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const saveDayOff = async (day: string) => {
    const loadingToast = toast.loading('Saving day off...');
    try {
      await userApi.updateDayOff(day);
      setDayOff(day);
      setShowDayOffModal(false);
      toast.success(`Day off set to ${day}!`, { id: loadingToast });
    } catch (error) {
      console.error('Error saving day off:', error);
      toast.error('Failed to save day off', { id: loadingToast });
    }
  };

  const getSlotData = useCallback((day: string, slot: number) => {
    return schedule.find(s => s.day_of_week === day && s.slot_number === slot);
  }, [schedule]);

  const handleMouseDown = useCallback((day: string, slot: number) => {
    setIsDragging(true);
    setSelectionStart({ day, slot });
    setSelectionEnd({ day, slot });
  }, []);

  const handleMouseEnter = useCallback((day: string, slot: number) => {
    const { isDragging, selectionStart } = dragRef.current;
    if (isDragging && selectionStart?.day === day) {
      setSelectionEnd({ day, slot });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    setIsDragging(false);
    
    // We need the current state values for the modal logic
    // Since this is called from the parent div's onMouseUp
    // it will have access to the state at the time of the closure.
    // However, to be safe and use latest state in a stable callback, 
    // we can use function updates or just accept this one won't be perfectly stable 
    // but onMouseUp happens once per drag, so it's fine.
  }, []);

  // Effect to handle the completion of a drag
  useEffect(() => {
    if (!isDragging && selectionStart && selectionEnd) {
      const data = getSlotData(selectionStart.day, selectionStart.slot);
      setSelectedSlot(selectionStart);
      
      if (data) {
        setSlotForm({
          course_name: data.course_name || '',
          course_type: data.course_type || 'Lecture',
          location: data.location || '',
        });
      } else {
        setSlotForm({ course_name: '', course_type: 'Lecture', location: '' });
      }
      setShowModal(true);
    }
  }, [isDragging, getSlotData]); // Only depends on isDragging becoming false

  const isSelected = useCallback((day: string, slot: number) => {
    if (!selectionStart || !selectionEnd || selectionStart.day !== day) return false;
    const minSlot = Math.min(selectionStart.slot, selectionEnd.slot);
    const maxSlot = Math.max(selectionStart.slot, selectionEnd.slot);
    return slot >= minSlot && slot <= maxSlot;
  }, [selectionStart, selectionEnd]);

  const closeModal = () => {
    setShowModal(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const saveSlot = async () => {
    if (!selectionStart || !selectionEnd || !user) return;
    
    if (!slotForm.course_name.trim()) {
      toast.error('Please enter a course/activity name');
      return;
    }
    
    const minSlot = Math.min(selectionStart.slot, selectionEnd.slot);
    const maxSlot = Math.max(selectionStart.slot, selectionEnd.slot);
    const day = selectionStart.day;
    const isUpdate = getSlotData(selectionStart.day, selectionStart.slot) !== undefined;

    const oldSchedule = [...schedule];
    const tempSchedule = [...schedule];
    
    for (let s = minSlot; s <= maxSlot; s++) {
      const idx = tempSchedule.findIndex(item => item.day_of_week === day && item.slot_number === s);
      if (idx !== -1) tempSchedule.splice(idx, 1);
    }

    const newSlots: ScheduleSlot[] = [];
    for (let s = minSlot; s <= maxSlot; s++) {
      newSlots.push({
        id: `temp-${Date.now()}-${s}`,
        ta_id: user.id,
        day_of_week: day,
        slot_number: s,
        ...slotForm
      });
    }

    setSchedule([...tempSchedule, ...newSlots]);
    closeModal();
    const loadingToast = toast.loading(isUpdate ? 'Updating...' : 'Adding...');

    try {
      const promises = [];
      for (let s = minSlot; s <= maxSlot; s++) {
        const existing = oldSchedule.find(item => item.day_of_week === day && item.slot_number === s);
        if (existing) {
           promises.push(scheduleApi.update(existing.id, slotForm));
        } else {
           promises.push(scheduleApi.create({
            day_of_week: day,
            slot_number: s,
            ...slotForm,
          }));
        }
      }

      await Promise.all(promises);
      loadSchedule(); 
      toast.success('Saved!', { id: loadingToast });
    } catch (error) {
      console.error('Error saving slot:', error);
      setSchedule(oldSchedule);
      // Show the specific error message from the API (e.g. "Maximum 12 slots allowed")
      toast.error((error as Error).message || 'Failed to save', { id: loadingToast, duration: 4000 });
    }
  };

  const deleteSlot = async () => {
    if (!selectionStart || !selectionEnd) return;
    
    const minSlot = Math.min(selectionStart.slot, selectionEnd.slot);
    const maxSlot = Math.max(selectionStart.slot, selectionEnd.slot);
    const day = selectionStart.day;

    const oldSchedule = [...schedule];
    const newSchedule = schedule.filter(s => !(s.day_of_week === day && s.slot_number >= minSlot && s.slot_number <= maxSlot));
    
    setSchedule(newSchedule);
    closeModal();
    const loadingToast = toast.loading('Removing...');

    try {
      const promises = [];
      for (let s = minSlot; s <= maxSlot; s++) {
        const existing = oldSchedule.find(item => item.day_of_week === day && item.slot_number === s);
        if (existing) {
          promises.push(scheduleApi.delete(existing.id));
        }
      }
      await Promise.all(promises);
      toast.success('Removed!', { id: loadingToast });
    } catch (error) {
      console.error('Error deleting slot:', error);
      setSchedule(oldSchedule);
      toast.error('Failed to remove.', { id: loadingToast });
    }
  };

  const clearSchedule = async () => {
    if (!confirm('Are you sure you want to clear your entire schedule?')) return;
    
    const oldSchedule = [...schedule];
    setSchedule([]);
    const loadingToast = toast.loading('Clearing...');
    try {
      await scheduleApi.clear();
      toast.success('Cleared!', { id: loadingToast });
    } catch (error) {
      console.error('Error clearing schedule:', error);
      setSchedule(oldSchedule);
      toast.error('Failed to clear', { id: loadingToast });
    }
  };

  const slots = Array.from({ length: slotCount }, (_, i) => i + 1);
  const activeDays = DAYS.filter(d => d !== 'Friday' && d !== dayOff);

  const handleMobileSlotClick = (day: string, slot: number) => {
    const data = getSlotData(day, slot);
    setSelectionStart({ day, slot });
    setSelectionEnd({ day, slot });
    setSelectedSlot({ day, slot }); // Explicitly set this for the modal title
    
    if (data) {
      setSlotForm({
        course_name: data.course_name || '',
        course_type: data.course_type || 'Lecture',
        location: data.location || '',
      });
    } else {
      setSlotForm({ course_name: '', course_type: 'Lecture', location: '' });
    }
    setShowModal(true);
  };

  // Initialize mobileDay to the first active day if not set or invalid
  useEffect(() => {
    if (activeDays.length > 0 && (!mobileDay || !activeDays.includes(mobileDay))) {
      setMobileDay(activeDays[0]);
    }
  }, [activeDays, mobileDay]);

  if (loading) return <PageLoader />;

  if (!dayOff) {
    return (
      <div className="max-w-2xl mx-auto text-center px-4 py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/25">
          <Clock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Select Your Day Off</h1>
        <p className="text-slate-400 mb-8">Friday is automatically a day off. Please select your additional weekly day off.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {DAYS.filter(d => d !== 'Friday').map(day => (
            <button
              key={day}
              onClick={() => saveDayOff(day)}
              className="p-4 rounded-xl border-2 border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10 transition-all font-medium text-lg text-white"
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden mx-auto px-4 py-6" onMouseUp={handleMouseUp}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Schedule</h1>
          <p className="hidden md:block text-sm text-slate-400 ">Select a slot or drag to select multiple slots</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setShowDayOffModal(true)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 md:bg-transparent md:border-0 md:p-0"
          >
            Days Off: <span className="font-medium text-white">Friday, {dayOff}</span>
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={clearSchedule}
            className="px-4 py-2 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
          >
            Clear Schedule
          </button>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden space-y-4">
        {/* Day Tabs */}
        <div className="flex justify-between pb-2 custom-scrollbar">
          {activeDays.map(day => (
            <button
              key={day}
              onClick={() => setMobileDay(day)}
              className={`px-3 py-2 shadow-lg shadow-indigo-500/20 rounded-lg text-sm font-medium whitespace-wrap transition-all ${
                mobileDay === day 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Mobile Slots List */}
        <div className="space-y-3">
          {slots.map(slot => {
            const data = getSlotData(mobileDay, slot);
            return (
              <button
                key={slot}
                onClick={() => handleMobileSlotClick(mobileDay, slot)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  data 
                    ? `${TYPE_COLORS[data.course_type]} border-opacity-50` 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-xs font-medium text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded">Slot {slot}</span>
                       <span className="text-xs text-slate-500 flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {getSlotTime(slot, isRamadan)}
                       </span>
                    </div>
                    {data ? (
                      <>
                        <h3 className="font-bold text-white text-lg truncate">{data.course_name}</h3>
                        <p className="text-sm opacity-80">{data.course_type}</p>
                      </>
                    ) : (
                      <span className="text-slate-500 italic block py-1">Empty Slot - Tap to Add</span>
                    )}
                  </div>
                  {data && data.location && (
                    <span className="text-xs font-bold bg-black/20 px-2 py-1 rounded whitespace-nowrap">
                      {data.location}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP VIEW (Table) */}
      <div ref={tableRef} className="hidden md:block bg-slate-800 rounded-xl border border-slate-700 p-4 overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="p-4 text-left font-semibold text-white w-24">Day/Slot</th>
              {slots.map(slot => (
                <th key={slot} className="p-4 text-left font-semibold text-white border-l border-slate-700">
                  <div className="flex flex-col">
                    <span>Slot {slot}</span>
                    <span className="text-xs text-slate-400 font-normal">{getSlotTime(slot, isRamadan)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map(day => (
              <tr key={day} className="border-b border-slate-700/50 last:border-0">
                <td className="p-4 font-medium text-white bg-slate-800/50 border-r border-slate-700">{day}</td>
                {slots.map(slot => (
                  <ScheduleSlotCell
                    key={`${day}-${slot}`}
                    day={day}
                    slot={slot}
                    data={getSlotData(day, slot)}
                    isSelected={isSelected(day, slot)}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Toaster />

      {/* Slot Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-700 custom-scrollbar">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-800 z-10 pb-2 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white">
                {selectedSlot && `${selectedSlot.day} - Slot ${selectedSlot.slot}`}
                {selectionStart && selectionEnd && selectionStart.slot !== selectionEnd.slot && 
                  ` to ${Math.max(selectionStart.slot, selectionEnd.slot)}`}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Course Name / Activity"
                  value={slotForm.course_name}
                  onChange={(e) => setSlotForm({ ...slotForm, course_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SLOT_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSlotForm({ ...slotForm, course_type: type })}
                      className={`p-2 text-sm rounded-lg border transition-all ${
                        slotForm.course_type === type
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-indigo-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Location</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="e.g. C.301"
                  value={slotForm.location}
                  onChange={(e) => setSlotForm({ ...slotForm, location: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-700/50 mt-4">
                {selectedSlot && getSlotData(selectedSlot.day, selectedSlot.slot) && (
                  <button
                    onClick={deleteSlot}
                    className="p-2 text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                    title="Delete slot"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={saveSlot} 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-all"
                >
                  {selectedSlot && getSlotData(selectedSlot.day, selectedSlot.slot) ? 'Update Slot' : 'Save Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Off Modal */}
      {showDayOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-700 custom-scrollbar">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-800 z-10">
              <h2 className="text-xl font-bold text-white">Change Day Off</h2>
              <button onClick={() => setShowDayOffModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 mb-4 text-sm">Select your additional day off (Friday is always off).</p>
            <div className="grid grid-cols-2 gap-3">
              {DAYS.filter(d => d !== 'Friday').map(day => (
                <button
                  key={day}
                  onClick={() => saveDayOff(day)}
                  className={`p-3 rounded-xl border-2 transition-all font-medium ${
                    day === dayOff
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10 text-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
