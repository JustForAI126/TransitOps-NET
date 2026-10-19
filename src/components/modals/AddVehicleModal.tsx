import React, { useState } from 'react';
import { X, Truck, AlertCircle, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { VehicleType, VehicleStatus } from '../../types';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddVehicleModal: React.FC<AddVehicleModalProps> = ({ isOpen, onClose }) => {
  const { addVehicle } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState<VehicleType>('Van');
  const [maxCapacityKg, setMaxCapacityKg] = useState<number>(1200);
  const [currentOdometerKm, setCurrentOdometerKm] = useState<number>(25000);
  const [acquisitionCost, setAcquisitionCost] = useState<number>(38000);
  const [status, setStatus] = useState<VehicleStatus>('Available');
  const [region, setRegion] = useState('Mumbai West');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await addVehicle({
      registrationNumber: registrationNumber.trim(),
      name: name.trim() || `${type}-${registrationNumber.slice(-4)}`,
      model: model.trim() || `${type} Standard Edition`,
      type,
      maxCapacityKg: Number(maxCapacityKg),
      currentOdometerKm: Number(currentOdometerKm),
      acquisitionCost: Number(acquisitionCost),
      status,
      region,
      documents: [
        { type: 'Fitness Certificate', expiryDate: '2027-10-15', status: 'Valid' },
        { type: 'Commercial Insurance', expiryDate: '2027-08-20', status: 'Valid' },
      ],
    });

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to add vehicle');
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
            <div
              className={`p-2 rounded-lg ${
                isDark ? 'bg-[#ccff00]/15 text-[#ccff00]' : 'bg-amber-100 text-amber-800'
              }`}
            >
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Register New Vehicle</h3>
              <p className="text-xs text-neutral-400">
                Enforces unique registration &amp; asset metadata
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

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Registration No. *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MH-12-AB-1234"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                className={`w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Vehicle Call-Sign
              </label>
              <input
                type="text"
                placeholder="e.g. Van-05"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Vehicle Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as VehicleType)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
                }`}
              >
                <option value="Van">Van</option>
                <option value="Truck">Truck</option>
                <option value="Pickup">Pickup</option>
                <option value="Semi-Trailer">Semi-Trailer</option>
                <option value="Box Truck">Box Truck</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Make &amp; Model
              </label>
              <input
                type="text"
                placeholder="e.g. Ford Transit 350"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Max Capacity (kg) *
              </label>
              <input
                type="number"
                required
                min="100"
                value={maxCapacityKg}
                onChange={(e) => setMaxCapacityKg(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Odometer (km)
              </label>
              <input
                type="number"
                required
                min="0"
                value={currentOdometerKm}
                onChange={(e) => setCurrentOdometerKm(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Acquisition Cost (₹)
              </label>
              <input
                type="number"
                required
                min="1000"
                value={acquisitionCost}
                onChange={(e) => setAcquisitionCost(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Operational Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
                }`}
              >
                <option value="Mumbai West">Mumbai West Hub</option>
                <option value="Pune Hub">Pune Hub</option>
                <option value="Bangalore South">Bangalore South Hub</option>
                <option value="Delhi NCR Hub">Delhi NCR Hub</option>
                <option value="Chennai Port Hub">Chennai Port Hub</option>
                <option value="Ahmedabad Industrial">Ahmedabad Industrial</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Initial Fleet Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VehicleStatus)}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
              }`}
            >
              <option value="Available">Available (Ready for Dispatch)</option>
              <option value="In Shop">In Shop (Maintenance Queue)</option>
              <option value="Retired">Retired (Decommissioned)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 ${
                isDark
                  ? 'bg-[#ccff00] text-black hover:bg-[#b8e600]'
                  : 'bg-[#d97706] text-white hover:bg-[#b45309]'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Register Vehicle</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
