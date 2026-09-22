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

## An ordering alert asks a question, it never acts

The over-ordering monitor raises an alert. It cannot cancel, block, hold or
change an order, and it cannot stop a service ordering. The enforcement is
structural rather than a promise: the store exposes `updateOrderAlerts` and
deliberately no `updateOrders`, so no screen has a way to write to the ledger
at all.

An alert is closed by a person choosing a reason from a fixed list
(`ORDER_JUSTIFICATIONS`, `ORDER_ACTIONS`), never by typing one, and the
decision is appended to the journal. Same shape as the contract guardrail: the
system may select, never author.

*Enforced:* `src/state/store.tsx`, `src/console/modules/ServiceOrdering.tsx`.
*Proved:* `app.test.tsx` › "closes an alert only with a reason chosen from the
fixed list", which asserts the control is a `<select>` and not a text box.

## Over-ordering is watched at service level, never at person level

Every order record carries who requested it, because a purchase ledger has to.
The monitor never reads that field, no alert carries it, and the console never
shows it — including in the evidence list inside an alert, where it would be
most tempting. An alert names a service, an item and a facility.

This is deliberate. The same figures pointed at a named employee would be a
surveillance tool rather than a budget control, and that is not what this is.

*Enforced:* `src/data/orders.ts` (`buildOrderAlerts` reads only service, item,
facility, date, quantity and amount).
*Proved:* `orders.test.ts` › "never names a person", which asserts no employee
id appears anywhere in the serialised alerts; `app.test.tsx` › "shows the
orders counted, and never who placed them", which asserts the same of the
rendered screen.

## An alert always shows the orders it counted and what it compared them with

No alert says "this looks high". Each one carries the exact order ids it
counted, the window and baseline figures, and, per rule fired, the measured
value against the threshold it had to clear. A reader can re-add the numbers.

Thresholds exist so a small service cannot be flagged by a handful of orders: a
rule needs at least six orders in the window before it may fire at all, and the
peer rule needs at least three comparable sites.

*Enforced:* `src/data/orders.ts` (`ORDER_RULES`, `OrderRuleHit.detail`).
*Proved:* `orders.test.ts` › "counts exactly the orders it shows as evidence"
and "leaves a quiet service alone however lopsided its handful of orders".

## Ordering records what was bought, never why or for whom

Order lines hold a service, an item, a quantity and a price. Ordering
pharmacy stock or reagents is ward-level replenishment: nothing links an order
to a patient, a case or a clinical reason, and there is no field that could.

*Enforced:* `src/data/orders.ts` (`ServiceOrder`).
*Proved:* `orders.test.ts` › "records what was ordered, never why or for whom".

## No secrets or Firebase keys committed

There is no `.env` in the repository and no configuration file carrying a key.
`.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`.

Note for history: the MindMark tree contained a Firebase **Web** API key in
`firebase-applet-config.json`. It is gone from this tree but remains in git
history and on the `mindmark-final-v1.0.3` branch. Firebase Web API keys
identify a project rather than authorise access — Firestore Security Rules and
App Check are what protect the data. Confirm the current rules before treating
that key as harmless: <https://firebase.google.com/docs/projects/api-keys>.

## The served prototype is hardened, not just archived

`/prototype` serves real, executable HTML, so a flaw in it is a real flaw.
CodeQL found a DOM XSS there and it was reproduced before being fixed: a
crafted URL ran arbitrary script with no click, because `DRAWERS.coverage`
took its id from the location hash and, alone among the drawers, had no lookup
that could fail, so the raw value reached an unescaped `onclick` attribute.

Two fixes, at different layers: the coverage drawer now fails closed on an
unknown department like every other drawer, and values landing inside a JS
string literal inside an attribute go through `jsq()`, which escapes for
JavaScript before escaping for HTML. HTML escaping alone was not enough — the
browser decodes entities before the JavaScript is parsed, so a single quote
would still have broken out.

A second, separate XSS in the same file: `DRAWERS[kind]` and `PAGES[route]`
take their key from the hash, and on a plain object `DRAWERS["constructor"]`
resolves to the `Object` constructor through the prototype chain — truthy,
callable, and returning a boxed value rather than the `null` the code checks
for, so the raw hash content reached `innerHTML` directly. The URL-keyed
tables are now `Object.create(null)` and a builder is called only when it is
genuinely one of ours. The same fix corrects a plain bug: `#/constructor` used
to render `[object Object]` instead of falling back to the dashboard.

A third, found by CodeQL as `js/incomplete-sanitization`: the copilot's
suggested questions escaped the quote in `onclick="sendAsk('…')"` but not the
backslash, so a backslash in the input could neutralise the escape and free the
string literal. A second site nearby "sanitised" by deleting quotes outright,
which is not escaping and silently mangled apostrophes. Both now use `jsq()`,
which escapes the backslash first, and the labels are escaped for HTML too.

*Proved:* `src/prototype.test.ts`, which pins every one of these fixes at
source level, including that `jsq` escapes the backslash before the quote.

The prototype is also committed once, not twice. `docs/prototype/CareOps.html`
is the source and `public/prototype/index.html` is generated from it at build
time, because two copies is how a security fix reaches one and misses the
other.

## Demo content is fictional

St. Gabriel Group and everyone in it are invented. Handbook policies quoted in
the app (leave entitlements, night allowance, notice periods) are demo content,
not real rules, and nothing in this repository is legal advice.
