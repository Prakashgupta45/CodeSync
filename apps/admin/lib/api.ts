const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; error?: any }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = json.error?.message || json.message || `Request failed with status ${res.status}`;
    const err: any = new Error(errorMsg);
    err.status = res.status;
    err.data = json;
    throw err;
  }

  return json;
}

export const adminApi = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    fetchApi('/auth/logout', {
      method: 'POST',
    }),

  getMe: () => fetchApi('/auth/me', { method: 'GET' }),

  // Admin Dashboard
  getStats: () => fetchApi('/admin/stats', { method: 'GET' }),

  getSystemHealth: () => fetchApi('/admin/system-health', { method: 'GET' }),

  getAiUsage: () => fetchApi('/admin/ai-usage', { method: 'GET' }),

  getExecutions: () => fetchApi('/admin/executions', { method: 'GET' }),

  getAuditLogs: (params: { page?: number; limit?: number; action?: string; targetType?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.action) query.set('action', params.action);
    if (params.targetType) query.set('targetType', params.targetType);
    return fetchApi(`/admin/audit-logs?${query.toString()}`, { method: 'GET' });
  },

  // Users
  getUsers: (params: { page?: number; limit?: number; search?: string; role?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    return fetchApi(`/admin/users?${query.toString()}`, { method: 'GET' });
  },

  updateUserStatus: (userId: string, status: 'ACTIVE' | 'SUSPENDED') =>
    fetchApi(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateUserRole: (userId: string, role: 'USER' | 'ADMIN') =>
    fetchApi(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  // Rooms
  getRooms: (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    return fetchApi(`/admin/rooms?${query.toString()}`, { method: 'GET' });
  },

  terminateRoom: (roomId: string) =>
    fetchApi(`/admin/rooms/${roomId}`, {
      method: 'DELETE',
    }),

  // Interviews & Deletion
  getInterviews: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    difficulty?: string;
    jobRole?: string;
    includeDeleted?: boolean;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.difficulty) query.set('difficulty', params.difficulty);
    if (params.jobRole) query.set('jobRole', params.jobRole);
    if (params.includeDeleted) query.set('includeDeleted', 'true');
    return fetchApi(`/admin/interviews?${query.toString()}`, { method: 'GET' });
  },

  deleteInterview: (interviewId: string) =>
    fetchApi(`/admin/interviews/${interviewId}`, {
      method: 'DELETE',
    }),

  recoverInterview: (interviewId: string) =>
    fetchApi(`/admin/interviews/${interviewId}/recover`, {
      method: 'POST',
    }),

  cancelInterview: (interviewId: string) =>
    fetchApi(`/admin/interviews/${interviewId}/cancel`, {
      method: 'POST',
    }),
};
