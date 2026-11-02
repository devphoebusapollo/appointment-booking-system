import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  User,
  PlusCircle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Appointment, TimeSlot } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface CustomerAppointmentsProps {
  onBookNew: () => void;
}

export const CustomerAppointments: React.FC<CustomerAppointmentsProps> = ({ onBookNew }) => {
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST' | 'CANCELLED'>('UPCOMING');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Reschedule state
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);

  // Cancel state
  const [cancelApt, setCancelApt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/appointments');
      const json = await res.json();
      if (json.success) {
        setAppointments(json.data);
      }
    } catch (e) {
      toast('Failed to load appointments', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments, user]);

  const now = new Date();
  const filteredAppointments = appointments.filter((apt) => {
    const end = new Date(apt.endAt);
    if (activeTab === 'CANCELLED') {
      return apt.status === 'CANCELLED';
    }
    if (activeTab === 'PAST') {
      return (apt.status === 'COMPLETED' || end < now) && apt.status !== 'CANCELLED';
    }
    return end >= now && apt.status !== 'CANCELLED';
  });

  // Fetch slots for rescheduling
  useEffect(() => {
    if (!rescheduleApt || !rescheduleDate) return;

    async function loadRescheduleSlots() {
      setLoadingSlots(true);
      try {
        const res = await apiFetch(
          `/api/v1/availability?date=${rescheduleDate}&serviceId=${rescheduleApt!.serviceId}&staffId=${rescheduleApt!.staffId}`
        );
        const json = await res.json();
        if (json.success) {
          setRescheduleSlots(json.data.slots);
        } else {
          setRescheduleSlots([]);
        }
      } catch (e) {
        setRescheduleSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadRescheduleSlots();
  }, [rescheduleApt, rescheduleDate, apiFetch]);

  const handleConfirmReschedule = async () => {
    if (!rescheduleApt || !selectedSlot) return;

    setIsRescheduling(true);
    try {
      const res = await apiFetch(`/api/v1/appointments/${rescheduleApt.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ newStartAt: selectedSlot.startAt }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to reschedule');
      }

      toast('Appointment rescheduled successfully!', 'success');
      setRescheduleApt(null);
      fetchAppointments();
    } catch (e: any) {
      toast(e.message || 'Slot no longer available.', 'error');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelApt) return;

    setIsCancelling(true);
    try {
      const res = await apiFetch(`/api/v1/appointments/${cancelApt.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason || 'Cancelled by customer' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to cancel');
      }

      toast('Appointment cancelled.', 'info');
      setCancelApt(null);
      fetchAppointments();
    } catch (e: any) {
      toast(e.message || 'Failed to cancel appointment', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 mb-6">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block mb-0.5">
            Client Portal
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">My Appointments</h2>
        </div>

        <button
          onClick={onBookNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Tabs (Functional Filter Controls) */}
      <div className="flex items-center gap-6 border-b border-slate-200/80 mb-6 text-xs">
        {(['UPCOMING', 'PAST', 'CANCELLED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] ${
              activeTab === tab
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 bg-white border border-slate-200/90 rounded animate-pulse" />
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded p-12 text-center">
          <p className="font-semibold text-slate-900 text-sm mb-1">
            No {activeTab.toLowerCase()} appointments
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            You currently have no scheduled appointments in this view.
          </p>
          <button
            onClick={onBookNew}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Schedule a Service
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200/80 bg-white border border-slate-200/90 rounded-lg">
          {filteredAppointments.map((apt) => {
            const start = new Date(apt.startAt);
            const formattedDate = start.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const formattedTime = start.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);
            const canModify = apt.status === 'CONFIRMED' && hoursUntil >= 2;

            return (
              <div
                key={apt.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{apt.serviceName}</h3>
                    <span className="text-[10px] font-mono text-slate-400">#{apt.id}</span>
                  </div>

                  {/* Clean unboxed metadata with typographic separators */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono text-slate-900 font-medium">
                      {formattedDate} · {formattedTime}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span>with {apt.staffName}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono font-bold text-slate-900">${apt.priceCharged}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono text-slate-600 font-medium">
                      {apt.status === 'CONFIRMED' && 'Confirmed'}
                      {apt.status === 'COMPLETED' && 'Completed'}
                      {apt.status === 'CANCELLED' && 'Cancelled'}
                    </span>
                  </div>

                  {apt.customerNotes && (
                    <p className="text-[11px] text-slate-500 italic mt-1">
                      "{apt.customerNotes}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                {canModify && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setRescheduleApt(apt);
                        setRescheduleDate(new Date().toISOString().split('T')[0]);
                        setSelectedSlot(null);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => {
                        setCancelApt(apt);
                        setCancelReason('');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 border border-slate-200 hover:bg-rose-50 hover:border-rose-300 rounded transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Reschedule Booking</h3>
                <p className="text-xs text-slate-500">{rescheduleApt.serviceName}</p>
              </div>
              <button
                onClick={() => setRescheduleApt(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Choose New Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Available Slots with {rescheduleApt.staffName}
                </label>
                {loadingSlots ? (
                  <div className="text-xs text-slate-400 py-4 text-center font-mono">
                    Loading slots...
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded">
                    No open slots on this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {rescheduleSlots.map((slot) => {
                      const isSel = selectedSlot?.startAt === slot.startAt;
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-1.5 px-2 text-xs font-mono rounded border transition-colors ${
                            isSel
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleApt(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedSlot || isRescheduling}
                  onClick={handleConfirmReschedule}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-semibold"
                >
                  {isRescheduling ? 'Updating...' : 'Save New Time'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelApt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Cancel Appointment?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to cancel your reservation for{' '}
              <strong>{cancelApt.serviceName}</strong>? The time slot will immediately be made available for other bookings.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for cancellation (Optional)
              </label>
              <input
                type="text"
                placeholder="Schedule conflict, feeling unwell, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelApt(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
