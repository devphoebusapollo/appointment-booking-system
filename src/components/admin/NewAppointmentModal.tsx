import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Check,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Service, StaffProfile, TimeSlot, User as UserType } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [customers, setCustomers] = useState<UserType[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('new');
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('any');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadMeta() {
      try {
        const [srvRes, stfRes, custRes] = await Promise.all([
          apiFetch('/api/v1/services?activeOnly=true'),
          apiFetch('/api/v1/staff'),
          apiFetch('/api/v1/auth/personas'),
        ]);

        const [srvJson, stfJson, custJson] = await Promise.all([
          srvRes.json(),
          stfRes.json(),
          custRes.json(),
        ]);

        if (srvJson.success) {
          setServices(srvJson.data);
          if (srvJson.data.length > 0) setSelectedServiceId(srvJson.data[0].id);
        }
        if (stfJson.success) setStaffList(stfJson.data);
        if (custJson.success) {
          setCustomers(custJson.data.filter((u: UserType) => u.role === 'CUSTOMER'));
        }
      } catch (e) {
        toast('Failed to load booking metadata', 'error');
      }
    }

    loadMeta();
  }, [isOpen, apiFetch, toast]);

  // Load available slots
  useEffect(() => {
    if (!isOpen || !selectedServiceId || !selectedDate) return;

    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const staffParam = selectedStaffId === 'any' ? 'any' : selectedStaffId;
        const res = await apiFetch(
          `/api/v1/availability?date=${selectedDate}&serviceId=${selectedServiceId}&staffId=${staffParam}`
        );
        const json = await res.json();
        if (json.success) {
          setAvailableSlots(json.data.slots);
          setSelectedSlot(null);
        } else {
          setAvailableSlots([]);
        }
      } catch (e) {
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [isOpen, selectedServiceId, selectedStaffId, selectedDate, apiFetch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      toast('Please select an available time slot', 'error');
      return;
    }

    let customerIdToSend: string | undefined = undefined;
    let customerName = newCustName;
    let customerEmail = newCustEmail;
    let customerPhone = newCustPhone;

    if (selectedCustomerId !== 'new') {
      customerIdToSend = selectedCustomerId;
      const matched = customers.find((c) => c.id === selectedCustomerId);
      if (matched) {
        customerName = matched.name;
        customerEmail = matched.email;
        customerPhone = matched.phone || '';
      }
    } else {
      if (!newCustName.trim() || !newCustEmail.trim()) {
        toast('Please enter the customer name and email', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/appointments', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          staffId: selectedSlot.staffId,
          startAt: selectedSlot.startAt,
          customerNotes: notes,
          customerId: customerIdToSend,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to book appointment');
      }

      toast('Appointment scheduled successfully!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">New Appointment</h3>
            <p className="text-xs text-slate-500">
              Schedule a booking on behalf of a customer or walk-in client.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="new">+ Register New Customer / Walk-in</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>

          {selectedCustomerId === 'new' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                />
              </div>
            </div>
          )}

          {/* Service and Staff */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Service *</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (${s.price})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Specialist</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="any">Any Available</option>
                {staffList.map((stf) => (
                  <option key={stf.id} value={stf.id}>
                    {stf.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Appointment Date *
            </label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>

          {/* Slot Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Time Slot *
            </label>
            {loadingSlots ? (
              <div className="py-4 text-center text-slate-400">Loading available times...</div>
            ) : availableSlots.length === 0 ? (
              <div className="p-3 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-400">
                No slots open on this date.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                {availableSlots.map((slot) => {
                  const isSel = selectedSlot?.startAt === slot.startAt;
                  return (
                    <button
                      key={`${slot.startAt}_${slot.staffId}`}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-1.5 px-2 text-xs font-mono rounded border text-center transition-colors ${
                        isSel
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <span className="block font-semibold">{slot.time}</span>
                      <span
                        className={`text-[9px] truncate block font-sans ${
                          isSel ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {slot.staffName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Appointment Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requests or instructions..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedSlot}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-semibold shadow-xs"
            >
              {isSubmitting ? 'Reserving...' : 'Create Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
