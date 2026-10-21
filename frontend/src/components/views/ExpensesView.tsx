import React, { useState } from 'react';
import {
  Fuel,
  Plus,
  Search,
  Download,
  IndianRupee,
  Trash2,
  TrendingUp,
  Receipt,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { ExpenseType } from '../../types';
import { formatRupees } from '../../utils/currency';

interface ExpensesViewProps {
  onOpenLogMaintModal?: (vehicleId?: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = () => {
  const {
    vehicles,
    trips,
    expenses,
    addExpense,
    deleteExpense,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Modal / Form state for new expense
  const [showModal, setShowModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [category, setCategory] = useState<ExpenseType>('Fuel');
  const [amount, setAmount] = useState<number | ''>(95);
  const [liters, setLiters] = useState<number | ''>(45);
  const [fuelType, setFuelType] = useState('Diesel');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Filters and search
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [vehicleFilter, setVehicleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest'>('newest');

  // Computed metrics
  const totalFuelExpenses = expenses.filter(
    (e) => (e.type === 'Fuel' || e.category === 'Fuel')
  );
  const totalFuelCost = totalFuelExpenses.reduce(
    (sum, e) => sum + (e.cost || e.amount || 0),
    0
  );
  const totalLitersPumped = totalFuelExpenses.reduce(
    (sum, e) => sum + (e.liters || e.fuelLiters || 0),
    0
  );

  const totalTollCost = expenses
    .filter((e) => e.type === 'Toll' || e.category === 'Toll')
    .reduce((sum, e) => sum + (e.cost || e.amount || 0), 0);

  const grandTotalCost = expenses.reduce(
    (sum, e) => sum + (e.cost || e.amount || 0),
    0
  );

  // Fleet Average km/L from completed trips
  const completedTrips = trips.filter(
    (t) => t.status === 'Completed' && t.fuelConsumedLiters
  );
  const totalCompletedDist = completedTrips.reduce(
    (acc, t) => acc + t.plannedDistanceKm,
    0
  );
  const totalTripFuel = completedTrips.reduce(
    (acc, t) => acc + (t.fuelConsumedLiters || 0),
    0
  );
  const avgFleetKmL =
    totalTripFuel > 0 ? (totalCompletedDist / totalTripFuel).toFixed(1) : '8.9';

  // Filtered and sorted expenses
  const filteredExpenses = expenses
    .filter((e) => {
      const eType = e.type || e.category || 'Other';
      const vName = e.vehicleName || '';
      const vReg = e.vehicleRegNumber || '';
      const noteText = e.notes || e.description || '';

      const matchSearch =
        vName.toLowerCase().includes(search.toLowerCase()) ||
        vReg.toLowerCase().includes(search.toLowerCase()) ||
        noteText.toLowerCase().includes(search.toLowerCase()) ||
        eType.toLowerCase().includes(search.toLowerCase());

      const matchCategory =
        categoryFilter === 'All' ||
        eType.toLowerCase() === categoryFilter.toLowerCase();

      const matchVehicle =
        vehicleFilter === 'All' || e.vehicleId === vehicleFilter;

      return matchSearch && matchCategory && matchVehicle;
    })
    .sort((a, b) => {
      if (sortBy === 'highest') {
        return (b.cost || b.amount || 0) - (a.cost || a.amount || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !amount) return;

    const targetVehicle = vehicles.find((v) => v.id === selectedVehicleId);

    addExpense({
      vehicleId: selectedVehicleId,
      vehicleName: targetVehicle?.name || 'Fleet Asset',
      vehicleRegNumber: targetVehicle?.registrationNumber || '',
      type: category,
      category: category,
      cost: Number(amount),
      amount: Number(amount),
      date: date || new Date().toISOString().split('T')[0],
      liters: category === 'Fuel' && liters ? Number(liters) : undefined,
      fuelLiters: category === 'Fuel' && liters ? Number(liters) : undefined,
      odometerReading: odometer ? Number(odometer) : undefined,
      notes: notes.trim()
        ? `${category === 'Fuel' ? `[${fuelType}] ` : ''}${notes.trim()}`
        : `${category} logged at terminal`,
      description: notes.trim() || `${category} expense`,
    });

    setShowModal(false);
    setAmount(95);
    setLiters(45);
    setNotes('');
    setOdometer('');
  };

  const handleExportCSV = () => {
    const dataToExport = filteredExpenses.map((e) => ({
      'Expense ID': e.id,
      Date: e.date,
      Vehicle: e.vehicleName || 'Fleet',
      Registration: e.vehicleRegNumber || 'N/A',
      Category: e.type || e.category || 'Other',
      'Cost (₹)': e.cost || e.amount || 0,
      'Liters Pumped': e.liters || e.fuelLiters || '-',
      'Odometer (km)': e.odometerReading || '-',
      Notes: e.notes || e.description || '',
    }));
    exportToCSV('transitops-fuel-and-expenses-log', dataToExport);
  };

  const getCategoryBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'fuel':
        return isDark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-amber-100 text-amber-800 border-amber-200';
      case 'toll':
        return isDark
          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          : 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance':
        return isDark
          ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : 'bg-red-100 text-red-800 border-red-200';
      case 'permit':
        return isDark
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'insurance':
        return isDark
          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
          : 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return isDark
          ? 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30'
          : 'bg-neutral-200 text-neutral-800 border-neutral-300';
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
              FUEL &amp; EXPENSES DESK
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Fuels and Expenses
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Fuel logs, FASTag tolls, fluid refills, and operational overheads tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-200'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Log Fuel / Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Fuel Spend */}
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              Total Fuel Spend
            </span>
            <span className="font-mono text-[10px]">{totalFuelExpenses.length} fills</span>
          </div>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            {formatRupees(totalFuelCost)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {totalLitersPumped.toLocaleString()} Liters recorded
          </div>
        </div>

        {/* KPI 2: Toll Overheads */}
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-blue-400" />
              FASTag &amp; Tolls
            </span>
          </div>
          <div className="text-2xl font-extrabold text-blue-400 font-mono">
            {formatRupees(totalTollCost)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Highway tolls &amp; transit checkpoints
          </div>
        </div>

        {/* KPI 3: Fleet Average Fuel Economy */}
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#ccff00]/30' : 'bg-amber-50/80 border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="flex items-center gap-1 font-bold">
              <TrendingUp className={`w-3.5 h-3.5 ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`} />
              Fleet Fuel Economy
            </span>
          </div>
          <div
            className={`text-2xl font-extrabold font-mono ${
              isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
            }`}
          >
            {avgFleetKmL} km/L
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Across {completedTrips.length} completed manifests
          </div>
        </div>

        {/* KPI 4: Total Operating Overhead */}
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              Grand Total Logged
            </span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {formatRupees(grandTotalCost)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {expenses.length} auditable receipts
          </div>
        </div>
      </div>

      {/* Fuel Consumption Overview by Asset Card */}
      <div
        className={`p-5 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Fuel className={`w-4 h-4 ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`} />
            <h2 className="font-bold text-sm">Asset Fuel Consumption Matrix</h2>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">
            Real-time per vehicle metrics
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.slice(0, 6).map((v) => {
            const vFuelExps = expenses.filter(
              (e) =>
                e.vehicleId === v.id && (e.type === 'Fuel' || e.category === 'Fuel')
            );
            const vFuelCost = vFuelExps.reduce(
              (sum, e) => sum + (e.cost || e.amount || 0),
              0
            );
            const vLiters = vFuelExps.reduce(
              (sum, e) => sum + (e.liters || e.fuelLiters || 0),
              0
            );

            return (
              <div
                key={v.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'bg-[#181d27] border-[#262d3c]' : 'bg-neutral-50 border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-xs">{v.name}</div>
                    <div className="text-[10px] font-mono text-neutral-400">
                      {v.registrationNumber} • {v.type}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {v.fuelEfficiencyKmPerLiter} km/L
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-inherit flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 block">Fuel Spend</span>
                    <span className="font-mono font-bold text-amber-400">
                      ${vFuelCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 block">Volume</span>
                    <span className="font-mono font-semibold">
                      {vLiters > 0 ? `${vLiters} L` : '0 L'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
            placeholder="Search vehicle, reg, note, invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Type:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium text-xs ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Types</option>
              <option value="Fuel">Fuel Only</option>
              <option value="Toll">FASTag / Tolls</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Permit">Permits &amp; Taxes</option>
              <option value="Insurance">Insurance</option>
              <option value="Other">Other Misc</option>
            </select>
          </div>

          {/* Vehicle Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Vehicle:</span>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium text-xs ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.registrationNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium text-xs ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Date</th>
                <th className="py-3">Vehicle Asset</th>
                <th className="py-3">Category</th>
                <th className="py-3">Fuel Volume</th>
                <th className="py-3">Odometer</th>
                <th className="py-3">Details / Station Notes</th>
                <th className="py-3 text-right">Cost (₹)</th>
                <th className="py-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    No expense or fuel records found matching your query.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const eType = exp.type || exp.category || 'Other';
                  const eCost = exp.cost || exp.amount || 0;
                  const eLiters = exp.liters || exp.fuelLiters;
                  const pricePerLiter =
                    eLiters && eCost ? (eCost / eLiters).toFixed(2) : null;

                  return (
                    <tr
                      key={exp.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <td className="py-3.5 pl-4 font-mono text-neutral-400 whitespace-nowrap">
                        {exp.date}
                      </td>
                      <td className="py-3.5 font-medium">
                        <div className="font-bold">{exp.vehicleName || 'Fleet Vehicle'}</div>
                        <div className="text-[10px] font-mono text-neutral-400">
                          {exp.vehicleRegNumber || 'Reg N/A'}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                            eType
                          )}`}
                        >
                          {eType}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono">
                        {eLiters ? (
                          <div>
                            <span className="font-bold">{eLiters} L</span>
                            {pricePerLiter && (
                              <span className="text-[10px] text-neutral-400 block">
                                ${pricePerLiter}/L
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 font-mono text-neutral-400">
                        {exp.odometerReading ? (
                          `${exp.odometerReading.toLocaleString()} km`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 max-w-xs text-neutral-300">
                        <div className="truncate">
                          {exp.notes || exp.description || 'No description provided'}
                        </div>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-sm whitespace-nowrap">
                        ${eCost.toLocaleString()}
                      </td>
                      <td className="py-3.5 text-right pr-4">
                        <button
                          onClick={() => deleteExpense(exp.id)}
                          title="Delete Expense Record"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Fuel & Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150 ${
              isDark ? 'bg-[#14171e] border-[#2b3342] text-neutral-100' : 'bg-white border-[#ded7ca] text-neutral-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit mb-4">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <Fuel className={`w-5 h-5 ${isDark ? 'text-[#ccff00]' : 'text-[#d97706]'}`} />
                  <span>Log Fuel &amp; Operational Expense</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Record terminal receipts, diesel refills, and transit charges
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
              {/* Vehicle Select */}
              <div>
                <label className="block font-bold mb-1 text-neutral-400">Vehicle Asset *</label>
                <select
                  required
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                    isDark
                      ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                      : 'bg-neutral-50 border-[#d7cfbf] text-neutral-800'
                  }`}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.registrationNumber} • {v.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category and Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-neutral-400">Expense Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseType)}
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                      isDark
                        ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                        : 'bg-neutral-50 border-[#d7cfbf] text-neutral-800'
                    }`}
                  >
                    <option value="Fuel">Fuel Fill</option>
                    <option value="Toll">FASTag / Toll</option>
                    <option value="Maintenance">Shop Maintenance</option>
                    <option value="Permit">Interstate Permit / Tax</option>
                    <option value="Insurance">Insurance Premium</option>
                    <option value="Other">Other Overhead</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-neutral-400">Total Cost (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                      isDark
                        ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                        : 'bg-neutral-50 border-[#d7cfbf] text-neutral-800'
                    }`}
                  />
                </div>
              </div>

              {/* Conditional Fuel Specific Fields */}
              {category === 'Fuel' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5">
                  <div>
                    <label className="block font-bold mb-1 text-amber-400">Volume (Liters) *</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      required
                      value={liters}
                      onChange={(e) => setLiters(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 50"
                      className={`w-full px-3 py-2 rounded-xl border outline-none font-mono font-bold ${
                        isDark
                          ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                          : 'bg-white border-[#d7cfbf] text-neutral-800'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 text-amber-400">Fuel Grade</label>
                    <select
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                        isDark
                          ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                          : 'bg-white border-[#d7cfbf] text-neutral-800'
                      }`}
                    >
                      <option value="Diesel">High-Speed Diesel</option>
                      <option value="Petrol">Petrol</option>
                      <option value="CNG">Compressed Natural Gas</option>
                      <option value="EV">EV DC Fast Charging</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Date & Odometer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-neutral-400">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                      isDark
                        ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                        : 'bg-neutral-50 border-[#d7cfbf] text-neutral-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-neutral-400">Odometer Reading (km)</label>
                  <input
                    type="number"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 45000"
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-mono ${
                      isDark
                        ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                        : 'bg-neutral-50 border-[#d7cfbf] text-neutral-800'
                    }`}
                  />
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block font-bold mb-1 text-neutral-400">
                  Station / Invoice Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shell Expressway Depot, FASTag lane 4, Invoice #4821"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border outline-none font-medium ${
                    isDark
                      ? 'bg-[#1a1f29] border-[#293241] text-neutral-200'
                      : 'bg-neutral-50 border-[#d7cfbf] text-neutral-800'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-inherit">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl font-bold text-neutral-400 hover:text-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl font-bold shadow-md ${
                    isDark
                      ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                      : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                  }`}
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
