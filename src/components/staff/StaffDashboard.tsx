import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  User,
  ShieldAlert,
  CalendarOff,
} from 'lucide-react';
import { StaffProfile, AvailabilityRule, BlockedTime, Appointment } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface DaySchedule {
  dayOfWeek: number;
  name: string;
  enabled: boolean;
  intervals: { startMinute: number; endMinute: number }[];
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const StaffDashboard: React.FC<{ targetStaffId?: string }> = ({ targetStaffId }) => {
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
  const [blockedTimesList, setBlockedTimesList] = useState<BlockedTime[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);

  // New blocked time form
  const [blockStart, setBlockStart] = useState<string>('');
  const [blockEnd, setBlockEnd] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [isAddingBlock, setIsAddingBlock] = useState<boolean>(false);

  // Helper minute to time string "HH:MM"
  const minToTime = (min: number) => {
    const hh = String(Math.floor(min / 60)).padStart(2, '0');
    const mm = String(min % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const timeToMin = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + mm;
  };

  const loadStaffData = useCallback(async () => {
    try {
      setLoading(true);
      // Determine staff ID (targetStaffId from props or current user's profile)
      let resolvedStaffId = targetStaffId;
      if (!resolvedStaffId) {
        const staffRes = await apiFetch('/api/v1/staff');
        const staffJson = await staffRes.json();
        if (staffJson.success && staffJson.data.length > 0) {
          // If logged in user is staff, find matching; else default to first
          const found = staffJson.data.find(
            (s: StaffProfile) => s.userId === user?.id
          );
          resolvedStaffId = found ? found.id : staffJson.data[0].id;
          setStaffProfile(found || staffJson.data[0]);
        }
      } else {
        const staffRes = await apiFetch('/api/v1/staff');
        const staffJson = await staffRes.json();
        const found = staffJson.data.find((s: StaffProfile) => s.id === resolvedStaffId);
        if (found) setStaffProfile(found);
      }

      if (!resolvedStaffId) return;

      const [availRes, aptsRes] = await Promise.all([
        apiFetch(`/api/v1/staff/${resolvedStaffId}/availability`),
        apiFetch(`/api/v1/appointments?staffId=${resolvedStaffId}`),
      ]);

      const [availJson, aptsJson] = await Promise.all([availRes.json(), aptsRes.json()]);

      if (availJson.success) {
        setBlockedTimesList(availJson.data.blockedTimes || []);

        // Reconstruct weekly schedule rows (0..6)
        const rules: AvailabilityRule[] = availJson.data.rules || [];
        const builtSchedule: DaySchedule[] = DAYS_OF_WEEK.map((name, dayIndex) => {
          const matchingRules = rules.filter(
            (r) => r.dayOfWeek === dayIndex && r.isActive
          );
          return {
            dayOfWeek: dayIndex,
            name,
            enabled: matchingRules.length > 0,
            intervals:
              matchingRules.length > 0
                ? matchingRules.map((r) => ({
                    startMinute: r.startMinute,
                    endMinute: r.endMinute,
                  }))
                : [{ startMinute: 540, endMinute: 1020 }], // Default 9AM - 5PM if enabled
          };
        });
        setWeeklySchedule(builtSchedule);
      }

      if (aptsJson.success) {
        setTodayAppointments(aptsJson.data);
      }
    } catch (e) {
      toast('Failed to load schedule', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast, targetStaffId, user]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  // Toggle day availability
  const handleToggleDay = (dayIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayIndex ? { ...d, enabled: !d.enabled } : d))
    );
  };

  // Add interval to a day (split shift)
  const handleAddInterval = (dayIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayIndex) return d;
        return {
          ...d,
          intervals: [...d.intervals, { startMinute: 840, endMinute: 1050 }], // 2PM - 5:30PM
        };
      })
    );
  };

  // Remove interval
  const handleRemoveInterval = (dayIndex: number, intervalIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayIndex) return d;
        const filtered = d.intervals.filter((_, i) => i !== intervalIndex);
        return {
          ...d,
          intervals: filtered.length > 0 ? filtered : [{ startMinute: 540, endMinute: 1020 }],
          enabled: filtered.length > 0,
        };
      })
    );
  };

  // Update interval start/end
  const handleUpdateInterval = (
    dayIndex: number,
    intervalIndex: number,
    field: 'start' | 'end',
    valStr: string
  ) => {
    const mins = timeToMin(valStr);
    setWeeklySchedule((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayIndex) return d;
        const newIntervals = [...d.intervals];
        if (field === 'start') newIntervals[intervalIndex].startMinute = mins;
        else newIntervals[intervalIndex].endMinute = mins;
        return { ...d, intervals: newIntervals };
      })
    );
  };

  // Save weekly schedule to backend
  const handleSaveWeeklySchedule = async () => {
    if (!staffProfile) return;
    setIsSavingSchedule(true);
    try {
      const flattenedRules: any[] = [];
      for (const day of weeklySchedule) {
        if (day.enabled) {
          for (const interval of day.intervals) {
            flattenedRules.push({
              dayOfWeek: day.dayOfWeek,
              startMinute: interval.startMinute,
              endMinute: interval.endMinute,
              isActive: true,
            });
          }
        }
      }

      const res = await apiFetch(`/api/v1/staff/${staffProfile.id}/availability`, {
        method: 'PUT',
        body: JSON.stringify({ rules: flattenedRules }),
      });
      const json = await res.json();
      if (json.success) {
        toast('Weekly working hours updated successfully!', 'success');
        loadStaffData();
      }
    } catch (e) {
      toast('Failed to save working hours', 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Add Blocked Time / Vacation
  const handleAddBlockedTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffProfile || !blockStart || !blockEnd || !blockReason.trim()) {
      toast('Please enter start, end, and reason for time off', 'error');
      return;
    }

    if (new Date(blockStart) >= new Date(blockEnd)) {
      toast('End time must be after start time', 'error');
      return;
    }

    setIsAddingBlock(true);
    try {
      const res = await apiFetch(`/api/v1/staff/${staffProfile.id}/blocked-times`, {
        method: 'POST',
        body: JSON.stringify({
          startAt: new Date(blockStart).toISOString(),
          endAt: new Date(blockEnd).toISOString(),
          reason: blockReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to add blocked time');
      }

      toast('Time-off period recorded.', 'success');
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      loadStaffData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setIsAddingBlock(false);
    }
  };

  // Delete blocked time
  const handleDeleteBlockedTime = async (blockId: string) => {
    if (!staffProfile) return;
    try {
      const res = await apiFetch(`/api/v1/staff/${staffProfile.id}/blocked-times/${blockId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast('Blocked time removed', 'info');
        loadStaffData();
      }
    } catch (e) {
      toast('Failed to remove blocked time', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Schedule & Availability
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure weekly recurring working shifts and manage blocked time off for{' '}
            <strong>{staffProfile?.name || 'Practitioner'}</strong>.
          </p>
        </div>

        <button
          onClick={handleSaveWeeklySchedule}
          disabled={isSavingSchedule}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          {isSavingSchedule ? 'Saving...' : 'Save Weekly Schedule'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Weekly Working Hours Editor */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Weekly Working Hours</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set active shifts and add split breaks (e.g. 9:00 AM–1:00 PM & 2:00 PM–5:30 PM).
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              TZ: {staffProfile?.timezone || 'America/New_York'}
            </span>
          </div>

          <div className="space-y-2.5">
            {weeklySchedule.map((day) => (
              <div
                key={day.dayOfWeek}
                className={`p-3 rounded border transition-all ${
                  day.enabled
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-100 bg-slate-50/60 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 w-36">
                    <input
                      type="checkbox"
                      id={`day-${day.dayOfWeek}`}
                      checked={day.enabled}
                      onChange={() => handleToggleDay(day.dayOfWeek)}
                      className="rounded text-slate-900 focus:ring-slate-900 h-4 w-4"
                    />
                    <label
                      htmlFor={`day-${day.dayOfWeek}`}
                      className="text-xs font-bold text-slate-800 cursor-pointer select-none"
                    >
                      {day.name}
                    </label>
                  </div>

                  {/* Intervals */}
                  {day.enabled ? (
                    <div className="flex-1 space-y-2">
                      {day.intervals.map((interval, iIdx) => (
                        <div key={iIdx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={minToTime(interval.startMinute)}
                            onChange={(e) =>
                              handleUpdateInterval(day.dayOfWeek, iIdx, 'start', e.target.value)
                            }
                            className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white font-mono"
                          />
                          <span className="text-xs text-slate-400">to</span>
                          <input
                            type="time"
                            value={minToTime(interval.endMinute)}
                            onChange={(e) =>
                              handleUpdateInterval(day.dayOfWeek, iIdx, 'end', e.target.value)
                            }
                            className="px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white font-mono"
                          />

                          {day.intervals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInterval(day.dayOfWeek, iIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                              title="Remove Interval"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 text-xs text-slate-400 italic">Unavailable</div>
                  )}

                  {/* Add interval button */}
                  {day.enabled && (
                    <button
                      type="button"
                      onClick={() => handleAddInterval(day.dayOfWeek)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors self-start sm:self-center"
                    >
                      + Add Shift
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Time Off / Blocked Periods */}
        <div className="space-y-6">
          {/* Add Block Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Block Time Off</h3>
              <p className="text-xs text-slate-500">
                Block hours or whole days for vacations, training, or breaks.
              </p>
            </div>

            <form onSubmit={handleAddBlockedTime} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  From Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={blockStart}
                  onChange={(e) => setBlockStart(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  To Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={blockEnd}
                  onChange={(e) => setBlockEnd(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Reason for Block
                </label>
                <input
                  type="text"
                  required
                  placeholder="Doctor appointment, staff training..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingBlock}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                {isAddingBlock ? 'Checking conflicts...' : '+ Block Time Period'}
              </button>
            </form>
          </div>

          {/* Blocked Times List */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Upcoming Blocked Periods</h3>
            {blockedTimesList.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No active blocked periods scheduled.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {blockedTimesList.map((blk) => {
                  const s = new Date(blk.startAt);
                  const e = new Date(blk.endAt);
                  return (
                    <div
                      key={blk.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-2"
                    >
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">{blk.reason}</span>
                        <span className="text-[11px] text-slate-500">
                          {s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                          {s.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}{' '}
                          -{' '}
                          {e.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteBlockedTime(blk.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove Block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
