import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserRole,
  UserAccount,
  Vehicle,
  Driver,
  Trip,
  MaintenanceRecord,
  FuelExpenseRecord,
  KPIStats,
} from '../types';
import { ApiRequestError, api } from '../services/api';
import { realtime } from '../services/signalr';

export type ActiveView =
  | 'hero'
  | 'login'
  | 'organization_admin'
  | 'dashboard'
  | 'vehicles'
  | 'drivers'
  | 'trips'
  | 'maintenance'
  | 'expenses'
  | 'reports'
  | 'analytics';

const viewPaths: Record<ActiveView, string> = {
  hero: '/',
  login: '/login',
  organization_admin: '/admin',
  dashboard: '/dashboard',
  vehicles: '/vehicles',
  drivers: '/drivers',
  trips: '/trips',
  maintenance: '/maintenance',
  expenses: '/expenses',
  reports: '/reports',
  analytics: '/analytics',
};

const viewFromPath = (): ActiveView => {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  return (Object.entries(viewPaths).find(([, path]) => path === currentPath)?.[0] as ActiveView | undefined)
    ?? (currentPath === '/' ? 'hero' : 'dashboard');
};

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  duration?: number;
  userId?: string;
  tenantId?: string;
}

interface AppContextType {
  // Navigation & Auth
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  userRole: UserRole;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Data Collections
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  maintenanceRecords: MaintenanceRecord[];
  expenses: FuelExpenseRecord[];
  isLoadingData: boolean;
  dataLoadError: string | null;
  refreshData: () => Promise<void>;

  // Filter State
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedRegion: string;
  setSelectedRegion: (r: string) => void;
  selectedVehicleType: string;
  setSelectedVehicleType: (t: string) => void;

  // Notifications
  notifications: AppNotification[];
  dismissNotification: (id: string) => void;
  addNotification: (type: AppNotification['type'], title: string, message: string, duration?: number) => void;

  // Business Operations
  addVehicle: (data: Omit<Vehicle, 'id' | 'createdAt' | 'revenueGenerated' | 'fuelEfficiencyKmPerLiter'>) => Promise<{ success: boolean; error?: string }>;
  updateVehicle: (id: string, data: Partial<Vehicle>) => Promise<void>;
  retireVehicle: (id: string) => Promise<void>;

  addDriver: (data: Omit<Driver, 'id' | 'tripsCount' | 'incidentHistoryCount'>) => Promise<{ success: boolean; error?: string }>;
  updateDriver: (id: string, data: Partial<Driver>) => Promise<void>;
  toggleDriverSuspension: (id: string) => Promise<void>;
  sendLicenseReminderEmail: (driverId: string) => Promise<void>;

