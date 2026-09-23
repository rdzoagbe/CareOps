/**
 * The care screens, and the rules a user can see on them.
 *
 * The test that matters most is the third one: the same patient, opened by two
 * professions, must not show the same record. If that ever stops being true on
 * screen, the matrix in `access.ts` has become decoration.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { App } from "@/App";
import { buildClinicalDataset } from "./data/repository";

const db = buildClinicalDataset();

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

// Two providers sit above these screens now — App wraps both workspaces in
// StoreProvider so that a trip to the care side and back does not discard what
// the user changed in the back office. Waiting on the care one alone would
// resolve while the other was still building, before anything had rendered.
const ready = () =>
  waitFor(
    () => {
      expect(screen.queryByText(/Preparing the CareOps demo dataset/)).toBeNull();
      expect(screen.queryByText(/Preparing the care demo dataset/)).toBeNull();
    },
    { timeout: 15000 },
  );

// The console signs you in within your own service, so every clinician the
// test switches to has to be a colleague of the one it starts as.
const defaultMe = db.clinicians.find((c) => c.role === "Nurse")!;

/** A colleague of this role who actually has patients, so a list is never empty. */
const workingClinician = (role: string) => {
  const c = db.clinicians.find(
    (x) =>
      x.role === role &&
      x.facility === defaultMe.facility &&
      x.service === defaultMe.service &&
      db.patients.some((p) => p.careTeam.includes(x.id)),
  );
  if (!c) throw new Error(`no ${role} with patients in ${defaultMe.service}`);
  return c;
};

const signInAs = async (id: string) => {
  await userEvent.selectOptions(screen.getByLabelText("Signed in as"), id);
};

const openFirstPatient = async () => {
  const list = screen.getByText("Ward list").closest("section")!;
  await userEvent.click(within(list).getAllByRole("row")[1]);
  return (await screen.findByRole("button", { name: "Close" })).closest(".mbox")! as HTMLElement;
};

describe("the clinical console", () => {
  it("opens on a ward list and says the patients are fictional", async () => {
    renderAt("/care");
    await ready();
    expect(await screen.findByText("Ward list")).toBeInTheDocument();
    expect(screen.getByText(/Fictional patients/)).toBeInTheDocument();
    expect(screen.getByText(/no dosage advice, no interaction checking/)).toBeInTheDocument();
  });

  it("states the two gates, and that an emergency opens only one", async () => {
    renderAt("/care");
    await ready();
    expect(await screen.findByText(/Two gates, and a read needs both/)).toBeInTheDocument();
    expect(screen.getByText(/never turns a .* into a doctor/)).toBeInTheDocument();
  });

  it("shows a different record to a care assistant than to a doctor", async () => {
    renderAt("/care");
    await ready();

    await signInAs(workingClinician("Doctor").id);
    let box = await openFirstPatient();
    expect(within(box).getByRole("button", { name: /Medication/ })).toBeInTheDocument();
    await userEvent.click(within(box).getByRole("button", { name: /Medication/ }));
    expect(within(box).getByText(/No clinical decision support/)).toBeInTheDocument();
    await userEvent.click(within(box).getByRole("button", { name: "Close" }));

    await signInAs(workingClinician("Care assistant").id);
    box = await openFirstPatient();
    await userEvent.click(within(box).getByRole("button", { name: /Medication/ }));
    expect(within(box).getByText(/Not part of your access/)).toBeInTheDocument();
    expect(within(box).getByText(/Care assistants do not have access/)).toBeInTheDocument();
  });

  it("tells a physiotherapist what they are seeing only part of", async () => {
    renderAt("/care");
    await ready();
    await signInAs(workingClinician("Physiotherapist").id);
    const box = await openFirstPatient();
    await userEvent.click(within(box).getByRole("button", { name: /Medication/ }));
    expect(within(box).getByText(/Only what bears on mobility/)).toBeInTheDocument();
  });

  it("refuses a record outside the care team and offers a recorded emergency", async () => {
    renderAt("/care");
    await ready();
    // The whole ward, so a patient this clinician does not care for is reachable.
    await userEvent.click(screen.getByRole("button", { name: "Show the whole ward" }));

    const list = screen.getByText("Ward list").closest("section")!;
    const rows = within(list).getAllByRole("row").slice(1);
    const other = rows.find((r) => within(r).queryByText("Another team"));
    expect(other).toBeDefined();
    // A patient who is not yours shows initials, never a name.
    expect(within(other!).getByText("not in your care team")).toBeInTheDocument();

    await userEvent.click(other!);
    const box = (await screen.findByRole("button", { name: "Close" })).closest(".mbox")! as HTMLElement;
    expect(within(box).getByText("You are not in this care team")).toBeInTheDocument();

    await userEvent.click(within(box).getByRole("button", { name: /Declare an emergency/ }));
    expect(within(box).getByText(/This is recorded and it is not private/)).toBeInTheDocument();
    const reason = within(box).getByLabelText("Reason") as HTMLSelectElement;
    expect(reason.tagName).toBe("SELECT");
    expect(reason.options.length).toBeGreaterThan(2);
  });
});

