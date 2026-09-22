/**
 * One patient's record, under the current reader's access decision.
 *
 * A tab whose class is refused does not render an empty panel: it says who is
 * refused, why, and what to do about it. A blank screen teaches nobody
 * anything and looks like a bug.
 */
import { useMemo, useState } from "react";
import { useClinical } from "./state";
import {
  ADMIN_NOTES, DATA_CLASSES, EMERGENCY_REASONS, FORMULARY, NURSE_NOTES, REHAB_NOTES,
  canWrite, contextFor,
  type AccessDecision, type DataClass, type Patient, type PatientRecordView, type ReadContext,
} from "./data/repository";
import { dstr } from "@/data/dates";

type TabKey = "overview" | "careplan" | "medication" | "observations" | "rehab" | "documents" | "access";

const TABS: { key: TabKey; label: string; cls: DataClass | null }[] = [
  { key: "overview", label: "Overview", cls: "identity" },
  { key: "careplan", label: "Care plan", cls: "careplan" },
  { key: "medication", label: "Medication", cls: "medication" },
  { key: "observations", label: "Observations", cls: "vitals" },
  { key: "rehab", label: "Rehabilitation", cls: "rehab" },
  { key: "documents", label: "Documents", cls: "documents" },
  { key: "access", label: "Who opened this file", cls: null },
];

const time = (s: string) => s.slice(11, 16);
const day = (s: string) => dstr(new Date(s.slice(0, 10) + "T12:00:00Z"));

function Refused({ d, onEmergency }: { d: AccessDecision; onEmergency?: () => void }) {
  return (
    <div className="empty">
      <b>{d.basis === "Not on the care team" ? "You are not in this care team" : "Not part of your access"}</b>
      {d.why}
      {onEmergency && (
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={onEmergency}>Declare an emergency access</button>
        </div>
      )}
    </div>
  );
}