  createTrip: (data: {
    source: string;
    destination: string;
    vehicleId: string;
    driverId: string;
    cargoWeightKg: number;
    plannedDistanceKm: number;
    revenue?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  dispatchTrip: (tripId: string) => Promise<{ success: boolean; error?: string }>;
  completeTrip: (tripId: string, finalOdometerKm: number, fuelConsumedLiters: number) => Promise<{ success: boolean; error?: string }>;
  cancelTrip: (tripId: string) => Promise<{ success: boolean; error?: string }>;

  createMaintenanceRecord: (data: {
    vehicleId: string;
    serviceType: MaintenanceRecord['serviceType'];
    description: string;
    cost: number;
    technicianNotes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  closeMaintenanceRecord: (id: string, finalCost?: number, notes?: string) => Promise<{ success: boolean; error?: string }>;

  addExpense: (data: Omit<FuelExpenseRecord, 'id'>) => Promise<{ success: boolean; error?: string }>;
  deleteExpense: (id: string) => Promise<void>;

  // Computed Values & Helpers
  getKPIStats: () => KPIStats;
  getVehicleTotalCost: (vehicleId: string) => number;
  getVehicleROI: (vehicle: Vehicle) => number;
  calculateVehicleROI: (vehicleId: string) => {
    acquisitionCost: number;
    revenue: number;
    maintenanceCost: number;
    fuelCost: number;
    profit: number;
    roiPercent: number;
  };
  updateVehicleStatus: (id: string, status: Vehicle['status']) => Promise<void>;
  exportToCSV: (filename: string, rows: Record<string, any>[]) => void;
  showSplashAgain: () => void;
  isSplashActive: boolean;
  dismissSplash: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Splash Screen State
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);

  // Auth & View State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const userRole = currentUser?.role ?? 'driver';

  const [activeView, setActiveViewState] = useState<ActiveView>(viewFromPath);
  const setActiveView = useCallback((view: ActiveView) => {
    setActiveViewState(view);
    const path = viewPaths[view];
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, []);

  useEffect(() => {
    const syncViewFromLocation = () => setActiveViewState(viewFromPath());
    window.addEventListener('popstate', syncViewFromLocation);
    return () => window.removeEventListener('popstate', syncViewFromLocation);
  }, []);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  // Operational Data: Initialized according to user state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [expenses, setExpenses] = useState<FuelExpenseRecord[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedVehicleType, setSelectedVehicleType] = useState('All');

  // Notifications - Initialized clean (no hardcoded notifications across accounts)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const getNotifStorageKey = useCallback(() => {
    if (!currentUser?.email) return 'transitops_notifs_guest';
    return `transitops_notifs_${currentUser.tenantId || 'tenant'}_${currentUser.email}`;
  }, [currentUser]);

  const addNotification = useCallback((
    type: AppNotification['type'],
    title: string,
    message: string,
    duration: number = 4500
  ) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const userTarget = currentUser?.id || currentUser?.email || 'user';
    const newNotif: AppNotification = {
      id,
      type,
      title,
      message,
      timestamp: 'Just now',
      duration,
      userId: userTarget,
      tenantId: currentUser?.tenantId,
    };

    setNotifications((prev) => {
      const updated = [newNotif, ...prev.slice(0, 9)];
      try {
        localStorage.setItem(getNotifStorageKey(), JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Automatic dismissal timer fallback
    setTimeout(() => {
      setNotifications((prev) => {
        const remaining = prev.filter((n) => n.id !== id);
        try {
          localStorage.setItem(getNotifStorageKey(), JSON.stringify(remaining));
        } catch {}
        return remaining;
      });
    }, duration + 300);
  }, [currentUser, getNotifStorageKey]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      try {
        localStorage.setItem(getNotifStorageKey(), JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
  }, [getNotifStorageKey]);

  // Session verification on mount
  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then((profile) => {
        if (cancelled) return;
        const user: UserAccount = {
          id: profile.id,
          name: profile.fullName,
          email: profile.email,
          role: profile.role,
          tenantId: profile.tenantId,
          isDemoAccount: profile.isDemoAccount,
          avatarUrl: profile.avatarUrl,
        };
        setCurrentUser(user);
        setActiveView(profile.role === 'organization_admin' ? 'organization_admin' : 'dashboard');
      })
      .catch((err) => {
        if (!(err instanceof ApiRequestError && err.status === 401)) {
          console.error('[TransitOps Session] Could not verify the current session:', err);
        }
        if (cancelled) return;
        setCurrentUser(null);
        setNotifications([]);
        setActiveView(viewFromPath() === 'hero' ? 'hero' : 'login');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch operational data from API
  const refreshData = useCallback(async () => {
    if (!currentUser) {
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);
      setDataLoadError(null);
      return;
    }

    if (currentUser.role === 'organization_admin') {
      setIsLoadingData(false);
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);
      setDataLoadError(null);
      return;
    }

    setIsLoadingData(true);
    try {
      const [v, d, t, m, e] = await Promise.all([
        api.vehicles.getAll(),
        ['fleet_manager', 'safety_officer'].includes(currentUser.role)
          ? api.drivers.getAll()
          : Promise.resolve([]),
        ['fleet_manager', 'driver', 'financial_analyst'].includes(currentUser.role)
          ? api.trips.getAll()
          : Promise.resolve([]),
        ['fleet_manager', 'safety_officer'].includes(currentUser.role)
          ? api.maintenance.getAll()
          : Promise.resolve([]),
        ['fleet_manager', 'financial_analyst'].includes(currentUser.role)
          ? api.expenses.getAll()
          : Promise.resolve([]),
      ]);
      setVehicles(Array.isArray(v) ? v : []);
      setDrivers(Array.isArray(d) ? d : []);
      setTrips(Array.isArray(t) ? t : []);
      setMaintenanceRecords(Array.isArray(m) ? m : []);
      setExpenses(Array.isArray(e) ? e : []);
      setDataLoadError(null);
    } catch (err) {
      console.error('[TransitOps API] Could not load persisted workspace data:', err);
      setDataLoadError('Workspace data could not be loaded. Check the API connection and retry.');
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);
      addNotification('error', 'Workspace Load Failed', 'Could not load current workspace data. Retry the request.');
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser, addNotification]);

  // Connect SignalR only for an authenticated user's tenant.
  useEffect(() => {
    if (!currentUser) {
      realtime.disconnect();
      return;
    }

    realtime.connect();

    const unsubDispatch = realtime.on('trip_dispatched', (data: any) => {
      if (data?.tenantId && currentUser?.tenantId && data.tenantId !== currentUser.tenantId) {
        return;
      }
      refreshData();
    });

    const unsubComplete = realtime.on('trip_completed', (data: any) => {
      if (data?.tenantId && currentUser?.tenantId && data.tenantId !== currentUser.tenantId) {
        return;
      }
      refreshData();
    });

    const unsubVehicle = realtime.on('vehicle_status', (data: any) => {
      if (data?.tenantId && currentUser?.tenantId && data.tenantId !== currentUser.tenantId) {
        return;
      }
      refreshData();
    });
    const unsubDriver = realtime.on('driver_status', refreshData);
    const unsubMaintenance = realtime.on('maintenance_updated', refreshData);
    const unsubExpense = realtime.on('expense_updated', refreshData);

    const unsubNotif = realtime.on('notification', (notif: any) => {
      // Discard notifications meant for other tenants
      if (notif?.tenantId && currentUser?.tenantId && notif.tenantId !== currentUser.tenantId) {
        return;
      }
      // Discard notifications targeted to a different specific user
      if (notif?.userId && currentUser?.id && notif.userId !== currentUser.id && notif.userId !== currentUser.email) {
        return;
      }
      addNotification(notif.type || 'info', notif.title, notif.message);
    });

    return () => {
      unsubDispatch();
      unsubComplete();
      unsubVehicle();
      unsubDriver();
      unsubMaintenance();
      unsubExpense();
      unsubNotif();
      realtime.disconnect();
    };
  }, [refreshData, addNotification, currentUser]);

  // Load user-isolated data & notifications when currentUser changes
  useEffect(() => {
    if (currentUser) {
      // Load strictly this user and tenant's isolated notifications
      try {
        const notifKey = `transitops_notifs_${currentUser.tenantId || 'tenant'}_${currentUser.email}`;
        const savedNotifs = localStorage.getItem(notifKey);
        setNotifications(savedNotifs ? JSON.parse(savedNotifs) : []);
      } catch {
        setNotifications([]);
      }
      refreshData();
    } else {
      setNotifications([]);
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);
    }
  }, [currentUser, refreshData]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Clear notifications from any previous session so they never bleed into another account
    setNotifications([]);

    try {
      const profile = await api.auth.login(email, password);
      const isDemo = profile.isDemoAccount;
      const user: UserAccount = {
        id: profile.id,
        name: profile.fullName,
        email: profile.email,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        tenantId: profile.tenantId,
        isDemoAccount: isDemo,
      };

      setCurrentUser(user);
      setActiveView(user.role === 'organization_admin' ? 'organization_admin' : 'dashboard');

      addNotification(
        'success',
        'Signed In',
        `Welcome to TransitOps, ${user.name}! Workspace loaded.`,
        4000
      );
      return { success: true };
    } catch (err) {
      const message = err instanceof ApiRequestError && err.status === 401
        ? 'The email address or password is incorrect.'
        : err instanceof ApiRequestError && err.status >= 500
          ? 'The sign-in service is temporarily unavailable. Please try again.'
          : err instanceof TypeError
            ? 'Unable to reach the sign-in service. Check your connection and try again.'
            : 'Unable to sign in. Check your details and try again.';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('[TransitOps Session] Server sign-out failed:', err);
    }
    setCurrentUser(null);
    setNotifications([]); // Clear all toasts on logout
    setActiveView('login');
    addNotification('info', 'Signed Out', 'You have been safely signed out.', 3000);
  };

  // Business Operations
  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt' | 'revenueGenerated' | 'fuelEfficiencyKmPerLiter'>) => {
    const cleanReg = data.registrationNumber.trim().toUpperCase();
    const existing = vehicles.find((v) => v.registrationNumber.toUpperCase() === cleanReg);
    if (existing) {
      addNotification('error', 'Validation Error', `Registration "${cleanReg}" already exists.`);
      return { success: false, error: `Registration "${cleanReg}" already exists.` };
    }

    try {
      const newV = await api.vehicles.create({
        ...data,
        registrationNumber: cleanReg,
      });

      setVehicles((prev) => [newV, ...prev]);
      addNotification('success', 'Vehicle Registered', `${newV.name} (${cleanReg}) added to fleet.`);
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Error Registering Vehicle', err.message);
      return { success: false, error: err.message };
    }
  };

  const updateVehicle = async (id: string, data: Partial<Vehicle>) => {
    try {
      const updated = await api.vehicles.update(id, data);
      setVehicles((prev) => prev.map((vehicle) => vehicle.id === id ? updated : vehicle));
    } catch (err) {
      addNotification('error', 'Vehicle Update Failed', err instanceof Error ? err.message : 'Vehicle could not be updated.');
    }
  };

  const updateVehicleStatus = async (id: string, status: Vehicle['status']) => {
    try {
      const updated = await api.vehicles.updateStatus(id, status);
      setVehicles((prev) => prev.map((vehicle) => vehicle.id === id ? updated : vehicle));
    } catch (err) {
      addNotification('error', 'Vehicle Status Update Failed', err instanceof Error ? err.message : 'Vehicle status could not be updated.');
    }
  };

  const retireVehicle = async (id: string) => {
    try {
      await api.vehicles.retire(id);
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'Retired' } : v)));
      addNotification('warning', 'Vehicle Retired', 'Vehicle moved to Retired status.');
    } catch (err: any) {
      addNotification('error', 'Retire Error', err.message);
    }
  };

