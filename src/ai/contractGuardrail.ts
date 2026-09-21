/**
 * Guardrail for AI-assisted contract revision.
 *
 * The assistant may only ever *select* a clause variant that a lawyer has
 * already validated. It cannot author legal text, it cannot touch a clause the
 * employee did not comment on, and it can never change pay. Anything else it
 * proposes is discarded here, with a reason the screen shows.
 *
 * This runs on every proposal, whether it came from a model or from the
 * scripted fallback. It is the enforcement point, not a description of intent.
 */
import { CLS, PROTECTED_CLAUSES } from "@/data/portal";

export interface ProposedChange {
  /** Clause key, e.g. "NIGHT". */
  clause: string;
  /** Variant id from the validated library, e.g. "NIGHT-2". */
  variant: string;
  /** Why the assistant proposes it, shown to HR. */
  why: string;
}

export interface RejectedChange extends ProposedChange {
  reason: string;
}

export interface GuardrailResult {
  accepted: ProposedChange[];
  rejected: RejectedChange[];
}

export interface GuardrailContext {
  /** Clause keys the employee actually commented on. */
  commentedClauses: string[];
  /** The clauses of the version currently in force. */
  currentClauses: Record<string, string>;
}

/**
 * Filters a set of proposed changes down to the ones that are allowed.
 * Never throws: an unusable proposal simply yields an empty `accepted` list.
 */
export function applyGuardrail(
  proposals: ProposedChange[],
  ctx: GuardrailContext,
): GuardrailResult {
  const accepted: ProposedChange[] = [];
  const rejected: RejectedChange[] = [];
  const seen = new Set<string>();

  for (const p of proposals) {
    const reason = rejectionReason(p, ctx, seen);
    if (reason) {
      rejected.push({ ...p, reason });
      continue;
    }
    seen.add(p.clause);
    accepted.push(p);
  }
  return { accepted, rejected };
}

function rejectionReason(
  p: ProposedChange,
  ctx: GuardrailContext,
  seen: Set<string>,
): string | null {
  if (!p || typeof p.clause !== "string" || typeof p.variant !== "string") {
    return "Malformed proposal.";
  }
  if (PROTECTED_CLAUSES.includes(p.clause)) {
    return "Pay can never be changed by the assistant. Only a person may propose a pay change.";
  }
  const clause = CLS[p.clause];
  if (!clause) {
    return `There is no clause "${p.clause}" in the contract.`;
  }
  if (!clause.v.some((v) => v.id === p.variant)) {
    return "That wording is not in the validated clause library, so it cannot be used.";
  }
  if (!ctx.commentedClauses.includes(p.clause)) {
    return "The employee did not comment on this clause, so it must not change.";
  }
  if (ctx.currentClauses[p.clause] === p.variant) {
    return "That variant is already the one in force.";
  }
  if (seen.has(p.clause)) {
    return "Only one change per clause is allowed.";
  }
  return null;
}

/**
 * The scripted proposal used when no model is available.
 *
 * It answers the two clauses the demo employee comments on. It goes through
 * exactly the same guardrail as a model-generated proposal would.
 */
export function scriptedProposal(commentedClauses: string[]): ProposedChange[] {
  const out: ProposedChange[] = [];
  if (commentedClauses.includes("NIGHT")) {
    out.push({
      clause: "NIGHT",
      variant: "NIGHT-2",
      why: "Caps night shifts at half the rota cycle, which is the validated variant closest to the remark.",
    });
  }
  if (commentedClauses.includes("SITE")) {
    out.push({
      clause: "SITE",
      variant: "SITE-2",
      why: "Requires written agreement before any assignment to another facility.",
    });
  }
  return out;
}

/** Annual cost of a set of accepted changes, from the clause library only. */
export function costOf(changes: ProposedChange[]): number {
  return changes.reduce((sum, c) => {
    const variant = CLS[c.clause]?.v.find((v) => v.id === c.variant);
    return sum + (variant?.cost ?? 0);
  }, 0);
}