export function PatientRecord({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const {
    db, me, openRecord, emergencies, declareEmergency, completeTask,
    recordAdministration, addNote, prescribe, toast,
  } = useClinical();
  const [tab, setTab] = useState<TabKey>("overview");
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [reason, setReason] = useState(EMERGENCY_REASONS[0]);

  const view = openRecord(patient.id);
  const ctx = contextFor(db, me.id, patient.id, emergencies.includes(patient.id));
  const nameOf = (id: string) => db.clinicians.find((c) => c.id === id)?.name ?? id;

  const accessList = useMemo(
    () => db.access.filter((a) => a.patient === patient.id).slice(0, 14),
    [db.access, patient.id],
  );

  const startEmergency = () => setEmergencyOpen(true);
  const confirmEmergency = () => {
    declareEmergency(patient.id, reason);
    setEmergencyOpen(false);
  };

  const d = (c: DataClass) => view.decisions[c];
  const onTeam = ctx.onCareTeam || ctx.emergencyDeclared;

  return (
    <div className="modal on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox" style={{ maxWidth: 860 }}>
        <div className="mh">
          <div>
            <h2>{view.patient ? view.patient.name : "Record not open to you"}</h2>
            <div className="s">
              {patient.room}, {patient.service} ·{" "}
              {ctx.onCareTeam
                ? "you are in this care team"
                : ctx.emergencyDeclared
                  ? "emergency access, recorded"
                  : "you are not in this care team"}
            </div>
          </div>
        </div>

        <div className="mb">
          {emergencyOpen ? (
            <>
              <div className="note w">
                <b>This is recorded and it is not private.</b> The patient sees this access, your name,
                your profession and the reason you give, in their own app. Emergency access adds you to
                the care team for this read only. It does not widen what a {me.role.toLowerCase()} may see.
              </div>
              <label className="sec" htmlFor="em-reason" style={{ display: "block", marginTop: 10 }}>Reason</label>
              <select id="em-reason" className="ctl" style={{ width: "100%", marginTop: 4 }}
                value={reason} onChange={(e) => setReason(e.target.value)}>
                {EMERGENCY_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </>
          ) : (
            <>
              <div className="ptabs">
                {TABS.map((t) => {
                  const blocked = t.cls ? !d(t.cls).allowed : false;
                  return (
                    <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
                      {t.label}
                      {blocked && <span className="cnt" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>🔒</span>}
                    </button>
                  );
                })}
              </div>

              {!onTeam && tab !== "access" ? (
                <Refused d={d("identity")} onEmergency={startEmergency} />
              ) : (
                <>
                  {tab === "overview" && (
                    <>
                      <dl className="kv">
                        <dt>Born</dt><dd>{dstr(new Date(patient.born + "T12:00:00Z"))}</dd>
                        <dt>Admitted</dt><dd>{dstr(new Date(patient.admitted + "T12:00:00Z"))} · {patient.reason}</dd>
                        <dt>Expected home</dt><dd>{patient.expectedDischarge ? dstr(new Date(patient.expectedDischarge + "T12:00:00Z")) : "—"}</dd>
                        <dt>Autonomy</dt><dd>{patient.autonomy} · {patient.mobility}</dd>
                        <dt>Allergies</dt>
                        <dd>{patient.allergies.length
                          ? patient.allergies.map((a) => <span key={a} className="tag t-bad" style={{ marginRight: 4 }}><i className="dot" />{a}</span>)
                          : "None recorded"}</dd>
                        <dt>Person to inform</dt><dd>{patient.consent.trustedPerson ?? "None named"}</dd>
                        <dt>Identifier</dt><dd><span className="sec">{patient.ins}</span></dd>
                      </dl>

                      <h3 style={{ margin: "14px 0 4px", fontSize: 13 }}>Diagnoses</h3>
                      {d("diagnosis").allowed ? (
                        <>
                          {d("diagnosis").limitedReason && (
                            <div className="note" style={{ marginBottom: 8 }}>{d("diagnosis").limitedReason}</div>
                          )}
                          {view.diagnoses.map((x) => (
                            <div className="rw" key={x.id} style={{ padding: "7px 0" }}>
                              <div className="g"><b>{x.label}</b><span className="s">{x.kind}, since {dstr(new Date(x.since + "T12:00:00Z"))}</span></div>
                            </div>
                          ))}
                        </>
                      ) : <Refused d={d("diagnosis")} />}
                    </>
                  )}

                  {tab === "careplan" && (
                    d("careplan").allowed ? (
                      <>
                        <div className="sub" style={{ marginBottom: 8 }}>Today&rsquo;s care, and who did it</div>
                        {view.tasks.map((t) => (
                          <div className="rw" key={t.id} style={{ padding: "8px 0" }}>
                            <div className="g">
                              <b>{t.title}</b>
                              <span className="s">{t.kind} · {t.due} · {t.frequency} · {t.role}</span>
                            </div>
                            {t.done
                              ? <span className="tag t-ok"><i className="dot" />done by {nameOf(t.by!)}</span>
                              : canWrite(ctx, "careplan")
                                ? <button className="btn ghost" onClick={() => { if (completeTask(t.id)) toast("Recorded against your name"); }}>Mark done</button>
                                : <span className="tag t-mute"><i className="dot" />to do</span>}
                          </div>
                        ))}
                        {view.tasks.length === 0 && <div className="empty"><b>No care plan today</b>This patient has no scheduled care.</div>}
                      </>
                    ) : <Refused d={d("careplan")} />
                  )}

                  {tab === "medication" && (
                    d("medication").allowed ? (
                      <MedicationTab
                        view={view}
                        ctx={ctx}
                        nameOf={nameOf}
                        onAdminister={(rx, status, note) => {
                          if (recordAdministration(rx, status, note)) toast("Administration recorded");
                        }}
                        onPrescribe={(p) => { if (prescribe({ ...p, patient: patient.id })) toast("Prescription added to the record"); }}
                      />
                    ) : <Refused d={d("medication")} />
                  )}

                  {tab === "observations" && (
                    d("vitals").allowed ? (
                      <>
                        {view.observations.filter((o) => o.kind !== "Rehab").map((o) => (
                          <div className="rw" key={o.id} style={{ padding: "8px 0" }}>
                            <div className="g">
                              <b>
                                {o.kind === "Vitals"
                                  ? `${o.temperature}°C · ${o.pulse}/min · ${o.systolic}/${o.diastolic} · pain ${o.pain}/10`
                                  : o.text}
                              </b>
                              <span className="s">{day(o.at)} {time(o.at)} · {nameOf(o.by)}, {o.role}</span>
                            </div>
                          </div>
                        ))}
                        {canWrite(ctx, "notes") && (
                          <AddNote
                            options={NURSE_NOTES}
                            label="Add an observation"
                            onAdd={(text) => { if (addNote(patient.id, "Note", text)) toast("Observation recorded"); }}
                          />
                        )}
                      </>
                    ) : <Refused d={d("vitals")} />
                  )}

                  {tab === "rehab" && (
                    d("rehab").allowed ? (
                      <>
                        {view.observations.filter((o) => o.kind === "Rehab").map((o) => (
                          <div className="rw" key={o.id} style={{ padding: "8px 0" }}>
                            <div className="g">
                              <b>{o.text}</b>
                              <span className="s">{day(o.at)} {time(o.at)} · {nameOf(o.by)}, {o.role}{o.pain !== null && ` · pain ${o.pain}/10`}</span>
                            </div>
                          </div>
                        ))}
                        {view.observations.filter((o) => o.kind === "Rehab").length === 0 && (
                          <div className="empty"><b>No sessions yet</b>Nothing has been recorded for this patient.</div>
                        )}
                        {canWrite(ctx, "rehab") && (
                          <AddNote
                            options={REHAB_NOTES}
                            label="Record a session"
                            onAdd={(text) => { if (addNote(patient.id, "Rehab", text)) toast("Session recorded"); }}
                          />
                        )}
                      </>
                    ) : <Refused d={d("rehab")} />
                  )}

                  {tab === "documents" && (
                    d("documents").allowed ? (
                      <>
                        {d("documents").limitedReason && (
                          <div className="note" style={{ marginBottom: 8 }}>{d("documents").limitedReason}</div>
                        )}
                        {view.documents.map((x) => (
                          <div className="rw" key={x.id} style={{ padding: "8px 0" }}>
                            <div className="g"><b>{x.type}</b><span className="s">{dstr(new Date(x.date + "T12:00:00Z"))} · {x.author}</span></div>
                          </div>
                        ))}
                        {view.documents.length === 0 && <div className="empty"><b>No documents</b>Nothing is filed for this patient.</div>}
                      </>
                    ) : <Refused d={d("documents")} />
                  )}

                  {tab === "access" && (
                    <>
                      <div className="note">
                        This list belongs to the patient. They read the same thing in their own app,
                        including this visit of yours.
                      </div>
                      <div className="scrollx" style={{ marginTop: 8 }}>
                        <table>
                          <thead><tr><th>When</th><th>Who</th><th>Basis</th><th>Parts opened</th></tr></thead>
                          <tbody>
                            {accessList.map((a) => (
                              <tr key={a.id}>
                                <td>{day(a.at)}<div className="sec">{time(a.at)}</div></td>
                                <td>{nameOf(a.who)}<div className="sec">{a.role}</div></td>
                                <td>
                                  {a.basis === "Emergency access"
                                    ? <span className="tag t-bad"><i className="dot" />Emergency</span>
                                    : <span className="tag t-mute"><i className="dot" />Care team</span>}
                                  <div className="sec">{a.reason}</div>
                                </td>
                                <td><span className="sec">{a.classes.length ? a.classes.map((c) => DATA_CLASSES.find((x) => x.key === c)!.label).join(", ") : "—"}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="mf">
          {emergencyOpen ? (
            <>
              <button className="btn ghost" onClick={() => setEmergencyOpen(false)}>Cancel</button>
              <button className="btn" onClick={confirmEmergency}>Declare it and open the record</button>
            </>
          ) : (
            <button className="btn ghost" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddNote({ options, label, onAdd }: { options: string[]; label: string; onAdd: (t: string) => void }) {
  const [text, setText] = useState(options[0]);
  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <label className="sec" htmlFor="note-pick">{label}</label>
        <select id="note-pick" className="ctl" style={{ width: "100%", marginTop: 4 }}
          value={text} onChange={(e) => setText(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <button className="btn" onClick={() => onAdd(text)}>Record</button>
    </div>
  );
}

function MedicationTab({
  view, ctx, nameOf, onAdminister, onPrescribe,
}: {
  view: PatientRecordView;
  ctx: ReadContext;
  nameOf: (id: string) => string;
  onAdminister: (rx: string, status: "Given" | "Refused by patient" | "Not given", note: string | null) => void;
  onPrescribe: (p: { drug: string; form: string; dose: string; route: string; frequency: string; started: string; ends: null; indication: string }) => void;
}) {
  const [drug, setDrug] = useState(FORMULARY[0].drug);
  const entry = FORMULARY.find((f) => f.drug === drug)!;
  const [dose, setDose] = useState(entry.doses[0]);
  const [freq, setFreq] = useState(entry.frequencies[0]);
  const active = view.prescriptions.filter((p) => p.status === "Active");
  const limited = view.decisions.medication.limitedReason;

  return (
    <>
      {limited && <div className="note" style={{ marginBottom: 8 }}>{limited}</div>}
      <div className="note w" style={{ marginBottom: 10 }}>
        <b>No clinical decision support.</b> CareOps records what a prescriber decided. It does not
        suggest a drug or a dose, does not check interactions, allergies or contraindications, and
        raises no alert about the content of a prescription.
      </div>

      {active.map((p) => {
        const given = view.administrations.filter((a) => a.prescription === p.id).slice(0, 3);
        return (
          <div className="clause" key={p.id}>
            <h4>
              <span>{p.drug} {p.dose}</span>
              <span className="tag t-mute"><i className="dot" />{p.route}, {p.frequency}</span>
            </h4>
            <p>For {p.indication.toLowerCase()} · prescribed by {nameOf(p.prescriber)} on {dstr(new Date(p.started + "T12:00:00Z"))}</p>
            {given.length > 0 && (
              <div className="cm">
                {given.map((a) => (
                  <div key={a.id}>
                    {day(a.at)} {time(a.at)} — {a.status.toLowerCase()} by {nameOf(a.by)}{a.note ? ` (${a.note})` : ""}
                  </div>
                ))}
              </div>
            )}
            {canWrite(ctx, "vitals") && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="btn ghost" onClick={() => onAdminister(p.id, "Given", null)}>Record as given</button>
                <button className="btn ghost" onClick={() => onAdminister(p.id, "Refused by patient", ADMIN_NOTES[1])}>Patient declined</button>
              </div>
            )}
          </div>
        );
      })}
      {active.length === 0 && <div className="empty"><b>Nothing prescribed</b>No active prescription for this patient.</div>}

      {canWrite(ctx, "medication") && (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <b style={{ fontSize: 13 }}>Add a prescription</b>
          <div className="grid c3" style={{ gap: 8, marginTop: 8 }}>
            <div>
              <label className="sec" htmlFor="rx-drug">Drug</label>
              <select id="rx-drug" className="ctl" style={{ width: "100%" }} value={drug}
                onChange={(e) => {
                  const f = FORMULARY.find((x) => x.drug === e.target.value)!;
                  setDrug(f.drug); setDose(f.doses[0]); setFreq(f.frequencies[0]);
                }}>
                {FORMULARY.map((f) => <option key={f.drug} value={f.drug}>{f.drug}</option>)}
              </select>
            </div>
            <div>
              <label className="sec" htmlFor="rx-dose">Dose</label>
              <select id="rx-dose" className="ctl" style={{ width: "100%" }} value={dose} onChange={(e) => setDose(e.target.value)}>
                {entry.doses.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="sec" htmlFor="rx-freq">Frequency</label>
              <select id="rx-freq" className="ctl" style={{ width: "100%" }} value={freq} onChange={(e) => setFreq(e.target.value)}>
                {entry.frequencies.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => onPrescribe({
              drug: entry.drug, form: entry.form, dose, route: entry.route, frequency: freq,
              started: new Date().toISOString().slice(0, 10), ends: null, indication: entry.indications[0],
            })}
          >
            Prescribe
          </button>
          <div className="sec" style={{ marginTop: 6 }}>
            Dose and frequency are chosen from this drug&rsquo;s entry in the formulary. Nothing here is
            calculated or suggested.
          </div>
        </div>
      )}
    </>
  );
}
