import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  departments,
  departmentMembers,
  systemSettings,
  documents,
  documentRevisions,
  approvals,
  distributionLists,
  distributionUsers,
  readConfirmations,
  activityLogs,
  notifications,
  session,
  account,
  verification,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN || "dms.com";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "System Admin";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || `admin@${EMAIL_DOMAIN}`;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "User123!";

// ── Pre-generated IDs ────────────────────────────────────────────────
const deptIds = {
  quality: nanoid(),
  production: nanoid(),
  hr: nanoid(),
  it: nanoid(),
};

const userIds = {
  admin: nanoid(),
  qualityManager: nanoid(),
  productionManager: nanoid(),
  hrManager: nanoid(),
  itManager: nanoid(),
  qualityUser1: nanoid(),
  qualityUser2: nanoid(),
  productionUser1: nanoid(),
  productionUser2: nanoid(),
  hrUser1: nanoid(),
  itUser1: nanoid(),
};

const docIds = {
  doc1: nanoid(),
  doc2: nanoid(),
  doc3: nanoid(),
  doc4: nanoid(),
  doc5: nanoid(),
  doc6: nanoid(),
  doc7: nanoid(),
  doc8: nanoid(),
  doc9: nanoid(),
  doc10: nanoid(),
  doc11: nanoid(),
};

const revIds = {
  doc1Rev0: nanoid(),
  doc2Rev0: nanoid(),
  doc2Rev1: nanoid(),
  doc3Rev0: nanoid(),
  doc4Rev0: nanoid(),
  doc5Rev5: nanoid(),
  doc6Rev0: nanoid(),
  doc7Rev0: nanoid(),
  doc8Rev0: nanoid(),
  doc9Rev0: nanoid(),
  doc10Rev0: nanoid(),
  doc10Rev1: nanoid(),
  doc10Rev2: nanoid(),
  doc11Rev0: nanoid(),
};

