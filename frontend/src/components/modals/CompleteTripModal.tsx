import React, { useState } from 'react';
import { X, CheckCircle2, Gauge, Fuel, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Trip } from '../../types';

interface CompleteTripModalProps {
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CompleteTripModal: React.FC<CompleteTripModalProps> = ({
  trip,
  isOpen,
  onClose,
}) => {
  const { vehicles, completeTrip } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen || !trip) return null;

  const vehicle = vehicles.find((v) => v.id === trip.vehicleId);
  const currentOdo = vehicle?.currentOdometerKm || 30000;
  const suggestedOdo = currentOdo + trip.plannedDistanceKm;

  const [finalOdometer, setFinalOdometer] = useState<number>(suggestedOdo);
  const [fuelConsumed, setFuelConsumed] = useState<number>(Math.round(trip.plannedDistanceKm / 10));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (finalOdometer < currentOdo) {
      setError(`Final odometer (${finalOdometer} km) cannot be lower than start odometer (${currentOdo} km).`);
      return;
    }

    const res = await completeTrip(trip.id, Number(finalOdometer), Number(fuelConsumed));
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to complete trip');
    }
  };

  const distanceTravelled = Math.max(0, finalOdometer - currentOdo);
  const calculatedEfficiency =
    fuelConsumed > 0 ? (distanceTravelled / fuelConsumed).toFixed(1) : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className={`max-w-md w-full rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-[#14171e] border-[#252b36] text-neutral-100'
            : 'bg-white border-[#e2dbce] text-neutral-900'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-inherit">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Complete Trip {trip.tripCode}</h3>
              <p className="text-xs text-neutral-400">
                Log final odometer &amp; fuel consumed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div
            className={`p-3 rounded-xl border text-xs space-y-1 ${
              isDark ? 'bg-[#181c25] border-[#242b38]' : 'bg-neutral-50 border-[#ded7ca]'
            }`}
          >
            <div className="flex justify-between">
              <span className="text-neutral-400">Route:</span>
              <span className="font-semibold">{trip.source} → {trip.destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Vehicle:</span>
              <span className="font-semibold">{trip.vehicleName} ({trip.vehicleRegNumber})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Driver:</span>
              <span className="font-semibold">{trip.driverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Starting Odometer:</span>
              <span className="font-mono font-bold">{currentOdo.toLocaleString()} km</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" />
              <span>Final Odometer Reading (km)</span>
            </label>
            <input
              type="number"
              required
              min={currentOdo}
              value={finalOdometer}
              onChange={(e) => setFinalOdometer(Number(e.target.value))}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
              }`}
            />
            <span className="text-[10px] text-neutral-400 mt-1 block">
              Calculated distance: {distanceTravelled} km (Planned: {trip.plannedDistanceKm} km)
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5" />
              <span>Fuel Consumed (Liters)</span>
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.5"
              value={fuelConsumed}
              onChange={(e) => setFuelConsumed(Number(e.target.value))}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-semibold ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
              }`}
            />
            <span className="text-[10px] text-neutral-400 mt-1 block">
              Resulting Trip Efficiency: ~{calculatedEfficiency} km/L
            </span>
          </div>

          <div
            className={`p-3 rounded-xl text-[11px] leading-relaxed ${
              isDark ? 'bg-[#161a22] text-neutral-400' : 'bg-neutral-50 text-neutral-600'
            }`}
          >
            <span className="font-semibold text-emerald-400">Rule Enforced:</span> Completing this delivery restores both {trip.vehicleName} and {trip.driverName} status to <strong>&quot;Available&quot;</strong> for subsequent dispatch assignments.
          </div>

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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete &amp; Restore Resources</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
