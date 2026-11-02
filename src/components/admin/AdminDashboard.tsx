import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  CalendarCheck,
  Users,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Search,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { OverviewMetrics, Appointment } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface AdminDashboardProps {
  onNewAppointment: () => void;
  onNavigateTab: (tab: string) => void;
  onViewAppointmentDetails: (apt: Appointment) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNewAppointment,
  onNavigateTab,
  onViewAppointmentDetails,
}) => {
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tableStatus, setTableStatus] = useState<string>('ALL');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, aptsRes] = await Promise.all([
        apiFetch('/api/v1/admin/overview'),
        apiFetch('/api/v1/appointments?limit=10'),
      ]);

      const [metricsJson, aptsJson] = await Promise.all([
        metricsRes.json(),
        aptsRes.json(),
      ]);

      if (metricsJson.success) setMetrics(metricsJson.data);
      if (aptsJson.success) setRecentAppointments(aptsJson.data);
    } catch (e) {
      toast('Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const kpis = metrics?.kpis;

  const filteredRecent = recentAppointments.filter((apt) => {
    const matchesSearch =
      !tableSearch ||
      apt.customerName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      apt.serviceName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      apt.staffName?.toLowerCase().includes(tableSearch.toLowerCase());
    const matchesStatus = tableStatus === 'ALL' || apt.status === tableStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 max-w-[1440px] mx-auto space-y-8">
      {/* Editorial Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block mb-0.5">
            Operations Console
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Overview Dashboard
          </h2>
        </div>

        <button
          onClick={onNewAppointment}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Appointment</span>
        </button>
      </div>

      {/* Distinctive Integrated KPI Strip with Hairline Dividers (No Floating Bubble Cards) */}
      <div className="bg-white border border-slate-200/90 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold block">
            Total Appointments
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {kpis?.totalAppointments ?? 0}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {kpis && kpis.changeVersusPrevious >= 0 ? (
              <span className="text-emerald-700 font-medium">+{kpis.changeVersusPrevious}%</span>
            ) : (
              <span className="text-rose-700 font-medium">{kpis?.changeVersusPrevious}%</span>
            )}{' '}
            <span>vs prior 7d</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold block">
            Today's Schedule
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {kpis?.todayAppointments ?? 0}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            <span>{kpis?.todayDateStr || 'Today'}</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold block">
            Active Clients
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {kpis?.activeCustomers ?? 0}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            <span>Unique client accounts</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 flex flex-col justify-between">
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold block">
            Completion Rate
          </span>
          <div className="my-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {kpis?.completionRate ?? 100}%
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            <span>Past eligible bookings</span>
          </div>
        </div>
      </div>

      {/* Main Content: Left 66% Chart + Right 34% Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monochromatic / Deep Slate Appointment Activity (66%) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">7-Day Appointment Distribution</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily volume of confirmed, completed, and cancelled bookings.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Past 7 Days + 3d Projection</span>
          </div>

          <div className="h-64 w-full">
            {metrics?.chartData && metrics.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.chartData} barGap={3}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="confirmed" name="Confirmed" fill="#0F172A" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#475569" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="#CBD5E1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading analytics data...
              </div>
            )}
          </div>
        </div>

        {/* Right: Upcoming Schedule (34%) */}
        <div className="bg-white border border-slate-200/90 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Next Upcoming</h3>
              <button
                onClick={() => onNavigateTab('appointments')}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
              >
                View all &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {metrics?.upcomingAppointments && metrics.upcomingAppointments.length > 0 ? (
                metrics.upcomingAppointments.map((apt) => {
                  const dateObj = new Date(apt.startAt);
                  const timeStr = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const dateStr = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={apt.id}
                      className="py-2.5 px-3 border border-slate-100 hover:border-slate-200 rounded flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 truncate">
                          {apt.customerName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {apt.serviceName}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          with {apt.staffName}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono text-[11px]">
                        <span className="font-semibold text-slate-800 block">{dateStr}</span>
                        <span className="text-slate-400">{timeStr}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No upcoming appointments scheduled today.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Dense, Typographic Activity Table */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Appointments</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of customer bookings from PostgreSQL.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter bookings..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-400"
              />
            </div>

            <select
              value={tableStatus}
              onChange={(e) => setTableStatus(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded text-slate-700 bg-white focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Dense Data Table (Zero-Pill Discipline) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFBFD] text-slate-400 uppercase font-mono text-[10px] border-y border-slate-200/80">
              <tr>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Service</th>
                <th className="py-2.5 px-3">Specialist</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecent.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching appointments found.
                  </td>
                </tr>
              ) : (
                filteredRecent.map((apt) => {
                  const d = new Date(apt.startAt);
                  const dateStr = d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeStr = d.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 block">{apt.customerName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{apt.customerEmail}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{apt.serviceName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{apt.staffName}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono tabular-nums">{dateStr}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono tabular-nums">{timeStr}</td>
                      <td className="py-2.5 px-3">
                        {/* Zero-Pill: Clean unboxed text status with typographic indicator */}
                        <span className="font-mono text-[11px] font-medium text-slate-700">
                          {apt.status === 'CONFIRMED' && '· Confirmed'}
                          {apt.status === 'COMPLETED' && '· Completed'}
                          {apt.status === 'CANCELLED' && '· Cancelled'}
                          {apt.status === 'NO_SHOW' && '· No Show'}
                          {apt.status === 'PENDING' && '· Pending'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onViewAppointmentDetails(apt)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                        >
                          View
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
    </div>
  );
};
