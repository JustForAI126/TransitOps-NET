import { Vehicle, Driver, Trip, MaintenanceRecord, FuelExpenseRecord, UserAccount, UserRole } from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('transitops_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('transitops_token', token);
  } else {
    localStorage.removeItem('transitops_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.message || errorData.error || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  auth: {
    login: async (email: string, role?: UserRole) => {
      const res = await request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      setAuthToken(res.token);
      return res;
    },
    register: async (fullName: string, email: string, role: UserRole, password?: string) => {
      const res = await request<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, role, password: password || 'TransitOps@Secure2026!' }),
      });
      setAuthToken(res.token);
      return res;
    },
    me: async () => {
      return request<UserAccount>('/auth/me');
    },
    logout: () => {
      setAuthToken(null);
    },
  },

  vehicles: {
    getAll: async () => request<Vehicle[]>('/vehicles'),
    create: async (data: any) => request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: async (id: string, status: string) =>
      request<Vehicle>(`/vehicles/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    retire: async (id: string) => request<{ message: string }>(`/vehicles/${id}`, { method: 'DELETE' }),
  },

  drivers: {
    getAll: async () => request<Driver[]>('/drivers'),
    create: async (data: any) => request<Driver>('/drivers', { method: 'POST', body: JSON.stringify(data) }),
    toggleSuspension: async (id: string) =>
      request<Driver>(`/drivers/${id}/toggle-suspension`, { method: 'PUT' }),
    sendReminder: async (id: string) =>
      request<{ message: string }>(`/drivers/${id}/send-license-reminder`, { method: 'POST' }),
  },

  trips: {
    getAll: async () => request<Trip[]>('/trips'),
    create: async (data: any) => request<Trip>('/trips', { method: 'POST', body: JSON.stringify(data) }),
    dispatch: async (id: string) => request<Trip>(`/trips/${id}/dispatch`, { method: 'POST' }),
    complete: async (id: string, finalOdometerKm: number, fuelConsumedLiters: number) =>
      request<Trip>(`/trips/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ finalOdometerKm, fuelConsumedLiters }),
      }),
  },

  maintenance: {
    getAll: async () => request<MaintenanceRecord[]>('/maintenance'),
    create: async (data: any) => request<MaintenanceRecord>('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
    close: async (id: string, finalCost?: number, notes?: string) =>
      request<MaintenanceRecord>(`/maintenance/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ finalCost, notes }),
      }),
  },

  expenses: {
    getAll: async () => request<FuelExpenseRecord[]>('/expenses'),
    create: async (data: any) => request<FuelExpenseRecord>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    delete: async (id: string) => request<{ message: string }>(`/expenses/${id}`, { method: 'DELETE' }),
  },

  kpi: {
    getFleet: async () => request<any>('/kpi/fleet'),
    getDriver: async () => request<any>('/kpi/driver'),
    getSafety: async () => request<any>('/kpi/safety'),
    getFinancial: async () => request<any>('/kpi/financial'),
  },

  docs: {
    getPostmanUrl: () => `${API_BASE}/docs/postman`,
    getSwaggerUrl: () => `${API_BASE}/docs/swagger.json`,
  },

  workspace: {
    loadSampleData: async () =>
      request<{ message: string }>('/workspace/sample-data', { method: 'POST' }),
  },
};
