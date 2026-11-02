import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Plus,
  Clock,
  DollarSign,
  Users,
  Edit2,
  CheckCircle,
  XCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { Service, StaffProfile } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

export const ServicesPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [price, setPrice] = useState('100.00');
  const [isActive, setIsActive] = useState(true);
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [srvRes, stfRes] = await Promise.all([
        apiFetch('/api/v1/services'),
        apiFetch('/api/v1/staff'),
      ]);

      const [srvJson, stfJson] = await Promise.all([srvRes.json(), stfRes.json()]);

      if (srvJson.success) setServices(srvJson.data);
      if (stfJson.success) setStaffList(stfJson.data);
    } catch (e) {
      toast('Failed to load services', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditingService(null);
    setName('');
    setDescription('');
    setDurationMinutes('60');
    setPrice('120.00');
    setIsActive(true);
    setAssignedStaffIds(staffList.map((s) => s.id)); // Default assign all
    setShowModal(true);
  };

  const handleOpenEdit = (srv: Service) => {
    setEditingService(srv);
    setName(srv.name);
    setDescription(srv.description);
    setDurationMinutes(String(srv.durationMinutes));
    setPrice(String(srv.price));
    setIsActive(srv.isActive);
    setAssignedStaffIds(srv.assignedStaffIds || []);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Service name is required', 'error');
      return;
    }
    const durationNum = parseInt(durationMinutes);
    const priceNum = parseFloat(price);

    if (isNaN(durationNum) || durationNum <= 0) {
      toast('Duration must be a positive number of minutes', 'error');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      toast('Price must be a valid non-negative number', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingService) {
        const res = await apiFetch(`/api/v1/services/${editingService.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            description,
            durationMinutes: durationNum,
            price: priceNum,
            isActive,
            assignedStaffIds,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast('Service updated successfully!', 'success');
          setShowModal(false);
          loadData();
        }
      } else {
        const res = await apiFetch('/api/v1/services', {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            durationMinutes: durationNum,
            price: priceNum,
            isActive,
            assignedStaffIds,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast('Service created successfully!', 'success');
          setShowModal(false);
          loadData();
        }
      }
    } catch (err: any) {
      toast('Failed to save service', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (srv: Service) => {
    try {
      const res = await apiFetch(`/api/v1/services/${srv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !srv.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast(`Service marked as ${!srv.isActive ? 'Active' : 'Inactive'}`, 'info');
        loadData();
      }
    } catch (e) {
      toast('Failed to update service status', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Services</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage the services and treatments customers can book.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          + Add Service
        </button>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          No services defined. Add your first service above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-sm">{srv.name}</h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {srv.isActive ? '· Active' : '· Inactive'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                  {srv.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-600 pt-3 border-t border-slate-100 mt-3 font-mono">
                  <span>{srv.durationMinutes} mins</span>
                  <span className="font-bold text-slate-900">${srv.price}</span>
                  <span className="text-slate-400 ml-auto font-sans text-[11px]">
                    {srv.assignedStaffCount || 0} specialist(s)
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleToggleActive(srv)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    srv.isActive
                      ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  {srv.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleOpenEdit(srv)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingService ? 'Edit Service' : 'Create New Service'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aromatherapy Full Body Massage"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed breakdown of treatment benefits, technique, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price ($ USD) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="srvActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="srvActive" className="text-xs font-medium text-slate-700">
                  Active service (visible to customers in booking menu)
                </label>
              </div>

              {/* Assign staff */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Specialists ({assignedStaffIds.length})
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {staffList.map((stf) => {
                    const isChecked = assignedStaffIds.includes(stf.id);
                    return (
                      <label key={stf.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedStaffIds([...assignedStaffIds, stf.id]);
                            } else {
                              setAssignedStaffIds(assignedStaffIds.filter((id) => id !== stf.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{stf.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                >
                  {isSubmitting ? 'Saving...' : editingService ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
