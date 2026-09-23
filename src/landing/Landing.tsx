/**
 * The front door.
 *
 * Every other screen in CareOps is a workspace you are already inside: the
 * console opens on a module, the phone opens on a screen. Someone arriving at
 * the deployed demo was redirected straight into the employer console, with no
 * way to learn that there were three platforms at all — so this page exists to
 * show the whole shape at once, and to say for each part what it may *not* do.
 * The refusals are the product; a landing page that listed only features would
 * be describing a different one.
 *
 * It deliberately imports no repository, no store and no dataset, and
 * `separation.test.ts` pins that. Two reasons, and the second is the real one:
 * the front door should paint before either side's data is generated, and a
 * landing page that pulled the clinical snapshot would put patient records in
 * the very first thing a stranger loads.
 */
import { Link } from "react-router-dom";
import { PROTOTYPE_URL } from "@/config";

/** The rules this demo is built to, with the test that proves each one. */
const RULES_URL = "https://github.com/rdzoagbe/CareOps/blob/main/docs/RULES.md";

interface Entry {
  to: string;
  label: string;
  primary?: boolean;
}

interface Platform {
  key: string;
  eyebrow: string;
  title: string;
  who: string;
  seesLabel: string;
  sees: string[];
  neverLabel: string;
  never: string[];
  entries: Entry[];
}

const PLATFORMS: Platform[] = [
  {
    key: "admin",
    eyebrow: "Platform one",
    title: "Administration",
    who: "The staff who run the group — HR, payroll, finance, procurement, compliance, direction.",
    seesLabel: "Opens",
    sees: [
      "Personnel files, contracts and renewals",
      "Budgets, invoices and the three-way match",
      "What each service orders, and an alert when a service orders far more than it usually does",
      "The audit journal: who opened which file, and when",
    ],
    neverLabel: "Never opens",
    never: [
      "A patient record",
      "A diagnosis or a clinical note",
      "The medical reason for an absence",
    ],
    entries: [
      { to: "/portal", label: "Open the back office", primary: true },
      { to: "/app", label: "Open the staff app" },
    ],
  },
  {
    key: "care",
    eyebrow: "Platform two",
    title: "Care",
    who: "The staff who treat patients — doctors, nurses, care assistants, physiotherapists, osteopaths.",
    seesLabel: "Opens",
    sees: [
      "The record of the patients in their own care team",
      "Prescriptions, observations and the care plan",
      "Rehabilitation sessions, on referral",
      "What the profession needs and no more: a physiotherapist sees the prescriptions bearing on a session, not the whole list",
    ],
    neverLabel: "Never opens",
    never: [
      "A record outside the care team, unless an emergency is declared — and the patient is shown it",
      "Pay, contracts or personnel files",
      "The nursing note stream, for the rehabilitation professions",
    ],
    entries: [{ to: "/care", label: "Open the clinical record", primary: true }],
  },
  {
    key: "patient",
    eyebrow: "Platform three",
    title: "The patient",
    who: "The person being treated, on their own phone.",
    seesLabel: "Shows them",
    sees: [
      "Their stay, their treatment and their documents",
      "Every opening of their file: who, when, and on what basis",
      "An emergency access, from the moment it is declared",
    ],
    neverLabel: "Never",
    never: [
      "A reading of their record that they are not shown",
      "An emergency access that leaves no trace",
      "Anything at all about another patient",
    ],
    entries: [{ to: "/patient", label: "Open the patient's side", primary: true }],
  },
];

/** The four rules that hold the three platforms apart. */
const DIRECTORY_RULES = [
  "A role on one platform grants nothing on another",
  "Whoever administers access never reads content",
  "Access that is not permanent carries an end date",
  "Leaving or being suspended closes every platform at once",
];

