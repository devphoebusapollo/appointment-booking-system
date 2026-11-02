import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
  Check,
  RotateCcw,
} from 'lucide-react';
import { DailyRosterResponse, SpecialistDayStatus } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface DailyRosterViewProps {
  initialDate?: string;
}

export const DailyRosterView: React.FC<DailyRosterViewProps> = ({ initialDate }) => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [roster, setRoster] = useState<DailyRosterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingBatch, setSavingBatch] = useState<boolean>(false);

  // Modal for conflict confirmation when marking off with existing appointments
  const [conflictModal, setConflictModal] = useState<{
    staff: SpecialistDayStatus;
    appointments: any[];
  } | null>(null);
  const [offReason, setOffReason] = useState<string>('Off duty / Leave');

  // Load roster data for selected date
  const loadRoster = useCallback(
    async (dateStr: string) => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/v1/admin/daily-roster?date=${dateStr}`);
        const json = await res.json();
        if (json.success) {
          setRoster(json.data);
        } else {
          toast(json.error?.message || 'Failed to load daily roster', 'error');
        }
      } catch (err: any) {
        toast('Failed to load daily roster for this date', 'error');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, toast]
  );

  useEffect(() => {
    loadRoster(selectedDate);
  }, [selectedDate, loadRoster]);

  // Date navigation handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  };

  // Toggle single specialist availability
  const handleToggleSpecialist = async (
    staff: SpecialistDayStatus,
    targetAvailable: boolean,
    force = false,
    reason = offReason
  ) => {
    // If turning off and staff has appointments and not forced yet, prompt conflict modal
    if (!targetAvailable && staff.appointmentsCount > 0 && !force) {
      setConflictModal({
        staff,
        appointments: staff.appointments || [],
      });
      return;
    }

    try {
      setTogglingId(staff.staffId);
      const res = await apiFetch('/api/v1/admin/daily-roster/toggle', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          staffId: staff.staffId,
          isAvailable: targetAvailable,
          reason: targetAvailable ? undefined : reason,
          force,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update availability');
      }

      toast(
        targetAvailable
          ? `${staff.name} is now available on ${selectedDate}`
          : `${staff.name} marked unavailable on ${selectedDate}`,
        'success'
      );

      setConflictModal(null);
      loadRoster(selectedDate);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Batch toggle: Mark all scheduled staff available for this date
  const handleMarkAllAvailable = async () => {
    if (!roster) return;
    try {
      setSavingBatch(true);
      const allStaffIds = roster.specialists.map((s) => s.staffId);
      const res = await apiFetch('/api/v1/admin/daily-roster', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          availableStaffIds: allStaffIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast(`All specialists marked available for ${selectedDate}`, 'success');
        loadRoster(selectedDate);
      }
    } catch (err: any) {
      toast('Failed to update roster', 'error');
    } finally {
      setSavingBatch(false);
    }
  };

  // Formatted date string (e.g. Tuesday, November 3, 2026)
  const formattedDateTitle = (() => {
    try {
      const parts = selectedDate.split('-').map(Number);
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  })();

  const availableCount = roster?.specialists.filter((s) => s.isAvailable).length || 0;
  const totalCount = roster?.specialists.length || 0;

  return (
    <div className="space-y-6">
      {/* Date Navigation & Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            <button
              onClick={handlePrevDay}
              className="p-2 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 border-x border-slate-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextDay}
              className="p-2 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-500 font-mono">
              On Duty: <strong className="text-slate-900">{availableCount}</strong> / {totalCount}
            </span>
          </div>

          <button
            onClick={handleMarkAllAvailable}
            disabled={savingBatch || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All to Available
          </button>
        </div>
      </div>

      {/* Date Header Title */}
      <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{formattedDateTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Indicate which specialists are available for booking on this date. Unavailable specialists are hidden from customer appointment scheduling.
          </p>
        </div>
        <span className="font-mono text-xs text-slate-400 tabular-nums">{selectedDate}</span>
      </div>

      {/* Specialist Roster Grid */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : roster?.specialists.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
          No active specialists found.
        </div>
      ) : (
        <div className="space-y-3">
          {roster?.specialists.map((stf) => {
            const isToggling = togglingId === stf.staffId;
            return (
              <div
                key={stf.staffId}
                className={`bg-white border rounded-xl p-4 sm:p-5 transition-all ${
                  stf.isAvailable
                    ? 'border-slate-200'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Specialist Profile Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shrink-0 mt-0.5">
                      {stf.avatarUrl ? (
                        <img
                          src={stf.avatarUrl}
                          alt={stf.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 bg-slate-100">
                          {stf.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm">{stf.name}</h4>
                        <span className="text-[11px] font-mono text-slate-500">
                          {stf.isAvailable ? '· On Duty & Available' : '· Marked Unavailable / Off Duty'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium">{stf.title}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono pt-1">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {stf.isWorkingDay ? stf.workingHours : 'No regular shift scheduled'}
                        </span>

                        {stf.appointmentsCount > 0 ? (
                          <span className="flex items-center gap-1.5 text-amber-700">
                            <Calendar className="w-3 h-3 text-amber-600" />
                            {stf.appointmentsCount} scheduled appointment(s)
                          </span>
                        ) : (
                          <span className="text-slate-400">0 appointments booked</span>
                        )}

                        {stf.blockedReason && !stf.isAvailable && (
                          <span className="text-slate-500 italic">
                            Reason: {stf.blockedReason}
                          </span>
                        )}
                      </div>

                      {/* Scheduled Appointments Preview */}
                      {stf.appointments && stf.appointments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-xs">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                            Scheduled on this date:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {stf.appointments.map((a) => (
                              <span
                                key={a.id}
                                className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-700 font-mono"
                              >
                                {new Date(a.startAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                : {a.customerName} ({a.serviceName})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Availability Toggle Action */}
                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                    {stf.isAvailable ? (
                      <button
                        onClick={() => handleToggleSpecialist(stf, false)}
                        disabled={isToggling}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        {isToggling ? 'Updating...' : 'Mark Unavailable / Off'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSpecialist(stf, true)}
                        disabled={isToggling}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {isToggling ? 'Updating...' : 'Indicate Available / On Duty'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict Modal when specialist has appointments */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-900 text-base">
                Scheduled Appointments Exist
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>{conflictModal.staff.name}</strong> currently has{' '}
              <strong>{conflictModal.appointments.length} appointment(s)</strong> scheduled on{' '}
              <strong>{selectedDate}</strong>.
            </p>

            <div className="max-h-36 overflow-y-auto space-y-1.5 bg-amber-50/50 border border-amber-200/60 rounded-lg p-3 text-xs">
              {conflictModal.appointments.map((a: any) => (
                <div key={a.id} className="font-mono text-[11px] text-slate-700">
                  • {new Date(a.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:{' '}
                  {a.customerName} - {a.serviceName}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Absence / Time Off
              </label>
              <input
                type="text"
                value={offReason}
                onChange={(e) => setOffReason(e.target.value)}
                placeholder="e.g. Sick leave, Conference, Personal emergency"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              Marking off duty will prevent any new customers from booking this specialist on {selectedDate}. Please remember to reschedule or contact existing clients.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConflictModal(null)}
                className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleToggleSpecialist(conflictModal.staff, false, true, offReason)
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Confirm & Mark Off Duty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
