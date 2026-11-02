import { Router, Request, Response } from 'express';
import { db, pool } from '../db/index.ts';
import {
  users,
  staffProfiles,
  services,
  staffServices,
  availabilityRules,
  blockedTimes,
  appointments,
  notificationOutbox,
  businessSettings,
} from '../db/schema.ts';
import { eq, and, desc, gte, lte, or, ilike, sql, ne } from 'drizzle-orm';
import { authMiddleware, AuthRequest, requireRole } from './authMiddleware.ts';
import { calculateAvailableSlots } from './availability.ts';

const router = Router();
router.use(authMiddleware);

// ==========================================
// 1. AUTH & SESSIONS
// ==========================================

// Return current user session (Firebase auth or demo persona)
router.get('/auth/me', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.json({ success: true, data: { user: null } });
  }

  // Also check if this user has a staff profile
  let staffProfile = null;
  if (req.user.role === 'STAFF' || req.user.role === 'ADMIN') {
    const [profile] = await db
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, req.user.id));
    staffProfile = profile || null;
  }

  return res.json({
    success: true,
    data: {
      user: {
        ...req.user,
        staffProfile,
      },
    },
  });
});

// List demo personas for quick switching between Admin, Staff, and Customer
router.get('/auth/personas', async (req: Request, res: Response) => {
  try {
    const allUsers = await db.select().from(users).orderBy(users.role, users.name);
    return res.json({ success: true, data: allUsers });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Customer registration
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name and email are required' },
      });
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
      });
    }

    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const [created] = await db
      .insert(users)
      .values({
        id: newUserId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        role: 'CUSTOMER',
      })
      .returning();

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ==========================================
// 2. SERVICES MANAGEMENT
// ==========================================

