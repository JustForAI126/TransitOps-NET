import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  IndianRupee,
  Download,
  AlertTriangle,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { MaintenanceRecord } from '../../types';
import { formatRupees } from '../../utils/currency';

interface MaintenanceViewProps {
  onOpenLogMaintModal: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({ onOpenLogMaintModal }) => {
  const {
    maintenanceRecords,
    closeMaintenanceRecord,
    currentUser,
    vehicles,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const canManageMaintenance = currentUser?.role === 'fleet_manager';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filteredRecords = maintenanceRecords.filter((m) => {
    const matchSearch =
      m.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
      m.serviceType.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalSpend = maintenanceRecords.reduce((acc, m) => acc + m.cost, 0);
  const activeWorkOrders = maintenanceRecords.filter((m) => m.status === 'Active');

  const handleExport = () => {
    const exportData = filteredRecords.map((m) => ({
      'Record ID': m.id,
      Vehicle: m.vehicleName,
      'Service Type': m.serviceType,
      Description: m.description,
      'Cost (₹)': m.cost,
      Status: m.status,
      'Start Date': m.startDate,
      'Completed Date': m.completedDate || 'Ongoing',
      Notes: m.technicianNotes,
    }));
    exportToCSV('transitops-maintenance-logs', exportData);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span className={`font-semibold ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`}>
              DEPOT WORKSHOP
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Fleet Maintenance &amp; Shop Logs
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
            <span>Export Logs</span>
          </button>
          {canManageMaintenance && <button
            onClick={onOpenLogMaintModal}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Log Maintenance</span>
          </button>}
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="text-neutral-400 text-xs mb-1">Active Vehicles in Shop</div>
          <div className="text-2xl font-extrabold text-red-400 font-mono">
            {activeWorkOrders.length} Assets
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Excluded automatically from driver dispatch
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="text-neutral-400 text-xs mb-1">Total Maintenance Spend</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {formatRupees(totalSpend)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Factored directly into asset ROI formula
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="text-neutral-400 text-xs mb-1">Completed Work Orders</div>
          <div className="text-2xl font-extrabold font-mono">
            {maintenanceRecords.length - activeWorkOrders.length} Completed
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Restored to Available service status
          </div>
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
            placeholder="Search vehicle, service type, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-neutral-400">Order Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
            }`}
          >
            <option value="All">All Records</option>
            <option value="Active">Active (In Shop)</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Maintenance Logs Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Vehicle Asset</th>
                <th className="py-3">Service Type</th>
                <th className="py-3">Repair Description</th>
                <th className="py-3">Work Order Cost</th>
                <th className="py-3">Start Date</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-right pr-4">Shop Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Wrench className="w-10 h-10 mx-auto opacity-40 text-amber-500" />
                      <p className="font-bold text-sm">No Maintenance Work Orders</p>
                      <p className="text-xs">No active repair orders or service history recorded yet in this workspace.</p>
                      {canManageMaintenance && <button
                        onClick={onOpenLogMaintModal}
                        className="mt-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-black inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log First Service Order</span>
                      </button>}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((m) => {
                  const isActive = m.status === 'Active';

                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <td className="py-3.5 pl-4">
                        <div className="font-bold">{m.vehicleName}</div>
                        <div className="text-[10px] font-mono text-neutral-400">ID: {m.id}</div>
                      </td>
                      <td className="py-3.5 font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-500/10 border border-neutral-500/20 text-[11px]">
                          {m.serviceType}
                        </span>
                      </td>
                      <td className="py-3.5 max-w-xs">
                        <div>{m.description}</div>
                        <div className="text-[10px] text-neutral-400 truncate">{m.technicianNotes}</div>
                      </td>
                      <td className="py-3.5 font-mono font-bold text-sm">
                        {formatRupees(m.cost)}
                      </td>
                      <td className="py-3.5 font-mono text-neutral-400">{m.startDate}</td>
                      <td className="py-3.5">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            In Shop
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-right pr-4">
                        {isActive && canManageMaintenance ? (
                          <button
                            onClick={() => closeMaintenanceRecord(m.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            Close Work Order
                          </button>
                        ) : isActive ? (
                          <span className="text-[11px] text-neutral-400">Active</span>
                        ) : (
                          <span className="text-[11px] text-neutral-400 font-mono">
                            Closed on {m.completedDate}
                          </span>
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
    </div>
  );
};
