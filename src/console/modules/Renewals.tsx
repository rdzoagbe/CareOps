/**
 * Renewals & expiries: one register of every dated document for every
 * employee, with a request → receive → verify loop that runs through the
 * employee app.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { PageHead } from "../ConsoleLayout";
import {
  ALL_FACILITIES, RSTAT, RTYPE, daysTo, dstr, facilityName, renOpen, renState, renTitle,
  type Renewal,
} from "@/data";
import { num } from "@/data/format";

type ChipKey = "all" | "over" | "d30" | "d90" | "wait" | "ctr" | "cred" | "rtw";

const CHIPS: { k: ChipKey; n: string; fn: (r: Renewal) => boolean }[] = [
  { k: "all", n: "All", fn: () => true },
  { k: "over", n: "Overdue", fn: (r) => renOpen(r) && daysTo(r.due) < 0 },
  { k: "d30", n: "Next 30 days", fn: (r) => renOpen(r) && daysTo(r.due) >= 0 && daysTo(r.due) <= 30 },
  { k: "d90", n: "31–90 days", fn: (r) => renOpen(r) && daysTo(r.due) > 30 && daysTo(r.due) <= 90 },
  { k: "wait", n: "Waiting on employee", fn: (r) => ["Requested", "Received"].includes(r.status) },
  { k: "ctr", n: "Contracts", fn: (r) => RTYPE[r.type].grp === "Contracts" },
  { k: "cred", n: "Credentials & training", fn: (r) => ["Credentials", "Training"].includes(RTYPE[r.type].grp) },
  { k: "rtw", n: "🔒 Right to work", fn: (r) => r.type === "work" },
];

function DueTag({ r }: { r: Renewal }) {
  if (!renOpen(r)) {
    return (
      <span className="tag t-mute">
        <i className="dot" />
        {r.status === "Verified" ? "valid until " + dstr(new Date(r.due + "T12:00:00Z")) : r.status}
      </span>
    );
  }
  const d = daysTo(r.due);
  if (d < 0) return <span className="tag t-bad"><i className="dot" />{Math.abs(d)} days overdue</span>;
  if (d <= 30) return <span className="tag t-warn"><i className="dot" />in {d} days</span>;
  if (d <= RTYPE[r.type].lead) return <span className="tag t-info"><i className="dot" />in {d} days</span>;
  return <span className="sec">{dstr(new Date(r.due + "T12:00:00Z"))}</span>;
}

export function RenewalsModule() {
  const { db, renewals, scope, updateRenewals, updatePortal, logEvent, relay, toast, portal } = useStore();
  const [chip, setChip] = useState<ChipKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const empOf = useMemo(
    () => (r: Renewal) => db.employees.find((e) => e.id === r.emp)!,
    [db.employees],
  );

  const inScope = useMemo(
    () =>
      renewals.filter((r) => {
        const e = empOf(r);
        return scope.facility === ALL_FACILITIES || e?.facility === scope.facility;
      }),
    [renewals, scope.facility, empOf],
  );

  const open = inScope.filter(renOpen);
  const over = open.filter((r) => daysTo(r.due) < 0);
  const d30 = open.filter((r) => daysTo(r.due) >= 0 && daysTo(r.due) <= 30);
  const d90 = open.filter((r) => daysTo(r.due) > 30 && daysTo(r.due) <= 90);
  const waiting = open.filter((r) => ["Requested", "Received"].includes(r.status));
  const valid = inScope.filter((r) => ["Verified", "Valid"].includes(renState(r))).length;

  const weeks = Array.from({ length: 12 }, (_, w) =>
    open.filter((r) => {
      const d = daysTo(r.due);
      return d >= w * 7 && d < (w + 1) * 7;
    }).length,
  );
  const wmax = Math.max(1, ...weeks);

  const groups = [...new Set(Object.values(RTYPE).map((t) => t.grp))]
    .map((g) => ({ g, n: open.filter((r) => RTYPE[r.type].grp === g && daysTo(r.due) <= 90).length }))
    .sort((a, b) => b.n - a.n);
  const gmax = Math.max(1, ...groups.map((x) => x.n));

  const rows = inScope
    .filter(CHIPS.find((c) => c.k === chip)!.fn)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 60);

  const act = (id: string, kind: string) => {
    const r = renewals.find((x) => x.id === id)!;
    const e = empOf(r);
    const map: Record<string, [string, string]> = {
      request: ["Requested", "Requested from the employee"],
      verify: ["Verified", "Verified, new date recorded"],
      book: ["Booked", "Session booked for 6 Oct"],
      end: ["Ends as planned", "Contract ends as planned"],
      confirm: ["Verified", "Hire confirmed with the manager"],
      done: ["Verified", "Marked as done"],
      offline: ["Handled offline", "Handled outside CareOps"],
      renew: ["Requested", "Renewal prepared in Contracts"],
    };
    const [st, h] = map[kind];

    updateRenewals((d) => {
      const x = d.find((y) => y.id === id);
      if (!x) return;
      x.status = st;
      x.history.unshift([h, "today, 10:14"]);
      if (kind === "verify") {
        const nd = new Date(x.due + "T12:00:00Z");
        nd.setUTCFullYear(
          Math.max(nd.getUTCFullYear(), 2026) + (x.type === "work" ? 1 : x.type === "training" ? 2 : 3),
        );
        x.due = nd.toISOString().slice(0, 10);
      }
      if (kind === "book") x.due = "2026-10-06";
    });

    logEvent("Renewal: " + h.toLowerCase(), r.id + " " + e.id);
    if (r.who && kind === "request") {
      updatePortal((d) => { d.flags.renreq = true; });
      relay("Request sent to " + portal.ppl[r.who].first, "go");
    }
    if (r.who && kind === "verify") {
      updatePortal((d) => { d.flags.renver = true; });
      relay("Verification sent to " + portal.ppl[r.who].first, "go");
    }
    setOpenId(null);
    toast(h);
  };

  const bulk = () => {
    const due = inScope.filter(
      (r) => renOpen(r) && r.status === "To act" && RTYPE[r.type].emp && daysTo(r.due) <= 30,
    );
    const ids = new Set(due.map((r) => r.id));
    updateRenewals((d) => {
      for (const x of d) {
        if (ids.has(x.id)) {
          x.status = "Requested";
          x.history.unshift(["Reminder sent in bulk", "today, 10:14"]);
        }
      }
    });
    logEvent("Renewal reminders sent in bulk", due.length + " employees");
    if (due.some((r) => r.who)) relay("Reminders sent", "go");
    toast(due.length + " reminders sent through the employee app");
  };

  const current = openId ? renewals.find((r) => r.id === openId) : null;

  return (
    <>
      <PageHead
        title="Renewals & expiries"
        sub={`Every dated document for every employee, in one register · ${facilityName(db.facilities, scope.facility)}`}
        actions={
          <button className="btn ghost" onClick={bulk}>Send reminders for the next 30 days</button>
        }
      />

      <div className="grid c4">
        <div className="card"><div className="kpi"><div className="lab">Overdue</div><div className="val down">{over.length}</div><div className="sub">past their due date, still open</div></div></div>
        <div className="card"><div className="kpi"><div className="lab">Due within 30 days</div><div className="val">{d30.length}</div><div className="sub">act now to avoid a gap</div></div></div>
        <div className="card"><div className="kpi"><div className="lab">Due in 31 to 90 days</div><div className="val">{d90.length}</div><div className="sub">reminders scheduled</div></div></div>
        <div className="card"><div className="kpi"><div className="lab">Waiting on employees</div><div className="val">{waiting.length}</div><div className="sub">requested or received, to verify</div></div></div>
      </div>

      <div className="grid c23" style={{ marginTop: 12 }}>
        <section className="card">
          <div className="ch">
            <div><h3>Register</h3><div className="sub">Click a row to request, verify or close it</div></div>
          </div>
          <div className="tbar">
            {CHIPS.map((c) => (
              <button key={c.k} className={`chip ${chip === c.k ? "on" : ""}`} onClick={() => setChip(c.k)}>
                {c.n}
              </button>
            ))}
          </div>
          <div className="scrollx">
            <table>
              <thead>
                <tr><th>Employee</th><th>Document</th><th>Due</th><th>Status</th><th>Owner</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = empOf(r);
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)}>
                      <td>
                        <b style={{ fontWeight: 500 }}>{e.name}</b>
                        <div className="sec">{e.role}, {facilityName(db.facilities, e.facility).replace("St. Gabriel ", "")}</div>
                      </td>
                      <td>
                        {renTitle(r)}
                        {RTYPE[r.type].hr && <span className="tag t-mute"> 🔒 HR only</span>}
                        <div className="sec">{RTYPE[r.type].grp}</div>
                      </td>
                      <td><DueTag r={r} /></td>
                      <td><span className={`tag t-${RSTAT[renState(r)] ?? "mute"}`}><i className="dot" />{renState(r)}</span></td>
                      <td><span className="sec">{r.owner}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <div className="empty"><b>Nothing in this filter</b>Try another chip.</div>}
          </div>
          <div className="pager">Showing {rows.length} of {num(inScope.length)} documents</div>
        </section>

        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <section className="card">
            <div className="ch"><div><h3>Next 12 weeks</h3><div className="sub">Open items falling due each week</div></div></div>
            <div className="cb">
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 110 }}>
                {weeks.map((n, w) => (
                  <div key={w} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", gap: 3 }} title={`${n} due in week ${w + 1}`}>
                    <span style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center" }}>{n || ""}</span>
                    <i style={{ display: "block", height: Math.max(3, (n / wmax) * 80), background: w < 5 ? "var(--warn)" : "var(--blue)", borderRadius: "4px 4px 0 0" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
                <span>this week</span><span>in 12 weeks</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="ch"><div><h3>Due within 90 days, by kind</h3></div></div>
            <div className="cb">
              {groups.map((x) => (
                <div key={x.g} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", fontSize: 12.5 }}>
                    <span>{x.g}</span><b style={{ marginLeft: "auto", fontWeight: 600 }}>{x.n}</b>
                  </div>
                  <div className="bar" style={{ marginTop: 3 }}><i style={{ width: `${(x.n / gmax) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="ch"><div><h3>Reminder rules</h3></div></div>
            <div className="cb">
              <dl className="kv">
                <dt>Right to work</dt><dd>from 120 days before</dd>
                <dt>Licences</dt><dd>from 90 days before</dd>
                <dt>Contracts, training</dt><dd>from 60 days before</dd>
                <dt>Other</dt><dd>from 15 to 30 days before</dd>
              </dl>
            </div>
          </section>

          <div className="note">
            {num(valid)} of {num(inScope.length)} documents are valid and outside their renewal window.
            Right to work and identity items are visible to HR only. Managers see &ldquo;action needed&rdquo;
            without the document itself.
          </div>
        </div>
      </div>

      {current && (
        <RenewalModal
          r={current}
          employeeName={empOf(current).name}
          employeeRole={empOf(current).role}
          onClose={() => setOpenId(null)}
          onAct={act}
        />
      )}
    </>
  );
}

function RenewalModal({
  r, employeeName, employeeRole, onClose, onAct,
}: {
  r: Renewal;
  employeeName: string;
  employeeRole: string;
  onClose: () => void;
  onAct: (id: string, kind: string) => void;
}) {
  const t = RTYPE[r.type];
  const acts: { kind: string; label: string; ghost?: boolean }[] = [];
  if (renOpen(r)) {
    if (t.emp && r.status === "To act") acts.push({ kind: "request", label: r.who ? "Request it in the employee app" : "Request by email" });
    if (r.status === "Received") acts.push({ kind: "verify", label: "Verify and record new date" });
    if (r.type === "training" && r.status !== "Booked") acts.push({ kind: "book", label: "Book a session", ghost: true });
    if (["contract", "agency"].includes(r.type)) {
      acts.push({ kind: "renew", label: "Prepare a renewal" });
      acts.push({ kind: "end", label: "Ends as planned", ghost: true });
    }
    if (r.type === "trial") acts.push({ kind: "confirm", label: "Hire confirmed with manager" });
    if (["register", "occ"].includes(r.type) || !t.emp) acts.push({ kind: "done", label: "Mark as done", ghost: true });
    acts.push({ kind: "offline", label: "Handled offline", ghost: true });
  }

  return (
    <div className="modal on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox">
        <div className="mh">
          <div>
            <h2>{renTitle(r)}</h2>
            <div className="s">{r.id}, {employeeName}, {employeeRole}</div>
          </div>
        </div>
        <div className="mb">
          <dl className="kv">
            <dt>Due</dt><dd>{dstr(new Date(r.due + "T12:00:00Z"))} <DueTag r={r} /></dd>
            <dt>Status</dt><dd><span className={`tag t-${RSTAT[renState(r)] ?? "mute"}`}><i className="dot" />{renState(r)}</span></dd>
            <dt>Owner</dt><dd>{r.owner}</dd>
            <dt>Kind</dt><dd>{t.grp}</dd>
          </dl>
          <div className="note" style={{ marginTop: 10 }}>{t.act}</div>
          {r.type === "work" && (
            <div className="note w" style={{ marginTop: 8 }}>
              The law forbids keeping in employment anyone without a valid work authorisation, so this item
              is tracked from 120 days before expiry. The personnel register holds the type and number of
              the permit.
            </div>
          )}
          {r.type === "id" && (
            <div className="note w" style={{ marginTop: 8 }}>
              Minimisation: record that a valid document was seen and its expiry. Do not store a copy unless
              your counsel confirms a legal basis.
            </div>
          )}
          {r.type === "occ" && (
            <div className="note" style={{ marginTop: 8 }}>
              Occupational health keeps the medical file. HR only sees the visit date and the fitness decision.
            </div>
          )}
          {r.history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {r.history.map((h, i) => (
                <div className="rw" style={{ padding: "6px 0" }} key={i}>
                  <div className="g"><b>{h[0]}</b><span className="s">{h[1]}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mf">
          <button className="btn ghost" onClick={onClose}>Close</button>
          {acts.map((a) => (
            <button key={a.kind} className={`btn ${a.ghost ? "ghost" : ""}`} onClick={() => onAct(r.id, a.kind)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