// Get services (public: active only; admin: all)
router.get('/services', async (req: AuthRequest, res: Response) => {
  try {
    const allServices = await db.select().from(services).orderBy(services.name);

    // Get staff count for each service
    const staffServiceRows = await db.select().from(staffServices);
    const countMap: Record<string, string[]> = {};
    for (const row of staffServiceRows) {
      if (!countMap[row.serviceId]) countMap[row.serviceId] = [];
      countMap[row.serviceId].push(row.staffId);
    }

    const enriched = allServices.map((srv) => ({
      ...srv,
      assignedStaffIds: countMap[srv.id] || [],
      assignedStaffCount: (countMap[srv.id] || []).length,
    }));

    // If query ?activeOnly=true
    if (req.query.activeOnly === 'true') {
      return res.json({ success: true, data: enriched.filter((s) => s.isActive) });
    }

    return res.json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create service (Admin only)
router.post('/services', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, durationMinutes, price, isActive = true, assignedStaffIds = [] } = req.body;

    if (!name || !durationMinutes || price === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, duration, and price are required' },
      });
    }

    const serviceId = `srv_${Date.now()}`;
    const [created] = await db
      .insert(services)
      .values({
        id: serviceId,
        name: name.trim(),
        description: description?.trim() || '',
        durationMinutes: Number(durationMinutes),
        price: String(Number(price).toFixed(2)),
        isActive: Boolean(isActive),
      })
      .returning();

    // Assign staff if provided
    if (Array.isArray(assignedStaffIds) && assignedStaffIds.length > 0) {
      for (const sId of assignedStaffIds) {
        await db.insert(staffServices).values({ staffId: sId, serviceId }).onConflictDoNothing();
      }
    }

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update service (Admin only)
router.patch('/services/:id', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, durationMinutes, price, isActive, assignedStaffIds } = req.body;

    const updatePayload: any = { updatedAt: new Date() };
    if (name !== undefined) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description.trim();
    if (durationMinutes !== undefined) updatePayload.durationMinutes = Number(durationMinutes);
    if (price !== undefined) updatePayload.price = String(Number(price).toFixed(2));
    if (isActive !== undefined) updatePayload.isActive = Boolean(isActive);

    const [updated] = await db
      .update(services)
      .set(updatePayload)
      .where(eq(services.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Service not found' } });
    }

    // Update staff assignments if provided
    if (Array.isArray(assignedStaffIds)) {
      await db.delete(staffServices).where(eq(staffServices.serviceId, id));
      for (const sId of assignedStaffIds) {
        await db.insert(staffServices).values({ staffId: sId, serviceId: id }).onConflictDoNothing();
      }
    }

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ==========================================
// 3. STAFF MANAGEMENT
// ==========================================

// Get all staff members with profiles, assigned services, and upcoming appointment count
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const staffList = await db
      .select({
        id: staffProfiles.id,
        userId: staffProfiles.userId,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        title: staffProfiles.title,
        bio: staffProfiles.bio,
        timezone: staffProfiles.timezone,
        isActive: staffProfiles.isActive,
      })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id));

    // Get assigned services for each staff
    const staffServiceRows = await db
      .select({
        staffId: staffServices.staffId,
        serviceId: services.id,
        serviceName: services.name,
      })
      .from(staffServices)
      .innerJoin(services, eq(staffServices.serviceId, services.id));

    const serviceMap: Record<string, { id: string; name: string }[]> = {};
    for (const row of staffServiceRows) {
      if (!serviceMap[row.staffId]) serviceMap[row.staffId] = [];
      serviceMap[row.staffId].push({ id: row.serviceId, name: row.serviceName });
    }

    // Get upcoming appointment counts
    const now = new Date();
    const upcomingApts = await db
      .select({
        staffId: appointments.staffId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(appointments)
      .where(and(gte(appointments.startAt, now), ne(appointments.status, 'CANCELLED')))
      .groupBy(appointments.staffId);

    const upcomingMap: Record<string, number> = {};
    for (const row of upcomingApts) {
      upcomingMap[row.staffId] = Number(row.count);
    }

    const enriched = staffList.map((s) => ({
      ...s,
      services: serviceMap[s.id] || [],
      upcomingAppointmentsCount: upcomingMap[s.id] || 0,
    }));

    return res.json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create new staff member (Admin only)
router.post('/staff', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, title, bio, timezone = 'America/New_York', serviceIds = [] } = req.body;
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name and email are required' },
      });
    }

    const userId = `usr_${Date.now()}`;
    const staffId = `stf_${Date.now()}`;

    // Create user record
    await db.insert(users).values({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      role: 'STAFF',
    });

    // Create staff profile
    const [profile] = await db
      .insert(staffProfiles)
      .values({
        id: staffId,
        userId,
        title: title?.trim() || 'Specialist',
        bio: bio?.trim() || null,
        timezone,
        isActive: true,
      })
      .returning();

    // Assign default standard schedule (Mon-Fri 9AM-5PM)
    const defaultRules = [1, 2, 3, 4, 5].map((day) => ({
      id: `av_${staffId}_${day}`,
      staffId,
      dayOfWeek: day,
      startMinute: 540, // 9:00 AM
      endMinute: 1020, // 5:00 PM
      isActive: true,
    }));
    for (const rule of defaultRules) {
      await db.insert(availabilityRules).values(rule).onConflictDoNothing();
    }

    // Assign services
    if (Array.isArray(serviceIds)) {
      for (const sId of serviceIds) {
        await db.insert(staffServices).values({ staffId, serviceId: sId }).onConflictDoNothing();
      }
    }

    return res.status(201).json({ success: true, data: { ...profile, userId, name, email } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update staff details (Admin or Staff self)
router.patch('/staff/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, bio, timezone, isActive, serviceIds, name, phone } = req.body;

    const [staff] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, id));
    if (!staff) {
      return res.status(404).json({ success: false, error: { message: 'Staff member not found' } });
    }

    // Check authorization: Admin or the staff themselves
    if (req.user?.role !== 'ADMIN' && req.user?.id !== staff.userId) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    const updateStaffPayload: any = { updatedAt: new Date() };
    if (title !== undefined) updateStaffPayload.title = title;
    if (bio !== undefined) updateStaffPayload.bio = bio;
    if (timezone !== undefined) updateStaffPayload.timezone = timezone;
    if (isActive !== undefined && req.user?.role === 'ADMIN') updateStaffPayload.isActive = Boolean(isActive);

    const [updatedStaff] = await db
      .update(staffProfiles)
      .set(updateStaffPayload)
      .where(eq(staffProfiles.id, id))
      .returning();

    // Update user record name / phone if requested
    if (name || phone !== undefined) {
      await db
        .update(users)
        .set({
          ...(name ? { name: name.trim() } : {}),
          ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        })
        .where(eq(users.id, staff.userId));
    }

    // Update assigned services if provided (Admin only)
    if (Array.isArray(serviceIds) && req.user?.role === 'ADMIN') {
      await db.delete(staffServices).where(eq(staffServices.staffId, id));
      for (const sId of serviceIds) {
        await db.insert(staffServices).values({ staffId: id, serviceId: sId }).onConflictDoNothing();
      }
    }

    return res.json({ success: true, data: updatedStaff });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ==========================================
// 4. SCHEDULE & AVAILABILITY RULES
// ==========================================

// Get weekly availability and blocked times for staff member
router.get('/staff/:id/availability', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rules = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.staffId, id))
      .orderBy(availabilityRules.dayOfWeek, availabilityRules.startMinute);

    const blocks = await db
      .select()
      .from(blockedTimes)
      .where(eq(blockedTimes.staffId, id))
      .orderBy(desc(blockedTimes.startAt));

    return res.json({ success: true, data: { rules, blockedTimes: blocks } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update staff weekly schedule (Admin or Staff self)
router.put('/staff/:id/availability', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rules } = req.body; // array of { dayOfWeek, startMinute, endMinute, isActive }

    if (!Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid rules format: expected an array' },
      });
    }

    // Delete existing rules for this staff member
    await db.delete(availabilityRules).where(eq(availabilityRules.staffId, id));

    // Insert new rules
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      await db.insert(availabilityRules).values({
        id: `av_${id}_${r.dayOfWeek}_${i}_${Date.now()}`,
        staffId: id,
        dayOfWeek: r.dayOfWeek,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        isActive: r.isActive ?? true,
      });
    }

    const updatedRules = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.staffId, id))
      .orderBy(availabilityRules.dayOfWeek, availabilityRules.startMinute);

    return res.json({ success: true, data: updatedRules });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Add blocked time / time-off
