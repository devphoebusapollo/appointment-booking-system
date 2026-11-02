# BookFlow — Business Appointment Booking System

BookFlow is a modern, production-grade appointment scheduling and business management system built with React, TypeScript, Tailwind CSS, Node.js/Express, and PostgreSQL with Drizzle ORM and Firebase Authentication.

---

## 🌟 Key Features

### 1. Customer Experience
- **5-Step Booking Flow**:
  1. **Choose Service**: Duration, pricing, and descriptions.
  2. **Select Specialist**: Individual staff profile or "Any Available Specialist" for maximum schedule availability.
  3. **Select Date & Time**: Month calendar with real-time available time slots computed against working hours, split shifts, existing bookings, and blocked times. Time zone explicitly stated.
  4. **Customer Information**: Contact details, custom notes, terms acceptance, and price breakdown.
  5. **Instant Confirmation**: Summary card with reference ID and notification dispatch.
- **Customer Dashboard (`My Appointments`)**:
  - Upcoming, Past, and Cancelled tabs.
  - Safe Rescheduling with slot selection.
  - Cancellation with policy enforcement (minimum 2 hours notice).

### 2. Staff Management & Scheduling
- **Weekly Working Hours**: Day-by-day availability toggles with multiple shift intervals (e.g. 9:00 AM–1:00 PM and 2:00 PM–5:30 PM).
- **Time Off & Blocked Periods**: Vacation and break blocks with conflict detection against active bookings.
- **Staff Profiles**: Specialties, bio, and assigned services.

### 3. Business Administration
- **Admin Dashboard**: Real PostgreSQL database metrics:
  - Total Appointments with 7-day period-over-period comparison.
  - Today's Appointments count.
  - Active Customers count.
  - Completion Rate percentage.
  - 7-Day Trend Chart by status (Confirmed, Completed, Cancelled).
  - Next 5 Upcoming Appointments.
  - Full-width recent activity table.
- **Appointments Management**:
  - Search and filter by Status, Service, Staff, and Date ranges.
  - 480px right-side slide-over details drawer.
  - Status transitions (Confirmed, Completed, No-Show, Cancelled).
  - Reschedule & Cancel actions with confirmation dialogs.
- **Master Calendar**: Day, Week, and Month views with staff filtering.
- **Services Management**: Full CRUD operations, pricing, duration, and practitioner assignments.
- **Staff Team**: Directory, activation toggles, and service links.
- **Customers Directory**: Lifetime spend and appointment history.
- **Analytics**: Service popularity breakdown, specialist workload, and status distribution charts.
- **Business Settings**: Notice hours, maximum advance booking window, slot increments, and Notification Outbox audit log.

---

## 🛡️ Database Safety & Concurrency

- **PostgreSQL GiST Exclusion Constraints**:
  ```sql
  ALTER TABLE appointments ADD CONSTRAINT no_overlapping_staff_appointments
  EXCLUDE USING gist (staff_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (status != 'CANCELLED');
  ```
- **Transactional Booking Engine**: Serialized booking checks preventing race conditions or double bookings.
- **Zero Orphaned Records**: Foreign key cascades and audit logs in `notification_outbox`.

---

## 🚀 Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server (runs Express API on port 3000 with Vite middleware):
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

---

## 👥 Seed Accounts (Persona Switcher)

Use the top-right persona switcher to experience the platform as different roles:
- **Admin**: Elena Rostova (`admin@bookflow.io`)
- **Staff / Specialist**: Dr. Sarah Jenkins (`sarah.jenkins@bookflow.io`)
- **Staff / Master Stylist**: Marcus Vance (`marcus.vance@bookflow.io`)
- **Staff / Therapist**: Chloe Chen (`chloe.chen@bookflow.io`)
- **Customer**: Sophia Martinez (`sophia.m@example.com`)
- **Customer**: David Kim (`david.kim@example.com`)
- **Google Sign-In**: Authenticate with any personal Google account via Firebase OAuth.
