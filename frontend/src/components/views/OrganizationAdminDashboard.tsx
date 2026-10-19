import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { INDIAN_LICENSE_CATEGORIES, OrganizationUser, UserRole } from '../../types';

type AssignableRole = Exclude<UserRole, 'organization_admin'>;

const roleLabels: Record<AssignableRole, string> = {
  fleet_manager: 'Fleet Manager',
  driver: 'Driver',
  safety_officer: 'Safety Officer',
  financial_analyst: 'Financial Analyst',
};

export const OrganizationAdminDashboard: React.FC = () => {
  const { currentUser } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [role, setRole] = useState<AssignableRole>('fleet_manager');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseCategory, setLicenseCategory] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      setUsers(await api.organizationUsers.getAll());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load organization accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.organizationUsers.create({
        fullName,
        email,
        password,
        role,
        ...(role === 'driver'
          ? { contactNumber, licenseNumber, licenseCategory, licenseExpiryDate }
          : {}),
      });
      setFullName('');
      setEmail('');
      setPassword('');
      setContactNumber('');
      setLicenseNumber('');
      setLicenseCategory('');
      setLicenseExpiryDate('');
      await loadUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
    isDark
      ? 'border-[#303746] bg-[#191d26] text-neutral-100'
      : 'border-[#ded7ca] bg-white text-neutral-900'
  }`;
  const cardClass = `rounded-2xl border p-5 ${
    isDark ? 'border-[#252b36] bg-[#14171e]' : 'border-[#e5dfd2] bg-white'
  }`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <div className="mb-1 text-xs font-mono text-neutral-400">ORGANIZATION / ACCESS</div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Organization Admin</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Create and manage sign-in accounts for {currentUser?.tenantId ?? 'your organization'}.
          New users are assigned to this organization; driver accounts also receive a linked driver profile.
        </p>
      </header>

      {error && (
        <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${
          isDark
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {error}
        </div>
      )}

      <section className={cardClass}>
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <UserPlus className="h-4 w-4" />
          Create organization account
        </h2>
        <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold">
            Full name
            <input className={fieldClass} required maxLength={100} value={fullName} onChange={(event) => { setError(null); setFullName(event.target.value); }} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Email
            <input className={fieldClass} type="email" required maxLength={256} value={email} onChange={(event) => { setError(null); setEmail(event.target.value); }} />
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Initial password
            <div className="relative">
              <input className={`${fieldClass} pr-10`} type={showPassword ? 'text' : 'password'} required minLength={10} autoComplete="new-password" value={password} onChange={(event) => { setError(null); setPassword(event.target.value); }} />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className="block font-normal text-neutral-500">At least 10 characters, uppercase, lowercase, number, and symbol.</span>
          </label>
          <label className="space-y-1 text-xs font-semibold">
            Role
            <select className={fieldClass} value={role} onChange={(event) => { setError(null); setRole(event.target.value as AssignableRole); }}>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          {role === 'driver' && (
            <>
              <label className="space-y-1 text-xs font-semibold">
                Contact number
                <input className={fieldClass} required maxLength={32} value={contactNumber} onChange={(event) => { setError(null); setContactNumber(event.target.value); }} />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                License number
                <input className={fieldClass} required maxLength={64} value={licenseNumber} onChange={(event) => { setError(null); setLicenseNumber(event.target.value.toUpperCase()); }} />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                License category
                <select className={fieldClass} required value={licenseCategory} onChange={(event) => { setError(null); setLicenseCategory(event.target.value); }}>
                  <option value="">Select licence category</option>
                  {INDIAN_LICENSE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold">
                License expiry
                <input className={fieldClass} type="date" required value={licenseExpiryDate} onChange={(event) => { setError(null); setLicenseExpiryDate(event.target.value); }} />
              </label>
            </>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                isDark
                  ? 'bg-[#ccff00] text-black hover:bg-[#b8e600]'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        </form>
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Organization accounts</h2>
          <button type="button" onClick={() => void loadUsers()} className="text-xs font-semibold text-amber-500 hover:underline">
            Refresh
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading accounts…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-neutral-500">No accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs uppercase text-neutral-500">
                <tr>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Driver profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-500/15">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3 font-semibold">{user.fullName}</td>
                    <td className="py-3">{user.email}</td>
                    <td className="py-3">{roleLabels[user.role as AssignableRole] ?? 'Organization Admin'}</td>
                    <td className="py-3">{user.driverId ? 'Linked' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
