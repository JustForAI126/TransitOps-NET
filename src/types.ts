export type UserRole =
  | 'fleet_manager'
  | 'driver'
  | 'safety_officer'
  | 'financial_analyst';

export type VehicleStatus = 'Available' | 'On Trip' | 'In Shop' | 'Retired';

export type VehicleType =
  | 'Van'
  | 'Truck'
  | 'Heavy Truck'
  | 'Light Commercial'
  | 'Container Carrier'
  | 'Flatbed'
  | 'Pickup'
  | 'SemiTrailer'
  | 'BoxTruck';

export type DriverStatus =
  | 'Available'
  | 'On Trip'
  | 'On Duty'
  | 'Off Duty'
  | 'Suspended';

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
  acquisitionCost: number;
  status: VehicleStatus | string;
  region: string;
  revenueGenerated: number;
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
  revenue: number;
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
