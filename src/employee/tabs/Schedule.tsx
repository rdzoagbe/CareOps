/** Schedule: the week, last week's confirmations, open shifts, hours, absences. */
import { useStore } from "@/state/store";
import { useEmployeeState } from "../state";
import { AppHeader } from "../Header";
import { SH, WK, dsh, dlg } from "@/data";

export function ScheduleTab() {
  const { portal, db, updatePortal, logEvent, toast, relay } = useStore();
  const { who, day, setDay, openSheet } = useEmployeeState();
  const employee = db.employees[portal.ppl[who].idx];

  if (who === "A") {
    return (
      <>
        <AppHeader title="Schedule" sub="Emergency, Paris Central" />
        <div className="body">
          <div className="pc">
            <h3>Your rota is on its way</h3>
            <p>
              You start on 1 October. Your manager, Claire Rousseau, will publish your first four weeks
              before then and you&apos;ll get a notification.
            </p>
          </div>
          <div className="pl">Booked before you start</div>
          {portal.training.A.filter((t) => t.st === "Booked").map((t) => (
            <div className="pc" key={t.t}>
              <h3 style={{ fontSize: 15 }}>{t.t}</h3>
              <p>{dlg(t.due)}, {t.dur}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  const k = portal.shifts.M[day];
  const conf = portal.confirm.filter((x) => x.who === who);
  const hrs = portal.hours.M;

  const disputePay = (pvId: string) => {
    updatePortal((d) => {
      const pv = d.payvars.find((v) => v.id === pvId);
      if (pv) pv.st = "Disputed";
    });
    logEvent("Payroll variable disputed by the employee", pvId, "Success", portal.ppl[who].first + " (app)");
    relay("Marc disputes a pay decision", "back");
    toast("HR has been told you dispute this");
  };

  return (
    <>
      <AppHeader title="Schedule" sub={`Week of 21 September, ${employee.dept}`} />
      <div className="body">
        <div className="days">
          {WK.map(([d, dn, n]) => {
            const s = portal.shifts.M[d];
            return (
              <button key={d} className={day === d ? "on" : ""} onClick={() => setDay(d)}>
                {dn}
                <b>{n}</b>
                <i style={{ background: s === "O" ? "transparent" : SH[s].c }} />
              </button>
            );
          })}
        </div>

        <div className="pc" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <i className="sw" style={{ background: SH[k].c, ...(k === "O" ? { border: "1px dashed var(--pline)" } : {}) }} />
          <div style={{ flex: 1 }}>
            <h3>{SH[k].l}</h3>
            <p>{dsh(day)}{SH[k].h ? ", " + SH[k].h : ""}</p>
          </div>
          {["D", "N"].includes(k) && (
            <button className="pbadge m" onClick={() => openSheet({ t: "swap", d: day })}>Swap</button>
          )}
        </div>

        {conf.length > 0 && (
          <>
            <div className="pl">Last week</div>
            <div className="pc">
              {conf.map((x) => (
                <div className="row" key={x.d}>
                  <i className="sw" style={{ background: SH[x.k].c }} />
                  <div className="k">
                    <b>{SH[x.k].l}, {dsh(x.d)}</b>
                    <span>{x.note || SH[x.k].h}</span>
                  </div>
                  {x.st === "To confirm" ? (
                    <button className="pbadge o" onClick={() => openSheet({ t: "confirm", d: x.d })}>Confirm</button>
                  ) : (
                    <span className="pbadge">{x.st === "Confirmed" ? "Confirmed" : "Sent"}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="lock">
              🔒 A missing confirmation never reduces your pay. The published rota stays the record.
            </div>
          </>
        )}

        <div className="pl">Open shifts you can pick up</div>
        <div className="pc">
          {portal.open.slice(0, 3).map((o) => (
            <div className="row" key={o.id}>
              <i className="sw" style={{ background: SH[o.k].c }} />
              <div className="k">
                <b>{SH[o.k].l}, {dsh(o.d)}</b>
                <span>{o.why}</span>
              </div>
              {o.taker === employee.name ? (
                <span className="pbadge">Yours</span>
              ) : o.taker ? (
                <span className="pbadge m">Taken</span>
              ) : (
                <button className="pbadge o" onClick={() => openSheet({ t: "take", id: o.id })}>Offer</button>
              )}
            </div>
          ))}
        </div>

        <div className="pl">My hours</div>
        <div className="pc">
          <h3>{hrs.worked} h worked</h3>
          <p>
            {hrs.label}: {hrs.planned} h planned, {hrs.night} h at night,{" "}
            {String(hrs.extra).replace(".", ",")} h extra
          </p>
          <div className="meter"><i style={{ width: `${(hrs.worked / hrs.planned) * 100}%` }} /></div>
        </div>

        {portal.absences.filter((a) => a.who === who).map((a) => {
          const pv = portal.payvars.find((v) => v.id === a.pv);
          return (
            <div className="pc task" key={a.id}>
              <h3>Absence on {a.dates.map(dsh).join(" and ")}</h3>
              <p>{a.type}. {a.proof ? "Certificate received." : "Certificate expected within 48 hours."}</p>
              <p style={{ marginTop: 6 }}>
                Pay:{" "}
                {pv?.st === "Validated"
                  ? "taken into account by HR for September"
                  : pv?.st === "Disputed"
                    ? "you disputed this, HR will contact you"
                    : "proposed, waiting for HR to validate"}
                .
              </p>
              {pv?.st === "Validated" && (
                <button
                  className="pb q"
                  style={{ textAlign: "left", padding: "8px 0 0", margin: 0 }}
                  onClick={() => disputePay(pv.id)}
                >
                  Dispute this decision
                </button>
              )}
            </div>
          );
        })}

        <button className="pb g" onClick={() => openSheet({ t: "absence" })}>Declare an absence</button>
      </div>
    </>
  );
}
