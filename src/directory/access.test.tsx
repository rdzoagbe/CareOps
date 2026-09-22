/**
 * The People & access screen.
 *
 * The test worth having here is the third one. The group operations director
 * is the most senior person in the back office, and the screen must refuse to
 * let them grant a role — not hide the button, but say why. If a demo ever
 * makes that work, the separation between administering access and using it
 * has gone.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "@/state/store";
import { App } from "@/App";

function renderAccess() {
  return render(
    <MemoryRouter initialEntries={["/access"]}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </MemoryRouter>,
  );
}

const ready = async () => {
  await waitFor(
    () => {
      expect(screen.queryByText(/Preparing the CareOps demo dataset/)).toBeNull();
      expect(screen.queryByText(/Building the directory/)).toBeNull();
    },
    { timeout: 15000 },
  );
  await screen.findByText("Directory", {}, { timeout: 15000 });
};

const openFirstPerson = async () => {
  const table = screen.getByText("Directory").closest("section")!;
  await userEvent.click(within(table).getAllByRole("row")[1]);
  return (await screen.findByRole("button", { name: "Close" })).closest(".mbox")! as HTMLElement;
};

describe("people and access", () => {
  it("names the three platforms and who each is for", async () => {
    renderAccess();
    await ready();
    expect(screen.getByText("The three platforms")).toBeInTheDocument();
    expect(screen.getByText(/The staff who run the group/)).toBeInTheDocument();
    expect(screen.getByText(/The staff who treat patients/)).toBeInTheDocument();
    expect(screen.getByText(/including the people who come in for extra shifts/)).toBeInTheDocument();
  });

  it("states that rank does not cross between platforms", async () => {
    renderAccess();
    await ready();
    expect(screen.getByText(/Being head of HR does not open a patient record/)).toBeInTheDocument();
    expect(screen.getByText(/Whoever administers access never reads content/)).toBeInTheDocument();
    expect(screen.getByText(/One entry, every platform/)).toBeInTheDocument();
  });

  it("refuses to let the operations director grant a role, and says why", async () => {
    renderAccess();
    await ready();

    const acting = screen.getByRole("combobox", { name: /Acting as/i }) as HTMLSelectElement;
    expect(acting.selectedOptions[0].textContent).toMatch(/Group operations director/);

    const box = await openFirstPerson();
    expect(within(box).getByText("This cannot be granted.")).toBeInTheDocument();
    expect(
      within(box).getByText("Only an access administrator may grant a role."),
    ).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Grant it" })).toBeDisabled();
  });

  it("lets the access administrator grant, once they are the one acting", async () => {
    renderAccess();
    await ready();

    const acting = screen.getByRole("combobox", { name: /Acting as/i }) as HTMLSelectElement;
    const adminOption = [...acting.options].find((o) => /Access administrator/.test(o.textContent ?? ""))!;
    await userEvent.selectOptions(acting, adminOption.value);

    const box = await openFirstPerson();
    expect(
      within(box).queryByText("Only an access administrator may grant a role."),
    ).not.toBeInTheDocument();
  });

  it("shows, for each role, what it opens and what it cannot", async () => {
    renderAccess();
    await ready();
    const box = await openFirstPerson();
    expect(within(box).getAllByText(/Opens:/).length).toBeGreaterThan(0);
    expect(within(box).getAllByText(/Cannot:/).length).toBeGreaterThan(0);
    expect(within(box).getByText(/Patient records/)).toBeInTheDocument();
  });

  it("can filter to exactly the people who may open a patient record", async () => {
    renderAccess();
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Can open a patient record" }));
    const table = screen.getByText("Directory").closest("section")!;
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(within(r).getByText("Care")).toBeInTheDocument();
  });
});
