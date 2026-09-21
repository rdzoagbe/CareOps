/** The employer console shell: sidebar, top bar, demo banner and the module. */
import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useStore } from "@/state/store";
import { NAV } from "./nav";
import { ALL_FACILITIES, PERIODS, renOpen, daysTo, RTYPE, type PeriodKey } from "@/data";
import { num } from "@/data/format";

export function ConsoleLayout() {
  const { db, portal, renewals, scope, setFacility, setPeriod } = useStore();
  const [sideOpen, setSideOpen] = useState(false);

  const counts: Record<string, number> = {
    hr: db.employees.filter((e) => e.contractEnd && daysTo(e.contractEnd) <= 60).length,
    procurement: db.invoices.filter((i) => i.exception).length,
    workflows: db.tasks.filter((t) => t.status === "Open").length,
    compliance: db.findings.length,
    documents: db.documents.filter((d) => d.state !== "Extracted").length,
    portal:
      portal.requests.filter((r) => r.status === "New").length +
      (portal.contract.status === "Commented" ? 1 : 0) +
      portal.payvars.filter((v) => v.st === "Proposed").length,
    renewals: renewals.filter(
      (r) =>
        renOpen(r) &&
        daysTo(r.due) <= 30 &&
        (scope.facility === ALL_FACILITIES ||
          db.employees.find((e) => e.id === r.emp)?.facility === scope.facility),
    ).length,
  };

  return (
    <div className="shell">
      <aside className={`side ${sideOpen ? "on" : ""}`} id="side">
        <div className="brand">
          <div className="mark">C</div>
          <div><b>CareOps</b><small>St. Gabriel Group</small></div>
        </div>
        <div className="orgbox">
          <label htmlFor="facSide">Facility</label>
          <select id="facSide" value={scope.facility} onChange={(e) => setFacility(e.target.value)}>
            <option value={ALL_FACILITIES}>All facilities</option>
            {db.facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        {NAV.map((g) => (
          <div key={g.section}>
            <div className="navsec">{g.section}</div>
            <nav className="nav">
              {g.items.map((it) => (
                <NavLink
                  key={it.key}
                  to={`/${it.key}`}
                  className={({ isActive }) => (isActive ? "on" : "")}
                  onClick={() => setSideOpen(false)}
                >
                  <span className="ic">{it.icon}</span>
                  {it.label}
                  {counts[it.key] ? <span className="cnt">{counts[it.key]}</span> : null}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        <div className="navsec">Demo</div>
        <div style={{ padding: "0 10px", color: "#6f8aa6", fontSize: 11, lineHeight: 1.6 }}>
          Synthetic dataset · {num(db.employees.length)} employees · {num(db.invoices.length)} invoices ·{" "}
          {num(db.assets.length)} assets · {num(db.documents.length)} documents.
          <br />
          No real patient or personal data.
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="burger ctl" onClick={() => setSideOpen((v) => !v)} aria-label="Menu">☰</button>
          <div className="searchwrap">
            <span className="mag">⌕</span>
            <input type="search" placeholder="Search employees, invoices, POs, assets, documents…" aria-label="Global search" />
          </div>
          <div className="topsel">
            <select className="ctl" aria-label="Facility" value={scope.facility} onChange={(e) => setFacility(e.target.value)}>
              <option value={ALL_FACILITIES}>All facilities</option>
              {db.facilities.map((f) => <option key={f.id} value={f.id}>{f.city}</option>)}
            </select>
            <select className="ctl" aria-label="Period" value={scope.period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
              {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="who">
              <div className="ava">CL</div>
              <div><b style={{ fontSize: 12.5 }}>C. Laurent</b><small>Group operations director</small></div>
            </div>
          </div>
        </header>

        <div className="demobar">
          <span className="tag t-ai"><i className="dot" />Demo</span>
          <span>
            <b>Synthetic data only.</b> St. Gabriel Group is a fictional organisation. No real patient or
            personal data is present.
          </span>
        </div>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Shared page header used by every module. */
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="phead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="acts">{actions}</div>}
    </div>
  );
}

export const renewalLead = (type: string): number => RTYPE[type].lead;
