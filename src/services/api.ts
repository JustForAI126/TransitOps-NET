import {
  Vehicle,
  VehicleType,
  Driver,
  Trip,
  MaintenanceRecord,
  FuelExpenseRecord,
  OrganizationUser,
  UserAccount,
  UserRole,
} from '../types';

const API_BASE = '/api';
const roleToApi: Record<UserRole, string> = {
  organization_admin: 'OrganizationAdmin',
  fleet_manager: 'FleetManager',
  driver: 'Driver',
  safety_officer: 'SafetyOfficer',
  financial_analyst: 'FinancialAnalyst',
};

interface CreateOrganizationUser {
  fullName: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'organization_admin'>;
  contactNumber?: string;
  licenseNumber?: string;
  licenseCategory?: string;
  licenseExpiryDate?: string;
}

interface AuthUserResponse {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  tenantId: string;
  isDemoAccount: boolean;
  avatarUrl?: string;
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface FinancialKpis {
  totalOpex: number;
  fuelSpend: number;
  maintenanceSpend: number;
  grossRevenue: number;
  netProfit: number;
  netMarginPercentage: number;
  costPerKm: number;
  currency: string;
}

const vehicleStatusFromApi: Record<string, Vehicle['status']> = {
  OnTrip: 'On Trip',
  InShop: 'In Shop',
};

const vehicleTypeFromApi: Record<string, Vehicle['type']> = {
  HeavyTruck: 'Heavy Truck',
  SemiTrailer: 'Semi-Trailer',
  BoxTruck: 'Box Truck',
};

const driverStatusFromApi: Record<string, Driver['status']> = {
  OnDuty: 'On Duty',
  OffDuty: 'Off Duty',
  OnTrip: 'On Trip',
};

function fromApiVehicle(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    status: vehicleStatusFromApi[vehicle.status] ?? vehicle.status,
    type: vehicleTypeFromApi[vehicle.type] ?? vehicle.type,
  };
}

function fromApiDriver(driver: Driver): Driver {
  return {
    ...driver,
    status: driverStatusFromApi[driver.status] ?? driver.status,
  };
}

function toApiVehicleType(type: VehicleType | string): string {
  const toApi: Record<string, string> = {
    'Heavy Truck': 'HeavyTruck',
    'Semi-Trailer': 'SemiTrailer',
    'Box Truck': 'BoxTruck',
  };
  return toApi[type] ?? type;
}

function toApiDriverStatus(status: Driver['status']): string {
  const toApi: Record<string, string> = {
    'On Duty': 'OnDuty',
    'Off Duty': 'OffDuty',
    'On Trip': 'OnTrip',
  };
  return toApi[status] ?? status;
}

