import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Edit2,
  X,
  Camera,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  UserCheck,
} from 'lucide-react';
import { StaffProfile, Service } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';
import { DailyRosterView } from './DailyRosterView.tsx';
import {
  getEffectiveAvatarUrl,
  getDefaultAvatarByGender,
  PRESET_AVATARS,
  GenderType,
} from '../../utils/avatar.ts';

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

  // New staff modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffTitle, setNewStaffTitle] = useState('');
  const [newStaffBio, setNewStaffBio] = useState('');
  const [newStaffGender, setNewStaffGender] = useState<GenderType>('female');
  const [newStaffAvatarUrl, setNewStaffAvatarUrl] = useState('');
  const [newStaffServices, setNewStaffServices] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit staff modal state
  const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGender, setEditGender] = useState<GenderType>('female');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);

  // File input refs
  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Image file size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (isEdit) {
        setEditAvatarUrl(dataUrl);
      } else {
        setNewStaffAvatarUrl(dataUrl);
      }
      toast('Profile picture updated!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) {
      toast('Name and email are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const avatarToSave = newStaffAvatarUrl.trim() || getDefaultAvatarByGender(newStaffGender, newStaffName);

      const res = await apiFetch('/api/v1/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: newStaffName,
          email: newStaffEmail,
          phone: newStaffPhone,
          title: newStaffTitle || 'Specialist',
          bio: newStaffBio,
          gender: newStaffGender,
          avatarUrl: avatarToSave,
          serviceIds: newStaffServices,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create staff member');
      }

      toast('Staff member created successfully!', 'success');
      setShowAddModal(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffTitle('');
      setNewStaffBio('');
      setNewStaffGender('female');
      setNewStaffAvatarUrl('');
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
    setEditName(stf.name || '');
    setEditPhone(stf.phone || '');
    setEditTitle(stf.title);
    setEditBio(stf.bio || '');
    const g = (stf.gender as GenderType) || (stf.title?.toLowerCase().includes('sarah') || stf.name?.toLowerCase().includes('sarah') || stf.name?.toLowerCase().includes('elena') ? 'female' : 'male');
    setEditGender(g);
    setEditAvatarUrl(stf.avatarUrl || '');
    setEditActive(stf.isActive);
    setEditServiceIds(stf.services?.map((s) => s.id) || []);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    try {
      const avatarToSave = editAvatarUrl.trim() || getDefaultAvatarByGender(editGender, editName);

      const res = await apiFetch(`/api/v1/staff/${editingStaff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          title: editTitle,
          bio: editBio,
          gender: editGender,
          avatarUrl: avatarToSave,
          isActive: editActive,
          serviceIds: editServiceIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast('Profile and specialist avatar updated successfully!', 'success');
        setEditingStaff(null);
        loadData();
      } else {
        toast(json.error?.message || 'Failed to update staff member', 'error');
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
            Manage specialist availability, customize profile pictures based on gender, and update staff details.
          </p>
        </div>

        {activeTab === 'directory' && (
          <button
            onClick={() => {
              setNewStaffGender('female');
              setNewStaffAvatarUrl(getDefaultAvatarByGender('female'));
              setShowAddModal(true);
            }}
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
              {staffList.map((stf) => {
                const effectiveAvatar = getEffectiveAvatarUrl(stf.avatarUrl, stf.gender, stf.name);
                return (
                  <div
                    key={stf.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-5"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3.5">
                          <div className="relative w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-300 shrink-0">
                            <img
                              src={effectiveAvatar}
                              alt={stf.name || 'Specialist'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback seamlessly to gender avatar if custom URL fails to load
                                e.currentTarget.src = getDefaultAvatarByGender(stf.gender, stf.name);
                              }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-sm">{stf.name}</h3>
                              {stf.gender && (
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                  {stf.gender}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 font-medium">{stf.title}</p>
                          </div>
                        </div>

                        <span className={`text-[11px] font-mono ${stf.isActive ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          {stf.isActive ? '· Active' : '· Inactive'}
                        </span>
                      </div>

                      {stf.bio && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                          {stf.bio}
                        </p>
                      )}

                      <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{stf.email}</span>
                        </div>
                        {stf.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{stf.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Profile & Picture
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Add New Specialist</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              {/* Profile Avatar Selection Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-800">
                  Profile Picture & Avatar
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white overflow-hidden border border-slate-300 shrink-0 shadow-xs">
                    <img
                      src={newStaffAvatarUrl || getDefaultAvatarByGender(newStaffGender, newStaffName)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = getDefaultAvatarByGender(newStaffGender, newStaffName);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => addFileInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Upload Image File
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStaffAvatarUrl(getDefaultAvatarByGender(newStaffGender, newStaffName))}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                        Use Gender Default
                      </button>
                    </div>
                    <input
                      ref={addFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, false)}
                    />
                    <p className="text-[11px] text-slate-500">
                      Upload custom photo or use automatic generic avatar based on gender.
                    </p>
                  </div>
                </div>

                {/* Preset Avatar Gallery */}
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                    Or select a generic avatar preset:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setNewStaffAvatarUrl(preset.url);
                          setNewStaffGender(preset.gender);
                        }}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                          newStaffAvatarUrl === preset.url
                            ? 'border-slate-900 scale-105 shadow-xs'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={newStaffGender}
                    onChange={(e) => {
                      const g = e.target.value as GenderType;
                      setNewStaffGender(g);
                      if (!newStaffAvatarUrl || PRESET_AVATARS.some((p) => p.url === newStaffAvatarUrl)) {
                        setNewStaffAvatarUrl(getDefaultAvatarByGender(g, newStaffName));
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non-binary">Non-binary / Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title / Specialty
                  </label>
                  <input
                    type="text"
                    value={newStaffTitle}
                    onChange={(e) => setNewStaffTitle(e.target.value)}
                    placeholder="Lead Aesthetician"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                          className="rounded text-slate-900 focus:ring-slate-900"
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
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Specialist Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Edit Specialist: {editingStaff.name}
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Profile Avatar Selection Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-800">
                  Update Profile Picture & Avatar
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white overflow-hidden border border-slate-300 shrink-0 shadow-xs">
                    <img
                      src={editAvatarUrl || getDefaultAvatarByGender(editGender, editName)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = getDefaultAvatarByGender(editGender, editName);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Upload Photo File
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAvatarUrl(getDefaultAvatarByGender(editGender, editName))}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                        Reset to Gender Default
                      </button>
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, true)}
                    />
                  </div>
                </div>

                {/* Custom URL Input */}
                <div>
                  <label className="block text-[11px] text-slate-500 font-medium mb-1">
                    Or enter custom image URL:
                  </label>
                  <input
                    type="url"
                    value={editAvatarUrl.startsWith('data:') ? '' : editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Preset Avatar Gallery */}
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                    Or select a generic avatar preset:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setEditAvatarUrl(preset.url);
                          setEditGender(preset.gender);
                        }}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                          editAvatarUrl === preset.url
                            ? 'border-slate-900 scale-105 shadow-xs'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => {
                      const g = e.target.value as GenderType;
                      setEditGender(g);
                      if (!editAvatarUrl || PRESET_AVATARS.some((p) => p.url === editAvatarUrl)) {
                        setEditAvatarUrl(getDefaultAvatarByGender(g, editName));
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non-binary">Non-binary / Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Specialty</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Professional Bio</label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <label htmlFor="activeToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
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
                          className="rounded text-slate-900 focus:ring-slate-900"
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
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Save Profile & Avatar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
