import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Clock,
  Calendar,
  Save,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { BusinessSettings } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

export const SettingsPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [minNoticeHours, setMinNoticeHours] = useState('2');
  const [maxAdvanceDays, setMaxAdvanceDays] = useState('60');
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState('30');
  const [policyText, setPolicyText] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [setRes, notifRes] = await Promise.all([
        apiFetch('/api/v1/settings'),
        apiFetch('/api/v1/notifications'),
      ]);

      const [setJson, notifJson] = await Promise.all([setRes.json(), notifRes.json()]);

      if (setJson.success && setJson.data) {
        const s = setJson.data;
        setSettings(s);
        setBusinessName(s.businessName);
        setTimezone(s.timezone);
        setEmail(s.email);
        setPhone(s.phone);
        setAddress(s.address);
        setMinNoticeHours(String(s.minNoticeHours));
        setMaxAdvanceDays(String(s.maxAdvanceDays));
        setSlotIntervalMinutes(String(s.slotIntervalMinutes));
        setPolicyText(s.policyText);
      }
      if (notifJson.success) {
        setNotifications(notifJson.data);
      }
    } catch (e) {
      toast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/v1/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          businessName,
          timezone,
          email,
          phone,
          address,
          minNoticeHours: parseInt(minNoticeHours) || 2,
          maxAdvanceDays: parseInt(maxAdvanceDays) || 60,
          slotIntervalMinutes: parseInt(slotIntervalMinutes) || 30,
          policyText,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast('Business settings updated successfully!', 'success');
        loadData();
      }
    } catch (e) {
      toast('Failed to update business settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Business Settings</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure business profile details, booking window policies, and inspect the asynchronous notification outbox.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Settings Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Company Profile</h3>
              <p className="text-xs text-slate-500 mb-4">
                These details are displayed on the public customer booking portal and emails.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Time Zone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver">America/Denver (MST/MDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Asia/Manila">Asia/Manila (PHT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Address / Studio Location
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm mb-1">Booking & Scheduling Rules</h3>
              <p className="text-xs text-slate-500 mb-4">
                Control advance notice requirements, booking window limits, and grid increments.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Notice (Hours)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minNoticeHours}
                    onChange={(e) => setMinNoticeHours(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                  <span className="text-[10px] text-slate-400">Prevent last-minute bookings</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Advance Window (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maxAdvanceDays}
                    onChange={(e) => setMaxAdvanceDays(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                  <span className="text-[10px] text-slate-400">How far in advance clients book</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slot Interval (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={slotIntervalMinutes}
                    onChange={(e) => setSlotIntervalMinutes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Step increment for time picker</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm mb-1">Cancellation & Terms Policy</h3>
              <p className="text-xs text-slate-500 mb-4">
                Displayed to customers before confirming their reservation.
              </p>
              <textarea
                rows={3}
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Notification Outbox Audit */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4 text-slate-800" />
              <h3 className="font-semibold text-slate-900 text-sm">Notification Outbox</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Real-time audit log of asynchronous notifications dispatched by the booking engine.
            </p>

            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No notifications logged yet.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-slate-900 uppercase tracking-wider font-semibold">
                        {n.type}
                      </span>
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {n.status}
                      </span>
                    </div>
                    <div className="font-medium text-slate-800 text-[11px] truncate">
                      {n.subject}
                    </div>
                    <div className="text-[10px] text-slate-500">To: {n.recipient}</div>
                    <div className="text-[9px] font-mono text-slate-400 tabular-nums">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
