/**
 * The patient's own app: their stay, their care, their medicines, their
 * documents, and who opened their file.
 *
 * The last of those is the point. The staff side already has the rule that
 * every opening of a personnel file is visible to the employee; this is the
 * same rule for patients, and it reads from the same list the clinical console
 * writes to — not from a copy, which is how the two drift apart.
 */
import { useMemo, useState } from "react";
import { useClinical } from "@/clinical/state";
import { DATA_CLASSES, type Patient } from "@/clinical/data/repository";
import { dstr } from "@/data/dates";

type Tab = "stay" | "care" | "meds" | "docs" | "privacy";

const TABS: [Tab, string, string][] = [
  ["stay", "My stay", "⌂"],
  ["care", "My care", "✓"],
  ["meds", "Medicines", "◍"],
  ["docs", "Documents", "▤"],
  ["privacy", "My file", "⛨"],
];

const time = (s: string) => s.slice(11, 16);
const day = (s: string) => dstr(new Date(s.slice(0, 10) + "T12:00:00Z"));

/** Two patients to sign in as, chosen from the data rather than hard-coded. */
function storyPatients(patients: Patient[]): Patient[] {
  const inpatient = patients.find((p) => p.status === "Inpatient" && p.autonomy !== "Independent");
  const dayCase = patients.find((p) => p.status !== "Inpatient");
  return [inpatient, dayCase].filter((p): p is Patient => !!p);
}

