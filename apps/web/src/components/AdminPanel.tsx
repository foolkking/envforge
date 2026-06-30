import { Button } from "./ui/Button";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Shield,
  UserCheck,
  Lock,
  Unlock,
  RefreshCw,
  Layers,
  Users,
  AlertTriangle
} from "lucide-react";
import {
  fetchAdminUsers,
  updateAdminUserRole,
  toggleAdminUserLock,
  fetchAdminQueues,
  type AdminUser,
  type AdminQueueItem,
  type ConnectionProfile
} from "../api";
import type { Locale } from "../lib/types";
import { toast, confirmDialog } from "../lib/dialogs";

interface Props {
  locale: Locale;
  authToken: string;
  connections: ConnectionProfile[];
}

export function AdminPanel({ authToken, connections }: Props) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [queues, setQueues] = useState<AdminQueueItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [userError, setUserError] = useState("");
  const [queueError, setQueueError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  async function loadUsers() {
    setUserLoading(true);
    setUserError("");
    try {
      const res = await fetchAdminUsers(authToken);
      setUsers(res.users);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : t("adminPanel.errors.fetchUsers"));
    } finally {
      setUserLoading(false);
    }
  }

  async function loadQueues() {
    setQueueLoading(true);
    setQueueError("");
    try {
      const res = await fetchAdminQueues(authToken);
      setQueues(res.queues);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : t("adminPanel.errors.fetchQueues"));
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    if (authToken) {
      void loadUsers();
      void loadQueues();
    }
  }, [authToken]);

  async function handleToggleRole(targetUser: AdminUser) {
    const newRole = targetUser.role === "admin" ? "user" : "admin";
    const roleLabel = newRole === "admin" ? t("adminPanel.admin") : t("adminPanel.userRole");
    const confirmMsg = t("adminPanel.changeRoleConfirm", { name: targetUser.name, role: roleLabel });
    if (!(await confirmDialog(confirmMsg))) return;

    setActionInProgress(targetUser.id);
    try {
      const res = await updateAdminUserRole(authToken, targetUser.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.user : u)));
    } catch (err) {
      toast(err instanceof Error ? err.message : t("adminPanel.errors.updateRole"), "error");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleToggleLock(targetUser: AdminUser) {
    const actionText = targetUser.deletedAt ? t("adminPanel.unlockAction") : t("adminPanel.lockAction");
    const confirmMsg = t("adminPanel.changeLockConfirm", { action: actionText, name: targetUser.name });
    if (!(await confirmDialog(confirmMsg))) return;

    setActionInProgress(targetUser.id);
    try {
      const res = await toggleAdminUserLock(authToken, targetUser.id);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.user : u)));
    } catch (err) {
      toast(err instanceof Error ? err.message : t("adminPanel.errors.toggleLock"), "error");
    } finally {
      setActionInProgress(null);
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-panel" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 队列管理板块 */}
      <section className="settings-section">
        <div className="settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} style={{ color: "#3b82f6" }} />
            <h3>{t("adminPanel.queueTitle")}</h3>
          </div>
          <Button variant="ghost"
            type="button"
            className="icon-action"
            onClick={() => void loadQueues()}
            disabled={queueLoading}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <RefreshCw size={14} className={queueLoading ? "spinning" : ""} />
            <span style={{ fontSize: "13px" }}>{t("adminPanel.refresh")}</span>
          </Button>
        </div>
        <p className="settings-help">
          {t("adminPanel.queueHelp")}
        </p>

        {queueError && <p className="settings-error">{queueError}</p>}

        {queueLoading && queues.length === 0 ? (
          <p className="empty-hint"><span className="spinning">↻</span> {t("adminPanel.loadingQueues")}</p>
        ) : queues.length === 0 ? (
          <p className="empty-hint">
            {t("adminPanel.noQueues")}
          </p>
        ) : (
          <div className="admin-queue-list" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
            {queues.map((q) => {
              const conn = connections.find((c) => c.id === q.connectionId);
              return (
                <div
                  key={q.connectionId}
                  className="settings-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <strong style={{ fontSize: "15px", color: "var(--ef-surface-soft)" }}>
                      {conn ? conn.label : `VM (${q.connectionId.slice(0, 8)})`}
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--ef-muted-2)" }}>
                      ID: <code>{q.connectionId}</code>
                      {conn?.fields?.host ? ` · Host: ${conn.fields.host}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: q.running ? "#10b981" : "var(--ef-muted)"
                        }}
                      />
                      <span style={{ fontSize: "13px", color: q.running ? "#34d399" : "var(--ef-muted-2)" }}>
                        {q.running ? t("adminPanel.running") : t("adminPanel.idle")}
                      </span>
                    </div>
                    {q.queued > 0 && (
                      <div
                        style={{
                          background: "rgba(245, 158, 11, 0.15)",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                          color: "#fbbf24",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }}
                      >
                        {t("adminPanel.queued", { count: q.queued })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 用户管理板块 */}
      <section className="settings-section">
        <div className="settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} style={{ color: "#3b82f6" }} />
            <h3>{t("adminPanel.usersTitle")}</h3>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div className="search-input-wrapper" style={{ position: "relative" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ef-muted)"
                }}
              />
              <input
                type="text"
                placeholder={t("adminPanel.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: "32px",
                  fontSize: "13px",
                  minHeight: "32px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  color: "var(--ef-surface-soft)"
                }}
              />
            </div>
            <Button variant="ghost"
              type="button"
              className="icon-action"
              onClick={() => void loadUsers()}
              disabled={userLoading}
            >
              <RefreshCw size={14} className={userLoading ? "spinning" : ""} />
            </Button>
          </div>
        </div>

        {userError && <p className="settings-error">{userError}</p>}

        {userLoading && users.length === 0 ? (
          <p className="empty-hint"><span className="spinning">↻</span> {t("adminPanel.loadingUsers")}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="empty-hint">
            {searchQuery ? t("adminPanel.noMatchingUsers") : t("adminPanel.noUsers")}
          </p>
        ) : (
          <div className="admin-user-table-wrapper" style={{ overflowX: "auto", marginTop: "12px" }}>
            <table className="admin-user-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left" }}>
                  <th style={{ padding: "12px 8px", color: "var(--ef-muted-2)", fontWeight: "600" }}>{t("adminPanel.user")}</th>
                  <th style={{ padding: "12px 8px", color: "var(--ef-muted-2)", fontWeight: "600" }}>{t("adminPanel.role")}</th>
                  <th style={{ padding: "12px 8px", color: "var(--ef-muted-2)", fontWeight: "600" }}>{t("adminPanel.status")}</th>
                  <th style={{ padding: "12px 8px", color: "var(--ef-muted-2)", fontWeight: "600" }}>{t("adminPanel.joined")}</th>
                  <th style={{ padding: "12px 8px", color: "var(--ef-muted-2)", fontWeight: "600", textAlign: "right" }}>{t("adminPanel.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isLocked = !!u.deletedAt;
                  const isPending = actionInProgress === u.id;
                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        opacity: isLocked ? 0.6 : 1,
                        transition: "opacity 0.2s"
                      }}
                    >
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontWeight: "500", color: "var(--ef-surface-soft)" }}>{u.name}</span>
                          <span style={{ fontSize: "12px", color: "var(--ef-muted)" }}>{u.email}</span>
                          <code style={{ fontSize: "10px", color: "var(--ef-muted)", width: "fit-content" }}>{u.id}</code>
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "500",
                            background: u.role === "admin" ? "rgba(59, 130, 246, 0.15)" : "rgba(100, 116, 139, 0.15)",
                            color: u.role === "admin" ? "#60a5fa" : "var(--ef-muted-2)",
                            border: u.role === "admin" ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(100, 116, 139, 0.3)"
                          }}
                        >
                          {u.role === "admin" ? <Shield size={10} /> : null}
                          {u.role === "admin" ? t("adminPanel.admin") : t("adminPanel.userRole")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {isLocked ? (
                          <span style={{ color: "#ef4444", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertTriangle size={12} />
                            {t("adminPanel.suspended")}
                          </span>
                        ) : (
                          <span style={{ color: "#10b981", fontSize: "12px" }}>
                            ✓ {t("adminPanel.active")}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", fontSize: "13px", color: "var(--ef-muted)" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <Button variant="secondary"
                            type="button"

                            disabled={isPending}
                            onClick={() => void handleToggleRole(u)}
                            style={{ padding: "4px 8px", fontSize: "12px", minHeight: "28px" }}
                            title={t("adminPanel.toggleRole")}
                          >
                            <UserCheck size={13} style={{ marginRight: "4px", display: "inline" }} />
                            {u.role === "admin" ? t("adminPanel.demote") : t("adminPanel.promote")}
                          </Button>
                          <Button
                            type="button"
                            variant={isLocked ? "connectionSuccess" : "danger"}
                            disabled={isPending}
                            onClick={() => void handleToggleLock(u)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              minHeight: "28px",
                              background: isLocked ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              border: isLocked ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                              color: isLocked ? "#34d399" : "#f87171"
                            }}
                          >
                            {isLocked ? (
                              <>
                                <Unlock size={13} style={{ marginRight: "4px", display: "inline" }} />
                                {t("adminPanel.unlock")}
                              </>
                            ) : (
                              <>
                                <Lock size={13} style={{ marginRight: "4px", display: "inline" }} />
                                {t("adminPanel.suspend")}
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
