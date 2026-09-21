# Rules that survive the rebuild

Each rule below says where it is enforced and what proves it. A rule with no
enforcement point is a slogan, not a rule.

## No patient data anywhere, minimal employee data

The dataset has no field that could carry clinical information. Employee
records hold what a back-office needs: role, department, contract, dates.

*Enforced:* `src/data/types.ts`.
*Proved:* `seed.test.ts` › "has no field that could carry a medical reason".

## Silence never counts as acceptance of a contract

An unread, unanswered or ignored contract stays `Sent`. There is no timer and
no path that sets `Signed` except the employee pressing sign.

*Enforced:* `src/employee/Sheets.tsx` (`sign`), `src/data/portal.ts`.
*Proved:* `seed.test.ts` › "starts the contract unsigned"; `app.test.tsx` ›
"lands on the contract after activation, unsigned".

Asking for more time changes no status at all, by design.

## A missing presence confirmation never reduces pay

Confirmation is an opportunity to report a difference. The published rota stays
the record, and there is no code path from "not confirmed" to a pay variable.

*Enforced:* `src/employee/tabs/Schedule.tsx`, `src/console/modules/EmployeePortal.tsx`.
*Shown to both sides:* stated on the phone and on the Presence tab.

## Absences are declared by type, never by medical reason

The declaration sheet offers four types and no free-text reason field.

*Enforced:* `src/employee/Sheets.tsx` (`absence`).
*Proved:* `app.test.tsx` › "declares an absence by type only, and never asks for
a reason", which asserts there is no reason input.

## Pay impacts are proposed by the system and validated by a person

A declared absence creates a payroll variable with status `Proposed`. Only an
explicit action in the console sets `Validated`, and the employee can dispute
it from the phone afterwards.

*Enforced:* `src/employee/Sheets.tsx`, `src/console/modules/EmployeePortal.tsx`.

## No non-urgent notifications between 21:00 and 07:00

Rest mode is on by default, stated in the app, and written into the contract's
right-to-disconnect clause.

*Enforced:* `src/data/portal.ts` (clause `DISC-1`), shown in Me and in the
notifications sheet.

## Every opening of a personnel file is visible to the employee

The same access list appears on the console's File access tab and on the
employee's Me tab. There is no read path that writes to one and not the other.

*Enforced:* `src/data/portal.ts` (`access`), rendered by both sides.

## AI features are labelled as AI

Every assistant-backed control carries an explicit AI badge and says what it
may and may not do.

*Enforced:* `src/employee/Sheets.tsx` (`explain`, `ask`),
`src/console/modules/EmployeePortal.tsx`.

## Contract revision may only pick clauses from the validated library

The assistant cannot author legal text. It may only select a variant that
already exists in `CLS`, only on a clause the employee commented on, and never
on pay. Everything else is discarded with a reason shown on screen.

*Enforced:* `src/ai/contractGuardrail.ts`.
*Proved:* `contractGuardrail.test.ts`, which feeds it an invented clause, a
salary change and an uncommented clause, and asserts all three are refused.

## Supplier letters have every amount checked against source data

Not yet ported — it belongs with the Procurement module. `costOf()` already
shows the shape: euro amounts are read from the clause library, never from
whatever the assistant wrote. The rule is *AI writes sentences, never numbers*.

## No secrets or Firebase keys committed

There is no `.env` in the repository and no configuration file carrying a key.
`.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`.

Note for history: the MindMark tree contained a Firebase **Web** API key in
`firebase-applet-config.json`. It is gone from this tree but remains in git
history and on the `mindmark-final-v1.0.3` branch. Firebase Web API keys
identify a project rather than authorise access — Firestore Security Rules and
App Check are what protect the data. Confirm the current rules before treating
that key as harmless: <https://firebase.google.com/docs/projects/api-keys>.

## Demo content is fictional

St. Gabriel Group and everyone in it are invented. Handbook policies quoted in
the app (leave entitlements, night allowance, notice periods) are demo content,
not real rules, and nothing in this repository is legal advice.
