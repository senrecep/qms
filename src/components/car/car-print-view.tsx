"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";

type CarDetail = NonNullable<
  Awaited<ReturnType<typeof import("@/actions/car").getCarById>>
>;

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentName: string | null;
};

type CarPrintViewProps = {
  car: CarDetail;
  companyName?: string;
  companyLogoUrl?: string;
  translations?: Record<string, unknown>;
  settingsTranslations?: Record<string, unknown>;
  users?: UserItem[];
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#1d4ed8",
  ROOT_CAUSE_ANALYSIS: "#9333ea",
  IMMEDIATE_ACTION: "#ea580c",
  PLANNED_ACTION: "#2563eb",
  ACTION_RESULTS: "#16a34a",
  PENDING_CLOSURE: "#ca8a04",
  CLOSED: "#15803d",
  CANCELLED: "#dc2626",
};

const STATUS_BG: Record<string, string> = {
  OPEN: "#dbeafe",
  ROOT_CAUSE_ANALYSIS: "#f3e8ff",
  IMMEDIATE_ACTION: "#ffedd5",
  PLANNED_ACTION: "#dbeafe",
  ACTION_RESULTS: "#dcfce7",
  PENDING_CLOSURE: "#fef9c3",
  CLOSED: "#dcfce7",
  CANCELLED: "#fee2e2",
};

const CA_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  PENDING: { background: "#fef9c3", color: "#ca8a04" },
  IN_PROGRESS: { background: "#dbeafe", color: "#1d4ed8" },
  COMPLETED: { background: "#dcfce7", color: "#15803d" },
  CANCELLED: { background: "#fee2e2", color: "#dc2626" },
};

// Map DB action enum to translation key
const ACTION_TRANSLATION_MAP: Record<string, string> = {
  CREATED: "created",
  UPDATED: "updated",
  STATUS_CHANGED: "statusChanged",
  ROOT_CAUSE_ADDED: "rootCauseAdded",
  ROOT_CAUSE_UPDATED: "rootCauseUpdated",
  IMMEDIATE_ACTION_ADDED: "immediateActionAdded",
  IMMEDIATE_ACTION_UPDATED: "immediateActionUpdated",
  ACTION_ADDED: "correctiveActionAdded",
  ACTION_UPDATED: "correctiveActionUpdated",
  ACTION_COMPLETED: "actionCompleted",
  CLOSURE_REQUESTED: "closureRequested",
  CLOSED: "closed",
  REOPENED: "reopened",
  CANCELLED: "cancelled",
  DELETED: "deleted",
  ATTACHMENT_ADDED: "attachmentAdded",
  ATTACHMENT_DELETED: "attachmentDeleted",
  TEAM_MEMBER_ADDED: "teamMemberAdded",
  TEAM_MEMBER_REMOVED: "teamMemberRemoved",
};

// Map CA status enum to translation key
const CA_STATUS_TRANSLATION_MAP: Record<string, string> = {
  PENDING: "pending",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// Static print CSS defined as constant to avoid hydration mismatch
const PRINT_CSS = [
  "@page { margin: 10mm; }",
  "@media print {",
  "  .print-toolbar { display: none !important; }",
  "  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }",
  '  [data-slot="sidebar"] { display: none !important; }',
  '  [data-slot="sidebar-wrapper"] { min-height: 0 !important; height: auto !important; display: block !important; }',
  '  [data-slot="sidebar-inset"] { margin-left: 0 !important; padding: 0 !important; overflow: visible !important; display: block !important; }',
  "  header { display: none !important; }",
  "  main { padding: 0 !important; overflow: visible !important; height: auto !important; }",
  "  .print-content { padding: 16px 24px !important; max-width: 100% !important; }",
  "  table { page-break-inside: auto; }",
  "  tr { page-break-inside: avoid; }",
  "  .print-section { page-break-inside: avoid; }",
  "}",
  "@media screen {",
  "  .print-content { max-width: 900px; margin: 0 auto; padding: 24px 32px; }",
  "}",
].join("\n");

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  try {
    return format(new Date(d), "dd.MM.yyyy");
  } catch {
    return "-";
  }
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  try {
    return format(new Date(d), "dd.MM.yyyy HH:mm");
  } catch {
    return "-";
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 700,
        color: "#2C3E50",
        textTransform: "uppercase" as const,
        letterSpacing: "0.6px",
        borderLeft: "4px solid #5DADE2",
        paddingLeft: "8px",
        marginBottom: "10px",
      }}
    >
      {children}
    </div>
  );
}

type InfoRow =
  | [string, React.ReactNode]
  | [string, React.ReactNode, string, React.ReactNode];

