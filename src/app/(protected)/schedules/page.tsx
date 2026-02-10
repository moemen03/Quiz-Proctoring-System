'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, Trash2, X, Settings, Users, Loader } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { scheduleApi, userApi, User, ScheduleSlot } from '@/lib/api-client';
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

const getSlotTime = (slot: number) => {
  let startMinutes = 8 * 60 + 30 + (slot - 1) * (90 + 15);
  if (slot >= 5) startMinutes += 15;
  const endMinutes = startMinutes + 90;
  
  const formatTime = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
  };
  
  return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
};

export default function SchedulesPage() {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) return <PageLoader />;
  if (!user) return null;

  if (isAdmin) {
    return <AdminScheduleViewer />;
  }
  return <TAScheduleBuilder />;
}

// ============ ADMIN VIEW - Read Only ============
function AdminScheduleViewer() {
  const [tas, setTas] = useState<User[]>([]);
  const [selectedTa, setSelectedTa] = useState<User | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

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
      if (data.length > 0) {
        setSelectedTa(data[0]);
      }
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

  const getSlotData = (day: string, slot: number) => {
    return schedule.find(s => s.day_of_week === day && s.slot_number === slot);
  };

  const activeDays = DAYS.filter(d => d !== 'Friday' && d !== selectedTa?.day_off);
  const slots = [1, 2, 3, 4, 5];

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
          <Users className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">TA Schedules</h1>
          <p className="text-slate-400">View teaching assistant schedules</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* TA List - Left Side */}
        <div className="md:w-72 shrink-0">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h2 className="text-sm font-medium text-slate-400 mb-4">Select TA</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {tas.length === 0 ? (
                <p className="text-slate-500 text-sm">No TAs found</p>
              ) : (
                tas.map(ta => (
                  <button
                    key={ta.id}
                    onClick={() => setSelectedTa(ta)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedTa?.id === ta.id
                        ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    <p className="font-medium text-sm">{ta.name}</p>
                    {ta.day_off && (
                      <p className="text-xs text-amber-400 mt-1">Off: Fri, {ta.day_off}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Schedule Display - Right Side */}
        <div className="flex-1 overflow-hidden">
          {selectedTa ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-x-auto">
              <div className="flex items-center justify-between mb-4 min-w-[600px]">
                <h2 className="text-lg font-semibold text-white">
                  {selectedTa.name}'s Schedule
                </h2>
                {selectedTa.day_off && (
                  <span className="text-sm text-slate-400 bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-700">
                    Days Off: <span className="text-white">Friday, {selectedTa.day_off}</span>
                  </span>
                )}
              </div>

              {loadingSchedule ? (
                <div className="flex items-center justify-center h-40">
                  <Loader className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : (
                <table className="w-full min-w-[800px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="p-3 text-left font-semibold text-white w-28">Day</th>
                      {slots.map(slot => (
                        <th key={slot} className="p-3 text-left font-semibold text-white border-l border-slate-700">
                          <div className="flex flex-col">
                            <span className="text-sm">Slot {slot}</span>
                            <span className="text-xs text-slate-400 font-normal">{getSlotTime(slot)}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDays.map(day => (
                      <tr key={day} className="border-b border-slate-700/50 last:border-0">
                        <td className="p-3 font-medium text-white bg-slate-800/50 border-r border-slate-700">
                          {day}
                        </td>
                        {slots.map(slot => {
                          const data = getSlotData(day, slot);
                          return (
                            <td key={slot} className="p-2 border-l border-slate-700/50 h-24 align-top">
                              {data ? (
                                <div className={`w-full h-full p-2 rounded-lg border ${TYPE_COLORS[data.course_type] || TYPE_COLORS.Lecture}`}>
                                  <div className="font-semibold text-sm">{data.course_name}</div>
                                  <div className="text-xs opacity-75 mt-1">{data.course_type}</div>
                                  {data.location && <div className="text-xs mt-1 font-medium">{data.location}</div>}
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700 text-sm">
                                  —
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {schedule.length === 0 && !loadingSchedule && (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No schedule entries for this TA</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a TA to view their schedule</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ TA VIEW - Editable Schedule Builder ============
function TAScheduleBuilder() {
  const { user } = useAuth();
  const tableRef = useRef<HTMLDivElement>(null);
  
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [dayOff, setDayOff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotCount, setSlotCount] = useState(5);
  
  const [showModal, setShowModal] = useState(false);
  const [showDayOffModal, setShowDayOffModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; slot: number } | null>(null);
  const [slotForm, setSlotForm] = useState({
    course_name: '',
    course_type: 'Lecture',
    location: '',
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ day: string; slot: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ day: string; slot: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scheduleData, userData] = await Promise.all([
        scheduleApi.getMy(),
        userApi.getSettings(),
      ]);
      setSchedule(scheduleData);
      setDayOff(userData.day_off);
      
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

  const getSlotData = (day: string, slot: number) => {
    return schedule.find(s => s.day_of_week === day && s.slot_number === slot);
  };

  const handleMouseDown = (day: string, slot: number) => {
    setIsDragging(true);
    setSelectionStart({ day, slot });
    setSelectionEnd({ day, slot });
  };

  const handleMouseEnter = (day: string, slot: number) => {
    if (isDragging && selectionStart?.day === day) {
      setSelectionEnd({ day, slot });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (selectionStart && selectionEnd) {
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
  };

  const isSelected = (day: string, slot: number) => {
    if (!selectionStart || !selectionEnd || selectionStart.day !== day) return false;
    const minSlot = Math.min(selectionStart.slot, selectionEnd.slot);
    const maxSlot = Math.max(selectionStart.slot, selectionEnd.slot);
    return slot >= minSlot && slot <= maxSlot;
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

    const loadingToast = toast.loading(isUpdate ? 'Updating slot...' : 'Adding slot...');

    try {
      for (let s = minSlot; s <= maxSlot; s++) {
        const existing = getSlotData(day, s);
        
        if (existing) {
          await scheduleApi.update(existing.id, slotForm);
        } else {
          await scheduleApi.create({
            day_of_week: day,
            slot_number: s,
            ...slotForm,
          });
        }
      }
      
      await loadData();
      closeModal();
      toast.success(isUpdate ? 'Slot updated!' : 'Slot added!', { id: loadingToast });
    } catch (error) {
      console.error('Error saving slot:', error);
      toast.error('Failed to save slot', { id: loadingToast });
    }
  };

  const deleteSlot = async () => {
    if (!selectionStart || !selectionEnd) return;
    
    const minSlot = Math.min(selectionStart.slot, selectionEnd.slot);
    const maxSlot = Math.max(selectionStart.slot, selectionEnd.slot);
    const day = selectionStart.day;

    const loadingToast = toast.loading('Removing slot...');

    try {
      for (let s = minSlot; s <= maxSlot; s++) {
        const existing = getSlotData(day, s);
        if (existing) {
          await scheduleApi.delete(existing.id);
        }
      }
      await loadData();
      closeModal();
      toast.success('Slot removed!', { id: loadingToast });
    } catch (error) {
      console.error('Error deleting slot:', error);
      toast.error('Failed to remove slot', { id: loadingToast });
    }
  };

  const clearSchedule = async () => {
    if (!confirm('Are you sure you want to clear your entire schedule?')) return;
    
    const loadingToast = toast.loading('Clearing schedule...');
    try {
      await scheduleApi.clear();
      await loadData();
      toast.success('Schedule cleared!', { id: loadingToast });
    } catch (error) {
      console.error('Error clearing schedule:', error);
      toast.error('Failed to clear schedule', { id: loadingToast });
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const slots = Array.from({ length: slotCount }, (_, i) => i + 1);
  const activeDays = DAYS.filter(d => d !== 'Friday' && d !== dayOff);

  if (loading) return <PageLoader />;

  // Day off selection screen (first time only)
  if (!dayOff) {
    return (
      <div className="max-w-2xl mx-auto text-center px-4 py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/25">
          <Clock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Select Your Day Off</h1>
        <p className="text-slate-400 mb-8">
          Friday is automatically a day off. Please select your additional weekly day off.
        </p>
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
    <div className="max-w-7xl mx-auto px-4 py-6" onMouseUp={() => isDragging && handleMouseUp()}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Schedule</h1>
          <p className="text-sm text-slate-400 animate-glow">Select a slot or drag to select multiple slots</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDayOffModal(true)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
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

      {/* Schedule Grid */}
      <div ref={tableRef} className="bg-slate-800 rounded-xl border border-slate-700 p-4 overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="p-4 text-left font-semibold text-white w-24">Day/Slot</th>
              {slots.map(slot => (
                <th key={slot} className="p-4 text-left font-semibold text-white border-l border-slate-700">
                  <div className="flex flex-col">
                    <span>Slot {slot}</span>
                    <span className="text-xs text-slate-400 font-normal">{getSlotTime(slot)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map(day => (
              <tr key={day} className="border-b border-slate-700/50 last:border-0">
                <td className="p-4 font-medium text-white bg-slate-800/50 border-r border-slate-700">
                  {day}
                </td>
                {slots.map(slot => {
                  const data = getSlotData(day, slot);
                  const selected = isSelected(day, slot);
                  
                  return (
                    <td
                      key={slot}
                      onMouseDown={() => handleMouseDown(day, slot)}
                      onMouseEnter={() => handleMouseEnter(day, slot)}
                      className={`p-1 border-l border-slate-700/50 h-24 align-top cursor-pointer transition-all select-none
                        ${selected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:bg-slate-700/30'}
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
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slot Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center mb-6">
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
                <label className="label text-xs">Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Course Name / Activity"
                  value={slotForm.course_name}
                  onChange={(e) => setSlotForm({ ...slotForm, course_name: e.target.value })}
                />
              </div>

              <div>
                <label className="label text-xs">Type</label>
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
                <label className="label text-xs">Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. C.301"
                  value={slotForm.location}
                  onChange={(e) => setSlotForm({ ...slotForm, location: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                {getSlotData(selectedSlot!.day, selectedSlot!.slot) && (
                  <button
                    onClick={deleteSlot}
                    className="p-2 text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                    title="Delete slot"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button onClick={saveSlot} className="flex-1 btn btn-primary">
                  {getSlotData(selectedSlot!.day, selectedSlot!.slot) ? 'Update Slot' : 'Save Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Off Modal */}
      {showDayOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Change Day Off</h2>
              <button onClick={() => setShowDayOffModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-400 mb-4 text-sm">
              Select your additional day off (Friday is always off).
            </p>
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
