/**
 * Routing and the two-pane layout: the employer console on the left, the
 * employee app on the right, either side able to take the whole screen.
 */
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useStore } from "@/state/store";
import { ConsoleLayout } from "@/console/ConsoleLayout";
import { EmployeePortalModule } from "@/console/modules/EmployeePortal";
import { RenewalsModule } from "@/console/modules/Renewals";
import { JournalModule } from "@/console/modules/Journal";
import { NotPortedModule } from "@/console/modules/NotPorted";
import { EmployeeApp } from "@/employee/EmployeeApp";
import { EmployeeStateProvider } from "@/employee/state";

export function App() {
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
        <ViewBar mode={mode} employeeRoute={employeeRoute} />
        <Routes>
          <Route element={<ConsoleLayout />}>
            <Route path="/" element={<Navigate to="/portal" replace />} />
            <Route path="/portal" element={<EmployeePortalModule />} />
            <Route path="/renewals" element={<RenewalsModule />} />
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

function ViewBar({ mode, employeeRoute }: { mode: string; employeeRoute: boolean }) {
  const { setView } = useStore();
  return (
    <div className="viewbar">
      <div>
        <b>CareOps</b>{" "}
        <span className="vsub">Employer console and employee app, one shared demo dataset</span>
      </div>
      <div className="vseg" role="tablist" aria-label="View">
        <button data-v="split" className={mode === "split" ? "on" : ""} onClick={() => setView("split")} disabled={employeeRoute}>
          Side by side
        </button>
        <button data-v="admin" className={mode === "admin" ? "on" : ""} onClick={() => setView("admin")} disabled={employeeRoute}>
          Employer
        </button>
        <button data-v="emp" className={mode === "emp" ? "on" : ""} onClick={() => setView("emp")} disabled={employeeRoute}>
          Employee
        </button>
      </div>
      <a className="vbtn" href="/prototype/index.html" target="_blank" rel="noreferrer">Prototype</a>
    </div>
  );
}
