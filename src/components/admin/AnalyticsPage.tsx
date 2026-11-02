import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  DollarSign,
  CalendarCheck,
  CheckCircle,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Appointment, Service, StaffProfile } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#0F172A',
  COMPLETED: '#475569',
  CANCELLED: '#CBD5E1',
  NO_SHOW: '#94A3B8',
  PENDING: '#64748B',
};

export const AnalyticsPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [aptsRes, srvRes, staffRes] = await Promise.all([
        apiFetch('/api/v1/appointments?limit=500'),
        apiFetch('/api/v1/services'),
        apiFetch('/api/v1/staff'),
      ]);

      const [aptsJson, srvJson, staffJson] = await Promise.all([
        aptsRes.json(),
        srvRes.json(),
        staffRes.json(),
      ]);

      if (aptsJson.success) setAppointments(aptsJson.data);
      if (srvJson.success) setServices(srvJson.data);
      if (staffJson.success) setStaffList(staffJson.data);
    } catch (e) {
      toast('Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Total revenue from completed & confirmed bookings
  const totalRevenue = appointments
    .filter((a) => a.status === 'COMPLETED' || a.status === 'CONFIRMED')
    .reduce((sum, a) => sum + Number(a.priceCharged || 0), 0);

  // Group by service
  const serviceCounts: Record<string, number> = {};
  for (const a of appointments) {
    const name = a.serviceName || 'Other';
    serviceCounts[name] = (serviceCounts[name] || 0) + 1;
  }
  const serviceChartData = Object.entries(serviceCounts).map(([name, count]) => ({
    name: name.length > 20 ? name.slice(0, 18) + '...' : name,
    bookings: count,
  }));

  // Group by staff
  const staffCounts: Record<string, number> = {};
  for (const a of appointments) {
    const name = a.staffName || 'Specialist';
    staffCounts[name] = (staffCounts[name] || 0) + 1;
  }
  const staffChartData = Object.entries(staffCounts).map(([name, count]) => ({
    name,
    bookings: count,
  }));

  // Group by status for Pie Chart
  const statusCounts: Record<string, number> = {};
  for (const a of appointments) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  }
  const statusChartData = Object.entries(statusCounts).map(([status, value]) => ({
    name: status,
    value,
  }));

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics & Reports</h2>
        <p className="text-xs text-slate-500 mt-1">
          Real database metrics calculating revenue, service popularity, and specialist utilization.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">
            Total Bookings Volume
          </span>
          <span className="text-2xl font-bold text-slate-900">{appointments.length}</span>
          <span className="block text-[11px] text-slate-400 mt-1">All time bookings recorded</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">
            Gross Estimated Revenue
          </span>
          <span className="text-2xl font-bold text-emerald-600">${totalRevenue.toFixed(2)}</span>
          <span className="block text-[11px] text-slate-400 mt-1">
            From confirmed and completed bookings
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Active Offerings</span>
          <span className="text-2xl font-bold text-blue-600">{services.length} Services</span>
          <span className="block text-[11px] text-slate-400 mt-1">
            Across {staffList.length} specialists
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments by Service */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-1">Bookings by Service</h3>
          <p className="text-xs text-slate-500 mb-6">Popularity across appointment offerings</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={120} />
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
                <Bar dataKey="bookings" fill="#0F172A" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Appointments by Specialist */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <h3 className="font-bold text-slate-900 text-sm mb-1">Specialist Workload</h3>
          <p className="text-xs text-slate-500 mb-6">Bookings assigned per team member</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
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
                <Bar dataKey="bookings" fill="#334155" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs lg:col-span-2">
          <h3 className="font-bold text-slate-900 text-sm mb-1">Status Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Ratio of confirmed, completed, and cancelled bookings</p>
          <div className="h-64 flex flex-col md:flex-row items-center justify-center">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {statusChartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={STATUS_COLORS[entry.name] || '#64748B'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4 justify-center text-xs">
              {statusChartData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[item.name] || '#64748B' }}
                  />
                  <span className="font-semibold text-slate-800">{item.name}:</span>
                  <span className="text-slate-500">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
