/**
 * The clinical console: the ward list, and the record of whoever is selected.
 *
 * The identity picker at the top is not a developer convenience. Switching
 * from a doctor to a care assistant on the same patient is the fastest way to
 * see that the access rules are real, so it is a first-class control.
 */
import { useMemo, useState } from "react";
import { useClinical } from "./state";
import { PatientRecord } from "./PatientRecord";
import {
  CARE_ROLES, CARE_SERVICES, DATA_CLASSES, PERMISSIONS, maskName,
  type CareRole, type Patient,
} from "./data/repository";
import { FACILITIES } from "@/data/constants";
import { dstr } from "@/data/dates";

const ALL = "ALL";

const ageOf = (born: string): number => {
  const b = new Date(born + "T12:00:00Z");
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) a -= 1;
  return a;
};

export function CareConsole() {
  const { db, me, setMe, emergencies, toastMessage } = useClinical();
  const [service, setService] = useState<string>(me.service);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(true);

  const colleagues = useMemo(
    () => db.clinicians.filter((c) => c.facility === me.facility && c.service === me.service),
    [db.clinicians, me.facility, me.service],
  );

  const ward = useMemo(() => {
    const inWard = db.patients.filter(
      (p) => p.facility === me.facility && (service === ALL || p.service === service),
    );
    const mine = (p: Patient) => p.careTeam.includes(me.id);
    return [...inWard].sort(
      (a, b) => Number(mine(b)) - Number(mine(a)) || a.room.localeCompare(b.room),
    );
  }, [db.patients, me.facility, me.id, service]);

  const visible = mineOnly ? ward.filter((p) => p.careTeam.includes(me.id)) : ward;
  const current = openId ? db.patients.find((p) => p.id === openId) ?? null : null;
  const myClasses = DATA_CLASSES.filter((c) => PERMISSIONS[me.role][c.key] !== "none");

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="mark">C</div>
          <div><b>CareOps Soin</b><small>Clinical record</small></div>
        </div>

        <div className="orgbox">
          <label htmlFor="whoPro">Signed in as</label>
          <select id="whoPro" value={me.id} onChange={(e) => { setMe(e.target.value); setOpenId(null); }}>
            {CARE_ROLES.map((role) => (
              <optgroup key={role} label={role}>
                {db.clinicians
                  .filter((c) => c.facility === me.facility && c.service === me.service && c.role === role)
                  .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="orgbox">
          <label htmlFor="svc">Service</label>
          <select id="svc" value={service} onChange={(e) => { setService(e.target.value); setOpenId(null); }}>
            <option value={ALL}>All services</option>
            {CARE_SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="navsec">What a {me.role.toLowerCase()} may open</div>
        <div style={{ padding: "0 10px 10px", fontSize: 11, lineHeight: 1.7, color: "#6f8aa6" }}>
          {DATA_CLASSES.map((c) => {
            const g = PERMISSIONS[me.role][c.key];
            return (
              <div key={c.key} style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 10, opacity: g === "none" ? 0.45 : 1 }}>
                  {g === "none" ? "—" : g === "write" ? "✎" : g === "limited" ? "◐" : "●"}
                </span>
                <span style={{ opacity: g === "none" ? 0.45 : 1 }}>
                  {c.label}
                  {g === "limited" && <span style={{ opacity: 0.8 }}> (partial)</span>}
                </span>
              </div>
            );
          })}
          <div style={{ marginTop: 8 }}>
            {myClasses.length} of {DATA_CLASSES.length} parts of the record. Being in the care team is
            checked separately, on every patient.
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <div className="searchwrap">
            <span className="mag">⌕</span>
            <input type="search" placeholder="Search a patient by name or room…" aria-label="Search patients" />
          </div>
          <div className="topsel">
            <div className="who">
              <div className="ava">{me.name.replace("Dr ", "").split(" ").map((p) => p[0]).join("")}</div>
              <div>
                <b style={{ fontSize: 12.5 }}>{me.name}</b>
                <small>{me.role}, {me.service}, {FACILITIES.find((f) => f.id === me.facility)?.city}</small>
              </div>
            </div>
          </div>
        </header>

        <div className="demobar">
          <span className="tag t-ai"><i className="dot" />Demo</span>
          <span>
            <b>Fictional patients.</b> Every patient, clinician and record here is invented, and the
            identifiers are not health identifiers. CareOps records a prescription; it gives no dosage
            advice, no interaction checking and no clinical decision support.
          </span>
        </div>

        <main className="page">
          <div className="phead">
            <div>
              <h1>{service === ALL ? "All services" : service}</h1>
              <p>
                {visible.length} patient{visible.length === 1 ? "" : "s"} ·{" "}
                {ward.filter((p) => p.careTeam.includes(me.id)).length} in your care team ·{" "}
                {FACILITIES.find((f) => f.id === me.facility)?.name}
              </p>
            </div>
            <div className="acts">
              <button className="btn ghost" onClick={() => setMineOnly((v) => !v)}>
                {mineOnly ? "Show the whole ward" : "Only my patients"}
              </button>
            </div>
          </div>

          <div className="grid c32">
            <section className="card">
              <div className="ch">
                <div>
                  <h3>Ward list</h3>
                  <div className="sub">
                    A patient you are not caring for shows initials only, until you are added to the team
                  </div>
                </div>
              </div>
              <div className="scrollx">
                <table>
                  <thead>
                    <tr><th>Room</th><th>Patient</th><th>Admitted for</th><th>Care</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => {
                      const mine = p.careTeam.includes(me.id);
                      const emergency = emergencies.includes(p.id);
                      return (
                        <tr key={p.id} onClick={() => setOpenId(p.id)}>
                          <td><b style={{ fontWeight: 500 }}>{p.room}</b><div className="sec">{p.service}</div></td>
                          <td>
                            <b style={{ fontWeight: 500 }}>{mine || emergency ? p.name : maskName(p.name)}</b>
                            <div className="sec">
                              {mine || emergency ? `${ageOf(p.born)} years` : "not in your care team"}
                            </div>
                          </td>
                          <td>{mine || emergency ? p.reason : <span className="sec">—</span>}
                            <div className="sec">since {dstr(new Date(p.admitted + "T12:00:00Z"))}</div>
                          </td>
                          <td>
                            {mine
                              ? <span className="tag t-ok"><i className="dot" />Your patient</span>
                              : emergency
                                ? <span className="tag t-bad"><i className="dot" />Emergency access</span>
                                : <span className="tag t-mute"><i className="dot" />Another team</span>}
                          </td>
                          <td><span className="sec">{p.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visible.length === 0 && (
                  <div className="empty">
                    <b>No patients here</b>
                    Try another service, or show the whole ward.
                  </div>
                )}
              </div>
            </section>

            <div className="grid" style={{ gap: 12, alignContent: "start" }}>
              <section className="card">
                <div className="ch"><div><h3>Your team</h3><div className="sub">{me.service}, {FACILITIES.find((f) => f.id === me.facility)?.city}</div></div></div>
                <div className="cb">
                  {CARE_ROLES.map((role) => {
                    const n = colleagues.filter((c) => c.role === role).length;
                    if (!n) return null;
                    return (
                      <div key={role} style={{ display: "flex", fontSize: 12.5, padding: "3px 0" }}>
                        <span>{role}</span><b style={{ marginLeft: "auto", fontWeight: 600 }}>{n}</b>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="note w">
                <b>Two gates, and a read needs both.</b> Being in the patient&rsquo;s care team, and your
                profession covering that part of the record. Declaring an emergency opens the first gate
                only — it never turns a {me.role.toLowerCase()} into a doctor.
              </div>

              <div className="note">
                Every record you open is written to that patient&rsquo;s own file-access list, which they
                read in their app. Nothing you open is invisible to them.
              </div>
            </div>
          </div>

          {current && <PatientRecord patient={current} onClose={() => setOpenId(null)} />}
        </main>
        {toastMessage && <div className="toast" role="status">{toastMessage}</div>}
      </div>
    </div>
  );
}

export const roleInitial = (r: CareRole): string => r[0];
