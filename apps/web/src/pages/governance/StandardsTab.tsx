import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, FileText, RefreshCcw, Shield } from "lucide-react";
import {
  fetchCapabilityStandards,
  fetchCapabilityRequirements,
  fetchCapabilityCertificationRuns,
  fetchCapabilityAuditLog,
  saveCapabilityRequirementDraft,
  simulateCapabilityRequirementCertification,
  publishCapabilityRequirementDraft,
  rollbackCapabilityRequirementVersion,
  cloneCapabilityStandard,
  createCapabilityStandard,
  updateCapabilityStandard,
  type CapabilityStandardProfile,
  type CapabilityRequirementSectionState,
  type CapabilityRequirementVersion,
  type CapabilityRequirementDraft,
  type CapabilityCertificationRun,
  type AdminAuditLogEntry,
  type CapabilityStandardSection
} from "../../api";
import type { Locale } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { confirmDialog } from "../../lib/dialogs";
import {
  REQUIREMENT_LABELS,
  FilterPills,
  SummaryStat,
  Th,
  Td,
  summaryStyle,
  panelStyle,
  compactLabelStyle,
  type AdminCatalogRow,
  type CapabilityRequirementsDetail,
  type StandardProfileEditorState
} from "./shared";

// ── Standards tab ────────────────────────────────────────────────────

