# Local Development

## Prerequisites

- [Bun](https://bun.sh/) v1.x+
- [Docker](https://www.docker.com/) & Docker Compose
- Git

## 1. Clone the Repository

```bash
git clone https://github.com/senrecep/qms.git
cd qms
```

## 2. Create the Environment File

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Database - matches docker-compose defaults
DATABASE_URL=postgresql://qms:qms_password@localhost:5432/qms

# Redis - matches docker-compose defaults
REDIS_URL=redis://localhost:6379

# Auth - generate a 32+ character secret
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=QMS

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=500

# Cron job authentication
CRON_SECRET=dev-cron-secret-change-in-production

# Seed (Initial Admin User)
SEED_ADMIN_NAME=System Admin
SEED_ADMIN_EMAIL=admin@qms.com
SEED_ADMIN_PASSWORD=admin123456
SEED_DEFAULT_PASSWORD=User123!
SEED_EMAIL_DOMAIN=qms.com
```

> **Note on email settings:** Email configuration (provider, API keys, SMTP credentials, sender address) is managed through the **admin panel** at `/settings` after first login. The seed script creates default settings. You do not need to set email-related environment variables for local development - configure them from the UI instead.

To generate a secure auth secret:

```bash
openssl rand -base64 32
```

## 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

Verify the services are healthy:

```bash
docker compose ps
```

Expected output:
```
NAME            STATUS
dms-db-1        Up (healthy)
dms-redis-1     Up (healthy)
```

## 4. Install Dependencies

```bash
bun install
```

## 5. Set Up the Database

Push the schema to PostgreSQL:

```bash
bun run db:push
```

## 6. Seed the Database

The seed script creates test data using `SEED_*` variables from `.env.local`:

```bash
bun run db:seed
```

This creates:
- **4 departments**: Kalite Yönetimi, Üretim, İnsan Kaynakları, Bilgi Teknolojileri
- **11 users**: 1 admin + 4 managers + 6 users (across all departments)
- **11 sample documents** covering all 8 workflow statuses
- **14 revisions** with full approval, distribution, and read tracking data
- **13 system settings** (email config, reminder periods, etc.)

> **Warning:** The seed script **clears all existing data** before inserting. It is NOT idempotent - do not run on a database with real data.

**Login credentials:**

| Role | Email | Password |
|------|-------|----------|
| Admin | `SEED_ADMIN_EMAIL` (default: `admin@qms.com`) | `SEED_ADMIN_PASSWORD` |
| Managers | `quality.manager@{SEED_EMAIL_DOMAIN}`, etc. | `SEED_DEFAULT_PASSWORD` |
| Users | `quality.user@{SEED_EMAIL_DOMAIN}`, etc. | `SEED_DEFAULT_PASSWORD` |

**Seed environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_ADMIN_NAME` | `System Admin` | Admin display name |
| `SEED_ADMIN_EMAIL` | `admin@qms.com` | Admin login email |
| `SEED_ADMIN_PASSWORD` | `Admin123!` | Admin password |
| `SEED_DEFAULT_PASSWORD` | `User123!` | Password for all other seed users |
| `SEED_EMAIL_DOMAIN` | `qms.com` | Email domain for seed users |

**Document status coverage in seed data:**

| Status | Document Code | Description |
|--------|--------------|-------------|
| DRAFT | DOC-IT-001 | Freshly uploaded, not submitted |
| PENDING_APPROVAL | DOC-PRD-002 | Awaiting preparer approval |
| PREPARER_APPROVED | DOC-PRD-001 (rev1) | Awaiting final approver |
| PREPARER_REJECTED | DOC-IT-002 | Rejected by preparer with comment |
| APPROVED | DOC-QMS-002 | Ready to publish (migrated, rev 5) |
| APPROVER_REJECTED | DOC-HR-001 | Rejected by approver with comment |
| PUBLISHED | DOC-QMS-001, DOC-HR-002, DOC-PRD-003, DOC-HR-003 | Various read tracking states |
| CANCELLED | DOC-QMS-003 | Cancelled document |

> After logging in, the admin can create new users from `/users` and configure email settings from `/settings`.

## 7. Start the Development Server

```bash
bun dev
```

Open in your browser: [http://localhost:3000](http://localhost:3000)

## 8. Start the Background Worker

In a **separate terminal**, start the BullMQ worker for processing emails and notifications:

```bash
bun run worker:dev
```

The worker runs in watch mode and auto-restarts on code changes.

> **Important:** Without the worker running, emails and in-app notifications will be queued but not delivered.

## Available Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Development server (Turbopack) |
| `bun run build` | Production build |
| `bun run lint` | Run ESLint |
| `bun run db:generate` | Generate Drizzle migration files |
| `bun run db:push` | Push schema to database (no migration files) |
| `bun run db:studio` | Open Drizzle Studio GUI |
| `bun run db:seed` | Seed users, departments, sample documents, and settings |
| `bun run worker` | Start BullMQ worker |
| `bun run worker:dev` | Start BullMQ worker (watch mode) |

## Drizzle Studio

To visually inspect and edit the database:

```bash
bun run db:studio
```

Open in your browser: [https://local.drizzle.studio](https://local.drizzle.studio)

## Email Configuration

Email settings are managed entirely from the admin panel (`/settings`):

1. Log in as the admin user
2. Navigate to **Settings**
3. Under **Email Settings**, choose a provider:
   - **Resend** - Enter your API key from [resend.com](https://resend.com)
   - **SMTP** - Enter host, port, username, password, and SSL toggle
4. Set the **sender address** (e.g., `QMS <noreply@yourcompany.com>`)
5. Choose the **email language** (Turkish or English)
6. Use the **Send Test Email** button to verify the configuration

> Settings are stored in the `system_settings` database table and cached with a 60-second TTL. No application restart is needed after changing email settings.

## Troubleshooting

### Port Conflicts

If PostgreSQL (5432) or Redis (6379) ports are already in use:

```bash
# Find which process is using a port
lsof -i :5432
lsof -i :6379

# Or restart Docker containers
docker compose down
docker compose up -d
```

### Database Connection Errors

```bash
# Check container health
docker compose ps

# View database logs
docker compose logs db

# Restart the database container
docker compose restart db
```

### After Schema Changes

If you modify schema files in `src/lib/db/schema/`:

```bash
bun run db:generate  # Generate migration
bun run db:push      # Apply to database
```

### Redis Connection Errors

```bash
# Check Redis container logs
docker compose logs redis

# Test Redis connectivity
docker exec -it dms-redis-1 redis-cli ping
# Expected: PONG
```

### Uploads Directory

Ensure the uploads directory exists and is writable:

```bash
mkdir -p uploads
chmod 755 uploads
```

### Worker Not Processing Jobs

```bash
# Check if the worker is running
ps aux | grep worker

# Restart the worker
# (Ctrl+C the existing process, then)
bun run worker:dev

# Check Redis for queued jobs
docker exec -it dms-redis-1 redis-cli LLEN bull:email:wait
```
