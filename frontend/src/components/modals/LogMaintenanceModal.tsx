import React, { useState } from 'react';
import { X, Wrench, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { MaintenanceRecord } from '../../types';

interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultVehicleId?: string;
}

export const LogMaintenanceModal: React.FC<LogMaintenanceModalProps> = ({
  isOpen,
  onClose,
  defaultVehicleId,
}) => {
  const { vehicles, createMaintenanceRecord } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [vehicleId, setVehicleId] = useState(defaultVehicleId || (vehicles[0]?.id || ''));
  const [serviceType, setServiceType] = useState<MaintenanceRecord['serviceType']>('Brake Inspection');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState<number>(450);
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vehicleId) {
      setError('Please select a vehicle.');
      return;
    }

    const res = await createMaintenanceRecord({
      vehicleId,
      serviceType,
      description: description.trim() || `${serviceType} scheduled service`,
      cost: Number(cost),
      technicianNotes: technicianNotes.trim() || 'Work order dispatched to central shop.',
    });

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to log maintenance');
    }
  };

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
            <div className="p-2 rounded-lg bg-red-500/15 text-red-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Log Vehicle Maintenance</h3>
              <p className="text-xs text-neutral-400">
                Auto-switches vehicle to &quot;In Shop&quot; status
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

          {/* Automatic Status Change Warning */}
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
            <span className="font-bold">⚠️ Mandatory Rule Notice:</span> Logging this maintenance record will automatically switch{' '}
            <span className="underline font-semibold">{selectedVehicle?.name || 'this vehicle'}</span>&apos;s status to <strong>&quot;In Shop&quot;</strong> and immediately exclude it from the driver dispatch selection pool.
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Select Vehicle
            </label>
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
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.model}) [{v.registrationNumber}] - Current: {v.status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Service Type
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as any)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
                }`}
              >
                <option value="Brake Inspection">Brake Inspection</option>
                <option value="Oil Change">Oil Change</option>
                <option value="Tire Replacement">Tire Replacement</option>
                <option value="Engine Overhaul">Engine Overhaul</option>
                <option value="Battery Service">Battery Service</option>
                <option value="Scheduled PM">Scheduled PM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Estimated Cost (₹)
              </label>
              <input
                type="number"
                required
                min="0"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Issue / Repair Description
            </label>
            <input
              type="text"
              placeholder="e.g. Brake pad wear indicator triggered, hydraulic bleed required"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Technician Notes &amp; Depot
            </label>
            <textarea
              rows={2}
              placeholder="Work bay assigned, spare parts ETA, mechanic notes..."
              value={technicianNotes}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
              }`}
            />
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md transition-all flex items-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              <span>Log Maintenance (Send to Shop)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
