/**
 * Bottom sheets: every action the employee can take.
 *
 * Two rules are enforced here rather than merely described:
 * an absence is declared by type and never carries a medical reason, and the
 * pay consequence is only ever *proposed* — a person in HR decides it.
 */
import { useState } from "react";
import { useStore } from "@/state/store";
import { useEmployeeState } from "./state";
import { CLS, SH, WK, dsh, dlg, renTitle } from "@/data";
import type { ReactNode } from "react";

const ABS_TYPES = ["Sick leave", "Child sick", "Family event", "Other"];

const CHIPS: Record<string, string[]> = {
  NIGHT: ["I'd like to limit night shifts", "I can't do weekend nights"],
  SITE: ["I'd like to stay at Paris Central", "Other sites are fine with notice"],
  PAY: ["Can you detail the allowances?"],
  HOURS: ["Could I work 80%?"],
  TRIAL: ["Question about the trial period"],
  TERM: ["Is a longer term possible?"],
  POS: ["Could you send the job description?"],
  CONF: ["Question about this clause"],
  DISC: ["Question about this clause"],
};

export function Sheets() {
  const store = useStore();
  const emp = useEmployeeState();
  const { sheet, openSheet } = emp;
  if (!sheet) return null;
  return (
    <div className="sheet" onClick={(e) => { if (e.target === e.currentTarget) openSheet(null); }}>
      <div className="in">
        <div className="grab" />
        <SheetBody store={store} />
      </div>
    </div>
  );
}