// ── Helper: create user via Better Auth ──────────────────────────────
async function createUser(
  name: string,
  email: string,
  password: string,
  role: "ADMIN" | "MANAGER" | "USER",
  _userId: string,
) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  User ${email} already exists, updating...`);
    await db
      .update(users)
      .set({ role, name })
      .where(eq(users.email, email));
    return existing[0].id;
  }

  // Create via Better Auth API (handles password hashing + account record)
  await auth.api.signUpEmail({
    body: { name, email, password },
  });

  // Update the auto-generated user with our desired role
  const [created] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!created) throw new Error(`Failed to create user: ${email}`);

  await db
    .update(users)
    .set({ role })
    .where(eq(users.id, created.id));

  return created.id;
}

// ── Helper timestamps ────────────────────────────────────────────────
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

async function seed() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║    DMS Database Seed Script          ║");
  console.log("╚══════════════════════════════════════╝\n");

  // ── 1. Clear tables (FK order) ───────────────────────────────────
  console.log("Clearing existing data...");
  await db.delete(notifications);
  await db.delete(readConfirmations);
  await db.delete(distributionUsers);
  await db.delete(distributionLists);
  await db.delete(activityLogs);
  await db.delete(approvals);
  // Clear currentRevisionId before deleting revisions
  await db.update(documents).set({ currentRevisionId: null, currentRevisionNo: 0 });
  await db.delete(documentRevisions);
  await db.delete(documents);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(departmentMembers);
  await db.delete(users);
  await db.delete(departments);
  await db.delete(systemSettings);
  console.log("  All tables cleared.\n");

  // ── 2. Departments ──────────────────────────────────────────────
  console.log("Creating departments...");
  await db.insert(departments).values([
    {
      id: deptIds.quality,
      name: "Kalite Yönetimi",
      slug: "quality",
      description: "Quality Management Department",
    },
    {
      id: deptIds.production,
      name: "Üretim",
      slug: "production",
      description: "Production Department",
    },
    {
      id: deptIds.hr,
      name: "İnsan Kaynakları",
      slug: "hr",
      description: "Human Resources Department",
    },
    {
      id: deptIds.it,
      name: "Bilgi Teknolojileri",
      slug: "it",
      description: "Information Technology Department",
    },
  ]);
  console.log("  4 departments created.\n");

  // ── 3. Users ────────────────────────────────────────────────────
  console.log("Creating users...");

  const u: Record<string, string> = {};

  u.admin = await createUser(
    ADMIN_NAME,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    "ADMIN",
    userIds.admin,
  );
  console.log(`  ✓ Admin: ${ADMIN_EMAIL}`);

  u.qualityManager = await createUser(
    "Ahmet Yılmaz",
    `quality.manager@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "MANAGER",
    userIds.qualityManager,
  );
  console.log(`  ✓ Quality Manager: quality.manager@${EMAIL_DOMAIN}`);

  u.productionManager = await createUser(
    "Mehmet Demir",
    `production.manager@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "MANAGER",
    userIds.productionManager,
  );
  console.log(`  ✓ Production Manager: production.manager@${EMAIL_DOMAIN}`);

  u.hrManager = await createUser(
    "Ayşe Kaya",
    `hr.manager@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "MANAGER",
    userIds.hrManager,
  );
  console.log(`  ✓ HR Manager: hr.manager@${EMAIL_DOMAIN}`);

  u.itManager = await createUser(
    "Can Özkan",
    `it.manager@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "MANAGER",
    userIds.itManager,
  );
  console.log(`  ✓ IT Manager: it.manager@${EMAIL_DOMAIN}`);

  u.qualityUser1 = await createUser(
    "Elif Arslan",
    `quality.user@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "USER",
    userIds.qualityUser1,
  );
  console.log(`  ✓ Quality User: quality.user@${EMAIL_DOMAIN}`);

  u.qualityUser2 = await createUser(
    "Burak Koç",
    `quality.user2@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "USER",
    userIds.qualityUser2,
  );
  console.log(`  ✓ Quality User 2: quality.user2@${EMAIL_DOMAIN}`);

  u.productionUser1 = await createUser(
    "Ali Çelik",
    `production.user@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "USER",
    userIds.productionUser1,
  );
  console.log(`  ✓ Production User: production.user@${EMAIL_DOMAIN}`);

  u.productionUser2 = await createUser(
    "Fatma Yıldız",
    `production.user2@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "USER",
    userIds.productionUser2,
  );
  console.log(`  ✓ Production User 2: production.user2@${EMAIL_DOMAIN}`);

  u.hrUser1 = await createUser(
    "Zeynep Şahin",
    `hr.user@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "USER",
    userIds.hrUser1,
  );
  console.log(`  ✓ HR User: hr.user@${EMAIL_DOMAIN}`);

  u.itUser1 = await createUser(
    "Emre Aydın",
    `it.user@${EMAIL_DOMAIN}`,
    DEFAULT_PASSWORD,
    "USER",
    userIds.itUser1,
  );
  console.log(`  ✓ IT User: it.user@${EMAIL_DOMAIN}`);

  // ── Insert department_members ────────────────────────────────────
  console.log("Creating department memberships...");
  await db.insert(departmentMembers).values([
    // Managers
    { userId: u.qualityManager, departmentId: deptIds.quality, role: "MANAGER" },
    { userId: u.productionManager, departmentId: deptIds.production, role: "MANAGER" },
    { userId: u.hrManager, departmentId: deptIds.hr, role: "MANAGER" },
    { userId: u.itManager, departmentId: deptIds.it, role: "MANAGER" },
    // Members
    { userId: u.qualityUser1, departmentId: deptIds.quality, role: "MEMBER" },
    { userId: u.qualityUser2, departmentId: deptIds.quality, role: "MEMBER" },
    { userId: u.productionUser1, departmentId: deptIds.production, role: "MEMBER" },
    { userId: u.productionUser2, departmentId: deptIds.production, role: "MEMBER" },
    { userId: u.hrUser1, departmentId: deptIds.hr, role: "MEMBER" },
    { userId: u.itUser1, departmentId: deptIds.it, role: "MEMBER" },
  ]);
  console.log("  Department memberships created.\n");

  // ── 4. System Settings ──────────────────────────────────────────
  console.log("Creating system settings...");
  await db.insert(systemSettings).values([
    { key: "app_name", value: "DMS", description: "Application display name" },
    {
      key: "default_reminder_days",
      value: "3",
      description: "Days before sending unread document reminders",
    },
    {
      key: "default_escalation_days",
      value: "7",
      description: "Days before escalating pending approvals",
    },
    {
      key: "read_reminder_days",
      value: "3",
      description: "Days before sending read confirmation reminders",
    },
    {
      key: "email_provider",
      value: "resend",
      description: "Email provider: resend or smtp",
    },
    {
      key: "email_from",
      value: process.env.EMAIL_FROM || "DMS <noreply@example.com>",
      description: "Default sender email address",
    },
    {
      key: "email_resend_api_key",
      value: process.env.RESEND_API_KEY || "",
      description: "Resend API key for email delivery",
    },
    { key: "email_smtp_host", value: "", description: "SMTP server hostname" },
    { key: "email_smtp_port", value: "587", description: "SMTP server port" },
    { key: "email_smtp_user", value: "", description: "SMTP authentication username" },
    { key: "email_smtp_pass", value: "", description: "SMTP authentication password" },
    {
      key: "email_smtp_secure",
      value: "false",
      description: "Use SSL/TLS for SMTP connection",
    },
    {
      key: "email_language",
      value: "en",
      description: "Email template language: tr or en",
    },
  ]);
  console.log("  13 system settings created.\n");

  // ════════════════════════════════════════════════════════════════
  // ── 5. Documents + Revisions ──────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  console.log("Creating documents and revisions...\n");

  // ──────────────────────────────────────────────────────────────
  // DOC 1: PUBLISHED PROCEDURE with partial read tracking
  // Scenario: Normal full flow, 2/4 users confirmed reading
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc1,
    documentCode: "DOC-QMS-001",
    createdAt: daysAgo(30),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc1Rev0,
    documentId: docIds.doc1,
    revisionNo: 0,
    title: "Quality Management Procedure",
    description: "Standard operating procedure for quality management system",
    documentType: "PROCEDURE",
    status: "PUBLISHED",
    departmentId: deptIds.quality,
    preparerDepartmentId: deptIds.quality,
    preparerId: u.qualityManager,
    approverId: u.admin,
    createdById: u.qualityManager,
    filePath: "uploads/2026/01/doc1/quality-management-procedure.pdf",
    fileName: "quality-management-procedure.pdf",
    fileSize: 245000,
    mimeType: "application/pdf",
    publishedAt: daysAgo(25),
    createdAt: daysAgo(30),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc1Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc1));

  await db.insert(approvals).values([
    {
      id: nanoid(),
      revisionId: revIds.doc1Rev0,
      approverId: u.qualityManager,
      approvalType: "PREPARER",
      status: "APPROVED",
      respondedAt: daysAgo(29),
      createdAt: daysAgo(30),
    },
    {
      id: nanoid(),
      revisionId: revIds.doc1Rev0,
      approverId: u.admin,
      approvalType: "APPROVER",
      status: "APPROVED",
      respondedAt: daysAgo(26),
      createdAt: daysAgo(29),
    },
  ]);

  // Distribution → Üretim + İK departments
  await db.insert(distributionLists).values([
    { id: nanoid(), revisionId: revIds.doc1Rev0, departmentId: deptIds.production, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, departmentId: deptIds.hr, createdAt: daysAgo(25) },
  ]);

  await db.insert(distributionUsers).values([
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.productionManager, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.productionUser1, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.productionUser2, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.hrManager, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.hrUser1, createdAt: daysAgo(25) },
  ]);

  // Read: 2 confirmed, 3 pending
  await db.insert(readConfirmations).values([
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.productionManager, confirmedAt: daysAgo(23), createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.productionUser1, confirmedAt: daysAgo(22), createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.productionUser2, confirmedAt: null, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.hrManager, confirmedAt: null, createdAt: daysAgo(25) },
    { id: nanoid(), revisionId: revIds.doc1Rev0, userId: u.hrUser1, confirmedAt: null, createdAt: daysAgo(25) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc1, revisionId: revIds.doc1Rev0, userId: u.qualityManager, action: "UPLOADED", details: { fileName: "quality-management-procedure.pdf" }, createdAt: daysAgo(30) },
    { id: nanoid(), documentId: docIds.doc1, revisionId: revIds.doc1Rev0, userId: u.qualityManager, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(30) },
    { id: nanoid(), documentId: docIds.doc1, revisionId: revIds.doc1Rev0, userId: u.qualityManager, action: "PREPARER_APPROVED", details: { approvalType: "PREPARER" }, createdAt: daysAgo(29) },
    { id: nanoid(), documentId: docIds.doc1, revisionId: revIds.doc1Rev0, userId: u.admin, action: "APPROVED", details: { approvalType: "APPROVER" }, createdAt: daysAgo(26) },
    { id: nanoid(), documentId: docIds.doc1, revisionId: revIds.doc1Rev0, userId: u.admin, action: "PUBLISHED", details: { distributedTo: ["Üretim", "İnsan Kaynakları"] }, createdAt: daysAgo(25) },
  ]);

  console.log("  ✓ DOC-QMS-001: PUBLISHED procedure, partial read (2/5)");

  // ──────────────────────────────────────────────────────────────
  // DOC 2: Two revisions, rev1 in PREPARER_APPROVED (awaiting approver)
  // Scenario: Active revision process
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc2,
    documentCode: "DOC-PRD-001",
    createdAt: daysAgo(60),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc2Rev0,
    documentId: docIds.doc2,
    revisionNo: 0,
    title: "Production Safety Instructions v1",
    description: "Safety instructions for production line workers",
    documentType: "INSTRUCTION",
    status: "PUBLISHED",
    departmentId: deptIds.production,
    preparerDepartmentId: deptIds.production,
    preparerId: u.productionManager,
    approverId: u.admin,
    createdById: u.productionManager,
    filePath: "uploads/2025/12/doc2/production-safety-v1.pdf",
    fileName: "production-safety-v1.pdf",
    fileSize: 180000,
    mimeType: "application/pdf",
    publishedAt: daysAgo(50),
    createdAt: daysAgo(60),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc2Rev1,
    documentId: docIds.doc2,
    revisionNo: 1,
    title: "Production Safety Instructions v2",
    description: "Updated safety instructions with new machine guidelines",
    documentType: "INSTRUCTION",
    status: "PREPARER_APPROVED",
    departmentId: deptIds.production,
    preparerDepartmentId: deptIds.production,
    preparerId: u.productionManager,
    approverId: u.admin,
    createdById: u.productionManager,
    filePath: "uploads/2026/02/doc2/production-safety-v2.pdf",
    fileName: "production-safety-v2.pdf",
    fileSize: 210000,
    mimeType: "application/pdf",
    changes: "Added new machine safety guidelines for CNC operations",
    createdAt: daysAgo(5),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc2Rev1, currentRevisionNo: 1 })
    .where(eq(documents.id, docIds.doc2));

  await db.insert(approvals).values([
    { id: nanoid(), revisionId: revIds.doc2Rev0, approverId: u.productionManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(58), createdAt: daysAgo(60) },
    { id: nanoid(), revisionId: revIds.doc2Rev0, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(52), createdAt: daysAgo(58) },
    { id: nanoid(), revisionId: revIds.doc2Rev1, approverId: u.productionManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(4), createdAt: daysAgo(5) },
    { id: nanoid(), revisionId: revIds.doc2Rev1, approverId: u.admin, approvalType: "APPROVER", status: "PENDING", createdAt: daysAgo(4) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev0, userId: u.productionManager, action: "UPLOADED", details: { fileName: "production-safety-v1.pdf" }, createdAt: daysAgo(60) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev0, userId: u.productionManager, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(60) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev0, userId: u.productionManager, action: "PREPARER_APPROVED", details: { approvalType: "PREPARER" }, createdAt: daysAgo(58) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev0, userId: u.admin, action: "APPROVED", details: { approvalType: "APPROVER" }, createdAt: daysAgo(52) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev0, userId: u.admin, action: "PUBLISHED", details: {}, createdAt: daysAgo(50) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev1, userId: u.productionManager, action: "REVISED", details: { fromRevision: 0, toRevision: 1 }, createdAt: daysAgo(5) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev1, userId: u.productionManager, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(5) },
    { id: nanoid(), documentId: docIds.doc2, revisionId: revIds.doc2Rev1, userId: u.productionManager, action: "PREPARER_APPROVED", details: { approvalType: "PREPARER" }, createdAt: daysAgo(4) },
  ]);

  console.log("  ✓ DOC-PRD-001: PREPARER_APPROVED (rev1), awaiting approver");

  // ──────────────────────────────────────────────────────────────
  // DOC 3: APPROVER_REJECTED
  // Scenario: Approver rejected with comment
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc3,
    documentCode: "DOC-HR-001",
    createdAt: daysAgo(15),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc3Rev0,
    documentId: docIds.doc3,
    revisionNo: 0,
    title: "Employee Onboarding Form",
    description: "Standard onboarding form for new employees",
    documentType: "FORM",
    status: "APPROVER_REJECTED",
    departmentId: deptIds.hr,
    preparerDepartmentId: deptIds.hr,
    preparerId: u.hrManager,
    approverId: u.admin,
    createdById: u.hrManager,
    filePath: "uploads/2026/02/doc3/employee-onboarding-form.pdf",
    fileName: "employee-onboarding-form.pdf",
    fileSize: 95000,
    mimeType: "application/pdf",
    createdAt: daysAgo(15),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc3Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc3));

  await db.insert(approvals).values([
    { id: nanoid(), revisionId: revIds.doc3Rev0, approverId: u.hrManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(14), createdAt: daysAgo(15) },
    { id: nanoid(), revisionId: revIds.doc3Rev0, approverId: u.admin, approvalType: "APPROVER", status: "REJECTED", comment: "Needs more detail on benefits section", respondedAt: daysAgo(12), createdAt: daysAgo(14) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc3, revisionId: revIds.doc3Rev0, userId: u.hrManager, action: "UPLOADED", details: { fileName: "employee-onboarding-form.pdf" }, createdAt: daysAgo(15) },
    { id: nanoid(), documentId: docIds.doc3, revisionId: revIds.doc3Rev0, userId: u.hrManager, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(15) },
    { id: nanoid(), documentId: docIds.doc3, revisionId: revIds.doc3Rev0, userId: u.hrManager, action: "PREPARER_APPROVED", details: { approvalType: "PREPARER" }, createdAt: daysAgo(14) },
    { id: nanoid(), documentId: docIds.doc3, revisionId: revIds.doc3Rev0, userId: u.admin, action: "APPROVER_REJECTED", details: { approvalType: "APPROVER", comment: "Needs more detail on benefits section" }, createdAt: daysAgo(12) },
  ]);

  console.log("  ✓ DOC-HR-001: APPROVER_REJECTED form");

  // ──────────────────────────────────────────────────────────────
  // DOC 4: DRAFT
  // Scenario: Freshly uploaded, not yet submitted
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc4,
    documentCode: "DOC-IT-001",
    createdAt: daysAgo(3),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc4Rev0,
    documentId: docIds.doc4,
    revisionNo: 0,
    title: "IT Security Policy",
    description: "Information security policy for the organization",
    documentType: "PROCEDURE",
    status: "DRAFT",
    departmentId: deptIds.it,
    preparerDepartmentId: deptIds.it,
    preparerId: u.itManager,
    approverId: u.admin,
    createdById: u.itManager,
    filePath: "uploads/2026/02/doc4/it-security-policy.pdf",
    fileName: "it-security-policy.pdf",
    fileSize: 320000,
    mimeType: "application/pdf",
    createdAt: daysAgo(3),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc4Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc4));

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc4, revisionId: revIds.doc4Rev0, userId: u.itManager, action: "UPLOADED", details: { fileName: "it-security-policy.pdf" }, createdAt: daysAgo(3) },
  ]);

  console.log("  ✓ DOC-IT-001: DRAFT procedure");

  // ──────────────────────────────────────────────────────────────
  // DOC 5: APPROVED (migrated from legacy, revision 5)
  // Scenario: Document imported from previous system
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc5,
    documentCode: "DOC-QMS-002",
    createdAt: daysAgo(90),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc5Rev5,
    documentId: docIds.doc5,
    revisionNo: 5,
    title: "Internal Audit Procedure",
    description: "Procedure for conducting internal quality audits (migrated from legacy system)",
    documentType: "PROCEDURE",
    status: "APPROVED",
    departmentId: deptIds.quality,
    preparerDepartmentId: deptIds.quality,
    preparerId: u.qualityManager,
    approverId: u.admin,
    createdById: u.qualityManager,
    filePath: "uploads/2025/11/doc5/internal-audit-procedure-v5.pdf",
    fileName: "internal-audit-procedure-v5.pdf",
    fileSize: 275000,
    mimeType: "application/pdf",
    createdAt: daysAgo(90),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc5Rev5, currentRevisionNo: 5 })
    .where(eq(documents.id, docIds.doc5));

  await db.insert(approvals).values([
    { id: nanoid(), revisionId: revIds.doc5Rev5, approverId: u.qualityManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(88), createdAt: daysAgo(90) },
    { id: nanoid(), revisionId: revIds.doc5Rev5, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(85), createdAt: daysAgo(88) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc5, revisionId: revIds.doc5Rev5, userId: u.qualityManager, action: "UPLOADED", details: { fileName: "internal-audit-procedure-v5.pdf", migratedRevision: 5 }, createdAt: daysAgo(90) },
    { id: nanoid(), documentId: docIds.doc5, revisionId: revIds.doc5Rev5, userId: u.admin, action: "APPROVED", details: { approvalType: "APPROVER", migrated: true }, createdAt: daysAgo(85) },
  ]);

  console.log("  ✓ DOC-QMS-002: APPROVED procedure (migrated, rev 5)");

  // ──────────────────────────────────────────────────────────────
  // DOC 6: PENDING_APPROVAL
  // Scenario: Submitted, waiting for preparer to approve
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc6,
    documentCode: "DOC-PRD-002",
    createdAt: daysAgo(2),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc6Rev0,
    documentId: docIds.doc6,
    revisionNo: 0,
    title: "Machine Maintenance Checklist",
    description: "Daily maintenance checklist for CNC machines",
    documentType: "FORM",
    status: "PENDING_APPROVAL",
    departmentId: deptIds.production,
    preparerDepartmentId: deptIds.production,
    preparerId: u.productionManager,
    approverId: u.admin,
    createdById: u.productionUser1,
    filePath: "uploads/2026/02/doc6/machine-maintenance-checklist.pdf",
    fileName: "machine-maintenance-checklist.pdf",
    fileSize: 78000,
    mimeType: "application/pdf",
    createdAt: daysAgo(2),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc6Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc6));

  await db.insert(approvals).values([
    { id: nanoid(), revisionId: revIds.doc6Rev0, approverId: u.productionManager, approvalType: "PREPARER", status: "PENDING", createdAt: daysAgo(2) },
    { id: nanoid(), revisionId: revIds.doc6Rev0, approverId: u.admin, approvalType: "APPROVER", status: "PENDING", createdAt: daysAgo(2) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc6, revisionId: revIds.doc6Rev0, userId: u.productionUser1, action: "UPLOADED", details: { fileName: "machine-maintenance-checklist.pdf" }, createdAt: daysAgo(2) },
    { id: nanoid(), documentId: docIds.doc6, revisionId: revIds.doc6Rev0, userId: u.productionUser1, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(2) },
  ]);

  console.log("  ✓ DOC-PRD-002: PENDING_APPROVAL form (awaiting preparer)");

  // ──────────────────────────────────────────────────────────────
  // DOC 7: PUBLISHED FORM with 100% read confirmation
  // Scenario: All distributed users have confirmed reading
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc7,
    documentCode: "DOC-HR-002",
    createdAt: daysAgo(45),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc7Rev0,
    documentId: docIds.doc7,
    revisionNo: 0,
    title: "Leave Request Form",
    description: "Standard form for requesting annual and sick leave",
    documentType: "FORM",
    status: "PUBLISHED",
    departmentId: deptIds.hr,
    preparerDepartmentId: deptIds.hr,
    preparerId: u.hrManager,
    approverId: u.admin,
    createdById: u.hrManager,
    filePath: "uploads/2026/01/doc7/leave-request-form.pdf",
    fileName: "leave-request-form.pdf",
    fileSize: 62000,
    mimeType: "application/pdf",
    publishedAt: daysAgo(40),
    createdAt: daysAgo(45),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc7Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc7));

  await db.insert(approvals).values([
    { id: nanoid(), revisionId: revIds.doc7Rev0, approverId: u.hrManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(44), createdAt: daysAgo(45) },
    { id: nanoid(), revisionId: revIds.doc7Rev0, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(41), createdAt: daysAgo(44) },
  ]);

  // Distributed to ALL departments
  await db.insert(distributionLists).values([
    { id: nanoid(), revisionId: revIds.doc7Rev0, departmentId: deptIds.quality, createdAt: daysAgo(40) },
    { id: nanoid(), revisionId: revIds.doc7Rev0, departmentId: deptIds.production, createdAt: daysAgo(40) },
    { id: nanoid(), revisionId: revIds.doc7Rev0, departmentId: deptIds.hr, createdAt: daysAgo(40) },
    { id: nanoid(), revisionId: revIds.doc7Rev0, departmentId: deptIds.it, createdAt: daysAgo(40) },
  ]);

  const doc7AllUsers = [
    u.qualityManager, u.qualityUser1, u.qualityUser2,
    u.productionManager, u.productionUser1, u.productionUser2,
    u.hrUser1,
    u.itManager, u.itUser1,
  ];

  await db.insert(distributionUsers).values(
    doc7AllUsers.map((userId) => ({
      id: nanoid(),
      revisionId: revIds.doc7Rev0,
      userId,
      createdAt: daysAgo(40),
    })),
  );

  // ALL users confirmed reading
  await db.insert(readConfirmations).values(
    doc7AllUsers.map((userId, i) => ({
      id: nanoid(),
      revisionId: revIds.doc7Rev0,
      userId,
      confirmedAt: daysAgo(40 - (i + 1)), // Staggered confirmations
      createdAt: daysAgo(40),
    })),
  );

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc7, revisionId: revIds.doc7Rev0, userId: u.hrManager, action: "UPLOADED", details: { fileName: "leave-request-form.pdf" }, createdAt: daysAgo(45) },
    { id: nanoid(), documentId: docIds.doc7, revisionId: revIds.doc7Rev0, userId: u.hrManager, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(45) },
    { id: nanoid(), documentId: docIds.doc7, revisionId: revIds.doc7Rev0, userId: u.hrManager, action: "PREPARER_APPROVED", details: { approvalType: "PREPARER" }, createdAt: daysAgo(44) },
    { id: nanoid(), documentId: docIds.doc7, revisionId: revIds.doc7Rev0, userId: u.admin, action: "APPROVED", details: { approvalType: "APPROVER" }, createdAt: daysAgo(41) },
    { id: nanoid(), documentId: docIds.doc7, revisionId: revIds.doc7Rev0, userId: u.admin, action: "PUBLISHED", details: { distributedTo: ["Kalite Yönetimi", "Üretim", "İnsan Kaynakları", "Bilgi Teknolojileri"] }, createdAt: daysAgo(40) },
  ]);

  console.log("  ✓ DOC-HR-002: PUBLISHED form, 100% read confirmed (9/9)");

  // ──────────────────────────────────────────────────────────────
  // DOC 8: PREPARER_REJECTED
  // Scenario: Preparer rejected the document before approver saw it
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc8,
    documentCode: "DOC-IT-002",
    createdAt: daysAgo(7),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc8Rev0,
    documentId: docIds.doc8,
    revisionNo: 0,
    title: "Network Configuration Guide",
    description: "Guide for configuring network switches and routers",
    documentType: "INSTRUCTION",
    status: "PREPARER_REJECTED",
    departmentId: deptIds.it,
    preparerDepartmentId: deptIds.it,
    preparerId: u.itManager,
    approverId: u.admin,
    createdById: u.itUser1,
    filePath: "uploads/2026/02/doc8/network-config-guide.pdf",
    fileName: "network-config-guide.pdf",
    fileSize: 156000,
    mimeType: "application/pdf",
    createdAt: daysAgo(7),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc8Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc8));

  await db.insert(approvals).values([
    {
      id: nanoid(),
      revisionId: revIds.doc8Rev0,
      approverId: u.itManager,
      approvalType: "PREPARER",
      status: "REJECTED",
      comment: "Diagrams are missing for the VLAN configuration section. Please add them.",
      respondedAt: daysAgo(6),
      createdAt: daysAgo(7),
    },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc8, revisionId: revIds.doc8Rev0, userId: u.itUser1, action: "UPLOADED", details: { fileName: "network-config-guide.pdf" }, createdAt: daysAgo(7) },
    { id: nanoid(), documentId: docIds.doc8, revisionId: revIds.doc8Rev0, userId: u.itUser1, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(7) },
    { id: nanoid(), documentId: docIds.doc8, revisionId: revIds.doc8Rev0, userId: u.itManager, action: "PREPARER_REJECTED", details: { approvalType: "PREPARER", comment: "Diagrams are missing for the VLAN configuration section. Please add them." }, createdAt: daysAgo(6) },
  ]);

  console.log("  ✓ DOC-IT-002: PREPARER_REJECTED instruction");

  // ──────────────────────────────────────────────────────────────
  // DOC 9: CANCELLED
  // Scenario: Document was cancelled after being in draft
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc9,
    documentCode: "DOC-QMS-003",
    createdAt: daysAgo(20),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc9Rev0,
    documentId: docIds.doc9,
    revisionNo: 0,
    title: "Supplier Evaluation Procedure (Obsolete)",
    description: "Procedure for evaluating and scoring suppliers - cancelled due to process change",
    documentType: "PROCEDURE",
    status: "CANCELLED",
    departmentId: deptIds.quality,
    preparerDepartmentId: deptIds.quality,
    preparerId: u.qualityManager,
    approverId: u.admin,
    createdById: u.qualityManager,
    filePath: "uploads/2026/01/doc9/supplier-evaluation.pdf",
    fileName: "supplier-evaluation.pdf",
    fileSize: 198000,
    mimeType: "application/pdf",
    createdAt: daysAgo(20),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc9Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc9));

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc9, revisionId: revIds.doc9Rev0, userId: u.qualityManager, action: "UPLOADED", details: { fileName: "supplier-evaluation.pdf" }, createdAt: daysAgo(20) },
    { id: nanoid(), documentId: docIds.doc9, revisionId: revIds.doc9Rev0, userId: u.admin, action: "CANCELLED", details: { reason: "Process replaced by new supplier management system" }, createdAt: daysAgo(18) },
  ]);

  console.log("  ✓ DOC-QMS-003: CANCELLED procedure");

  // ──────────────────────────────────────────────────────────────
  // DOC 10: PUBLISHED with full revision history (rev0→rev1→rev2)
  // Scenario: Document evolved through 3 revisions, all published
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc10,
    documentCode: "DOC-PRD-003",
    createdAt: daysAgo(120),
  });

  // Revision 0 (oldest published)
  await db.insert(documentRevisions).values({
    id: revIds.doc10Rev0,
    documentId: docIds.doc10,
    revisionNo: 0,
    title: "Warehouse Receiving Procedure v1",
    description: "Procedure for receiving and inspecting incoming materials",
    documentType: "PROCEDURE",
    status: "PUBLISHED",
    departmentId: deptIds.production,
    preparerDepartmentId: deptIds.production,
    preparerId: u.productionManager,
    approverId: u.admin,
    createdById: u.productionManager,
    filePath: "uploads/2025/10/doc10/warehouse-receiving-v1.pdf",
    fileName: "warehouse-receiving-v1.pdf",
    fileSize: 145000,
    mimeType: "application/pdf",
    publishedAt: daysAgo(110),
    createdAt: daysAgo(120),
  });

  // Revision 1 (second published)
  await db.insert(documentRevisions).values({
    id: revIds.doc10Rev1,
    documentId: docIds.doc10,
    revisionNo: 1,
    title: "Warehouse Receiving Procedure v2",
    description: "Updated with barcode scanning requirements",
    documentType: "PROCEDURE",
    status: "PUBLISHED",
    departmentId: deptIds.production,
    preparerDepartmentId: deptIds.production,
    preparerId: u.productionManager,
    approverId: u.admin,
    createdById: u.productionManager,
    filePath: "uploads/2025/12/doc10/warehouse-receiving-v2.pdf",
    fileName: "warehouse-receiving-v2.pdf",
    fileSize: 168000,
    mimeType: "application/pdf",
    changes: "Added barcode scanning step and quality inspection checklist",
    publishedAt: daysAgo(70),
    createdAt: daysAgo(80),
  });

  // Revision 2 (latest published)
  await db.insert(documentRevisions).values({
    id: revIds.doc10Rev2,
    documentId: docIds.doc10,
    revisionNo: 2,
    title: "Warehouse Receiving Procedure v3",
    description: "Added hazardous materials handling section",
    documentType: "PROCEDURE",
    status: "PUBLISHED",
    departmentId: deptIds.production,
    preparerDepartmentId: deptIds.production,
    preparerId: u.productionManager,
    approverId: u.admin,
    createdById: u.productionManager,
    filePath: "uploads/2026/01/doc10/warehouse-receiving-v3.pdf",
    fileName: "warehouse-receiving-v3.pdf",
    fileSize: 195000,
    mimeType: "application/pdf",
    changes: "Added Section 5: Hazardous Materials Handling Protocol",
    publishedAt: daysAgo(10),
    createdAt: daysAgo(20),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc10Rev2, currentRevisionNo: 2 })
    .where(eq(documents.id, docIds.doc10));

  // Approvals for all 3 revisions
  await db.insert(approvals).values([
    // Rev 0
    { id: nanoid(), revisionId: revIds.doc10Rev0, approverId: u.productionManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(118), createdAt: daysAgo(120) },
    { id: nanoid(), revisionId: revIds.doc10Rev0, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(112), createdAt: daysAgo(118) },
    // Rev 1
    { id: nanoid(), revisionId: revIds.doc10Rev1, approverId: u.productionManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(78), createdAt: daysAgo(80) },
    { id: nanoid(), revisionId: revIds.doc10Rev1, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(72), createdAt: daysAgo(78) },
    // Rev 2
    { id: nanoid(), revisionId: revIds.doc10Rev2, approverId: u.productionManager, approvalType: "PREPARER", status: "APPROVED", respondedAt: daysAgo(18), createdAt: daysAgo(20) },
    { id: nanoid(), revisionId: revIds.doc10Rev2, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(12), createdAt: daysAgo(18) },
  ]);

  // Distribution for latest rev (rev2) → Quality + Production
  await db.insert(distributionLists).values([
    { id: nanoid(), revisionId: revIds.doc10Rev2, departmentId: deptIds.production, createdAt: daysAgo(10) },
    { id: nanoid(), revisionId: revIds.doc10Rev2, departmentId: deptIds.quality, createdAt: daysAgo(10) },
  ]);

  const doc10DistUsers = [u.productionUser1, u.productionUser2, u.qualityUser1, u.qualityUser2];
  await db.insert(distributionUsers).values(
    doc10DistUsers.map((userId) => ({
      id: nanoid(),
      revisionId: revIds.doc10Rev2,
      userId,
      createdAt: daysAgo(10),
    })),
  );

  // 2/4 confirmed for rev2
  await db.insert(readConfirmations).values([
    { id: nanoid(), revisionId: revIds.doc10Rev2, userId: u.productionUser1, confirmedAt: daysAgo(8), createdAt: daysAgo(10) },
    { id: nanoid(), revisionId: revIds.doc10Rev2, userId: u.qualityUser1, confirmedAt: daysAgo(7), createdAt: daysAgo(10) },
    { id: nanoid(), revisionId: revIds.doc10Rev2, userId: u.productionUser2, confirmedAt: null, createdAt: daysAgo(10) },
    { id: nanoid(), revisionId: revIds.doc10Rev2, userId: u.qualityUser2, confirmedAt: null, createdAt: daysAgo(10) },
  ]);

  // Distribution for old rev (rev1) → Production only (to show per-revision distribution)
  await db.insert(distributionLists).values([
    { id: nanoid(), revisionId: revIds.doc10Rev1, departmentId: deptIds.production, createdAt: daysAgo(70) },
  ]);
  await db.insert(distributionUsers).values([
    { id: nanoid(), revisionId: revIds.doc10Rev1, userId: u.productionUser1, createdAt: daysAgo(70) },
    { id: nanoid(), revisionId: revIds.doc10Rev1, userId: u.productionUser2, createdAt: daysAgo(70) },
  ]);
  await db.insert(readConfirmations).values([
    { id: nanoid(), revisionId: revIds.doc10Rev1, userId: u.productionUser1, confirmedAt: daysAgo(68), createdAt: daysAgo(70) },
    { id: nanoid(), revisionId: revIds.doc10Rev1, userId: u.productionUser2, confirmedAt: daysAgo(65), createdAt: daysAgo(70) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc10, revisionId: revIds.doc10Rev0, userId: u.productionManager, action: "UPLOADED", details: { fileName: "warehouse-receiving-v1.pdf" }, createdAt: daysAgo(120) },
    { id: nanoid(), documentId: docIds.doc10, revisionId: revIds.doc10Rev0, userId: u.admin, action: "PUBLISHED", details: {}, createdAt: daysAgo(110) },
    { id: nanoid(), documentId: docIds.doc10, revisionId: revIds.doc10Rev1, userId: u.productionManager, action: "REVISED", details: { fromRevision: 0, toRevision: 1 }, createdAt: daysAgo(80) },
    { id: nanoid(), documentId: docIds.doc10, revisionId: revIds.doc10Rev1, userId: u.admin, action: "PUBLISHED", details: { distributedTo: ["Üretim"] }, createdAt: daysAgo(70) },
    { id: nanoid(), documentId: docIds.doc10, revisionId: revIds.doc10Rev2, userId: u.productionManager, action: "REVISED", details: { fromRevision: 1, toRevision: 2 }, createdAt: daysAgo(20) },
    { id: nanoid(), documentId: docIds.doc10, revisionId: revIds.doc10Rev2, userId: u.admin, action: "PUBLISHED", details: { distributedTo: ["Üretim", "Kalite Yönetimi"] }, createdAt: daysAgo(10) },
  ]);

  console.log("  ✓ DOC-PRD-003: PUBLISHED with 3 revisions (full history)");

  // ──────────────────────────────────────────────────────────────
  // DOC 11: PUBLISHED with same preparer=approver (Admin flow)
  // Scenario: Admin creates, prepares, and approves own document
  // ──────────────────────────────────────────────────────────────
  await db.insert(documents).values({
    id: docIds.doc11,
    documentCode: "DOC-HR-003",
    createdAt: daysAgo(35),
  });

  await db.insert(documentRevisions).values({
    id: revIds.doc11Rev0,
    documentId: docIds.doc11,
    revisionNo: 0,
    title: "Annual Performance Review Template",
    description: "Template for conducting annual employee performance reviews",
    documentType: "FORM",
    status: "PUBLISHED",
    departmentId: deptIds.hr,
    preparerDepartmentId: deptIds.hr,
    preparerId: u.admin,
    approverId: u.admin,
    createdById: u.admin,
    filePath: "uploads/2026/01/doc11/performance-review-template.pdf",
    fileName: "performance-review-template.pdf",
    fileSize: 115000,
    mimeType: "application/pdf",
    publishedAt: daysAgo(32),
    createdAt: daysAgo(35),
  });

  await db
    .update(documents)
    .set({ currentRevisionId: revIds.doc11Rev0, currentRevisionNo: 0 })
    .where(eq(documents.id, docIds.doc11));

  // Same person flow: no PREPARER approval, direct APPROVER approval
  await db.insert(approvals).values([
    { id: nanoid(), revisionId: revIds.doc11Rev0, approverId: u.admin, approvalType: "APPROVER", status: "APPROVED", respondedAt: daysAgo(33), createdAt: daysAgo(35) },
  ]);

  // Distributed to HR + Quality managers
  await db.insert(distributionLists).values([
    { id: nanoid(), revisionId: revIds.doc11Rev0, departmentId: deptIds.hr, createdAt: daysAgo(32) },
    { id: nanoid(), revisionId: revIds.doc11Rev0, departmentId: deptIds.quality, createdAt: daysAgo(32) },
  ]);

  const doc11DistUsers = [u.hrManager, u.hrUser1, u.qualityManager, u.qualityUser1];
  await db.insert(distributionUsers).values(
    doc11DistUsers.map((userId) => ({
      id: nanoid(),
      revisionId: revIds.doc11Rev0,
      userId,
      createdAt: daysAgo(32),
    })),
  );

  await db.insert(readConfirmations).values([
    { id: nanoid(), revisionId: revIds.doc11Rev0, userId: u.hrManager, confirmedAt: daysAgo(31), createdAt: daysAgo(32) },
    { id: nanoid(), revisionId: revIds.doc11Rev0, userId: u.qualityManager, confirmedAt: daysAgo(30), createdAt: daysAgo(32) },
    { id: nanoid(), revisionId: revIds.doc11Rev0, userId: u.hrUser1, confirmedAt: null, createdAt: daysAgo(32) },
    { id: nanoid(), revisionId: revIds.doc11Rev0, userId: u.qualityUser1, confirmedAt: null, createdAt: daysAgo(32) },
  ]);

  await db.insert(activityLogs).values([
    { id: nanoid(), documentId: docIds.doc11, revisionId: revIds.doc11Rev0, userId: u.admin, action: "UPLOADED", details: { fileName: "performance-review-template.pdf" }, createdAt: daysAgo(35) },
    { id: nanoid(), documentId: docIds.doc11, revisionId: revIds.doc11Rev0, userId: u.admin, action: "SUBMITTED", details: { status: "PENDING_APPROVAL" }, createdAt: daysAgo(35) },
    { id: nanoid(), documentId: docIds.doc11, revisionId: revIds.doc11Rev0, userId: u.admin, action: "APPROVED", details: { approvalType: "APPROVER", samePerson: true }, createdAt: daysAgo(33) },
    { id: nanoid(), documentId: docIds.doc11, revisionId: revIds.doc11Rev0, userId: u.admin, action: "PUBLISHED", details: { distributedTo: ["İnsan Kaynakları", "Kalite Yönetimi"] }, createdAt: daysAgo(32) },
  ]);

  console.log("  ✓ DOC-HR-003: PUBLISHED form (same preparer=approver flow)");
  console.log("");

  // ── 6. Notifications ───────────────────────────────────────────
  console.log("Creating notifications...");

  await db.insert(notifications).values([
    // Approval request for doc2 rev1 (pending for admin)
    {
      id: nanoid(),
      userId: u.admin,
      type: "APPROVAL_REQUEST",
      title: "Approval Required",
      message: "Production Safety Instructions v2 requires your approval. Submitted by Mehmet Demir.",
      relatedDocumentId: docIds.doc2,
      relatedRevisionId: revIds.doc2Rev1,
      isRead: false,
      createdAt: daysAgo(4),
    },
    // Approval request for doc6 (pending for production manager)
    {
      id: nanoid(),
      userId: u.productionManager,
      type: "APPROVAL_REQUEST",
      title: "Approval Required",
      message: "Machine Maintenance Checklist requires your approval. Submitted by Ali Çelik.",
      relatedDocumentId: docIds.doc6,
      relatedRevisionId: revIds.doc6Rev0,
      isRead: false,
      createdAt: daysAgo(2),
    },
    // Read assignment for doc1 (HR Manager — unread)
    {
      id: nanoid(),
      userId: u.hrManager,
      type: "READ_ASSIGNMENT",
      title: "New Document to Read",
      message: "Quality Management Procedure has been published. Please read and confirm.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: false,
      createdAt: daysAgo(25),
    },
    // Read assignment for doc1 (Production User 2 — unread)
    {
      id: nanoid(),
      userId: u.productionUser2,
      type: "READ_ASSIGNMENT",
      title: "New Document to Read",
      message: "Quality Management Procedure has been published. Please read and confirm.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: false,
      createdAt: daysAgo(25),
    },
    // Read assignment for doc10 rev2 (Production User 2 — unread)
    {
      id: nanoid(),
      userId: u.productionUser2,
      type: "READ_ASSIGNMENT",
      title: "New Document to Read",
      message: "Warehouse Receiving Procedure v3 has been published. Please read and confirm.",
      relatedDocumentId: docIds.doc10,
      relatedRevisionId: revIds.doc10Rev2,
      isRead: false,
      createdAt: daysAgo(10),
    },
    // Rejection notification for doc3 (HR Manager — read)
    {
      id: nanoid(),
      userId: u.hrManager,
      type: "DOCUMENT_REJECTED",
      title: "Document Rejected",
      message: 'Employee Onboarding Form has been rejected. Reason: "Needs more detail on benefits section".',
      relatedDocumentId: docIds.doc3,
      relatedRevisionId: revIds.doc3Rev0,
      isRead: true,
      readAt: daysAgo(11),
      createdAt: daysAgo(12),
    },
    // Rejection notification for doc8 (IT User — unread)
    {
      id: nanoid(),
      userId: u.itUser1,
      type: "DOCUMENT_REJECTED",
      title: "Document Rejected",
      message: 'Network Configuration Guide has been rejected by preparer. Reason: "Diagrams are missing for the VLAN configuration section."',
      relatedDocumentId: docIds.doc8,
      relatedRevisionId: revIds.doc8Rev0,
      isRead: false,
      createdAt: daysAgo(6),
    },
    // Reminder for unread doc1 (HR User — overdue)
    {
      id: nanoid(),
      userId: u.hrUser1,
      type: "REMINDER",
      title: "Read Reminder",
      message: "Please read and confirm Quality Management Procedure. This is a reminder.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: false,
      createdAt: daysAgo(20),
    },
    // Reminder for unread doc10 rev2 (Quality User 2)
    {
      id: nanoid(),
      userId: u.qualityUser2,
      type: "REMINDER",
      title: "Read Reminder",
      message: "Please read and confirm Warehouse Receiving Procedure v3. This is your first reminder.",
      relatedDocumentId: docIds.doc10,
      relatedRevisionId: revIds.doc10Rev2,
      isRead: false,
      createdAt: daysAgo(5),
    },
    // Escalation for overdue doc1 read (HR User — escalated to HR Manager)
    {
      id: nanoid(),
      userId: u.hrManager,
      type: "ESCALATION",
      title: "Read Confirmation Overdue",
      message: "Zeynep Şahin has not confirmed reading Quality Management Procedure. This has been escalated.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: false,
      createdAt: daysAgo(15),
    },
    // Escalation for overdue doc1 read (Production User 2 — escalated to Production Manager)
    {
      id: nanoid(),
      userId: u.productionManager,
      type: "ESCALATION",
      title: "Read Confirmation Overdue",
      message: "Fatma Yıldız has not confirmed reading Quality Management Procedure. This has been escalated.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: true,
      readAt: daysAgo(14),
      createdAt: daysAgo(15),
    },
    // Read assignment for doc1 (HR User)
    {
      id: nanoid(),
      userId: u.hrUser1,
      type: "READ_ASSIGNMENT",
      title: "New Document to Read",
      message: "Quality Management Procedure has been published. Please read and confirm.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: true,
      readAt: daysAgo(24),
      createdAt: daysAgo(25),
    },
    // Read assignment for doc11 (HR User — unread)
    {
      id: nanoid(),
      userId: u.hrUser1,
      type: "READ_ASSIGNMENT",
      title: "New Document to Read",
      message: "Annual Performance Review Template has been published. Please read and confirm.",
      relatedDocumentId: docIds.doc11,
      relatedRevisionId: revIds.doc11Rev0,
      isRead: false,
      createdAt: daysAgo(32),
    },
    // Read assignment for doc1 (Production User)
    {
      id: nanoid(),
      userId: u.productionUser1,
      type: "READ_ASSIGNMENT",
      title: "New Document to Read",
      message: "Quality Management Procedure has been published. Please read and confirm.",
      relatedDocumentId: docIds.doc1,
      relatedRevisionId: revIds.doc1Rev0,
      isRead: true,
      readAt: daysAgo(23),
      createdAt: daysAgo(25),
    },
  ]);

  console.log("  14 notifications created.\n");

  // ── Done ───────────────────────────────────────────────────────
  console.log("╔══════════════════════════════════════╗");
  console.log("║    Seed completed successfully!      ║");
  console.log("╠══════════════════════════════════════╣");
  console.log("║  Departments: 4                      ║");
  console.log("║  Users:       11                     ║");
  console.log("║  Documents:   11                     ║");
  console.log("║  Revisions:   14                     ║");
  console.log("║  Settings:    13                     ║");
  console.log("║  Notifications: 14                   ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");
  console.log("Login credentials:");
  console.log("  Admin:      " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD);
  console.log(`  Managers:   *.manager@${EMAIL_DOMAIN} / ${DEFAULT_PASSWORD}`);
  console.log(`  Users:      *.user@${EMAIL_DOMAIN} / ${DEFAULT_PASSWORD}`);
  console.log("");
  console.log("Document status coverage:");
  console.log("  DRAFT:              DOC-IT-001");
  console.log("  PENDING_APPROVAL:   DOC-PRD-002");
  console.log("  PREPARER_APPROVED:  DOC-PRD-001 (rev1)");
  console.log("  PREPARER_REJECTED:  DOC-IT-002");
  console.log("  APPROVED:           DOC-QMS-002");
  console.log("  APPROVER_REJECTED:  DOC-HR-001");
  console.log("  PUBLISHED:          DOC-QMS-001, DOC-HR-002, DOC-PRD-003, DOC-HR-003");
  console.log("  CANCELLED:          DOC-QMS-003");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
