/**
 * First run for a new hire: invitation email, SMS check, password, and a plain
 * statement of what the employer can and cannot see before anything is signed.
 */
import { useEffect, useRef } from "react";
import { useStore } from "@/state/store";
import { useEmployeeState } from "./state";

const LANGS = ["English", "Français", "Español", "Português"];

export function Onboarding() {
  const { portal, updatePortal, logEvent, relay } = useStore();
  const { who, ob, setOb, otp, setOtp, go } = useEmployeeState();
  const me = portal.ppl[who];
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const fillOtp = () => {
    if (otp.length === 6 || timer.current) return;
    const code = "418263";
    let i = 0;
    timer.current = window.setInterval(() => {
      i += 1;
      setOtp(code.slice(0, i));
      if (i >= 6 && timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, 110);
  };

  const activate = () => {
    updatePortal((d) => {
      d.ppl[who].account = "active";
      d.flags.activated = true;
      d.contract.history.push(["Account activated with SMS check", "today, 10:14"]);
    });
    logEvent("Employee app account activated (SMS check)", portal.ppl[who].first, "Success", "Aïcha Diallo (app)");
    relay("Aïcha's account is active", "back");
    go("docs", "contract");
  };

  if (ob === "inbox") {
    return (
      <>
        <div className="hd"><div className="t"><h1>Mail</h1><p>{me.personal}</p></div></div>
        <div className="body">
          <button className="pc" onClick={() => setOb("mail")}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b style={{ fontSize: 15 }}>St. Gabriel Paris Central, HR</b>
              <span className="pbadge">09:02</span>
            </div>
            <p style={{ color: "var(--pink)", marginTop: 3 }}>Your contract is ready to review</p>
            <p>Hello Aïcha, your contract as an emergency nurse…</p>
          </button>
          <div className="lock">
            🔒 Sent from the hospital's official domain. No attachment, and it will never ask for your password.
          </div>
        </div>
      </>
    );
  }

  if (ob === "mail") {
    return (
      <>
        <div className="hd"><div className="t">
          <button className="pb q" style={{ width: "auto", padding: 0, margin: 0 }} onClick={() => setOb("inbox")}>‹ Mail</button>
        </div></div>
        <div className="body">
          <div className="mail">
            <div className="mh2">
              <b>St. Gabriel Paris Central, HR</b>
              <br />
              <span style={{ color: "var(--pmute)" }}>hr@st-gabriel.demo, today 09:02</span>
            </div>
            <div className="mb2">
              <p style={{ marginTop: 0 }}>Hello Aïcha,</p>
              <p>Your contract as an emergency nurse is ready. You can read it, ask questions about any clause and sign it in the CareOps app or on the website, whichever you prefer.</p>
              <p>Your contact: Sophie Martin, HR office, 01 •• •• •• 30.</p>
              <p style={{ color: "var(--pmute)", fontSize: 13.5 }}>
                This link is personal and expires in 7 days. Prefer to sign on paper? Just reply to this email.
              </p>
              <button className="pb" onClick={() => { setOtp(""); setOb("code"); }}>Open my space</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (ob === "code") {
    return (
      <>
        <div className="hd"><div className="t">
          <h1>Let&apos;s check it&apos;s you</h1>
          <p>We sent a code by SMS to {me.phone}, the number you gave the HR office.</p>
        </div></div>
        <div className="body">
          <div className="otp">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={otp.length > i ? "f" : ""}>{otp[i] ?? ""}</span>
            ))}
          </div>
          <button className="pb g" onClick={fillOtp}>
            {otp.length === 6 ? "Code received" : "Send me the SMS"}
          </button>
          <button className="pb" disabled={otp.length !== 6} onClick={() => setOb("pwd")}>Continue</button>
          <div className="lock">
            The code travels on a different channel from the email, so someone who intercepted the email still could not open your space.
          </div>
        </div>
      </>
    );
  }

  if (ob === "pwd") {
    return (
      <>
        <div className="hd"><div className="t">
          <h1>Create your password</h1>
          <p>At least 12 characters. Once you start, you will sign in with your hospital account instead.</p>
        </div></div>
        <div className="body">
          <input className="pin" type="password" defaultValue="••••••••••••••" aria-label="Password" />
          <div style={{ height: 10 }} />
          <input className="pin" type="password" defaultValue="••••••••••••••" aria-label="Confirm password" />
          <div className="pl">Language of the app</div>
          <div className="chipset">
            {LANGS.map((l) => (
              <button
                key={l}
                className={`chip ${me.lang === l ? "on" : ""}`}
                onClick={() => updatePortal((d) => { d.ppl[who].lang = l; })}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="pb" onClick={() => setOb("trust")}>Create my account</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="hd"><div className="t">
        <h1>Before you start</h1>
        <p>What your employer sees, and what it never will.</p>
      </div></div>
      <div className="body">
        <div className="pc">
          <h3>Your employer sees</h3>
          <p>Your administrative documents, contracts, shifts, requests and the absences you declare.</p>
        </div>
        <div className="pc">
          <h3>Your employer never sees</h3>
          <p>The medical reason for an absence, your occupational health file, your location, or anything else on your phone.</p>
        </div>
        <div className="pc">
          <h3>Our commitments</h3>
          <p>Free for you, no advertising. Your data is never sold or reused. No non-urgent notification between 21:00 and 07:00.</p>
        </div>
        <button className="pb" onClick={activate}>Got it, show my contract</button>
      </div>
    </>
  );
}
