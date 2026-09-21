# Architecture

## The shape

```
src/
  data/        the dataset, its types, and the repository seam
  ai/          the contract-revision guardrail
  state/       demo state shared by both sides, plus the journal
  console/     the employer console: shell, nav, modules
  employee/    the employee app: shell, onboarding, five tabs, sheets
  styles/      tokens.css (ported verbatim) and app.css (layout glue)
```

## The repository seam

Screens never import `seed.ts`. They read a snapshot obtained from a
`CareOpsRepository`:

```ts
export interface CareOpsRepository {
  load(): Promise<Snapshot>;   // { db, portal, renewals }
}
```

`InMemoryRepository` generates the data in the browser. Phase 2 adds an
HTTP-backed implementation against Postgres in the EU and changes one line in
`main.tsx`. No screen changes, because no screen knows where data comes from.

The load is asynchronous on purpose, even though the in-memory build is
instant: a screen that already handles "not loaded yet" does not have to be
rewritten when loading becomes a network call.

## Determinism

The whole dataset comes from one linear congruential generator seeded with
`20260920`. **The order of calls to it is part of the data contract.** Reordering
two lines in `seed.ts` silently changes every headline figure, which is why the
generator is a direct port of the prototype's, including the places where it
relies on short-circuit evaluation. The counts and reconciliation totals are
pinned by tests.

The renewals register uses its own generator (seed `424242`) so it stays stable
independently of the main dataset.

Dates are built at UTC midday rather than local midnight, so `iso()` and locale
formatting agree on the calendar day in every timezone. The prototype used local
midnight, which drifted by a day west of Greenwich.

## Demo state

`src/state/store.tsx` holds what a user changes: the portal state, the renewals
register, and an append-only journal. Updates go through `updatePortal` and
`updateRenewals`, which clone before mutating, so React sees a new object and
nothing is edited in place behind its back.

The journal is append-only by construction — entries are unshifted onto a list
and there is no update or delete path. That is the property the audit story
depends on.

## The two panes

The prototype toggled panes with classes on `<body>`. The React build does the
same with a class on the stage element (`.stage.v-split`, `.v-admin`, `.v-emp`),
which is why `app.css` exists alongside the ported `tokens.css`. Design tokens
were not touched.

## AI, honestly

`src/ai/contractGuardrail.ts` is real, enforced code with its own tests. It
filters any proposed contract revision down to what is allowed: a variant from
the validated clause library, on a clause the employee actually commented on,
never pay.

The *proposal* that goes through it is currently the scripted fallback. The
prototype called a model through the artifact runtime, which does not exist in
a deployed web app — a real model needs a server-side key and a request that
never leaves the EU, which is Phase 2 work. The guardrail is deliberately built
first and separately, so that connecting a model later changes only where the
proposal comes from, not what is allowed to pass.

## Tests

```
src/data/seed.test.ts           counts, determinism, foreign keys, reconciliation
src/ai/contractGuardrail.test.ts  what the assistant may and may not do
src/app.test.tsx                the screens, and the rules users can see
```

Run them with `npm test`. CI runs typecheck, tests and build on every push.
