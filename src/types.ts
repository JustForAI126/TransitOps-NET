export type UserRole =
  | 'organization_admin'
  | 'fleet_manager'
  | 'driver'
  | 'safety_officer'
  | 'financial_analyst';

export type VehicleStatus = 'Available' | 'On Trip' | 'In Shop' | 'Retired';

export type VehicleType =
  | 'Van'
  | 'Truck'
  | 'Heavy Truck'
  | 'Pickup'
  | 'Semi-Trailer'
  | 'Box Truck';

export type DriverStatus =
  | 'Available'
  | 'On Trip'
  | 'On Duty'
  | 'Off Duty'
  | 'Suspended';

export const INDIAN_LICENSE_CATEGORIES = [
  { value: 'MCWG', label: 'MCWG — Motorcycle with Gear' },
  { value: 'MCWOG', label: 'MCWOG — Motorcycle without Gear' },
  { value: 'LMV', label: 'LMV — Light Motor Vehicle' },
  { value: 'LMV-NT', label: 'LMV-NT — Light Motor Vehicle (Non-Transport)' },
  { value: 'LMV-TR', label: 'LMV-TR — Light Motor Vehicle (Transport)' },
  { value: 'HMV', label: 'HMV — Heavy Motor Vehicle' },
  { value: 'HGMV', label: 'HGMV — Heavy Goods Motor Vehicle' },
  { value: 'HPMV', label: 'HPMV — Heavy Passenger Motor Vehicle' },
  { value: 'HTV', label: 'HTV — Heavy Transport Vehicle' },
] as const;

export type TripStatus = 'Draft' | 'Dispatched' | 'Completed' | 'Cancelled';

export type MaintenanceStatus = 'Active' | 'Completed';

export type ExpenseType =
  | 'Fuel'
  | 'Toll'
  | 'Maintenance'
  | 'Permit'
  | 'Insurance'
  | 'Other';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  isDemoAccount?: boolean;
  avatarUrl?: string;
}

export interface OrganizationUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  driverId: string | null;
}

export interface VehicleDocument {
  type: string;
  expiryDate: string;
  status: 'Valid' | 'Warning' | 'Expired' | 'Expiring Soon' | string;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  name: string;
  model: string;
  type: VehicleType | string;
  maxCapacityKg: number;
  currentOdometerKm: number;
  acquisitionCost: number | null;
  status: VehicleStatus | string;
  region: string;
  revenueGenerated: number | null;
  fuelEfficiencyKmPerLiter: number;
  documents: VehicleDocument[];
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiryDate: string;
  contactNumber: string;
  safetyScore: number;
  status: DriverStatus | string;
  email: string;
  tripsCount: number;
  incidentHistoryCount: number;
  totalTripsCompleted?: number;
}

export interface Trip {
  id: string;
  tripCode: string;
  source: string;
  destination: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleName: string;
  driverId: string;
  driverName: string;
  cargoWeightKg: number;
  plannedDistanceKm: number;
  revenue: number | null;
  status: TripStatus | string;
  createdAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  finalOdometerKm?: number;
  fuelConsumedLiters?: number;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehicleRegNumber: string;
  vehicleName: string;
  serviceType: string;
  description: string;
  cost: number;
  date: string;
  startDate?: string;
  completedDate?: string;
  completedAt?: string;
  status: MaintenanceStatus | string;
  technicianNotes?: string;
}

export interface FuelExpenseRecord {
  id: string;
  vehicleId: string;
  vehicleRegNumber?: string;
  vehicleName?: string;
  type?: ExpenseType | string;
  category?: string;
  cost?: number;
  amount?: number;
  date: string;
  expenseDate?: string;
  liters?: number;
  fuelLiters?: number;
  description?: string;
  odometerReading?: number;
  notes?: string;
}

export type ExpenseRecord = FuelExpenseRecord;

export interface KPIStats {
  activeVehicles?: number;
  availableVehicles?: number;
  vehiclesInMaintenance?: number;
  activeTrips?: number;
  pendingTrips?: number;
  driversOnDuty?: number;
  fleetUtilization?: number;
  activeFleetCount?: number;
  maintenanceAlerts?: number;
  utilizationRate?: number;
  pendingCargoTrips?: number;
  completedTripsTotal?: number;
  expiredLicenses?: number;
  averageSafetyScore?: number;
  totalRevenue?: number;
}
