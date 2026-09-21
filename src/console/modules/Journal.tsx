/**
 * Security & Audit: the append-only journal of what both sides did in this
 * session, above the generated historical event log.
 */
import { useStore } from "@/state/store";
import { PageHead } from "../ConsoleLayout";
import { num } from "@/data/format";

export function JournalModule() {
  const { journal, db, scope } = useStore();
  const historical = db.events.filter(
    (e) => scope.facility === "ALL" || e.facility === scope.facility,
  );

  return (
    <>
      <PageHead
        title="Security & Audit"
        sub="An append-only record. Entries are added, never edited or removed."
      />
      <div className="grid c23">
        <section className="card">
          <div className="ch"><div>
            <h3>This session</h3>
            <div className="sub">Everything the console and the employee app did, in order</div>
          </div></div>
          <div className="scrollx">
            <table>
              <thead><tr><th>Action</th><th>Object</th><th>Actor</th><th>Result</th></tr></thead>
              <tbody>
                {journal.map((e) => (
                  <tr key={e.id}>
                    <td><b style={{ fontWeight: 500 }}>{e.action}</b><div className="sec">{e.at}</div></td>
                    <td><span className="rid">{e.object}</span></td>
                    <td>{e.actor}</td>
                    <td>
                      <span className={`tag t-${e.result === "Success" ? "ok" : "bad"}`}>
                        <i className="dot" />{e.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {journal.length === 0 && (
              <div className="empty">
                <b>Nothing yet in this session</b>
                Act on the phone or in the Employee Portal and it appears here immediately.
              </div>
            )}
          </div>
        </section>

        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <section className="card">
            <div className="ch"><div><h3>Historical log</h3></div></div>
            <div className="cb">
              <dl className="kv">
                <dt>Events in scope</dt><dd>{num(historical.length)}</dd>
                <dt>Blocked by policy</dt><dd>{num(historical.filter((e) => e.result !== "Success").length)}</dd>
                <dt>Retention</dt><dd>Append-only, 120 days in this demo</dd>
              </dl>
            </div>
          </section>
          <div className="note">
            Every opening of a personnel file also appears on the employee&apos;s own phone, under
            &ldquo;Who opened my file&rdquo;. There is no silent read.
          </div>
        </div>
      </div>
    </>
  );
}
