import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Truck,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Building2,
  Route,
  BarChart,
  Sun,
  Moon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { UserRole } from '../../types';

export const LoginView: React.FC = () => {
  const { login, setActiveView, setUserRole } = useApp();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('alex.morgan@transitops.com');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>('fleet_manager');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, selectedRole);
  };

  const handleQuickLogin = (role: UserRole, demoEmail: string) => {
    setSelectedRole(role);
    setEmail(demoEmail);
    login(demoEmail, role);
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-8 transition-colors ${
        isDark ? 'bg-[#0c0e12] text-neutral-100' : 'bg-[#faf8f4] text-neutral-900'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
        <button
          onClick={() => setActiveView('hero')}
          className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isDark ? 'bg-[#ccff00]' : 'bg-[#d97706]'
            }`}
          />
          <span>TRANSITOPS</span>
        </button>

        <button
          onClick={toggleTheme}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            isDark
              ? 'bg-[#151921] border-[#252b36] text-neutral-300'
              : 'bg-white border-[#ded7ca] text-neutral-700'
          }`}
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-[#ccff00]" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-[#d97706]" />
              <span>Dark</span>
            </>
          )}
        </button>
      </div>

      {/* Main Login Split (as depicted in Login.svg) */}
      <div className="max-w-5xl mx-auto w-full my-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Side: Brand presentation */}
        <div className="lg:col-span-6 space-y-6">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center border ${
              isDark
                ? 'border-[#ccff00]/40 text-[#ccff00] bg-[#141822]'
                : 'border-[#d97706]/40 text-[#d97706] bg-amber-50'
            }`}
          >
            <Truck className="w-11 h-11 stroke-[1.8]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Fleet operations, off the spreadsheet.
          </h1>

          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md leading-relaxed">
            Vehicles, drivers, trips, maintenance, and cost — one dashboard per role, every rule enforced automatically.
          </p>

          {/* Status Indicators */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Available
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              On Trip
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              In Shop
            </span>
          </div>
        </div>

        {/* Right Side: Sign-in Box */}
        <div className="lg:col-span-6">
          <div
            className={`p-8 rounded-2xl border shadow-2xl relative ${
              isDark
                ? 'bg-[#14171e] border-[#252b36] text-neutral-100'
                : 'bg-white border-[#ded7ca] text-neutral-900 shadow-xl'
            }`}
          >
            <h2 className="text-xl font-bold mb-1">Sign in</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
              Log in with the account your fleet manager set up for you.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Select Workspace Role
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border bg-neutral-500/5">
                  {[
                    { role: 'fleet_manager' as UserRole, label: 'Fleet Manager', email: 'alex.morgan@transitops.com' },
                    { role: 'driver' as UserRole, label: 'Driver / Dispatch', email: 'sarah.chen@transitops.com' },
                    { role: 'safety_officer' as UserRole, label: 'Safety Officer', email: 'marcus.vance@transitops.com' },
                    { role: 'financial_analyst' as UserRole, label: 'Financial Analyst', email: 'priya.sharma@transitops.com' },
                  ].map((item) => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => {
                        setSelectedRole(item.role);
                        setEmail(item.email);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-left text-[11px] font-bold transition-all ${
                        selectedRole === item.role
                          ? isDark
                            ? 'bg-[#ccff00] text-black shadow-sm'
                            : 'bg-[#d97706] text-white shadow-sm'
                          : isDark
                          ? 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                      isDark
                        ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-100'
                        : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none ${
                      isDark
                        ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00] text-neutral-100'
                        : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706] text-neutral-900'
                    }`}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-2 ${
                  isDark
                    ? 'bg-[#ccff00] text-black hover:bg-[#b8e600]'
                    : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                }`}
              >
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </form>

            {/* Quick-Demo Role Switcher buttons */}
            <div className="mt-6 pt-5 border-t border-inherit">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2 text-center">
                One-Click Quick Login by Role
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  onClick={() => handleQuickLogin('fleet_manager', 'alex.morgan@transitops.com')}
                  className={`p-2 rounded-lg border text-left transition-colors font-medium ${
                    isDark
                      ? 'bg-[#191d26] border-[#28303f] hover:border-[#ccff00]'
                      : 'bg-neutral-50 border-[#ded7ca] hover:border-amber-400'
                  }`}
                >
                  <div className="font-bold">Fleet Manager</div>
                  <div className="text-[10px] text-neutral-400">Control Tower</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('driver', 'sarah.chen@transitops.com')}
                  className={`p-2 rounded-lg border text-left transition-colors font-medium ${
                    isDark
                      ? 'bg-[#191d26] border-[#28303f] hover:border-emerald-400'
                      : 'bg-neutral-50 border-[#ded7ca] hover:border-emerald-400'
                  }`}
                >
                  <div className="font-bold">Driver / Dispatch</div>
                  <div className="text-[10px] text-neutral-400">Active Delivery</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('safety_officer', 'marcus.vance@transitops.com')}
                  className={`p-2 rounded-lg border text-left transition-colors font-medium ${
                    isDark
                      ? 'bg-[#191d26] border-[#28303f] hover:border-purple-400'
                      : 'bg-neutral-50 border-[#ded7ca] hover:border-purple-400'
                  }`}
                >
                  <div className="font-bold">Safety Officer</div>
                  <div className="text-[10px] text-neutral-400">Compliance Watch</div>
                </button>
                <button
                  onClick={() => handleQuickLogin('financial_analyst', 'priya.sharma@transitops.com')}
                  className={`p-2 rounded-lg border text-left transition-colors font-medium ${
                    isDark
                      ? 'bg-[#191d26] border-[#28303f] hover:border-amber-400'
                      : 'bg-neutral-50 border-[#ded7ca] hover:border-amber-400'
                  }`}
                >
                  <div className="font-bold">Financial Analyst</div>
                  <div className="text-[10px] text-neutral-400">Cost Console</div>
                </button>
              </div>
            </div>

            <div className="mt-4 text-center">
              <span className="text-xs text-neutral-500">Need a new workspace? </span>
              <button
                onClick={() => setActiveView('register')}
                className={`text-xs font-bold hover:underline ${
                  isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
                }`}
              >
                Register Here
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto w-full text-center text-xs text-neutral-400 py-4">
        © TransitOps. Smart Transport Operations Platform.
      </div>
    </div>
  );
};

export const RegisterView: React.FC = () => {
  const { register, setActiveView } = useApp();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [role, setRole] = useState<UserRole>('fleet_manager');
  const [fullName, setFullName] = useState('Alex Morgan');
  const [email, setEmail] = useState('alex@transitops.com');
  const [password, setPassword] = useState('••••••••');
  const [confirmPassword, setConfirmPassword] = useState('••••••••');

  const roleSpecs: Record<
    UserRole,
    {
      title: string;
      badge: string;
      desc: string;
      permissions: string[];
    }
  > = {
    fleet_manager: {
      title: 'Fleet Manager',
      badge: 'Control tower',
      desc: 'Oversees fleet assets, maintenance, vehicle lifecycle, and operational efficiency.',
      permissions: [
        'Manage vehicles and drivers',
        'Oversee every trip',
        'Close maintenance work',
        'Review fleet-wide reports',
      ],
    },
    driver: {
      title: 'Driver',
      badge: 'Dispatch desk',
      desc: 'Plan routes, dispatch eligible resources, and close active deliveries with accurate trip data.',
      permissions: [
        'Create and dispatch trips',
        'Use available resources only',
        'Complete deliveries',
        'Track active assignments',
      ],
    },
    safety_officer: {
      title: 'Safety Officer',
      badge: 'Compliance watch',
      desc: 'Protect dispatch operations through license checks, suspensions, and safety monitoring.',
      permissions: [
        'Monitor license expiry',
        'Suspend or reinstate drivers',
        'Monitor safety scores',
        'Block ineligible dispatch',
      ],
    },
    financial_analyst: {
      title: 'Financial Analyst',
      badge: 'Cost console',
      desc: 'Understand fuel, maintenance, operating expenses, and efficiency across the fleet.',
      permissions: [
        'Log fuel and expenses',
        'Compare vehicle cost',
        'Measure fuel efficiency',
        'Export reporting data',
      ],
    },
  };

  const currentSpec = roleSpecs[role];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register(fullName, email, role);
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-8 transition-colors ${
        isDark ? 'bg-[#0c0e12] text-neutral-100' : 'bg-[#faf8f4] text-neutral-900'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
        <button
          onClick={() => setActiveView('hero')}
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          ← Back to home
        </button>

        <div className="flex items-center gap-4">
          <div className="text-xs">
            <span className="text-neutral-500">Already registered? </span>
            <button
              onClick={() => setActiveView('login')}
              className={`font-bold hover:underline ${
                isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
              }`}
            >
              Sign in
            </button>
          </div>

          <button
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              isDark
                ? 'bg-[#151921] border-[#252b36] text-neutral-300'
                : 'bg-white border-[#ded7ca] text-neutral-700'
            }`}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#ccff00]" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#d97706]" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto w-full my-auto py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Step 1: Select Your Context (as in Register SVGs) */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Step 1 · Select Your Context
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Create the right workspace.
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Your role controls the dashboard, permitted actions, and operational data you can access.
              </p>
            </div>

            {/* Role Radio Cards */}
            <div className="space-y-2 pt-2">
              {(Object.keys(roleSpecs) as UserRole[]).map((r) => {
                const spec = roleSpecs[r];
                const isSelected = role === r;

                return (
                  <div
                    key={r}
                    onClick={() => setRole(r)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? isDark
                          ? 'bg-[#161b24] border-[#ccff00] text-neutral-100 shadow-[0_0_15px_rgba(204,255,0,0.1)]'
                          : 'bg-amber-50/70 border-amber-400 text-neutral-900 shadow-xs'
                        : isDark
                        ? 'bg-[#13161d] border-[#222733] text-neutral-400 hover:border-neutral-600'
                        : 'bg-white border-[#ded7ca] text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{spec.title}</div>
                      <div className="text-[10px] text-neutral-500">{spec.badge}</div>
                    </div>
                    {isSelected ? (
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-[#ccff00] text-black' : 'bg-amber-500 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-neutral-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Account Details & Permissions Card */}
          <div className="lg:col-span-7 space-y-4">
            {/* Dynamic Role Detail Box (As shown in SVG designs!) */}
            <div
              className={`p-5 rounded-2xl border ${
                isDark
                  ? 'bg-[#181d27] border-[#273040] text-neutral-100'
                  : 'bg-amber-50 border-amber-200 text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  REGISTERING AS
                </span>
                <span className="font-extrabold text-xs">{currentSpec.title}</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-300 mb-3 leading-relaxed">
                {currentSpec.desc}
              </p>

              {/* Permission Pills */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {currentSpec.permissions.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isDark ? 'text-[#ccff00]' : 'text-amber-600'
                      }`}
                    />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Registration Form */}
            <div
              className={`p-6 sm:p-7 rounded-2xl border shadow-xl ${
                isDark
                  ? 'bg-[#14171e] border-[#252b36] text-neutral-100'
                  : 'bg-white border-[#ded7ca] text-neutral-900 shadow-md'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Step 2 · Account Details
              </span>
              <h2 className="text-lg font-bold mb-1">Tell us who you are.</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
                All fields are required. Your email becomes your sign-in ID.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                        isDark
                          ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                          : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none font-medium ${
                        isDark
                          ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                          : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark
                          ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                          : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                        isDark
                          ? 'bg-[#191d26] border-[#272e3d] focus:border-[#ccff00]'
                          : 'bg-neutral-50 border-[#ded7ca] focus:border-[#d97706]'
                      }`}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-neutral-500 pt-1">
                  🔒 Your password is securely hashed. Role permissions are enforced by the server on every protected action.
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-2 ${
                    isDark
                      ? 'bg-[#ccff00] text-black hover:bg-[#b8e600]'
                      : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                  }`}
                >
                  <span>Create {currentSpec.title} account</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full text-center text-xs text-neutral-400 py-4">
        © TransitOps. All systems operational.
      </div>
    </div>
  );
};
