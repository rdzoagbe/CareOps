/**
 * Documents: the record, and the contract the employee reads, comments on and
 * signs. Silence is never acceptance — an unread or unanswered contract simply
 * stays pending.
 */
import { useStore } from "@/state/store";
import { useEmployeeState } from "../state";
import { AppHeader } from "../Header";
import { CLS, CLS_ORDER, clsText, dlg } from "@/data";

export function DocumentsTab() {
  const { portal, toast } = useStore();
  const { who, view, go, openSheet } = useEmployeeState();
  const c = portal.contract;

  if (view === "contract" && c.who === who) return <Contract />;

  const pending = c.who === who && c.status !== "Signed";
  return (
    <>
      <AppHeader title="Documents" sub="Your record, available at any time" />
      <div className="body">
        {pending && (
          <button className="pc warm" onClick={() => go("docs", "contract")}>
            <h3>Contract in progress</h3>
            <p>{c.type}, {c.status.toLowerCase()}</p>
          </button>
        )}

        <div className="pl">In my record</div>
        <div className="pc">
          {portal.docs[who].map((d) => (
            <div className="row" key={d[0]}>
              <div className="k"><b>{d[0]}</b><span>{dlg(d[1])}</span></div>
              <span className="pbadge m">PDF</span>
            </div>
          ))}
        </div>

        <div className="pl">Payslips</div>
        <div className="pc">
          <p>
            Your payslips are issued by the payroll service and stay available in the payroll portal.
            CareOps does not store them.
          </p>
          <button className="pb g" onClick={() => toast("Opens the payroll portal in the real product")}>
            Open the payroll portal
          </button>
        </div>

        <button className="pb g" onClick={() => openSheet({ t: "upload" })}>Send a document to HR</button>
        <button className="pb q" onClick={() => toast("Archive of your documents prepared")}>
          Download all my documents
        </button>
      </div>
    </>
  );
}

function Contract() {
  const { portal, updatePortal, logEvent, relay, toast } = useStore();
  const { who, draft, clearDrafts, go, openSheet } = useEmployeeState();
  const c = portal.contract;
  const v = c.versions[c.versions.length - 1];
  const signed = c.status === "Signed";
  const locked = signed || c.status === "Commented";
  const remarkCount = Object.keys(draft).length;

  const sendRemarks = () => {
    const comments = Object.entries(draft).map(([k, t]) => ({ c: k, t }));
    updatePortal((d) => {
      d.contract.comments = comments;
      d.contract.status = "Commented";
      d.contract.history.push([`${comments.length} remark(s) sent by the employee`, "today, 10:14"]);
      d.flags.commented = true;
    });
    logEvent("Contract remarks sent by the employee", c.id, "Success", portal.ppl[who].first + " (app)");
    clearDrafts();
    relay(`${comments.length} remark(s) sent to HR`, "back");
    toast("Your remarks are with HR");
    go("home");
  };

  return (
    <>
      <AppHeader
        title="Your contract"
        sub={
          <>
            {c.type}, version {v.n}{" "}
            <span className={`pbadge ${signed ? "" : "o"}`}>
              {signed ? "Signed" : c.status === "Commented" ? "Under discussion" : "To sign"}
            </span>
          </>
        }
        back={() => go("docs")}
      />
      <div className="body">
        <button className="pb g" style={{ margin: "0 0 10px" }} onClick={() => openSheet({ t: "explain" })}>
          ✦ Explain my contract, or read it in another language
        </button>

        {!locked && (
          <div className="pc" style={{ background: "var(--asoft)", borderColor: "transparent" }}>
            <p style={{ color: "var(--aink)" }}>
              Read each clause. If something doesn&apos;t suit you, comment on it: HR answers before anything
              is signed. Nothing is final without your signature.
            </p>
          </div>
        )}

        <div className="pc" style={{ paddingTop: 2, paddingBottom: 2 }}>
          {CLS_ORDER.map((k) => {
            const changed = c.versions.length > 1 && c.versions[0].clauses[k] !== v.clauses[k];
            const why = changed ? c.changedWhy?.find((x) => x.k === k) : null;
            const sent = c.comments.find((x) => x.c === k);
            return (
              <div className="pclause" key={k}>
                <h4>
                  {CLS[k].t}
                  {!locked && (
                    <button
                      className="pbadge m"
                      style={{ fontSize: 12.5 }}
                      onClick={() => openSheet({ t: "comment", k })}
                    >
                      {draft[k] ? "Edit" : "Comment"}
                    </button>
                  )}
                </h4>
                <p>{clsText(v.clauses[k]).x}</p>
                {changed && (
                  <div className="chg"><b>Changed at your request.</b> {why?.why ?? ""}</div>
                )}
                {draft[k] ? (
                  <div className="mine"><b>Your remark:</b> {draft[k]}</div>
                ) : sent ? (
                  <div className="mine"><b>Sent:</b> {sent.t}</div>
                ) : null}
              </div>
            );
          })}
        </div>

        {signed ? (
          <div className="pc" style={{ borderColor: "var(--a)" }}>
            <h3>✓ Contract signed</h3>
            <p>
              Signed today at {c.signed?.at.split(", ").pop()}. It&apos;s in your documents and you can
              download it at any time.
            </p>
          </div>
        ) : c.status === "Commented" ? (
          <div className="pc"><p>Your remarks are with HR. You&apos;ll get a notification as soon as there&apos;s an answer.</p></div>
        ) : c.status === "Paper requested" ? (
          <div className="pc"><p>You asked to sign on paper. The HR office will contact you.</p></div>
        ) : c.status === "Declined" ? (
          <div className="pc"><p>You chose not to sign. HR will get in touch to talk it through.</p></div>
        ) : (
          <>
            {remarkCount ? (
              <button className="pb" onClick={sendRemarks}>
                Send my {remarkCount} remark(s) to HR
              </button>
            ) : (
              <button className="pb" onClick={() => openSheet({ t: "sign" })}>
                Accept and sign{c.versions.length > 1 ? " version " + v.n : ""}
              </button>
            )}
            <button className="pb g" onClick={() => openSheet({ t: "time" })}>Ask for more time</button>
            <button className="pb q" onClick={() => openSheet({ t: "paper" })}>I&apos;d rather sign on paper</button>
            <button className="pb q" style={{ color: "#9b2c25" }} onClick={() => openSheet({ t: "decline" })}>
              I don&apos;t want to sign
            </button>
          </>
        )}
      </div>
    </>
  );
}
