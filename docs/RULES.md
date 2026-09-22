# Rules that survive the rebuild

Each rule below says where it is enforced and what proves it. A rule with no
enforcement point is a slogan, not a rule.

## The back office holds no patient data, and cannot reach any

The back-office dataset has no field that could carry clinical information, and
employee records hold what a back office needs: role, department, contract,
dates.

CareOps now also has a care side, which does hold (fictional) patient records.
That does not relax this rule, it hardens it: the two live in separate modules
with separate repositories, and the import graph forbids either from reaching
the other. `src/App.tsx` is the one file allowed to see both.

The care side may use shared *helpers* — date and number formatting, and the
list of sites, which is organisational rather than personal. Nothing else.

*Enforced:* `src/data/types.ts`, and the module boundary itself.
*Proved:* `seed.test.ts` › "has no field that could carry a medical reason";
`separation.test.ts`, which reads every source file and fails on any import
crossing the wall in either direction.

## One person, one directory entry, across all three platforms

The same human being is an employee in the back office, a clinician on the care
side and a phone user in the staff app. Without something joining them, a
suspension in HR would leave their access to patient records untouched — which
is the failure this layer exists to prevent.

`src/directory` holds one entry per person: who they are, where they work, what
kind of contract they are on, and what has been granted to them. It holds **no
pay and nothing clinical**, which is what earns it the right to see both sides.

It asks for no more than it needs, either: the provider reads the clinician
roster through `loadClinicians()` rather than the whole clinical snapshot.
In the browser that is a matter of what stays resident; behind an HTTP
repository it is the difference between a roster request and an HR user's
browser fetching the patient record set.

*Enforced:* `src/directory/build.ts` takes narrow records, not `Employee` and
`Clinician`, so there is no salary field to read and no patient in scope;
`ClinicalRepository.loadClinicians()` cannot return one.
*Proved:* `directory.test.ts` › "carries no pay and nothing clinical", which
checks the output rather than the imports; `separation.test.ts` › "and App are
the only two places that touch both".

## A role on one platform grants nothing on another

Being head of HR does not open a patient record. Being a doctor does not open a
payslip. There is no rank that crosses the line, because the line is not about
rank — the group operations director cannot open a patient record either, and
the screen says so.

Every role in the catalogue carries both what it opens and what it cannot, and
both are shown on screen next to the person holding it.

*Enforced:* `src/directory/roles.ts` (`mayOpenPatientRecord`, which returns
true only for a live care role).
*Proved:* `directory.test.ts` › "lets no administrative role open a patient
record", checked for every administrative role against every holder.

## Whoever administers access never reads content

The access administrator grants and revokes roles and can answer who holds
what. They cannot open a patient record, a personnel file or a pay figure.
Separating the two is the point: the person who can give themselves a
permission must not be the person that permission is worth having for.

Nobody else may grant anything, and the refusal is shown rather than the button
hidden — a hidden control teaches nobody why.

*Enforced:* `src/directory/roles.ts` (`grantRefusals`).
*Proved:* `access.test.tsx` › "refuses to let the operations director grant a
role, and says why".

## Access that is not permanent carries an end date

Agency, bank and external grants expire with the assignment rather than
outliving it. A grant without an end date is refused for anyone not permanent,
and an expired grant stops counting the day it ends.

*Enforced:* `src/directory/roles.ts` (`needsEndDate`, `liveGrants`).
*Proved:* `directory.test.ts` › rule 3, including on a hand-built entry so it
does not depend on the generator producing one.

## Suspending someone closes every platform at once

One entry, one status. Recording that a person is suspended or has left removes
every live grant on all three platforms in the same moment. The grants stay on
the record afterwards, because an audit needs to see what someone held.

*Enforced:* `src/directory/roles.ts` (`liveGrants` returns nothing for a
suspended or departed person).
*Proved:* `directory.test.ts` › rule 4; reproduced in a browser: suspending a
doctor who held Care and Staff app left "Platforms today: None".

## Nobody may change their own access, and the last administrator stays

Neither granting nor revoking. An administrator who can grant to themselves is
one click from every permission the role exists not to have — the access
administrator could hand themselves a care role and read patient records,
contradicting their own role definition, which says in as many words that they
may not. And an establishment with no access administrator left has no way
back, including no way to undo the click that caused it.

Both halves were found by trying them. Suspending the access administrator
while acting as them removed the only person who could reverse it and took the
screen down; and `grantRefusals` had no self-check at all while
`revocationRefusals` did.

`actingId` is a required argument of `grantRefusals` rather than an optional
one, so a future caller cannot omit it and silently reopen the hole.

*Enforced:* `src/directory/roles.ts` (`grantRefusals`, `revocationRefusals`).
*Proved:* `directory.test.ts` › "stops an administrator granting a role to
themselves", which also checks every role in the catalogue, not only the
dangerous-looking ones.

## Two gates guard every patient record, and an emergency opens only one

A read needs both: the reader is in the patient's care team, **and** their
profession covers that class of data. They are deliberately separate, because
declaring an emergency opens the first gate and never the second — it makes
you a member of the team for that read, it does not make you a doctor.

An emergency is recorded with the reason chosen from a fixed list, and appears
in the patient's own app.

An emergency belongs to the clinician who declared it, not to the patient it
was declared on. Keyed by patient alone, one person's declaration opened the
record for whoever signed in next — no declaration, no warning, and no entry in
the patient's access list, since nothing is logged until a record is read. A
shared ward workstation with user switching is exactly the shape of that
mistake, so the state is keyed by clinician and patient together.

