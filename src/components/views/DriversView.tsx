import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Mail,
  Phone,
  Download,
  Award,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Driver, DriverStatus } from '../../types';

interface DriversViewProps {
  onOpenAddDriverModal: () => void;
}

export const DriversView: React.FC<DriversViewProps> = ({ onOpenAddDriverModal }) => {
  const {
    drivers,
    toggleDriverSuspension,
    sendLicenseReminderEmail,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [complianceFilter, setComplianceFilter] = useState<string>('All');

  const today = new Date().toISOString().split('T')[0];

  const getComplianceStatus = (driver: Driver) => {
    if (driver.status === 'Suspended') return 'Suspended';
    if (driver.licenseExpiryDate < today) return 'Expired';
    const diffDays = Math.ceil(
      (new Date(driver.licenseExpiryDate).getTime() - new Date(today).getTime()) /
        (1000 * 3600 * 24)
    );
    if (diffDays <= 30) return 'Expiring Soon';
    return 'Valid';
  };

  const filteredDrivers = drivers.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.licenseCategory.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || d.status === statusFilter;
    const comp = getComplianceStatus(d);
    const matchComp = complianceFilter === 'All' || comp === complianceFilter;
    return matchSearch && matchStatus && matchComp;
  });

  const handleExport = () => {
    const exportData = filteredDrivers.map((d) => ({
      Name: d.name,
      'License Number': d.licenseNumber,
      Category: d.licenseCategory,
      'Expiry Date': d.licenseExpiryDate,
      Compliance: getComplianceStatus(d),
      'Safety Score': `${d.safetyScore}/100`,
      'Trips Completed': d.totalTripsCompleted,
      Status: d.status,
      Phone: d.contactNumber,
      Email: d.email,
    }));
    exportToCSV('transitops-drivers-roster', exportData);
  };

  const getStatusBadge = (status: DriverStatus | string) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Available
          </span>
        );
      case 'On Trip':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            On Trip
          </span>
        );
      case 'Off Duty':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
            Off Duty
          </span>
        );
      case 'Suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
            <ShieldAlert className="w-3 h-3" />
            Suspended
          </span>
        );
    }
  };

  const getComplianceBadge = (comp: string) => {
    switch (comp) {
      case 'Valid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Valid
          </span>
        );
      case 'Expiring Soon':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Expiring Soon (&lt;30d)
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Expired (Blocked)
          </span>
        );
      case 'Suspended':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            Suspended (Blocked)
          </span>
        );
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
              COMPLIANCE WATCH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Driver Directory &amp; Compliance Roster
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
            <span>Export Roster</span>
          </button>
          <button
            onClick={onOpenAddDriverModal}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isDark
                ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                : 'bg-[#d97706] text-white hover:bg-[#b45309]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Driver</span>
          </button>
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
            placeholder="Search driver name, license number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 rounded-xl border outline-none font-medium ${
              isDark
                ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-200'
                : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-800'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Duty:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Duty States</option>
              <option value="Available">Available</option>
              <option value="On Trip">On Trip</option>
              <option value="Off Duty">Off Duty</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Compliance:</span>
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg border outline-none font-medium ${
                isDark
                  ? 'bg-[#191d26] border-[#272e3d] text-neutral-200'
                  : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
              }`}
            >
              <option value="All">All Compliance</option>
              <option value="Valid">Valid</option>
              <option value="Expiring Soon">Expiring Soon</option>
              <option value="Expired">Expired</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div
        className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="py-3 pl-4">Driver Profile</th>
                <th className="py-3">License &amp; Category</th>
                <th className="py-3">Expiry Date</th>
                <th className="py-3">Compliance Status</th>
                <th className="py-3">Safety Score</th>
                <th className="py-3">Duty Status</th>
                <th className="py-3 text-right pr-4">Safety Governance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <Users className="w-10 h-10 mx-auto opacity-40 text-amber-500" />
                      <p className="font-bold text-sm">No Drivers Registered</p>
                      <p className="text-xs">Your compliance roster is empty. Register your commercial operators to begin dispatching.</p>
                      <button
                        onClick={onOpenAddDriverModal}
                        className="mt-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-black inline-flex items-center gap-1.5 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Register First Driver</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((d) => {
                  const comp = getComplianceStatus(d);
                const isSuspended = d.status === 'Suspended';

                return (
                  <tr
                    key={d.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3.5 pl-4">
                      <div className="font-bold text-sm">{d.name}</div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span>{d.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <div className="font-mono font-bold">{d.licenseNumber}</div>
                      <div className="text-[10px] text-neutral-400">{d.licenseCategory}</div>
                    </td>
                    <td className="py-3.5 font-mono">{d.licenseExpiryDate}</td>
                    <td className="py-3.5">{getComplianceBadge(comp)}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1 font-bold">
                        <Award
                          className={`w-3.5 h-3.5 ${
                            d.safetyScore >= 90
                              ? 'text-emerald-400'
                              : d.safetyScore >= 75
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        />
                        <span>{d.safetyScore} / 100</span>
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {d.totalTripsCompleted} trips logged
                      </div>
                    </td>
                    <td className="py-3.5">{getStatusBadge(d.status)}</td>
                    <td className="py-3.5 text-right pr-4">
                      <div className="flex items-center justify-end gap-2">
                        {comp === 'Expiring Soon' && (
                          <button
                            onClick={() => sendLicenseReminderEmail(d.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                          >
                            Send Notice
                          </button>
                        )}
                        <button
                          onClick={() => toggleDriverSuspension(d.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            isSuspended
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {isSuspended ? 'Reinstate Driver' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
