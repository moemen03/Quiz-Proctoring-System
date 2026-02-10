'use client';

import { useState, useEffect } from 'react';
import { Plus, X, MapPin, Clock, CalendarDays, Users, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parse, getDay } from 'date-fns';
import { quizApi, Quiz } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface QuizFormProps {
  onSuccess?: () => void;
  editQuiz?: Quiz | null;
  onCancel?: () => void;
}

// Calculate required proctors based on capacity
const calculateProctorsForCapacity = (capacity: number): number => {
  if (capacity <= 10) return 1;
  if (capacity <= 30) return 2;
  if (capacity <= 59) return 3;
  if (capacity <= 100) return 4;
  return Math.ceil(capacity / 25); // For larger capacities
};

export function QuizForm({ onSuccess, editQuiz, onCancel }: QuizFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ name: string; capacity?: number; requiredProctors: number }[]>([
    { name: '', capacity: undefined, requiredProctors: 1 }
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, any[]>>({});

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [formData, setFormData] = useState({
    course_name: '',
    date: '',
    start_time: '',
    end_time: '',
    duration_minutes: 60,
  });

  // Calculate total required proctors from all locations
  const totalRequiredProctors = locations.reduce((sum, loc) => sum + loc.requiredProctors, 0);

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  // Populate form when editing
  useEffect(() => {
    if (editQuiz) {
      const endTime = calculateEndTime(editQuiz.start_time, editQuiz.duration_minutes);
      
      setFormData({
        course_name: editQuiz.course_name,
        date: editQuiz.date,
        start_time: editQuiz.start_time,
        end_time: endTime,
        duration_minutes: editQuiz.duration_minutes,
      });
      
      if (editQuiz.locations && editQuiz.locations.length > 0) {
        setLocations(editQuiz.locations.map(loc => ({
            name: loc.name,
            capacity: loc.capacity || undefined,
            requiredProctors: calculateProctorsForCapacity(loc.capacity || 10) // defaulting if null
        })));
      }
    }
  }, [editQuiz]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 60;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;
    const duration = endTotal - startTotal;
    return duration > 0 ? duration : 60;
  };

  const handleStartTimeChange = (newStartTime: string) => {
    const endTime = calculateEndTime(newStartTime, formData.duration_minutes);
    setFormData({ ...formData, start_time: newStartTime, end_time: endTime });
  };

  const handleEndTimeChange = (newEndTime: string) => {
    const duration = calculateDuration(formData.start_time, newEndTime);
    setFormData({ ...formData, end_time: newEndTime, duration_minutes: duration });
  };

  const addLocation = () => {
    setLocations([...locations, { name: '', capacity: undefined, requiredProctors: 1 }]);
  };

  const removeLocation = (index: number) => {
    if (locations.length > 1) {
      setLocations(locations.filter((_, i) => i !== index));
    }
  };

  const updateLocation = (index: number, field: 'name' | 'capacity', value: string | number) => {
    const updated = [...locations];
    if (field === 'capacity') {
      const capacity = value as number;
      updated[index].capacity = capacity;
      // Auto-calculate required proctors based on capacity
      updated[index].requiredProctors = calculateProctorsForCapacity(capacity);
    } else {
      updated[index].name = value as string;
    }
    setLocations(updated);
  };

  const handlePreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLocations = locations.filter(loc => loc.name.trim());
    if (validLocations.length === 0) {
      setError('At least one location is required');
      return;
    }
    setError(null);
    
    // Fetch preview data if not editing (or even if editing, to show current/new status)
    // For now, let's fetch it to show predicted assignments
    try {
      setLoading(true);
      
      // Let's use a direct fetch for now to avoid updating api-client file again if possible, or better yet, use the preview endpoint I created.
      const res = await fetch('/api/assignments/preview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('session') || '{}').access_token}`
        },
        body: JSON.stringify({
            course_name: formData.course_name,
            date: formData.date,
            start_time: formData.start_time,
            duration_minutes: formData.duration_minutes,
            locations: validLocations.map(loc => ({
              name: loc.name,
              capacity: loc.capacity,
            })),
            min_proctors: totalRequiredProctors
          })
      });
      
      if (!res.ok) throw new Error('Failed to load preview');
      const previewRes = await res.json();
      
      setPreviewData(previewRes);
      setShowPreview(true);
    } catch (err) {
      setError('Failed to load preview: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setError(null);

    const validLocations = locations.filter(loc => loc.name.trim());
    if (validLocations.length === 0) {
      setError('At least one location is required');
      setLoading(false);
      return;
    }

    try {
      const data = {
        course_name: formData.course_name,
        date: formData.date,
        start_time: formData.start_time,
        duration_minutes: formData.duration_minutes,
        min_proctors: totalRequiredProctors,
        locations: validLocations.map(loc => ({
          name: loc.name,
          capacity: loc.capacity,
        })),
      };

      if (editQuiz) {
        await quizApi.update(editQuiz.id, data);
        toast.success('Quiz updated successfully');
      } else {
        await quizApi.create(data);
        toast.success('Quiz created successfully');
      }
      
      setFormData({
        course_name: '',
        date: '',
        start_time: '',
        end_time: '',
        duration_minutes: 60,
      });
      setLocations([{ name: '', capacity: undefined, requiredProctors: 1 }]);
      
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handlePreSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="label text-xs">Course Name</label>
          <input
            type="text"
            className="input text-xs"
            placeholder="e.g., CS101 - Introduction to Programming"
            value={formData.course_name}
            onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
            required
          />
        </div>

        <div className="md:col-span-2 space-y-4">
          {/* Custom Calendar Picker */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={`${d}-${i}`} className="text-slate-400 font-medium">
                  {d}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              
              {daysInMonth.map((day) => {
                const isSelected = formData.date === format(day, "yyyy-MM-dd");
                const isCurrentMonth = isSameMonth(day, currentMonth);
                
                return (
                  <button
                    type="button"
                    key={day.toString()}
                    onClick={() => setFormData({ ...formData, date: format(day, "yyyy-MM-dd") })}
                    className={`
                      p-2 text-sm rounded-lg transition-colors
                      ${!isCurrentMonth ? "text-slate-300 dark:text-slate-600" : ""}
                      ${isSelected
                        ? "bg-indigo-500 text-white font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }
                      ${isToday(day) && !isSelected ? "ring-2 ring-indigo-500/20" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
            
            {formData.date && (
              <div className="mt-4 p-2 bg-slate-50 dark:bg-slate-900/50 rounded text-center text-sm text-slate-600 dark:text-slate-400">
                Selected: {format(parse(formData.date, "yyyy-MM-dd", new Date()), "EEEE, MMMM do, yyyy")}
              </div>
            )}
          </div>

          {/* Time & Duration Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-2 text-xs">
                <Clock className="w-4 h-4" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                className="input text-xs"
                value={formData.start_time}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label flex items-center gap-2 text-xs">
                <Clock className="w-4 h-4" />
                <span>End Time</span>
              </label>
              <input
                type="time"
                className="input text-xs"
                value={formData.end_time}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                required
              />
              {formData.duration_minutes > 0 && (
                <p className="text-xs text-slate-500 mt-1 text-right">
                  {formData.duration_minutes} minutes
                </p>
              )}
            </div>
          </div>
        </div>

        
      </div>

      {/* Locations - Required */}
      <div>
        <label className="label flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4" />
          Locations <span className="text-red-400">*</span>
        </label>
        
        <div className="space-y-3">
          {locations.map((location, index) => (
            <div key={index} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Location Name</label>
                  <input
                    type="text"
                    className="input text-xs"
                    placeholder="e.g., Room A101"
                    value={location.name}
                    onChange={(e) => updateLocation(index, 'name', e.target.value)}
                    required={index === 0}
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs text-slate-400 mb-1 block">Capacity</label>
                  <input
                    type="number"
                    className="input text-xs"
                    placeholder="Students"
                    min={1}
                    value={location.capacity || ''}
                    onChange={(e) => updateLocation(index, 'capacity', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-slate-400 mb-1 block">Proctors</label>
                  <div className="input bg-slate-700/50 text-center text-emerald-400 font-semibold cursor-not-allowed">
                    {location.requiredProctors}
                  </div>
                </div>
                {locations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    className="mt-6 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {location.capacity ? (
                  <>Based on capacity of {location.capacity}: {location.requiredProctors} proctor{location.requiredProctors !== 1 ? 's' : ''} needed</>
                ) : (
                  <>Enter capacity to auto-calculate proctors (1-10: 1, 11-30: 2, 31-59: 3, 60-100: 4)</>
                )}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLocation}
          className="mt-3 flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Another Location
        </button>
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary flex-1"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`btn btn-primary ${onCancel ? 'flex-1' : 'w-full'}`}
        >
          {loading ? (editQuiz ? 'Updating...' : 'Creating...') : (editQuiz ? 'Update Quiz' : 'Create Quiz')}
        </button>
      </div>
    </form>

      {/* Confirmation Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl max-w-md w-full shadow-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-400" />
                Confirm Quiz Details
              </h3>
              <button 
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Course</label>
                <p className="text-white font-medium text-lg">{formData.course_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Date</label>
                  <p className="text-white">
                    {formData.date ? format(parse(formData.date, 'yyyy-MM-dd', new Date()), 'MMM do, yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Time</label>
                  <p className="text-white">{formData.start_time} - {formData.end_time}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2 block">Locations & Proctors</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {locations.filter(l => l.name).map((loc, idx) => (
                    <div key={idx} className="bg-slate-700/30 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-indigo-300">{loc.name}</p>
                        <p className="text-xs text-slate-400">Cap: {loc.capacity || '-'}</p>
                        
                        {/* Show Predicted Proctors */}
                        {previewData[loc.name] && previewData[loc.name].length > 0 && (
                           <div className="mt-2 space-y-1">
                            <p className="text-[10px] uppercase text-slate-500 font-bold">Assigned Proctors:</p>
                            {previewData[loc.name].map((ta: any) => (
                              <div key={ta.id} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/50 p-1.5 rounded border border-slate-700/50">
                                <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-[9px] text-indigo-400 font-bold border border-indigo-500/30">
                                  {ta.name.charAt(0)}
                                </div>
                                <span>{ta.name}</span>
                                {ta.recommendation === 'highly_recommended' && (
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                )}
                              </div>
                            ))}
                           </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                          <Users className="w-3 h-3 text-emerald-400" />
                          <span className="text-sm font-bold text-white">{loc.requiredProctors}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                <span className="text-slate-400 text-sm">Total Proctors Needed:</span>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                  <Users className="w-5 h-5" />
                  {totalRequiredProctors}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex-1 py-2.5 px-4 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors font-medium text-sm"
              >
                Edit Details
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 transition-all font-medium text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Confirm & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
