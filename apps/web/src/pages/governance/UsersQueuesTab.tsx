import React from "react";
import { useTranslation } from "react-i18next";
import { type CapabilityWorkflowUser, type CapabilityWorkflowQueue } from "../../api";
import type { Locale } from "../../lib/types";
import { Th, Td } from "./shared";

// ── Users & Queues tab ────────────────────────────────────────────────

export function UsersQueuesTab({
  locale,
  users,
  queues,
  loading
}: {
  locale: Locale;
  users: CapabilityWorkflowUser[];
  queues: CapabilityWorkflowQueue[];
  loading: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="users-queues-tab">
      <p style={{ color: "var(--ef-muted)", margin: "0 0 12px 0", maxWidth: 760 }}>
        {t("governance.usersQueues.intro")}
      </p>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>{t("governance.usersQueues.usersTitle")}</h3>
        {loading ? (
          <p style={{ color: "var(--ef-muted)" }}>{t("governance.common.loading")}</p>
        ) : users.length === 0 ? (
          <p style={{ color: "var(--ef-muted)" }}>{t("governance.usersQueues.noUsers")}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--ef-surface-soft)" }}>
              <tr>
                <Th>{t("governance.usersQueues.user")}</Th>
                <Th>{t("governance.usersQueues.role")}</Th>
                <Th>{t("governance.usersQueues.assignedCapabilities")}</Th>
                <Th>{t("governance.usersQueues.openSuggestions")}</Th>
                <Th>{t("governance.usersQueues.openBacklogItems")}</Th>
                <Th>{t("governance.usersQueues.reviewLoad")}</Th>
                <Th>{t("governance.usersQueues.lastActive")}</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--ef-border)" }}>
                  <Td><strong>{user.name}</strong><div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{user.id}</div></Td>
                  <Td>{user.role}</Td>
                  <Td>{user.assignedCapabilities.join(", ") || "-"}</Td>
                  <Td>{user.openSuggestions}</Td>
                  <Td>{user.openBacklogItems}</Td>
                  <Td>{user.reviewLoad}</Td>
                  <Td>{new Date(user.lastActive).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>{t("governance.usersQueues.queuesTitle")}</h3>
        {loading ? (
          <p style={{ color: "var(--ef-muted)" }}>{t("governance.common.loading")}</p>
        ) : queues.length === 0 ? (
          <p style={{ color: "var(--ef-muted)" }}>{t("governance.usersQueues.noQueues")}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--ef-surface-soft)" }}>
              <tr>
                <Th>{t("governance.usersQueues.queue")}</Th>
                <Th>{t("governance.common.type")}</Th>
                <Th>{t("governance.usersQueues.openItems")}</Th>
                <Th>{t("governance.usersQueues.priority")}</Th>
                <Th>{t("governance.usersQueues.ownerGroup")}</Th>
                <Th>{t("governance.usersQueues.nextAction")}</Th>
              </tr>
            </thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.id} style={{ borderBottom: "1px solid var(--ef-border)" }}>
                  <Td><strong>{queue.name}</strong><div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{queue.status}</div></Td>
                  <Td>{queue.type}</Td>
                  <Td>{queue.openItems}</Td>
                  <Td>{queue.priority}</Td>
                  <Td>{queue.ownerGroup}</Td>
                  <Td>{queue.nextAction}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
