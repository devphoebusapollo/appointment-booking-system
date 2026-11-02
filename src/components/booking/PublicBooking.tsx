import React, { useState, useEffect } from 'react';
import {
  Clock,
  User as UserIcon,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck,
  ArrowRight,
} from 'lucide-react';
import { Service, StaffProfile, TimeSlot, AvailableStaff, BusinessSettings } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';
import { getEffectiveAvatarUrl, getDefaultAvatarByGender } from '../../utils/avatar.ts';

interface PublicBookingProps {
  onViewAppointments?: () => void;
}

export const PublicBooking: React.FC<PublicBookingProps> = ({ onViewAppointments }) => {
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [loadingServices, setLoadingServices] = useState<boolean>(true);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // Selected booking state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | 'any' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [availableSpecialistsForDate, setAvailableSpecialistsForDate] = useState<AvailableStaff[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Form details
  const [customerName, setCustomerName] = useState<string>(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState<string>(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState<string>(user?.phone || '');
  const [notes, setNotes] = useState<string>('');
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // Month navigation for date picker
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  // Fetch initial services & staff
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingServices(true);
        const [srvRes, stfRes, setRes] = await Promise.all([
          apiFetch('/api/v1/services?activeOnly=true'),
          apiFetch('/api/v1/staff'),
          apiFetch('/api/v1/settings'),
        ]);

        const [srvJson, stfJson, setJson] = await Promise.all([
          srvRes.json(),
          stfRes.json(),
          setRes.json(),
        ]);

        if (srvJson.success) setServices(srvJson.data);
        if (stfJson.success) setStaffList(stfJson.data.filter((s: StaffProfile) => s.isActive));
        if (setJson.success) setSettings(setJson.data);
      } catch (err) {
        toast('Failed to load services. Please retry.', 'error');
      } finally {
        setLoadingServices(false);
      }
    }
    loadInitialData();
  }, [apiFetch, toast]);

  // Pre-fill user details if logged in
  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.name);
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    }
  }, [user]);

  // Fetch slots whenever service or date changes
  useEffect(() => {
    if (!selectedService || !selectedDate) return;

    const currentServiceId = selectedService.id;

    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const res = await apiFetch(
          `/api/v1/availability?date=${selectedDate}&serviceId=${currentServiceId}`
        );
        const json = await res.json();
        if (json.success) {
          setAvailableSlots(json.data.slots);
          setAvailableSpecialistsForDate(json.data.availableSpecialistsForDate || []);
          if (
            selectedSlot &&
            !json.data.slots.some((s: TimeSlot) => s.startAt === selectedSlot.startAt)
          ) {
            setSelectedSlot(null);
          }
        } else {
          setAvailableSlots([]);
          setAvailableSpecialistsForDate([]);
        }
      } catch (e) {
        setAvailableSlots([]);
        setAvailableSpecialistsForDate([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [selectedService, selectedDate, apiFetch]);

  // Handlers
  const handleSelectService = (srv: Service) => {
    setSelectedService(srv);
    setSelectedSlot(null);
    setSelectedStaff(null);
    setStep(2);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    // If only one specialist available at this time slot, default select them
    if (slot.availableStaff && slot.availableStaff.length === 1) {
      const st = slot.availableStaff[0];
      setSelectedStaff({
        id: st.id,
        userId: '',
        title: st.title || 'Specialist',
        timezone: '',
        isActive: true,
        name: st.name,
        avatarUrl: st.avatarUrl,
      });
    } else {
      setSelectedStaff('any');
    }
    setStep(3);
  };

  const handleSelectStaff = (staff: StaffProfile | AvailableStaff | 'any') => {
    if (staff === 'any') {
      setSelectedStaff('any');
    } else {
      setSelectedStaff({
        id: staff.id,
        userId: '',
        title: staff.title || 'Specialist',
        timezone: '',
        isActive: true,
        name: staff.name,
        avatarUrl: staff.avatarUrl,
      });
      if (selectedSlot) {
        setSelectedSlot({
          ...selectedSlot,
          staffId: staff.id,
          staffName: staff.name || selectedSlot.staffName,
        });
      }
    }
    setStep(4);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedSlot) {
      toast('Please select a valid service and time slot', 'error');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      toast('Please enter your name and email address', 'error');
      return;
    }
    if (!policyAccepted) {
      toast('Please accept the booking policies to proceed', 'error');
      return;
    }

    const assignedStaffId =
      selectedStaff && selectedStaff !== 'any'
        ? selectedStaff.id
        : selectedSlot.staffId;

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/appointments', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedService.id,
          staffId: assignedStaffId,
          startAt: selectedSlot.startAt,
          customerNotes: notes,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to confirm appointment');
      }

      setConfirmedBooking(json.data);
      setStep(5);
      toast('Appointment confirmed successfully!', 'success');
    } catch (err: any) {
      toast(err.message || 'Time slot is no longer available.', 'error');
      if (err.message?.includes('no longer available') || err.message?.includes('taken')) {
        setStep(2);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedSlot(null);
    setConfirmedBooking(null);
    setStep(1);
  };

  // Generate calendar days
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dayStr < todayStr;
      const isSelected = selectedDate === dayStr;

      days.push(
        <button
          key={dayStr}
          type="button"
          disabled={isPast}
          onClick={() => {
            setSelectedDate(dayStr);
            setSelectedSlot(null);
          }}
          className={`h-8 w-8 rounded text-xs font-mono transition-colors ${
            isSelected
              ? 'bg-slate-900 text-white font-semibold'
              : isPast
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Main Studio Appointment Canvas */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        {/* Left Atelier Context Pane (34%) */}
        <div className="w-full md:w-[34%] bg-[#FAFBFD] p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Studio Identity */}
            <div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block mb-1">
                Studio Appointment Atelier
              </span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {settings?.businessName || 'BookFlow Studio'}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Direct booking for clinical treatments, restorative therapies, and personal consultations.
              </p>
            </div>

            {/* Studio Location & Contacts */}
            <div className="space-y-2 pt-4 border-t border-slate-200/70 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{settings?.address || '100 Market St, Suite 400, San Francisco, CA'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{settings?.email || 'contact@bookflow.io'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{settings?.phone || '+1 (555) 234-5678'}</span>
              </div>
            </div>

            {/* Live Selections Summary */}
            {(selectedService || selectedStaff || selectedSlot) && (
              <div className="pt-4 border-t border-slate-200/70 space-y-3">
                <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase block">
                  Current Selection
                </span>

                {selectedService && (
                  <div className="text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-slate-900">{selectedService.name}</span>
                      <span className="font-mono font-bold text-slate-900">
                        ${selectedService.price}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedService.durationMinutes} min session
                    </span>
                  </div>
                )}

                {selectedStaff && (
                  <div className="text-xs text-slate-600 pt-1">
                    <span className="text-slate-400">Practitioner: </span>
                    <span className="font-medium text-slate-900">
                      {selectedStaff === 'any' ? 'Any Qualified Specialist' : selectedStaff.name}
                    </span>
                  </div>
                )}

                {selectedSlot && (
                  <div className="text-xs text-slate-600 pt-1">
                    <span className="text-slate-400">Scheduled: </span>
                    <span className="font-mono font-medium text-slate-900">
                      {selectedDate} · {selectedSlot.time}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cancellation Notice */}
          <div className="pt-6 border-t border-slate-200/70 text-[11px] text-slate-500 leading-relaxed">
            {settings?.policyText ||
              'Rescheduling and cancellations accepted up to 2 hours prior to scheduled start.'}
          </div>
        </div>

        {/* Right Interaction Pane (66%) */}
        <div className="w-full md:w-[66%] p-6 md:p-8 flex flex-col justify-between">
          <div>
            {/* Stepper: Clean, Quiet Unboxed Editorial Navigation */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 text-xs">
              {[
                { num: 1, label: '01 Service' },
                { num: 2, label: '02 Schedule' },
                { num: 3, label: '03 Specialist' },
                { num: 4, label: '04 Details' },
                { num: 5, label: '05 Voucher' },
              ].map((s) => {
                const isCurrent = step === s.num;
                const isCompleted = step > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (isCompleted) setStep(s.num);
                    }}
                    className={`font-mono text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'text-slate-900 font-semibold'
                        : isCompleted
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-300 cursor-default'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* STEP 1: CHOOSE SERVICE */}
            {step === 1 && (
              <div>
                <div className="mb-5">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Select a Service
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose your appointment type to check practitioner availability.
                  </p>
                </div>

                {loadingServices ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-16 bg-slate-50 rounded border border-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No services are currently open for booking.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border-y border-slate-100">
                    {services.map((srv) => {
                      const isSelected = selectedService?.id === srv.id;
                      return (
                        <div
                          key={srv.id}
                          onClick={() => handleSelectService(srv)}
                          className={`py-4 px-3 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-slate-50/80 font-medium'
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-900 text-sm">{srv.name}</h4>
                              <span className="text-[11px] font-mono text-slate-400">
                                {srv.durationMinutes}m
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                              {srv.description}
                            </p>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                              ${srv.price}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SCHEDULE DATE & TIME */}
            {step === 2 && (
              <div>
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Select Date & Time
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Times calculated in <strong>{settings?.timezone || 'America/New_York (EST)'}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-mono text-slate-500 hover:text-slate-900 self-start sm:self-auto cursor-pointer"
                  >
                    ← Change Service
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Left Column: Calendar */}
                  <div className="p-3 border border-slate-200 rounded-md bg-white">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="font-bold text-xs text-slate-900">
                        {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const prev = new Date(calendarMonth);
                            prev.setMonth(prev.getMonth() - 1);
                            setCalendarMonth(prev);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Date(calendarMonth);
                            next.setMonth(next.getMonth() + 1);
                            setCalendarMonth(next);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-400 mb-1">
                      <span>Su</span>
                      <span>Mo</span>
                      <span>Tu</span>
                      <span>We</span>
                      <span>Th</span>
                      <span>Fr</span>
                      <span>Sa</span>
                    </div>

                    <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
                  </div>

                  {/* Right Column: Time Slots */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-900">
                        Available on {selectedDate}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {availableSlots.length} slot{availableSlots.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Specialists available on this date */}
                    <div className="mb-3 text-[11px] text-slate-500 font-mono">
                      {availableSpecialistsForDate.length > 0 ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-slate-400">On duty:</span>
                          {availableSpecialistsForDate.map((s) => (
                            <span key={s.id} className="text-slate-800 font-sans font-medium">
                              · {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-rose-600">No specialists on duty for this date</span>
                      )}
                    </div>

                    {loadingSlots ? (
                      <div className="grid grid-cols-2 gap-2 py-4">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <div key={n} className="h-10 bg-slate-100 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded p-6 text-center text-xs text-slate-500">
                        No available slots on this date. Specialists may be off duty or fully booked. Please select another date.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {availableSlots.map((slot) => {
                          const isSelected = selectedSlot?.startAt === slot.startAt;
                          const staffCount = slot.availableStaff?.length || 1;
                          return (
                            <button
                              key={`${slot.startAt}_${slot.staffId}`}
                              type="button"
                              onClick={() => handleSelectSlot(slot)}
                              className={`py-2 px-3 rounded text-xs font-mono transition-colors border text-left cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              <span className="block font-bold">{slot.time}</span>
                              <span
                                className={`text-[10px] truncate block font-sans ${
                                  isSelected ? 'text-slate-300' : 'text-slate-500'
                                }`}
                              >
                                {staffCount} specialist{staffCount === 1 ? '' : 's'} available
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: CHOOSE AVAILABLE SPECIALIST */}
            {step === 3 && selectedSlot && (
              <div>
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Select Available Specialist
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Showing only specialists available on{' '}
                      <strong>{selectedDate}</strong> at <strong>{selectedSlot.time}</strong> for{' '}
                      <strong>{selectedService?.name}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-mono text-slate-500 hover:text-slate-900 self-start sm:self-auto cursor-pointer"
                  >
                    ← Change Date/Time
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border-y border-slate-100">
                  {/* Any Qualified Specialist Option */}
                  <div
                    onClick={() => handleSelectStaff('any')}
                    className={`py-3.5 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                      selectedStaff === 'any' ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        Any Qualified Specialist
                      </div>
                      <span className="text-xs text-slate-500">
                        Assign to any available specialist at {selectedSlot.time}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* Filtered list: ONLY specialists available at this date & time */}
                  {selectedSlot.availableStaff && selectedSlot.availableStaff.length > 0 ? (
                    selectedSlot.availableStaff.map((stf) => {
                      const isSelected =
                        typeof selectedStaff === 'object' && selectedStaff?.id === stf.id;
                      return (
                        <div
                          key={stf.id}
                          onClick={() => handleSelectStaff(stf)}
                          className={`py-3.5 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                              <img
                                src={getEffectiveAvatarUrl(stf.avatarUrl, stf.gender, stf.name)}
                                alt={stf.name || 'Practitioner'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = getDefaultAvatarByGender(stf.gender, stf.name);
                                }}
                              />
                            </div>
                            <div className="truncate">
                              <h4 className="font-semibold text-slate-900 text-sm truncate">
                                {stf.name}
                              </h4>
                              <span className="text-xs text-slate-500 truncate block">
                                {stf.title || 'Specialist'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-emerald-700 font-medium hidden sm:inline">
                              · Available at {selectedSlot.time}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No specialists are available for this specific slot.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: CONTACT & DETAILS */}
            {step === 4 && (
              <form onSubmit={handleConfirmBooking} className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Confirm Your Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your reservation details and booking receipt will be sent to your email.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Notes for Specialist (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Specific requests, allergies, or preferences..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
                  />
                </div>

                {/* Terms checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    required
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                    className="mt-0.5 rounded text-slate-900 focus:ring-slate-900 border-slate-300"
                  />
                  <span className="text-xs text-slate-600">
                    I agree to the studio appointment policy. Cancellations accepted up to 2 hours prior.
                  </span>
                </label>

                {/* Summary bar */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 block">Total Due Upon Arrival</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedService?.durationMinutes} min session
                    </span>
                  </div>
                  <span className="text-lg font-mono font-bold text-slate-900">
                    ${selectedService?.price}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Reserving slot...' : 'Confirm Appointment'}
                </button>
              </form>
            )}

            {/* STEP 5: CONFIRMATION VOUCHER */}
            {step === 5 && (
              <div className="py-6">
                <div className="border border-slate-200 rounded-lg p-6 bg-[#FAFBFD] space-y-4 max-w-md mx-auto">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase block">
                        Booking Voucher
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">Appointment Confirmed</h4>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-900">
                      #{confirmedBooking?.id || 'CONFIRMED'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Service</span>
                      <span className="font-semibold text-slate-900">
                        {confirmedBooking?.serviceName || selectedService?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Practitioner</span>
                      <span className="font-semibold text-slate-900">
                        {confirmedBooking?.staffName || selectedSlot?.staffName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date & Time</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {selectedDate} · {selectedSlot?.time}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Price</span>
                      <span className="font-mono font-bold text-slate-900">
                        ${selectedService?.price}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-500">
                    A confirmation dispatch has been recorded for <strong>{customerEmail}</strong>.
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mt-6">
                  {onViewAppointments && (
                    <button
                      onClick={onViewAppointments}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-colors"
                    >
                      View My Bookings
                    </button>
                  )}
                  <button
                    onClick={resetBooking}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold transition-colors"
                  >
                    Book Another
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Back Navigation */}
          {step > 1 && step < 5 && (
            <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 hover:text-slate-900 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous Step
              </button>
              <span className="font-mono">Step {step} of 4</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
