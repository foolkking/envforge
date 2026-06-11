import React from "react";
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
  return (
    <div data-testid="users-queues-tab">
      <p style={{ color: "#475569", margin: "0 0 12px 0", maxWidth: 760 }}>
        {locale === "zh"
          ? "这里管理规则维护负责人、认证审核人、建议处理人和队列分派，不是账号中心，也不是主机用户管理。"
          : "This workspace manages rule maintainers, certification reviewers, suggestion triage, and queue assignment. It is not an account center or a host user manager."}
      </p>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Users / Maintainers</h3>
        {loading ? (
          <p style={{ color: "#64748b" }}>Loading...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#64748b" }}>{locale === "zh" ? "暂无成员" : "No users yet."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Assigned Capabilities</Th>
                <Th>Open Suggestions</Th>
                <Th>Open Backlog Items</Th>
                <Th>Review Load</Th>
                <Th>Last Active</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <Td><strong>{user.name}</strong><div style={{ color: "#64748b", fontSize: 11 }}>{user.id}</div></Td>
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
        <h3 style={{ margin: "0 0 8px 0", fontSize: 14 }}>Queues</h3>
        {loading ? (
          <p style={{ color: "#64748b" }}>Loading...</p>
        ) : queues.length === 0 ? (
          <p style={{ color: "#64748b" }}>{locale === "zh" ? "暂无队列" : "No queues yet."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f1f5f9" }}>
              <tr>
                <Th>Queue</Th>
                <Th>Type</Th>
                <Th>Open Items</Th>
                <Th>Priority</Th>
                <Th>Owner Group</Th>
                <Th>Next Action</Th>
              </tr>
            </thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <Td><strong>{queue.name}</strong><div style={{ color: "#64748b", fontSize: 11 }}>{queue.status}</div></Td>
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
