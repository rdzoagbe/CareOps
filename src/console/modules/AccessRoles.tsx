/**
 * People and access: who is who across the three platforms, what each of them
 * does, and what each of them can open.
 *
 * The screen is built around one awkward truth it would be easy to hide: the
 * group operations director, the most senior person in the back office, cannot
 * grant a role and cannot open a patient record. Acting as them and trying is
 * the fastest way to see that the rules are not about rank.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { useDirectory } from "@/directory/state";
import { PageHead } from "../ConsoleLayout";
import {
  PLATFORMS, ROLES, accessSummary, grantRefusals, isAccessAdministrator, liveGrants,
  needsEndDate, revocationRefusals, roleByKey, rolesOn,
  type Person, type Platform, type RoleGrant,
} from "@/directory";
import { ALL_FACILITIES, dstr, facilityName } from "@/data";
import { num } from "@/data/format";

type Chip = "all" | "multi" | "care" | "expiring" | "revoked" | "external";

const CHIPS: { k: Chip; n: string }[] = [
  { k: "all", n: "Everyone" },
  { k: "multi", n: "On more than one platform" },
  { k: "care", n: "Can open a patient record" },
  { k: "expiring", n: "Access expiring in 30 days" },
  { k: "revoked", n: "Access revoked" },
  { k: "external", n: "No employment contract" },
];

const TONE: Record<Platform, string> = { admin: "info", care: "bad", app: "ok" };
const d = (s: string) => dstr(new Date(s + "T12:00:00Z"));

export function AccessRolesModule() {
  const { db, scope, logEvent, toast } = useStore();
  const { directory, today, revoke, addGrant, setStatus } = useDirectory();
  const [chip, setChip] = useState<Chip>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  /** Who the console is acting as. The director is the default, and cannot grant. */
  const admin = directory.people.find((p) => isAccessAdministrator(p, today)) ?? null;
  const director =
    directory.people.find((p) => liveGrants(p, today).some((g) => g.role === "ops-director")) ?? null;
  const fallback = director ?? admin ?? directory.people[0];
  const [actingId, setActingId] = useState(fallback.id);
  const acting = directory.people.find((p) => p.id === actingId) ?? fallback;
  const actingIsAccessAdmin = isAccessAdministrator(acting, today);

  const inScope = useMemo(
    () =>
      directory.people.filter(
        (p) => scope.facility === ALL_FACILITIES || p.facility === scope.facility || p.facility === "ALL",
      ),
    [directory.people, scope.facility],
  );

  const summaries = useMemo(
    () => new Map(inScope.map((p) => [p.id, accessSummary(p, today)])),
    [inScope, today],
  );

  const stats = useMemo(() => {
    let multi = 0, care = 0, expiring = 0, revoked = 0, hats = 0;
    for (const p of inScope) {
      const s = summaries.get(p.id)!;
      if (s.platforms.length > 1) multi++;
      if (s.patientRecords) care++;
      if (s.expiring.length) expiring++;
      if (p.grants.length > 0 && s.roles.length === 0) revoked++;
      if (p.employeeRef && p.clinicianRef) hats++;
    }
    return { multi, care, expiring, revoked, hats };
  }, [inScope, summaries]);

  const rows = useMemo(() => {
    const keep = (p: Person) => {
      const s = summaries.get(p.id)!;
      switch (chip) {
        case "multi": return s.platforms.length > 1;
        case "care": return s.patientRecords;
        case "expiring": return s.expiring.length > 0;
        case "revoked": return p.grants.length > 0 && s.roles.length === 0;
        case "external": return p.employment === "External";
        default: return true;
      }
    };
    return inScope.filter(keep).slice(0, 60);
  }, [inScope, chip, summaries]);

  const current = openId ? directory.people.find((p) => p.id === openId) ?? null : null;

  const doRevoke = (person: Person, index: number) => {
    const g = person.grants[index];
    revoke(person.id, index);
    logEvent(
      "Access revoked: " + (roleByKey(g.role)?.label ?? g.role),
      `${person.id} ${person.name}`,
      "Success",
      acting.name,
    );
    toast("Revoked. It stops on every platform at once.");
  };

  const doGrant = (person: Person, grant: RoleGrant) => {
    addGrant(person.id, grant);
    logEvent(
      "Access granted: " + (roleByKey(grant.role)?.label ?? grant.role),
      `${person.id} ${person.name}`,
      "Success",
      acting.name,
    );
    toast("Granted, and recorded against your name.");
  };

  const doStatus = (person: Person, status: Person["status"]) => {
    setStatus(person.id, status);
    logEvent(`Status set to ${status.toLowerCase()}`, `${person.id} ${person.name}`, "Success", acting.name);
    toast(
      status === "Suspended" || status === "Left"
        ? "Every platform closes at once."
        : "Access restored to whatever grants are still live.",
    );
  };

  return (
    <>
      <PageHead
        title="People &amp; access"
        sub={`Who is who across the three platforms · ${facilityName(db.facilities, scope.facility)}`}
        actions={
          <label className="sec" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Acting as
            <select className="ctl" value={actingId} onChange={(e) => setActingId(e.target.value)}>
              {director && <option value={director.id}>{director.name} — Group operations director</option>}
              {admin && <option value={admin.id}>{admin.name} — Access administrator</option>}
              {!director && !admin && <option value={fallback.id}>{fallback.name}</option>}
            </select>
          </label>
        }
      />

      <div className="grid c4">
        <div className="card"><div className="kpi">
          <div className="lab">People in the directory</div>
          <div className="val">{num(inScope.length)}</div>
          <div className="sub">{num(stats.hats)} are both an employee and a clinician</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">On more than one platform</div>
          <div className="val">{num(stats.multi)}</div>
          <div className="sub">one person, several hats, one entry</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Can open a patient record</div>
          <div className="val">{num(stats.care)}</div>
          <div className="sub">only a care role does this, at any rank</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Access expiring in 30 days</div>
          <div className={`val ${stats.expiring ? "down" : ""}`}>{num(stats.expiring)}</div>
          <div className="sub">{num(stats.revoked)} already closed</div>
        </div></div>
      </div>

      <div className="grid c23" style={{ marginTop: 12 }}>
        <section className="card">
          <div className="ch">
            <div>
              <h3>Directory</h3>
              <div className="sub">Click a person for their roles, and what each one may and may not open</div>
            </div>
          </div>
          <div className="tbar">
            {CHIPS.map((c) => (
              <button key={c.k} className={`chip ${chip === c.k ? "on" : ""}`} onClick={() => setChip(c.k)}>
                {c.n}
              </button>
            ))}
          </div>
          <div className="scrollx">
            <table>
              <thead>
                <tr><th>Person</th><th>Platforms</th><th>Roles today</th><th>Employment</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const s = summaries.get(p.id)!;
                  const closed = p.grants.length > 0 && s.roles.length === 0;
                  return (
                    <tr key={p.id} onClick={() => setOpenId(p.id)}>
                      <td>
                        <b style={{ fontWeight: 500 }}>{p.name}</b>
                        <div className="sec">
                          {p.service}, {facilityName(db.facilities, p.facility).replace("St. Gabriel ", "")}
                        </div>
                      </td>
                      <td>
                        {s.platforms.length === 0
                          ? <span className="tag t-mute"><i className="dot" />none</span>
                          : s.platforms.map((pl) => (
                              <span key={pl} className={`tag t-${TONE[pl]}`} style={{ marginRight: 4 }}>
                                <i className="dot" />{PLATFORMS.find((x) => x.key === pl)!.label}
                              </span>
                            ))}
                      </td>
                      <td>
                        {s.roles.length ? s.roles.map((r) => r.label).join(", ") : <span className="sec">—</span>}
                        {s.expiring.length > 0 && (
                          <div className="sec">
                            {s.expiring.length} ending by {d(s.expiring[0].until!)}
                          </div>
                        )}
                      </td>
                      <td><span className="sec">{p.employment}</span></td>
                      <td>
                        {closed
                          ? <span className="tag t-bad"><i className="dot" />{p.status}, access closed</span>
                          : p.status === "Active"
                            ? <span className="tag t-ok"><i className="dot" />Active</span>
                            : <span className="tag t-warn"><i className="dot" />{p.status}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">Showing {rows.length} of {num(inScope.length)} people</div>
        </section>

        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <section className="card">
            <div className="ch"><div><h3>The three platforms</h3><div className="sub">And who each one is for</div></div></div>
            <div className="cb">
              {PLATFORMS.map((pl) => (
                <div className="rw" key={pl.key} style={{ padding: "8px 0" }}>
                  <div className="g">
                    <b>
                      <span className={`tag t-${TONE[pl.key]}`} style={{ marginRight: 6 }}><i className="dot" />{pl.label}</span>
                      {rolesOn(pl.key).length} roles
                    </b>
                    <span className="s">{pl.who}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="note w">
            <b>A role on one platform grants nothing on another.</b> Being head of HR does not open a
            patient record. Being a doctor does not open a payslip. There is no rank that crosses the
            line, because the line is not about rank.
          </div>

          <div className="note w">
            <b>Whoever administers access never reads content.</b> The access administrator grants and
            revokes roles and can say who holds what. They cannot open a patient record, a personnel
            file or a pay figure.
          </div>

          <div className="note">
            <b>Temporary access ends by itself.</b> Agency, bank and external grants carry an end date,
            so they expire with the assignment instead of outliving it.
          </div>

          <div className="note">
            <b>One entry, every platform.</b> Suspending someone or recording that they have left closes
            all three at once — that is the reason the directory exists at all.
          </div>
        </div>
      </div>

      {current && (
        <PersonSheet
          person={current}
          today={today}
          everyone={directory.people}
          actingId={acting.id}
          facilities={db.facilities}
          actingName={acting.name}
          actingIsAccessAdmin={actingIsAccessAdmin}
          onClose={() => setOpenId(null)}
          onRevoke={doRevoke}
          onGrant={doGrant}
          onStatus={doStatus}
        />
      )}
    </>
  );
}

function PersonSheet({
  person, today, everyone, actingId, facilities, actingName, actingIsAccessAdmin,
  onClose, onRevoke, onGrant, onStatus,
}: {
  person: Person;
  today: string;
  everyone: Person[];
  actingId: string;
  facilities: { id: string; name: string }[];
  actingName: string;
  actingIsAccessAdmin: boolean;
  onClose: () => void;
  onRevoke: (p: Person, i: number) => void;
  onGrant: (p: Person, g: RoleGrant) => void;
  onStatus: (p: Person, s: Person["status"]) => void;
}) {
  const s = accessSummary(person, today);
  const [roleKey, setRoleKey] = useState(ROLES[0].key);

  const proposed: RoleGrant = {
    role: roleKey,
    facility: person.facility,
    service: person.service,
    from: today,
    until: needsEndDate(person.employment)
      ? new Date(new Date(today + "T12:00:00Z").getTime() + 180 * 86400000).toISOString().slice(0, 10)
      : null,
    grantedBy: actingName,
  };
  const refusals = grantRefusals(person, proposed, actingIsAccessAdmin, actingId);

  /** Suspending closes every platform, so it is guarded like a revocation. */
  const suspendRefusals = revocationRefusals(
    person, everyone, actingId, today, isAccessAdministrator(person, today),
  );

  return (
    <div className="modal on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox" style={{ maxWidth: 820 }}>
        <div className="mh">
          <div>
            <h2>{person.name}</h2>
            <div className="s">
              {person.id} · {person.service}, {facilities.find((f) => f.id === person.facility)?.name ?? person.facility} ·{" "}
              {person.employment}
            </div>
          </div>
        </div>

        <div className="mb">
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              {person.status}
              {person.grants.length > 0 && s.roles.length === 0 && " — every platform is closed"}
            </dd>
            <dt>Platforms today</dt>
            <dd>
              {s.platforms.length
                ? s.platforms.map((pl) => (
                    <span key={pl} className={`tag t-${TONE[pl]}`} style={{ marginRight: 4 }}>
                      <i className="dot" />{PLATFORMS.find((x) => x.key === pl)!.label}
                    </span>
                  ))
                : "None"}
            </dd>
            <dt>Patient records</dt>
            <dd>
              {s.patientRecords
                ? <span className="tag t-bad"><i className="dot" />can open, within their care teams</span>
                : <span className="tag t-mute"><i className="dot" />cannot open any</span>}
            </dd>
            <dt>Also known as</dt>
            <dd>
              <span className="sec">
                {[person.employeeRef && `employee ${person.employeeRef}`, person.clinicianRef && `clinician ${person.clinicianRef}`]
                  .filter(Boolean)
                  .join(" · ") || "no linked record"}
              </span>
            </dd>
          </dl>

          <h3 style={{ margin: "14px 0 4px", fontSize: 13 }}>Roles</h3>
          {person.grants.map((g, i) => {
            const def = roleByKey(g.role);
            const live = s.roles.includes(def!);
            if (!def) return null;
            return (
              <div className="clause" key={`${g.role}-${i}`}>
                <h4>
                  <span>
                    {def.label}
                    <span className={`tag t-${TONE[def.platform]}`} style={{ marginLeft: 6 }}>
                      <i className="dot" />{PLATFORMS.find((x) => x.key === def.platform)!.label}
                    </span>
                  </span>
                  {live
                    ? <span className="tag t-ok"><i className="dot" />live</span>
                    : <span className="tag t-mute"><i className="dot" />not in force</span>}
                </h4>
                <p>{def.what}</p>
                <p className="sec" style={{ marginTop: 4 }}>
                  {g.facility === "ALL" ? "All facilities" : facilities.find((f) => f.id === g.facility)?.name}
                  {g.service ? `, ${g.service}` : ""} · from {d(g.from)}
                  {g.until ? ` until ${d(g.until)}` : " · no end date"} · granted by {g.grantedBy}
                </p>
                <div className="cm" style={{ marginTop: 6 }}>
                  <b>Opens:</b> {def.sees.join("; ")}.
                  <br />
                  <b>Cannot:</b> {def.cannot.join("; ")}.
                </div>
                {(() => {
                  const stop = actingIsAccessAdmin
                    ? revocationRefusals(person, everyone, actingId, today, g.role === "access-admin")
                    : ["Only an access administrator may revoke a role."];
                  return (
                    <>
                      <button
                        className="btn ghost"
                        style={{ marginTop: 8 }}
                        disabled={stop.length > 0}
                        onClick={() => onRevoke(person, i)}
                      >
                        Revoke
                      </button>
                      {stop.length > 0 && (
                        <div className="sec" style={{ marginTop: 4 }}>{stop[0]}</div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })}
          {person.grants.length === 0 && (
            <div className="empty"><b>No roles</b>This person has nothing granted to them.</div>
          )}

          <h3 style={{ margin: "14px 0 4px", fontSize: 13 }}>Grant a role</h3>
          <select className="ctl" style={{ width: "100%" }} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {PLATFORMS.map((pl) => (
              <optgroup key={pl.key} label={pl.label}>
                {rolesOn(pl.key).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </optgroup>
            ))}
          </select>

          {suspendRefusals.length > 0 && actingIsAccessAdmin && (
            <div className="note w" style={{ marginTop: 10 }}>
              <b>This person&rsquo;s access cannot be closed from here.</b>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {suspendRefusals.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}

          {refusals.length > 0 ? (
            <div className="note w" style={{ marginTop: 8 }}>
              <b>This cannot be granted.</b>
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {refusals.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          ) : (
            <div className="note" style={{ marginTop: 8 }}>
              {proposed.until
                ? `Ends on ${d(proposed.until)}, because ${person.employment.toLowerCase()} access is not open-ended.`
                : "No end date: this person is permanent."}
            </div>
          )}
        </div>

        <div className="mf">
          <button className="btn ghost" onClick={onClose}>Close</button>
          {actingIsAccessAdmin && person.status !== "Left" && (
            <button
              className="btn ghost"
              title={suspendRefusals[0]}
              disabled={person.status !== "Suspended" && suspendRefusals.length > 0}
              onClick={() => onStatus(person, person.status === "Suspended" ? "Active" : "Suspended")}
            >
              {person.status === "Suspended" ? "Lift the suspension" : "Suspend, everywhere"}
            </button>
          )}
          <button className="btn" disabled={refusals.length > 0} onClick={() => onGrant(person, proposed)}>
            Grant it
          </button>
        </div>
      </div>
    </div>
  );
}
