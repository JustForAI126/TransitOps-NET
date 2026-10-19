import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  DollarSign,
  PieChart,
  Percent,
  CheckCircle2,
  ArrowUpRight,
  Truck,
  FileSpreadsheet,
  Layers,
  Search,
  Fuel,
  Wrench,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

export const ReportsView: React.FC = () => {
  const {
    currentUser,
    vehicles,
    trips,
    expenses,
    maintenanceRecords,
    calculateVehicleROI,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'roi' | 'revenue' | 'profit' | 'cost'>('roi');
  const [isExportingLedger, setIsExportingLedger] = useState(false);
  const [isExportingFleetRoi, setIsExportingFleetRoi] = useState(false);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);

  // Aggregated Financials
  const completedTrips = trips.filter((t) => t.status === 'Completed');
  const totalRevenue = completedTrips.reduce((acc, t) => acc + t.revenue, 0);

  const totalFuelCost = expenses
    .filter((e) => e.type === 'Fuel')
    .reduce((acc, e) => acc + (e.cost || e.amount || 0), 0);

  const totalMaintenanceCost = maintenanceRecords.reduce(
    (acc, m) => acc + m.cost,
    0
  );

  const totalTollsAndMisc = expenses
    .filter((e) => e.type !== 'Fuel')
    .reduce((acc, e) => acc + (e.cost || e.amount || 0), 0);

  const totalOperatingCost = totalFuelCost + totalMaintenanceCost + totalTollsAndMisc;
  const netOperatingProfit = totalRevenue - totalOperatingCost;

  const totalAcquisitionCost = vehicles.reduce(
    (acc, v) => acc + (v.acquisitionCost ?? 0),
    0
  );
  const fleetOverallROI =
    totalAcquisitionCost > 0
      ? ((netOperatingProfit / totalAcquisitionCost) * 100).toFixed(1)
      : '0.0';

  // Total completed distance
  const totalCompletedDist = completedTrips.reduce(
    (acc, t) => acc + t.plannedDistanceKm,
    0
  );
  const avgCostPerKm =
    totalCompletedDist > 0
      ? (totalOperatingCost / totalCompletedDist).toFixed(2)
      : '0.00';
  const avgRevenuePerKm =
    totalCompletedDist > 0
      ? (totalRevenue / totalCompletedDist).toFixed(2)
      : '0.00';

  // Cost proportions
  const fuelPercent =
    totalOperatingCost > 0
      ? Math.round((totalFuelCost / totalOperatingCost) * 100)
      : 0;
  const maintPercent =
    totalOperatingCost > 0
      ? Math.round((totalMaintenanceCost / totalOperatingCost) * 100)
      : 0;
  const miscPercent =
    totalOperatingCost > 0
      ? Math.max(0, 100 - fuelPercent - maintPercent)
      : 0;

  // Process ROI data for each vehicle
  const vehicleROIList = vehicles
    .map((v) => {
      const roi = calculateVehicleROI(v.id);
      return {
        ...v,
        roiData: roi,
      };
    })
    .filter((v) => {
      const matchSearch =
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
        v.type.toLowerCase().includes(search.toLowerCase());
      const matchType =
        vehicleTypeFilter === 'All' || v.type === vehicleTypeFilter;
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      if (sortBy === 'roi') return b.roiData.roiPercent - a.roiData.roiPercent;
      if (sortBy === 'revenue') return b.roiData.revenue - a.roiData.revenue;
      if (sortBy === 'profit') return b.roiData.profit - a.roiData.profit;
      return (
        b.roiData.maintenanceCost +
        b.roiData.fuelCost -
        (a.roiData.maintenanceCost + a.roiData.fuelCost)
      );
    });

  const handleExportROIMatrix = () => {
    const data = vehicleROIList.map((v) => ({
      'Vehicle ID': v.id,
      'Vehicle Name': v.name,
      'Registration Number': v.registrationNumber,
      'Asset Type': v.type,
      'Acquisition Cost (₹)': v.roiData.acquisitionCost,
      'Total Revenue Earned (₹)': v.roiData.revenue,
      'Maintenance Spend (₹)': v.roiData.maintenanceCost,
      'Fuel Spend (₹)': v.roiData.fuelCost,
      'Net Profit (₹)': v.roiData.profit,
      'Lifetime ROI (%)': `${v.roiData.roiPercent}%`,
    }));
    exportToCSV('transitops-vehicle-lifetime-roi-matrix', data);
  };

  const handleExportRouteReport = () => {
    const data = completedTrips.map((t) => {
      const costPerKm =
        t.fuelConsumedLiters && t.plannedDistanceKm > 0
          ? ((t.fuelConsumedLiters * 96.5) / t.plannedDistanceKm).toFixed(2)
          : 'N/A';
      const revPerKm =
        t.plannedDistanceKm > 0
          ? (t.revenue / t.plannedDistanceKm).toFixed(2)
          : 'N/A';

      return {
        'Trip Code': t.tripCode,
        Source: t.source,
        Destination: t.destination,
        Vehicle: t.vehicleName,
        Driver: t.driverName,
        'Planned Distance (km)': t.plannedDistanceKm,
        'Cargo Weight (kg)': t.cargoWeightKg,
        'Fuel Consumed (L)': t.fuelConsumedLiters || 'N/A',
        'Gross Revenue (₹)': t.revenue,
        'Revenue per km (₹)': revPerKm,
        'Estimated Cost per km (₹)': costPerKm,
      };
    });
    exportToCSV('transitops-route-performance-and-costs', data);
  };

  const handleExportFinancialLedgerPdf = async () => {
    setPdfExportError(null);
    setIsExportingLedger(true);
    try {
      const pdf = await api.reports.exportFinancialLedgerPdf();
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transitops-financial-ledger-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setPdfExportError(error instanceof Error ? error.message : 'Could not generate the financial ledger PDF.');
    } finally {
      setIsExportingLedger(false);
    }
  };

  const handleExportFleetRoiPdf = async () => {
    setPdfExportError(null);
    setIsExportingFleetRoi(true);
    try {
      const pdf = await api.reports.exportFleetRoiPdf();
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transitops-fleet-roi-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setPdfExportError(error instanceof Error ? error.message : 'Could not generate the fleet ROI PDF.');
    } finally {
      setIsExportingFleetRoi(false);
    }
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
              INTELLIGENCE &amp; AUDIT
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Reports &amp; Fleet ROI
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Asset lifecycle yield, route cost-per-kilometer, and financial ROI matrix
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportRouteReport}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Route Costs CSV</span>
          </button>
          <button
            onClick={handleExportROIMatrix}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
            }`}
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export ROI Matrix</span>
          </button>
          {currentUser?.role === 'financial_analyst' && (
            <button
              onClick={() => void handleExportFinancialLedgerPdf()}
              disabled={isExportingLedger}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                  : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingLedger ? 'Generating PDF…' : 'Financial Ledger PDF'}</span>
            </button>
          )}
          {currentUser?.role === 'fleet_manager' && (
            <button
              onClick={() => void handleExportFleetRoiPdf()}
              disabled={isExportingFleetRoi}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                  : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingFleetRoi ? 'Generating PDF…' : 'Fleet ROI PDF'}</span>
            </button>
          )}
        </div>
      </div>
      {pdfExportError && (
        <p role="alert" className={`rounded-xl border px-4 py-3 text-xs ${
          isDark
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {pdfExportError}
        </p>
      )}

      {/* Top 4 Financial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Completed Fleet Revenue</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ₹{totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {completedTrips.length} completed commercial dispatches
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Total Operating Expenses</div>
          <div className="text-2xl font-extrabold text-red-400 font-mono">
            ₹{totalOperatingCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Fuel (₹{totalFuelCost.toLocaleString()}) + Shop (₹{totalMaintenanceCost.toLocaleString()})
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Net Fleet Operating Profit</div>
          <div
            className={`text-2xl font-extrabold font-mono ${
              netOperatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            ₹{netOperatingProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Revenue minus total operating costs
          </div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#ccff00]/40' : 'bg-amber-50 border-amber-300'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1 font-bold">Fleet Overall ROI</div>
          <div
            className={`text-2xl font-extrabold font-mono ${
              isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
            }`}
          >
            {fleetOverallROI}%
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Capital recovery across all assets
          </div>
        </div>
      </div>

      {/* Cost Distribution & Route Efficiency Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cost Breakdown Visualizer */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PieChart className={`w-4 h-4 ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`} />
              <h3 className="font-bold text-sm">Operating Cost Breakdown</h3>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Direct allocation of operational expenditure
            </p>

            {/* Proportion Bar */}
            <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-neutral-700/30 mb-4">
              <div
                style={{ width: `${fuelPercent}%` }}
                className="bg-amber-400 h-full"
                title={`Fuel: ${fuelPercent}%`}
              />
              <div
                style={{ width: `${maintPercent}%` }}
                className="bg-red-400 h-full"
                title={`Maintenance: ${maintPercent}%`}
              />
              <div
                style={{ width: `${miscPercent}%` }}
                className="bg-blue-400 h-full"
                title={`Tolls & Misc: ${miscPercent}%`}
              />
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Fuel Consumed</span>
                </div>
                <div className="font-mono font-bold">
                  ${totalFuelCost.toLocaleString()} ({fuelPercent}%)
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span>Depot Maintenance</span>
                </div>
                <div className="font-mono font-bold">
                  ${totalMaintenanceCost.toLocaleString()} ({maintPercent}%)
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span>Tolls &amp; Interstate Permits</span>
                </div>
                <div className="font-mono font-bold">
                  ${totalTollsAndMisc.toLocaleString()} ({miscPercent}%)
                </div>
              </div>
            </div>
          </div>

          <div
            className={`mt-4 pt-3 border-t border-inherit text-[11px] text-neutral-400 ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            Audit ready for quarterly compliance and balance sheet reconciliations.
          </div>
        </div>

        {/* Distance & Rate Efficiency Metrics */}
        <div
          className={`lg:col-span-2 p-5 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-4 h-4 ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`} />
              <h3 className="font-bold text-sm">Route Economics &amp; Cost per KM</h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              {totalCompletedDist.toLocaleString()} km logged
            </span>
          </div>
          <p className="text-xs text-neutral-400 mb-4">
            Commercial return rates evaluated against real transit distances
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-[#191d26] border-[#272e3d]' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="text-[10px] text-neutral-400 uppercase font-bold">
                Avg Cost / KM
              </div>
              <div className="text-xl font-extrabold font-mono text-red-400">
                ₹{avgCostPerKm}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Operating burn rate</div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                isDark ? 'bg-[#191d26] border-[#272e3d]' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="text-[10px] text-neutral-400 uppercase font-bold">
                Avg Revenue / KM
              </div>
              <div className="text-xl font-extrabold font-mono text-emerald-400">
                ₹{avgRevenuePerKm}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Yield per dispatched km</div>
            </div>

            <div
              className={`col-span-2 sm:col-span-1 p-3 rounded-xl border ${
                isDark ? 'bg-[#191d26] border-[#272e3d]' : 'bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="text-[10px] text-neutral-400 uppercase font-bold">
                Operating Net Margin
              </div>
              <div
                className={`text-xl font-extrabold font-mono ${
                  isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
                }`}
              >
                ₹{(Number(avgRevenuePerKm) - Number(avgCostPerKm)).toFixed(2)}/km
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5">Net profit per km</div>
            </div>
          </div>

          {/* Quick Route Table */}
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400">
                  <th className="pb-2">Trip</th>
                  <th className="pb-2">Route Corridor</th>
                  <th className="pb-2">Distance</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2 text-right">Yield/km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {completedTrips.slice(0, 3).map((t) => (
                  <tr key={t.id} className="py-2">
                    <td className="py-2 font-mono font-bold">{t.tripCode}</td>
                    <td className="py-2">
                      {t.source} → {t.destination}
                    </td>
                    <td className="py-2 font-mono">{t.plannedDistanceKm} km</td>
                    <td className="py-2 font-mono text-emerald-400 font-bold">
                      ₹{t.revenue.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono font-bold">
                      ₹{(t.revenue / t.plannedDistanceKm).toFixed(2)}/km
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Primary ROI Matrix Card */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-inherit gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className={`w-5 h-5 ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`} />
              <h2 className="font-bold text-base">Vehicle Lifetime ROI Matrix</h2>
            </div>
            <div className="text-xs text-neutral-400 mt-0.5">
              <span>Standard Formula: </span>
              <code
                className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${
                  isDark ? 'bg-[#1e2330] text-[#ccff00]' : 'bg-amber-100 text-amber-900'
                }`}
              >
                ROI = (Revenue - (Maintenance + Fuel)) / Acquisition Cost × 100
              </code>
            </div>
          </div>

          {/* Filters inside table */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter asset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-8 pr-3 py-1.5 rounded-lg border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                    : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
                }`}
              />
            </div>

            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Types</option>
              <option value="Heavy Truck">Heavy Truck</option>
              <option value="Light Commercial">Light Commercial</option>
              <option value="Container Carrier">Container Carrier</option>
              <option value="Flatbed">Flatbed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="roi">Sort by ROI %</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="profit">Sort by Net Profit</option>
              <option value="cost">Sort by Operating Cost</option>
            </select>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Vehicle Asset</th>
                <th className="py-3">Type</th>
                <th className="py-3 text-right">Acquisition Cost</th>
                <th className="py-3 text-right">Gross Revenue</th>
                <th className="py-3 text-right">Maint. Spend</th>
                <th className="py-3 text-right">Fuel Spend</th>
                <th className="py-3 text-right">Net Operating Profit</th>
                <th className="py-3 text-right pr-4">Calculated Lifetime ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {vehicleROIList.map((v) => {
                const roi = v.roiData;
                const isPositive = roi.roiPercent >= 0;

                return (
                  <tr
                    key={v.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3.5 pl-4">
                      <div className="font-bold">{v.name}</div>
                      <div className="text-[10px] font-mono text-neutral-400">
                        {v.registrationNumber}
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-500/10 border border-neutral-500/20 text-[11px]">
                        {v.type}
                      </span>
                    </td>
                    <td className="py-3.5 text-right font-mono text-neutral-400">
                      ₹{roi.acquisitionCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right font-mono text-emerald-400 font-bold">
                      ₹{roi.revenue.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right font-mono text-red-400">
                      ₹{roi.maintenanceCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right font-mono text-amber-400">
                      ₹{roi.fuelCost.toLocaleString()}
                    </td>
                    <td
                      className={`py-3.5 text-right font-mono font-bold ${
                        roi.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      ₹{roi.profit.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full font-mono font-extrabold text-xs border ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {roi.roiPercent}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