export function PatientApp() {
  const { db } = useClinical();
  const story = useMemo(() => storyPatients(db.patients), [db.patients]);
  const [who, setWho] = useState(story[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("stay");

  const me = db.patients.find((p) => p.id === who) ?? story[0];
  if (!me) return null;

  return (
    <div className="emp-stage">
      <div className="ecap">{me.name.split(" ")[0]}&rsquo;s app</div>
      <div className="frame">
        <div className="screen">
          <div className="app">
            <div className="status">
              <span>10:14</span>
              <select className="whosel" aria-label="Switch patient" value={who} onChange={(e) => setWho(e.target.value)}>
                {story.map((p) => (
                  <option key={p.id} value={p.id}>{p.name.split(" ")[0]}, {p.status.toLowerCase()}</option>
                ))}
              </select>
            </div>
            <Screen patient={me} tab={tab} />
            <div className="tabs">
              {TABS.map(([k, l, ic]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                  <span className="ti">{ic}</span>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Screen({ patient, tab }: { patient: Patient; tab: Tab }) {
  const { db } = useClinical();
  const nameOf = (id: string) => db.clinicians.find((c) => c.id === id)?.name ?? id;
  const roleOf = (id: string) => db.clinicians.find((c) => c.id === id)?.role ?? "";
  const mine = <T extends { patient: string }>(xs: T[]) => xs.filter((x) => x.patient === patient.id);

  if (tab === "stay") {
    return (
      <>
        <div className="hd"><div className="t">
          <h1>Hello {patient.name.split(" ")[0]}</h1>
          <p>{patient.service}, room {patient.room}</p>
        </div></div>
        <div className="pc">
          <h3>Why you are here</h3>
          <p>{patient.reason}, since {dstr(new Date(patient.admitted + "T12:00:00Z"))}.</p>
        </div>
        {patient.expectedDischarge && (
          <div className="pc">
            <h3>Going home</h3>
            <p>Planned for {dstr(new Date(patient.expectedDischarge + "T12:00:00Z"))}. The team will tell you if this changes.</p>
          </div>
        )}
        <div className="pl">The people looking after you</div>
        {patient.careTeam.map((id) => (
          <div className="pc" key={id}>
            <h3>{nameOf(id)}</h3>
            <p>{roleOf(id)}</p>
          </div>
        ))}
        {patient.consent.trustedPerson && (
          <>
            <div className="pl">The person you asked us to inform</div>
            <div className="pc"><h3>{patient.consent.trustedPerson}</h3><p>Tell any member of the team if you want to change this.</p></div>
          </>
        )}
      </>
    );
  }

  if (tab === "care") {
    const tasks = mine(db.tasks);
    const obs = mine(db.observations).filter((o) => o.kind !== "Vitals").slice(0, 8);
    return (
      <>
        <div className="hd"><div className="t"><h1>My care</h1><p>What is planned today, and what was done</p></div></div>
        {tasks.map((t) => (
          <div className={`pc ${t.done ? "" : "task"}`} key={t.id}>
            <h3>{t.title}</h3>
            <p>
              {t.due} · {t.frequency}
              {t.done ? <> · <span className="pbadge">done</span></> : <> · <span className="pbadge o">to come</span></>}
            </p>
          </div>
        ))}
        {tasks.length === 0 && <div className="pc"><h3>Nothing scheduled</h3><p>No care is planned for you today.</p></div>}
        {obs.length > 0 && <div className="pl">Notes written about your care</div>}
        {obs.map((o) => (
          <div className="pc" key={o.id}>
            <h3>{o.text}</h3>
            <p>{day(o.at)} {time(o.at)} · {nameOf(o.by)}, {o.role}</p>
          </div>
        ))}
      </>
    );
  }

  if (tab === "meds") {
    const rx = mine(db.prescriptions).filter((p) => p.status === "Active");
    return (
      <>
        <div className="hd"><div className="t"><h1>My medicines</h1><p>What is prescribed, and what it is for</p></div></div>
        <div className="pc">
          <h3>Ask us anything about these</h3>
          <p>
            This list is what the doctor prescribed. The app does not advise you on your medicines and
            does not decide anything about them — the team does. Ask a nurse or the doctor if something
            here is not clear.
          </p>
        </div>
        {patient.allergies.length > 0 && (
          <div className="pc warm">
            <h3>Allergies we have recorded</h3>
            <p>{patient.allergies.join(", ")}. Tell us if this is wrong or incomplete.</p>
          </div>
        )}
        {rx.map((p) => (
          <div className="pc" key={p.id}>
            <h3>{p.drug} {p.dose}</h3>
            <p>{p.frequency}, {p.route.toLowerCase()} · for {p.indication.toLowerCase()} · started {dstr(new Date(p.started + "T12:00:00Z"))}</p>
          </div>
        ))}
        {rx.length === 0 && <div className="pc"><h3>Nothing prescribed</h3><p>You have no medicines prescribed here at the moment.</p></div>}
      </>
    );
  }

  if (tab === "docs") {
    const docs = mine(db.documents);
    return (
      <>
        <div className="hd"><div className="t"><h1>My documents</h1><p>What is filed in your record</p></div></div>
        {docs.map((x) => (
          <div className="pc" key={x.id}>
            <h3>{x.type}</h3>
            <p>{dstr(new Date(x.date + "T12:00:00Z"))} · {x.author}</p>
          </div>
        ))}
        {docs.length === 0 && <div className="pc"><h3>Nothing yet</h3><p>No document is filed in your record.</p></div>}
        <div className="pl">Your rights</div>
        <div className="pc">
          <h3>Ask for a copy of your record</h3>
          <p>You may ask for everything held about you. Ask any member of the team, or use the request below.</p>
        </div>
        <button className="pb g">Request a copy of my record</button>
        <button className="pb g">Correct something that is wrong</button>
      </>
    );
  }

  const access = db.access.filter((a) => a.patient === patient.id).slice(0, 20);
  const emergencies = access.filter((a) => a.basis === "Emergency access");
  return (
    <>
      <div className="hd"><div className="t"><h1>My file</h1><p>Everyone who opened it, and what you decide</p></div></div>
      {emergencies.length > 0 && (
        <div className="pc warm">
          <h3>{emergencies.length} emergency access{emergencies.length === 1 ? "" : "es"}</h3>
          <p>
            Someone outside your care team opened your file and gave a reason. You can ask the hospital
            to explain any of these.
          </p>
        </div>
      )}
      <div className="pl">Who opened my file</div>
      {access.map((a) => (
        <div className={`pc ${a.basis === "Emergency access" ? "warm" : ""}`} key={a.id}>
          <h3>{nameOf(a.who)}</h3>
          <p>
            {a.role} · {day(a.at)} {time(a.at)}
            <br />
            {a.basis === "Emergency access"
              ? <><span className="pbadge r">emergency access</span> {a.reason}</>
              : <>{a.reason}</>}
            {a.classes.length > 0 && (
              <>
                <br />
                Opened: {a.classes.map((c) => DATA_CLASSES.find((x) => x.key === c)!.label.toLowerCase()).join(", ")}
              </>
            )}
          </p>
        </div>
      ))}
      {access.length === 0 && <div className="pc"><h3>Nobody yet</h3><p>No one has opened your file.</p></div>}

      <div className="pl">What you have agreed to</div>
      <div className="pc">
        <h3>Sharing with the team treating you elsewhere</h3>
        <p>{patient.consent.share ? "You agreed to this." : "You have not agreed to this."} You can change it at any time.</p>
      </div>
      <div className="pc">
        <h3>Being contacted about research</h3>
        <p>{patient.consent.research ? "You agreed to be contacted." : "You have not agreed, so we will not contact you."} Refusing changes nothing about your care.</p>
      </div>
    </>
  );
}
