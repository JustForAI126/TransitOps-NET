import React, { useState } from 'react';
import {
  BarChart3,
  DollarSign,
  Fuel,
  TrendingUp,
  Download,
  Plus,
  ArrowUpRight,
  PieChart,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { ExpenseRecord } from '../../types';

export const AnalyticsView: React.FC = () => {
  const {
    vehicles,
    trips,
    expenses,
    maintenanceRecords,
    calculateVehicleROI,
    addExpense,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Expense form state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseVehicleId, setExpenseVehicleId] = useState(vehicles[0]?.id || '');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseRecord['category']>('Fuel');
  const [expenseAmount, setExpenseAmount] = useState<number>(120);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [fuelLiters, setFuelLiters] = useState<number>(30);

  // Financial aggregates
  const totalRevenue = trips
    .filter((t) => t.status === 'Completed')
    .reduce((acc, t) => acc + t.revenue, 0);

  const totalFuelCost = expenses
    .filter((e) => e.category === 'Fuel')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalMaintenanceCost = maintenanceRecords.reduce((acc, m) => acc + m.cost, 0);

  const totalTollsAndMisc = expenses
    .filter((e) => e.category !== 'Fuel')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalOperatingCost = totalFuelCost + totalMaintenanceCost + totalTollsAndMisc;
  const netOperatingProfit = totalRevenue - totalOperatingCost;

  // Fuel efficiency calculation from completed trips
  const completedTrips = trips.filter((t) => t.status === 'Completed' && t.fuelConsumedLiters);
  const totalDistanceCompleted = completedTrips.reduce((acc, t) => acc + t.plannedDistanceKm, 0);
  const totalFuelConsumed = completedTrips.reduce(
    (acc, t) => acc + (t.fuelConsumedLiters || 0),
    0
  );
  const fleetAverageKmPerLiter =
    totalFuelConsumed > 0 ? (totalDistanceCompleted / totalFuelConsumed).toFixed(1) : '9.2';

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseVehicleId) return;

    addExpense({
      vehicleId: expenseVehicleId,
      category: expenseCategory,
      amount: Number(expenseAmount),
      date: new Date().toISOString().split('T')[0],
      description: expenseDesc.trim() || `${expenseCategory} expense logged`,
      fuelLiters: expenseCategory === 'Fuel' ? Number(fuelLiters) : undefined,
    });

    setShowAddExpense(false);
    setExpenseDesc('');
  };

  const handleExportAnalytics = () => {
    const roiReport = vehicles.map((v) => {
      const roi = calculateVehicleROI(v.id);
      return {
        'Vehicle Reg': v.registrationNumber,
        Name: v.name,
        'Acquisition Cost (₹)': roi.acquisitionCost,
        'Revenue (₹)': roi.revenue,
        'Maintenance Cost (₹)': roi.maintenanceCost,
        'Fuel Cost (₹)': roi.fuelCost,
        'Net Profit (₹)': roi.profit,
        'ROI (%)': `${roi.roiPercent}%`,
      };
    });
    exportToCSV('transitops-financial-roi-report', roiReport);
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
              FINANCIAL CONSOLE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Financial &amp; Operational Analytics
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportAnalytics}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export ROI Matrix</span>
          </button>
          <button
            onClick={() => setShowAddExpense(!showAddExpense)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Log Expense</span>
          </button>
        </div>
      </div>

      {/* Inline Add Expense Drawer / Box */}
      {showAddExpense && (
        <form
          onSubmit={handleAddExpenseSubmit}
          className={`p-5 rounded-2xl border space-y-3 ${
            isDark ? 'bg-[#181d27] border-[#2d374a]' : 'bg-amber-50/70 border-amber-200'
          }`}
        >
          <div className="font-bold text-sm">Log Fleet Operational Expense</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-neutral-400 font-bold mb-1">Vehicle Asset</label>
              <select
                value={expenseVehicleId}
                onChange={(e) => setExpenseVehicleId(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDark
                    ? 'bg-[#14171e] border-[#272e3d] text-neutral-200'
                    : 'bg-white border-[#ded7ca] text-neutral-800'
                }`}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.registrationNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-neutral-400 font-bold mb-1">Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDark
                    ? 'bg-[#14171e] border-[#272e3d] text-neutral-200'
                    : 'bg-white border-[#ded7ca] text-neutral-800'
                }`}
              >
                <option value="Fuel">Fuel</option>
                <option value="Toll">Toll</option>
                <option value="Insurance">Insurance</option>
                <option value="Permits">Permits &amp; Taxes</option>
                <option value="Other">Other Misc</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-400 font-bold mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                required
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                  isDark
                    ? 'bg-[#14171e] border-[#272e3d] text-neutral-200'
                    : 'bg-white border-[#ded7ca] text-neutral-800'
                }`}
              />
            </div>

            <div>
              <label className="block text-neutral-400 font-bold mb-1">Description</label>
              <input
                type="text"
                placeholder="Depot diesel pump, toll receipt..."
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                  isDark
                    ? 'bg-[#14171e] border-[#272e3d] text-neutral-200'
                    : 'bg-white border-[#ded7ca] text-neutral-800'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddExpense(false)}
              className="px-3 py-1.5 text-xs text-neutral-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-1.5 rounded-xl text-xs font-bold ${
                isDark ? 'bg-[#ccff00] text-black' : 'bg-[#d97706] text-white'
              }`}
            >
              Save Expense
            </button>
          </div>
        </form>
      )}

      {/* Financial KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Completed Revenue</div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ${totalRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">From completed customer trips</div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Total Operating Cost</div>
          <div className="text-2xl font-extrabold text-red-400 font-mono">
            ${totalOperatingCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Fuel + Maintenance + Tolls</div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Net Operating Margin</div>
          <div
            className={`text-2xl font-extrabold font-mono ${
              netOperatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            ${netOperatingProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Gross operational return</div>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#ccff00]/40' : 'bg-amber-50 border-amber-300'
          }`}
        >
          <div className="text-xs text-neutral-400 mb-1">Fleet Fuel Efficiency</div>
          <div
            className={`text-2xl font-extrabold font-mono ${
              isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
            }`}
          >
            {fleetAverageKmPerLiter} km/L
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Weighted completed trips average</div>
        </div>
      </div>

      {/* Vehicle ROI Leaderboard (Section 3.5: ROI = (Revenue - (Maint + Fuel)) / Acquisition Cost) */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-inherit">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp
                className={`w-5 h-5 ${
                  isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
                }`}
              />
              <h3 className="font-bold text-base">Vehicle Lifetime ROI Matrix</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Formula: <code>ROI = (Revenue - (Maintenance + Fuel)) / Acquisition Cost</code>
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Vehicle</th>
                <th className="py-3">Acquisition Cost</th>
                <th className="py-3">Total Revenue</th>
                <th className="py-3">Maintenance</th>
                <th className="py-3">Fuel Cost</th>
                <th className="py-3">Net Profit</th>
                <th className="py-3 text-right pr-4">Calculated ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {vehicles.map((v) => {
                const roi = calculateVehicleROI(v.id);
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
                        {v.registrationNumber} ({v.type})
                      </div>
                    </td>
                    <td className="py-3.5 font-mono">
                      ${roi.acquisitionCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 font-mono text-emerald-400 font-semibold">
                      ${roi.revenue.toLocaleString()}
                    </td>
                    <td className="py-3.5 font-mono text-red-400">
                      ${roi.maintenanceCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 font-mono text-amber-400">
                      ${roi.fuelCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 font-mono font-bold">
                      ${roi.profit.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full font-mono font-extrabold text-xs ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
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

      {/* Expense History Table */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-inherit">
          <h3 className="font-bold text-base">Expense Log ({expenses.length} Records)</h3>
          <span className="text-xs text-neutral-400">Auditable cost trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Date</th>
                <th className="py-3">Vehicle</th>
                <th className="py-3">Category</th>
                <th className="py-3">Description</th>
                <th className="py-3 text-right pr-4">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {expenses.map((e) => {
                const vehicle = vehicles.find((v) => v.id === e.vehicleId);

                return (
                  <tr
                    key={e.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3 pl-4 font-mono text-neutral-400">{e.date}</td>
                    <td className="py-3 font-semibold">
                      {vehicle?.name || 'Fleet'} ({vehicle?.registrationNumber || 'N/A'})
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-500/10 border border-neutral-500/20 text-[11px] font-medium">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-400">
                      {e.description} {e.fuelLiters ? `(${e.fuelLiters} Liters)` : ''}
                    </td>
                    <td className="py-3 text-right pr-4 font-mono font-bold text-sm">
                      ${e.amount.toLocaleString()}
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
