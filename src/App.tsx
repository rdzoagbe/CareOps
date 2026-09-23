/**
 * Routing, the front door, and the two workspaces.
 *
 *   /             the landing page: the three platforms and what each refuses
 *   Back office   employer console  ↔  employee phone     (src/console, src/employee)
 *   Care          clinical console  ↔  patient phone      (src/clinical, src/patient)
 *
 * They share the stage CSS and nothing else. The care side has its own data,
 * its own repository and its own access rules, because health data carries
 * obligations that payroll data does not — see docs/RULES.md. This file is the
 * composition root and the only place allowed to import from both.
 */
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { StoreProvider, useStore } from "@/state/store";
import { ConsoleLayout } from "@/console/ConsoleLayout";
import { EmployeePortalModule } from "@/console/modules/EmployeePortal";
import { RenewalsModule } from "@/console/modules/Renewals";
import { ServiceOrderingModule } from "@/console/modules/ServiceOrdering";
import { JournalModule } from "@/console/modules/Journal";
import { AccessRolesModule } from "@/console/modules/AccessRoles";
import { NotPortedModule } from "@/console/modules/NotPorted";
import { EmployeeApp } from "@/employee/EmployeeApp";
import { EmployeeStateProvider } from "@/employee/state";
import { ClinicalProvider } from "@/clinical/state";
import { DirectoryProvider } from "@/directory/state";
import { CareConsole } from "@/clinical/CareConsole";
import { PatientApp } from "@/patient/PatientApp";
import { Landing } from "@/landing/Landing";
import { PROTOTYPE_URL } from "@/config";

type Pane = "split" | "left" | "right";

export function App() {
  const location = useLocation();
  // "/" used to redirect into the employer console, which dropped a first-time
  // visitor inside one of the three platforms with no way to learn the other
  // two existed. It is its own page now, and the only one that loads neither
  // dataset — which is why StoreProvider sits below it rather than around the
  // whole tree, as it did when every route needed it.
  if (location.pathname === "/") return <Landing />;

  // It wraps BOTH workspaces, though, and not just the back office. Mounted
  // inside the back-office branch alone it would unmount on the way to Care,
  // and a user who looked at the care side and came back would silently lose
  // the journal and everything they had changed.
  const care = location.pathname.startsWith("/care") || location.pathname.startsWith("/patient");
  return (
    <StoreProvider>
      {care ? <CareWorkspace /> : <BackOffice />}
    </StoreProvider>
  );
}

/* ------------------------------------------------------------------ *
 * Back office: employer console and employee app
 * ------------------------------------------------------------------ */

function BackOffice() {
  const { view, setView, toastMessage } = useStore();
  const location = useLocation();
  const employeeRoute = location.pathname.startsWith("/app");

  // On a narrow screen the two panes cannot sit side by side.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 1100 && view === "split") setView("emp");
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [view, setView]);

  const mode = employeeRoute ? "emp" : view;

  return (
    <EmployeeStateProvider>
      <div className={`stage v-${mode}`}>
        <WorkBar
          workspace="office"
          pane={view === "split" ? "split" : view === "admin" ? "left" : "right"}
          onPane={(p) => setView(p === "split" ? "split" : p === "left" ? "admin" : "emp")}
          disabled={employeeRoute}
          leftLabel="Employer"
          rightLabel="Employee"
        />
        <Routes>
          <Route element={<ConsoleLayout />}>
            <Route path="/portal" element={<EmployeePortalModule />} />
            <Route path="/renewals" element={<RenewalsModule />} />
            <Route path="/orders" element={<ServiceOrderingModule />} />
            <Route path="/access" element={<DirectoryProvider><AccessRolesModule /></DirectoryProvider>} />
            <Route path="/security" element={<JournalModule />} />
            <Route path="/:module" element={<NotPortedModule />} />
          </Route>
          <Route path="/app" element={null} />
        </Routes>
        {mode !== "admin" && <EmployeeApp />}
        {toastMessage && <div className="toast" role="status">{toastMessage}</div>}
      </div>
    </EmployeeStateProvider>
  );
}

/* ------------------------------------------------------------------ *
 * Care: clinical console and patient app
 * ------------------------------------------------------------------ */

function CareWorkspace() {
  const location = useLocation();
  const patientRoute = location.pathname.startsWith("/patient");
  const [pane, setPane] = useState<Pane>("split");

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 1100) setPane((p) => (p === "split" ? "right" : p));
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mode = patientRoute ? "emp" : pane === "split" ? "split" : pane === "left" ? "admin" : "emp";

  return (
    <ClinicalProvider>
      <div className={`stage v-${mode}`}>
        <WorkBar
          workspace="care"
          pane={pane}
          onPane={setPane}
          disabled={patientRoute}
          leftLabel="Clinician"
          rightLabel="Patient"
        />
        {/* Both panes stay in the DOM and the stage class hides one, exactly as
            the back office does. Unmounting on resize would lose the console's
            state every time the window crossed the breakpoint. */}
        <CareConsole />
        {mode !== "admin" && <PatientApp />}
      </div>
    </ClinicalProvider>
  );
}

/* ------------------------------------------------------------------ *
 * The bar above both
 * ------------------------------------------------------------------ */

function WorkBar({
  workspace, pane, onPane, disabled, leftLabel, rightLabel,
}: {
  workspace: "office" | "care";
  pane: Pane;
  onPane: (p: Pane) => void;
  disabled: boolean;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="viewbar">
      <div>
        {/* The way back out of a workspace: there is no other route to "/" once
            you are inside one. */}
        <Link to="/" className="lp-home"><b>CareOps</b></Link>{" "}
        <span className="vsub">
          {workspace === "care"
            ? "Clinical record and patient app, fictional patients"
            : "Employer console and employee app, one shared demo dataset"}
        </span>
      </div>

      <div className="vseg" role="tablist" aria-label="Workspace">
        <WorkLink to="/portal" on={workspace === "office"}>Back office</WorkLink>
        <WorkLink to="/care" on={workspace === "care"}>Care</WorkLink>
      </div>

      <div className="vseg" role="tablist" aria-label="View">
        <button className={pane === "split" ? "on" : ""} onClick={() => onPane("split")} disabled={disabled}>
          Side by side
        </button>
        <button className={pane === "left" ? "on" : ""} onClick={() => onPane("left")} disabled={disabled}>
          {leftLabel}
        </button>
        <button className={pane === "right" ? "on" : ""} onClick={() => onPane("right")} disabled={disabled}>
          {rightLabel}
        </button>
      </div>

      <a className="vbtn" href={PROTOTYPE_URL} target="_blank" rel="noreferrer">Prototype</a>
    </div>
  );
}

function WorkLink({ to, on, children }: { to: string; on: boolean; children: ReactNode }) {
  return (
    <Link to={to} className={on ? "on" : ""} role="tab" aria-selected={on}>
      {children}
    </Link>
  );
}
