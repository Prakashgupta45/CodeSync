const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: Response) => void;
  reject: (reason?: unknown) => void;
  url: string;
  options?: RequestInit;
}> = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      fetch(prom.url, { credentials: 'include', ...prom.options })
        .then(prom.resolve)
        .catch(prom.reject);
    }
  });
  failedQueue = [];
};

/**
 * Enhanced fetch wrapper with automatic token refresh and request retry.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  const response = await fetch(url, defaultOptions);

  // If response is 401 Unauthorized or Token Expired, attempt automatic session refresh
  // Skip refresh for auth endpoints to prevent duplicate calls and cascades
  const isAuthEndpoint =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh');

  if (response.status === 401 && !isAuthEndpoint) {
    if (isRefreshing) {
      return new Promise<Response>((resolve, reject) => {
        failedQueue.push({ resolve, reject, url, options: defaultOptions });
      });
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          isRefreshing = false;
          processQueue(null);
          // Retry the original failed request
          return await fetch(url, defaultOptions);
        }
      }

      isRefreshing = false;
      processQueue(new Error('Session expired. Please log in again.'));

      // Redirect to sign-in if in browser environment and not already on an auth page
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isAuthPage =
          path.startsWith('/login') ||
          path.startsWith('/sign-in') ||
          path.startsWith('/sign-up') ||
          path.startsWith('/register') ||
          path.startsWith('/forgot-password');

        if (!isAuthPage) {
          window.location.href = '/sign-in';
        }
      }
    } catch (refreshErr) {
      isRefreshing = false;
      processQueue(refreshErr);
    }
  }

  return response;
}
