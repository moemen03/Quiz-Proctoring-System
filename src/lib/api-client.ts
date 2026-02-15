import { supabase } from '@/lib/supabase';

// Helper to get auth header from current session
async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` };
    }

    // Fallback for manual session management in AuthContext
    if (typeof window !== 'undefined') {
        const localSession = localStorage.getItem('session');
        if (localSession) {
            try {
                const parsed = JSON.parse(localSession);
                if (parsed.access_token) {
                    return { 'Authorization': `Bearer ${parsed.access_token}` };
                }
            } catch (e) {
                console.error('Error parsing session from localStorage', e);
            }
        }
    }

    return {};
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers = await getAuthHeader();

    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(headers as HeadersInit),
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'API request failed' }));
        throw new Error(error.error || error.message || 'API request failed');
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

// User Types
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'ta';
    major: string;
    max_assignments: number;
    created_at: string;
    current_assignments?: number;
    day_off?: string | null;
    total_workload_points?: number;
    target_workload?: number;
    last_schedule_update?: string;
}

export interface Quiz {
    id: string;
    course_name: string;
    date: string;
    start_time: string;
    duration_minutes: number;
    status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
    min_proctors: number;
    created_at: string;
    major: string;
    weight?: number;
    locations?: Location[];
    assignments?: Assignment[];
}

export interface Location {
    id: string;
    quiz_id: string;
    name: string;
    capacity: number | null;
    weight_multiplier?: number;
}

export interface Assignment {
    id: string;
    quiz_id: string;
    ta_id: string;
    location_id: string;
    status: 'assigned' | 'confirmed' | 'completed';
    created_at: string;
    quizzes?: Quiz;
    users?: User;
    locations?: Location;
}

export interface TASuggestion extends User {
    currentWorkload: number;
    targetWorkload: number;
    adjustedTarget: number;
    recentHeavyAssignments: number;
    fairnessScore: number;
    available: boolean;
    recommendation: 'highly_recommended' | 'recommended' | 'acceptable' | 'not_recommended';
}

export const quizApi = {
    getAll: () => fetchApi<Quiz[]>('/quizzes'),
    getById: (id: string) => fetchApi<Quiz>(`/quizzes/${id}`),
    create: (data: any) =>
        fetchApi<Quiz>('/quizzes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
        fetchApi<Quiz>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        fetchApi<void>(`/quizzes/${id}`, { method: 'DELETE' }),
};

export const assignmentApi = {
    getSuggestions: (quizId: string) =>
        fetchApi<{ suggestions: TASuggestion[] }>(`/assignments/suggestions/${quizId}`),
    create: (data: any) =>
        fetchApi<Assignment>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
        fetchApi<void>(`/assignments/${id}`, { method: 'DELETE' }),
};

export interface ScheduleSlot {
    id: string;
    ta_id: string;
    day_of_week: string;
    slot_number: number;
    course_name: string;
    course_type: string;
    location: string;
    users?: User;
}

export const scheduleApi = {
    getAll: () => fetchApi<ScheduleSlot[]>('/schedules'),
    getMy: () => fetchApi<ScheduleSlot[]>('/schedules/my'),
    getByTA: (taId: string) => fetchApi<ScheduleSlot[]>(`/schedules/ta/${taId}`),
    create: (data: any) =>
        fetchApi<ScheduleSlot>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
        fetchApi<ScheduleSlot>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
        fetchApi<void>(`/schedules/${id}`, { method: 'DELETE' }),
    clear: () => fetchApi<void>('/schedules/clear', { method: 'DELETE' }),
};

export const userApi = {
    getAll: (role?: string) => fetchApi<User[]>(`/users${role ? `?role=${role}` : ''}`),
    getSettings: () => fetchApi<{ day_off: string | null }>('/users/me/settings'),
    updateDayOff: (day_off: string) =>
        fetchApi<{ day_off: string }>('/users/me/day-off', { method: 'PUT', body: JSON.stringify({ day_off }) }),
    getSummary: (id: string) => fetchApi<ProctorSummary>(`/users/${id}/summary`),
    delete: (id: string) => fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
};

export interface Excuse {
    id: string;
    ta_id: string;
    excuse_type: string;
    description?: string;
    start_date: string;
    end_date?: string;
    status: 'active' | 'revoked' | 'pending' | 'approved' | 'rejected';
    created_at: string;
    approved_by?: string;
}

export interface CreateExcuseInput {
    ta_id: string;
    excuse_type: string;
    description?: string;
    start_date: string;
    end_date?: string;
}

export interface ProctorSummary {
    user: User;
    total_assignments: number;
    upcoming_assignments: number;
    completed_assignments: number;
    assignments: Assignment[];
}

export const excuseApi = {
    getAll: () => fetchApi<Excuse[]>('/excuses'),
    create: (data: CreateExcuseInput) =>
        fetchApi<Excuse>('/excuses', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
        fetchApi<void>(`/excuses/${id}`, { method: 'DELETE' }),
};

export interface ExchangeRequest {
    id: string;
    assignment_id: string;
    original_ta_id: string;
    new_ta_id?: string;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
    created_at: string;
    assignments?: Assignment; // Joined data
    original_ta?: User;      // Joined data
}

export const exchangeApi = {
    getAll: (status?: string) => fetchApi<ExchangeRequest[]>(`/exchange-requests${status ? `?status=${status}` : ''}`),
    create: (data: { assignment_id: string, reason?: string }) =>
        fetchApi<ExchangeRequest>('/exchange-requests', { method: 'POST', body: JSON.stringify(data) }),
    approve: (requestId: string, new_ta_id: string) =>
        fetchApi<void>(`/exchange-requests/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ new_ta_id }) }),
};

export interface Notification {
    id: string;
    type: string;
    message: string;
    read: boolean;
    created_at: string;
    ta_id?: string;
}

export const notificationApi = {
    getAll: (unreadOnly = true) => {
        const query = unreadOnly ? '?unread=true' : '';
        return fetchApi<Notification[]>(`/notifications${query}`);
    },
    markRead: (id: string) => {
        if (!id || id === 'undefined' || id.includes('undefined')) {
            console.warn('Blocked invalid markRead API call:', id);
            return Promise.resolve();
        }
        return fetchApi<void>(`/notifications/${id}`, { method: 'PUT' });
    },
    markAllRead: (category?: 'schedule' | 'system') =>
        fetchApi<void>('/notifications/mark-all-read', {
            method: 'PUT',
            body: JSON.stringify({ category })
        }),
};

export const settingsApi = {
    getRamadanMode: () => fetchApi<{ enabled: boolean; start_date?: string; end_date?: string }>('/settings/ramadan'),
    setRamadanMode: (enabled: boolean, start_date?: string, end_date?: string) =>
        fetchApi<void>('/settings/ramadan', {
            method: 'POST',
            body: JSON.stringify({ enabled, start_date, end_date })
        }),
};