function fromApiExpense(expense: FuelExpenseRecord): FuelExpenseRecord {
  const date = expense.date ?? expense.expenseDate;
  if (!date) {
    throw new Error('The expenses API returned a record without an expense date.');
  }
  return {
    ...expense,
    type: expense.type ?? expense.category,
    category: expense.category ?? expense.type,
    amount: expense.amount ?? expense.cost,
    cost: expense.cost ?? expense.amount,
    date,
    liters: expense.liters ?? expense.fuelLiters,
    fuelLiters: expense.fuelLiters ?? expense.liters,
    description: expense.description ?? expense.notes,
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json() as {
        detail?: string;
        title?: string;
        message?: string;
        errors?: Record<string, string[]>;
      };
      const validationError = errorData.errors
        ? Object.values(errorData.errors).flat().join(' ')
        : undefined;
      errorMsg = errorData.detail || errorData.message || validationError || errorData.title || errorMsg;
    } catch {}
    throw new ApiRequestError(errorMsg, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

async function requestBlob(endpoint: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
  if (!response.ok) {
    let message = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json() as { detail?: string; title?: string; message?: string };
      message = errorData.detail || errorData.message || errorData.title || message;
    } catch {}
    throw new ApiRequestError(message, response.status);
  }
  return response.blob();
}

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      return request<AuthUserResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    me: async () => {
      return request<AuthUserResponse>('/auth/me');
    },
    logout: async () => {
      await request<void>('/auth/logout', { method: 'POST' });
    },
  },

  organizationUsers: {
    getAll: async () => request<OrganizationUser[]>('/admin/users'),
    create: async (data: CreateOrganizationUser) =>
      request<OrganizationUser>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...data, role: roleToApi[data.role] }),
      }),
  },

  reports: {
    exportFinancialLedgerPdf: () => requestBlob('/reports/export/pdf/ledger'),
    exportFleetRoiPdf: () => requestBlob('/reports/export/pdf/fleet-roi'),
    exportTripReceiptPdf: (tripId: string) => requestBlob(`/reports/export/pdf/trip/${encodeURIComponent(tripId)}`),
  },

  vehicles: {
    getAll: async () => (await request<Vehicle[]>('/vehicles')).map(fromApiVehicle),
    create: async (data: any) => fromApiVehicle(await request<Vehicle>('/vehicles', {
      method: 'POST',
      body: JSON.stringify({ ...data, type: toApiVehicleType(data.type) }),
    })),
    update: async (id: string, data: any) =>
      fromApiVehicle(await request<Vehicle>(`/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          ...(data.type ? { type: toApiVehicleType(data.type) } : {}),
        }),
      })),
    updateStatus: async (id: string, status: string) =>
      fromApiVehicle(await request<Vehicle>(`/vehicles/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })),
    retire: async (id: string) => request<{ message: string }>(`/vehicles/${id}`, { method: 'DELETE' }),
  },

  drivers: {
    getAll: async () => (await request<Driver[]>('/drivers')).map(fromApiDriver),
    create: async (data: any) => fromApiDriver(await request<Driver>('/drivers', {
      method: 'POST',
      body: JSON.stringify(data),
    })),
    update: async (id: string, data: any) =>
      fromApiDriver(await request<Driver>(`/drivers/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          ...(data.status ? { status: toApiDriverStatus(data.status) } : {}),
        }),
      })),
    toggleSuspension: async (id: string) =>
      fromApiDriver(await request<Driver>(`/drivers/${id}/toggle-suspension`, { method: 'PUT' })),
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
    cancel: async (id: string) => request<Trip>(`/trips/${id}/cancel`, { method: 'POST' }),
  },

  maintenance: {
    getAll: async () => request<MaintenanceRecord[]>('/maintenance'),
    create: async (data: any) => request<MaintenanceRecord>('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
    close: async (id: string, finalCost?: number, notes?: string) =>
      request<MaintenanceRecord>(`/maintenance/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ finalCost, technicianNotes: notes }),
      }),
  },

  expenses: {
    getAll: async () => (await request<FuelExpenseRecord[]>('/expenses')).map(fromApiExpense),
    create: async (data: any) => fromApiExpense(await request<FuelExpenseRecord>('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        vehicleId: data.vehicleId,
        tripId: data.tripId,
        type: data.type ?? data.category ?? 'Other',
        amount: data.amount ?? data.cost,
        liters: data.liters ?? data.fuelLiters,
        odometerReading: data.odometerReading,
        expenseDate: data.expenseDate ?? data.date,
        notes: data.notes ?? data.description,
      }),
    })),
    delete: async (id: string) => request<{ message: string }>(`/expenses/${id}`, { method: 'DELETE' }),
  },

  kpi: {
    getFleet: async () => request<any>('/kpi/fleet'),
    getDriver: async () => request<any>('/kpi/driver'),
    getSafety: async () => request<any>('/kpi/safety'),
    getFinancial: async () => request<FinancialKpis>('/kpi/financial'),
  },

  docs: {
    getPostmanUrl: () => `${API_BASE}/docs/postman`,
    getSwaggerUrl: () => `${API_BASE}/docs/swagger.json`,
  },

};
