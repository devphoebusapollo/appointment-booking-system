import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Search,
  Plus,
  RotateCcw,
  X,
  CheckCircle2,
  CalendarX2,
  Clock,
  User,
  Mail,
  Phone,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Appointment, Service, StaffProfile, TimeSlot } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface AppointmentsPageProps {
  onNewAppointment: () => void;
  selectedDrawerApt?: Appointment | null;
  onCloseDrawer?: () => void;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({
  onNewAppointment,
  selectedDrawerApt,
  onCloseDrawer,
}) => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Active drawer appointment
  const [activeApt, setActiveApt] = useState<Appointment | null>(selectedDrawerApt || null);

  // Reschedule state in drawer
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState<boolean>(false);

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  useEffect(() => {
    if (selectedDrawerApt) setActiveApt(selectedDrawerApt);
  }, [selectedDrawerApt]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (serviceFilter !== 'ALL') queryParams.append('serviceId', serviceFilter);
      if (staffFilter !== 'ALL') queryParams.append('staffId', staffFilter);
      if (startDateFilter) queryParams.append('startDate', startDateFilter);
      if (endDateFilter) queryParams.append('endDate', endDateFilter);
      if (searchTerm) queryParams.append('search', searchTerm);

      const [aptsRes, srvRes, stfRes] = await Promise.all([
        apiFetch(`/api/v1/appointments?${queryParams.toString()}`),
        apiFetch('/api/v1/services'),
        apiFetch('/api/v1/staff'),
      ]);

      const [aptsJson, srvJson, stfJson] = await Promise.all([
        aptsRes.json(),
        srvRes.json(),
        stfRes.json(),
      ]);

      if (aptsJson.success) setAppointments(aptsJson.data);
      if (srvJson.success) setServices(srvJson.data);
      if (stfJson.success) setStaffList(stfJson.data);
    } catch (e) {
      toast('Failed to load appointments', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast, statusFilter, serviceFilter, staffFilter, startDateFilter, endDateFilter, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setServiceFilter('ALL');
    setStaffFilter('ALL');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/v1/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast(`Appointment marked as ${newStatus}`, 'success');
        loadData();
        if (activeApt?.id === id) {
          setActiveApt({ ...activeApt, status: newStatus as any });
        }
      }
    } catch (e) {
      toast('Failed to update status', 'error');
    }
  };

  useEffect(() => {
    if (!activeApt || !rescheduleDate) return;
    async function getRescheduleSlots() {
      try {
        const res = await apiFetch(
          `/api/v1/availability?date=${rescheduleDate}&serviceId=${activeApt!.serviceId}&staffId=${activeApt!.staffId}`
        );
        const json = await res.json();
        if (json.success) {
          setRescheduleSlots(json.data.slots);
        } else {
          setRescheduleSlots([]);
        }
      } catch (e) {
        setRescheduleSlots([]);
      }
    }
    getRescheduleSlots();
  }, [activeApt, rescheduleDate, apiFetch]);

  const handleConfirmReschedule = async () => {
    if (!activeApt || !selectedSlot) return;
    setIsRescheduling(true);
    try {
      const res = await apiFetch(`/api/v1/appointments/${activeApt.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ newStartAt: selectedSlot.startAt }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to reschedule');
      }

      toast('Appointment rescheduled successfully!', 'success');
      setShowRescheduleForm(false);
      setSelectedSlot(null);
      loadData();
      setActiveApt({ ...activeApt, startAt: selectedSlot.startAt, status: 'CONFIRMED' });
    } catch (e: any) {
      toast(e.message || 'Slot no longer available.', 'error');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!activeApt) return;
    setIsCancelling(true);
    try {
      const res = await apiFetch(`/api/v1/appointments/${activeApt.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason || 'Cancelled by admin' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to cancel');
      }

      toast('Appointment cancelled.', 'info');
      setShowCancelDialog(false);
      loadData();
      setActiveApt({ ...activeApt, status: 'CANCELLED', cancellationReason: cancelReason });
    } catch (e: any) {
      toast(e.message || 'Failed to cancel', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block mb-0.5">
            Booking Records
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Appointments</h2>
        </div>

        <button
          onClick={onNewAppointment}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Appointment</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
            <option value="PENDING">Pending</option>
          </select>

          {/* Service Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none"
          >
            <option value="ALL">All Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none"
          >
            <option value="ALL">All Specialists</option>
            {staffList.map((stf) => (
              <option key={stf.id} value={stf.id}>
                {stf.name}
              </option>
            ))}
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none"
          />

          {/* Reset button */}
          <button
            onClick={resetFilters}
            className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {/* Appointment Table (Zero-Pill Discipline) */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBFD] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-200/80">
              <tr>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Service</th>
                <th className="py-2.5 px-3">Specialist</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    Loading records from database...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No appointments match the selected filters.
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => {
                  const d = new Date(apt.startAt);
                  const dateStr = d.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeStr = d.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={apt.id}
                      onClick={() => setActiveApt(apt)}
                      className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${
                        activeApt?.id === apt.id ? 'bg-slate-50 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 block">{apt.customerName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{apt.customerEmail}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{apt.serviceName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{apt.staffName}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono tabular-nums">{dateStr}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono tabular-nums">{timeStr}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{apt.serviceDuration || 60}m</td>
                      <td className="py-2.5 px-3">
                        {/* Zero-Pill Unboxed Status */}
                        <span className="font-mono text-[11px] font-medium text-slate-700">
                          {apt.status === 'CONFIRMED' && '· Confirmed'}
                          {apt.status === 'COMPLETED' && '· Completed'}
                          {apt.status === 'CANCELLED' && '· Cancelled'}
                          {apt.status === 'NO_SHOW' && '· No Show'}
                          {apt.status === 'PENDING' && '· Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveApt(apt)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Appointment Details Drawer (~480px wide on desktop) */}
      {activeApt && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-white shadow-xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-150">
          <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-[#FAFBFD]">
            <div>
              <span className="text-[10px] font-mono text-slate-400 block">
                REFERENCE #{activeApt.id}
              </span>
              <h3 className="font-bold text-slate-900 text-sm leading-tight mt-0.5">
                Appointment Record
              </h3>
            </div>
            <button
              onClick={() => {
                setActiveApt(null);
                if (onCloseDrawer) onCloseDrawer();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {/* Status & Price */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded">
              <div>
                <span className="text-slate-400 text-[10px] font-mono uppercase block">Status</span>
                <span className="font-mono font-semibold text-xs text-slate-900 mt-0.5 block">
                  {activeApt.status}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] font-mono uppercase block">Fee Charged</span>
                <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">
                  ${activeApt.priceCharged}
                </span>
              </div>
            </div>

            {/* Client Info */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Client Information
              </span>
              <div className="p-3.5 bg-white border border-slate-200 rounded space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-900">{activeApt.customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeApt.customerEmail}</span>
                </div>
                {activeApt.customerPhone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeApt.customerPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Session Schedule */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Session Schedule
              </span>
              <div className="p-3.5 bg-white border border-slate-200 rounded space-y-2">
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Service</span>
                  <span className="font-semibold text-slate-900">{activeApt.serviceName}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Practitioner</span>
                  <span className="font-semibold text-slate-900">{activeApt.staffName}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Date</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {new Date(activeApt.startAt).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Interval</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {new Date(activeApt.startAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    -{' '}
                    {new Date(activeApt.endAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Notes */}
            {activeApt.customerNotes && (
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Client Notes
                </span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 italic">
                  "{activeApt.customerNotes}"
                </div>
              </div>
            )}

            {/* Reschedule inline drawer */}
            {showRescheduleForm && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs">Pick New Date & Slot</span>
                  <button
                    onClick={() => setShowRescheduleForm(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded"
                />

                {rescheduleSlots.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                    {rescheduleSlots.map((slot) => {
                      const isSel = selectedSlot?.startAt === slot.startAt;
                      return (
                        <button
                          key={slot.startAt}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-1.5 text-[11px] font-mono rounded border ${
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

                <button
                  disabled={!selectedSlot || isRescheduling}
                  onClick={handleConfirmReschedule}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded"
                >
                  {isRescheduling ? 'Updating...' : 'Save Rescheduled Time'}
                </button>
              </div>
            )}
          </div>

          {/* Drawer Actions Footer */}
          <div className="p-4 border-t border-slate-200 bg-[#FAFBFD] space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {activeApt.status !== 'COMPLETED' && activeApt.status !== 'CANCELLED' && (
                <button
                  onClick={() => handleUpdateStatus(activeApt.id, 'COMPLETED')}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Completed
                </button>
              )}

              {activeApt.status === 'CONFIRMED' && (
                <button
                  onClick={() => handleUpdateStatus(activeApt.id, 'NO_SHOW')}
                  className="py-1.5 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-medium text-xs transition-colors cursor-pointer"
                >
                  Mark No-Show
                </button>
              )}

              {activeApt.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    setShowRescheduleForm(true);
                    setRescheduleDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="py-1.5 px-3 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-medium text-xs transition-colors cursor-pointer"
                >
                  Reschedule
                </button>
              )}

              {activeApt.status !== 'CANCELLED' && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="py-1.5 px-3 border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-rose-700 rounded font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setActiveApt(null);
                if (onCloseDrawer) onCloseDrawer();
              }}
              className="w-full py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Cancel Appointment?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              This will update the appointment status to <strong>CANCELLED</strong> and release the specialist's slot immediately.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for cancellation
              </label>
              <input
                type="text"
                placeholder="Client requested, personal conflict, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
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