function InfoTable({ rows }: { rows: InfoRow[] }) {
  const tdBase: React.CSSProperties = {
    padding: "7px 12px",
    color: "#111827",
    border: "1px solid #e5e7eb",
    fontSize: "13px",
  };
  const thBase: React.CSSProperties = {
    background: "#f9fafb",
    fontWeight: 600,
    color: "#374151",
    padding: "7px 12px",
    textAlign: "left",
    fontSize: "12px",
    border: "1px solid #e5e7eb",
    width: "22%",
  };

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        border: "1px solid #e5e7eb",
        fontSize: "13px",
      }}
    >
      <tbody>
        {rows.map((row, i) => {
          const isFour = row.length === 4;
          return (
            <tr key={i}>
              <th style={thBase}>{row[0]}</th>
              <td
                style={{ ...tdBase, width: isFour ? "28%" : "78%" }}
                colSpan={isFour ? 1 : 3}
              >
                {row[1]}
              </td>
              {isFour && (
                <>
                  <th style={thBase}>
                    {(row as [string, React.ReactNode, string, React.ReactNode])[2]}
                  </th>
                  <td style={{ ...tdBase, width: "28%" }}>
                    {(row as [string, React.ReactNode, string, React.ReactNode])[3]}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function CarPrintView({ car, companyName, companyLogoUrl, translations, settingsTranslations, users = [] }: CarPrintViewProps) {
  const router = useRouter();
  const _t = useTranslations("car");
  const _tStatus = useTranslations("car.status");
  const _tActivity = useTranslations("car.activity");
  const _tCaStatus = useTranslations("car.caStatus");
  const _tPrint = useTranslations("car.print");
  const _tRoles = useTranslations("settings.users");
  const [generatedOn] = useState(() => format(new Date(), "dd.MM.yyyy HH:mm"));

  // Resolve nested key from a translations object
  function resolve(obj: Record<string, unknown> | undefined, key: string): string | undefined {
    if (!obj) return undefined;
    let current: unknown = obj;
    for (const part of key.split(".")) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : undefined;
  }

  // Use prop translations (PDF language) when available, fallback to useTranslations (UI locale)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const t = (key: string) => resolve(translations, key) ?? _t(key as any);
  const tStatus = (key: string) => resolve(translations, `status.${key}`) ?? _tStatus(key as any);
  const tActivity = (key: string) => resolve(translations, `activity.${key}`) ?? _tActivity(key as any);
  const tCaStatus = (key: string) => resolve(translations, `caStatus.${key}`) ?? _tCaStatus(key as any);
  const tPrint = (key: string) => resolve(translations, `print.${key}`) ?? _tPrint(key as any);
  const tRoles = (key: string) => resolve(settingsTranslations, `users.${key}`) ?? _tRoles(key as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Set document title for PDF filename
  useEffect(() => {
    const prev = document.title;
    document.title = `${car.carCode} - ${tPrint("reportTitle")}`;
    return () => { document.title = prev; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.carCode]);

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: tRoles("roleAdmin"),
    MANAGER: tRoles("roleManager"),
    USER: tRoles("roleUser"),
  };

  function roleLabel(role?: string): string {
    if (!role) return "";
    return ROLE_LABELS[role] ?? role;
  }

  // Build user lookup map for department/role info
  const userMap = new Map(users.map((u) => [u.id, u]));

  function userSubInfo(userId?: string): string {
    if (!userId) return "";
    const u = userMap.get(userId);
    if (!u) return "";
    const parts: string[] = [];
    if (u.role) parts.push(roleLabel(u.role));
    if (u.departmentName) parts.push(u.departmentName);
    return parts.length > 0 ? parts.join(" - ") : "";
  }

  const statusLabel = tStatus(car.status as Parameters<typeof tStatus>[0]) ?? car.status;
  const statusColor = STATUS_COLORS[car.status] ?? "#374151";
  const statusBg = STATUS_BG[car.status] ?? "#f3f4f6";

  const totalCost = car.correctiveActions.reduce((sum, ca) => {
    const val = ca.cost != null ? parseFloat(String(ca.cost)) : NaN;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const tdCell: React.CSSProperties = {
    padding: "7px 10px",
    border: "1px solid #e5e7eb",
    verticalAlign: "top",
  };

  function translateAction(action: string): string {
    const key = ACTION_TRANSLATION_MAP[action];
    if (key) {
      return tActivity(key as Parameters<typeof tActivity>[0]);
    }
    return action;
  }

  function translateCaStatus(status: string | null): string {
    if (!status) return "-";
    const key = CA_STATUS_TRANSLATION_MAP[status];
    if (key) {
      return tCaStatus(key as Parameters<typeof tCaStatus>[0]);
    }
    return status;
  }

  function formatDetails(
    action: string,
    details: unknown,
  ): string {
    if (!details) return "-";

    if (typeof details === "string") return details;

    if (typeof details === "object" && details !== null) {
      const obj = details as Record<string, unknown>;

      // Status transition: {from: "STATUS_A", to: "STATUS_B"}
      if (action === "STATUS_CHANGED" && obj.from && obj.to) {
        const fromLabel = tStatus(obj.from as Parameters<typeof tStatus>[0]);
        const toLabel = tStatus(obj.to as Parameters<typeof tStatus>[0]);
        return `${fromLabel} → ${toLabel}`;
      }

      // Attachment: {fileName: "...", fileSize: ...}
      if (obj.fileName) {
        return String(obj.fileName);
      }

      // Team member: {userName: "...", action: "..."}
      if (obj.userName) {
        return String(obj.userName);
      }

      // Description-based: {description: "..."}
      if (obj.description) {
        return String(obj.description);
      }

      // Generic: show key-value pairs
      const entries = Object.entries(obj)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${k}: ${v}`);
      return entries.length > 0 ? entries.join(", ") : "-";
    }

    return String(details);
  }

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        fontSize: "13px",
        color: "#111827",
        background: "#fff",
      }}
    >
      {/* Print media styles - constant string avoids hydration mismatch */}
      <style>{PRINT_CSS}</style>

      {/* Screen-only toolbar */}
      <div
        className="print-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
          padding: "10px 32px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#374151",
          }}
        >
          &#8592; {tPrint("back")}
        </button>
        <button
          onClick={() => window.print()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid #2C3E50",
            background: "#2C3E50",
            color: "#fff",
          }}
        >
          {tPrint("printPdf")}
        </button>
        <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>
          {tPrint("generatedOn")}: {generatedOn}
        </span>
      </div>

      <div className="print-content">
        {/* ===== REPORT HEADER ===== */}
        <div
          style={{
            borderBottom: "3px solid #2C3E50",
            paddingBottom: "16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Left: Company logo + name */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {companyLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={companyLogoUrl}
                  alt={companyName || "Company Logo"}
                  style={{ maxHeight: "48px", maxWidth: "160px", objectFit: "contain" }}
                />
              )}
              {companyName && (
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#2C3E50",
                  }}
                >
                  {companyName}
                </div>
              )}
            </div>
            {/* Right: Report title */}
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#2C3E50",
                  letterSpacing: "0.3px",
                }}
              >
                {tPrint("reportTitle")}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginTop: "2px",
                }}
              >
                {tPrint("generatedOn")}: {generatedOn}
              </div>
            </div>
          </div>

          {/* CAR code + status badge */}
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "17px", fontWeight: 600, color: "#1f2937" }}>
              {car.carCode}
            </span>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 600,
                background: statusBg,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ===== REQUEST INFORMATION ===== */}
        <div className="print-section" style={{ marginBottom: "20px" }}>
          <SectionTitle>{tPrint("requestInfo")}</SectionTitle>
          <InfoTable
            rows={[
              [t("source"), car.source?.name ?? "-", t("system"), car.system?.name ?? "-"],
              [t("process"), car.process?.name ?? "-", t("customer"), car.customer?.name ?? "-"],
              [t("product"), car.product?.name ?? "-", t("operation"), car.operation?.name ?? "-"],
              ...(car.relatedStandard
                ? [[t("relatedStandard"), car.relatedStandard] as InfoRow]
                : []),
            ]}
          />
        </div>

        {/* ===== PEOPLE & DATES ===== */}
        <div className="print-section" style={{ marginBottom: "20px" }}>
          <SectionTitle>{tPrint("peopleDates")}</SectionTitle>
          <InfoTable
            rows={[
              [
                tPrint("responsiblePerson"),
                <>
                  {car.assignee?.name ?? "-"}
                  {car.assignee?.role && (
                    <span style={{ color: "#6b7280", fontSize: "11px", marginLeft: "6px" }}>
                      ({roleLabel(car.assignee.role)})
                    </span>
                  )}
                </>,
                tPrint("requesterDepartment"),
                car.requesterDepartment?.name ?? "-",
              ],
              [
                tPrint("responsibleDepartment"),
                car.responsibleDepartment?.name ?? "-",
                tPrint("targetCompletionDate"),
                fmtDate(car.targetCompletionDate),
              ],
              [
                tPrint("created"),
                fmtDateTime(car.createdAt),
                tPrint("closingDate"),
                fmtDate(car.closingDate),
              ],
            ]}
          />
        </div>

        {/* ===== NONCONFORMITY DESCRIPTION ===== */}
        <div className="print-section" style={{ marginBottom: "20px" }}>
          <SectionTitle>{tPrint("nonconformityDesc")}</SectionTitle>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "12px 14px",
              background: "#fafafa",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {car.nonconformityDescription || "-"}
          </div>
        </div>

        {/* ===== ROOT CAUSE ANALYSIS ===== */}
        <div className="print-section" style={{ marginBottom: "20px" }}>
          <SectionTitle>{tPrint("rootCauseAnalysis")}</SectionTitle>
          {car.rootCauseAnalyses.length === 0 ? (
            <div style={{ color: "#9ca3af", fontStyle: "italic", padding: "10px 0", fontSize: "12px" }}>
              {tPrint("noRootCause")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {car.rootCauseAnalyses.map((rca, idx) => (
                <li
                  key={rca.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    marginBottom: "8px",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                    <strong>#{idx + 1}</strong> {rca.description}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                    {rca.createdBy?.name} - {fmtDateTime(rca.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ===== IMMEDIATE ACTIONS ===== */}
        <div className="print-section" style={{ marginBottom: "20px" }}>
          <SectionTitle>{tPrint("immediateActions")}</SectionTitle>
          {car.immediateActions.length === 0 ? (
            <div style={{ color: "#9ca3af", fontStyle: "italic", padding: "10px 0", fontSize: "12px" }}>
              {tPrint("noImmediateAction")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {car.immediateActions.map((ia, idx) => (
                <li
                  key={ia.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    marginBottom: "8px",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                    <strong>#{idx + 1}</strong> {ia.description}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                    {ia.createdBy?.name} - {fmtDateTime(ia.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ===== CORRECTIVE ACTIONS ===== */}
        <div className="print-section" style={{ marginBottom: "20px" }}>
          <SectionTitle>{tPrint("correctiveActions")}</SectionTitle>
          {car.correctiveActions.length === 0 ? (
            <div style={{ color: "#9ca3af", fontStyle: "italic", padding: "10px 0", fontSize: "12px" }}>
              {tPrint("noCorrectiveActions")}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                border: "1px solid #e5e7eb",
              }}
            >
              <thead>
                <tr>
                  {[
                    "#",
                    tPrint("description"),
                    tPrint("owner"),
                    tPrint("team"),
                    tPrint("targetDate"),
                    tPrint("status"),
                    tPrint("cost"),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: "#2C3E50",
                        color: "#fff",
                        padding: "8px 10px",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "11px",
                        border: "1px solid #1e2d3d",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {car.correctiveActions.map((ca, idx) => {
                  const caStyle = CA_STATUS_STYLE[ca.status ?? "PENDING"] ?? {
                    background: "#f3f4f6",
                    color: "#374151",
                  };
                  return (
                    <tr key={ca.id} style={{ background: idx % 2 === 1 ? "#f9fafb" : "#fff" }}>
                      <td style={tdCell}>{idx + 1}</td>
                      <td style={tdCell}>
                        <div>{ca.description}</div>
                        {ca.results && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#374151" }}>
                            <em>{tPrint("results")}:</em> {ca.results}
                          </div>
                        )}
                      </td>
                      <td style={tdCell}>
                        {ca.owner ? (
                          <>
                            {ca.owner.name}
                            {userSubInfo(ca.owner.id) && (
                              <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>
                                {userSubInfo(ca.owner.id)}
                              </div>
                            )}
                          </>
                        ) : "-"}
                      </td>
                      <td style={tdCell}>
                        {ca.team.length > 0
                          ? ca.team.map((m, i) => (
                              <span key={m.user.id} style={{ display: "inline-block", marginRight: i < ca.team.length - 1 ? "4px" : 0 }}>
                                {m.user.name}
                                {userSubInfo(m.user.id) && (
                                  <span style={{ fontSize: "10px", color: "#6b7280" }}>
                                    {" "}({userSubInfo(m.user.id)})
                                  </span>
                                )}
                                {i < ca.team.length - 1 ? "," : ""}
                              </span>
                            ))
                          : "-"}
                      </td>
                      <td style={tdCell}>{fmtDate(ca.targetDate)}</td>
                      <td style={tdCell}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 500,
                            background: caStyle.background,
                            color: caStyle.color,
                          }}
                        >
                          {translateCaStatus(ca.status)}
                        </span>
                        {ca.completedAt && (
                          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>
                            {fmtDate(ca.completedAt)}
                          </div>
                        )}
                      </td>
                      <td style={tdCell}>
                        {(() => {
                          const v = ca.cost != null ? parseFloat(String(ca.cost)) : NaN;
                          return !isNaN(v) && v > 0 ? v.toLocaleString() : "-";
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalCost > 0 && (
                <tfoot>
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        padding: "7px 10px",
                        border: "1px solid #e5e7eb",
                        borderTop: "2px solid #e5e7eb",
                      }}
                    >
                      {tPrint("totalCost")}:
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        padding: "7px 10px",
                        border: "1px solid #e5e7eb",
                        borderTop: "2px solid #e5e7eb",
                      }}
                    >
                      {totalCost.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* ===== CLOSURE INFORMATION ===== */}
        {(car.closedBy || car.closingDate || car.closingApprovalNote) && (
          <div className="print-section" style={{ marginBottom: "20px" }}>
            <SectionTitle>{tPrint("closureInfo")}</SectionTitle>
            <InfoTable
              rows={[
                ...(car.closedBy
                  ? [
                      [
                        tPrint("closedBy"),
                        `${car.closedBy.name}${car.closedBy.role ? ` (${roleLabel(car.closedBy.role)})` : ""}`,
                        tPrint("closingDate"),
                        fmtDate(car.closingDate),
                      ] as InfoRow,
                    ]
                  : []),
                ...(car.closingApprovalNote
                  ? [[tPrint("closingNote"), car.closingApprovalNote] as InfoRow]
                  : []),
              ]}
            />
          </div>
        )}

        {/* ===== NOTIFICATION USERS ===== */}
        {car.notificationUsers.length > 0 && (
          <div className="print-section" style={{ marginBottom: "20px" }}>
            <SectionTitle>{tPrint("notificationUsers")}</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {car.notificationUsers.map((nu, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    color: "#374151",
                  }}
                >
                  {nu.user.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== ATTACHMENTS ===== */}
        {car.attachments.length > 0 && (
          <div className="print-section" style={{ marginBottom: "20px" }}>
            <SectionTitle>{tPrint("attachments")}</SectionTitle>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {car.attachments.map((att) => (
                <li
                  key={att.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    padding: "8px 14px",
                    marginBottom: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fafafa",
                  }}
                >
                  <a
                    href={`/api/files/${att.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#2563eb",
                      textDecoration: "underline",
                      fontSize: "13px",
                    }}
                  >
                    {att.fileName}
                  </a>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                      {att.fileSize
                        ? `${(att.fileSize / 1024).toFixed(1)} KB`
                        : ""}
                    </span>
                    <a
                      href={`/api/files/${att.filePath}`}
                      download={att.fileName}
                      style={{
                        fontSize: "11px",
                        color: "#2563eb",
                        textDecoration: "none",
                        padding: "2px 8px",
                        border: "1px solid #2563eb",
                        borderRadius: "4px",
                      }}
                    >
                      {tPrint("download")}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ===== ACTIVITY LOG ===== */}
        {car.activityLogs.length > 0 && (
          <div className="print-section" style={{ marginBottom: "20px" }}>
            <SectionTitle>{tPrint("activityLog")}</SectionTitle>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                border: "1px solid #e5e7eb",
              }}
            >
              <thead>
                <tr>
                  {[
                    tPrint("date"),
                    tPrint("user"),
                    tPrint("action"),
                    tPrint("details"),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: "#2C3E50",
                        color: "#fff",
                        padding: "8px 10px",
                        textAlign: "left",
                        fontWeight: 600,
                        fontSize: "11px",
                        border: "1px solid #1e2d3d",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {car.activityLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    style={{ background: idx % 2 === 1 ? "#f9fafb" : "#fff" }}
                  >
                    <td style={{ ...tdCell, whiteSpace: "nowrap", width: "130px" }}>
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td style={{ ...tdCell, width: "120px" }}>
                      {log.user?.name ?? "-"}
                    </td>
                    <td style={{ ...tdCell, width: "150px" }}>
                      {translateAction(log.action)}
                    </td>
                    <td style={{ ...tdCell, fontSize: "11px", color: "#374151" }}>
                      {formatDetails(log.action, log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div
          style={{
            marginTop: "32px",
            paddingTop: "12px",
            borderTop: "1px solid #e5e7eb",
            fontSize: "11px",
            color: "#9ca3af",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span>
            {tPrint("generatedOn")}: {generatedOn}
          </span>
          <span>
            {car.carCode} - {statusLabel}
          </span>
          {companyName && (
            <span>{companyName}</span>
          )}
        </div>
      </div>
    </div>
  );
}
