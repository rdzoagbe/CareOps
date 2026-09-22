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

const ready = () =>
  waitFor(() => expect(screen.queryByText(/Preparing the care demo dataset/)).toBeNull(), { timeout: 10000 });

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
