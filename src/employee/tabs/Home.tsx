/** Home: what needs doing, the next shift, quick actions, balance, news. */
import { useStore } from "@/state/store";
import { useEmployeeState } from "../state";
import { AppHeader } from "../Header";
import { SH, WK, renOpen, renTitle, dsh, dlg, daysTo, facilityName } from "@/data";
import type { ReactNode } from "react";

export function HomeTab() {
  const { portal, renewals, db } = useStore();
  const { who, go, openSheet, setDay } = useEmployeeState();
  const me = portal.ppl[who];
  const employee = db.employees[me.idx];
  const c = portal.contract;
  const tasks: ReactNode[] = [];

  if (c.who === who) {
    if (c.status === "Commented") {
      tasks.push(
        <div className="pc task" key="ctr">
          <h3>Remarks sent to HR</h3>
          <p>HR is reviewing your {c.comments.length} remark(s). You&apos;ll be notified when there&apos;s an answer.</p>
        </div>,
      );
    } else if (!["Signed", "Declined", "Paper requested"].includes(c.status)) {
      tasks.push(
        <button className="pc warm" key="ctr" onClick={() => go("docs", "contract")}>
          <h3>{c.versions.length > 1 ? "New version of your contract" : "Review and sign your contract"}</h3>
          <p>{c.versions.length > 1 ? "HR took your remarks into account." : "Take your time. You can ask about any clause before signing."}</p>
        </button>,
      );
    }
  }

  const conf = portal.confirm.filter((x) => x.who === who && x.st === "To confirm");
  if (conf.length) {
    tasks.push(
      <button className="pc task" key="conf" onClick={() => go("schedule")}>
        <h3>{conf.length} shift(s) to confirm</h3>
        <p>Confirm last week&apos;s hours, or report a difference.</p>
      </button>,
    );
  }

  const tr = portal.training[who].filter((t) => t.st === "Overdue" || t.st === "To book");
  if (tr.length) {
    tasks.push(
      <button className="pc task" key="tr" onClick={() => go("me", "training")}>
        <h3>{tr.length} training session(s) to book</h3>
        <p>{tr[0].t}{tr.length > 1 ? " and more" : ""}</p>
      </button>,
    );
  }

  for (const r of renewals.filter((x) => x.who === who && x.status === "Requested")) {
    tasks.push(
      <button className="pc warm" key={r.id} onClick={() => openSheet({ t: "renup", id: r.id })}>
        <h3>Send your {renTitle(r).toLowerCase()}</h3>
        <p>HR needs it before {dlg(r.due)}.</p>
      </button>,
    );
  }

  const next = WK.find(([d]) => ["D", "N"].includes(portal.shifts[who][d] ?? ""));
  const bal = portal.leave[who][0];

  return (
    <>
      <AppHeader title={`Hello ${me.first}`} sub="Sunday 20 September" />
      <div className="body">
        {tasks.length ? (
          <>
            <div className="pl">To do</div>
            {tasks}
          </>
        ) : (
          <div className="pc"><h3>You&apos;re all set</h3><p>Nothing needs your attention.</p></div>
        )}

        <div className="pl">Next shift</div>
        {next ? (
          <button
            className="pc"
            style={{ display: "flex", gap: 12, alignItems: "center" }}
            onClick={() => { setDay(next[0]); go("schedule"); }}
          >
            <i className="sw" style={{ background: SH[portal.shifts[who][next[0]]].c }} />
            <div>
              <h3>{SH[portal.shifts[who][next[0]]].l}, {dsh(next[0])}</h3>
              <p>
                {SH[portal.shifts[who][next[0]]].h}, {employee.dept},{" "}
                {facilityName(db.facilities, employee.facility).replace("St. Gabriel ", "")}
              </p>
            </div>
          </button>
        ) : (
          <div className="pc">
            <p>
              {who === "A"
                ? "Your first rota will appear before you start on 1 October."
                : "No shift planned this week."}
            </p>
          </div>
        )}

        <div className="pl">Quick actions</div>
        <div className="qa">
          <button onClick={() => openSheet({ t: "absence" })}><span>🤒</span>Declare an absence</button>
          <button onClick={() => openSheet({ t: "leave" })}><span>🌴</span>Request leave</button>
          <button onClick={() => openSheet({ t: "cert" })}><span>📄</span>Get a certificate</button>
          <button onClick={() => openSheet({ t: "ask" })}><span>✦</span>Ask a question</button>
        </div>

        <div className="pl">
          Leave balance <button onClick={() => go("requests")}>Details</button>
        </div>
        <div className="pc">
          <h3>{bal.total - bal.used} days of {bal.l.toLowerCase()} left</h3>
          <p>{bal.note ?? `${bal.used} used out of ${bal.total} this year`}</p>
          {bal.total > 0 && (
            <div className="meter"><i style={{ width: `${(bal.used / bal.total) * 100}%` }} /></div>
          )}
        </div>

        <div className="pl">News from St. Gabriel</div>
        {portal.news.map((n) => (
          <div className="pc" key={n.t}>
            <h3 style={{ fontSize: 15 }}>{n.t}</h3>
            <p>{n.b}</p>
            <p style={{ fontSize: 12.5, marginTop: 4 }}>{n.at}</p>
          </div>
        ))}

        {renewals.some((r) => r.who === who && renOpen(r) && daysTo(r.due) < 0) && (
          <div className="lock">One of your documents is past its date. HR will ask you for it in the app.</div>
        )}
      </div>
    </>
  );
}
