import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Appointment, StaffProfile } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../ui/Toast.tsx';

interface CalendarPageProps {
  onNewAppointment: () => void;
  onViewAppointmentDetails: (apt: Appointment) => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  onNewAppointment,
  onViewAppointmentDetails,
}) => {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [aptsRes, staffRes] = await Promise.all([
        apiFetch('/api/v1/appointments?limit=200'),
        apiFetch('/api/v1/staff'),
      ]);

      const [aptsJson, staffJson] = await Promise.all([
        aptsRes.json(),
        staffRes.json(),
      ]);

      if (aptsJson.success) setAppointments(aptsJson.data);
      if (staffJson.success) setStaffList(staffJson.data);
    } catch (e) {
      toast('Failed to load calendar appointments', 'error');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate functions
  const handleToday = () => setCurrentDate(new Date());

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'DAY') d.setDate(d.getDate() - 1);
    else if (viewMode === 'WEEK') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'DAY') d.setDate(d.getDate() + 1);
    else if (viewMode === 'WEEK') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (apt.status === 'CANCELLED') return false;
    if (selectedStaffId !== 'ALL' && apt.staffId !== selectedStaffId) return false;
    return true;
  });

  // Calculate start of week (Sunday)
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    return day;
  });

  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Calendar</h2>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-white text-slate-600 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-md transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-white text-slate-600 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="font-semibold text-sm text-slate-700 hidden md:inline">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Staff Filter */}
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Specialists</option>
            {staffList.map((stf) => (
              <option key={stf.id} value={stf.id}>
                {stf.name}
              </option>
            ))}
          </select>

          {/* Segmented View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            {(['DAY', 'WEEK', 'MONTH'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <button
            onClick={onNewAppointment}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + New Appointment
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* WEEK VIEW */}
        {viewMode === 'WEEK' && (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 text-center">
                <div className="py-3 text-[11px] font-semibold text-slate-400 border-r border-slate-200">
                  Time
                </div>
                {weekDays.map((day, idx) => {
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={idx}
                      className={`py-3 px-2 border-r border-slate-200 last:border-r-0 ${
                        isToday ? 'bg-blue-50/60 font-bold' : ''
                      }`}
                    >
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span
                        className={`text-sm ${
                          isToday ? 'text-blue-600 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Hourly Grid */}
              <div className="divide-y divide-slate-100">
                {hours.map((hour) => {
                  const hourLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                  return (
                    <div key={hour} className="grid grid-cols-8 min-h-[56px]">
                      {/* Hour label */}
                      <div className="p-2 text-[10px] text-slate-400 font-medium border-r border-slate-200 text-right pr-3">
                        {hourLabel}
                      </div>

                      {/* 7 day columns */}
                      {weekDays.map((day, dIdx) => {
                        const dayStr = day.toISOString().split('T')[0];

                        // Match appointments that fall in this hour on this day
                        const matchingApts = filteredAppointments.filter((apt) => {
                          const aptStart = new Date(apt.startAt);
                          const aptDayStr = aptStart.toISOString().split('T')[0];
                          const aptHour = aptStart.getUTCHours();
                          return aptDayStr === dayStr && aptHour === hour;
                        });

                        return (
                          <div
                            key={dIdx}
                            className="p-1 border-r border-slate-100 last:border-r-0 relative hover:bg-slate-50/50 transition-colors"
                          >
                            {matchingApts.map((apt) => (
                              <div
                                key={apt.id}
                                onClick={() => onViewAppointmentDetails(apt)}
                                className="mb-1 p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] cursor-pointer hover:border-slate-400 hover:bg-slate-100/60 transition-colors text-slate-900"
                              >
                                <div className="font-semibold truncate">{apt.serviceName}</div>
                                <div className="text-[10px] text-slate-600 truncate">
                                  {apt.customerName}
                                </div>
                                <div className="text-[9px] text-slate-400 font-mono">
                                  {new Date(apt.startAt).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* DAY VIEW */}
        {viewMode === 'DAY' && (
          <div className="p-6">
            <div className="mb-4 text-xs font-semibold text-slate-500">
              Appointments for {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="space-y-2">
              {filteredAppointments
                .filter(
                  (a) =>
                    new Date(a.startAt).toDateString() === currentDate.toDateString()
                )
                .map((apt) => (
                  <div
                    key={apt.id}
                    onClick={() => onViewAppointmentDetails(apt)}
                    className="p-3.5 bg-white border border-slate-200 rounded hover:border-slate-400 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center font-mono">
                        <span className="block text-xs font-bold text-slate-900">
                          {new Date(apt.startAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-slate-400">{apt.serviceDuration || 60}m</span>
                      </div>
                      <div className="border-l border-slate-200 pl-4">
                        <h4 className="font-bold text-slate-900 text-xs">{apt.serviceName}</h4>
                        <p className="text-[11px] text-slate-600">Client: {apt.customerName}</p>
                        <p className="text-[10px] text-slate-400">Specialist: {apt.staffName}</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-medium text-slate-600">
                      · {apt.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* MONTH VIEW */}
        {viewMode === 'MONTH' && (
          <div className="p-6">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono text-slate-400 uppercase mb-2">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 31 }, (_, i) => {
                const dayNum = i + 1;
                const dayApts = filteredAppointments.filter((a) => {
                  const d = new Date(a.startAt);
                  return (
                    d.getDate() === dayNum &&
                    d.getMonth() === currentDate.getMonth() &&
                    d.getFullYear() === currentDate.getFullYear()
                  );
                });

                return (
                  <div
                    key={dayNum}
                    className="h-20 p-2 bg-slate-50 border border-slate-200 rounded flex flex-col justify-between hover:border-slate-400 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-mono font-medium text-slate-700">{dayNum}</span>
                    {dayApts.length > 0 && (
                      <span className="text-[10px] font-mono font-medium text-slate-900">
                        {dayApts.length} booking{dayApts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
