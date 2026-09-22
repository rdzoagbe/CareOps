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
- 82 tests, and CI running typecheck, tests and build

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

## Phase 2 — a real backend

- Postgres in the EU, row-level security per customer
- Sign-in through Entra ID
- Append-only audit log in the database, not only in memory
- An HTTP implementation of `CareOpsRepository`
- The contract assistant connected to a model server-side, with the existing
  guardrail unchanged in front of it, and the request never leaving the EU

## Deployment

Preview deployments on Vercel (`vercel.json` is in the repository root). GitHub
Pages is not used: the MindMark Pages site did not follow the repository rename,
which is documented behaviour.
