/**
 * The employee app, drawn inside a phone frame beside the console or full
 * screen on its own route.
 */
import { useStore } from "@/state/store";
import { useEmployeeState, type Tab } from "./state";
import { Onboarding } from "./Onboarding";
import { Sheets } from "./Sheets";
import { HomeTab } from "./tabs/Home";
import { ScheduleTab } from "./tabs/Schedule";
import { RequestsTab } from "./tabs/Requests";
import { DocumentsTab } from "./tabs/Documents";
import { MeTab } from "./tabs/Me";

const TABS: [Tab, string, string][] = [
  ["home", "Home", "⌂"],
  ["schedule", "Schedule", "▦"],
  ["requests", "Requests", "✉"],
  ["docs", "Documents", "▤"],
  ["me", "Me", "◎"],
];

export function EmployeeApp() {
  const { portal, relayMessage } = useStore();
  const { who, setWho } = useEmployeeState();
  const me = portal.ppl[who];

  return (
    <div className="emp-stage">
      <div className="relay">
        {relayMessage && (
          <span key={relayMessage.key} className={relayMessage.dir}>{relayMessage.text}</span>
        )}
      </div>
      <div className="ecap">{me.first}&apos;s app</div>
      <div className="frame">
        <div className="screen">
          <div className="app">
            <div className="status">
              <span>10:14</span>
              <select
                className="whosel"
                aria-label="Switch employee"
                value={who}
                onChange={(e) => setWho(e.target.value as "A" | "M")}
              >
                <option value="A">Aïcha, new hire</option>
                <option value="M">Marc, care assistant</option>
              </select>
            </div>
            {me.account !== "active" ? <Onboarding /> : <AppMain />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppMain() {
  const { portal } = useStore();
  const { who, tab, go } = useEmployeeState();
  const c = portal.contract;

  const pending: Partial<Record<Tab, number>> = {
    requests: portal.requests.filter((r) => r.who === who && r.unreadReply).length,
    docs: c.who === who && !["Signed", "Declined", "Paper requested", "Commented"].includes(c.status) ? 1 : 0,
    schedule: portal.confirm.filter((x) => x.who === who && x.st === "To confirm").length,
  };

  const Screen = {
    home: HomeTab,
    schedule: ScheduleTab,
    requests: RequestsTab,
    docs: DocumentsTab,
    me: MeTab,
  }[tab];

  return (
    <>
      <Screen />
      <div className="tabs">
        {TABS.map(([k, l, ic]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}>
            <span className="ti">{ic}</span>
            {l}
            {pending[k] ? <i className="dotr" /> : null}
          </button>
        ))}
      </div>
      <Sheets />
    </>
  );
}
