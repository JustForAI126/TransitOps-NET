import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Download,
  Fuel,
  Gauge,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Vehicle, VehicleStatus, VehicleType } from '../../types';
import { formatRupees } from '../../utils/currency';

interface VehiclesViewProps {
  onOpenAddVehicleModal: () => void;
  onOpenLogMaintModal: (vehicleId?: string) => void;
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  onOpenAddVehicleModal,
  onOpenLogMaintModal,
}) => {
  const {
    vehicles,
    currentUser,
    calculateVehicleROI,
    updateVehicleStatus,
    retireVehicle,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canManageFleet = currentUser?.role === 'fleet_manager';
  const canViewFinancials = currentUser?.role === 'fleet_manager' || currentUser?.role === 'financial_analyst';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(vehicles[0] || null);

  const filteredVehicles = vehicles.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || v.status === statusFilter;
    const matchType = typeFilter === 'All' || v.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const handleExport = () => {
    const exportData = filteredVehicles.map((v) => {
      const roi = calculateVehicleROI(v.id);
      const vehicleData = {
        'Reg Number': v.registrationNumber,
        Name: v.name,
        Model: v.model,
        Type: v.type,
        Status: v.status,
        'Max Capacity (kg)': v.maxCapacityKg,
        'Odometer (km)': v.currentOdometerKm,
        Region: v.region,
      };
      return canViewFinancials
        ? {
            ...vehicleData,
            'Acquisition Cost (₹)': v.acquisitionCost,
            'Total Revenue (₹)': roi.revenue,
            'Total Maintenance (₹)': roi.maintenanceCost,
            'Total Fuel (₹)': roi.fuelCost,
            'Net Profit (₹)': roi.profit,
            'ROI (%)': `${roi.roiPercent}%`,
          }
        : vehicleData;
    });
    exportToCSV('transitops-vehicles-registry', exportData);
  };

  const getStatusBadge = (status: VehicleStatus | string) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Available
          </span>
        );
      case 'On Trip':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            On Trip
          </span>
        );
      case 'In Shop':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            In Shop
          </span>
        );
      case 'Retired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
            Retired
          </span>
        );
    }
  };

  const selectedROI = selectedVehicle ? calculateVehicleROI(selectedVehicle.id) : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span className={`font-semibold ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`}>
              FLEET INVENTORY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Vehicles &amp; Asset Management
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Registry</span>
          </button>
          {canManageFleet && <button
            onClick={onOpenAddVehicleModal}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Vehicle</span>
          </button>}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between text-xs ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
        }`}
      >
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by registration, model, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available</option>
              <option value="On Trip">On Trip</option>
              <option value="In Shop">In Shop</option>
              <option value="Retired">Retired</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Types</option>
              <option value="Van">Van</option>
              <option value="Truck">Truck</option>
              <option value="Heavy Truck">Heavy Truck</option>
              <option value="Pickup">Pickup</option>
              <option value="Semi-Trailer">Semi-Trailer</option>
              <option value="Box Truck">Box Truck</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Vehicles List + Detailed Telemetry & ROI Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Vehicles Table / Cards (7 cols) */}
        <div
          className={`lg:col-span-7 rounded-2xl border overflow-hidden ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
          }`}
        >
          <div className="p-4 border-b border-inherit flex items-center justify-between">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Fleet Assets ({filteredVehicles.length})
            </div>
            <span className="text-[11px] text-neutral-400">Click row for {canViewFinancials ? 'ROI & ' : ''}Specs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  <th className="py-3 pl-4">Reg No.</th>
                  <th className="py-3">Vehicle</th>
                  <th className="py-3">Type</th>
                  <th className="py-3">Capacity</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Truck className="w-10 h-10 mx-auto opacity-40 text-amber-500" />
                        <p className="font-bold text-sm">No Vehicles Registered</p>
                        <p className="text-xs">Your fleet database is empty. Add your first vehicle asset to start scheduling freight runs.</p>
                        <button
                          onClick={onOpenAddVehicleModal}
                          className="mt-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-black inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Register First Vehicle</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => {
                    const isSelected = selectedVehicle?.id === v.id;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedVehicle(v)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? isDark
                              ? 'bg-[#1e2533]'
                              : 'bg-amber-50/80'
                            : isDark
                            ? 'hover:bg-[#181d27]'
                            : 'hover:bg-neutral-50'
                        }`}
                      >
                        <td className="py-3 pl-4 font-mono font-bold">{v.registrationNumber}</td>
                        <td className="py-3">
                          <div className="font-semibold">{v.name}</div>
                          <div className="text-[10px] text-neutral-400">{v.model}</div>
                        </td>
                        <td className="py-3 font-medium">{v.type}</td>
                        <td className="py-3 font-mono">{v.maxCapacityKg.toLocaleString()} kg</td>
                        <td className="py-3">{getStatusBadge(v.status)}</td>
                        <td className="py-3 text-right pr-4">
                          {canManageFleet && v.status === 'Available' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenLogMaintModal(v.id);
                              }}
                              className="px-2 py-1 text-[11px] rounded-md font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Send to Shop
                            </button>
                          )}
                          {canManageFleet && v.status === 'In Shop' && (
                            <span className="text-[10px] font-mono text-red-400">Locked</span>
                          )}
                          {v.status === 'On Trip' && (
                            <span className="text-[10px] font-mono text-amber-400">In Transit</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Vehicle Telemetry & ROI Card (5 cols) */}
        <div className="lg:col-span-5">
          {selectedVehicle && selectedROI ? (
            <div
              className={`p-6 rounded-2xl border space-y-5 sticky top-24 ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
              }`}
            >
              {/* Top Banner */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                    ASSET TELEMETRY
                  </span>
                  <h3 className="text-lg font-bold">{selectedVehicle.name}</h3>
                  <p className="text-xs text-neutral-400">
                    {selectedVehicle.model} · {selectedVehicle.region}
                  </p>
                </div>
                <div>{getStatusBadge(selectedVehicle.status)}</div>
              </div>

              {/* Quick Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div
                  className={`p-3 rounded-xl border ${
                    isDark ? 'bg-[#191d26] border-[#272e3d]' : 'bg-neutral-50 border-[#ded7ca]'
                  }`}
                >
                  <div className="text-[10px] text-neutral-400 uppercase font-bold flex items-center gap-1 mb-1">
                    <Gauge className="w-3 h-3" />
                    <span>Odometer</span>
                  </div>
                  <div className="text-sm font-bold font-mono">
                    {selectedVehicle.currentOdometerKm.toLocaleString()} km
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border ${
                    isDark ? 'bg-[#191d26] border-[#272e3d]' : 'bg-neutral-50 border-[#ded7ca]'
                  }`}
                >
                  <div className="text-[10px] text-neutral-400 uppercase font-bold flex items-center gap-1 mb-1">
                    <Truck className="w-3 h-3" />
                    <span>Payload Limit</span>
                  </div>
                  <div className="text-sm font-bold font-mono">
                    {selectedVehicle.maxCapacityKg.toLocaleString()} kg
                  </div>
                </div>
              </div>

              {canViewFinancials && <div
                className={`p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-[#171b24] border-[#262e3d]' : 'bg-amber-50/50 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <TrendingUp
                      className={`w-4 h-4 ${
                        isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
                      }`}
                    />
                    <span>Asset ROI Calculation</span>
                  </div>
                  <span
                    className={`font-mono font-extrabold text-sm px-2 py-0.5 rounded ${
                      selectedROI.roiPercent >= 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {selectedROI.roiPercent >= 0 ? '+' : ''}
                    {selectedROI.roiPercent}% ROI
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-inherit">
                  <div>
                    <span className="text-neutral-400 block">Acquisition Cost:</span>
                    <span className="font-mono font-semibold">
                      {formatRupees(selectedROI.acquisitionCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Trip Revenue:</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {formatRupees(selectedROI.revenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Maintenance Cost:</span>
                    <span className="font-mono font-semibold text-red-400">
                      {formatRupees(selectedROI.maintenanceCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Fuel Cost:</span>
                    <span className="font-mono font-semibold text-amber-400">
                      {formatRupees(selectedROI.fuelCost)}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-neutral-400 leading-tight pt-1">
                  Net profit: {formatRupees(selectedROI.profit)}. ROI uses net profit divided by acquisition cost plus operating costs.
                </div>
              </div>}

              {/* Status change actions */}
              {canManageFleet && <div className="pt-2 flex flex-wrap items-center gap-2">
                {selectedVehicle.status !== 'In Shop' && selectedVehicle.status !== 'On Trip' && selectedVehicle.status !== 'Retired' && (
                  <button
                    onClick={() => onOpenLogMaintModal(selectedVehicle.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Send to Maintenance</span>
                  </button>
                )}
                {selectedVehicle.status === 'In Shop' && (
                  <button
                    onClick={() => updateVehicleStatus(selectedVehicle.id, 'Available')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Return to Available</span>
                  </button>
                )}
                {selectedVehicle.status !== 'Retired' && selectedVehicle.status !== 'On Trip' && (
                  <button
                    onClick={() => retireVehicle(selectedVehicle.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border text-neutral-400 hover:text-neutral-100 transition-colors"
                  >
                    Decommission Asset
                  </button>
                )}
              </div>}
            </div>
          ) : (
            <div
              className={`p-8 rounded-2xl border text-center text-xs text-neutral-400 ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
              }`}
            >
              Select a vehicle to inspect live telemetry and financial performance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
