/**
 * A module still served from the prototype while it is ported to React.
 * Rather than a dead end, this links straight to the working screen.
 */
import { useParams } from "react-router-dom";
import { PageHead } from "../ConsoleLayout";
import { moduleByKey } from "../nav";
import { PROTOTYPE_URL } from "@/config";

export function NotPortedModule() {
  const { module = "dashboard" } = useParams();
  const meta = moduleByKey(module);

  return (
    <>
      <PageHead
        title={meta?.label ?? "Module"}
        sub="Working in the prototype, not yet rebuilt in React"
        actions={
          <a className="btn" href={PROTOTYPE_URL} target="_blank" rel="noreferrer">
            Open it in the prototype
          </a>
        }
      />
      <section className="card">
        <div className="cb">
          <div className="note">
            <b>This module is demoable today.</b> The full prototype is served at{" "}
            <a href={PROTOTYPE_URL} target="_blank" rel="noreferrer">/prototype</a> with all
            seventeen modules working, and is being ported into React one module at a time.
          </div>
          <p style={{ marginTop: 12, color: "var(--ink-2)" }}>
            Employee Portal, Renewals &amp; expiries and Security &amp; Audit are already rebuilt here,
            because they are the ones that exchange data with the employee app. The porting order is in{" "}
            <code>docs/ROADMAP.md</code>.
          </p>
          <p style={{ marginTop: 8, color: "var(--ink-2)" }}>
            The dataset behind both is the same: it is generated once, in{" "}
            <code>src/data</code>, and read through a repository interface, so no screen has to change
            when a real database replaces it.
          </p>
        </div>
      </section>
    </>
  );
}
