export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
  gender?: string | null;
  staffProfile?: StaffProfile | null;
}

export interface StaffProfile {
  id: string;
  userId: string;
  title: string;
  bio?: string | null;
  timezone: string;
  isActive: boolean;
  name?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  services?: { id: string; name: string }[];
  upcomingAppointmentsCount?: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: string | number;
  isActive: boolean;
  assignedStaffIds?: string[];
  assignedStaffCount?: number;
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  customerId: string;
  staffId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  customerNotes?: string | null;
  priceCharged: string | number;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  customerAvatar?: string | null;
  serviceName?: string;
  serviceDuration?: number;
  staffName?: string;
  staffTitle?: string;
}

export interface AvailabilityRule {
  id: string;
  staffId: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon ...
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}

export interface BlockedTime {
  id: string;
  staffId: string;
  startAt: string;
  endAt: string;
  reason: string;
}

export interface AvailableStaff {
  id: string;
  name: string;
  title?: string;
  avatarUrl?: string | null;
  gender?: string | null;
}

export interface TimeSlot {
  time: string;
  startAt: string;
  endAt: string;
  staffId: string;
  staffName: string;
  availableStaff?: AvailableStaff[];
}

export interface SpecialistDayStatus {
  staffId: string;
  userId: string;
  name: string;
  title: string;
  email: string;
  avatarUrl?: string | null;
  gender?: string | null;
  dayOfWeek: number;
  isWorkingDay: boolean;
  workingHours?: string;
  isAvailable: boolean;
  blockedReason?: string | null;
  blockedId?: string | null;
  appointmentsCount: number;
  appointments?: {
    id: string;
    startAt: string;
    endAt: string;
    customerName: string;
    serviceName: string;
  }[];
}

export interface DailyRosterResponse {
  date: string;
  dayOfWeek: number;
  specialists: SpecialistDayStatus[];
}

export interface BusinessSettings {
  id: string;
  businessName: string;
  timezone: string;
  email: string;
  phone: string;
  address: string;
  minNoticeHours: number;
  maxAdvanceDays: number;
  slotIntervalMinutes: number;
  policyText: string;
}

export interface OverviewMetrics {
  kpis: {
    totalAppointments: number;
    todayAppointments: number;
    activeCustomers: number;
    completionRate: number;
    changeVersusPrevious: number;
    todayDateStr: string;
  };
  chartData: {
    date: string;
    confirmed: number;
    completed: number;
    cancelled: number;
  }[];
  upcomingAppointments: {
    id: string;
    startAt: string;
    status: AppointmentStatus;
    customerName: string;
    customerAvatar?: string | null;
    serviceName: string;
    staffId: string;
    staffName: string;
  }[];
}
