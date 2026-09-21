import { describe, expect, it } from "vitest";
import { applyGuardrail, costOf, scriptedProposal } from "./contractGuardrail";

const ctx = {
  commentedClauses: ["NIGHT", "SITE"],
  currentClauses: { NIGHT: "NIGHT-1", SITE: "SITE-1", PAY: "PAY-1", TERM: "TERM-1" },
};

describe("contract revision guardrail", () => {
  it("accepts a validated variant on a clause the employee commented on", () => {
    const { accepted, rejected } = applyGuardrail(
      [{ clause: "NIGHT", variant: "NIGHT-2", why: "Caps night shifts." }],
      ctx,
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("refuses to change pay, whatever the wording", () => {
    const { accepted, rejected } = applyGuardrail(
      [{ clause: "PAY", variant: "PAY-1", why: "Raise the salary." }],
      { ...ctx, commentedClauses: ["PAY"] },
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/Pay can never be changed/);
  });

  it("refuses a clause the employee did not comment on", () => {
    const { accepted, rejected } = applyGuardrail(
      [{ clause: "TERM", variant: "TERM-1", why: "Extend the term." }],
      ctx,
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/did not comment/);
  });

  it("refuses wording that is not in the validated library", () => {
    const { accepted, rejected } = applyGuardrail(
      [{ clause: "NIGHT", variant: "NIGHT-99", why: "Invented clause." }],
      ctx,
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/validated clause library/);
  });

  it("refuses a clause that does not exist at all", () => {
    const { rejected } = applyGuardrail(
      [{ clause: "BONUS", variant: "BONUS-1", why: "Add a bonus." }],
      { ...ctx, commentedClauses: ["BONUS"] },
    );
    expect(rejected[0].reason).toMatch(/no clause/);
  });

  it("refuses a no-op and a second change to the same clause", () => {
    const noop = applyGuardrail([{ clause: "NIGHT", variant: "NIGHT-1", why: "Keep it." }], ctx);
    expect(noop.rejected[0].reason).toMatch(/already the one in force/);

    const twice = applyGuardrail(
      [
        { clause: "NIGHT", variant: "NIGHT-2", why: "Cap nights." },
        { clause: "NIGHT", variant: "NIGHT-2", why: "Cap nights again." },
      ],
      ctx,
    );
    expect(twice.accepted).toHaveLength(1);
    expect(twice.rejected).toHaveLength(1);
  });

  it("survives malformed input without throwing", () => {
    const bad = [null, undefined, {}, { clause: "NIGHT" }] as never[];
    const { accepted, rejected } = applyGuardrail(bad, ctx);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(4);
  });

  it("puts the scripted fallback through the same guardrail", () => {
    const { accepted, rejected } = applyGuardrail(scriptedProposal(ctx.commentedClauses), ctx);
    expect(accepted.map((a) => a.clause)).toEqual(["NIGHT", "SITE"]);
    expect(rejected).toHaveLength(0);
  });

  it("reads cost only from the clause library, never from the proposal", () => {
    expect(costOf([{ clause: "NIGHT", variant: "NIGHT-2", why: "" }])).toBe(-1140);
    expect(costOf([{ clause: "SITE", variant: "SITE-2", why: "" }])).toBe(0);
    expect(costOf([])).toBe(0);
  });
});
