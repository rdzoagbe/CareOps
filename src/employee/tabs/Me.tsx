/**
 * Me: profile, training and credentials, renewals, who opened my file, rest
 * mode, signed-in devices and data rights.
 */
import { useStore } from "@/state/store";
import { useEmployeeState } from "../state";
import { AppHeader } from "../Header";
import { daysTo, dlg, renOpen, renTitle } from "@/data";

export function MeTab() {
  const { portal, db, renewals, updatePortal, updateRenewals, logEvent, toast } = useStore();
  const { who, view, go, openSheet } = useEmployeeState();
  const me = portal.ppl[who];
  const e = db.employees[me.idx];

  const bookTraining = (index: number) => {
    const t = portal.training[who][index];
    updatePortal((d) => {
      d.training[who][index].st = "Booked";
      d.training[who][index].due = "2026-10-06";
    });
    updateRenewals((d) => {
      const rn = d.find((r) => r.who === who && r.title === t.t && renOpen(r));
      if (rn) {
        rn.status = "Booked";
        rn.due = "2026-10-06";
        rn.history.unshift(["Booked by the employee in the app", "today, 10:14"]);
      }
    });
    logEvent("Training booked in app: " + t.t, e.id, "Success", me.first + " (app)");
    toast("Booked for 6 October");
  };

  if (view === "training") {
    return (
      <>
        <AppHeader
          title="Training and credentials"
          sub="Mandatory sessions count as working time"
          back={() => go("me")}
        />
        <div className="body">
          {portal.training[who].map((t, i) => (
            <div className="pc" key={t.t}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ fontSize: 15 }}>{t.t}</h3>
                <span className={`pbadge ${t.st === "Overdue" ? "r" : t.st === "Due soon" || t.st === "To book" ? "o" : ""}`}>
                  {t.st}
                </span>
              </div>
              <p>{t.st === "Up to date" ? "Valid until" : "Due by"} {dlg(t.due)}, {t.dur}</p>
              {["Overdue", "Due soon", "To book"].includes(t.st) && (
                <button className="pb g" onClick={() => bookTraining(i)}>Book a session</button>
              )}
            </div>
          ))}
          {e.credential && (
            <>
              <div className="pl">Professional credential</div>
              <div className="pc">
                <h3 style={{ fontSize: 15 }}>{e.credential}</h3>
                <p>Valid until {dlg(e.credentialEnd!)}</p>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  const access = portal.access.filter((a) => a.who === who);
  const mine = renewals.filter((r) => r.who === who).sort((a, b) => a.due.localeCompare(b.due));
  const toBook = portal.training[who].filter((t) => t.st !== "Up to date" && t.st !== "Booked").length;

  return (
    <>
      <AppHeader title={e.name} sub={`${e.role}, ${e.dept}`} />
      <div className="body">
        <div className="pc">
          <div className="row"><div className="k"><b>Employee ID</b><span>{e.id}</span></div></div>
          <div className="row">
            <div className="k">
              <b>Contract</b>
              <span>
                {e.contract === "CDI"
                  ? "Permanent (CDI) since " + dlg(e.start)
                  : "Fixed-term (CDD) from " + dlg(e.start)}
              </span>
            </div>
          </div>
          <div className="row"><div className="k"><b>Manager</b><span>{e.manager}</span></div></div>
        </div>

        <button className="pc task" onClick={() => go("me", "training")}>
          <h3>Training and credentials</h3>
          <p>{toBook} to book or renew</p>
        </button>

        {mine.length > 0 && (
          <>
            <div className="pl">My documents and renewals</div>
            <div className="pc">
              {mine.map((r) => {
                const d = daysTo(r.due);
                const open = renOpen(r);
                return (
                  <div className="row" key={r.id}>
                    <div className="k">
                      <b>{renTitle(r)}</b>
                      <span>
                        {open ? (d < 0 ? "Was due " : "Due ") : r.status === "Verified" ? "Valid until " : ""}
                        {dlg(r.due)}
                      </span>
                    </div>
                    {!open ? (
                      <span className="pbadge">{r.status === "Verified" ? "Valid" : "Closed"}</span>
                    ) : r.status === "Requested" ? (
                      <button className="pbadge o" onClick={() => openSheet({ t: "renup", id: r.id })}>Send it</button>
                    ) : r.status === "Received" ? (
                      <span className="pbadge m">HR checking</span>
                    ) : r.status === "Booked" ? (
                      <span className="pbadge">Booked</span>
                    ) : d < 0 ? (
                      <span className="pbadge r">Overdue</span>
                    ) : d <= 30 ? (
                      <span className="pbadge o">Soon</span>
                    ) : (
                      <span className="pbadge m">Planned</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="pl">Who opened my file</div>
        <div className="pc">
          {access.length ? (
            access.map((a, i) => (
              <div className="row" key={i}>
                <div className="k"><b>{a.by}</b><span>{a.why}, {a.at}</span></div>
              </div>
            ))
          ) : (
            <p>Nobody has opened your file yet.</p>
          )}
        </div>

        <div className="pl">Notifications</div>
        <div className="pc">
          <div className="row">
            <div className="k">
              <b>Rest mode</b>
              <span>No non-urgent notification from 21:00 to 07:00 or on rest days</span>
            </div>
            <span className="pbadge">On</span>
          </div>
          <div className="row"><div className="k"><b>Language</b><span>{me.lang}</span></div></div>
        </div>

        <div className="pl">Security</div>
        <div className="pc">
          <div className="row">
            <div className="k"><b>This phone</b><span>Signed in today, 10:12</span></div>
            <span className="pbadge">Current</span>
          </div>
          <div className="row">
            <div className="k"><b>Ward computer, Emergency</b><span>Last used 18 Sep</span></div>
            <button className="pbadge m" onClick={() => toast("Signed out of that device")}>Sign out</button>
          </div>
        </div>

        <div className="pl">My data</div>
        <div className="pc">
          <p>
            You can see, correct and download your data at any time. For any question, contact the data
            protection officer.
          </p>
          <button className="pb g" onClick={() => toast("Message sent to dpo@st-gabriel.demo")}>
            Contact the data protection officer
          </button>
        </div>
      </div>
    </>
  );
}
