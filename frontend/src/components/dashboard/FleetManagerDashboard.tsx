import React, { useState } from 'react';
import {
  Truck,
  CheckCircle2,
  Wrench,
  Navigation,
  Clock,
  Users,
  Percent,
  Download,
  Plus,
  Send,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Trip } from '../../types';
import { LiveRouteRadar } from './LiveRouteRadar';
import { formatRupees } from '../../utils/currency';

interface FleetManagerDashboardProps {
  onOpenNewTripModal: () => void;
  onOpenAddVehicleModal: () => void;
  onOpenLogMaintModal: () => void;
  onOpenCompleteTripModal: (trip: Trip) => void;
}

export const FleetManagerDashboard: React.FC<FleetManagerDashboardProps> = ({
  onOpenNewTripModal,
  onOpenAddVehicleModal,
  onOpenLogMaintModal,
  onOpenCompleteTripModal,
}) => {
  const {
    trips,
    drivers,
    vehicles,
    maintenanceRecords,
    dispatchTrip,
    cancelTrip,
    closeMaintenanceRecord,
    sendLicenseReminderEmail,
    exportToCSV,
    setActiveView,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');
  const filteredVehicles = vehicles.filter((vehicle) =>
    (vehicleTypeFilter === 'All' || vehicle.type === vehicleTypeFilter) &&
    (vehicleStatusFilter === 'All' || vehicle.status === vehicleStatusFilter) &&
    (regionFilter === 'All' || vehicle.region === regionFilter)
  );
  const filteredVehicleIds = new Set(filteredVehicles.map((vehicle) => vehicle.id));
  const filteredTrips = trips.filter((trip) => filteredVehicleIds.has(trip.vehicleId));
  const nonRetiredVehicles = filteredVehicles.filter((vehicle) => vehicle.status !== 'Retired').length;
  const activeVehicles = filteredVehicles.filter((vehicle) => vehicle.status === 'On Trip').length;
  const today = new Date().toISOString().split('T')[0];
  const kpis = {
    activeVehicles,
    availableVehicles: filteredVehicles.filter((vehicle) => vehicle.status === 'Available').length,
    vehiclesInMaintenance: filteredVehicles.filter((vehicle) => vehicle.status === 'In Shop').length,
    activeTrips: filteredTrips.filter((trip) => trip.status === 'Dispatched').length,
    pendingTrips: filteredTrips.filter((trip) => trip.status === 'Draft').length,
    driversOnDuty: drivers.filter((driver) => driver.status === 'On Duty').length,
    // Same eligibility the API applies when a trip is created: Available or On Duty with a valid licence.
    driversReady: drivers.filter((driver) =>
      (driver.status === 'Available' || driver.status === 'On Duty') && driver.licenseExpiryDate >= today).length,
    driversOnTrip: drivers.filter((driver) => driver.status === 'On Trip').length,
    driversTotal: drivers.length,
    fleetUtilization: nonRetiredVehicles > 0
      ? Math.round((activeVehicles / nonRetiredVehicles) * 1000) / 10
      : 0,
  };

  const expiringDrivers = drivers.filter((d) => {
    const diffDays = Math.ceil(
      (new Date(d.licenseExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24)
    );
    return diffDays > 0 && diffDays <= 30;
  });

  const expiredDrivers = drivers.filter(
    (d) => d.licenseExpiryDate < today || d.status === 'Suspended'
  );
  const activeMaintenance = maintenanceRecords.filter((m) => m.status === 'Active');

  const handleExportDashboard = () => {
    const summary = [
      { Metric: 'Active Vehicles (On Trip)', Value: kpis.activeVehicles },
      { Metric: 'Available Vehicles', Value: kpis.availableVehicles },
      { Metric: 'In Shop (Maintenance)', Value: kpis.vehiclesInMaintenance },
      { Metric: 'Active Trips', Value: kpis.activeTrips },
      { Metric: 'Pending / Draft Trips', Value: kpis.pendingTrips },
      { Metric: 'Drivers Ready for Dispatch', Value: kpis.driversReady },
      { Metric: 'Drivers On Duty', Value: kpis.driversOnDuty },
      { Metric: 'Drivers On Trip', Value: kpis.driversOnTrip },
      { Metric: 'Total Drivers', Value: kpis.driversTotal },
      { Metric: 'Fleet Utilization Rate (%)', Value: `${kpis.fleetUtilization}%` },
    ];
    exportToCSV('transitops-fleet-manager-kpis', summary);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span
              className={`font-semibold ${
                isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
              }`}
            >
              FLEET COMMAND TOWER
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Fleet Operations Control
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportDashboard}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-300'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export KPIs</span>
          </button>

          <button
            onClick={onOpenLogMaintModal}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-red-500/30 hover:bg-red-950/20 text-red-400'
                : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Log Maintenance</span>
          </button>

          <button
            onClick={onOpenAddVehicleModal}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vehicle</span>
          </button>

          <button
            onClick={onOpenNewTripModal}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
            }`}
          >
            <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Dispatch</span>
          </button>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
        isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
      }`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Filter fleet KPIs</span>
        <select aria-label="Filter by vehicle type" value={vehicleTypeFilter} onChange={(event) => setVehicleTypeFilter(event.target.value)} className="rounded-lg border px-2.5 py-1.5 text-xs bg-transparent">
          <option value="All">All types</option>
          {[...new Set(vehicles.map((vehicle) => vehicle.type))].sort().map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select aria-label="Filter by vehicle status" value={vehicleStatusFilter} onChange={(event) => setVehicleStatusFilter(event.target.value)} className="rounded-lg border px-2.5 py-1.5 text-xs bg-transparent">
          <option value="All">All statuses</option>
          <option value="Available">Available</option>
          <option value="On Trip">On Trip</option>
          <option value="In Shop">In Shop</option>
          <option value="Retired">Retired</option>
        </select>
        <select aria-label="Filter by region" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="rounded-lg border px-2.5 py-1.5 text-xs bg-transparent">
          <option value="All">All regions</option>
          {[...new Set(vehicles.map((vehicle) => vehicle.region))].sort().map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
        <span className="text-[10px] text-neutral-400">Driver counts are fleet-wide; driver records are not associated with vehicle regions or types.</span>
      </div>

      {/* KPI Cards Row (7 Operational KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono">{kpis.activeVehicles}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Vehicles on road</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono">{kpis.availableVehicles}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Ready for dispatch</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Shop</span>
            <Wrench className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black font-mono">{kpis.vehiclesInMaintenance}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Service hold</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">On Trip</span>
            <Navigation className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono">{kpis.activeTrips}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Live shipments</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono">{kpis.pendingTrips}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Draft trips</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Drivers</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono">
            {kpis.driversReady}
            <span className="text-sm font-semibold text-neutral-400"> / {kpis.driversTotal}</span>
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Ready for dispatch · {kpis.driversOnTrip} on trip
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Utilization</span>
            <Percent className="w-4 h-4 text-[#ccff00]" />
          </div>
          <div className="text-2xl font-black font-mono">{kpis.fleetUtilization}%</div>
          <div className="text-[11px] text-neutral-500 mt-1">Active / Total</div>
        </div>
      </div>

      {/* Main Grid: Live Fleet Radar Map + Attention Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <LiveRouteRadar
            title="Active Dispatches"
            subtitle="Current assigned routes and saved trip data. GPS location is not available."
            trips={filteredTrips}
          />
        </div>

        {/* Operational Attention Center */}
        <div
          className={`lg:col-span-4 p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Immediate Attention</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">
                {expiringDrivers.length + expiredDrivers.length + activeMaintenance.length} Items
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Autonomous operational constraints impacting vehicle and driver availability.
            </p>

            <div className="space-y-3">
              {expiringDrivers.length === 0 && expiredDrivers.length === 0 && activeMaintenance.length === 0 && (
                <div className="py-6 text-center text-xs opacity-60">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-semibold">Operational Status: Nominal</p>
                  <p className="text-[11px] mt-0.5">No license warnings, suspensions, or active repair holds.</p>
                </div>
              )}
              {expiringDrivers.map((d) => (
                <div
                  key={d.id}
                  className={`p-3 rounded-xl border text-xs ${
                    isDark
                      ? 'bg-[#1c1a16] border-amber-500/30 text-amber-200'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>License Expiring Soon</span>
                    <span className="font-mono text-[10px]">{d.licenseExpiryDate}</span>
                  </div>
                  <p className="text-[11px] opacity-85">
                    {d.name}&apos;s license expires within 30 days. Auto-dispatch will lock on expiry.
                  </p>
                  <div className="mt-2.5 flex items-center justify-end">
                    <button
                      onClick={() => sendLicenseReminderEmail(d.id)}
                      className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                    >
                      Send Reminder
                    </button>
                  </div>
                </div>
              ))}

              {expiredDrivers.map((d) => (
                <div
                  key={d.id}
                  className={`p-3 rounded-xl border text-xs ${
                    isDark
                      ? 'bg-[#1f1517] border-red-500/30 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-red-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{d.status === 'Suspended' ? 'Driver Suspended' : 'License Expired'}</span>
                    </span>
                    <span className="font-mono text-[10px]">{d.licenseNumber}</span>
                  </div>
                  <p className="text-[11px] opacity-85">
                    {d.name} is excluded from dispatch assignment pools.
                  </p>
                </div>
              ))}

              {activeMaintenance.map((m) => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl border text-xs ${
                    isDark
                      ? 'bg-[#181c25] border-[#28303f] text-neutral-300'
                      : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-red-400 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{m.vehicleName} In Shop</span>
                    </span>
                    <span className="font-mono text-[10px]">{formatRupees(m.cost)}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {m.serviceType}: {m.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-end">
                    <button
                      onClick={() => closeMaintenanceRecord(m.id)}
                      className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                    >
                      Close &amp; Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl text-[11px] leading-relaxed border ${
              isDark
                ? 'bg-[#161a22] border-[#222733] text-neutral-400'
                : 'bg-neutral-100 border-[#ded7ca] text-neutral-600'
            }`}
          >
            <strong>Manager Mandate:</strong> Full fleet authority enabled. All vehicles, drivers, dispatches, and maintenance workflows are controllable from here.
          </div>
        </div>
      </div>

      {/* Dispatches & Trips Table */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-inherit gap-2">
          <div>
            <h3 className="font-bold text-base">Active Fleet Board &amp; Dispatches</h3>
            <p className="text-xs text-neutral-400">
              Real-time dispatches with state synchronization across vehicles and drivers
            </p>
          </div>
          <button
            onClick={() => setActiveView('trips')}
            className={`text-xs font-bold hover:underline flex items-center gap-1 ${
              isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
            }`}
          >
            <span>View All Trips ({trips.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="pb-3 pl-2">Trip Code</th>
                <th className="pb-3">Route</th>
                <th className="pb-3">Vehicle</th>
                <th className="pb-3">Driver</th>
                <th className="pb-3">Cargo Weight</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit font-medium">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-bold text-sm">No Dispatches Scheduled</p>
                      <p className="text-xs">Your workspace is clean. Click &quot;New Dispatch&quot; to assign your first cargo run.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                trips.slice(0, 6).map((t) => {
                  const isDispatched = t.status === 'Dispatched';
                const isDraft = t.status === 'Draft';
                const isCompleted = t.status === 'Completed';

                return (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3 pl-2 font-mono font-bold">{t.tripCode}</td>
                    <td className="py-3">
                      <div className="font-bold">{t.source}</div>
                      <div className="text-[11px] text-neutral-400">→ {t.destination}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold">{t.vehicleName}</div>
                      <div className="text-[10px] font-mono text-neutral-400">
                        {t.vehicleRegNumber}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold">{t.driverName}</div>
                    </td>
                    <td className="py-3 font-mono">{t.cargoWeightKg.toLocaleString()} kg</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isDispatched
                            ? isDark
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-amber-100 text-amber-800'
                            : isCompleted
                            ? isDark
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-800'
                            : isDark
                            ? 'bg-neutral-800 text-neutral-300'
                            : 'bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDispatched
                              ? 'bg-amber-400 animate-ping'
                              : isCompleted
                              ? 'bg-emerald-400'
                              : 'bg-neutral-400'
                          }`}
                        />
                        <span>{t.status}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      {isDispatched && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenCompleteTripModal(t)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => cancelTrip(t.id)}
                            className="px-2 py-1 rounded-lg text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {isDraft && (
                        <button
                          onClick={() => dispatchTrip(t.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            isDark
                              ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                              : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                          }`}
                        >
                          Dispatch Now
                        </button>
                      )}
                      {isCompleted && (
                        <span className="text-[11px] text-neutral-400 font-mono">
                          Finished ({t.finalOdometerKm} km)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
