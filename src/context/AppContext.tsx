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
import {
  initialVehicles,
  initialDrivers,
  initialTrips,
  initialMaintenanceRecords,
  initialFuelExpenses,
} from '../data/initialData';
import { api, setAuthToken } from '../services/api';
import { realtime } from '../services/signalr';

export type ActiveView =
  | 'hero'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'vehicles'
  | 'drivers'
  | 'trips'
  | 'maintenance'
  | 'expenses'
  | 'reports'
  | 'analytics';

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
  setUserRole: (role: UserRole) => void;
  isAuthenticated: boolean;
  login: (email: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, role: UserRole) => Promise<void>;

  // Data Collections
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  maintenanceRecords: MaintenanceRecord[];
  expenses: FuelExpenseRecord[];
  isLoadingData: boolean;
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
  updateVehicle: (id: string, data: Partial<Vehicle>) => void;
  retireVehicle: (id: string) => Promise<void>;

  addDriver: (data: Omit<Driver, 'id' | 'tripsCount' | 'incidentHistoryCount'>) => Promise<{ success: boolean; error?: string }>;
  updateDriver: (id: string, data: Partial<Driver>) => void;
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
  cancelTrip: (tripId: string) => { success: boolean; error?: string };

  createMaintenanceRecord: (data: {
    vehicleId: string;
    serviceType: MaintenanceRecord['serviceType'];
    description: string;
    cost: number;
    technicianNotes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  closeMaintenanceRecord: (id: string, finalCost?: number, notes?: string) => Promise<{ success: boolean; error?: string }>;

  addExpense: (data: Omit<FuelExpenseRecord, 'id'>) => Promise<void>;
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
  loadSampleWorkspaceData: () => Promise<void>;
  showSplashAgain: () => void;
  isSplashActive: boolean;
  dismissSplash: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Splash Screen State
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true);

  // Auth & View State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('transitops_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [userRole, setUserRoleState] = useState<UserRole>(() => {
    return currentUser?.role || 'fleet_manager';
  });

  const [activeView, setActiveView] = useState<ActiveView>(() => {
    return currentUser ? 'dashboard' : 'hero';
  });

  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

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
    const token = localStorage.getItem('transitops_token');
    if (!token) return;

    api.auth.me()
      .then((userProfile: any) => {
        if (userProfile && (userProfile.id || userProfile.email)) {
          setCurrentUser((prev) => ({
            id: userProfile.id || prev?.id || `usr-${Date.now()}`,
            name: userProfile.fullName || userProfile.name || prev?.name || 'Operator',
            email: userProfile.email || prev?.email || '',
            role: (userProfile.role as UserRole) || prev?.role || 'fleet_manager',
            tenantId: userProfile.tenantId || prev?.tenantId || 'demo_tenant',
            isDemoAccount: userProfile.isDemoAccount ?? prev?.isDemoAccount ?? false,
          }));
        }
      })
      .catch((err) => {
        console.warn('[TransitOps Session] Token expired or invalid:', err);
        setAuthToken(null);
        setCurrentUser(null);
        setNotifications([]);
        setActiveView('login');
      });
  }, []);

  // Fetch operational data from API
  const refreshData = useCallback(async () => {
    if (!currentUser) {
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);
      return;
    }

    const isDemo =
      currentUser.isDemoAccount === true ||
      currentUser.email?.toLowerCase().endsWith('@transitops.com');

    setIsLoadingData(true);
    try {
      const [v, d, t, m, e] = await Promise.all([
        api.vehicles.getAll(),
        api.drivers.getAll(),
        api.trips.getAll(),
        api.maintenance.getAll(),
        api.expenses.getAll(),
      ]);

      // If this is a demo account and backend returned 0 items, seed demo data
      if (isDemo && Array.isArray(v) && v.length === 0) {
        setVehicles(initialVehicles);
        setDrivers(initialDrivers);
        setTrips(initialTrips);
        setMaintenanceRecords(initialMaintenanceRecords);
        setExpenses(initialFuelExpenses);
      } else {
        setVehicles(Array.isArray(v) ? v : []);
        setDrivers(Array.isArray(d) ? d : []);
        setTrips(Array.isArray(t) ? t : []);
        setMaintenanceRecords(Array.isArray(m) ? m : []);
        setExpenses(Array.isArray(e) ? e : []);
      }
    } catch (err) {
      console.warn('[TransitOps API] Fallback fetch handler:', err);
      if (isDemo) {
        setVehicles(initialVehicles);
        setDrivers(initialDrivers);
        setTrips(initialTrips);
        setMaintenanceRecords(initialMaintenanceRecords);
        setExpenses(initialFuelExpenses);
      } else {
        // Newly created accounts are strictly kept clean with 0 seeded items
        setVehicles([]);
        setDrivers([]);
        setTrips([]);
        setMaintenanceRecords([]);
        setExpenses([]);
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser]);

  // Connect to live real-time SignalR / SSE with strict tenant and user notification isolation
  useEffect(() => {
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
      unsubNotif();
      realtime.disconnect();
    };
  }, [refreshData, addNotification, currentUser]);

  // Load user-isolated data & notifications when currentUser changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('transitops_user', JSON.stringify(currentUser));
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
      localStorage.removeItem('transitops_user');
      setNotifications([]);
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);
    }
  }, [currentUser, refreshData]);

  const setUserRole = (role: UserRole) => {
    setUserRoleState(role);
    if (currentUser) {
      const updated = { ...currentUser, role };
      setCurrentUser(updated);
      localStorage.setItem('transitops_user', JSON.stringify(updated));
    }
  };

  const login = async (email: string, role: UserRole = 'fleet_manager'): Promise<boolean> => {
    // Clear notifications from any previous session so they never bleed into another account
    setNotifications([]);

    try {
      const res = await api.auth.login(email, role);
      const isDemo = res.user.isDemoAccount ?? (email.toLowerCase().endsWith('@transitops.com'));
      const user: UserAccount = {
        id: res.user.id,
        name: res.user.fullName || res.user.name,
        email: res.user.email,
        role: (res.user.role as UserRole) || role,
        avatarUrl: res.user.avatarUrl,
        tenantId: res.user.tenantId || (isDemo ? 'demo_tenant' : `tenant_${res.user.id}`),
        isDemoAccount: isDemo,
      };

      setCurrentUser(user);
      setUserRoleState(user.role);
      setActiveView('dashboard');

      addNotification(
        'success',
        'Signed In',
        `Welcome to TransitOps, ${user.name}! Workspace loaded.`,
        4000
      );
      return true;
    } catch {
      // Local fallback for offline mode
      const isDemo = email.toLowerCase().endsWith('@transitops.com');
      const name = email.split('@')[0].replace('.', ' ');
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

      const user: UserAccount = {
        id: `usr-${Date.now()}`,
        name: formattedName || 'Alex Morgan',
        email,
        role,
        tenantId: isDemo ? 'demo_tenant' : `tenant_${Date.now()}`,
        isDemoAccount: isDemo,
      };

      setCurrentUser(user);
      setUserRoleState(role);
      setActiveView('dashboard');

      if (isDemo) {
        setVehicles(initialVehicles);
        setDrivers(initialDrivers);
        setTrips(initialTrips);
        setMaintenanceRecords(initialMaintenanceRecords);
        setExpenses(initialFuelExpenses);
      } else {
        setVehicles([]);
        setDrivers([]);
        setTrips([]);
        setMaintenanceRecords([]);
        setExpenses([]);
      }

      addNotification('success', 'Logged In', `Welcome back, ${formattedName}!`, 4000);
      return true;
    }
  };

  const logout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setNotifications([]); // Clear all toasts on logout
    setActiveView('hero');
    addNotification('info', 'Signed Out', 'You have been safely signed out.', 3000);
  };

  const register = async (name: string, email: string, role: UserRole) => {
    // Clear previous toasts so new account starts with clean view
    setNotifications([]);

    try {
      const res = await api.auth.register(name, email, role);
      const user: UserAccount = {
        id: res.user.id,
        name: res.user.fullName,
        email: res.user.email,
        role: (res.user.role as UserRole) || role,
        tenantId: res.user.tenantId || `tenant_${res.user.id}`,
        isDemoAccount: false,
      };

      setCurrentUser(user);
      setUserRoleState(role);
      setActiveView('dashboard');

      // Newly registered accounts start with isolated clean state
      setVehicles([]);
      setDrivers([]);
      setTrips([]);
      setMaintenanceRecords([]);
      setExpenses([]);

      addNotification(
        'success',
        'Workspace Provisioned',
        `Welcome ${name}! Your private fleet workspace is ready. Seeded demo data is hidden.`,
        5000
      );
    } catch (err: any) {
      addNotification('error', 'Registration Failed', err.message || 'Could not register account.', 4000);
    }
  };

  const loadSampleWorkspaceData = async () => {
    try {
      setIsLoadingData(true);
      await api.workspace.loadSampleData();
      await refreshData();
      addNotification('success', 'Sample Fleet Loaded', 'Sample logistics fleet assets provisioned into your private workspace.');
    } catch {
      setVehicles(JSON.parse(JSON.stringify(initialVehicles)));
      setDrivers(JSON.parse(JSON.stringify(initialDrivers)));
      setTrips(JSON.parse(JSON.stringify(initialTrips)));
      setMaintenanceRecords(JSON.parse(JSON.stringify(initialMaintenanceRecords)));
      setExpenses(JSON.parse(JSON.stringify(initialFuelExpenses)));
      addNotification('success', 'Sample Fleet Loaded', 'Sample logistics fleet assets loaded.');
    } finally {
      setIsLoadingData(false);
    }
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

  const updateVehicle = (id: string, data: Partial<Vehicle>) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...data } : v)));
  };

  const updateVehicleStatus = async (id: string, status: Vehicle['status']) => {
    try {
      await api.vehicles.updateStatus(id, status);
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
    } catch {
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
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

  const updateDriver = (id: string, data: Partial<Driver>) => {
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
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
    if (driver.status === 'Suspended' || isExpired) {
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

  const cancelTrip = (tripId: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, error: 'Trip not found' };

    setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, status: 'Cancelled' } : t)));
    if (trip.status === 'Dispatched') {
      setVehicles((prev) => prev.map((v) => (v.id === trip.vehicleId && v.status === 'On Trip' ? { ...v, status: 'Available' } : v)));
      setDrivers((prev) => prev.map((d) => (d.id === trip.driverId && d.status === 'On Trip' ? { ...d, status: 'Available' } : d)));
    }
    addNotification('info', 'Trip Cancelled', `Trip ${trip.tripCode} marked as Cancelled.`);
    return { success: true };
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
    } catch (err: any) {
      addNotification('error', 'Error Logging Expense', err.message);
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
    const driversOnDuty = drivers.filter((d) => d.status === 'On Trip' || d.status === 'Available').length;
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
    const acqCost = vehicle ? vehicle.acquisitionCost : 0;
    const rev = vehicle ? vehicle.revenueGenerated : 0;

    const maintCost = maintenanceRecords
      .filter((m) => m.vehicleId === vehicleId)
      .reduce((sum, m) => sum + m.cost, 0);

    const fuelCost = expenses
      .filter((e) => e.vehicleId === vehicleId && (e.type || e.category) === 'Fuel')
      .reduce((sum, e) => sum + (e.cost || e.amount || 0), 0);

    const profit = rev - (acqCost + maintCost + fuelCost);
    const totalInvested = acqCost + maintCost + fuelCost;
    const roiPercent = totalInvested > 0 ? Math.round((profit / totalInvested) * 100) : 0;

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
        setUserRole,
        isAuthenticated: !!currentUser,
        login,
        logout,
        register,

        vehicles,
        drivers,
        trips,
        maintenanceRecords,
        expenses,
        isLoadingData,
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
        loadSampleWorkspaceData,

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
