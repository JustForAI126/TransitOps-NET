import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { INDIAN_LICENSE_CATEGORIES, OrganizationUser, UserRole } from '../../types';
import { licenceExpiryError, LICENCE_HINT, normalizeLicence } from '../../utils/indianFormats';

/** Normalized licence number, or an error message for the form. */
const checkDriverLicence = (licenseNumber: string, licenseExpiryDate: string): { licence: string; error: string | null } => {
  const licence = normalizeLicence(licenseNumber);
  if (!licence.ok) return { licence: '', error: licence.error };
  return { licence: licence.value, error: licenceExpiryError(licence.value, licenseExpiryDate) };
};

type AssignableRole = Exclude<UserRole, 'organization_admin'>;
type EditUserDraft = {
  id: string;
  fullName: string;
  email: string;
  role: AssignableRole;
  contactNumber: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiryDate: string;
};

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
  const [editDraft, setEditDraft] = useState<EditUserDraft | null>(null);

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
    const driverCheck = role === 'driver' ? checkDriverLicence(licenseNumber, licenseExpiryDate) : null;
    if (driverCheck?.error) {
      setError(driverCheck.error);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.organizationUsers.create({
        fullName,
        email,
        password,
        role,
        ...(driverCheck
          ? { contactNumber, licenseNumber: driverCheck.licence, licenseCategory, licenseExpiryDate }
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

  const editUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editDraft) return;
    const driverCheck = editDraft.role === 'driver'
      ? checkDriverLicence(editDraft.licenseNumber, editDraft.licenseExpiryDate)
      : null;
    if (driverCheck?.error) {
      setError(driverCheck.error);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.organizationUsers.update(editDraft.id, {
        fullName: editDraft.fullName,
        email: editDraft.email,
        role: editDraft.role,
        ...(driverCheck
          ? {
              contactNumber: editDraft.contactNumber,
              licenseNumber: driverCheck.licence,
              licenseCategory: editDraft.licenseCategory,
              licenseExpiryDate: editDraft.licenseExpiryDate,
            }
          : {}),
      });
      setEditDraft(null);
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteUser = async (user: OrganizationUser) => {
    if (user.role === 'organization_admin') return;
    const confirmed = window.confirm(
      `Delete the account for ${user.fullName} (${user.email})? This prevents sign-in. Any linked driver profile and its trip history will be retained.`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.organizationUsers.delete(user.id);
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (user: OrganizationUser) => {
    if (user.role === 'organization_admin') return;
    setEditDraft({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      contactNumber: user.contactNumber ?? '',
      licenseNumber: user.licenseNumber ?? '',
      licenseCategory: user.licenseCategory ?? '',
      licenseExpiryDate: user.licenseExpiryDate ?? '',
    });
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
                <input className={fieldClass} required maxLength={20} placeholder="MH14 20180045921" title={LICENCE_HINT} value={licenseNumber} onChange={(event) => { setError(null); setLicenseNumber(event.target.value.toUpperCase()); }} />
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
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-500/15">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3 font-semibold">{user.fullName}</td>
                    <td className="py-3">{user.email}</td>
                    <td className="py-3">{user.role === 'organization_admin' ? 'Organization Admin' : roleLabels[user.role]}</td>
                    <td className="py-3">{user.driverId ? 'Linked' : '—'}</td>
                    <td className="py-3">
                      {user.role === 'organization_admin' ? (
                        <span className="block text-right text-xs text-neutral-500">Protected</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            aria-label={`Edit ${user.fullName}`}
                            onClick={() => startEditing(user)}
                            className="rounded-lg border border-inherit p-2 text-neutral-500 transition-colors hover:text-amber-500 disabled:opacity-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            aria-label={`Delete ${user.fullName}`}
                            onClick={() => void deleteUser(user)}
                            className="rounded-lg border border-inherit p-2 text-neutral-500 transition-colors hover:text-red-500 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-organization-user-title"
            className={`my-auto w-full max-w-2xl rounded-2xl border p-5 shadow-2xl sm:p-6 ${
              isDark ? 'border-[#303746] bg-[#14171e] text-neutral-100' : 'border-[#e5dfd2] bg-white text-neutral-900'
            }`}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-organization-user-title" className="text-lg font-bold">Edit organization account</h2>
                <p className="mt-1 text-sm text-neutral-500">Changes to account details or role will require the user to sign in again.</p>
              </div>
              <button
                type="button"
                aria-label="Close edit dialog"
                onClick={() => setEditDraft(null)}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-500/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={editUser} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold">
                Full name
                <input
                  className={fieldClass}
                  required
                  maxLength={100}
                  value={editDraft.fullName}
                  onChange={event => setEditDraft({ ...editDraft, fullName: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Email
                <input
                  className={fieldClass}
                  type="email"
                  required
                  maxLength={256}
                  value={editDraft.email}
                  onChange={event => setEditDraft({ ...editDraft, email: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-semibold">
                Role
                <select
                  className={fieldClass}
                  value={editDraft.role}
                  onChange={event => setEditDraft({ ...editDraft, role: event.target.value as AssignableRole })}
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {editDraft.role === 'driver' && (
                <>
                  <label className="space-y-1 text-xs font-semibold">
                    Contact number
                    <input
                      className={fieldClass}
                      required
                      maxLength={32}
                      value={editDraft.contactNumber}
                      onChange={event => setEditDraft({ ...editDraft, contactNumber: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    License number
                    <input
                      className={fieldClass}
                      required
                      maxLength={20}
                      placeholder="MH14 20180045921"
                      title={LICENCE_HINT}
                      value={editDraft.licenseNumber}
                      onChange={event => setEditDraft({ ...editDraft, licenseNumber: event.target.value.toUpperCase() })}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    License category
                    <select
                      className={fieldClass}
                      required
                      value={editDraft.licenseCategory}
                      onChange={event => setEditDraft({ ...editDraft, licenseCategory: event.target.value })}
                    >
                      <option value="">Select licence category</option>
                      {INDIAN_LICENSE_CATEGORIES.map(category => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    License expiry
                    <input
                      className={fieldClass}
                      type="date"
                      required
                      value={editDraft.licenseExpiryDate}
                      onChange={event => setEditDraft({ ...editDraft, licenseExpiryDate: event.target.value })}
                    />
                  </label>
                </>
              )}

              <div className="flex justify-end gap-3 sm:col-span-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditDraft(null)}
                  className="rounded-lg border border-inherit px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${
                    isDark ? 'bg-[#ccff00] text-black hover:bg-[#b8e600]' : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
