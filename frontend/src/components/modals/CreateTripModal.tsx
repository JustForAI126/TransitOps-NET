import React, { useState } from 'react';
import { X, AlertTriangle, Check, Route, ShieldAlert, Scale } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ isOpen, onClose }) => {
  const { vehicles, drivers, createTrip, userRole } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [source, setSource] = useState('Mumbai Central Depot');
  const [destination, setDestination] = useState('Pune Chakan Industrial Hub');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [cargoWeightKg, setCargoWeightKg] = useState<number>(450);
  const [plannedDistanceKm, setPlannedDistanceKm] = useState<number>(160);
  // Freight revenue is suggested from the demo freight rate (₹38 per tonne-km) until the manager edits it.
  const [revenueInput, setRevenueInput] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || (userRole !== 'fleet_manager' && userRole !== 'driver')) return null;

  // Filter available vehicles (Business Rule 2: In Shop and Retired must never appear in dispatch selection)
  const eligibleVehicles = vehicles.filter((v) => v.status === 'Available');
  // Show in-shop/retired count for user clarity
  const inShopCount = vehicles.filter((v) => v.status === 'In Shop').length;

  // Filter eligible drivers (Business Rule 3: Drivers with expired licenses or Suspended status cannot be assigned)
  const today = new Date().toISOString().split('T')[0];
  const eligibleDrivers = drivers.filter(
    (d) => (d.status === 'Available' || d.status === 'On Duty') && d.licenseExpiryDate >= today
  );

  const suggestedRevenue = Math.round((plannedDistanceKm * cargoWeightKg / 1000) * 38);
  const revenueValue = revenueInput ?? String(suggestedRevenue);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const selectedDriver = drivers.find((d) => d.id === driverId);

  // Real-time capacity check
  const isOverweight =
    selectedVehicle && cargoWeightKg > selectedVehicle.maxCapacityKg;
  const overweightDiff =
    selectedVehicle && isOverweight
      ? cargoWeightKg - selectedVehicle.maxCapacityKg
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!vehicleId) {
      setErrorMessage('Please select an available vehicle.');
      return;
    }
    if (!driverId) {
      setErrorMessage('Please select an available driver.');
      return;
    }
    if (revenueValue.trim() === '' || Number(revenueValue) < 0) {
      setErrorMessage('Enter the freight revenue for this trip (0 or more).');
      return;
    }

    const res = await createTrip({
      source,
      destination,
      vehicleId,
      driverId,
      cargoWeightKg: Number(cargoWeightKg),
      plannedDistanceKm: Number(plannedDistanceKm),
      revenue: Number(revenueValue),
    });

    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to create trip');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className={`max-w-lg w-full rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#14171e] border-[#252b36] text-neutral-100'
            : 'bg-white border-[#e2dbce] text-neutral-900'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                isDark ? 'bg-[#ccff00]/15 text-[#ccff00]' : 'bg-amber-100 text-amber-800'
              }`}
            >
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">New Trip Dispatch</h3>
              <p className="text-xs text-neutral-400">
                Enforcing load limits & driver license compliance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-500/20 text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Route Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Source
              </label>
              <input
                type="text"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Destination
              </label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
          </div>

          {/* Vehicle Selection (Rule 2: In Shop / Retired filtered out!) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Select Vehicle ({eligibleVehicles.length} Available)
              </label>
              {inShopCount > 0 && (
                <span className="text-[10px] text-red-400 font-medium">
                  {inShopCount} In Shop (Hidden)
                </span>
              )}
            </div>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
              }`}
            >
              <option value="">-- Choose an Available Vehicle --</option>
              {eligibleVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.model}) - Max {v.maxCapacityKg} kg [{v.registrationNumber}]
                </option>
              ))}
            </select>
          </div>

          {/* Driver Selection (Rule 3: Suspended / Expired filtered out!) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Select Driver ({eligibleDrivers.length} Eligible)
              </label>
              <span className="text-[10px] text-neutral-400">
                Expired/Suspended excluded
              </span>
            </div>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              required
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
              }`}
            >
              <option value="">-- Choose an Eligible Driver --</option>
              {eligibleDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.licenseCategory}) - Safety Score: {d.safetyScore}/100
                </option>
              ))}
            </select>
          </div>

          {/* Cargo Weight & Distance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" />
                  <span>Cargo Weight (kg)</span>
                </label>
                {selectedVehicle && (
                  <span className="text-[10px] text-neutral-400">
                    Max: {selectedVehicle.maxCapacityKg} kg
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                required
                value={cargoWeightKg}
                onChange={(e) => setCargoWeightKg(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                  isOverweight
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Planned Distance (km)
              </label>
              <input
                type="number"
                min="1"
                required
                value={plannedDistanceKm}
                onChange={(e) => setPlannedDistanceKm(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
          </div>

          {/* Freight revenue */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Freight Revenue (₹)
              </label>
              {revenueInput !== null && (
                <button
                  type="button"
                  onClick={() => setRevenueInput(null)}
                  className="text-[10px] text-neutral-400 underline"
                >
                  Use suggested ₹{suggestedRevenue.toLocaleString('en-IN')}
                </button>
              )}
            </div>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={revenueValue}
              onChange={(e) => setRevenueInput(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
              }`}
            />
            <p className="mt-1 text-[10px] text-neutral-400">
              Amount charged to the customer. Suggested at ₹38 per tonne-km; shown on the trip receipt and used in profit and ROI.
            </p>
          </div>

          {/* Overweight Warning Banner */}
          {isOverweight && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span>Overweight Assignment Blocked</span>
              </div>
              <p className="mt-1 text-[11px]">
                Cargo weight of {cargoWeightKg} kg exceeds {selectedVehicle.name}&apos;s limit by {overweightDiff} kg.
                Please reduce weight or select a vehicle with higher capacity.
              </p>
            </div>
          )}

          {/* Rule Note */}
          <div
            className={`p-3 rounded-xl text-[11px] leading-relaxed ${
              isDark ? 'bg-[#161a22] text-neutral-400' : 'bg-neutral-50 text-neutral-600'
            }`}
          >
            <span className="font-semibold text-neutral-300 dark:text-neutral-200">
              ⚡ Automatic Transitions:
            </span>{' '}
            Dispatching this trip automatically changes both {selectedVehicle?.name || 'the vehicle'} and {selectedDriver?.name || 'the driver'} status to <strong>&quot;On Trip&quot;</strong>.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(isOverweight || !vehicleId || !driverId)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                isOverweight || !vehicleId || !driverId
                  ? 'opacity-40 cursor-not-allowed bg-neutral-700 text-neutral-400'
                  : isDark
                  ? 'bg-[#ccff00] text-black hover:bg-[#b8e600]'
                  : 'bg-[#d97706] text-white hover:bg-[#b45309]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Create &amp; Save Draft</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