  const addDriver = async (data: Omit<Driver, 'id' | 'tripsCount' | 'incidentHistoryCount'>) => {
    const cleanLic = data.licenseNumber.trim().toUpperCase();
    const existing = drivers.find((d) => d.licenseNumber.toUpperCase() === cleanLic);
    if (existing) {
      addNotification('error', 'Driver Error', `License ${cleanLic} already exists.`);
      return { success: false, error: 'License number already registered.' };
    }

    try {
      const newD = await api.drivers.create({
        ...data,
        licenseNumber: cleanLic,
      });
      setDrivers((prev) => [newD, ...prev]);
      addNotification('success', 'Driver Added', `${newD.name} registered.`);
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Error Adding Driver', err.message);
      return { success: false, error: err.message };
    }
  };

  const updateDriver = async (id: string, data: Partial<Driver>) => {
    try {
      const updated = await api.drivers.update(id, data);
      setDrivers((prev) => prev.map((driver) => driver.id === id ? updated : driver));
    } catch (err) {
      addNotification('error', 'Driver Update Failed', err instanceof Error ? err.message : 'Driver could not be updated.');
    }
  };

  const toggleDriverSuspension = async (id: string) => {
    try {
      const updated = await api.drivers.toggleSuspension(id);
      setDrivers((prev) => prev.map((d) => (d.id === id ? updated : d)));
      addNotification(
        updated.status === 'Suspended' ? 'error' : 'success',
        'Driver Status Updated',
        `${updated.name} is now ${updated.status}.`
      );
    } catch (err: any) {
      addNotification('error', 'Error', err.message);
    }
  };

