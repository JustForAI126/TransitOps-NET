import React, { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { DriverStatus, INDIAN_LICENSE_CATEGORIES } from '../../types';

interface AddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDriverModal: React.FC<AddDriverModalProps> = ({ isOpen, onClose }) => {
  const { addDriver } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseCategory, setLicenseCategory] = useState<string>('HGMV');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('2028-06-30');
  const [contactNumber, setContactNumber] = useState('+91 98');
  const [safetyScore, setSafetyScore] = useState<number>(95);
  const [status, setStatus] = useState<DriverStatus>('Available');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const generatedEmail =
      email.trim() ||
      `${name.toLowerCase().replace(/\s+/g, '.')}@transitops.com`;

    const res = await addDriver({
      name: name.trim(),
      licenseNumber: licenseNumber.trim().toUpperCase(),
      licenseCategory,
      licenseExpiryDate,
      contactNumber: contactNumber.trim(),
      safetyScore: Number(safetyScore),
      status,
      email: generatedEmail,
    });

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to add driver');
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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Add Driver Profile</h3>
              <p className="text-xs text-neutral-400">
                License compliance &amp; safety rating record
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
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              isDark
                ? 'bg-red-500/15 border-red-500/30 text-red-300'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Full Driver Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Vikram Malhotra"
              value={name}
              onChange={(e) => { setError(null); setName(e.target.value); }}
              className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                  : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                License Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MH-12-2024009182"
                value={licenseNumber}
                onChange={(e) => { setError(null); setLicenseNumber(e.target.value.toUpperCase()); }}
                className={`w-full px-3 py-2 text-xs font-mono font-semibold rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                License Category
              </label>
              <select
                value={licenseCategory}
                onChange={(e) => { setError(null); setLicenseCategory(e.target.value); }}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
                }`}
              >
                {INDIAN_LICENSE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                License Expiry Date *
              </label>
              <input
                type="date"
                required
                value={licenseExpiryDate}
                onChange={(e) => { setError(null); setLicenseExpiryDate(e.target.value); }}
                className={`w-full px-3 py-2 text-xs font-mono rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Safety Score (0 - 100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={safetyScore}
                onChange={(e) => { setError(null); setSafetyScore(Number(e.target.value)); }}
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
                Contact Number
              </label>
              <input
                type="text"
                required
                placeholder="+91 98200 00000"
                value={contactNumber}
                onChange={(e) => { setError(null); setContactNumber(e.target.value); }}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
                Duty Status
              </label>
              <select
                value={status}
                onChange={(e) => { setError(null); setStatus(e.target.value as DriverStatus); }}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium cursor-pointer ${
                  isDark
                    ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                    : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
                }`}
              >
                <option value="Available">Available</option>
                <option value="Off Duty">Off Duty</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
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
              <UserPlus className="w-4 h-4" />
              <span>Save Driver Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
