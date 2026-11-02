import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
  X,
  Plus,
} from 'lucide-react';
import { StaffProfile, Service } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';
import { DailyRosterView } from './DailyRosterView.tsx';

interface StaffPageProps {
  onViewSchedule?: (staffId: string) => void;
}

export const StaffPage: React.FC<StaffPageProps> = ({ onViewSchedule }) => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'roster' | 'directory'>('roster');
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New staff modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffTitle, setNewStaffTitle] = useState('');
  const [newStaffBio, setNewStaffBio] = useState('');
  const [newStaffServices, setNewStaffServices] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit staff modal
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [staffRes, srvRes] = await Promise.all([
        apiFetch('/api/v1/staff'),
        apiFetch('/api/v1/services'),
      ]);

      const [staffJson, srvJson] = await Promise.all([
        staffRes.json(),
        srvRes.json(),
      ]);

      if (staffJson.success) setStaffList(staffJson.data);
      if (srvJson.success) setServices(srvJson.data);
    } catch (e) {
      toast('Failed to load staff profiles', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) {
      toast('Name and email are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: newStaffName,
          email: newStaffEmail,
          phone: newStaffPhone,
          title: newStaffTitle || 'Specialist',
          bio: newStaffBio,
          serviceIds: newStaffServices,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create staff');
      }

      toast('Staff member created successfully!', 'success');
      setShowAddModal(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffTitle('');
      setNewStaffBio('');
      setNewStaffServices([]);
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (stf: StaffProfile) => {
    setEditingStaff(stf);
    setEditTitle(stf.title);
    setEditBio(stf.bio || '');
    setEditActive(stf.isActive);
    setEditServiceIds(stf.services?.map((s) => s.id) || []);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    try {
      const res = await apiFetch(`/api/v1/staff/${editingStaff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle,
          bio: editBio,
          isActive: editActive,
          serviceIds: editServiceIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast('Staff details updated successfully!', 'success');
        setEditingStaff(null);
        loadData();
      }
    } catch (err: any) {
      toast('Failed to update staff member', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Specialists & Availability</h2>
          <p className="text-xs text-slate-500 mt-1">
            Indicate available specialists for specific dates, manage working schedules, and team directory.
          </p>
        </div>

        {activeTab === 'directory' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            + Add Staff Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'roster'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Daily Availability Roster
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'directory'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Specialist Directory ({staffList.length})
        </button>
      </div>

      {/* Tab 1: Daily Roster */}
      {activeTab === 'roster' && <DailyRosterView />}

      {/* Tab 2: Specialist Directory Grid */}
      {activeTab === 'directory' && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : staffList.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
              No staff members found. Add your first team member above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map((stf) => (
            <div
              key={stf.id}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-5"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shrink-0">
                      {stf.avatarUrl ? (
                        <img
                          src={stf.avatarUrl}
                          alt={stf.name || 'Staff'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-sm text-blue-700 bg-blue-100">
                          {stf.name ? stf.name.slice(0, 2).toUpperCase() : 'ST'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{stf.name}</h3>
                      <p className="text-xs text-slate-600 font-medium">{stf.title}</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    {stf.isActive ? '· Active' : '· Inactive'}
                  </span>
                </div>

                {stf.bio && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {stf.bio}
                  </p>
                )}

                <div className="space-y-1 text-xs text-slate-600 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{stf.email}</span>
                  </div>
                  {stf.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{stf.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono tabular-nums">{stf.upcomingAppointmentsCount || 0} upcoming booking(s)</span>
                  </div>
                </div>

                {/* Assigned Services */}
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Assigned Services
                  </span>
                  <div>
                    {stf.services && stf.services.length > 0 ? (
                      stf.services.map((s) => s.name).join(' · ')
                    ) : (
                      <span className="text-slate-400 italic">No services assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                {onViewSchedule && (
                  <button
                    onClick={() => onViewSchedule(stf.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                  >
                    View Schedule
                  </button>
                )}
                <button
                  onClick={() => handleOpenEdit(stf)}
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
    </>
  )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Add New Staff Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Dr. Julian Cole"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="julian@bookflow.io"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title / Specialty
                  </label>
                  <input
                    type="text"
                    value={newStaffTitle}
                    onChange={(e) => setNewStaffTitle(e.target.value)}
                    placeholder="Lead Aesthetician"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Professional Bio
                </label>
                <textarea
                  rows={2}
                  value={newStaffBio}
                  onChange={(e) => setNewStaffBio(e.target.value)}
                  placeholder="Qualifications, experience, specialties..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Service Assignments */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assign Services
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {services.map((srv) => {
                    const isChecked = newStaffServices.includes(srv.id);
                    return (
                      <label key={srv.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewStaffServices([...newStaffServices, srv.id]);
                            } else {
                              setNewStaffServices(newStaffServices.filter((id) => id !== srv.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{srv.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                >
                  {isSubmitting ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Edit Staff: {editingStaff.name}
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bio</label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="activeToggle" className="text-xs font-medium text-slate-700">
                  Active staff member (visible to booking customers)
                </label>
              </div>

              {/* Service Assignments */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Services
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {services.map((srv) => {
                    const isChecked = editServiceIds.includes(srv.id);
                    return (
                      <label key={srv.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditServiceIds([...editServiceIds, srv.id]);
                            } else {
                              setEditServiceIds(editServiceIds.filter((id) => id !== srv.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{srv.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