const NOTICES = [
  {
    title: "Synthetic data only",
    body:
      "St. Gabriel Group is a fictional organisation. No real employee or personal data is present " +
      "anywhere in this demo.",
  },
  {
    title: "Fictional patients",
    body:
      "Every patient, clinician and record on the care side is invented. Identifiers standing in for " +
      "a national health identifier carry the prefix DEMO-NOT-AN-INS-, so a demo record cannot be " +
      "loaded anywhere expecting a real one.",
  },
  {
    title: "No clinical decision support",
    body:
      "CareOps records what a prescriber decided. It suggests no drug, calculates no dose and checks " +
      "no interaction or contraindication. The formulary holds no interaction data at all, so there " +
      "is nothing to check against.",
  },
  {
    title: "A demonstration, not software in service",
    body:
      "Nothing here is medical or legal advice, and the handbook policies quoted in the staff app are " +
      "demo content rather than real rules.",
  },
];

export function Landing() {
  return (
    <div className="lp">
      {/* The same bar the workspaces carry, so arriving and entering feel like
          one product. body has padding-top: var(--vb) for it already. */}
      <div className="viewbar">
        <div>
          <b>CareOps</b> <span className="vsub">Hospital operations, as three platforms</span>
        </div>
        <a className="vbtn" style={{ marginLeft: "auto" }} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
          Prototype
        </a>
      </div>

      <header className="lp-hero">
        <span className="lp-pill">Demo · synthetic data</span>
        <h1>One group, three platforms.</h1>
        <p className="lp-lead">
          A hospital group is not one kind of work. The people who run it, the people who treat
          patients, and the patients themselves need different things — and are owed different
          things. CareOps builds them as three platforms that share a directory and nothing else.
        </p>
        <p className="lp-lead lp-lead-2">
          Each card below says what its platform opens <em>and</em> what it cannot open. The second
          list is the one that matters: administration and care hold data under different legal
          obligations, so the import graph itself forbids either from reaching the other.
        </p>
      </header>

      <main className="lp-grid" aria-label="The three platforms">
        {PLATFORMS.map((p) => (
          <section className="lp-card" key={p.key} aria-labelledby={`lp-${p.key}`}>
            <div className="lp-eyebrow">{p.eyebrow}</div>
            <h2 id={`lp-${p.key}`}>{p.title}</h2>
            <p className="lp-who">{p.who}</p>

            <div className="lp-list">
              <h3>{p.seesLabel}</h3>
              <ul>{p.sees.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>

            <div className="lp-list lp-never">
              <h3>{p.neverLabel}</h3>
              <ul>{p.never.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>

            <div className="lp-actions">
              {p.entries.map((e) => (
                <Link key={e.to} to={e.to} className={e.primary ? "lp-go" : "lp-go lp-go-2"}>
                  {e.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>

      <section className="lp-join" aria-labelledby="lp-join-h">
        <div>
          <div className="lp-eyebrow">What joins them</div>
          <h2 id="lp-join-h">One person, not three accounts</h2>
          <p className="lp-lead">
            The same nurse is an employee, a clinician and a phone user. The directory is the one
            place that knows they are a single human being — which is why a suspension in HR closes
            the patient record too. It holds no pay and nothing clinical, and that is what earns it
            the right to see both sides.
          </p>
          <Link to="/access" className="lp-go">See who can open what</Link>
        </div>
        <ul className="lp-rules">
          {DIRECTORY_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>

      <section className="lp-notices" aria-labelledby="lp-notices-h">
        <h2 id="lp-notices-h">Before you look around</h2>
        <div className="lp-notice-grid">
          {NOTICES.map((n) => (
            <div className="lp-notice" key={n.title}>
              <b>{n.title}</b>
              <p>{n.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="lp-foot">
        <p>
          Every rule on this page is enforced at a named place in the code and proved by a named
          test. Both are listed in{" "}
          <a href={RULES_URL} target="_blank" rel="noreferrer">docs/RULES.md</a>.
        </p>
        <p>
          The original working prototype, with all seventeen modules, is{" "}
          <a href={PROTOTYPE_URL} target="_blank" rel="noreferrer">still here</a>.
        </p>
      </footer>
    </div>
  );
}
