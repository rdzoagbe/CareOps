# Roadmap

## Phase 1 — this repository

Done:

- Vite + React + TypeScript, React Router, one route per module
- The seeded dataset behind a repository interface, in `src/data`
- The employee app in full: onboarding plus five tabs
- Employee Portal, Renewals & expiries, Service ordering and Security & Audit
  rebuilt
- The order ledger and the over-ordering monitor, with their rules enforced
  and tested
- The contract guardrail, enforced and tested
- The full prototype served at `/prototype`, so nothing is undemoable
- The care side: clinical record, access rules, patient app
- The directory: one person across three platforms, and who may open what
- 161 tests, and CI running typecheck, tests and build

Remaining, in the order they should be ported. Each is a self-contained pull
request: move the module's screen into `src/console/modules`, read from the
repository, add tests, flip `ported: true` in `src/console/nav.ts`.

1. **People & HR** — the largest shared surface with the portal
2. **Workforce Planning** — coverage and agency use, needed by absences
3. **Command Center** — depends on the modules above for its figures
4. **Finance & Budgets** — charts and the period filter
5. **Procurement** — invoice exceptions and the three-way match, next to the
   order ledger that Service ordering already reads
6. **Assets & Equipment**
7. **Document Intelligence**
8. **Workflow Automation**
9. **Compliance**
10. **Intelligence Hub**, **Reports**, **AI Copilot**
11. **Organization**, **Integration Hub**

Delete `public/prototype/` only once the list is empty, and keep
`docs/prototype/CareOps.html` for ever as the reference the rebuild was made
from.

## The care side, next

- Handover between shifts, and a ward round view
- The care team as something a person is added to and removed from, with that
  change itself recorded
- Discharge: the summary, and what the patient leaves with
- A validated permission matrix per establishment, replacing the demo one

None of it stores real patient data. That step is gated on the legal work in
docs/RULES.md, not on the code.

## Phase 2 — a real backend

- Postgres in the EU, row-level security per customer
- The care side hosted separately, on a host certified for health data, behind
  its own `ClinicalRepository` implementation
- Sign-in through Entra ID
- Append-only audit log in the database, not only in memory
- An HTTP implementation of `CareOpsRepository`
- The contract assistant connected to a model server-side, with the existing
  guardrail unchanged in front of it, and the request never leaving the EU

## Deployment

Preview deployments on Vercel (`vercel.json` is in the repository root). GitHub
Pages is not used: the MindMark Pages site did not follow the repository rename,
which is documented behaviour.