export function StandardsTab({ locale, authToken, rows }: { locale: Locale; authToken: string; rows: AdminCatalogRow[] }): JSX.Element {
  const [profiles, setProfiles] = useState<CapabilityStandardProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [selectedCapabilityId, setSelectedCapabilityId] = useState(rows[0]?.id ?? "");
  const [detail, setDetail] = useState<CapabilityRequirementsDetail | null>(null);
  const [sections, setSections] = useState<Record<string, CapabilityRequirementSectionState>>({});
  const [runs, setRuns] = useState<CapabilityCertificationRun[]>([]);
  const [auditEntries, setAuditEntries] = useState<AdminAuditLogEntry[]>([]);
  const [profileEditor, setProfileEditor] = useState<StandardProfileEditorState | null>(null);
  const [sectionFilter, setSectionFilter] = useState<"all" | "open" | "satisfied">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCapabilityId && rows[0]?.id) setSelectedCapabilityId(rows[0].id);
  }, [rows, selectedCapabilityId]);

  useEffect(() => {
    let abort = false;
    fetchCapabilityStandards(authToken)
      .then((standards) => {
        if (abort) return;
        setProfiles(standards.profiles);
        setActiveProfileId((current) => current && standards.profiles.some((profile) => profile.id === current) ? current : standards.activeProfileId);
      })
      .catch((err: Error) => { if (!abort) setError(err.message); });
    return () => { abort = true; };
  }, [authToken]);

  useEffect(() => {
    if (!selectedCapabilityId) return;
    let abort = false;
    setLoading(true);
    setError("");
    fetchCapabilityRequirements(authToken, selectedCapabilityId, { profileId: activeProfileId || undefined })
      .then(async (requirement) => {
        if (abort) return;
        setDetail(requirement);
        setSections(requirement.projectedSections);
        setActiveProfileId((current) => current || requirement.activeProfile.id);
        const [runBody, auditBody] = await Promise.all([
          fetchCapabilityCertificationRuns(authToken, requirement.item.id, { profileId: requirement.activeProfile.id, limit: 20 }),
          fetchCapabilityAuditLog(authToken, { targetId: requirement.item.id, limit: 30 })
        ]);
        if (abort) return;
        setRuns(runBody.runs);
        setAuditEntries(auditBody.entries);
      })
      .catch((err: Error) => { if (!abort) setError(err.message); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [authToken, selectedCapabilityId, activeProfileId]);

  async function reloadStandards(nextProfileId?: string) {
    const standards = await fetchCapabilityStandards(authToken);
    setProfiles(standards.profiles);
    setActiveProfileId((current) => nextProfileId ?? (current && standards.profiles.some((profile) => profile.id === current) ? current : standards.activeProfileId));
  }

  async function reloadRequirement(capabilityId = selectedCapabilityId, profileId = activeProfileId) {
    if (!capabilityId) return;
    const next = await fetchCapabilityRequirements(authToken, capabilityId, { profileId: profileId || undefined });
    setDetail(next);
    setSections(next.projectedSections);
    setActiveProfileId(next.activeProfile.id);
    const [runBody, auditBody] = await Promise.all([
      fetchCapabilityCertificationRuns(authToken, capabilityId, { profileId: next.activeProfile.id, limit: 20 }),
      fetchCapabilityAuditLog(authToken, { targetId: capabilityId, limit: 30 })
    ]);
    setRuns(runBody.runs);
    setAuditEntries(auditBody.entries);
  }

  function updateSection(sectionId: string, patch: Partial<CapabilityRequirementSectionState>) {
    setSections((current) => {
      const previous = current[sectionId];
      return {
        ...current,
        [sectionId]: {
          status: patch.status ?? previous?.status ?? "pending",
          evidence: patch.evidence ?? previous?.evidence ?? [],
          notes: patch.notes ?? previous?.notes,
          notApplicableReason: patch.notApplicableReason ?? previous?.notApplicableReason
        }
      };
    });
  }

  function setAllSections(status: CapabilityRequirementSectionState["status"]) {
    const profile = detail?.activeProfile ?? profiles.find((entry) => entry.id === activeProfileId);
    if (!profile) return;
    setSections((current) => {
      const next = { ...current };
      for (const section of profile.sections) {
        const previous = next[section.id];
        next[section.id] = {
          status,
          evidence: previous?.evidence ?? [],
          notes: previous?.notes,
          notApplicableReason: status === "notApplicable" ? previous?.notApplicableReason : undefined
        };
      }
      return next;
    });
  }

  async function saveDraft() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      await saveCapabilityRequirementDraft(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        sections,
        note: "Saved from Capability Admin Standards tab"
      });
      await reloadRequirement(detail.item.id, detail.activeProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function simulate() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      const result = await simulateCapabilityRequirementCertification(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        sections
      });
      setDetail((current) => current ? { ...current, latestRun: result.run } : current);
      setRuns((current) => [result.run, ...current.filter((run) => run.id !== result.run.id)].slice(0, 20));
      const audit = await fetchCapabilityAuditLog(authToken, { targetId: detail.item.id, limit: 30 });
      setAuditEntries(audit.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      let draft: CapabilityRequirementDraft | null = detail.draft;
      if (!draft) {
        const saved = await saveCapabilityRequirementDraft(authToken, detail.item.id, {
          profileId: detail.activeProfile.id,
          sections,
          note: "Created automatically before publish"
        });
        draft = saved.draft;
      }
      await publishCapabilityRequirementDraft(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        draftId: draft.id,
        note: "Published from Capability Admin Standards tab"
      });
      await reloadRequirement(detail.item.id, detail.activeProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  async function rollback(version: CapabilityRequirementVersion) {
    if (!detail) return;
    const ok = await confirmDialog({
      message: locale === "zh"
        ? `回滚 ${detail.item.id} 到 v${version.version}?将发布一个新版本。`
        : `Rollback ${detail.item.id} to v${version.version}? This creates a new published version.`,
      confirmLabel: locale === "zh" ? "回滚" : "Rollback",
      cancelLabel: locale === "zh" ? "取消" : "Cancel"
    });
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      await rollbackCapabilityRequirementVersion(authToken, detail.item.id, {
        profileId: detail.activeProfile.id,
        versionId: version.id,
        note: `Rollback to v${version.version}`
      });
      await reloadRequirement(detail.item.id, detail.activeProfile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setSaving(false);
    }
  }

  function startEditProfile(profile: CapabilityStandardProfile) {
    setProfileEditor({
      id: profile.id,
      key: profile.key,
      name: profile.name,
      description: profile.description ?? "",
      status: profile.status,
      sections: profile.sections.map((section) => ({ ...section }))
    });
  }

  function startNewProfile() {
    const source = detail?.activeProfile ?? profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
    setProfileEditor({
      key: source?.key ?? "full-migration",
      name: source ? `${source.name} draft` : "New standard profile",
      description: source?.description ?? "",
      status: "draft",
      sections: source?.sections.map((section) => ({ ...section })) ?? []
    });
  }

  async function cloneProfile(status: "draft" | "active") {
    const source = detail?.activeProfile ?? profiles.find((profile) => profile.id === activeProfileId);
    if (!source) return;
    setSaving(true);
    setError("");
    try {
      const cloned = await cloneCapabilityStandard(authToken, source.id, {
        name: `${source.name} v${source.version + 1}`,
        status
      });
      await reloadStandards(cloned.profile.id);
      setActiveProfileId(cloned.profile.id);
      startEditProfile(cloned.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfileEditor() {
    if (!profileEditor) return;
    setSaving(true);
    setError("");
    try {
      const input = {
        name: profileEditor.name,
        description: profileEditor.description,
        status: profileEditor.status,
        sections: profileEditor.sections
      };
      const saved = profileEditor.id
        ? await updateCapabilityStandard(authToken, profileEditor.id, input)
        : await createCapabilityStandard(authToken, {
            key: profileEditor.key,
            name: profileEditor.name,
            description: profileEditor.description,
            sections: profileEditor.sections
          });
      if (!profileEditor.id && profileEditor.status !== "draft") {
        await updateCapabilityStandard(authToken, saved.profile.id, { status: profileEditor.status });
      }
      await reloadStandards(saved.profile.id);
      setActiveProfileId(saved.profile.id);
      setProfileEditor(null);
      await reloadRequirement(selectedCapabilityId, saved.profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile save failed");
    } finally {
      setSaving(false);
    }
  }

  const activeProfile = detail?.activeProfile ?? profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const latestRun = detail?.latestRun ?? runs[0] ?? null;
  const sectionStats = useMemo(() => {
    const values = activeProfile?.sections.map((section) => sections[section.id]?.status ?? "pending") ?? [];
    return {
      total: values.length,
      satisfied: values.filter((status) => status === "satisfied").length,
      open: values.filter((status) => status === "pending" || status === "blocked").length,
      notApplicable: values.filter((status) => status === "notApplicable").length
    };
  }, [activeProfile, sections]);
  const visibleSections = useMemo(() => {
    const defs = activeProfile?.sections ?? [];
    return defs.filter((section) => {
      const status = sections[section.id]?.status ?? "pending";
      if (sectionFilter === "open") return status === "pending" || status === "blocked";
      if (sectionFilter === "satisfied") return status === "satisfied";
      return true;
    });
  }, [activeProfile, sectionFilter, sections]);

  return (
    <div data-testid="standards-tab" style={{ display: "grid", gap: 16 }}>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Versioned standards layer</h2>
            <p style={{ color: "var(--ef-muted)", margin: "4px 0 0 0", maxWidth: 780 }}>
              Admins maintain standard profiles, per-capability requirement drafts, simulation runs, published versions, rollback history, and audit logs. Published versions record governance state; the runtime certified-only gate still applies.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <label style={compactLabelStyle}>
              <span>Profile</span>
              <select value={activeProfileId} onChange={(event) => setActiveProfileId(event.target.value)}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name} v{profile.version} ({profile.status})</option>
                ))}
              </select>
            </label>
            <label style={compactLabelStyle}>
              <span>Capability</span>
              <select value={selectedCapabilityId} onChange={(event) => setSelectedCapabilityId(event.target.value)}>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.name} ({row.id})</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {error ? <div style={{ background: "var(--ef-danger-soft)", color: "var(--ef-danger)", padding: 12, borderRadius: 6 }}>{error}</div> : null}

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15 }}>Standard profiles</h3>
            <p style={{ margin: "4px 0 0 0", color: "var(--ef-muted)", fontSize: 12 }}>
              Edit the default profile by materializing it online, clone profiles for new revisions, activate one profile per key, and retire older profiles only after a replacement exists.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={startNewProfile} disabled={saving}>New profile</Button>
            <Button variant="ghost" onClick={() => cloneProfile("draft")} disabled={saving || !activeProfile}>Clone draft</Button>
            <Button variant="ghost" onClick={() => cloneProfile("active")} disabled={saving || !activeProfile}>Clone active</Button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--ef-surface-soft)" }}>
              <tr><Th>Profile</Th><Th>Key</Th><Th>Status</Th><Th>Sections</Th><Th>Updated</Th><Th>Action</Th></tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} style={{ borderBottom: "1px solid var(--ef-border)", background: profile.id === activeProfileId ? "var(--ef-info-soft)" : undefined }}>
                  <Td><strong>{profile.name}</strong><div style={{ color: "var(--ef-muted)", fontSize: 11 }}>{profile.id} / v{profile.version}</div></Td>
                  <Td><code>{profile.key}</code></Td>
                  <Td>{profile.status}</Td>
                  <Td>{profile.sections.length}</Td>
                  <Td>{new Date(profile.updatedAt).toLocaleString()}</Td>
                  <Td>
                    <Button variant="ghost" onClick={() => startEditProfile(profile)} disabled={saving}>Edit</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {profileEditor ? (
          <StandardProfileEditor
            editor={profileEditor}
            saving={saving}
            onChange={setProfileEditor}
            onCancel={() => setProfileEditor(null)}
            onSave={saveProfileEditor}
          />
        ) : null}
      </section>

      {loading || !detail || !activeProfile ? (
        <p style={{ color: "var(--ef-muted)" }}>Loading...</p>
      ) : (
        <>
          <section style={summaryStyle}>
            <SummaryStat label="Runtime gate" value={detail.certification.status} icon={<Shield size={16} aria-hidden />} tone={detail.certification.status === "certified" ? "green" : "amber"} />
            <SummaryStat label="Published version" value={detail.currentVersion ? `v${detail.currentVersion.version}` : "none"} icon={<BookOpen size={16} aria-hidden />} tone="slate" />
            <SummaryStat label="Draft" value={detail.draft ? `v${detail.draft.draftVersion}` : "none"} icon={<FileText size={16} aria-hidden />} tone="slate" />
            <SummaryStat label="Sections" value={`${sectionStats.satisfied}/${sectionStats.total}`} icon={<CheckCircle2 size={16} aria-hidden />} tone={sectionStats.open === 0 ? "green" : "amber"} />
            <SummaryStat label="Last simulation" value={latestRun?.status ?? "none"} icon={<RefreshCcw size={16} aria-hidden />} tone={latestRun?.status === "certified" ? "green" : "amber"} />
          </section>

          <section style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15 }}>{detail.item.name}</h3>
                <p style={{ margin: "4px 0 0 0", color: "var(--ef-muted)" }}>
                  <code>{detail.item.id}</code> / <code>{detail.item.capabilityKey ?? "-"}</code> / {detail.item.category} / <code>{detail.activeProfile.name}</code>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <FilterPills
                  value={sectionFilter}
                  onChange={setSectionFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "open", label: "Open" },
                    { value: "satisfied", label: "Satisfied" }
                  ]}
                />
                <Button variant="ghost" onClick={() => setAllSections("satisfied")} disabled={saving}>Mark all satisfied</Button>
                <Button variant="ghost" onClick={() => setAllSections("pending")} disabled={saving}>Mark all pending</Button>
                <Button variant="ghost" onClick={() => setSections(detail.projectedSections)} disabled={saving}>Reset</Button>
                <Button variant="ghost" onClick={saveDraft} disabled={saving}>Save draft</Button>
                <Button variant="ghost" onClick={simulate} disabled={saving}>Simulate</Button>
                <Button variant="primary" onClick={publish} disabled={saving}>Publish</Button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {visibleSections.map((section) => {
                const state = sections[section.id] ?? { status: "pending" as const, evidence: [] };
                const result = latestRun?.sectionResults?.[section.id];
                return (
                  <div key={section.id} style={{ border: "1px solid var(--ef-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong>{REQUIREMENT_LABELS[section.id]?.[locale] ?? section.label}</strong>
                        <span style={{ marginLeft: 8, color: section.severity === "critical" ? "var(--ef-danger)" : "var(--ef-muted)", fontSize: 11 }}>{section.severity}</span>
                        <p style={{ margin: "2px 0 0 0", color: "var(--ef-muted)", fontSize: 12 }}>{section.description}</p>
                        {result && !result.ok ? <p style={{ margin: "3px 0 0 0", color: "var(--ef-warning)", fontSize: 12 }}>{result.reason}</p> : null}
                      </div>
                      <select value={state.status} onChange={(event) => updateSection(section.id, { status: event.target.value as CapabilityRequirementSectionState["status"] })}>
                        <option value="pending">pending</option>
                        <option value="satisfied">satisfied</option>
                        <option value="notApplicable">notApplicable</option>
                        <option value="blocked">blocked</option>
                      </select>
                    </div>
                    <textarea
                      value={state.notes ?? ""}
                      onChange={(event) => updateSection(section.id, { notes: event.target.value })}
                      placeholder="Notes / evidence summary"
                      rows={2}
                      style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: "8px 10px", resize: "vertical" }}
                    />
                    <textarea
                      value={(state.evidence ?? []).join("\n")}
                      onChange={(event) => updateSection(section.id, { evidence: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                      placeholder="Evidence links or commands, one per line"
                      rows={2}
                      style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: "8px 10px", resize: "vertical" }}
                    />
                    {state.status === "notApplicable" ? (
                      <input
                        value={state.notApplicableReason ?? ""}
                        onChange={(event) => updateSection(section.id, { notApplicableReason: event.target.value })}
                        placeholder="Not-applicable reason"
                        style={{ border: "1px solid var(--ef-warning)", borderRadius: 6, padding: "8px 10px" }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <StandardsHistoryFull
            latestRun={latestRun}
            runs={runs}
            versions={detail.versions}
            auditEntries={auditEntries}
            locale={locale}
            saving={saving}
            onRollback={rollback}
            onRestoreVersion={(version) => setSections(version.sections)}
          />
        </>
      )}
    </div>
  );
}

function StandardProfileEditor({
  editor,
  saving,
  onChange,
  onCancel,
  onSave
}: {
  editor: StandardProfileEditorState;
  saving: boolean;
  onChange: (next: StandardProfileEditorState) => void;
  onCancel: () => void;
  onSave: () => void;
}): JSX.Element {
  function updateSection(index: number, patch: Partial<CapabilityStandardSection>) {
    const sections = editor.sections.map((section, i) => i === index ? { ...section, ...patch } : section);
    onChange({ ...editor, sections });
  }
  function addSection() {
    const nextIndex = editor.sections.length + 1;
    onChange({
      ...editor,
      sections: [
        ...editor.sections,
        { id: `custom-${nextIndex}`, label: `Custom ${nextIndex}`, description: "", required: true, allowNotApplicable: true, severity: "required" }
      ]
    });
  }
  function removeSection(index: number) {
    onChange({ ...editor, sections: editor.sections.filter((_, i) => i !== index) });
  }
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--ef-border)", paddingTop: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={compactLabelStyle}>
          <span>Key</span>
          <input value={editor.key} onChange={(event) => onChange({ ...editor, key: event.target.value })} disabled={Boolean(editor.id)} />
        </label>
        <label style={compactLabelStyle}>
          <span>Name</span>
          <input value={editor.name} onChange={(event) => onChange({ ...editor, name: event.target.value })} />
        </label>
        <label style={compactLabelStyle}>
          <span>Status</span>
          <select value={editor.status} onChange={(event) => onChange({ ...editor, status: event.target.value as StandardProfileEditorState["status"] })}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="retired">retired</option>
          </select>
        </label>
      </div>
      <label style={compactLabelStyle}>
        <span>Description</span>
        <textarea value={editor.description} onChange={(event) => onChange({ ...editor, description: event.target.value })} rows={2} />
      </label>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong>Profile sections</strong>
        <Button variant="ghost" onClick={addSection} disabled={saving}>Add section</Button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {editor.sections.map((section, index) => (
          <div key={`${section.id}-${index}`} style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <label style={compactLabelStyle}>
                <span>Id</span>
                <input value={section.id} onChange={(event) => updateSection(index, { id: event.target.value })} />
              </label>
              <label style={compactLabelStyle}>
                <span>Label</span>
                <input value={section.label} onChange={(event) => updateSection(index, { label: event.target.value })} />
              </label>
              <label style={compactLabelStyle}>
                <span>Severity</span>
                <select value={section.severity} onChange={(event) => updateSection(index, { severity: event.target.value as CapabilityStandardSection["severity"] })}>
                  <option value="required">required</option>
                  <option value="critical">critical</option>
                  <option value="advisory">advisory</option>
                </select>
              </label>
            </div>
            <textarea value={section.description} onChange={(event) => updateSection(index, { description: event.target.value })} placeholder="Description" rows={2} />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={section.required} onChange={(event) => updateSection(index, { required: event.target.checked })} />
                Required
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={section.allowNotApplicable} onChange={(event) => updateSection(index, { allowNotApplicable: event.target.checked })} />
                Allow N/A
              </label>
              <Button variant="ghost" onClick={() => removeSection(index)} disabled={saving || editor.sections.length <= 1}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>Save profile</Button>
      </div>
    </div>
  );
}

function StandardsHistoryFull({
  latestRun,
  runs,
  versions,
  auditEntries,
  locale,
  saving,
  onRollback,
  onRestoreVersion
}: {
  latestRun: CapabilityCertificationRun | null;
  runs: CapabilityCertificationRun[];
  versions: CapabilityRequirementVersion[];
  auditEntries: AdminAuditLogEntry[];
  locale: Locale;
  saving: boolean;
  onRollback: (version: CapabilityRequirementVersion) => void;
  onRestoreVersion: (version: CapabilityRequirementVersion) => void;
}): JSX.Element {
  return (
    <section style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>Certification runs, versions, and audit log</h3>
      {latestRun ? (
        <div style={{ marginBottom: 12, color: latestRun.status === "certified" ? "var(--ef-success)" : "var(--ef-warning)" }}>
          <strong>{latestRun.status}</strong>
          <span style={{ marginLeft: 8, color: "var(--ef-muted)" }}>{new Date(latestRun.createdAt).toLocaleString()}</span>
          {latestRun.reasons.length > 0 ? (
            <ul style={{ margin: "6px 0 0 16px" }}>
              {latestRun.reasons.slice(0, 6).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : (
        <p style={{ color: "var(--ef-muted)" }}>No simulation run yet.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <h4 style={{ margin: "0 0 8px 0" }}>Published versions</h4>
          {versions.length === 0 ? (
            <p style={{ color: "var(--ef-muted)" }}>No published versions yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--ef-surface-soft)" }}>
                <tr><Th>Version</Th><Th>Status</Th><Th>Published</Th><Th>Action</Th></tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} style={{ borderBottom: "1px solid var(--ef-border)" }}>
                    <Td>
                      <strong>v{version.version}</strong>
                      {version.rollbackOfVersionId ? <div style={{ color: "var(--ef-muted)", fontSize: 11 }}>rollback of {version.rollbackOfVersionId}</div> : null}
                    </Td>
                    <Td>{version.status}</Td>
                    <Td>{new Date(version.publishedAt).toLocaleString()}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Button variant="ghost" onClick={() => onRestoreVersion(version)} disabled={saving}>Load</Button>
                        <Button variant="ghost" onClick={() => onRollback(version)} disabled={saving || version.status === "published"}>Rollback</Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <h4 style={{ margin: "0 0 8px 0" }}>Recent runs</h4>
          {runs.length === 0 ? (
            <p style={{ color: "var(--ef-muted)" }}>No runs recorded.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--ef-surface-soft)" }}>
                <tr><Th>Status</Th><Th>Missing</Th><Th>Created</Th></tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} style={{ borderBottom: "1px solid var(--ef-border)" }}>
                    <Td>{run.status}</Td>
                    <Td>{run.missingSections.length}</Td>
                    <Td>{new Date(run.createdAt).toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <h4 style={{ margin: "0 0 8px 0" }}>{locale === "zh" ? "管理审计日志" : "Admin audit log"}</h4>
        {auditEntries.length === 0 ? (
          <p style={{ color: "var(--ef-muted)" }}>{locale === "zh" ? "暂无审计记录。" : "No audit entries."}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--ef-surface-soft)" }}>
              <tr><Th>Action</Th><Th>Admin</Th><Th>Feedback</Th><Th>Time</Th></tr>
            </thead>
            <tbody>
              {auditEntries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid var(--ef-border)" }}>
                  <Td><code>{entry.action}</code></Td>
                  <Td>{entry.adminId}</Td>
                  <Td>{entry.feedback ?? "-"}</Td>
                  <Td>{new Date(entry.timestamp).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
