import React from 'react';
import { motion } from 'motion/react';
import { Compass, Truck, NavigationOff } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

interface LiveRouteRadarProps {
  title?: string;
  subtitle?: string;
}

export const LiveRouteRadar: React.FC<LiveRouteRadarProps> = ({
  title = 'Live Route & Asset Radar',
  subtitle = 'Real-time geographic tracking of assigned vehicles & active hubs',
}) => {
  const { theme } = useTheme();
  const { trips } = useApp();
  const isDark = theme === 'dark';

  const dispatchedTrips = trips.filter((t) => t.status === 'Dispatched');
  const activeTrip = dispatchedTrips[0];

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border flex flex-col justify-between ${
        isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Compass
            className={`w-5 h-5 ${
              isDark ? 'text-[#ccff00]' : 'text-[#d97706]'
            }`}
          />
          <div>
            <h3 className="font-bold text-base">{title}</h3>
            <p className="text-xs text-neutral-400">{subtitle}</p>
          </div>
        </div>
        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
            dispatchedTrips.length > 0
              ? isDark
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDark
              ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400'
              : 'bg-neutral-100 border-neutral-300 text-neutral-600'
          }`}
        >
          {dispatchedTrips.length > 0
            ? `${dispatchedTrips.length} Active On Road`
            : 'Depot Standby (Idle)'}
        </span>
      </div>

      {/* SVG Map Canvas with Routes, Hubs, and Animated vehicles */}
      <div
        className={`relative w-full h-80 sm:h-96 rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#0f1218] border-[#212735]' : 'bg-[#f4efe5] border-[#ded7ca]'
        }`}
      >
        {/* Grid Lines Pattern */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(${
              isDark ? '#ccff00' : '#d97706'
            } 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Corridor Routes */}
        <svg className="absolute inset-0 w-full h-full">
          {/* Western Corridor: Mumbai - Pune */}
          <line
            x1="25%"
            y1="55%"
            x2="48%"
            y2="70%"
            stroke={isDark ? '#ccff00' : '#d97706'}
            strokeWidth="2.5"
            strokeDasharray="6 4"
            strokeOpacity={dispatchedTrips.length > 0 ? 0.9 : 0.25}
          />
          {/* Southern Corridor: Bangalore - Chennai */}
          <line
            x1="60%"
            y1="85%"
            x2="85%"
            y2="75%"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeOpacity="0.4"
          />
          {/* Northern Corridor: Delhi - Ahmedabad */}
          <line
            x1="35%"
            y1="25%"
            x2="22%"
            y2="42%"
            stroke="#a855f7"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeOpacity="0.4"
          />
        </svg>

        {/* Hub Pins */}
        <div className="absolute top-[25%] left-[35%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer">
          <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/20" />
          <div
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${
              isDark ? 'bg-[#181c25] text-neutral-200' : 'bg-white text-neutral-800'
            }`}
          >
            Delhi NCR Hub
          </div>
        </div>

        <div className="absolute top-[55%] left-[25%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer">
          <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          <div
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${
              isDark ? 'bg-[#181c25] text-neutral-200' : 'bg-white text-neutral-800'
            }`}
          >
            Mumbai JNPT Terminal
          </div>
        </div>

        <div className="absolute top-[70%] left-[48%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer">
          <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
          <div
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${
              isDark ? 'bg-[#181c25] text-neutral-200' : 'bg-white text-neutral-800'
            }`}
          >
            Pune Chakan Hub
          </div>
        </div>

        <div className="absolute top-[85%] left-[60%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 cursor-pointer">
          <div className="w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-500/20" />
          <div
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${
              isDark ? 'bg-[#181c25] text-neutral-200' : 'bg-white text-neutral-800'
            }`}
          >
            Bangalore South Depot
          </div>
        </div>

        {/* Dynamic Moving Vehicle Marker if dispatches are active */}
        {activeTrip ? (
          <motion.div
            animate={{
              left: ['27%', '44%', '33%'],
              top: ['57%', '68%', '61%'],
            }}
            transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
          >
            <div className="relative">
              <div
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-lg border ${
                  isDark
                    ? 'bg-[#ccff00] text-black border-black/20'
                    : 'bg-[#d97706] text-white border-white/20'
                }`}
              >
                <Truck className="w-3 h-3" />
                <span>{activeTrip.vehicleName} ({activeTrip.tripCode})</span>
              </div>
              <span
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping ${
                  isDark ? 'bg-[#ccff00]' : 'bg-[#d97706]'
                }`}
              />
            </div>
          </motion.div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`p-4 rounded-xl border text-center shadow-lg backdrop-blur-md max-w-xs ${
                isDark ? 'bg-[#14171f]/85 border-[#28303f] text-neutral-300' : 'bg-white/90 border-[#ded7ca] text-neutral-700'
              }`}
            >
              <NavigationOff className="w-6 h-6 mx-auto mb-1 opacity-60 text-amber-500" />
              <div className="font-bold text-xs">No Active Dispatches</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                All vehicles parked at depot. Dispatch a scheduled cargo run to engage live GPS tracking.
              </div>
            </div>
          </div>
        )}

        {/* Map Telemetry Box */}
        {activeTrip && (
          <div
            className={`absolute bottom-3 left-3 p-2.5 rounded-xl border text-[11px] backdrop-blur-md max-w-xs ${
              isDark
                ? 'bg-[#14171f]/90 border-[#262c37] text-neutral-300'
                : 'bg-white/90 border-[#ded7ca] text-neutral-800 shadow-sm'
            }`}
          >
            <div className="font-bold mb-0.5">Active Transit Telemetry:</div>
            <div>{activeTrip.vehicleName} ({activeTrip.vehicleRegNumber})</div>
            <div className="text-[10px] text-neutral-400">
              Driver: {activeTrip.driverName} · Planned: {activeTrip.plannedDistanceKm} km · Payload: {activeTrip.cargoWeightKg.toLocaleString()} kg
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
