# CareOps

Hospital software in two halves, kept deliberately apart:

| Workspace | Console | App |
| --- | --- | --- |
| **Back office** | Employer console — HR, finance, procurement, compliance | Employee phone |
| **Care** | Clinical record — doctors, nurses, care assistants, physiotherapists, osteopaths | Patient phone |

The two hold different kinds of data under different obligations, so they have
separate modules, separate repositories, and an import graph that forbids
either from reaching the other. See [docs/RULES.md](docs/RULES.md).

This repository replaces MindMark. The final MindMark state is preserved on the
branch [`mindmark-final-v1.0.3`](../../tree/mindmark-final-v1.0.3) and the tags
`v1.0.1`, `v1.0.2`, `v1.0.3`.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 125 tests
npm run build
```

The default build targets Vercel, where `vercel.json` rewrites unknown paths to
`index.html` so `/renewals` is a real URL. For a plain static host with no such
rule, build with `VITE_STATIC_HOST=true` and a relative base:

```bash
VITE_STATIC_HOST=true npx vite build --base=./
```

That moves routing into the URL fragment, so no deep link can 404, and makes
the links to the prototype relative so they survive being served from a
sub-path. See `src/config.ts`.

- `/` — the employer console, opening on the Employee Portal
- `/app` — the employee app, full screen (this is what a phone opens)
- `/care` — the clinical console, with the patient app beside it
- `/patient` — the patient app, full screen
- `/prototype` — the original working prototype, all seventeen modules

`public/prototype/index.html` is generated from `docs/prototype/CareOps.html`
by `npm run prototype`, which `predev` and `prebuild` run for you. The source
file is the only copy under version control.

The bar at the top switches between **Side by side**, **Employer** and
**Employee**. Below 1100px the two panes cannot sit together, so it falls back
to the phone.

## What is rebuilt, and what is not

Eighteen employer modules exist. Four are rebuilt in React:

| Rebuilt in React | Still on the prototype |
| --- | --- |
| Employee Portal | Command Center, People & HR, Finance & Budgets |
| Renewals & expiries | Procurement, Workforce Planning, Assets & Equipment |
| Service ordering | Document Intelligence, Workflow Automation, Compliance |
| Security & Audit | Intelligence Hub, Reports, AI Copilot |
| The whole employee app | Organization, Integration Hub |

Nothing is lost while that happens: the full prototype is served at
`/prototype`, and a module that is not ported yet links straight to it. The
porting order is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Tracking what each service orders

**Service ordering** is one ledger of every order placed by every service:
purchase orders, and the low-value direct requisitions below the purchase-order
threshold that nobody signs off individually. That second stream is where
over-ordering actually happens, so it is what the monitor watches.

Three rules, each able to fire on its own, each shown on screen with the
numbers behind it:

| Rule | What it compares |
| --- | --- |
| Above this service's own usual rate | The last 90 days against the same service's rate over the 9 months before |
| Above the same service at the other sites | Orders per 100 beds against the median of the same service and item elsewhere |
| Repeat orders within a few days | Six or more orders in a week, at four times this service's own pace — usually a duplicate |

An alert carries the exact order ids it counted, so the figure can be checked.
Two rules firing together, or a rate four times the usual, makes it High.

What it may not do is as fixed as what it does: it cannot cancel, block or
change an order, it never names the person who ordered, and it is closed by a
human choosing a reason from a fixed list. See [docs/RULES.md](docs/RULES.md).

## The care side

The clinical record is built around one question: *may this person see this
part of this record?* Two gates, and a read needs both.

1. **Is the reader in this patient's care team?** Nobody outside it opens a
   record; the ward list shows initials only. A reader may declare an
   emergency, choosing a reason from a fixed list — it is recorded and the
   patient sees it.
2. **Does the reader's profession cover that class of data?** A care assistant
   reads the care plan, not diagnoses or medication. A physiotherapist reads
   the prescriptions that bear on a session, not the whole list, and the screen
   says so rather than quietly showing less. Only a doctor may prescribe.

The gates are separate on purpose: **an emergency opens the first and never the
second.** It makes you a member of the team for that read; it does not make you
a doctor.

The fastest way to see this is real is the identity picker at the top of the
console — open the same patient as a doctor and then as a care assistant.

What a refused reader is not given, they never hold: screens receive a view
assembled under an access decision, so refused data is not in the page at all,
not merely hidden.

Everything the console opens is written to the patient's own file-access list,
which they read in their app. It is the same list, not a copy.

### One line the product does not cross

CareOps records a prescription a prescriber decided on. It does not suggest a
drug, calculate a dose, or check interactions, allergies or contraindications.
Software that does those things is regulated differently (EU 2017/745). The
formulary holds no interaction data at all, so there is nothing to check
against — which is a stronger guarantee than a policy.

### Before any real patient data

Everything here is fictional, and identifiers carry `DEMO-NOT-AN-INS-` so they
cannot be mistaken for real ones. Moving to real patient data needs legal
confirmation first — hosting certification, the device question, health
identity, and the permission matrix itself. What to verify, and with whom, is
listed in [docs/RULES.md](docs/RULES.md). None of it was verifiable from the
environment this was built in, and none of it is legal advice.

## The employee app

Five tabs plus onboarding, built for someone holding a phone on a ward:

- **Home** — what needs doing, next shift, quick actions, leave balance, news
- **Schedule** — the week, confirming last week, open shifts, hours, absences
- **Requests** — balances, leave, certificates, documents, each as a thread
- **Documents** — the contract to read, comment on and sign; the record
- **Me** — profile, training, renewals, who opened my file, rest mode, devices,
  data rights

Aïcha (a new hire) starts from the invitation email, an SMS check and a plain
statement of what her employer can and cannot see. Marc (a care assistant) has
a live rota, balances and a privacy log.

## Data

There is no backend. The dataset is generated in the browser from one seeded
generator, so every run produces the same 1,284 employees, 428 invoices, 1,840
assets and 965 documents. Screens never import the generator; they ask a
`CareOpsRepository` for a snapshot, which is the seam a real API plugs into.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Rules that survive the rebuild

These are enforced in code and covered by tests, not just described in the
interface. They are in [docs/RULES.md](docs/RULES.md).

- No patient data anywhere. Minimal employee data.
- Silence never counts as acceptance of a contract.
- A missing presence confirmation never reduces pay.
- Absences are declared by type, never by medical reason.
- Pay impacts are proposed by the system and validated by a person.
- No non-urgent notifications between 21:00 and 07:00.
- Every opening of a personnel file is visible to the employee.
- AI features are labelled as AI, and the contract assistant may only select
  clauses from a validated library — never pay, never invented wording.
- An over-ordering alert asks a question. It never cancels, blocks or changes
  an order, and it names a service and an item, never a person.
- The back office holds no patient data and cannot reach any; the import graph
  enforces it.
- Two gates guard every patient record, and declaring an emergency opens only
  one of them.
- Every opening of a patient record is visible to the patient.
- CareOps records a prescription; it never advises on one.
- No secrets or Firebase keys committed.

## Demo data is fictional

St. Gabriel Group, its four facilities, every employee, supplier, invoice and
asset are invented. The staff handbook policies (leave days, night allowance
and so on) are demo content, not real rules, and nothing here is legal advice.