  const sendLicenseReminderEmail = async (driverId: string) => {
    try {
      const res = await api.drivers.sendReminder(driverId);
      addNotification('info', 'Compliance Reminder Sent', res.message);
    } catch (err: any) {
      addNotification('error', 'Error', err.message);
    }
  };

  const createTrip = async (data: {
    source: string;
    destination: string;
    vehicleId: string;
    driverId: string;
    cargoWeightKg: number;
    plannedDistanceKm: number;
    revenue?: number;
  }) => {
    const vehicle = vehicles.find((v) => v.id === data.vehicleId);
    if (!vehicle) return { success: false, error: 'Vehicle not found' };

    const driver = drivers.find((d) => d.id === data.driverId);
    if (!driver) return { success: false, error: 'Driver not found' };

    // Rule 1: Never Overload Cargo
    if (data.cargoWeightKg > vehicle.maxCapacityKg) {
      const err = `Cargo payload (${data.cargoWeightKg.toLocaleString()} kg) exceeds vehicle max capacity (${vehicle.maxCapacityKg.toLocaleString()} kg).`;
      addNotification('error', 'Cargo Overload Blocked', err);
      return { success: false, error: err };
    }

    // Rule 2: Ground Expired or Suspended Drivers
    const isExpired = new Date(driver.licenseExpiryDate) < new Date();
    if (driver.status === 'Suspended' || driver.status === 'Off Duty' || driver.status === 'On Trip' || isExpired) {
      const err = 'Driver cannot be dispatched due to expired license or active suspension.';
      addNotification('error', 'Driver Grounded', err);
      return { success: false, error: err };
    }

    try {
      const newTrip = await api.trips.create(data);
      setTrips((prev) => [newTrip, ...prev]);
      addNotification('success', 'Trip Created', `Trip ${newTrip.tripCode} scheduled as Draft.`);
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Trip Creation Failed', err.message);
      return { success: false, error: err.message };
    }
  };

