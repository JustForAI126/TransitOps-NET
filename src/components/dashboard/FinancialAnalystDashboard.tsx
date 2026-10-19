import React from 'react';
import {
  Fuel,
  Wrench,
  TrendingUp,
  Percent,
  Download,
  Receipt,
  PieChart,
  ArrowUpRight,
  IndianRupee,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { formatRupees } from '../../utils/currency';

export const FinancialAnalystDashboard: React.FC = () => {
  const {
    trips,
    vehicles,
    maintenanceRecords,
    expenses,
    exportToCSV,
    setActiveView,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Financial calculations in Indian Rupees (₹)
  const totalMaintenanceCost = maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0);
  
  // Fuel expense from logged expenses + estimated from completed trips (₹105/L diesel)
  const loggedFuelCost = expenses
    .filter((e) => e.type === 'Fuel' || e.category === 'Fuel' || e.fuelLiters)
    .reduce((acc, e) => acc + (e.cost || e.amount || 0), 0);
  
  const tripFuelCost = trips.reduce((acc, t) => {
    const liters = t.fuelConsumedLiters || (t.plannedDistanceKm * 0.18);
    return acc + (liters * 105);
  }, 0);

  const totalFuelCost = Math.max(loggedFuelCost, Math.round(tripFuelCost));
  const otherExpenses = expenses
    .filter((e) => e.type !== 'Fuel' && e.category !== 'Fuel')
    .reduce((acc, e) => acc + (e.cost || e.amount || 0), 0);

  const totalOpex = totalMaintenanceCost + totalFuelCost + otherExpenses;
  const totalRevenue = trips.reduce((acc, t) => acc + (t.revenue || 0), 0);
  const netOperatingProfit = totalRevenue - totalOpex;
  const operatingMargin = totalRevenue > 0 ? Math.round((netOperatingProfit / totalRevenue) * 100) : 0;

  const totalDistanceKm = trips.reduce((acc, t) => acc + (t.plannedDistanceKm || 0), 0);
  const costPerKm = totalDistanceKm > 0 ? (totalOpex / totalDistanceKm).toFixed(2) : '0.00';

  // Vehicle Financial ranking
  const sortedVehiclesByRevenue = [...vehicles].sort((a, b) => b.revenueGenerated - a.revenueGenerated);
  const topRevenueVehicle = sortedVehiclesByRevenue[0];
  const lowestEfficiencyVehicle = [...vehicles].sort((a, b) => a.fuelEfficiencyKmPerLiter - b.fuelEfficiencyKmPerLiter)[0];

  const handleExportFinancials = () => {
    const rows = trips.map((t) => {
      const fuelLiters = t.fuelConsumedLiters || Math.round(t.plannedDistanceKm * 0.18);
      const estimatedFuelCost = Math.round(fuelLiters * 105);
      const netProfit = (t.revenue || 0) - estimatedFuelCost;

      return {
        TripCode: t.tripCode,
        Source: t.source,
        Destination: t.destination,
        Vehicle: `${t.vehicleName} (${t.vehicleRegNumber})`,
        Driver: t.driverName,
        DistanceKm: t.plannedDistanceKm,
        FuelLiters: fuelLiters,
        FuelCostINR: estimatedFuelCost,
        RevenueINR: t.revenue || 0,
        NetMarginINR: netProfit,
        Status: t.status,
      };
    });
    exportToCSV('transitops-financial-ledger', rows);
  };

  const isEmptyState = trips.length === 0 && expenses.length === 0 && vehicles.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span className="font-semibold text-amber-500">
              FINANCIAL &amp; OPEX CONSOLE (INR ₹)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Fleet Profitability &amp; Cost Ledger
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportFinancials}
            disabled={trips.length === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              trips.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-300'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Financial Ledger</span>
          </button>
        </div>
      </div>

      {isEmptyState ? (
        <div
          className={`p-10 rounded-2xl border text-center space-y-4 ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2]'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <IndianRupee className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold">New Account Workspace</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Your financial ledger is ready. Seeded demo data is hidden from new accounts. Once you register vehicles and record freight runs, live operating expenses and net margins will appear here in Indian Rupees (₹).
            </p>
          </div>
          <button
            onClick={() => setActiveView('vehicles')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add First Fleet Asset</span>
          </button>
        </div>
      ) : (
        <>
          {/* Tailored Financial KPIs Row in Rupees (₹) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total OPEX</span>
                <IndianRupee className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-black font-mono text-red-400">{formatRupees(totalOpex)}</div>
              <div className="text-[11px] text-neutral-500 mt-1">Fuel + Maint + Tolls</div>
            </div>

            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Fuel Spend</span>
                <Fuel className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">{formatRupees(totalFuelCost)}</div>
              <div className="text-[11px] text-neutral-500 mt-1">Fleet diesel spend</div>
            </div>

            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Maintenance</span>
                <Wrench className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-2xl font-black font-mono text-orange-400">{formatRupees(totalMaintenanceCost)}</div>
              <div className="text-[11px] text-neutral-500 mt-1">Service &amp; repair bills</div>
            </div>

            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Revenue</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">{formatRupees(totalRevenue)}</div>
              <div className="text-[11px] text-neutral-500 mt-1">Billed transit freight</div>
            </div>

            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Cost / KM</span>
                <Receipt className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black font-mono">₹{costPerKm}</div>
              <div className="text-[11px] text-neutral-500 mt-1">Operating expense/km</div>
            </div>

            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-neutral-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Net Margin</span>
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">+{operatingMargin}%</div>
              <div className="text-[11px] text-neutral-500 mt-1">Gross profit margin</div>
            </div>
          </div>

          {/* Financial Analytics: Expense Breakdown & Asset Cost Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Cost Allocation Distribution */}
            <div
              className={`lg:col-span-7 p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-base">Fleet OPEX Allocation Breakdown</h3>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">
                    {formatRupees(totalOpex)} Total
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-6">
                  Distribution of operational expenditures across fuel consumption, shop maintenance, and tolls in INR (₹).
                </p>

                {/* Proportion Bars */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-amber-400" />
                        <span>Diesel &amp; Fuel Expenses</span>
                      </span>
                      <span className="font-mono">{formatRupees(totalFuelCost)} ({totalOpex > 0 ? Math.round((totalFuelCost / totalOpex) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-neutral-500/15 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${totalOpex > 0 ? Math.round((totalFuelCost / totalOpex) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-orange-400" />
                        <span>Maintenance &amp; Repairs</span>
                      </span>
                      <span className="font-mono">{formatRupees(totalMaintenanceCost)} ({totalOpex > 0 ? Math.round((totalMaintenanceCost / totalOpex) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-neutral-500/15 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all"
                        style={{ width: `${totalOpex > 0 ? Math.round((totalMaintenanceCost / totalOpex) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                        <span>FASTag Tolls, Permits &amp; Overhead</span>
                      </span>
                      <span className="font-mono">{formatRupees(otherExpenses)} ({totalOpex > 0 ? Math.round((otherExpenses / totalOpex) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-neutral-500/15 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full transition-all"
                        style={{ width: `${totalOpex > 0 ? Math.max(5, Math.round((otherExpenses / totalOpex) * 100)) : 5}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl text-[11px] leading-relaxed border ${
                  isDark ? 'bg-[#161a22] border-[#222733] text-neutral-400' : 'bg-neutral-100 border-[#ded7ca] text-neutral-600'
                }`}
              >
                <strong>Financial Insight:</strong> Fuel represents the dominant variable operational cost ({totalOpex > 0 ? Math.round((totalFuelCost / totalOpex) * 100) : 0}% of total OPEX). Routings with higher payload density achieve optimal ₹/ton-km efficiency.
              </div>
            </div>

            {/* Right 5 Cols: Asset Financial Highlights */}
            <div
              className={`lg:col-span-5 p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
                isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-base">Asset Return &amp; Cost Drivers</h3>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold">
                    {vehicles.length} Carriers
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-4">
                  Key vehicle return-on-investment benchmarks and efficiency leaders.
                </p>

                <div className="space-y-3">
                  {topRevenueVehicle && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        isDark ? 'bg-[#181c25] border-emerald-500/30 text-neutral-200' : 'bg-emerald-50/50 border-emerald-200 text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span className="text-emerald-400">Top Revenue Generator</span>
                        <span className="font-mono text-emerald-400">{formatRupees(topRevenueVehicle.revenueGenerated)}</span>
                      </div>
                      <div className="font-semibold text-[11px]">{topRevenueVehicle.name} ({topRevenueVehicle.registrationNumber})</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        Acquisition: {formatRupees(topRevenueVehicle.acquisitionCost)} · Odometer: {topRevenueVehicle.currentOdometerKm.toLocaleString()} km
                      </div>
                    </div>
                  )}

                  {lowestEfficiencyVehicle && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        isDark ? 'bg-[#181c25] border-amber-500/30 text-neutral-200' : 'bg-amber-50/50 border-amber-200 text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span className="text-amber-400">Highest Fuel Burn Asset</span>
                        <span className="font-mono text-amber-400">{lowestEfficiencyVehicle.fuelEfficiencyKmPerLiter} km/L</span>
                      </div>
                      <div className="font-semibold text-[11px]">{lowestEfficiencyVehicle.name} ({lowestEfficiencyVehicle.registrationNumber})</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        Type: {lowestEfficiencyVehicle.type} · High payload heavy-haul route profile
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl text-[11px] leading-relaxed border ${
                  isDark ? 'bg-[#161a22] border-[#222733] text-neutral-400' : 'bg-neutral-100 border-[#ded7ca] text-neutral-600'
                }`}
              >
                <strong>Analyst Note:</strong> Net operating profit is calculated automatically per run as <code>Revenue - (Fuel Consumed × ₹105/L) - Work Orders</code>.
              </div>
            </div>
          </div>

          {/* Trip Financials & Margin Ledger Table */}
          <div
            className={`p-5 sm:p-6 rounded-2xl border ${
              isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-inherit gap-2">
              <div>
                <h3 className="font-bold text-base">Trip Profitability &amp; Cost Ledger</h3>
                <p className="text-xs text-neutral-400">
                  Per-trip economic performance, freight revenue realization, and net operating margin in Indian Rupees (₹)
                </p>
              </div>
              <button
                onClick={() => setActiveView('analytics')}
                className={`text-xs font-bold hover:underline flex items-center gap-1 ${
                  isDark ? 'text-amber-400' : 'text-amber-600'
                }`}
              >
                <span>Deep Cost Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                    <th className="pb-3 pl-2">Trip Code</th>
                    <th className="pb-3">Route</th>
                    <th className="pb-3">Carrier &amp; Driver</th>
                    <th className="pb-3">Distance</th>
                    <th className="pb-3">Est. Fuel Cost</th>
                    <th className="pb-3">Freight Revenue</th>
                    <th className="pb-3 text-right pr-2">Net Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit font-medium">
                  {trips.slice(0, 6).map((t) => {
                    const fuelLiters = t.fuelConsumedLiters || Math.round(t.plannedDistanceKm * 0.18);
                    const estimatedFuelCost = Math.round(fuelLiters * 105);
                    const revenue = t.revenue || 0;
                    const netMargin = revenue - estimatedFuelCost;

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
                          <div className="text-[10px] text-neutral-400">{t.driverName}</div>
                        </td>
                        <td className="py-3 font-mono">{t.plannedDistanceKm} km</td>
                        <td className="py-3 font-mono text-amber-400">
                          {formatRupees(estimatedFuelCost)}
                          <span className="text-[10px] text-neutral-400 ml-1">({fuelLiters}L)</span>
                        </td>
                        <td className="py-3 font-mono font-bold text-emerald-400">
                          {formatRupees(revenue)}
                        </td>
                        <td className="py-3 text-right pr-2 font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              netMargin >= 0
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            +{formatRupees(netMargin)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