function SheetBody({ store }: { store: ReturnType<typeof useStore> }) {
  const { portal, renewals, db, updatePortal, updateRenewals, logEvent, relay, toast } = store;
  const { who, sheet, openSheet, setDraft, draft, go } = useEmployeeState();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [file, setFile] = useState(false);
  const me = portal.ppl[who];
  const e = db.employees[me.idx];
  const s = sheet!;

  const close = () => openSheet(null);

  const addRequest = (type: string, title: string, body: string, flag?: "leave" | "cert") => {
    const id = "RQ-" + (3100 + portal.requests.length);
    updatePortal((d) => {
      d.requests.unshift({
        id, who, emp: e.id, type, title, status: "New", at: "today",
        thread: [{ from: "emp", t: body, at: "today, 10:14" }],
      });
      if (flag) d.flags[flag] = true;
    });
    logEvent(`${type} request sent from the app`, id, "Success", me.first + " (app)");
    relay(`${me.first}: ${title}`, "back");
    toast("Sent to HR");
    close();
    go("requests");
  };

  switch (s.t) {
    case "comment": {
      const k = s.k!;
      return (
        <>
          <h2>{CLS[k].t}</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14, margin: "0 0 8px" }}>
            Say what doesn&apos;t suit you. HR answers before anything is signed.
          </p>
          <div className="chipset">
            {(CHIPS[k] ?? []).map((c) => (
              <button key={c} className={`chip ${text === c ? "on" : ""}`} onClick={() => setText(c)}>
                {c}
              </button>
            ))}
          </div>
          <textarea
            className="pin"
            placeholder="Your remark"
            value={text || draft[k] || ""}
            onChange={(ev) => setText(ev.target.value)}
            aria-label="Your remark"
          />
          <button
            className="pb"
            disabled={!(text || draft[k])}
            onClick={() => { setDraft(k, text || draft[k] || ""); close(); }}
          >
            Keep this remark
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );
    }

    case "sign":
      return (
        <>
          <h2>Sign your contract</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14 }}>
            You are about to sign {portal.contract.type}, version {portal.contract.versions.length}.
            A signed copy lands in your documents straight away.
          </p>
          <div className="lock">
            🔒 Your signature is recorded with the exact text you saw. Nothing changes after signature
            without a new version you sign again.
          </div>
          <button
            className="pb"
            onClick={() => {
              updatePortal((d) => {
                d.contract.status = "Signed";
                d.contract.signed = { at: "today, 10:14" };
                d.contract.history.push(["Signed by the employee", "today, 10:14"]);
                d.flags.signed = true;
                d.docs[who].unshift(["Employment contract (CDD), signed", "2026-09-20"]);
              });
              logEvent("Contract signed by the employee", portal.contract.id, "Success", me.first + " (app)");
              relay("Aïcha signed her contract", "back");
              toast("Signed. It's in your documents.");
              close();
            }}
          >
            Sign now
          </button>
          <button className="pb q" onClick={close}>Not yet</button>
        </>
      );

    case "time":
    case "paper":
    case "decline": {
      const copy = {
        time: { h: "Ask for more time", p: "Tell HR you need longer. Nothing expires while you think it over — silence is never taken as acceptance.", st: null, b: "Send the request" },
        paper: { h: "Sign on paper instead", p: "The HR office will print the contract and arrange a time with you.", st: "Paper requested", b: "Ask for a paper copy" },
        decline: { h: "You don't want to sign", p: "Nothing happens automatically. HR will contact you to talk it through, and you keep a copy of everything you saw.", st: "Declined", b: "Tell HR I don't want to sign" },
      }[s.t]!;
      return (
        <>
          <h2>{copy.h}</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14 }}>{copy.p}</p>
          <button
            className={`pb ${s.t === "decline" ? "red" : ""}`}
            onClick={() => {
              if (copy.st) {
                updatePortal((d) => {
                  d.contract.status = copy.st!;
                  d.contract.history.push([copy.st! + " by the employee", "today, 10:14"]);
                });
              }
              logEvent("Contract: " + copy.h.toLowerCase(), portal.contract.id, "Success", me.first + " (app)");
              relay(copy.h, "back");
              toast("HR has been told");
              close();
            }}
          >
            {copy.b}
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );
    }

    case "explain":
      return (
        <>
          <h2>Explain my contract</h2>
          <span className="pbadge" style={{ background: "var(--asoft)", color: "var(--aink)" }}>✦ AI assisted</span>
          <p style={{ color: "var(--pmute)", fontSize: 14, marginTop: 8 }}>
            A plain-language explanation of each clause. Only the signed French version is legally binding;
            this is an aid to understanding, not the contract itself.
          </p>
          <div className="chipset">
            {["English", "Français", "Español", "Português", "العربية"].map((l) => (
              <button key={l} className={`chip ${picked === l ? "on" : ""}`} onClick={() => setPicked(l)}>
                {l}
              </button>
            ))}
          </div>
          <div className="lock">
            🔒 Nothing you read here changes the contract. Ask HR if an explanation and a clause disagree.
          </div>
          <button
            className="pb"
            disabled={!picked}
            onClick={() => { toast(`Explanation prepared in ${picked}`); close(); }}
          >
            Explain in {picked ?? "…"}
          </button>
          <button className="pb q" onClick={close}>Close</button>
        </>
      );

    case "absence": {
      const upcoming = WK.filter(([d]) => d > "2026-09-20" && ["D", "N"].includes(portal.shifts[who][d] ?? ""));
      return (
        <>
          <h2>Declare an absence</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14, margin: "0 0 4px" }}>
            Choose the type only. Never write the medical reason — your employer does not see it and does
            not need it.
          </p>
          <div className="chipset">
            {ABS_TYPES.map((t) => (
              <button key={t} className={`chip ${picked === t ? "on" : ""}`} onClick={() => setPicked(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="pl">Which shifts does it cover?</div>
          {upcoming.length ? (
            <div className="pc">
              {upcoming.map(([d]) => (
                <label className="row" key={d} style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={days.includes(d)}
                    onChange={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
                  />
                  <div className="k">
                    <b>{SH[portal.shifts[who][d]].l}, {dsh(d)}</b>
                    <span>{SH[portal.shifts[who][d]].h}</span>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="pc"><p>No upcoming shift this week.</p></div>
          )}
          <div className="lock">
            🔒 Your manager sees that you are absent and which shifts are released. The reason stays between
            you and occupational health.
          </div>
          <button
            className="pb"
            disabled={!picked || days.length === 0}
            onClick={() => {
              const pvId = "PV-" + (500 + portal.payvars.length);
              const absId = "ABS-" + (100 + portal.absences.length);
              updatePortal((d) => {
                d.absences.push({ id: absId, who, type: picked!, dates: [...days].sort(), proof: false, covered: false, pv: pvId });
                d.payvars.unshift({ id: pvId, emp: e.id, label: picked!, days: days.length, st: "Proposed", src: "Declared in app" });
                for (const day of days) d.shifts[who][day] = "X";
                for (const day of days) {
                  d.open.push({
                    id: "OS-" + (40 + d.open.length), d: day, k: "D", dept: e.dept,
                    why: "Colleague absence", status: "Open", taker: null,
                  });
                }
                d.flags.absence = true;
              });
              logEvent("Absence declared in the app (" + picked + ")", absId, "Success", me.first + " (app)");
              relay(`${me.first} declared an absence`, "back");
              toast("Declared. HR proposes the pay impact, a person decides it.");
              close();
            }}
          >
            Declare {days.length ? `${days.length} shift(s)` : ""}
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );
    }

    case "leave":
      return (
        <>
          <h2>Request leave</h2>
          <div className="chipset">
            {portal.leave[who].map((b) => (
              <button key={b.k} className={`chip ${picked === b.l ? "on" : ""}`} onClick={() => setPicked(b.l)}>
                {b.l} · {b.total - b.used} left
              </button>
            ))}
          </div>
          <div className="pl">Dates</div>
          <input className="pin" type="date" defaultValue="2026-10-26" aria-label="First day" />
          <div style={{ height: 8 }} />
          <input className="pin" type="date" defaultValue="2026-10-30" aria-label="Last day" />
          <textarea
            className="pin"
            style={{ marginTop: 8 }}
            placeholder="A note for your manager, if you want"
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            aria-label="Note"
          />
          <button
            className="pb"
            disabled={!picked}
            onClick={() => addRequest("Leave", `${picked}, 26–30 Oct`, text || `I would like to take ${picked?.toLowerCase()} from 26 to 30 October.`, "leave")}
          >
            Send to HR
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );

    case "cert":
      return (
        <>
          <h2>Get a certificate</h2>
          <div className="chipset">
            {["Employment certificate", "Proof of income", "Certificate for a rental", "Other"].map((c) => (
              <button key={c} className={`chip ${picked === c ? "on" : ""}`} onClick={() => setPicked(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="lock">🔒 A certificate states your job and dates. It never states your pay unless you ask for proof of income.</div>
          <button
            className="pb"
            disabled={!picked}
            onClick={() => addRequest("Certificate", picked!, `Could I have a ${picked?.toLowerCase()}, please?`, "cert")}
          >
            Request it
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );

    case "ask":
      return (
        <>
          <h2>Ask a question</h2>
          <span className="pbadge" style={{ background: "var(--asoft)", color: "var(--aink)" }}>✦ AI assisted</span>
          <p style={{ color: "var(--pmute)", fontSize: 14, marginTop: 8 }}>
            Answers come only from the staff handbook, with the section shown. Anything it can&apos;t answer
            goes to HR in one tap.
          </p>
          <textarea
            className="pin"
            placeholder="e.g. How is the night allowance calculated?"
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            aria-label="Your question"
          />
          <button
            className="pb"
            disabled={!text.trim()}
            onClick={() => addRequest("Question", text.slice(0, 48), text)}
          >
            Ask
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );

    case "upload":
      return (
        <>
          <h2>Send a document to HR</h2>
          <button className={`chip ${file ? "on" : ""}`} onClick={() => setFile((f) => !f)}>
            {file ? "✓ File added" : "Take a photo or choose a file"}
          </button>
          <div className="lock">🔒 Sent encrypted to HR only.</div>
          <button
            className="pb"
            disabled={!file}
            onClick={() => addRequest("Document", "Document sent to HR", "Please find the document attached.")}
          >
            Send
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );

    case "renup": {
      const r = renewals.find((x) => x.id === s.id);
      if (!r) return null;
      return (
        <>
          <h2>{renTitle(r)}</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14, margin: "0 0 8px" }}>
            HR needs the up-to-date document before {dlg(r.due)}.
          </p>
          <button className={`chip ${file ? "on" : ""}`} onClick={() => setFile((f) => !f)}>
            {file ? "✓ Photo added" : "Take a photo or choose a file"}
          </button>
          <div className="pl">New expiry date, if there is one</div>
          <input className="pin" type="date" defaultValue="2029-10-01" aria-label="New expiry date" />
          <div className="lock">
            🔒 Sent encrypted to HR only. Your manager only sees that the document is up to date.
          </div>
          <button
            className="pb"
            disabled={!file}
            onClick={() => {
              updateRenewals((d) => {
                const x = d.find((y) => y.id === r.id);
                if (x) {
                  x.status = "Received";
                  x.history.unshift(["Received from the employee in the app", "today, 10:14"]);
                }
              });
              logEvent("Renewal document received from employee", r.id, "Success", me.first + " (app)");
              relay(renTitle(r) + " received by HR", "back");
              toast("Sent to HR");
              close();
            }}
          >
            Send to HR
          </button>
          <button className="pb q" onClick={close}>Later</button>
        </>
      );
    }

    case "confirm": {
      const day = s.d!;
      return (
        <>
          <h2>Confirm {dsh(day)}</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14 }}>
            Confirm the shift as published, or report a difference such as a late finish.
          </p>
          <div className="lock">
            🔒 If you never answer, nothing is deducted. The published rota stays the record.
          </div>
          <button
            className="pb"
            onClick={() => {
              updatePortal((d) => {
                const x = d.confirm.find((y) => y.d === day && y.who === who);
                if (x) x.st = "Confirmed";
              });
              logEvent("Shift confirmed in the app", day, "Success", me.first + " (app)");
              relay("Shift confirmed", "back");
              toast("Confirmed");
              close();
            }}
          >
            Confirm as published
          </button>
          <button
            className="pb g"
            onClick={() => {
              updatePortal((d) => {
                const x = d.confirm.find((y) => y.d === day && y.who === who);
                if (x) { x.st = "Reported"; x.note = "Late finish reported, +45 min"; }
              });
              logEvent("Difference reported on a shift", day, "Success", me.first + " (app)");
              relay("Late finish reported", "back");
              toast("Reported to HR");
              close();
            }}
          >
            Report a late finish
          </button>
          <button className="pb q" onClick={close}>Later</button>
        </>
      );
    }

    case "swap":
    case "take": {
      const isTake = s.t === "take";
      const shift = isTake ? portal.open.find((o) => o.id === s.id) : null;
      return (
        <>
          <h2>{isTake ? "Offer to take this shift" : "Swap this shift"}</h2>
          <p style={{ color: "var(--pmute)", fontSize: 14 }}>
            {isTake
              ? `${shift ? SH[shift.k].l + ", " + dsh(shift.d) : ""}. Your manager confirms before it becomes yours.`
              : "Only colleagues qualified for this post can take it. Your manager confirms the swap."}
          </p>
          <button
            className="pb"
            onClick={() => {
              if (isTake && shift) {
                updatePortal((d) => {
                  const o = d.open.find((x) => x.id === shift.id);
                  if (o) { o.taker = e.name; o.status = "Offered"; }
                });
              }
              logEvent(isTake ? "Open shift offered for by employee" : "Shift swap requested", s.id ?? s.d ?? "", "Success", me.first + " (app)");
              relay(isTake ? `${me.first} offers to take a shift` : `${me.first} asks for a swap`, "back");
              toast("Sent to your manager");
              close();
            }}
          >
            Send to my manager
          </button>
          <button className="pb q" onClick={close}>Cancel</button>
        </>
      );
    }

    case "notifs": {
      const list = portal.notifs[who] ?? [];
      return (
        <>
          <h2>Notifications</h2>
          {list.length ? (
            list.map((n, i) => (
              <div className="pc" key={i}>
                <h3 style={{ fontSize: 15 }}>{n.t}</h3>
                <p>{n.b}</p>
                <p style={{ fontSize: 12.5, marginTop: 4 }}>{n.at}</p>
              </div>
            ))
          ) : (
            <div className="pc"><p>Nothing new.</p></div>
          )}
          <div className="lock">🔒 Rest mode is on: no non-urgent notification between 21:00 and 07:00.</div>
          <button
            className="pb g"
            onClick={() => {
              updatePortal((d) => { for (const n of d.notifs[who]) n.read = true; });
              close();
            }}
          >
            Mark all read
          </button>
        </>
      );
    }

    default:
      return <Unknown t={s.t} onClose={close} />;
  }
}

function Unknown({ t, onClose }: { t: string; onClose: () => void }): ReactNode {
  return (
    <>
      <h2>{t}</h2>
      <p style={{ color: "var(--pmute)", fontSize: 14 }}>Not part of this demo yet.</p>
      <button className="pb q" onClick={onClose}>Close</button>
    </>
  );
}
