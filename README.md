# CareOps

Non-clinical back-office for hospitals. Two sides, one dataset:

- an **employer console** for HR, finance, procurement and compliance, and
- an **employee app** the staff actually use, on their phone.

This repository replaces MindMark. The final MindMark state is preserved on the
branch [`mindmark-final-v1.0.3`](../../tree/mindmark-final-v1.0.3) and the tags
`v1.0.1`, `v1.0.2`, `v1.0.3`.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 50 tests
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
- `/prototype` — the original working prototype, all seventeen modules

`public/prototype/index.html` is generated from `docs/prototype/CareOps.html`
by `npm run prototype`, which `predev` and `prebuild` run for you. The source
file is the only copy under version control.

The bar at the top switches between **Side by side**, **Employer** and
**Employee**. Below 1100px the two panes cannot sit together, so it falls back
to the phone.

## What is rebuilt, and what is not

Seventeen employer modules exist. Three are rebuilt in React, chosen because
they are the ones that exchange data with the employee app:

| Rebuilt in React | Still on the prototype |
| --- | --- |
| Employee Portal | Command Center, People & HR, Finance & Budgets |
| Renewals & expiries | Procurement, Workforce Planning, Assets & Equipment |
| Security & Audit | Document Intelligence, Workflow Automation, Compliance |
| The whole employee app | Intelligence Hub, Reports, AI Copilot |
| | Organization, Integration Hub |

Nothing is lost while that happens: the full prototype is served at
`/prototype`, and a module that is not ported yet links straight to it. The
porting order is in [docs/ROADMAP.md](docs/ROADMAP.md).

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
- No secrets or Firebase keys committed.

## Demo data is fictional

St. Gabriel Group, its four facilities, every employee, supplier, invoice and
asset are invented. The staff handbook policies (leave days, night allowance
and so on) are demo content, not real rules, and nothing here is legal advice.