  const dispatchTrip = async (tripId: string) => {
    try {
      const updated = await api.trips.dispatch(tripId);
      setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));
      setVehicles((prev) => prev.map((v) => (v.id === updated.vehicleId ? { ...v, status: 'On Trip' } : v)));
      setDrivers((prev) => prev.map((d) => (d.id === updated.driverId ? { ...d, status: 'On Trip' } : d)));

      addNotification('success', 'Trip Dispatched', `Trip ${updated.tripCode} dispatched.`);
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Dispatch Error', err.message);
      return { success: false, error: err.message };
    }
  };

  const completeTrip = async (tripId: string, finalOdometerKm: number, fuelConsumedLiters: number) => {
    try {
      const updated = await api.trips.complete(tripId, finalOdometerKm, fuelConsumedLiters);
      setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)));

      // Refresh data so expenses and vehicle odometers sync cleanly
      await refreshData();

      addNotification('success', 'Trip Completed', `Trip ${updated.tripCode} completed successfully.`);
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Completion Error', err.message);
      return { success: false, error: err.message };
    }
  };

  const cancelTrip = async (tripId: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    try {
      const updated = await api.trips.cancel(tripId);
      setTrips((prev) => prev.map((item) => item.id === tripId ? updated : item));
      await refreshData();
      addNotification('info', 'Trip Cancelled', `Trip ${trip.tripCode} marked as Cancelled.`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trip could not be cancelled.';
      addNotification('error', 'Trip Cancellation Failed', message);
      return { success: false, error: message };
    }
  };

  const createMaintenanceRecord = async (data: {
    vehicleId: string;
    serviceType: MaintenanceRecord['serviceType'];
    description: string;
    cost: number;
    technicianNotes?: string;
  }) => {
    try {
      const rec = await api.maintenance.create(data);
      setMaintenanceRecords((prev) => [rec, ...prev]);
      setVehicles((prev) => prev.map((v) => (v.id === data.vehicleId ? { ...v, status: 'In Shop' } : v)));
      addNotification('warning', 'Work Order Created', `Vehicle placed In Shop for ${data.serviceType}.`);
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Error Creating Work Order', err.message);
      return { success: false, error: err.message };
    }
  };

  const closeMaintenanceRecord = async (id: string, finalCost?: number, notes?: string) => {
    try {
      const closed = await api.maintenance.close(id, finalCost, notes);
      setMaintenanceRecords((prev) => prev.map((m) => (m.id === id ? closed : m)));
      await refreshData();
      addNotification('success', 'Work Order Closed', 'Vehicle maintenance completed.');
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Error Closing Work Order', err.message);
      return { success: false, error: err.message };
    }
  };

  const addExpense = async (data: Omit<FuelExpenseRecord, 'id'>) => {
    try {
      const newExp = await api.expenses.create(data);
      setExpenses((prev) => [newExp, ...prev]);
      addNotification('success', 'Expense Logged', 'Expense recorded successfully.');
      return { success: true };
    } catch (err: any) {
      addNotification('error', 'Error Logging Expense', err.message);
      return { success: false, error: err instanceof Error ? err.message : 'Expense could not be saved.' };
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await api.expenses.delete(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      addNotification('info', 'Expense Removed', 'Expense item deleted.');
    } catch (err: any) {
      addNotification('error', 'Error', err.message);
    }
  };

  // KPIs & ROI Calculations (All in INR ₹)
  const getKPIStats = (): KPIStats => {
    const activeVehicles = vehicles.filter((v) => v.status === 'On Trip').length;
    const availableVehicles = vehicles.filter((v) => v.status === 'Available').length;
    const vehiclesInMaintenance = vehicles.filter((v) => v.status === 'In Shop').length;
    const activeTrips = trips.filter((t) => t.status === 'Dispatched').length;
    const pendingTrips = trips.filter((t) => t.status === 'Draft').length;
    const driversOnDuty = drivers.filter((driver) => driver.status === 'On Duty').length;
    const nonRetired = vehicles.filter((v) => v.status !== 'Retired').length;
    const fleetUtilization = nonRetired > 0 ? Math.round((activeVehicles / nonRetired) * 100) : 0;

    return {
      activeVehicles,
      availableVehicles,
      vehiclesInMaintenance,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      fleetUtilization,
    };
  };

  const getVehicleTotalCost = (vehicleId: string): number => {
    const maintCost = maintenanceRecords
      .filter((m) => m.vehicleId === vehicleId)
      .reduce((sum, m) => sum + m.cost, 0);

    const fuelCost = expenses
      .filter((e) => e.vehicleId === vehicleId)
      .reduce((sum, e) => sum + (e.cost || e.amount || 0), 0);

    return maintCost + fuelCost;
  };

  const calculateVehicleROI = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const acqCost = vehicle?.acquisitionCost ?? 0;
    const rev = vehicle?.revenueGenerated ?? 0;

    const maintCost = maintenanceRecords
      .filter((m) => m.vehicleId === vehicleId)
      .reduce((sum, m) => sum + m.cost, 0);

    const fuelCost = expenses
      .filter((e) => e.vehicleId === vehicleId && (e.type || e.category) === 'Fuel')
      .reduce((sum, e) => sum + (e.cost || e.amount || 0), 0);

    const profit = rev - (maintCost + fuelCost);
    const roiPercent = acqCost > 0 ? Math.round((profit / acqCost) * 100) : 0;

    return {
      acquisitionCost: acqCost,
      revenue: rev,
      maintenanceCost: maintCost,
      fuelCost,
      profit,
      roiPercent,
    };
  };

  const getVehicleROI = (vehicle: Vehicle): number => {
    const stats = calculateVehicleROI(vehicle.id);
    return stats.roiPercent;
  };

  const exportToCSV = (filename: string, rows: Record<string, any>[]) => {
    if (!rows.length) {
      addNotification('warning', 'Export Empty', 'No records found to export.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const val = row[header] ?? '';
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addNotification('success', 'CSV Export Complete', `Exported ${rows.length} rows to ${filename}.csv.`);
  };

  const showSplashAgain = () => setIsSplashActive(true);
  const dismissSplash = () => setIsSplashActive(false);

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        currentUser,
        setCurrentUser,
        userRole,
        isAuthenticated: !!currentUser,
        login,
        logout,

        vehicles,
        drivers,
        trips,
        maintenanceRecords,
        expenses,
        isLoadingData,
        dataLoadError,
        refreshData,

        searchQuery,
        setSearchQuery,
        selectedRegion,
        setSelectedRegion,
        selectedVehicleType,
        setSelectedVehicleType,

        notifications,
        dismissNotification,
        addNotification,

        addVehicle,
        updateVehicle,
        retireVehicle,

        addDriver,
        updateDriver,
        toggleDriverSuspension,
        sendLicenseReminderEmail,

        createTrip,
        dispatchTrip,
        completeTrip,
        cancelTrip,

        createMaintenanceRecord,
        closeMaintenanceRecord,

        addExpense,
        deleteExpense,

        getKPIStats,
        getVehicleTotalCost,
        getVehicleROI,
        calculateVehicleROI,
        updateVehicleStatus,
        exportToCSV,

        showSplashAgain,
        isSplashActive,
        dismissSplash,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
