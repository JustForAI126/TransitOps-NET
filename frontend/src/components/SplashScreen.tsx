import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, CheckCircle2, Shield, Activity, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { text: 'Booting TransitOps Core Engine...', icon: Activity },
    { text: 'Verifying vehicle fleet registries & status rules...', icon: Truck },
    { text: 'Auditing driver licenses & compliance scores...', icon: Shield },
    { text: 'Control tower telemetry active.', icon: CheckCircle2 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onFinish, 400);
          return 100;
        }
        const next = prev + 3;
        if (next > 75) setStepIndex(3);
        else if (next > 45) setStepIndex(2);
        else if (next > 20) setStepIndex(1);
        return next;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [onFinish]);

  const CurrentIcon = steps[stepIndex].icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.4 }}
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 select-none ${
          theme === 'dark'
            ? 'bg-[#0a0c0f] text-neutral-100'
            : 'bg-[#faf8f4] text-neutral-900'
        }`}
      >
        {/* Background ambient subtle glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full blur-3xl opacity-20 ${
              theme === 'dark' ? 'bg-[#ccff00]' : 'bg-[#eab308]'
            }`}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
          {/* Animated Logo Icon */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`relative p-5 rounded-2xl mb-6 shadow-xl border ${
              theme === 'dark'
                ? 'bg-[#14171e] border-[#252b36] shadow-[0_0_40px_rgba(204,255,0,0.15)]'
                : 'bg-white border-[#e7e1d5] shadow-[0_10px_30px_rgba(217,119,6,0.1)]'
            }`}
          >
            {/* Pulsing ring */}
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              className={`absolute inset-0 rounded-2xl ${
                theme === 'dark' ? 'bg-[#ccff00]' : 'bg-[#eab308]'
              }`}
            />
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center relative ${
                theme === 'dark' ? 'text-[#ccff00]' : 'text-[#d97706]'
              }`}
            >
              <Truck className="w-9 h-9 stroke-[2.2]" />
            </div>
          </motion.div>

          {/* App Title & Tagline */}
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  theme === 'dark' ? 'bg-[#ccff00]' : 'bg-[#d97706]'
                }`}
              />
              <span className="text-xs font-bold tracking-[0.25em] uppercase text-neutral-400">
                SMART TRANSPORT OPERATIONS
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">
              TRANSITOPS
            </h1>
            <p
              className={`text-sm max-w-xs mx-auto mb-8 ${
                theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
              }`}
            >
              Fleet operations, off the spreadsheet. Centralized rules, instant dispatch.
            </p>
          </motion.div>

          {/* Progress Container */}
          <div className="w-full space-y-3">
            {/* Progress bar */}
            <div
              className={`w-full h-2 rounded-full overflow-hidden p-0.5 border ${
                theme === 'dark'
                  ? 'bg-[#15181f] border-[#222733]'
                  : 'bg-[#ede8dc] border-[#e2dcce]'
              }`}
            >
              <motion.div
                className={`h-full rounded-full transition-all duration-150 ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-[#ccff00] to-[#b8e600]'
                    : 'bg-gradient-to-r from-[#f59e0b] to-[#d97706]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step status readout */}
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-2 font-medium">
                <CurrentIcon
                  className={`w-3.5 h-3.5 animate-pulse ${
                    theme === 'dark' ? 'text-[#ccff00]' : 'text-[#d97706]'
                  }`}
                />
                <span className={theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}>
                  {steps[stepIndex].text}
                </span>
              </div>
              <span
                className={`font-mono font-semibold ${
                  theme === 'dark' ? 'text-[#ccff00]' : 'text-[#d97706]'
                }`}
              >
                {progress}%
              </span>
            </div>
          </div>

          {/* Skip Action Button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            onClick={onFinish}
            className={`mt-8 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              theme === 'dark'
                ? 'text-neutral-400 hover:text-white bg-[#151921] hover:bg-[#1e2330] border border-[#272e3c]'
                : 'text-neutral-600 hover:text-neutral-900 bg-[#ede8dc] hover:bg-[#e4ddcf] border border-[#dad2c3]'
            }`}
          >
            <span>Skip to workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
