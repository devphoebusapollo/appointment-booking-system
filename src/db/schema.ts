import { pgTable, text, integer, numeric, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (Stores Admins, Staff, and Customers)
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Firebase UID or UUID
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  role: text('role').notNull().default('CUSTOMER'), // 'ADMIN' | 'STAFF' | 'CUSTOMER'
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Staff profiles table
export const staffProfiles = pgTable('staff_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  title: text('title').notNull().default('Specialist'),
  bio: text('bio'),
  timezone: text('timezone').notNull().default('UTC'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Services table
export const services = pgTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Staff-Service join table (Which staff can perform which services)
export const staffServices = pgTable('staff_services', {
  staffId: text('staff_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.staffId, t.serviceId] }),
}));

// Weekly recurring availability rules for staff
export const availabilityRules = pgTable('availability_rules', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startMinute: integer('start_minute').notNull(), // e.g. 540 = 9:00 AM
  endMinute: integer('end_minute').notNull(),     // e.g. 1020 = 5:00 PM
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Blocked times and time-off for staff
export const blockedTimes = pgTable('blocked_times', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Appointments table
export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  staffId: text('staff_id').references(() => staffProfiles.id, { onDelete: 'cascade' }).notNull(),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'cascade' }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('CONFIRMED'), // PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW
  customerNotes: text('customer_notes'),
  priceCharged: numeric('price_charged', { precision: 10, scale: 2 }).notNull(),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Notification Outbox for reliable email tracking
export const notificationOutbox = pgTable('notification_outbox', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'BOOKING_CONFIRMED' | 'APPOINTMENT_CANCELLED' | 'APPOINTMENT_RESCHEDULED' | 'REMINDER'
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('SENT'), // 'PENDING' | 'SENT' | 'FAILED'
  attempts: integer('attempts').notNull().default(1),
  availableAt: timestamp('available_at', { withTimezone: true }).defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Business settings
export const businessSettings = pgTable('business_settings', {
  id: text('id').primaryKey(),
  businessName: text('business_name').notNull().default('BookFlow Studio'),
  timezone: text('timezone').notNull().default('America/New_York'),
  email: text('email').notNull().default('support@bookflow.io'),
  phone: text('phone').notNull().default('+1 (555) 234-5678'),
  address: text('address').notNull().default('100 Market St, Suite 400, San Francisco, CA'),
  minNoticeHours: integer('min_notice_hours').notNull().default(2),
  maxAdvanceDays: integer('max_advance_days').notNull().default(60),
  slotIntervalMinutes: integer('slot_interval_minutes').notNull().default(30),
  policyText: text('policy_text').notNull().default('Cancellations are accepted up to 2 hours before appointment time. Please arrive 5 minutes early.'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  staffProfile: one(staffProfiles, {
    fields: [users.id],
    references: [staffProfiles.userId],
  }),
  customerAppointments: many(appointments, { relationName: 'customerAppointments' }),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [staffProfiles.userId],
    references: [users.id],
  }),
  staffServices: many(staffServices),
  availabilityRules: many(availabilityRules),
  blockedTimes: many(blockedTimes),
  appointments: many(appointments, { relationName: 'staffAppointments' }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  staffServices: many(staffServices),
  appointments: many(appointments),
}));

export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  staff: one(staffProfiles, {
    fields: [staffServices.staffId],
    references: [staffProfiles.id],
  }),
  service: one(services, {
    fields: [staffServices.serviceId],
    references: [services.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  customer: one(users, {
    fields: [appointments.customerId],
    references: [users.id],
    relationName: 'customerAppointments',
  }),
  staff: one(staffProfiles, {
    fields: [appointments.staffId],
    references: [staffProfiles.id],
    relationName: 'staffAppointments',
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  notifications: many(notificationOutbox),
}));
