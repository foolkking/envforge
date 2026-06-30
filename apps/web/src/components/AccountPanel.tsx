import { Button } from "./ui/Button";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  changePassword,
  confirmEmailChange,
  confirmTwoFactorEnroll,
  deleteAccount,
  disableTwoFactor,
  fetchAuthProviders,
  fetchMeFull,
  patchProfile,
  regenerateRecoveryCodes,
  requestEmailChange,
  sendNotificationTest,
  startGitHubLink,
  startGoogleLink,
  startTwoFactorEnroll,
  unlinkIdentity,
  updateNotificationPrefs,
  type IdentityEntry,
  type MeFullResponse,
  type NotificationPrefs
} from "../api";
import type { Locale } from "../lib/types";
import { confirmDialog } from "../lib/dialogs";

interface Props {
  locale: Locale;
  authToken: string;
}

export function AccountPanel({ authToken }: Props) {
  const { t } = useTranslation();
  const [me, setMe] = useState<MeFullResponse | null>(null);
  const [providers, setProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    if (!authToken) return;
    setLoading(true);
    setError("");
    try {
      const [account, providerStatus] = await Promise.all([
        fetchMeFull(authToken),
        fetchAuthProviders().catch(() => ({ github: false, google: false }))
      ]);
      setMe(account);
      setProviders(providerStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [authToken]);

  if (!authToken) return <p className="empty-hint">{t("account.loginRequired")}</p>;
  if (loading) return <p className="empty-hint">{t("account.loading")}</p>;
  if (error) return <p className="connection-error">{error}</p>;
  if (!me) return null;

  return (
    <div className="account-settings-grid">
      <ProfileSection authToken={authToken} me={me} onRefresh={reload} />
      <EmailSection authToken={authToken} me={me} onRefresh={reload} />
      <SecuritySection authToken={authToken} me={me} onRefresh={reload} />
      <IdentitiesSection authToken={authToken} identities={me.identities} providers={providers} onRefresh={reload} />
      <NotificationsSection authToken={authToken} prefs={me.notificationPrefs} />
      <ActivitySection activity={me.activity} />
      <DangerSection authToken={authToken} onRefresh={reload} />
    </div>
  );
}

function ProfileSection({ authToken, me, onRefresh }: {
  authToken: string;
  me: MeFullResponse;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(me.user.displayName ?? "");
  const [username, setUsername] = useState(me.user.username ?? "");
  const [bio, setBio] = useState(me.user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(me.user.avatarUrl ?? "");
  const [defaultSshUser, setDefaultSshUser] = useState(me.user.defaultSshUser ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await patchProfile(authToken, { displayName, username, bio, avatarUrl, defaultSshUser });
      setMessage(t("account.profile.saved"));
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <div>
          <h3>{t("account.profile.title")}</h3>
          <p>{t("account.profile.intro")}</p>
        </div>
      </div>
      <div className="settings-form-grid">
        <label>{t("account.profile.displayName")}<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
        <label>{t("account.profile.username")}<input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>{t("account.profile.avatarUrl")}<input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} /></label>
        <label>{t("account.profile.sshUser")}<input value={defaultSshUser} onChange={(e) => setDefaultSshUser(e.target.value)} /></label>
      </div>
      <label className="settings-full-field">{t("account.profile.bio")}<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></label>
      <Button variant="primary"  type="button" disabled={saving} onClick={() => void save()}>{saving ? "..." : t("account.profile.save")}</Button>
      {message ? <p className="settings-note">{message}</p> : null}
    </section>
  );
}

function EmailSection({ authToken, me, onRefresh }: {
  authToken: string;
  me: MeFullResponse;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [newEmail, setNewEmail] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function requestChange() {
    setMessage("");
    try {
      const result = await requestEmailChange(authToken, newEmail.trim());
      setPendingId(result.pendingId);
      setMessage(result.devCode ? `Dev code: ${result.devCode}` : t("account.email.sent"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.email.requestFailed"));
    }
  }

  async function confirmChange() {
    setMessage("");
    try {
      const result = await confirmEmailChange(authToken, { pendingId, code: code.trim() });
      setMessage(t("account.email.updated", { email: result.email }));
      setNewEmail("");
      setPendingId("");
      setCode("");
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.email.confirmFailed"));
    }
  }

  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <div>
          <h3>{t("account.email.title")}</h3>
          <p><strong>{me.user.email}</strong>{me.user.emailVerifiedAt ? ` · ${t("account.email.verified")}` : ""}</p>
        </div>
      </div>
      <div className="settings-inline-form">
        <input type="email" placeholder={t("account.email.newEmail")} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <Button variant="secondary"  type="button" onClick={() => void requestChange()}>{t("account.email.sendCode")}</Button>
      </div>
      {pendingId ? (
        <div className="settings-inline-form">
          <input placeholder={t("account.email.code")} value={code} onChange={(e) => setCode(e.target.value)} />
          <Button variant="primary"  type="button" onClick={() => void confirmChange()}>{t("account.email.confirm")}</Button>
        </div>
      ) : null}
      {message ? <p className="settings-note">{message}</p> : null}
    </section>
  );
}

function SecuritySection({ authToken, me, onRefresh }: {
  authToken: string;
  me: MeFullResponse;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [enroll, setEnroll] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function savePassword() {
    setMessage("");
    try {
      await changePassword(authToken, { oldPassword, newPassword, currentTotpCode: totpCode || undefined });
      setOldPassword("");
      setNewPassword("");
      setTotpCode("");
      setMessage(t("account.security.passwordUpdated"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.security.passwordFailed"));
    }
  }

  async function startEnroll() {
    setMessage("");
    const result = await startTwoFactorEnroll(authToken);
    setEnroll({ secret: result.secret, qrDataUrl: result.qrDataUrl });
  }

  async function confirmEnroll() {
    setMessage("");
    try {
      const result = await confirmTwoFactorEnroll(authToken, totpCode.trim());
      setRecoveryCodes(result.recoveryCodes);
      setEnroll(null);
      setTotpCode("");
      setMessage(t("account.security.enabledMessage"));
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.security.confirmFailed"));
    }
  }

  async function disable() {
    setMessage("");
    try {
      await disableTwoFactor(authToken, { password: oldPassword || undefined, code: totpCode || undefined });
      setMessage(t("account.security.disabledMessage"));
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.security.disableFailed"));
    }
  }

  async function regenerate() {
    const result = await regenerateRecoveryCodes(authToken);
    setRecoveryCodes(result.recoveryCodes);
  }

  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <div>
          <h3>{t("account.security.title")}</h3>
          <p>{t("account.security.state", { state: me.twoFactor.enabled ? t("account.security.enabled") : t("account.security.disabled") })}</p>
        </div>
      </div>
      <div className="settings-form-grid">
        <label>{t("account.security.currentPassword")}<input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} /></label>
        <label>{t("account.security.newPassword")}<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label>{t("account.security.code")}<input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} /></label>
      </div>
      <div className="settings-actions-row">
        <Button variant="primary"  type="button" onClick={() => void savePassword()}>{t("account.security.updatePassword")}</Button>
        {me.twoFactor.enabled ? (
          <>
            <Button variant="secondary"  type="button" onClick={() => void regenerate()}>{t("account.security.regenerate")}</Button>
            <button className="danger-action" type="button" onClick={() => void disable()}>{t("account.security.disable")}</button>
          </>
        ) : (
          <Button variant="secondary"  type="button" onClick={() => void startEnroll()}>{t("account.security.enable")}</Button>
        )}
      </div>
      {enroll ? (
        <div className="twofa-enroll-box">
          <img src={enroll.qrDataUrl} alt={t("account.security.qrAlt")} />
          <code>{enroll.secret}</code>
          <Button variant="primary"  type="button" onClick={() => void confirmEnroll()}>{t("account.security.confirm")}</Button>
        </div>
      ) : null}
      {recoveryCodes.length > 0 ? <pre className="recovery-codes">{recoveryCodes.join("\n")}</pre> : null}
      {message ? <p className="settings-note">{message}</p> : null}
    </section>
  );
}

function IdentitiesSection({ authToken, identities, providers, onRefresh }: {
  authToken: string;
  identities: IdentityEntry[];
  providers: { github: boolean; google: boolean };
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const linked = new Set(identities.map((identity) => identity.provider));
  const [message, setMessage] = useState("");

  async function link(provider: "github" | "google") {
    setMessage("");
    try {
      const result = provider === "github" ? await startGitHubLink(authToken) : await startGoogleLink(authToken);
      window.location.href = result.authorizeUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.identities.linkFailed"));
    }
  }

  async function unlink(provider: "github" | "google") {
    setMessage("");
    try {
      await unlinkIdentity(authToken, provider);
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.identities.unlinkFailed"));
    }
  }

  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <div>
          <h3>{t("account.identities.title")}</h3>
          <p>{t("account.identities.intro")}</p>
        </div>
      </div>
      <div className="identity-list">
        {identities.map((identity) => (
          <div className="identity-row" key={identity.provider}>
            <strong>{identity.provider}</strong>
            <span className="identity-email">{identity.providerEmail ?? identity.providerLogin ?? "-"}</span>
            {identity.provider === "github" || identity.provider === "google" ? (
              <Button variant="secondary"  type="button" onClick={() => void unlink(identity.provider as "github" | "google")}>{t("account.identities.unlink")}</Button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="settings-actions-row">
        {providers.github && !linked.has("github") ? <Button variant="secondary"  type="button" onClick={() => void link("github")}>{t("account.identities.linkGithub")}</Button> : null}
        {providers.google && !linked.has("google") ? <Button variant="secondary"  type="button" onClick={() => void link("google")}>{t("account.identities.linkGoogle")}</Button> : null}
      </div>
      {message ? <p className="settings-note">{message}</p> : null}
    </section>
  );
}

function NotificationsSection({ authToken, prefs }: {
  authToken: string;
  prefs: NotificationPrefs;
}) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(prefs);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setLocal(prefs), [prefs.updatedAt]);

  const visibleItems: Array<{ key: keyof NotificationPrefs; label: string; desc: string }> = [
    { key: "emailMentions", label: t("account.notifications.mentions"), desc: t("account.notifications.mentionsDesc") },
    { key: "emailComments", label: t("account.notifications.comments"), desc: t("account.notifications.commentsDesc") },
    { key: "emailSuggestionStatus", label: t("account.notifications.suggestions"), desc: t("account.notifications.suggestionsDesc") },
    { key: "emailPublishStatus", label: t("account.notifications.publish"), desc: t("account.notifications.publishDesc") }
  ];

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const result = await updateNotificationPrefs(authToken, {
        emailMentions: local.emailMentions,
        emailComments: local.emailComments,
        emailSuggestionStatus: local.emailSuggestionStatus,
        emailPublishStatus: local.emailPublishStatus
      });
      setLocal(result);
      setMessage(t("account.notifications.saved"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.notifications.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function testNotification() {
    setTesting(true);
    setMessage("");
    try {
      const result = await sendNotificationTest(authToken);
      if (result.emailEnabled && result.emailQueued) {
        setMessage(t("account.notifications.queued"));
      } else if (result.emailEnabled) {
        setMessage(t("account.notifications.notQueued"));
      } else {
        setMessage(t("account.notifications.emailOff"));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.notifications.testFailed"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="settings-section notification-settings">
      <div className="settings-section-heading">
        <div>
          <h3>{t("account.notifications.title")}</h3>
          <p>{t("account.notifications.intro")}</p>
        </div>
      </div>
      <ul className="notification-prefs">
        {visibleItems.map((item) => (
          <li key={item.key}>
            <label className="notification-pref-row">
              <input
                type="checkbox"
                checked={Boolean(local[item.key])}
                onChange={(event) => setLocal((current) => ({ ...current, [item.key]: event.target.checked }))}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="settings-action-row">
        <Button variant="primary"  type="button" disabled={saving} onClick={() => void save()}>{saving ? "..." : t("account.notifications.save")}</Button>
        <Button variant="secondary"  type="button" disabled={testing} onClick={() => void testNotification()}>{testing ? "..." : t("account.notifications.test")}</Button>
      </div>
      {message ? <p className="settings-note">{message}</p> : null}
    </section>
  );
}

function ActivitySection({ activity }: { activity: MeFullResponse["activity"] }) {
  const { t } = useTranslation();
  const items = [
    { label: t("account.activity.connections"), value: activity.connections },
    { label: t("account.activity.profiles"), value: activity.uploadedProfiles },
    { label: "Playbook", value: activity.playbooks },
    { label: t("account.activity.tasks"), value: activity.tasksExecuted },
    { label: t("account.activity.oauth"), value: activity.identitiesLinked },
    { label: "API tokens", value: activity.apiTokens }
  ];

  return (
    <section className="settings-section">
      <h3>{t("account.activity.title")}</h3>
      <dl className="activity-grid">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DangerSection({ authToken, onRefresh }: {
  authToken: string;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function removeAccount() {
    if (!(await confirmDialog({ message: t("account.danger.confirm"), danger: true }))) return;
    try {
      await deleteAccount(authToken, { password: password || undefined, currentTotpCode: code || undefined });
      setMessage(t("account.danger.deleted"));
      await onRefresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("account.danger.deleteFailed"));
    }
  }

  return (
    <section className="settings-section danger-zone">
      <h3>{t("account.danger.title")}</h3>
      <div className="settings-form-grid">
        <label>{t("account.danger.password")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>{t("account.danger.code")}<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      </div>
      <button className="danger-action" type="button" onClick={() => void removeAccount()}>{t("account.danger.delete")}</button>
      {message ? <p className="settings-note">{message}</p> : null}
    </section>
  );
}
