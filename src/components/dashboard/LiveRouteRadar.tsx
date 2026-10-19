import React from 'react';
import { NavigationOff, Truck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Trip } from '../../types';

interface LiveRouteRadarProps {
  title?: string;
  subtitle?: string;
  trips: Trip[];
}

export const LiveRouteRadar: React.FC<LiveRouteRadarProps> = ({
  title = 'Active Dispatches',
  subtitle = 'Current routes from saved trip data',
  trips,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const dispatchedTrips = trips.filter((trip) => trip.status === 'Dispatched');

  return (
    <section
      className={`p-5 sm:p-6 rounded-2xl border ${
        isDark ? 'bg-[#14171e] border-[#252b36]' : 'bg-white border-[#e5dfd2] shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-base">{title}</h3>
          <p className="text-xs text-neutral-400">{subtitle}</p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-inherit">
          {dispatchedTrips.length} active
        </span>
      </div>

      {dispatchedTrips.length === 0 ? (
        <div className="min-h-48 flex flex-col items-center justify-center rounded-xl border border-dashed border-inherit text-center px-4">
          <NavigationOff className="w-7 h-7 mb-2 text-neutral-400" />
          <p className="font-semibold text-sm">No active dispatches</p>
          <p className="text-xs text-neutral-400 mt-1">Dispatch a saved draft trip to see it here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {dispatchedTrips.map((trip) => (
            <li
              key={trip.id}
              className={`rounded-xl border p-4 ${
                isDark ? 'bg-[#191d26] border-[#272e3d]' : 'bg-neutral-50 border-[#ded7ca]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Truck className="w-4 h-4 mt-0.5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold">{trip.vehicleName} · {trip.tripCode}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {trip.source} → {trip.destination}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-neutral-400">{trip.plannedDistanceKm.toLocaleString()} km</span>
              </div>
              <div className="mt-3 pl-6 text-[11px] text-neutral-400">
                Driver: {trip.driverName} · Payload: {trip.cargoWeightKg.toLocaleString()} kg
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
