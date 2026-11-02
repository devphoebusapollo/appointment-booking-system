import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Plus,
} from 'lucide-react';
import { User, Appointment } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

export const CustomersPage: React.FC<{ onBookForCustomer: () => void }> = ({
  onBookForCustomer,
}) => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [custRes, aptRes] = await Promise.all([
        apiFetch('/api/v1/auth/personas'),
        apiFetch('/api/v1/appointments?limit=500'),
      ]);

      const [custJson, aptJson] = await Promise.all([custRes.json(), aptRes.json()]);

      if (custJson.success) {
        setCustomers(custJson.data.filter((u: User) => u.role === 'CUSTOMER'));
      }
      if (aptJson.success) {
        setAppointments(aptJson.data);
      }
    } catch (e) {
      toast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Customers Directory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse registered clients, their lifetime booking history, and contact information.
          </p>
        </div>

        <button
          onClick={onBookForCustomer}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          + New Appointment
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Customer Name</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4">Phone</th>
              <th className="py-3.5 px-4">Total Bookings</th>
              <th className="py-3.5 px-4">Lifetime Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Loading customer records...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No customers found.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((cust) => {
                const userApts = appointments.filter((a) => a.customerId === cust.id);
                const totalSpent = userApts
                  .filter((a) => a.status !== 'CANCELLED')
                  .reduce((acc, a) => acc + Number(a.priceCharged || 0), 0);

                return (
                  <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                          {cust.avatarUrl ? (
                            <img
                              src={cust.avatarUrl}
                              alt={cust.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-blue-700 bg-blue-100">
                              {cust.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-slate-900">{cust.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{cust.email}</td>
                    <td className="py-3.5 px-4 text-slate-600">{cust.phone || '—'}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800">
                      {userApts.length} booking{userApts.length === 1 ? '' : 's'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                      ${totalSpent.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