router.post('/staff/:id/blocked-times', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { startAt, endAt, reason } = req.body;

    if (!startAt || !endAt || !reason) {
      return res.status(400).json({
        success: false,
        error: { message: 'startAt, endAt, and reason are required' },
      });
    }

    // Validate that blocked time does not silently invalidate existing bookings
    const existingBookings = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.staffId, id),
        ne(appointments.status, 'CANCELLED'),
        gte(appointments.endAt, new Date(startAt)),
        lte(appointments.startAt, new Date(endAt))
      ));

    if (existingBookings.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT_WITH_APPOINTMENTS',
          message: `Cannot block time: Staff has ${existingBookings.length} active appointment(s) during this period. Please reschedule them first.`,
        },
      });
    }

    const blockId = `blk_${Date.now()}`;
    const [created] = await db
      .insert(blockedTimes)
      .values({
        id: blockId,
        staffId: id,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        reason: reason.trim(),
      })
      .returning();

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Delete blocked time
router.delete('/staff/:id/blocked-times/:blockId', async (req: AuthRequest, res: Response) => {
  try {
    const { blockId } = req.params;
    await db.delete(blockedTimes).where(eq(blockedTimes.id, blockId));
    return res.json({ success: true, message: 'Blocked time removed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ==========================================
// 4. DAILY ROSTER & SPECIALIST DAY AVAILABILITY
// ==========================================

// Get specialist daily roster for a given date
router.get('/admin/daily-roster', requireRole(['ADMIN', 'STAFF']), async (req: AuthRequest, res: Response) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const targetParts = dateStr.split('-').map(Number);
    const targetDayStart = new Date(Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2], 0, 0, 0));
    const targetDayEnd = new Date(Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2], 23, 59, 59, 999));
    const dayOfWeek = targetDayStart.getUTCDay();

    // Fetch all active staff
    const staffList = await db
      .select({
        staffId: staffProfiles.id,
        userId: staffProfiles.userId,
        name: users.name,
        title: staffProfiles.title,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isActive: staffProfiles.isActive,
      })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(eq(staffProfiles.isActive, true));

    const specialistsStatus = await Promise.all(
      staffList.map(async (stf) => {
        // Check availability rule for this day of week
        const rules = await db
          .select()
          .from(availabilityRules)
          .where(
            and(
              eq(availabilityRules.staffId, stf.staffId),
              eq(availabilityRules.dayOfWeek, dayOfWeek),
              eq(availabilityRules.isActive, true)
            )
          )
          .orderBy(availabilityRules.startMinute);

        const isWorkingDay = rules.length > 0;
        let workingHours = '';
        if (isWorkingDay) {
          const formatMin = (m: number) => {
            const h = Math.floor(m / 60);
            const mins = m % 60;
            return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          };
          workingHours = rules.map((r) => `${formatMin(r.startMinute)} - ${formatMin(r.endMinute)}`).join(', ');
        }

        // Check if there are blocked times overlapping this date
        const blocks = await db
          .select()
          .from(blockedTimes)
          .where(
            and(
              eq(blockedTimes.staffId, stf.staffId),
              gte(blockedTimes.endAt, targetDayStart),
              lte(blockedTimes.startAt, targetDayEnd)
            )
          );

        // Fetch appointments on this date
        const appts = await db
          .select({
            id: appointments.id,
            startAt: appointments.startAt,
            endAt: appointments.endAt,
            customerName: users.name,
            serviceName: services.name,
          })
          .from(appointments)
          .innerJoin(users, eq(appointments.customerId, users.id))
          .innerJoin(services, eq(appointments.serviceId, services.id))
          .where(
            and(
              eq(appointments.staffId, stf.staffId),
              ne(appointments.status, 'CANCELLED'),
              gte(appointments.endAt, targetDayStart),
              lte(appointments.startAt, targetDayEnd)
            )
          );

        const isBlocked = blocks.length > 0;
        const isAvailable = isWorkingDay && !isBlocked;

        return {
          staffId: stf.staffId,
          userId: stf.userId,
          name: stf.name,
          title: stf.title,
          email: stf.email,
          avatarUrl: stf.avatarUrl,
          dayOfWeek,
          isWorkingDay,
          workingHours,
          isAvailable,
          blockedReason: blocks[0]?.reason || null,
          blockedId: blocks[0]?.id || null,
          appointmentsCount: appts.length,
          appointments: appts.map((a) => ({
            id: a.id,
            startAt: a.startAt.toISOString(),
            endAt: a.endAt.toISOString(),
            customerName: a.customerName,
            serviceName: a.serviceName,
          })),
        };
      })
    );

    return res.json({
      success: true,
      data: {
        date: dateStr,
        dayOfWeek,
        specialists: specialistsStatus,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Toggle individual specialist availability for a specific date
router.post('/admin/daily-roster/toggle', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, staffId, isAvailable, reason, force = false } = req.body;
    if (!date || !staffId || typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'date (YYYY-MM-DD), staffId, and isAvailable (boolean) are required' },
      });
    }

    const targetParts = date.split('-').map(Number);
    const targetDayStart = new Date(Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2], 0, 0, 0));
    const targetDayEnd = new Date(Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2], 23, 59, 59, 999));

    if (!isAvailable) {
      // Admin is marking specialist as unavailable on this date
      const existingAppts = await db
        .select({
          id: appointments.id,
          startAt: appointments.startAt,
          endAt: appointments.endAt,
          customerName: users.name,
          serviceName: services.name,
        })
        .from(appointments)
        .innerJoin(users, eq(appointments.customerId, users.id))
        .innerJoin(services, eq(appointments.serviceId, services.id))
        .where(
          and(
            eq(appointments.staffId, staffId),
            ne(appointments.status, 'CANCELLED'),
            gte(appointments.endAt, targetDayStart),
            lte(appointments.startAt, targetDayEnd)
          )
        );

      if (existingAppts.length > 0 && !force) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'APPOINTMENTS_EXIST',
            message: `Specialist has ${existingAppts.length} active appointment(s) on ${date}. Confirm to mark off anyway or reschedule first.`,
            appointments: existingAppts,
          },
        });
      }

      // Check if already blocked
      const [existingBlock] = await db
        .select()
        .from(blockedTimes)
        .where(
          and(
            eq(blockedTimes.staffId, staffId),
            gte(blockedTimes.endAt, targetDayStart),
            lte(blockedTimes.startAt, targetDayEnd)
          )
        );

      if (!existingBlock) {
        const blockId = `blk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await db.insert(blockedTimes).values({
          id: blockId,
          staffId,
          startAt: targetDayStart,
          endAt: targetDayEnd,
          reason: reason?.trim() || `Marked unavailable on ${date}`,
        });
      }
    } else {
      // Admin is marking specialist as available on this date
      await db
        .delete(blockedTimes)
        .where(
          and(
            eq(blockedTimes.staffId, staffId),
            gte(blockedTimes.endAt, targetDayStart),
            lte(blockedTimes.startAt, targetDayEnd)
          )
        );
    }

    return res.json({
      success: true,
      message: `Updated specialist availability for ${date}`,
      data: { date, staffId, isAvailable },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Set full daily roster of available specialists in batch
router.post('/admin/daily-roster', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { date, availableStaffIds = [], reason } = req.body;
    if (!date || !Array.isArray(availableStaffIds)) {
      return res.status(400).json({
        success: false,
        error: { message: 'date (YYYY-MM-DD) and availableStaffIds (array) are required' },
      });
    }

    const targetParts = date.split('-').map(Number);
    const targetDayStart = new Date(Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2], 0, 0, 0));
    const targetDayEnd = new Date(Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2], 23, 59, 59, 999));

    // Get all active staff
    const allStaff = await db.select().from(staffProfiles).where(eq(staffProfiles.isActive, true));

    for (const stf of allStaff) {
      if (availableStaffIds.includes(stf.id)) {
        // Staff is marked available -> clear any whole-day blocks on this date
        await db
          .delete(blockedTimes)
          .where(
            and(
              eq(blockedTimes.staffId, stf.id),
              gte(blockedTimes.endAt, targetDayStart),
              lte(blockedTimes.startAt, targetDayEnd)
            )
          );
      } else {
        // Staff is marked unavailable -> add block if not already blocked
        const [existing] = await db
          .select()
          .from(blockedTimes)
          .where(
            and(
              eq(blockedTimes.staffId, stf.id),
              gte(blockedTimes.endAt, targetDayStart),
              lte(blockedTimes.startAt, targetDayEnd)
            )
          );

        if (!existing) {
          const blockId = `blk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await db.insert(blockedTimes).values({
            id: blockId,
            staffId: stf.id,
            startAt: targetDayStart,
            endAt: targetDayEnd,
            reason: reason?.trim() || `Marked unavailable on ${date}`,
          });
        }
      }
    }

    return res.json({
      success: true,
      message: `Daily roster saved for ${date}`,
      data: { date, availableStaffIds },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Public / Customer: Calculate available slots and active specialists on date
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const { date, serviceId, staffId } = req.query as {
      date?: string;
      serviceId?: string;
      staffId?: string;
    };

    if (!date || !serviceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'date (YYYY-MM-DD) and serviceId are required' },
      });
    }

    const result = await calculateAvailableSlots({
      dateStr: date,
      serviceId,
      staffId: staffId === 'any' ? undefined : staffId,
    });

    return res.json({
      success: true,
      data: {
        slots: result.slots,
        availableSpecialistsForDate: result.availableSpecialistsForDate,
        date,
        serviceId,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ==========================================
// 5. APPOINTMENTS MANAGEMENT
// ==========================================

// Get appointments with filtering, search, and role boundaries
router.get('/appointments', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, status, staffId, serviceId, search, limit = '100' } = req.query as Record<string, string>;

    const conditions: any[] = [];

    // Role-based authorization
    if (req.user?.role === 'CUSTOMER') {
      conditions.push(eq(appointments.customerId, req.user.id));
    } else if (req.user?.role === 'STAFF') {
      // Find staff profile ID
      const [staff] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, req.user.id));
      if (staff) {
        conditions.push(eq(appointments.staffId, staff.id));
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    // Query parameters
    if (status && status !== 'ALL') {
      conditions.push(eq(appointments.status, status));
    }
    if (staffId && staffId !== 'ALL') {
      conditions.push(eq(appointments.staffId, staffId));
    }
    if (serviceId && serviceId !== 'ALL') {
      conditions.push(eq(appointments.serviceId, serviceId));
    }
    if (startDate) {
      conditions.push(gte(appointments.startAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(appointments.endAt, new Date(endDate)));
    }

    // Base query joined with customers, services, and staff
    const aptRows = await db
      .select({
        id: appointments.id,
        customerId: appointments.customerId,
        staffId: appointments.staffId,
        serviceId: appointments.serviceId,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        customerNotes: appointments.customerNotes,
        priceCharged: appointments.priceCharged,
        cancellationReason: appointments.cancellationReason,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
        customerName: users.name,
        customerEmail: users.email,
        customerPhone: users.phone,
        customerAvatar: users.avatarUrl,
        serviceName: services.name,
        serviceDuration: services.durationMinutes,
        staffTitle: staffProfiles.title,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.customerId, users.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .innerJoin(staffProfiles, eq(appointments.staffId, staffProfiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(appointments.startAt))
      .limit(Number(limit));

    // Staff names require an extra join to users for the staffProfile.userId
    const staffUserMap: Record<string, string> = {};
    const staffUserRows = await db
      .select({ staffId: staffProfiles.id, staffName: users.name })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id));
    for (const r of staffUserRows) {
      staffUserMap[r.staffId] = r.staffName;
    }

    let enriched = aptRows.map((apt) => ({
      ...apt,
      staffName: staffUserMap[apt.staffId] || 'Staff Member',
    }));

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      enriched = enriched.filter(
        (a) =>
          a.customerName.toLowerCase().includes(q) ||
          a.customerEmail.toLowerCase().includes(q) ||
          a.serviceName.toLowerCase().includes(q) ||
          a.staffName.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }

    return res.json({ success: true, data: enriched });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create new appointment (Customer booking or Admin booking on customer's behalf)
router.post('/appointments', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      serviceId,
      staffId,
      startAt,
      customerNotes,
      customerName,
      customerEmail,
      customerPhone,
      customerId: providedCustomerId,
    } = req.body;

    if (!serviceId || !staffId || !startAt) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'serviceId, staffId, and startAt are required' },
      });
    }

    // 1. Fetch Service details
    const [service] = await db.select().from(services).where(eq(services.id, serviceId));
    if (!service || !service.isActive) {
      return res.status(400).json({
        success: false,
        error: { code: 'SERVICE_INACTIVE', message: 'The selected service is not currently available.' },
      });
    }

    // 2. Fetch Staff details
    const [staff] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, staffId));
    if (!staff || !staff.isActive) {
      return res.status(400).json({
        success: false,
        error: { code: 'STAFF_INACTIVE', message: 'The selected staff member is not currently available.' },
      });
    }

    // 3. Resolve Customer ID
    let finalCustomerId: string;
    if (req.user?.role === 'ADMIN' && providedCustomerId) {
      finalCustomerId = providedCustomerId;
    } else if (req.user) {
      finalCustomerId = req.user.id;
    } else {
      if (!customerEmail || !customerName) {
        return res.status(400).json({
          success: false,
          error: { code: 'CUSTOMER_DETAILS_REQUIRED', message: 'Customer name and email are required' },
        });
      }
      // Check if user with email already exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, customerEmail.toLowerCase().trim()));
      if (existingUser) {
        finalCustomerId = existingUser.id;
      } else {
        finalCustomerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(users).values({
          id: finalCustomerId,
          name: customerName.trim(),
          email: customerEmail.toLowerCase().trim(),
          phone: customerPhone?.trim() || null,
          role: 'CUSTOMER',
        });
      }
    }

    const appointmentStart = new Date(startAt);
    const appointmentEnd = new Date(appointmentStart.getTime() + service.durationMinutes * 60 * 1000);

    // 4. Transactional appointment creation with PostgreSQL overlap protection
    await client.query('BEGIN');

    // Check for overlap using PostgreSQL range
    const conflictQuery = `
      SELECT id FROM appointments
      WHERE staff_id = $1
        AND status != 'CANCELLED'
        AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
      FOR UPDATE;
    `;
    const conflictResult = await client.query(conflictQuery, [
      staffId,
      appointmentStart.toISOString(),
      appointmentEnd.toISOString(),
    ]);

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'This time slot is no longer available. Please select another slot.',
        },
      });
    }

    const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const insertAptQuery = `
      INSERT INTO appointments (
        id, customer_id, staff_id, service_id, start_at, end_at, status, customer_notes, price_charged
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const aptResult = await client.query(insertAptQuery, [
      appointmentId,
      finalCustomerId,
      staffId,
      serviceId,
      appointmentStart.toISOString(),
      appointmentEnd.toISOString(),
      'CONFIRMED',
      customerNotes?.trim() || null,
      service.price,
    ]);

    const createdAppointment = aptResult.rows[0];

    // Look up customer & staff info for notification outbox
    const [custUser] = await db.select().from(users).where(eq(users.id, finalCustomerId));
    const [staffUser] = await db
      .select({ name: users.name, email: users.email })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(eq(staffProfiles.id, staffId));

    // Queue confirmation notification into outbox
    const notifQuery = `
      INSERT INTO notification_outbox (
        id, appointment_id, type, recipient, subject, content, status, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SENT', NOW());
    `;
    await client.query(notifQuery, [
      `ntf_${Date.now()}`,
      appointmentId,
      'BOOKING_CONFIRMED',
      custUser?.email || customerEmail || 'customer@example.com',
      `Booking Confirmed: ${service.name}`,
      `Hi ${custUser?.name || customerName}, your appointment for ${service.name} with ${staffUser?.name || 'our specialist'} is confirmed for ${appointmentStart.toLocaleString()}.`,
    ]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        ...createdAppointment,
        serviceName: service.name,
        serviceDuration: service.durationMinutes,
        staffName: staffUser?.name || 'Specialist',
        customerName: custUser?.name || customerName,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating appointment:', error);
    if (error.code === '23P01') {
      // Exclusion constraint violation
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'This time slot was just taken by another booking. Please choose a different time.',
        },
      });
    }
    return res.status(500).json({ success: false, error: { message: error.message } });
  } finally {
    client.release();
  }
});

// Update appointment status / notes
router.patch('/appointments/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, customerNotes, cancellationReason } = req.body;

    const [apt] = await db.select().from(appointments).where(eq(appointments.id, id));
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }

    // Role permission check
    if (req.user?.role === 'CUSTOMER' && apt.customerId !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    const payload: any = { updatedAt: new Date() };
    if (status) payload.status = status;
    if (customerNotes !== undefined) payload.customerNotes = customerNotes;
    if (cancellationReason !== undefined) payload.cancellationReason = cancellationReason;

    const [updated] = await db
      .update(appointments)
      .set(payload)
      .where(eq(appointments.id, id))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Cancel appointment
router.post('/appointments/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    const [apt] = await db.select().from(appointments).where(eq(appointments.id, id));
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }

    if (req.user?.role === 'CUSTOMER' && apt.customerId !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    // Check cancellation notice policy (2 hours notice for customer)
    if (req.user?.role === 'CUSTOMER') {
      const hoursUntil = (new Date(apt.startAt).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 2) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LATE_CANCELLATION',
            message: 'Appointments can only be cancelled up to 2 hours before the start time.',
          },
        });
      }
    }

    const [updated] = await db
      .update(appointments)
      .set({
        status: 'CANCELLED',
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    // Log notification in outbox
    const [custUser] = await db.select().from(users).where(eq(users.id, apt.customerId));
    if (custUser?.email) {
      await db.insert(notificationOutbox).values({
        id: `ntf_${Date.now()}`,
        appointmentId: id,
        type: 'APPOINTMENT_CANCELLED',
        recipient: custUser.email,
        subject: 'Appointment Cancelled',
        content: `Your appointment scheduled for ${new Date(apt.startAt).toLocaleString()} has been cancelled.`,
        status: 'SENT',
        sentAt: new Date(),
      });
    }

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Reschedule appointment
router.post('/appointments/:id/reschedule', async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { newStartAt } = req.body;

    if (!newStartAt) {
      return res.status(400).json({
        success: false,
        error: { message: 'newStartAt is required' },
      });
    }

    const [apt] = await db.select().from(appointments).where(eq(appointments.id, id));
    if (!apt) {
      return res.status(404).json({ success: false, error: { message: 'Appointment not found' } });
    }

    if (req.user?.role === 'CUSTOMER' && apt.customerId !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    const [service] = await db.select().from(services).where(eq(services.id, apt.serviceId));
    const durationMinutes = service?.durationMinutes || 60;

    const startInstant = new Date(newStartAt);
    const endInstant = new Date(startInstant.getTime() + durationMinutes * 60 * 1000);

    await client.query('BEGIN');

    // Check conflict (ignoring the current appointment being rescheduled)
    const conflictQuery = `
      SELECT id FROM appointments
      WHERE staff_id = $1
        AND id != $2
        AND status != 'CANCELLED'
        AND tstzrange(start_at, end_at, '[)') && tstzrange($3, $4, '[)')
      FOR UPDATE;
    `;
    const conflictResult = await client.query(conflictQuery, [
      apt.staffId,
      id,
      startInstant.toISOString(),
      endInstant.toISOString(),
    ]);

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_UNAVAILABLE',
          message: 'The requested reschedule slot is already occupied.',
        },
      });
    }

    const updateQuery = `
      UPDATE appointments
      SET start_at = $1, end_at = $2, status = 'CONFIRMED', updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const updateResult = await client.query(updateQuery, [
      startInstant.toISOString(),
      endInstant.toISOString(),
      id,
    ]);

    await client.query('COMMIT');

    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: { message: error.message } });
  } finally {
    client.release();
  }
});

