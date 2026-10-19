import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useApp, AppNotification } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

interface ToastItemProps {
  notif: AppNotification;
  onDismiss: (id: string) => void;
  isDark: boolean;
}

const ToastItem: React.FC<ToastItemProps> = ({ notif, onDismiss, isDark }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = notif.duration || 4500;
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const intervalTime = 50;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newRemaining = Math.max(0, remainingTimeRef.current - elapsed);
      const newProgress = (newRemaining / duration) * 100;

      setProgress(newProgress);

      if (newRemaining <= 0) {
        clearInterval(timer);
        onDismiss(notif.id);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, duration, notif.id, onDismiss]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex flex-col gap-2 relative overflow-hidden backdrop-blur-md transition-all ${
        isDark
          ? notif.type === 'error'
            ? 'bg-[#1e1416]/95 border-red-500/30 text-red-100'
            : notif.type === 'warning'
            ? 'bg-[#211a12]/95 border-amber-500/30 text-amber-100'
            : notif.type === 'success'
            ? 'bg-[#121c17]/95 border-emerald-500/30 text-emerald-100'
            : 'bg-[#14171e]/95 border-[#282f3d] text-neutral-100'
          : notif.type === 'error'
          ? 'bg-red-50/95 border-red-200 text-red-900'
          : notif.type === 'warning'
          ? 'bg-amber-50/95 border-amber-200 text-amber-900'
          : notif.type === 'success'
          ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
          : 'bg-white/95 border-[#e5dfd2] text-neutral-900'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type Indicator Icon */}
        <div className="shrink-0 mt-0.5">
          {notif.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
          {notif.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
          {notif.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {notif.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
        </div>

        {/* Body */}
        <div className="flex-1 pr-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {notif.title}
            </h4>
            <span className="text-[10px] opacity-60">{notif.timestamp}</span>
          </div>
          <p className="text-xs mt-0.5 leading-relaxed opacity-90">{notif.message}</p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => onDismiss(notif.id)}
          aria-label="Close notification"
          className="shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full transition-all duration-75 ${
            notif.type === 'error'
              ? 'bg-red-500'
              : notif.type === 'warning'
              ? 'bg-amber-500'
              : notif.type === 'success'
              ? 'bg-emerald-500'
              : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export const NotificationToast: React.FC = () => {
  const { notifications, dismissNotification, currentUser } = useApp();
  const { theme } = useTheme();

  // Never render notifications if user is not signed in
  if (!currentUser) {
    return null;
  }

  // Filter notifications strictly to the current user (or system-wide for the user)
  const userNotifications = notifications.filter(
    (n) => !n.userId || n.userId === currentUser.id || n.userId === currentUser.email
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {userNotifications.slice(0, 3).map((notif) => (
          <ToastItem
            key={notif.id}
            notif={notif}
            onDismiss={dismissNotification}
            isDark={theme === 'dark'}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