*Enforced:* `src/clinical/data/access.ts` (`canRead`), `src/clinical/state.tsx`
(`hasEmergency`).
*Proved:* `access.test.ts` › "never opens the profession gate as well", which
checks every profession against every class of the record; `care.test.tsx` ›
"does not carry one clinician's emergency over to the next one signed in".

## A reader never holds what they may not see

Screens do not fetch a record and then hide parts of it. They receive a view
assembled under an access decision, so what is refused is not in the object the
screen holds — and therefore not in the page for anyone who opens the developer
tools.

Every tab obeys the gate, the file-access list included. Exempting that one tab
leaked who treats whom — clinician-patient association is health data in itself
— and because an outsider's view reads nothing, the browsing was never written
to the very list it was displaying.

The screens read the redacted view rather than the record they were handed, so
a profession that is one day given `identity: "none"` cannot be shown identity
data the view had already removed.

*Enforced:* `src/clinical/data/record.ts` (`buildRecordView`),
`src/clinical/PatientRecord.tsx`.
*Proved:* `access.test.ts` › "hands an outsider a view with no record in it at
all", which asserts the patient's name is absent from the serialised view;
`care.test.tsx` › "refuses the file-access list to someone outside the care
team"; `separation.test.ts` › "renders the redacted patient, not the one the
component was handed". Reproduced in a browser against the built application.

## Access is by scope of practice, and the limits are stated, not hidden

A care assistant does not read diagnoses or medication. A physiotherapist reads
only the prescriptions that bear on a session, only the diagnoses the referral
rests on, and not the nursing note stream. Where a grant is partial the screen
says what the limit is instead of quietly showing less.

Only a doctor may prescribe or record a diagnosis.

The matrix in `PERMISSIONS` is **a starting configuration for a demo, not a
legal standard**. Every establishment has to validate it against each
profession's actual scope of practice, with its DPO and its medical board. It
is written as data, in one place, so a validated matrix replaces it without
touching a screen.

*Enforced:* `src/clinical/data/access.ts` (`PERMISSIONS`).
*Proved:* `access.test.ts`; `care.test.tsx` › "shows a different record to a
care assistant than to a doctor".

## Every opening of a patient record is visible to the patient

The clinical console writes to the file-access list as part of the same call
that reads the record — logging is not a side effect a screen can forget. The
patient app reads that same list, not a copy.

*Enforced:* `src/clinical/state.tsx` (`openRecord`), `src/patient/PatientApp.tsx`.
*Proved:* `care.test.tsx` › "shows the patient their own file-access list";
verified end to end in a browser: an emergency declared in the console appears
in the patient's app without a reload.

## CareOps records a prescription, it does not advise on one

It does not suggest a drug, calculate or adjust a dose, check interactions,
allergies or contraindications, or raise any alert about the clinical content
of a prescription. Software that does those things is doing a different job and
is regulated as such (EU 2017/745). This is a product decision, stated on the
screen where a prescription is written.

The strongest form of the guarantee is not a policy but an absence: the
formulary holds no interaction or contraindication data, so there is nothing to
check against. Doses and frequencies are chosen from the entry for that drug;
none is computed.

Allergies are recorded because a human needs to read them. Nothing compares a
prescription against them.

*Enforced:* `src/clinical/data/formulary.ts`, `src/clinical/PatientRecord.tsx`.
*Proved:* `clinical.test.ts` › "no clinical decision support", which pins the
shape of every formulary entry and checks every generated prescription against
the lists it came from.

## Fictional patients, and identifiers that cannot be mistaken for real ones

Every patient, clinician and record on the care side is invented. Every
identifier standing in for a national health identifier carries the prefix
`DEMO-NOT-AN-INS-`, so a demo record cannot be loaded anywhere expecting a real
one, and professional registration numbers carry `DEMO-REG-`.

*Enforced:* `src/clinical/data/formulary.ts` (`DEMO_INS_PREFIX`).
*Proved:* `clinical.test.ts` › "marks every identifier so it cannot be taken
for a real one".

## What has to be verified before any real patient data exists

Nothing in this repository has been checked by a lawyer, and the following is
what to confirm rather than what is confirmed. It is recorded here because the
code was written around it.

- **Health data is Article 9 GDPR** — special category, needing its own legal
  basis, separate from the one covering staff data.
- **Hosting.** France requires health data to be held by an HDS-certified host
  (*hébergeur de données de santé*). The current deployment target, Vercel, is
  not certified for this as far as is known here, which is why the care side has
  its own repository seam: it has to be able to move without a screen changing.
- **Medical device classification.** Prescription software can fall under EU
  MDR 2017/745 depending on what it does. The rule above is what keeps this
  product on one side of that line, and it needs confirming by counsel before
  anything changes.
- **Identity.** A national health identifier (INS in France) is required for
  referencing health data, with its own rules on how it is obtained and used.
- **Professional secrecy** and access restricted to the care team, which is
  what the two gates implement — but the matrix itself needs validating.
- **Interoperability** requirements (Ségur, CI-SIS) shape whether an
  establishment can buy the product at all.

Sources to confirm with: the **CNIL**, the **ANS** (Agence du Numérique en
Santé) for hosting and identity, and counsel for the device question. None of
these was verifiable from the environment this was built in, and none should be
taken on the word of this file.

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
