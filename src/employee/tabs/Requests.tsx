/** Requests: leave balances, the request list, and each request as a thread. */
import { useStore } from "@/state/store";
import { useEmployeeState } from "../state";
import { AppHeader } from "../Header";

export function RequestsTab() {
  const { portal, updatePortal } = useStore();
  const { who, view, setView, openSheet, go } = useEmployeeState();

  if (view && view.startsWith("RQ-")) {
    const r = portal.requests.find((x) => x.id === view);
    if (!r) return null;
    return (
      <>
        <AppHeader
          title={r.title}
          sub={`${r.type}, ${r.status === "New" ? "sent" : r.status.toLowerCase()}`}
          back={() => setView(null)}
        />
        <div className="body">
          {r.thread.map((m, i) => (
            <div className={`bubble ${m.from === "hr" ? "hr" : "me"}`} key={i}>
              <b style={{ fontSize: 12.5 }}>{m.from === "hr" ? "HR office" : "You"}, {m.at}</b>
              <br />
              {m.t}
            </div>
          ))}
          {r.status === "Done" && r.type === "Certificate" && (
            <button className="pb g" onClick={() => go("docs")}>Open my documents</button>
          )}
        </div>
      </>
    );
  }

  const mine = portal.requests.filter((r) => r.who === who);
  const open = (id: string) => {
    updatePortal((d) => {
      const r = d.requests.find((x) => x.id === id);
      if (r) r.unreadReply = false;
    });
    setView(id);
  };

  return (
    <>
      <AppHeader title="Requests" sub="Leave, certificates, questions to HR" />
      <div className="body">
        <div className="pl">Leave balances</div>
        {portal.leave[who].map((b) => (
          <div className="pc" key={b.k}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h3>{b.l}</h3>
              <b>{b.total - b.used} left</b>
            </div>
            <p>{b.note ?? `${b.used} of ${b.total} days used`}</p>
            {b.total > 0 && <div className="meter"><i style={{ width: `${(b.used / b.total) * 100}%` }} /></div>}
          </div>
        ))}

        <div className="qa" style={{ marginTop: 6 }}>
          <button onClick={() => openSheet({ t: "leave" })}><span>🌴</span>Request leave</button>
          <button onClick={() => openSheet({ t: "cert" })}><span>📄</span>Certificate</button>
          <button onClick={() => openSheet({ t: "upload" })}><span>⬆</span>Send a document</button>
          <button onClick={() => openSheet({ t: "ask" })}><span>✦</span>Ask a question</button>
        </div>

        <div className="pl">My requests</div>
        {mine.length ? (
          mine.map((r) => (
            <button className="pc" key={r.id} onClick={() => open(r.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ fontSize: 15 }}>{r.title}</h3>
                <span className={`pbadge ${r.status === "New" || r.status === "In progress" ? "o" : r.status === "Declined" ? "r" : ""}`}>
                  {r.status === "New" ? "Sent" : r.status}
                </span>
              </div>
              <p>{r.type}, {r.at}{r.unreadReply ? " · new reply" : ""}</p>
            </button>
          ))
        ) : (
          <div className="pc"><p>No request yet.</p></div>
        )}
      </div>
    </>
  );
}
