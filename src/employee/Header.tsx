import type { ReactNode } from "react";
import { useStore } from "@/state/store";
import { useEmployeeState } from "./state";

/** The app's page header: optional back link, title, subtitle and bell. */
export function AppHeader({
  title, sub, back,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: () => void;
}) {
  const { portal } = useStore();
  const { who, openSheet } = useEmployeeState();
  const unread = (portal.notifs[who] ?? []).some((n) => !n.read);
  return (
    <div className="hd">
      <div className="t">
        {back && (
          <button className="pb q" style={{ width: "auto", padding: 0, margin: "0 0 2px" }} onClick={back}>
            ‹ Back
          </button>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <button className="bellb" aria-label="Notifications" onClick={() => openSheet({ t: "notifs" })}>
        🔔
        {unread && <i />}
      </button>
    </div>
  );
}
