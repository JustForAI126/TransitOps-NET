import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Download,
  Mail,
  UserCheck,
  UserX,
  Award,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Driver } from '../../types';
import { api, SafetyScoreBreakdown } from '../../services/api';

export const SafetyOfficerDashboard: React.FC = () => {
  const {
    drivers,
    maintenanceRecords,
    toggleDriverSuspension,
    sendLicenseReminderEmail,
    recordDriverIncident,
    exportToCSV,
  } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [complianceFilter, setComplianceFilter] = useState<'all' | 'expired' | 'expiring' | 'suspended' | 'compliant'>('all');
  const [driverSearch, setDriverSearch] = useState('');
  const [scoreBreakdown, setScoreBreakdown] = useState<{ driverId: string; data: SafetyScoreBreakdown | null; error?: string } | null>(null);

  const toggleScoreBreakdown = async (driverId: string) => {
    if (scoreBreakdown?.driverId === driverId) {
      setScoreBreakdown(null);
      return;
    }
    setScoreBreakdown({ driverId, data: null });
    try {
      const data = await api.drivers.safetyScore(driverId);
      setScoreBreakdown((current) => (current?.driverId === driverId ? { driverId, data } : current));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Could not load the score breakdown.';
      setScoreBreakdown((current) => (current?.driverId === driverId ? { driverId, data: null, error } : current));
    }
  };

  const confirmIncident = async (driver: Driver) => {
    if (!window.confirm(`Record a safety incident for ${driver.name}? This lowers their safety score.`)) return;
    await recordDriverIncident(driver.id);
    if (scoreBreakdown?.driverId === driver.id) {
      setScoreBreakdown(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // Driver license calculations
  const expiredDrivers = drivers.filter((d) => d.licenseExpiryDate < today);
  const expiringDrivers = drivers.filter((d) => {
    const diffDays = Math.ceil(
      (new Date(d.licenseExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24)
    );
    return diffDays > 0 && diffDays <= 30;
  });
  const suspendedDrivers = drivers.filter((d) => d.status === 'Suspended');
  const compliantDrivers = drivers.filter(
    (d) => d.licenseExpiryDate >= today && d.status !== 'Suspended'
  );
  const inShopVehicles = maintenanceRecords.filter((m) => m.status === 'Active');

  const averageSafetyScore = drivers.length > 0
    ? Math.round(drivers.reduce((acc, d) => acc + (d.safetyScore || 90), 0) / drivers.length)
    : 95;

  const filteredDrivers = drivers.filter((d) => {
    const isExpired = d.licenseExpiryDate < today;
    const diffDays = Math.ceil(
      (new Date(d.licenseExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24)
    );
    const isExpiring = diffDays > 0 && diffDays <= 30;
    const isSuspended = d.status === 'Suspended';
    const isCompliant = !isExpired && !isSuspended;

    if (complianceFilter === 'expired' && !isExpired) return false;
    if (complianceFilter === 'expiring' && !isExpiring) return false;
    if (complianceFilter === 'suspended' && !isSuspended) return false;
    if (complianceFilter === 'compliant' && !isCompliant) return false;

    if (driverSearch) {
      const q = driverSearch.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.licenseNumber.toLowerCase().includes(q) ||
        d.licenseCategory.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportSafetyReport = () => {
    const report = drivers.map((d) => ({
      DriverName: d.name,
      LicenseNumber: d.licenseNumber,
      Category: d.licenseCategory,
      ExpiryDate: d.licenseExpiryDate,
      Status: d.status,
      SafetyScore: d.safetyScore,
      Incidents: d.incidentHistoryCount,
      IsExpired: d.licenseExpiryDate < today ? 'YES' : 'NO',
    }));
    exportToCSV('transitops-safety-compliance-audit', report);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
            <span>TRANSITOPS</span>
            <span>/</span>
            <span className="font-semibold text-purple-400">
              SAFETY &amp; COMPLIANCE AUDIT
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Driver Compliance &amp; Safety Desk
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportSafetyReport}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              isDark
                ? 'bg-[#151921] border-[#262d3a] hover:bg-[#1d232f] text-neutral-300'
                : 'bg-white border-[#ded7ca] hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Safety Audit</span>
          </button>
        </div>
      </div>

      {/* Tailored Safety KPIs Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Expired Licenses</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black font-mono text-red-400">{expiredDrivers.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Grounding violation</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Expiring &lt;30 Days</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{expiringDrivers.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Immediate renewal due</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Suspended Drivers</span>
            <UserX className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black font-mono text-orange-400">{suspendedDrivers.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Under safety hold</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Compliant Drivers</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">{compliantDrivers.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Clear for dispatch</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Inspection Holds</span>
            <Wrench className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono">{inShopVehicles.length}</div>
          <div className="text-[11px] text-neutral-500 mt-1">In-shop service lock</div>
        </div>

        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Safety Score</span>
            <Award className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-400">{averageSafetyScore}/100</div>
          <div className="text-[11px] text-neutral-500 mt-1">Fleet safety index</div>
        </div>
      </div>

      {/* Safety Alert Matrix & Inspection Holds */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Critical Compliance Directives */}
        <div
          className={`lg:col-span-7 p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-base">Active Safety Interventions</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-bold">
                {expiredDrivers.length + expiringDrivers.length} Driver Actions Required
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Autonomous safety compliance triggers. Operators must review or suspend drivers with invalid credentials.
            </p>

            <div className="space-y-3">
              {expiredDrivers.length === 0 && expiringDrivers.length === 0 ? (
                <div
                  className={`p-6 rounded-xl border text-center text-xs ${
                    isDark ? 'bg-[#161a22] border-[#232938] text-neutral-400' : 'bg-neutral-50 border-[#ded7ca] text-neutral-600'
                  }`}
                >
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-emerald-400 text-sm">100% Commercial Licensing Compliance</p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    No commercial drivers currently possess expired licenses or immediate renewal triggers.
                  </p>
                </div>
              ) : (
                <>
                  {expiredDrivers.map((d) => (
                    <div
                      key={d.id}
                      className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDark ? 'bg-[#1f1517] border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <span className="text-red-400">{d.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                            EXPIRED ({d.licenseExpiryDate})
                          </span>
                        </div>
                        <div className="text-[11px] opacity-80">
                          License: <span className="font-mono">{d.licenseNumber}</span> ({d.licenseCategory}) · Auto-grounded from dispatches.
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => sendLicenseReminderEmail(d.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                            isDark
                              ? 'bg-[#29181b] border-red-500/40 text-red-300 hover:bg-red-950/40'
                              : 'bg-white border-red-300 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          <Mail className="w-3 h-3" />
                          <span>Send Notice</span>
                        </button>
                        <button
                          onClick={() => toggleDriverSuspension(d.id)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
                        >
                          {d.status === 'Suspended' ? 'Reinstate' : 'Formal Suspend'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {expiringDrivers.map((d) => (
                    <div
                      key={d.id}
                      className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDark ? 'bg-[#1c1a16] border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <span className="text-amber-400">{d.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            EXPIRING SOON ({d.licenseExpiryDate})
                          </span>
                        </div>
                        <div className="text-[11px] opacity-80">
                          License: <span className="font-mono">{d.licenseNumber}</span> · Commercial renewal pending.
                        </div>
                      </div>
                      <button
                        onClick={() => sendLicenseReminderEmail(d.id)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors self-end sm:self-center flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Send Reminder</span>
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Vehicle Inspection Holds */}
        <div
          className={`lg:col-span-5 p-5 sm:p-6 rounded-2xl border flex flex-col justify-between space-y-4 ${
            isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base">Active Maintenance Safety Locks</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 font-bold">
                {inShopVehicles.length} Vehicles
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Vehicles grounded under maintenance safety protocols. Excluded from dispatches.
            </p>

            <div className="space-y-3">
              {inShopVehicles.length === 0 ? (
                <div
                  className={`p-4 rounded-xl border text-center text-xs ${
                    isDark ? 'bg-[#161a22] border-[#232938] text-neutral-400' : 'bg-neutral-50 border-[#ded7ca] text-neutral-600'
                  }`}
                >
                  <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  <p className="font-bold">All Vehicles Road-Ready</p>
                  <p className="text-[11px] text-neutral-400">No active maintenance work orders grounding vehicles.</p>
                </div>
              ) : (
                inShopVehicles.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border text-xs ${
                      isDark ? 'bg-[#181c25] border-[#28303f] text-neutral-300' : 'bg-neutral-50 border-[#ded7ca] text-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-red-400 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{m.vehicleName} ({m.vehicleRegNumber})</span>
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">Active WO</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {m.serviceType}: {m.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl text-[11px] leading-relaxed border ${
              isDark ? 'bg-[#161a22] border-[#222733] text-neutral-400' : 'bg-neutral-100 border-[#ded7ca] text-neutral-600'
            }`}
          >
            <strong>Safety Mandate:</strong> Only eligible drivers with active commercial certifications and vehicles clear of maintenance work orders may be assigned to dispatches.
          </div>
        </div>
      </div>

      {/* Driver Compliance Desk (Interactive Matrix) */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border ${
          isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-inherit">
          <div>
            <h3 className="font-bold text-base">Commercial Driver Compliance Matrix</h3>
            <p className="text-xs text-neutral-400">
              Complete oversight of licensing records, safety score indices, and operational privilege statuses
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl border bg-inherit text-xs">
              <button
                onClick={() => setComplianceFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  complianceFilter === 'all'
                    ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-900'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All ({drivers.length})
              </button>
              <button
                onClick={() => setComplianceFilter('expired')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  complianceFilter === 'expired'
                    ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-900'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Expired ({expiredDrivers.length})
              </button>
              <button
                onClick={() => setComplianceFilter('expiring')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  complianceFilter === 'expiring'
                    ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-900'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Expiring &lt;30d ({expiringDrivers.length})
              </button>
              <button
                onClick={() => setComplianceFilter('suspended')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  complianceFilter === 'suspended'
                    ? isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-900'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Suspended ({suspendedDrivers.length})
              </button>
              <button
                onClick={() => setComplianceFilter('compliant')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  complianceFilter === 'compliant'
                    ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-900'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Compliant ({compliantDrivers.length})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search driver or license..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border outline-none ${
                  isDark
                    ? 'bg-[#181d27] border-[#272e3d] text-neutral-200 focus:border-purple-400'
                    : 'bg-neutral-50 border-[#ded7ca] text-neutral-800 focus:border-purple-600'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-inherit text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <th className="pb-3 pl-2">Driver</th>
                <th className="pb-3">License Number</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">License Expiry</th>
                <th className="pb-3">Safety Score</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Privileged Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inherit font-medium">
              {filteredDrivers.map((d) => {
                const isExpired = d.licenseExpiryDate < today;
                const diffDays = Math.ceil(
                  (new Date(d.licenseExpiryDate).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24)
                );
                const isExpiring = diffDays > 0 && diffDays <= 30;
                const isSuspended = d.status === 'Suspended';

                return (
                  <React.Fragment key={d.id}>
                  <tr
                    className={`transition-colors ${
                      isDark ? 'hover:bg-[#181d27]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="py-3 pl-2">
                      <div className="font-bold flex items-center gap-2">
                        <span>{d.name}</span>
                        {d.incidentHistoryCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[10px]">
                            {d.incidentHistoryCount} Incidents
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400">{d.email}</div>
                    </td>
                    <td className="py-3 font-mono font-bold">{d.licenseNumber}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] border font-mono bg-neutral-500/10">
                        {d.licenseCategory}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono">{d.licenseExpiryDate}</span>
                        {isExpired && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">
                            EXPIRED
                          </span>
                        )}
                        {isExpiring && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                            {diffDays}d left
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => toggleScoreBreakdown(d.id)}
                        title="Show how this score is calculated"
                        aria-expanded={scoreBreakdown?.driverId === d.id}
                        className="flex items-center gap-1.5 underline decoration-dotted underline-offset-2"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            d.safetyScore >= 90
                              ? 'bg-emerald-500'
                              : d.safetyScore >= 75
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        />
                        <span className="font-mono font-bold">{d.safetyScore}/100</span>
                      </button>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isSuspended
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : isExpired
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSuspended
                              ? 'bg-red-500'
                              : isExpired
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span>{d.status}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => confirmIncident(d)}
                          title="Record Safety Incident"
                          aria-label={`Record safety incident for ${d.name}`}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isDark
                              ? 'bg-[#181d27] border-[#272e3d] hover:text-red-400 text-neutral-400'
                              : 'bg-white border-[#ded7ca] hover:text-red-600 text-neutral-600'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => sendLicenseReminderEmail(d.id)}
                          title="Send License Notice"
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isDark
                              ? 'bg-[#181d27] border-[#272e3d] hover:text-amber-400 text-neutral-400'
                              : 'bg-white border-[#ded7ca] hover:text-amber-600 text-neutral-600'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleDriverSuspension(d.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                            isSuspended
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30'
                          }`}
                        >
                          {isSuspended ? (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>Reinstate</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" />
                              <span>Suspend</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {scoreBreakdown?.driverId === d.id && (
                    <tr>
                      <td colSpan={7} className="pb-3 pl-2 pr-2">
                        <div className={`rounded-xl border p-3 text-[11px] ${isDark ? 'bg-[#181d27] border-[#272e3d]' : 'bg-neutral-50 border-[#ded7ca]'}`}>
                          {scoreBreakdown.error ? (
                            <span className="text-red-400">{scoreBreakdown.error}</span>
                          ) : !scoreBreakdown.data ? (
                            <span className="text-neutral-400">Loading score breakdown…</span>
                          ) : (
                            <>
                              <div className="font-bold mb-1.5">
                                {scoreBreakdown.data.score}/100 · {scoreBreakdown.data.band}
                                <span className="font-normal text-neutral-400"> — starts at 100</span>
                              </div>
                              <ul className="space-y-1">
                                {scoreBreakdown.data.factors.map((f) => (
                                  <li key={f.factor} className="flex gap-2">
                                    <span className={`w-10 text-right font-mono font-bold ${f.points < 0 ? 'text-red-400' : f.points > 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                                      {f.points > 0 ? `+${f.points}` : f.points}
                                    </span>
                                    <span className="font-semibold w-28 shrink-0">{f.factor}</span>
                                    <span className="text-neutral-400">{f.detail}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
