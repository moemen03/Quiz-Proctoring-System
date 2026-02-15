import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export interface TASuggestion {
    id: string;
    name: string;
    email: string;
    currentWorkload: number;
    targetWorkload: number;
    adjustedTarget: number;
    recentHeavyAssignments: number;
    fairnessScore: number;
    available: boolean;
    recommendation: 'highly_recommended' | 'recommended' | 'acceptable' | 'not_recommended';
}

export class AssignmentService {
    /**
     * Get ranked TAs for a specific quiz based on fairness, availability, and scheduling
     */
    static async getRankedTAs(quiz: any): Promise<TASuggestion[]> {
        const quizDate = new Date(quiz.date);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const quizDayName = dayNames[quizDate.getDay()];

        // 0. Fetch Settings
        const { data: settings } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'ramadan_mode')
            .single();

        let isRamadan = false;
        if (settings?.value?.enabled) {
            const { start_date, end_date } = settings.value;
            if (start_date && end_date) {
                const start = new Date(start_date);
                const end = new Date(end_date);
                // Reset times to compare dates only
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);

                if (quizDate >= start && quizDate <= end) {
                    isRamadan = true;
                }
            }
        }

        // 1. Calculate Time Slots
        const timeToSlot = (time: string): number[] => {
            const [hours, minutes] = time.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes;

            let slots;

            if (isRamadan) {
                slots = [
                    { slot: 1, start: 8 * 60 + 30, end: 9 * 60 + 40 },    // 8:30 - 9:40
                    { slot: 2, start: 9 * 60 + 45, end: 10 * 60 + 55 },   // 9:45 - 10:55
                    { slot: 3, start: 11 * 60 + 5, end: 12 * 60 + 15 },   // 11:05 - 12:15
                    { slot: 4, start: 12 * 60 + 25, end: 13 * 60 + 35 },  // 12:25 - 13:35
                    { slot: 5, start: 13 * 60 + 40, end: 14 * 60 + 50 },  // 13:40 - 14:50
                ];
            } else {
                slots = [
                    { slot: 1, start: 8 * 60 + 30, end: 10 * 60 + 0 },    // 8:30 - 10:00
                    { slot: 2, start: 10 * 60 + 15, end: 11 * 60 + 45 },  // 10:15 - 11:45
                    { slot: 3, start: 12 * 60, end: 13 * 60 + 30 },       // 12:00 - 13:30
                    { slot: 4, start: 13 * 60 + 45, end: 15 * 60 + 15 },  // 13:45 - 15:15
                    { slot: 5, start: 15 * 60 + 45, end: 17 * 60 + 15 },  // 15:45 - 17:15
                    { slot: 6, start: 17 * 60 + 30, end: 19 * 60 },       // 17:30 - 19:00
                    { slot: 7, start: 19 * 60 + 15, end: 20 * 60 + 45 },  // 19:15 - 20:45
                ];
            }

            const quizDuration = quiz.duration_minutes || 60;
            const quizEnd = totalMinutes + quizDuration;

            const overlappingSlots: number[] = [];
            for (const s of slots) {
                if (totalMinutes < s.end && quizEnd > s.start) {
                    overlappingSlots.push(s.slot);
                }
            }
            return overlappingSlots.length > 0 ? overlappingSlots : [1];
        };

        const quizSlots = timeToSlot(quiz.start_time);

        // 2. Fetch Data
        const [
            { data: allTAs },
            { data: taSchedules },
            { data: existingAssignments },
            { data: excuses },
            { data: recentAssignments },
            { data: exchangeRequests }
        ] = await Promise.all([
            // Get all TAs in major
            supabase
                .from('users')
                .select('id, name, email, total_workload_points, target_workload, day_off, major')
                .eq('role', 'ta')
                .eq('major', quiz.major || 'CS'),

            // Get Schedules
            supabase
                .from('ta_schedules')
                .select('ta_id, slot_number, course_name')
                .eq('day_of_week', quizDayName)
                .in('slot_number', quizSlots),

            // Get Assignmnets
            supabase
                .from('assignments')
                .select(`ta_id, quizzes!inner (date, start_time)`)
                .filter('quizzes.date', 'eq', quiz.date),

            // Get Excuses
            supabase
                .from('ta_excuses')
                .select('ta_id')
                .eq('status', 'active')
                .lte('start_date', quiz.date)
                .or(`end_date.is.null,end_date.gte.${quiz.date}`),

            // Get Recent Assignments
            (async () => {
                const weekAgo = new Date(quizDate);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekAgoStr = weekAgo.toISOString().split('T')[0];
                return supabase
                    .from('assignments')
                    .select(`ta_id, quizzes!inner (date, weight)`)
                    .gte('quizzes.date', weekAgoStr)
                    .lte('quizzes.date', quiz.date);
            })(),

            // Get Approved Exchange Requests for this Date
            supabase
                .from('exchange_requests')
                .select('original_ta_id, assignments!inner(quizzes!inner(date))')
                .eq('status', 'approved')
                .eq('assignments.quizzes.date', quiz.date)
        ]);

        // 3. Process Exclusions
        const tasWithClasses = new Set(taSchedules?.map((s: any) => s.ta_id) || []);

        const busyTaIds = new Set(
            existingAssignments?.map((a: any) => a.ta_id) || []
        );

        const tasWithActiveExcuses = new Set(excuses?.map((e: any) => e.ta_id) || []);

        const tasWithExchanges = new Set(exchangeRequests?.map((r: any) => r.original_ta_id) || []);

        // 4. Process Recent Stats
        const recentHeavyCount: Record<string, number> = {};
        const lastAssignmentDate: Record<string, string> = {};
        recentAssignments?.forEach((a: any) => {
            if ((a.quizzes?.weight || 1) > 1.2) {
                recentHeavyCount[a.ta_id] = (recentHeavyCount[a.ta_id] || 0) + 1;
            }
            if (!lastAssignmentDate[a.ta_id] || a.quizzes?.date > lastAssignmentDate[a.ta_id]) {
                lastAssignmentDate[a.ta_id] = a.quizzes?.date;
            }
        });

        // 5. Calculate Scores
        const suggestions = allTAs
            ?.filter((ta: any) => {
                if (tasWithClasses.has(ta.id)) return false;
                if (busyTaIds.has(ta.id)) return false;
                if (ta.day_off === quizDayName || quizDayName === 'Friday') return false;
                if (tasWithActiveExcuses.has(ta.id)) return false;
                if (tasWithExchanges.has(ta.id)) return false; // Exclude TAs who exchanged out today
                return true;
            })
            .map((ta: any) => {
                const currentWorkload = ta.total_workload_points || 0;
                const targetWorkload = ta.target_workload || 14;

                let fairnessScore = targetWorkload > 0
                    ? (targetWorkload - currentWorkload) / targetWorkload
                    : 0;

                const heavyCount = recentHeavyCount[ta.id] || 0;
                if (heavyCount >= 3) fairnessScore -= 0.5;
                else if (heavyCount >= 2) fairnessScore -= 0.3;

                const lastDate = lastAssignmentDate[ta.id];
                if (lastDate) {
                    const daysSince = Math.floor((quizDate.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSince < 1) fairnessScore -= 0.4;
                    else if (daysSince < 2) fairnessScore -= 0.2;
                }

                return {
                    id: ta.id,
                    name: ta.name,
                    email: ta.email,
                    currentWorkload,
                    targetWorkload,
                    adjustedTarget: targetWorkload,
                    recentHeavyAssignments: heavyCount,
                    fairnessScore: Math.round(fairnessScore * 100) / 100,
                    available: true,
                    recommendation: (fairnessScore > 0.3 ? 'highly_recommended'
                        : fairnessScore > 0 ? 'recommended'
                            : fairnessScore > -0.3 ? 'acceptable'
                                : 'not_recommended') as TASuggestion['recommendation']
                };
            })
            .sort((a, b) => b.fairnessScore - a.fairnessScore);

        return suggestions || [];
    }

    /**
     * Calculate required proctors for a capacity
     */
    static calculateRequiredProctors(capacity: number): number {
        if (capacity <= 25) return 2;
        if (capacity <= 40) return 3;
        if (capacity <= 65) return 4;
        if (capacity <= 100) return 5;
        return Math.ceil(capacity / 20);
    }

    /**
     * Automatically assign proctors to a quiz based on capacity and fairness
     */
    static async autoAssign(quizId: string): Promise<any[]> {
        // 1. Fetch Quiz with Locations
        const { data: quiz, error } = await supabase
            .from('quizzes')
            .select('*, locations(*)')
            .eq('id', quizId)
            .single();

        if (error || !quiz) throw new Error('Quiz not found');

        // 2. Get All Ranked Available TAs
        // We pass the full quiz object to reuse the logic
        let availableTAs = await this.getRankedTAs(quiz);

        const newAssignments: any[] = [];
        const assignedTaIds = new Set<string>();

        // 3. Assign per Location
        for (const location of quiz.locations || []) {
            const needed = this.calculateRequiredProctors(location.capacity || 10);
            let assignedCount = 0;

            for (const ta of availableTAs) {
                if (assignedCount >= needed) break;
                if (assignedTaIds.has(ta.id)) continue;

                newAssignments.push({
                    quiz_id: quiz.id,
                    ta_id: ta.id,
                    location_id: location.id
                });
                assignedTaIds.add(ta.id);
                assignedCount++;
            }
        }

        // 4. Save Assignments
        if (newAssignments.length > 0) {
            const { data, error: insertError } = await supabase
                .from('assignments')
                .insert(newAssignments)
                .select();

            if (insertError) throw insertError;
            return data;
        }

        return [];
    }

    /**
     * Preview assignments without saving to DB
     */
    static async previewAssign(quizData: any): Promise<Record<string, TASuggestion[]>> {
        // 1. Get All Ranked Available TAs
        const availableTAs = await this.getRankedTAs(quizData);

        const preview: Record<string, TASuggestion[]> = {};
        const assignedTaIds = new Set<string>();

        // 2. Assign per Location
        for (const location of quizData.locations || []) {
            const needed = this.calculateRequiredProctors(location.capacity || 10);
            preview[location.name] = [];

            let assignedCount = 0;
            for (const ta of availableTAs) {
                if (assignedCount >= needed) break;
                if (assignedTaIds.has(ta.id)) continue;

                preview[location.name].push(ta);
                assignedTaIds.add(ta.id);
                assignedCount++;
            }
        }

        return preview;
    }
}