// ==========================================
// 6. DASHBOARD ANALYTICS
// ==========================================

router.get('/admin/overview', requireRole(['ADMIN', 'STAFF']), async (req: AuthRequest, res: Response) => {
  try {
    const allAppointments = await db.select().from(appointments);
    const now = new Date();

    // Start of today UTC
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

    // 7 days ago
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // 14 days ago (for comparison period)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const totalCount = allAppointments.length;
    const todayCount = allAppointments.filter((a) => {
      const d = new Date(a.startAt);
      return d >= startOfToday && d <= endOfToday && a.status !== 'CANCELLED';
    }).length;

    // Active customers (unique customer IDs with active appointments)
    const customerSet = new Set<string>();
    for (const a of allAppointments) {
      customerSet.add(a.customerId);
    }
    const activeCustomers = customerSet.size;

    // Completion rate = Completed / (Completed + Cancelled past + No Show)
    const pastAppointments = allAppointments.filter((a) => new Date(a.endAt) < now);
    const completedCount = pastAppointments.filter((a) => a.status === 'COMPLETED').length;
    const pastEligible = pastAppointments.length;
    const completionRate = pastEligible > 0 ? Math.round((completedCount / pastEligible) * 100) : 100;

    // Change vs previous 7-day period
    const currentPeriodCount = allAppointments.filter((a) => {
      const d = new Date(a.startAt);
      return d >= sevenDaysAgo && d <= now;
    }).length;
    const previousPeriodCount = allAppointments.filter((a) => {
      const d = new Date(a.startAt);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;

    const diff = currentPeriodCount - previousPeriodCount;
    const changeVersusPrevious = previousPeriodCount > 0 ? Math.round((diff / previousPeriodCount) * 100) : diff > 0 ? 100 : 0;

    // Group appointments by date for the chart (past 7 days + next 3 days)
    const chartDataMap: Record<string, { date: string; confirmed: number; completed: number; cancelled: number }> = {};
    for (let i = -6; i <= 3; i++) {
      const day = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const key = day.toISOString().split('T')[0];
      const label = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartDataMap[key] = { date: label, confirmed: 0, completed: 0, cancelled: 0 };
    }

    for (const a of allAppointments) {
      const key = new Date(a.startAt).toISOString().split('T')[0];
      if (chartDataMap[key]) {
        if (a.status === 'COMPLETED') chartDataMap[key].completed += 1;
        else if (a.status === 'CANCELLED') chartDataMap[key].cancelled += 1;
        else chartDataMap[key].confirmed += 1;
      }
    }

    const chartData = Object.values(chartDataMap);

    // Next 5 upcoming appointments
    const upcomingList = await db
      .select({
        id: appointments.id,
        startAt: appointments.startAt,
        status: appointments.status,
        customerName: users.name,
        customerAvatar: users.avatarUrl,
        serviceName: services.name,
        staffId: appointments.staffId,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.customerId, users.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(and(gte(appointments.startAt, now), ne(appointments.status, 'CANCELLED')))
      .orderBy(appointments.startAt)
      .limit(5);

    // Resolve staff names
    const staffUserRows = await db
      .select({ staffId: staffProfiles.id, staffName: users.name })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id));
    const sMap: Record<string, string> = {};
    for (const r of staffUserRows) sMap[r.staffId] = r.staffName;

    const upcomingAppointments = upcomingList.map((u) => ({
      ...u,
      staffName: sMap[u.staffId] || 'Specialist',
    }));

    return res.json({
      success: true,
      data: {
        kpis: {
          totalAppointments: totalCount,
          todayAppointments: todayCount,
          activeCustomers,
          completionRate,
          changeVersusPrevious,
          todayDateStr: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        },
        chartData,
        upcomingAppointments,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ==========================================
// 7. BUSINESS SETTINGS
// ==========================================

router.get('/settings', async (req: Request, res: Response) => {
  try {
    let [settings] = await db.select().from(businessSettings).limit(1);
    if (!settings) {
      const [created] = await db
        .insert(businessSettings)
        .values({
          id: 'cfg_default',
          businessName: 'BookFlow Studio',
          timezone: 'America/New_York',
        })
        .returning();
      settings = created;
    }
    return res.json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

router.patch('/settings', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    let [settings] = await db.select().from(businessSettings).limit(1);
    const { businessName, timezone, email, phone, address, minNoticeHours, maxAdvanceDays, slotIntervalMinutes, policyText } = req.body;

    const payload: any = { updatedAt: new Date() };
    if (businessName !== undefined) payload.businessName = businessName.trim();
    if (timezone !== undefined) payload.timezone = timezone.trim();
    if (email !== undefined) payload.email = email.trim();
    if (phone !== undefined) payload.phone = phone.trim();
    if (address !== undefined) payload.address = address.trim();
    if (minNoticeHours !== undefined) payload.minNoticeHours = Number(minNoticeHours);
    if (maxAdvanceDays !== undefined) payload.maxAdvanceDays = Number(maxAdvanceDays);
    if (slotIntervalMinutes !== undefined) payload.slotIntervalMinutes = Number(slotIntervalMinutes);
    if (policyText !== undefined) payload.policyText = policyText.trim();

    if (!settings) {
      const [created] = await db
        .insert(businessSettings)
        .values({ id: 'cfg_default', ...payload })
        .returning();
      return res.json({ success: true, data: created });
    }

    const [updated] = await db
      .update(businessSettings)
      .set(payload)
      .where(eq(businessSettings.id, settings.id))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Notifications outbox viewer for admin audit
router.get('/notifications', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const list = await db
      .select()
      .from(notificationOutbox)
      .orderBy(desc(notificationOutbox.createdAt))
      .limit(50);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
