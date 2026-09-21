/**
 * Employee Portal: what employees do in the CareOps app, and what HR decides
 * in return. Every decision here reaches the employee's phone.
 */
import { useState } from "react";
import { useStore } from "@/state/store";
import { PageHead } from "../ConsoleLayout";
import { CLS, CLS_ORDER, STORY, clsText, dsh, num } from "@/data";
import { applyGuardrail, costOf, scriptedProposal, type RejectedChange } from "@/ai/contractGuardrail";

type PortalTab = "overview" | "contracts" | "requests" | "absences" | "presence" | "access";

const RQ_TONE: Record<string, string> = {
  New: "info", "In progress": "warn", Approved: "ok", Declined: "bad", Answered: "ok", Done: "ok",
};

export function EmployeePortalModule() {
  const { portal, db, journal, setView } = useStore();
  const [tab, setTab] = useState<PortalTab>("overview");

  const openReq = portal.requests.filter((r) => r.status === "New").length;
  const pv = portal.payvars.filter((v) => v.st === "Proposed").length;
  const toCover = portal.absences.filter((a) => !a.covered).length;

  const tabs: [PortalTab, string, number][] = [
    ["overview", "Overview", 0],
    ["contracts", "Contracts", portal.contract.status === "Commented" ? 1 : 0],
    ["requests", "Requests", openReq],
    ["absences", "Absences & pay", pv + toCover],
    ["presence", "Presence", portal.confirm.filter((x) => x.st === "No answer").length],
    ["access", "File access", 0],
  ];

  return (
    <>
      <PageHead
        title="Employee Portal"
        sub="What employees do in the CareOps app, and what HR decides in return"
        actions={<button className="btn ghost" onClick={() => setView("split")}>Show the employee app</button>}
      />
      <div className="ptabs">
        {tabs.map(([k, l, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l}
            {n ? <span className="cnt">{n}</span> : null}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview journalLength={journal.length} employeeCount={db.employees.length} />}
      {tab === "contracts" && <Contracts />}
      {tab === "requests" && <Requests />}
      {tab === "absences" && <Absences />}
      {tab === "presence" && <Presence />}
      {tab === "access" && <FileAccess />}
    </>
  );
}

function Overview({ journalLength, employeeCount }: { journalLength: number; employeeCount: number }) {
  const { portal, journal } = useStore();
  const next = STORY.find((s) => !portal.flags[s[0]]);
  const nonAgency = employeeCount;
  const active = Math.round(nonAgency * 0.87) + (portal.ppl.A.account === "active" ? 1 : 0);

  return (
    <>
      <div className="grid c4">
        <div className="card"><div className="kpi">
          <div className="lab">App accounts active</div>
          <div className="val">{Math.round((active / nonAgency) * 100)}%</div>
          <div className="sub">{num(active)} of {num(nonAgency)} employees. Agency staff sign with their agency.</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Contracts awaiting signature</div>
          <div className="val">{portal.contract.status === "Signed" ? 0 : 1}</div>
          <div className="sub">reminder sent automatically after 24 h</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Open employee requests</div>
          <div className="val">{portal.requests.filter((r) => r.status === "New").length}</div>
          <div className="sub">leave, certificates, documents, swaps</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Shifts to cover</div>
          <div className="val">{portal.absences.filter((a) => !a.covered).reduce((s, a) => s + a.dates.length, 0)}</div>
          <div className="sub">released by absences declared in the app</div>
        </div></div>
      </div>

      <div className="grid c23" style={{ marginTop: 12 }}>
        <section className="card">
          <div className="ch"><div>
            <h3>Demo storyline</h3>
            <div className="sub">Follow the steps. Each action travels between this console and the employee&apos;s phone.</div>
          </div></div>
          <div className="cb">
            <div className="steps">
              {STORY.map(([k, l, w]) => (
                <div key={k} style={portal.flags[k] ? { color: "var(--muted)" } : undefined}>
                  {portal.flags[k] ? "✓ " : next && next[0] === k ? "➜ " : ""}
                  <b style={{ fontWeight: next && next[0] === k ? 600 : 400 }}>{l}</b>{" "}
                  <span className="sec">{w}</span>
                </div>
              ))}
            </div>
            {!next && (
              <div className="note k" style={{ marginTop: 10 }}>
                Storyline complete. Open Security &amp; Audit to see every trace both sides left.
              </div>
            )}
          </div>
        </section>

        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <section className="card">
            <div className="ch"><div><h3>Rules built into the app</h3></div></div>
            <div className="cb"><div className="steps">
              <div>Silence never counts as acceptance. An unsigned contract stays pending.</div>
              <div>A missing presence confirmation never reduces pay. The rota is the record.</div>
              <div>Absences are declared by type, never by medical reason.</div>
              <div>Pay impacts are proposed by the system and decided by a person.</div>
              <div>No non-urgent notifications between 21:00 and 07:00.</div>
              <div>Every opening of a personnel file is visible to the employee.</div>
            </div></div>
          </section>

          <section className="card">
            <div className="ch"><div><h3>Latest from the app</h3><div className="sub">{journalLength} entries</div></div></div>
            <div className="cb">
              {journal.length ? (
                journal.slice(0, 6).map((e) => (
                  <div className="rw" style={{ padding: "8px 0" }} key={e.id}>
                    <div className="g"><b>{e.action}</b><span className="s">{e.actor}, {e.at}</span></div>
                  </div>
                ))
              ) : (
                <div className="sec">Nothing yet. Start the storyline on the phone.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Contracts() {
  const { portal, updatePortal, logEvent, relay, toast } = useStore();
  const [rejected, setRejected] = useState<RejectedChange[]>([]);
  const c = portal.contract;
  const v = c.versions[c.versions.length - 1];
  const commented = c.comments.map((x) => x.c);

  const askAssistant = () => {
    const { accepted, rejected: bad } = applyGuardrail(scriptedProposal(commented), {
      commentedClauses: commented,
      currentClauses: v.clauses,
    });
    setRejected(bad);
    if (!accepted.length) {
      toast("The assistant proposed nothing the guardrail allows");
      return;
    }
    updatePortal((d) => {
      d.contract.proposal = {
        clauses: Object.fromEntries(accepted.map((a) => [a.clause, a.variant])),
        why: accepted.map((a) => ({ k: a.clause, why: a.why })),
        source: "Scripted fallback, checked by the guardrail",
      };
    });
    logEvent("AI contract revision proposed", c.id, "Success", "AI assistant");
    toast(`${accepted.length} change(s) proposed, ${bad.length} discarded by the guardrail`);
  };

  const sendVersion2 = () => {
    const proposal = c.proposal;
    if (!proposal) return;
    updatePortal((d) => {
      const clauses = { ...v.clauses, ...proposal.clauses };
      d.contract.versions.push({
        n: d.contract.versions.length + 1, clauses, hash: "b93d…17ac", at: "today, 10:14",
      });
      d.contract.changedWhy = proposal.why;
      d.contract.status = "Sent";
      d.contract.proposal = null;
      d.contract.history.push(["Version 2 sent after HR review", "today, 10:14"]);
      d.flags.v2 = true;
    });
    logEvent("Contract version 2 sent to the employee", c.id);
    relay("Version 2 sent to Aïcha", "go");
    toast("Version 2 is on Aïcha's phone");
  };

  const annual = (c.gross + c.allowances) * 12 + (c.proposal ? costOf(
    Object.entries(c.proposal.clauses).map(([clause, variant]) => ({ clause, variant, why: "" })),
  ) : 0);

  return (
    <div className="grid c23">
      <section className="card">
        <div className="ch"><div>
          <h3>{c.type}</h3>
          <div className="sub">{c.id}, sent {c.sent} · status {c.status}</div>
        </div></div>
        <div className="cb">
          {CLS_ORDER.map((k) => {
            const comment = c.comments.find((x) => x.c === k);
            const proposedVariant = c.proposal?.clauses[k];
            return (
              <div className="clause" key={k}>
                <h4>
                  {CLS[k].t}
                  {k === "PAY" && <span className="tag t-mute">🔒 never changed by AI</span>}
                </h4>
                <p>{clsText(v.clauses[k]).x}</p>
                {comment && <div className="cm"><b>Employee remark:</b> {comment.t}</div>}
                {proposedVariant && (
                  <div className="aibox" style={{ marginTop: 8 }}>
                    <span className="lab">✦ Proposed revision</span>
                    <p>{clsText(proposedVariant).x}</p>
                    <p className="sec" style={{ marginTop: 6 }}>
                      {c.proposal?.why.find((w) => w.k === k)?.why}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid" style={{ gap: 12, alignContent: "start" }}>
        <section className="card">
          <div className="ch"><div><h3>AI-assisted revision</h3><div className="sub">HR decides, always</div></div></div>
          <div className="cb">
            <div className="note">
              The assistant may only pick a clause variant the lawyer has already validated, only on a
              clause the employee commented on, and never on pay. Anything else is discarded automatically
              and listed below.
            </div>
            {c.status === "Commented" && !c.proposal && (
              <button className="btn" style={{ marginTop: 10 }} onClick={askAssistant}>
                ✦ Ask for a revision
              </button>
            )}
            {c.proposal && (
              <>
                <div className="note k" style={{ marginTop: 10 }}>
                  {Object.keys(c.proposal.clauses).length} change(s) passed the guardrail. Source:{" "}
                  {c.proposal.source}.
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={sendVersion2}>
                  Check and send version 2
                </button>
              </>
            )}
            {rejected.length > 0 && (
              <div className="note b" style={{ marginTop: 10 }}>
                <b>Discarded by the guardrail</b>
                {rejected.map((r, i) => (
                  <div key={i} style={{ marginTop: 4 }}>{r.clause}: {r.reason}</div>
                ))}
              </div>
            )}
            {c.status !== "Commented" && !c.proposal && (
              <div className="sec" style={{ marginTop: 10 }}>
                Available once the employee has sent remarks.
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="ch"><div><h3>Cost</h3></div></div>
          <div className="cb">
            <dl className="kv">
              <dt>Gross monthly</dt><dd>€{c.gross.toLocaleString("en-GB")}</dd>
              <dt>Allowances</dt><dd>€{c.allowances.toLocaleString("en-GB")}</dd>
              <dt>Annual, all in</dt><dd>€{annual.toLocaleString("en-GB")}</dd>
              <dt>Employer loaded</dt><dd>€{Math.round(annual * 1.45).toLocaleString("en-GB")}</dd>
            </dl>
            <div className="note" style={{ marginTop: 10 }}>
              Every euro shown comes from the contract record or the clause library. The assistant writes
              sentences, never numbers.
            </div>
          </div>
        </section>

        <section className="card">
          <div className="ch"><div><h3>History</h3></div></div>
          <div className="cb"><div className="tl">
            {c.history.map((h, i) => (
              <div className="ev" key={i}><b>{h[0]}</b><p>{h[1]}</p></div>
            ))}
          </div></div>
        </section>
      </div>
    </div>
  );
}

function Requests() {
  const { portal, updatePortal, logEvent, relay, toast } = useStore();

  const answer = (id: string, status: string, reply: string) => {
    updatePortal((d) => {
      const r = d.requests.find((x) => x.id === id);
      if (!r) return;
      r.status = status;
      r.thread.push({ from: "hr", t: reply, at: "today, 10:14" });
      if (r.who) r.unreadReply = true;
      if (r.type === "Certificate") d.flags.cert = true;
    });
    const r = portal.requests.find((x) => x.id === id);
    logEvent(`Employee request ${status.toLowerCase()}`, id);
    if (r?.who) relay(`Answer sent to ${portal.ppl[r.who].first}`, "go");
    toast("Answered");
  };

  return (
    <section className="card">
      <div className="ch"><div><h3>Requests from employees</h3><div className="sub">Leave, certificates, documents, swaps, questions</div></div></div>
      <div className="scrollx">
        <table>
          <thead><tr><th>Request</th><th>Type</th><th>Sent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {portal.requests.map((r) => (
              <tr key={r.id}>
                <td><b style={{ fontWeight: 500 }}>{r.title}</b><div className="sec">{r.id}, {r.emp}</div></td>
                <td>{r.type}</td>
                <td><span className="sec">{r.at}</span></td>
                <td><span className={`tag t-${RQ_TONE[r.status] ?? "mute"}`}><i className="dot" />{r.status}</span></td>
                <td style={{ textAlign: "right" }}>
                  {r.status === "New" && (
                    <>
                      <button className="btn sm" onClick={() => answer(r.id, r.type === "Certificate" ? "Done" : "Approved", r.type === "Certificate" ? "Your certificate is in your documents." : "Approved. Enjoy your time off.")}>
                        {r.type === "Certificate" ? "Issue it" : "Approve"}
                      </button>{" "}
                      <button className="btn ghost sm" onClick={() => answer(r.id, "Declined", "We cannot cover the ward on those dates. Could you propose others?")}>
                        Decline
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Absences() {
  const { portal, updatePortal, logEvent, relay, toast } = useStore();

  const cover = (id: string) => {
    updatePortal((d) => {
      const a = d.absences.find((x) => x.id === id);
      if (a) a.covered = true;
      d.flags.covered = true;
    });
    logEvent("Released shifts offered to qualified colleagues", id);
    relay("Shifts offered to the team", "go");
    toast("Offered to qualified colleagues");
  };

  const validate = (pvId: string) => {
    updatePortal((d) => {
      const pv = d.payvars.find((v) => v.id === pvId);
      if (pv) pv.st = "Validated";
      d.flags.validated = true;
    });
    logEvent("Payroll variable validated by a person", pvId);
    relay("Pay decision sent", "go");
    toast("Validated. The employee can still dispute it.");
  };

  return (
    <div className="grid c2">
      <section className="card">
        <div className="ch"><div><h3>Absences declared in the app</h3><div className="sub">Type only — never a medical reason</div></div></div>
        <div className="cb">
          {portal.absences.length ? (
            portal.absences.map((a) => (
              <div className="rw" key={a.id}>
                <div className="g">
                  <b>{a.type}, {a.dates.map(dsh).join(" and ")}</b>
                  <span className="s">{portal.ppl[a.who].first} · {a.covered ? "shifts offered" : "shifts to cover"}</span>
                </div>
                {!a.covered && <button className="btn sm" onClick={() => cover(a.id)}>Offer the shifts</button>}
              </div>
            ))
          ) : (
            <div className="sec">No absence declared yet. Declare one from the phone.</div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="ch"><div><h3>Payroll variables</h3><div className="sub">Proposed by the system, decided by a person</div></div></div>
        <div className="cb">
          {portal.payvars.map((v) => (
            <div className="rw" key={v.id}>
              <div className="g">
                <b>{v.label}{v.days ? `, ${v.days} day(s)` : ""}</b>
                <span className="s">{v.id}, {v.emp} · {v.src}</span>
              </div>
              <span className={`tag t-${v.st === "Validated" ? "ok" : v.st === "Disputed" ? "bad" : "warn"}`}>
                <i className="dot" />{v.st}
              </span>
              {v.st === "Proposed" && (
                <button className="btn sm" onClick={() => validate(v.id)}>Validate</button>
              )}
            </div>
          ))}
          <div className="note" style={{ marginTop: 10 }}>
            Nothing here reaches payroll until a person validates it, and the employee can dispute every
            decision from their phone.
          </div>
        </div>
      </section>
    </div>
  );
}

function Presence() {
  const { portal } = useStore();
  return (
    <section className="card">
      <div className="ch"><div><h3>Presence confirmations</h3><div className="sub">A missing confirmation never reduces pay</div></div></div>
      <div className="cb">
        {portal.confirm.map((x) => (
          <div className="rw" key={x.d + x.who}>
            <div className="g">
              <b>{portal.ppl[x.who].first}, {dsh(x.d)}</b>
              <span className="s">{x.note || "As published"}</span>
            </div>
            <span className={`tag t-${x.st === "Confirmed" ? "ok" : x.st === "Reported" ? "warn" : "mute"}`}>
              <i className="dot" />{x.st}
            </span>
          </div>
        ))}
        <div className="note" style={{ marginTop: 10 }}>
          The published rota remains the record. Confirmation is a chance to report a difference, not a
          condition of being paid.
        </div>
      </div>
    </section>
  );
}

function FileAccess() {
  const { portal } = useStore();
  return (
    <section className="card">
      <div className="ch"><div><h3>Who opened a personnel file</h3><div className="sub">Every entry is visible to the employee too</div></div></div>
      <div className="cb">
        {portal.access.map((a, i) => (
          <div className="rw" key={i}>
            <div className="g">
              <b>{a.by} opened {portal.ppl[a.who].first}&apos;s file</b>
              <span className="s">{a.why}, {a.at}</span>
            </div>
          </div>
        ))}
        <div className="note" style={{ marginTop: 10 }}>
          There is no way to read a personnel file without the employee seeing it. That is the point.
        </div>
      </div>
    </section>
  );
}
