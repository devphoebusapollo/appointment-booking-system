import { db } from '../db/index.ts';
import {
  staffProfiles,
  services,
  availabilityRules,
  blockedTimes,
  appointments,
  businessSettings,
  staffServices,
  users
} from '../db/schema.ts';
import { eq, and, ne, gte, lte } from 'drizzle-orm';

export interface AvailableStaff {
  id: string;
  name: string;
  title?: string;
  avatarUrl?: string | null;
  gender?: string | null;
}

export interface TimeSlot {
  time: string; // "09:00"
  startAt: string; // ISO UTC string
  endAt: string; // ISO UTC string
  staffId: string;
  staffName: string;
  availableStaff: AvailableStaff[];
}

export interface AvailabilityResult {
  slots: TimeSlot[];
  availableSpecialistsForDate: AvailableStaff[];
}

export async function calculateAvailableSlots(params: {
  dateStr: string; // "YYYY-MM-DD"
  serviceId: string;
  staffId?: string; // specific staff ID or undefined for 'any'
  currentInstant?: Date;
}): Promise<AvailabilityResult> {
  const { dateStr, serviceId, staffId, currentInstant = new Date() } = params;

  // 1. Fetch business settings
  const [settings] = await db.select().from(businessSettings).limit(1);
  const minNoticeHours = settings?.minNoticeHours ?? 2;
  const maxAdvanceDays = settings?.maxAdvanceDays ?? 60;
  const slotIntervalMinutes = settings?.slotIntervalMinutes ?? 30;

  // Check advance window
  const targetDateParts = dateStr.split('-').map(Number);
  const targetDayStart = new Date(Date.UTC(targetDateParts[0], targetDateParts[1] - 1, targetDateParts[2], 0, 0, 0));
  const targetDayEnd = new Date(Date.UTC(targetDateParts[0], targetDateParts[1] - 1, targetDateParts[2], 23, 59, 59));

  const daysDifference = (targetDayStart.getTime() - currentInstant.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDifference > maxAdvanceDays || daysDifference < -1) {
    return { slots: [], availableSpecialistsForDate: [] };
  }

  // 2. Fetch service
  const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.isActive, true)));
  if (!service) {
    return { slots: [], availableSpecialistsForDate: [] };
  }
  const durationMinutes = service.durationMinutes;

  // 3. Find candidate staff who offer this service and are active
  let candidateStaffIds: string[] = [];
  if (staffId && staffId !== 'any') {
    // Verify specific staff offers this service
    const [matching] = await db
      .select({ staffId: staffServices.staffId })
      .from(staffServices)
      .innerJoin(staffProfiles, eq(staffServices.staffId, staffProfiles.id))
      .where(and(
        eq(staffServices.staffId, staffId),
        eq(staffServices.serviceId, serviceId),
        eq(staffProfiles.isActive, true)
      ));
    if (matching) {
      candidateStaffIds = [staffId];
    } else {
      return { slots: [], availableSpecialistsForDate: [] };
    }
  } else {
    // Find all staff who can perform this service
    const matchingStaff = await db
      .select({ staffId: staffServices.staffId })
      .from(staffServices)
      .innerJoin(staffProfiles, eq(staffServices.staffId, staffProfiles.id))
      .where(and(
        eq(staffServices.serviceId, serviceId),
        eq(staffProfiles.isActive, true)
      ));
    candidateStaffIds = matchingStaff.map(s => s.staffId);
  }

  if (candidateStaffIds.length === 0) {
    return { slots: [], availableSpecialistsForDate: [] };
  }

  // Calculate day of week: Date.UTC day of week
  const dayOfWeek = targetDayStart.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Raw slots collected per staff
  interface RawSlot {
    time: string;
    startAt: string;
    endAt: string;
    staff: AvailableStaff;
  }
  const rawSlots: RawSlot[] = [];
  const activeStaffOnDate = new Map<string, AvailableStaff>();

  for (const sId of candidateStaffIds) {
    // Fetch staff info including title, avatar, and gender
    const [staffInfo] = await db
      .select({
        id: staffProfiles.id,
        name: users.name,
        title: staffProfiles.title,
        avatarUrl: users.avatarUrl,
        gender: users.gender,
      })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(eq(staffProfiles.id, sId));

    if (!staffInfo) continue;

    // Fetch availability rules for this staff member and dayOfWeek
    const rules = await db
      .select()
      .from(availabilityRules)
      .where(and(
        eq(availabilityRules.staffId, sId),
        eq(availabilityRules.dayOfWeek, dayOfWeek),
        eq(availabilityRules.isActive, true)
      ));

    if (rules.length === 0) continue;

    // Fetch existing active appointments for this staff member overlapping today
    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.staffId, sId),
        ne(appointments.status, 'CANCELLED')
      ));

    // Fetch blocked times for this staff member overlapping target date
    const blocks = await db
      .select()
      .from(blockedTimes)
      .where(and(
        eq(blockedTimes.staffId, sId),
        gte(blockedTimes.endAt, targetDayStart),
        lte(blockedTimes.startAt, targetDayEnd)
      ));

    // Earliest allowable start time: now + minNoticeHours
    const minEarliestAllowed = new Date(currentInstant.getTime() + minNoticeHours * 60 * 60 * 1000);

    for (const rule of rules) {
      let currentMinute = rule.startMinute;

      while (currentMinute + durationMinutes <= rule.endMinute) {
        const slotStartHours = Math.floor(currentMinute / 60);
        const slotStartMins = currentMinute % 60;

        // Construct slot start and end instants in UTC for that day
        const slotStart = new Date(Date.UTC(
          targetDateParts[0],
          targetDateParts[1] - 1,
          targetDateParts[2],
          slotStartHours,
          slotStartMins,
          0
        ));

        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

        // Check if slot start is after minNoticeHours
        if (slotStart > minEarliestAllowed) {
          // Check collision with existing active appointments [start, end)
          const hasApptCollision = existingAppointments.some(apt => {
            const aptStart = new Date(apt.startAt).getTime();
            const aptEnd = new Date(apt.endAt).getTime();
            const sStart = slotStart.getTime();
            const sEnd = slotEnd.getTime();
            return sStart < aptEnd && sEnd > aptStart;
          });

          // Check collision with blocked times
          const hasBlockCollision = blocks.some(blk => {
            const blkStart = new Date(blk.startAt).getTime();
            const blkEnd = new Date(blk.endAt).getTime();
            const sStart = slotStart.getTime();
            const sEnd = slotEnd.getTime();
            return sStart < blkEnd && sEnd > blkStart;
          });

          if (!hasApptCollision && !hasBlockCollision) {
            const hh = String(slotStartHours).padStart(2, '0');
            const mm = String(slotStartMins).padStart(2, '0');

            const staffObj: AvailableStaff = {
              id: sId,
              name: staffInfo.name,
              title: staffInfo.title,
              avatarUrl: staffInfo.avatarUrl,
              gender: staffInfo.gender,
            };

            activeStaffOnDate.set(sId, staffObj);

            rawSlots.push({
              time: `${hh}:${mm}`,
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
              staff: staffObj,
            });
          }
        }

        currentMinute += slotIntervalMinutes;
      }
    }
  }

  // Sort raw slots chronologically
  rawSlots.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  // Group raw slots by distinct time slot
  const slotMap = new Map<string, { startAt: string; endAt: string; staffList: AvailableStaff[] }>();

  for (const item of rawSlots) {
    const existing = slotMap.get(item.time);
    if (!existing) {
      slotMap.set(item.time, {
        startAt: item.startAt,
        endAt: item.endAt,
        staffList: [item.staff],
      });
    } else {
      if (!existing.staffList.some(s => s.id === item.staff.id)) {
        existing.staffList.push(item.staff);
      }
    }
  }

  const groupedSlots: TimeSlot[] = [];
  for (const [timeStr, data] of slotMap.entries()) {
    // If specific staffId requested, ensure they are first
    let primaryStaff = data.staffList[0];
    if (staffId && staffId !== 'any') {
      const match = data.staffList.find(s => s.id === staffId);
      if (match) primaryStaff = match;
    }

    groupedSlots.push({
      time: timeStr,
      startAt: data.startAt,
      endAt: data.endAt,
      staffId: primaryStaff.id,
      staffName: primaryStaff.name,
      availableStaff: data.staffList,
    });
  }

  return {
    slots: groupedSlots,
    availableSpecialistsForDate: Array.from(activeStaffOnDate.values()),
  };
}
