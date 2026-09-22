/**
 * Service ordering: what each service ordered, and where the volume is out of
 * line with its own past, with its peers, or with itself a few days earlier.
 *
 * The monitor only ever proposes. Nothing on this screen can cancel, block or
 * change an order — the store exposes no way to write to the ledger — and no
 * alert names a person. An alert is closed by a human choosing a reason from a
 * fixed list.
 */
import { useMemo, useState } from "react";
import { useStore } from "@/state/store";
import { PageHead } from "../ConsoleLayout";
import {
  ALL_FACILITIES, BASELINE_DAYS, ORDER_ACTIONS, ORDER_ALERT_TONE, ORDER_JUSTIFICATIONS,
  ORDER_RULES, PO_THRESHOLD, WINDOW_DAYS, alertOpen, daysTo, dstr, facilityName,
  type OrderAlert, type OrderAlertStatus, type OrderRuleKey, type ServiceOrder,
} from "@/data";
import { fmtEUR, fmtEUR0, num } from "@/data/format";

type LedgerChip = "all" | "req" | "po" | "flagged";

const SEV_TONE: Record<OrderAlert["severity"], string> = { High: "bad", Medium: "warn" };

const d = (isoDate: string) => dstr(new Date(isoDate + "T12:00:00Z"));

export function ServiceOrderingModule() {
  const { db, orders, orderAlerts, scope, updateOrderAlerts, logEvent, toast } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [chip, setChip] = useState<LedgerChip>("all");

  const inFacility = <T extends { facility: string }>(r: T) =>
    scope.facility === ALL_FACILITIES || r.facility === scope.facility;

  const alerts = useMemo(() => orderAlerts.filter(inFacility), [orderAlerts, scope.facility]);
  const ledger = useMemo(() => orders.filter(inFacility), [orders, scope.facility]);

  const recent = useMemo(
    () => ledger.filter((o) => -daysTo(o.placed) <= WINDOW_DAYS),
    [ledger],
  );

  const open = alerts.filter(alertOpen);
  const excess = open.reduce((t, a) => t + a.excessSpend, 0);

  const byService = useMemo(() => {
    const m = new Map<string, { orders: number; spend: number }>();
    for (const o of recent) {
      const x = m.get(o.service) ?? { orders: 0, spend: 0 };
      x.orders += 1;
      x.spend += o.amount;
      m.set(o.service, x);
    }
    return [...m.entries()]
      .map(([service, v]) => ({ service, ...v, alerts: open.filter((a) => a.service === service).length }))
      .sort((a, b) => b.orders - a.orders);
  }, [recent, open]);
  const omax = Math.max(1, ...byService.map((x) => x.orders));

  const filtered = useMemo(() => {
    const flagged = new Set(alerts.flatMap((a) => a.orderIds));
    const pick =
      chip === "req" ? (o: ServiceOrder) => o.channel === "Direct requisition"
      : chip === "po" ? (o: ServiceOrder) => o.channel === "Purchase order"
      : chip === "flagged" ? (o: ServiceOrder) => flagged.has(o.id)
      : () => true;
    return ledger.filter(pick);
  }, [ledger, chip, alerts]);
  const rows = filtered.slice(0, 50);

  const act = (id: string, status: OrderAlertStatus, note: string, reason: string | null) => {
    updateOrderAlerts((draft) => {
      const a = draft.find((x) => x.id === id);
      if (!a) return;
      a.status = status;
      if (reason) a.reason = reason;
      a.history.unshift([note, "today, 10:14"]);
    });
    const a = alerts.find((x) => x.id === id)!;
    logEvent("Ordering alert: " + note.toLowerCase(), `${a.id} ${a.service}, ${a.item}`);
    setOpenId(null);
    toast(note);
  };

  const current = openId ? orderAlerts.find((a) => a.id === openId) ?? null : null;

  return (
    <>
      <PageHead
        title="Service ordering"
        sub={`Every order by service, and the volumes that are out of line · ${facilityName(db.facilities, scope.facility)}`}
      />

      <div className="grid c4">
        <div className="card"><div className="kpi">
          <div className="lab">Open alerts</div>
          <div className={`val ${open.length ? "down" : ""}`}>{open.length}</div>
          <div className="sub">services ordering well above their usual rate</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Spend above the usual rate</div>
          <div className="val">{fmtEUR(excess)}</div>
          <div className="sub">across the open alerts, last {WINDOW_DAYS} days</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Orders in the last {WINDOW_DAYS} days</div>
          <div className="val">{num(recent.length)}</div>
          <div className="sub">{num(recent.filter((o) => o.channel === "Direct requisition").length)} placed without a purchase order</div>
        </div></div>
        <div className="card"><div className="kpi">
          <div className="lab">Services ordering</div>
          <div className="val">{byService.length}</div>
          <div className="sub">of {db.depts.length} in the group</div>
        </div></div>
      </div>

      <div className="grid c23" style={{ marginTop: 12 }}>
        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <section className="card">
            <div className="ch">
              <div>
                <h3>Ordered too much</h3>
                <div className="sub">Click a row for the orders counted and the comparison behind it</div>
              </div>
            </div>
            <div className="scrollx">
              <table>
                <thead>
                  <tr><th>Service</th><th>Item</th><th>Last {WINDOW_DAYS} days</th><th>Above usual</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} onClick={() => setOpenId(a.id)}>
                      <td>
                        <b style={{ fontWeight: 500 }}>{a.service}</b>
                        <div className="sec">{facilityName(db.facilities, a.facility).replace("St. Gabriel ", "")}</div>
                      </td>
                      <td>
                        {a.item}
                        <div className="sec">{a.category}</div>
                      </td>
                      <td>
                        <b style={{ fontWeight: 500 }}>{a.window.orders} orders</b>
                        <div className="sec">
                          {a.ratio ? `usually ${(a.window.orders / a.ratio).toFixed(0)}` : "no comparable history"}
                        </div>
                      </td>
                      <td>
                        <span className={`tag t-${SEV_TONE[a.severity]}`}><i className="dot" />{a.severity}</span>
                        <div className="sec">{a.excessSpend ? fmtEUR0(a.excessSpend) + " more" : "volume only"}</div>
                      </td>
                      <td><span className={`tag t-${ORDER_ALERT_TONE[a.status]}`}><i className="dot" />{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alerts.length === 0 && (
                <div className="empty">
                  <b>Nothing out of line</b>
                  No service is ordering far above its usual rate at this facility.
                </div>
              )}
            </div>
            <div className="pager">
              {alerts.length} alert{alerts.length === 1 ? "" : "s"} from {num(recent.length)} orders ·
              the monitor runs every night and always looks at the last {WINDOW_DAYS} days,
              whichever period is selected above
            </div>
          </section>

          <section className="card">
            <div className="ch">
              <div>
                <h3>Order ledger</h3>
                <div className="sub">
                  Orders at or above {fmtEUR0(PO_THRESHOLD)} go through a purchase order; below that a
                  service requisitions directly
                </div>
              </div>
            </div>
            <div className="tbar">
              {([
                ["all", "All orders"],
                ["req", "Direct requisitions"],
                ["po", "Purchase orders"],
                ["flagged", "Counted in an alert"],
              ] as [LedgerChip, string][]).map(([k, n]) => (
                <button key={k} className={`chip ${chip === k ? "on" : ""}`} onClick={() => setChip(k)}>{n}</button>
              ))}
            </div>
            <div className="scrollx">
              <table>
                <thead>
                  <tr><th>Order</th><th>Service</th><th>Item</th><th>Quantity</th><th>Amount</th><th>Placed</th></tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <b style={{ fontWeight: 500 }}>{o.id}</b>
                        <div className="sec">{o.po ?? "direct requisition"}</div>
                      </td>
                      <td>
                        {o.service}
                        <div className="sec">{facilityName(db.facilities, o.facility).replace("St. Gabriel ", "")}</div>
                      </td>
                      <td>{o.item}<div className="sec">{o.category}</div></td>
                      <td>{num(o.qty)} <span className="sec">{o.unit}</span></td>
                      <td>{fmtEUR0(o.amount)}</td>
                      <td>{d(o.placed)}<div className="sec">{o.status}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">Showing {rows.length} of {num(filtered.length)} orders</div>
          </section>
        </div>

        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <section className="card">
            <div className="ch"><div><h3>Orders by service</h3><div className="sub">Last {WINDOW_DAYS} days</div></div></div>
            <div className="cb">
              {byService.map((x) => (
                <div key={x.service} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", fontSize: 12.5 }}>
                    <span>
                      {x.service}
                      {x.alerts > 0 && <span className="tag t-bad" style={{ marginLeft: 6 }}><i className="dot" />{x.alerts}</span>}
                    </span>
                    <b style={{ marginLeft: "auto", fontWeight: 600 }}>{num(x.orders)}</b>
                  </div>
                  <div className="bar" style={{ marginTop: 3 }}><i style={{ width: `${(x.orders / omax) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="ch"><div><h3>How an alert is raised</h3><div className="sub">Three rules, each fired on its own</div></div></div>
            <div className="cb">
              {(Object.keys(ORDER_RULES) as OrderRuleKey[]).map((k) => (
                <div className="rw" key={k} style={{ padding: "8px 0" }}>
                  <div className="g">
                    <b>{ORDER_RULES[k].name}</b>
                    <span className="s">{ORDER_RULES[k].says}</span>
                  </div>
                </div>
              ))}
              <div className="sec" style={{ marginTop: 6 }}>
                Window: the last {WINDOW_DAYS} days. Comparison: the {BASELINE_DAYS} days before that,
                rescaled to {WINDOW_DAYS}. Two rules firing together, or a rate four times the usual,
                makes an alert High.
              </div>
            </div>
          </section>

          <div className="note w">
            <b>What the monitor may not do.</b> It raises a question about a service and an item. It never
            names the person who ordered, never cancels, blocks or changes an order, and never stops a
            service ordering. A human closes an alert by choosing a reason from a fixed list.
          </div>

          <div className="note">
            Ordering is recorded at service level. No order is linked to a patient, and nothing here
            records why something was needed.
          </div>
        </div>
      </div>

      {current && (
        <AlertModal
          a={current}
          facility={facilityName(db.facilities, current.facility)}
          orders={orders.filter((o) => current.orderIds.includes(o.id))}
          onClose={() => setOpenId(null)}
          onAct={act}
        />
      )}
    </>
  );
}

function AlertModal({
  a, facility, orders, onClose, onAct,
}: {
  a: OrderAlert;
  facility: string;
  orders: ServiceOrder[];
  onClose: () => void;
  onAct: (id: string, status: OrderAlertStatus, note: string, reason: string | null) => void;
}) {
  const [justification, setJustification] = useState(ORDER_JUSTIFICATIONS[0]);
  const [action, setAction] = useState(ORDER_ACTIONS[0]);
  const live = alertOpen(a);

  return (
    <div className="modal on" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox">
        <div className="mh">
          <div>
            <h2>{a.service} · {a.item}</h2>
            <div className="s">{a.id}, {facility}, {a.category}</div>
          </div>
        </div>
        <div className="mb">
          <dl className="kv">
            <dt>Last {WINDOW_DAYS} days</dt>
            <dd>{a.window.orders} orders, {num(a.window.qty)} units, {fmtEUR0(a.window.spend)}</dd>
            <dt>The {BASELINE_DAYS} days before</dt>
            <dd>
              {a.baseline.orders} orders, {fmtEUR0(a.baseline.spend)}
              {a.ratio > 0 && <> · that is {(a.window.orders / a.ratio).toFixed(1)} per {WINDOW_DAYS} days</>}
            </dd>
            <dt>Above the usual rate</dt>
            <dd>{a.ratio > 0 ? `${a.ratio.toFixed(2)}x` : "no comparable history"}{a.excessSpend > 0 && <> · {fmtEUR0(a.excessSpend)} more than that rate would spend</>}</dd>
            <dt>Severity</dt>
            <dd><span className={`tag t-${SEV_TONE[a.severity]}`}><i className="dot" />{a.severity}</span></dd>
            <dt>Status</dt>
            <dd><span className={`tag t-${ORDER_ALERT_TONE[a.status]}`}><i className="dot" />{a.status}</span></dd>
            <dt>Owner</dt>
            <dd>{a.owner}</dd>
          </dl>

          <h3 style={{ margin: "12px 0 4px", fontSize: 13 }}>Why it fired</h3>
          {a.hits.map((h) => (
            <div className="rw" key={h.key} style={{ padding: "8px 0" }}>
              <div className="g">
                <b>{ORDER_RULES[h.key].name}</b>
                <span className="s">{h.detail}</span>
              </div>
              <span className="tag t-info"><i className="dot" />{h.value.toFixed(1)}× / {h.threshold}×</span>
            </div>
          ))}

          <h3 style={{ margin: "12px 0 4px", fontSize: 13 }}>The orders counted</h3>
          <div className="scrollx" style={{ maxHeight: 190 }}>
            <table>
              <thead><tr><th>Order</th><th>Placed</th><th>Quantity</th><th>Amount</th></tr></thead>
              <tbody>
                {orders.slice(0, 12).map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{d(o.placed)}</td>
                    <td>{num(o.qty)} <span className="sec">{o.unit}</span></td>
                    <td>{fmtEUR0(o.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sec" style={{ marginTop: 4 }}>
            {orders.length > 12 && <>Showing 12 of {orders.length}. </>}
            Who placed each order stays in the order record. It is not shown here and the monitor never
            reads it: the question is about the service&rsquo;s volume, not about a person.
          </div>

          {a.reason && (
            <div className="note" style={{ marginTop: 10 }}><b>Recorded reason.</b> {a.reason}</div>
          )}

          {live && (
            <div style={{ marginTop: 12 }}>
              <label className="sec" htmlFor="oa-just">Reason, if the volume is explained</label>
              <select id="oa-just" className="ctl" style={{ width: "100%", marginTop: 4 }}
                value={justification} onChange={(e) => setJustification(e.target.value)}>
                {ORDER_JUSTIFICATIONS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
              <label className="sec" htmlFor="oa-act" style={{ display: "block", marginTop: 8 }}>
                Action, if something was corrected
              </label>
              <select id="oa-act" className="ctl" style={{ width: "100%", marginTop: 4 }}
                value={action} onChange={(e) => setAction(e.target.value)}>
                {ORDER_ACTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          )}

          {a.history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {a.history.map((h, i) => (
                <div className="rw" style={{ padding: "6px 0" }} key={i}>
                  <div className="g"><b>{h[0]}</b><span className="s">{h[1]}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mf">
          <button className="btn ghost" onClick={onClose}>Close</button>
          {live && (
            <>
              {a.status === "Open" && (
                <button className="btn ghost" onClick={() => onAct(a.id, "Under review", "Sent to the service for review", null)}>
                  Ask the service
                </button>
              )}
              <button className="btn ghost" onClick={() => onAct(a.id, "Muted for 90 days", "Muted for 90 days", justification)}>
                Mute for 90 days
              </button>
              <button className="btn ghost" onClick={() => onAct(a.id, "Justified", "Closed as justified", justification)}>
                Record as justified
              </button>
              <button className="btn" onClick={() => onAct(a.id, "Action taken", "Closed, action taken", action)}>
                Record the action
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