describe("holes found in review", () => {
  // The toggle keeps its state across an identity switch, so only click it
  // when the list is still filtered to "my patients".
  const wholeWard = async () => {
    const toggle = screen.queryByRole("button", { name: "Show the whole ward" });
    if (toggle) await userEvent.click(toggle);
    return screen.getByText("Ward list").closest("section")!;
  };

  it("does not carry one clinician's emergency over to the next one signed in", async () => {
    renderAt("/care");
    await ready();
    let list = await wholeWard();
    const other = within(list).getAllByRole("row").slice(1)
      .find((r) => within(r).queryByText("Another team"))!;
    const room = within(other).getAllByRole("cell")[0].textContent!.trim().slice(0, 9);

    await userEvent.click(other);
    let box = (await screen.findByRole("button", { name: "Close" })).closest(".mbox")! as HTMLElement;
    await userEvent.click(within(box).getByRole("button", { name: /Declare an emergency/ }));
    await userEvent.click(within(box).getByRole("button", { name: /Declare it and open/ }));
    expect(within(box).getByText(/emergency access, recorded/)).toBeInTheDocument();
    await userEvent.click(within(box).getByRole("button", { name: "Close" }));

    // Someone else sits down at the same screen. The declaration was not
    // theirs, so the record must be shut again — no name, no record, and
    // nothing written to the patient's access list on their behalf.
    await signInAs(workingClinician("Doctor").id);
    list = await wholeWard();
    const sameRow = within(list).getAllByRole("row").slice(1)
      .find((r) => r.textContent?.includes(room))!;
    expect(sameRow).toBeDefined();
    expect(within(sameRow).getByText("not in your care team")).toBeInTheDocument();

    await userEvent.click(sameRow);
    box = (await screen.findByRole("button", { name: "Close" })).closest(".mbox")! as HTMLElement;
    expect(within(box).getByText("You are not in this care team")).toBeInTheDocument();
  });

  it("refuses the file-access list to someone outside the care team", async () => {
    // This tab used to be exempt from the care-team gate, so an outsider could
    // read who treats whom — and the read was never logged, because an
    // outsider's view reads nothing.
    renderAt("/care");
    await ready();
    const list = await wholeWard();
    const other = within(list).getAllByRole("row").slice(1)
      .find((r) => within(r).queryByText("Another team"))!;
    await userEvent.click(other);

    const box = (await screen.findByRole("button", { name: "Close" })).closest(".mbox")! as HTMLElement;
    await userEvent.click(within(box).getByRole("button", { name: /Who opened this file/ }));
    expect(within(box).getByText("You are not in this care team")).toBeInTheDocument();
    expect(within(box).queryByText("Parts opened")).not.toBeInTheDocument();
  });
});

describe("the patient app", () => {
  it("shows the patient their own file-access list", async () => {
    renderAt("/patient");
    await ready();
    expect(await screen.findByRole("button", { name: /My file/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /My file/ }));
    expect(await screen.findByText("Who opened my file")).toBeInTheDocument();
    expect(screen.getByText(/What you have agreed to/)).toBeInTheDocument();
  });

  it("says plainly that the app decides nothing about medicines", async () => {
    renderAt("/patient");
    await ready();
    await userEvent.click(screen.getByRole("button", { name: /Medicines/ }));
    expect(await screen.findByText(/does not advise you on your medicines/)).toBeInTheDocument();
  });

  it("states a refusal of research contact changes nothing about care", async () => {
    renderAt("/patient");
    await ready();
    await userEvent.click(screen.getByRole("button", { name: /My file/ }));
    expect(await screen.findByText(/Refusing changes nothing about your care/)).toBeInTheDocument();
  });
});
