import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Truck,
  ShieldCheck,
  Zap,
  TrendingUp,
  ArrowRight,
  Route,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Cpu,
  BarChart,
  UserCheck,
  CreditCard,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { api, SubscriptionPlan } from '../../services/api';
import { UserRole } from '../../types';

export const HeroView: React.FC = () => {
  const { setActiveView, currentUser } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.onboarding.getPlans()
      .then(result => {
        if (active) setPlans(result);
      })
      .catch((requestError: unknown) => {
        if (active) setPlansError(requestError instanceof Error ? requestError.message : 'Subscription plans could not be loaded.');
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });
    return () => { active = false; };
  }, []);

  const headlineContainer: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.04,
      },
    },
  };

  const wordAnimation: any = {
    hidden: {
      opacity: 0,
      y: 24,
      filter: 'blur(4px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.45,
        ease: 'easeOut',
      },
    },
  };

  const headlineWords = [
    { text: 'Fleet', isAccent: false },
    { text: 'operations,', isAccent: false },
    { text: 'off', isAccent: true },
    { text: 'the', isAccent: true },
    { text: 'spreadsheet.', isAccent: true },
  ];

  const handleRoleSelect = (_role: UserRole) => setActiveView('login');
  const selectPlan = (planId: string) => {
    if (currentUser) {
      setActiveView('dashboard');
      return;
    }
    setActiveView('purchase');
    window.history.replaceState(window.history.state, '', `/purchase?plan=${encodeURIComponent(planId)}`);
  };
  const formatPlanPrice = (plan: SubscriptionPlan) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.amountPaise / 100);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-inherit">
        {/* Subtle background glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 pointer-events-none opacity-25 blur-3xl -z-10">
          <div
            className={`w-full h-full rounded-full ${
              isDark ? 'bg-[#ccff00]/30' : 'bg-[#f59e0b]/30'
            }`}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6">
              {/* Pill badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5 }}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
                  isDark
                    ? 'bg-[#181d27] border-[#293242] text-[#ccff00]'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full animate-ping ${
                    isDark ? 'bg-[#ccff00]' : 'bg-[#d97706]'
                  }`}
                />
                <span>Smart Transport Operations Platform</span>
              </motion.div>

              {/* Word-by-word headline entrance */}
              <motion.h1
                variants={headlineContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.3 }}
                className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] flex flex-wrap items-baseline gap-x-2.5 sm:gap-x-3.5 gap-y-1 sm:gap-y-2"
              >
                {headlineWords.map((item, idx) => (
                  <motion.span
                    key={idx}
                    variants={wordAnimation}
                    className={`inline-block ${
                      item.isAccent
                        ? isDark
                          ? 'text-[#ccff00] underline decoration-[#ccff00]/40'
                          : 'text-[#d97706] underline decoration-[#d97706]/40'
                        : ''
                    }`}
                  >
                    {item.text}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-base sm:text-lg text-neutral-500 dark:text-neutral-400 max-w-xl leading-relaxed"
              >
                Vehicles, drivers, trips, maintenance, and cost — one dashboard per
                role, every rule enforced automatically.
              </motion.p>

              {/* Status Indicators (as depicted in design mockups) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="flex flex-wrap items-center gap-3 pt-1"
              >
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${
                    isDark
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Available</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${
                    isDark
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-400'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>On Trip</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${
                    isDark
                      ? 'bg-red-950/30 border-red-500/30 text-red-400'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>In Shop</span>
                </div>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-wrap items-center gap-3 pt-3"
              >
                <button
                  onClick={() => {
                    setActiveView(currentUser ? 'dashboard' : 'purchase');
                  }}
                  className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                    isDark
                      ? 'bg-[#ccff00] text-black hover:bg-[#bbf000] shadow-[0_0_20px_rgba(204,255,0,0.2)]'
                      : 'bg-[#d97706] text-white hover:bg-[#b45309] shadow-amber-500/20'
                  }`}
                >
                  <span>{currentUser ? 'Launch Fleet Command' : 'Choose a plan'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
                <button
                  onClick={() => {
                    if (currentUser) {
                      setActiveView('dashboard');
                    } else {
                      const el = document.getElementById('workspaces');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        setActiveView('login');
                      }
                    }
                  }}
                  className={`px-5 py-3 rounded-xl text-sm font-semibold border transition-all ${
                    isDark
                      ? 'bg-[#151921] border-[#252b36] hover:bg-[#1d232f] text-neutral-200'
                      : 'bg-white border-[#ded7cb] hover:bg-neutral-100 text-neutral-800'
                  }`}
                >
                  {currentUser ? 'Open My Workspace →' : 'Sign In to Workspace'}
                </button>
              </motion.div>
            </div>

            {/* Right: Live Interactive Telemetry Card (As shown in Hero design mockup) */}
            <div className="lg:col-span-5 relative">
              {/* Floating Status Micro-Badge */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-3 border shadow-sm ${
                  isDark
                    ? 'bg-[#181d27] border-[#293242] text-[#ccff00]'
                    : 'bg-white border-[#e2dbce] text-[#d97706]'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Zero-Latency Fleet Telemetry</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`p-6 rounded-2xl border shadow-2xl relative overflow-hidden ${
                  isDark
                    ? 'bg-[#13161d] border-[#262c38] text-neutral-100'
                    : 'bg-white border-[#e5dfd2] text-neutral-900 shadow-xl'
                }`}
              >
                {/* Status Bar */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-inherit">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider">
                      LIVE DISPATCH: TR-204
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isDark ? 'bg-[#ccff00]/15 text-[#ccff00]' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Auto-Validated
                  </span>
                </div>

                {/* Route Vector Graphic */}
                <div
                  className={`p-4 rounded-xl mb-4 border ${
                    isDark ? 'bg-[#181c25] border-[#252d3a]' : 'bg-neutral-50 border-[#ede6d8]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-white">
                        A
                      </div>
                      <span>Mumbai Freight Depot</span>
                    </div>
                    <div className="text-neutral-400 font-mono text-[10px]">165 km</div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white">
                        B
                      </div>
                      <span>Pune Tech Park</span>
                    </div>
                  </div>

                  {/* Route Progress Visualizer with Animated Moving Truck */}
                  <div className="relative h-2.5 rounded-full bg-neutral-700/30 overflow-visible mb-3 my-2">
                    <motion.div
                      animate={{ width: ['25%', '85%', '55%', '85%'] }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
                      className={`h-full rounded-full relative ${
                        isDark ? 'bg-[#ccff00]' : 'bg-[#d97706]'
                      }`}
                    >
                      {/* Animated Delivery Truck Marker */}
                      <div
                        className={`absolute right-0 -top-2 translate-x-1/2 p-1 rounded-full shadow-md flex items-center justify-center ${
                          isDark
                            ? 'bg-[#ccff00] text-black ring-2 ring-[#181c25]'
                            : 'bg-[#d97706] text-white ring-2 ring-neutral-50'
                        }`}
                      >
                        <Truck className="w-3 h-3 stroke-[2.5]" />
                      </div>
                    </motion.div>
                  </div>
                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>Dispatched: 07:15 AM</span>
                    <span className="text-emerald-400 font-semibold">ETA: 10:45 AM (On Schedule)</span>
                  </div>
                </div>

                {/* Trip Specs */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-[#181c25] border-[#252d3a]' : 'bg-neutral-50 border-[#ede6d8]'
                    }`}
                  >
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">
                      Assigned Vehicle
                    </span>
                    <div className="font-bold">Van-02 Express</div>
                    <div className="text-[11px] text-neutral-400">Ford Transit 350</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Cargo: 1,200 / 1,400 kg</span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-[#181c25] border-[#252d3a]' : 'bg-neutral-50 border-[#ede6d8]'
                    }`}
                  >
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">
                      Assigned Driver
                    </span>
                    <div className="font-bold">Sarah Chen</div>
                    <div className="text-[11px] text-neutral-400">Class: MGV Heavy</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Safety Score: 95/100</span>
                    </div>
                  </div>
                </div>

                {/* Enforced Rule Pill */}
                <div
                  className={`mt-4 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    isDark ? 'bg-[#1b202c] text-neutral-300' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <Cpu
                    className={`w-4 h-4 shrink-0 ${
                      isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
                    }`}
                  />
                  <span className="text-[11px]">
                    Automatic rule enforced: In-Shop assets and expired licenses were locked out during dispatch.
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Stat Ticker / Operational Benchmarks */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, margin: '-40px' }}
        transition={{ duration: 0.6 }}
        className="py-12 border-b border-inherit"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {[
              { label: 'License Compliance', val: '100%', sub: 'Zero expired dispatch violations', color: 'emerald' },
              { label: 'Dispatch Velocity', val: '3.2x', sub: 'Instant weight & cargo check', color: isDark ? 'lime' : 'amber' },
              { label: 'Operating Cost', val: '-18.4%', sub: 'Accurate fuel & ROI tracking', color: 'blue' },
              { label: 'Fleet Availability', val: '99.2%', sub: 'Proactive maintenance locking', color: 'purple' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`p-5 rounded-2xl border text-center transition-all ${
                  isDark
                    ? 'bg-[#14171f] border-[#252b36] hover:border-[#ccff00]/40 shadow-sm'
                    : 'bg-white border-[#e5dfd2] hover:border-amber-400 shadow-sm'
                }`}
              >
                <div
                  className={`text-2xl sm:text-3xl font-extrabold font-mono mb-1 ${
                    stat.color === 'lime'
                      ? 'text-[#ccff00]'
                      : stat.color === 'amber'
                      ? 'text-[#d97706]'
                      : stat.color === 'emerald'
                      ? 'text-emerald-400'
                      : stat.color === 'blue'
                      ? 'text-blue-400'
                      : 'text-purple-400'
                  }`}
                >
                  {stat.val}
                </div>
                <div className="text-xs font-bold">{stat.label}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{stat.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 3 Pillars Section ("From daily records to confident decisions.") */}
      <section className="py-20 border-b border-inherit">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <span
              className={`text-xs font-bold uppercase tracking-widest ${
                isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
              }`}
            >
              Operations Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 mb-3">
              From daily records to confident decisions.
            </h2>
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
              Stop relying on disjointed spreadsheets. TransitOps unifies asset registration, real-time dispatch, maintenance locks, and ROI.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border transition-all ${
                isDark
                  ? 'bg-[#14171e] border-[#252b36] hover:border-[#ccff00]/40'
                  : 'bg-white border-[#e5dfd2] hover:border-amber-400 shadow-sm'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                  isDark ? 'bg-[#ccff00]/15 text-[#ccff00]' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Capture operations</h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Register vehicles, driver profiles, fuel logs, tolls, and repair invoices in structured, easy-to-verify views with unique registration enforcement.
              </p>
            </motion.div>

            {/* Pillar 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border transition-all ${
                isDark
                  ? 'bg-[#14171e] border-[#252b36] hover:border-purple-400/40'
                  : 'bg-white border-[#e5dfd2] hover:border-purple-400 shadow-sm'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                  isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-100 text-purple-800'
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Automate the rules</h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Restrict drivers with invalid licenses, block over-weight assignments, and protect availability. In-shop maintenance automatically pulls vehicles from dispatch.
              </p>
            </motion.div>

            {/* Pillar 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border transition-all ${
                isDark
                  ? 'bg-[#14171e] border-[#252b36] hover:border-blue-400/40'
                  : 'bg-white border-[#e5dfd2] hover:border-blue-400 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-inherit">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Act on the signal</h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Inspect vehicle ROI, fuel efficiency (km/L), fleet utilization, and total operating cost per asset. Export audit-ready CSV reports at any time.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Comparison Section ("Most software records what happened...") */}
      <section className="py-20 border-b border-inherit">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <span
              className={`text-xs font-bold uppercase tracking-widest ${
                isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
              }`}
            >
              THE TRANSITOPS DIFFERENCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 mb-3">
              Most software records what happened.{' '}
              <span
                className={
                  isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
                }
              >
                TransitOps shapes what happens next.
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Old Spreadsheets & basic software */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`p-6 sm:p-8 rounded-2xl border ${
                isDark ? 'bg-[#151921] border-[#262c37]' : 'bg-neutral-50 border-[#ded7ca]'
              }`}
            >
              <div className="flex items-center gap-3 mb-6">
                <FileSpreadsheet className="w-6 h-6 text-red-400" />
                <h3 className="font-bold text-lg">Spreadsheets &amp; Legacy Logbooks</h3>
              </div>
              <ul className="space-y-4 text-xs sm:text-sm text-neutral-400">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Drivers with expired licenses still get dispatched because spreadsheets don&apos;t validate dates.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Cargo weight easily exceeds truck limits, risking roadside fines and mechanical failures.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Vehicles under active repair are mistakenly double-booked by dispatchers in different depots.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Calculating vehicle ROI requires hours of manual formula linking across multiple files.</span>
                </li>
              </ul>
            </motion.div>

            {/* TransitOps Rule Engine */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`p-6 sm:p-8 rounded-2xl border relative overflow-hidden ${
                isDark
                  ? 'bg-[#141822] border-[#ccff00]/40 shadow-[0_0_30px_rgba(204,255,0,0.08)]'
                  : 'bg-white border-amber-300 shadow-xl'
              }`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`p-2 rounded-lg ${
                    isDark ? 'bg-[#ccff00]/15 text-[#ccff00]' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">TransitOps Autonomous Rule Engine</h3>
              </div>
              <ul className="space-y-4 text-xs sm:text-sm">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Strict Compliance Gate:</strong> Drivers with expired licenses or Suspended flags are automatically locked out of selection.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Capacity Guardrail:</strong> Assignment is blocked if Cargo Weight &gt; Vehicle Max Capacity, giving instant error feedback.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Maintenance Lock:</strong> Adding a vehicle to maintenance switches it to &quot;In Shop&quot;, instantly pulling it from driver selection.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Automated Economics:</strong> Live calculation of Vehicle ROI: <code>(Revenue - (Maintenance + Fuel)) / Acquisition Cost</code>.
                  </span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Role Workspaces ("Choose the workspace built for you.") */}
      <section id="workspaces" className="py-20 border-b border-inherit scroll-mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-2xl mx-auto mb-14"
          >
            <span
              className={`text-xs font-bold uppercase tracking-widest ${
                isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
              }`}
            >
              ROLE-BASED ACCESS CONTROL (RBAC)
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 mb-3">
              Choose the workspace built for you.
            </h2>
            <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400">
              Tailored dashboards with specific permissions and workflows for each member of your operations team.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Fleet Manager */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all hover:border-neutral-400 ${
                isDark ? 'bg-[#14171f] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    Control Tower
                  </span>
                  <Truck className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-base mb-1">Fleet Manager</h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Oversees fleet assets, maintenance, vehicle lifecycle, and overall operational efficiency.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Manage vehicles &amp; drivers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Oversee every trip</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>Close maintenance work</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRoleSelect('fleet_manager')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-[#1a1f2c] hover:bg-[#232a3b] text-[#ccff00] border border-[#2d374a]'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-[#ded7ca]'
                }`}
              >
                Open Fleet Manager →
              </button>
            </motion.div>

            {/* 2. Driver / Dispatcher */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all hover:border-neutral-400 ${
                isDark ? 'bg-[#14171f] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Dispatch Desk
                  </span>
                  <Route className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-bold text-base mb-1">Driver / Dispatcher</h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Plan routes, dispatch eligible resources, and close active deliveries with accurate trip data.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Create and dispatch trips</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Use available resources only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Complete deliveries</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRoleSelect('driver')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-[#1a1f2c] hover:bg-[#232a3b] text-emerald-400 border border-[#2d374a]'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-[#ded7ca]'
                }`}
              >
                Open Dispatch Desk →
              </button>
            </motion.div>

            {/* 3. Safety Officer */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all hover:border-neutral-400 ${
                isDark ? 'bg-[#14171f] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    Compliance Watch
                  </span>
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="font-bold text-base mb-1">Safety Officer</h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Protect dispatch operations through license checks, suspensions, and safety monitoring.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Monitor license expiry</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Suspend or reinstate drivers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Monitor safety scores</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRoleSelect('safety_officer')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-[#1a1f2c] hover:bg-[#232a3b] text-purple-400 border border-[#2d374a]'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-[#ded7ca]'
                }`}
              >
                Open Safety Watch →
              </button>
            </motion.div>

            {/* 4. Financial Analyst */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all hover:border-neutral-400 ${
                isDark ? 'bg-[#14171f] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Cost Console
                  </span>
                  <BarChart className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-bold text-base mb-1">Financial Analyst</h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Understand fuel, maintenance, operating expenses, and efficiency across the fleet.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Log fuel and expenses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Compare vehicle cost</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Measure fuel efficiency &amp; ROI</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRoleSelect('financial_analyst')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isDark
                    ? 'bg-[#1a1f2c] hover:bg-[#232a3b] text-amber-400 border border-[#2d374a]'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-[#ded7ca]'
                }`}
              >
                Open Cost Console →
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-inherit py-20 scroll-mt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
              isDark ? 'border-[#293242] bg-[#181d27] text-[#ccff00]' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
              <CreditCard className="h-3.5 w-3.5" />
              SUBSCRIPTION PLANS
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Choose the right plan for your fleet</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Clear, fixed-term pricing for your organization. Verify your email before checkout; payments are processed securely by Razorpay.
            </p>
          </div>

          {plansError && (
            <div role="alert" className="mx-auto mb-6 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {plansError}
            </div>
          )}

          {plansLoading ? (
            <p role="status" className="text-center text-sm text-neutral-600 dark:text-neutral-400">Loading subscription plans…</p>
          ) : plans.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-3">
              {plans.map(plan => (
                <motion.article
                  key={plan.id}
                  whileHover={{ y: -4 }}
                  className={`flex flex-col rounded-2xl border p-6 shadow-lg ${
                    isDark
                      ? 'border-[#293242] bg-[#14171e]'
                      : 'border-[#e5dfd2] bg-white shadow-amber-950/5'
                  }`}
                >
                  <div className="mb-5">
                    <h3 className="text-lg font-extrabold">{plan.name}</h3>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">Fleet operations subscription</p>
                  </div>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight">{formatPlanPrice(plan)}</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    one-time payment for {plan.termMonths} {plan.termMonths === 1 ? 'month' : 'months'}
                  </p>
                  <div className="my-5 h-px bg-neutral-500/15" />
                  <ul className="mb-6 flex-1 space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => selectPlan(plan.id)}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                      isDark
                        ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                        : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                    }`}
                  >
                    {currentUser ? 'Go to workspace' : 'Choose this plan'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.article>
              ))}
            </div>
          ) : (
            !plansError && <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">No subscription plans are currently available.</p>
          )}

          <p className="mt-6 text-center text-xs text-neutral-600 dark:text-neutral-400">
            One-time payment, no automatic renewal. Razorpay checkout is currently configured for Test Mode.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pt-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: false, margin: '-50px' }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className={`p-8 sm:p-12 rounded-3xl border shadow-xl relative overflow-hidden ${
              isDark
                ? 'bg-gradient-to-b from-[#161a23] to-[#0f1218] border-[#293242]'
                : 'bg-gradient-to-b from-white to-amber-50/50 border-[#e2dbce]'
            }`}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              {currentUser ? 'Your fleet workspace is ready.' : 'Start your TransitOps subscription.'}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mb-8">
              {currentUser
                ? 'Return to your organization workspace and continue managing fleet operations.'
                : 'Select a plan, verify your organization email, and complete payment through Razorpay Checkout.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => currentUser ? setActiveView('dashboard') : document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                  isDark
                    ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
                    : 'bg-[#d97706] text-white hover:bg-[#b45309]'
                }`}
              >
                {currentUser ? 'Go to my workspace' : 'Compare subscription plans'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};
