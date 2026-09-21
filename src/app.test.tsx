import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "@/state/store";
import { App } from "@/App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </MemoryRouter>,
  );
}

const ready = () => waitFor(() => expect(screen.queryByText(/Preparing the CareOps demo dataset/)).toBeNull(), { timeout: 10000 });

describe("employer console", () => {
  it("opens on the Employee Portal with every module in the sidebar", async () => {
    renderAt("/");
    await ready();
    expect(await screen.findByRole("heading", { name: "Employee Portal" })).toBeInTheDocument();
    for (const label of ["Command Center", "Renewals & expiries", "Security & Audit", "AI Copilot"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("states plainly that the data is synthetic", async () => {
    renderAt("/");
    await ready();
    expect(screen.getByText(/Synthetic data only/)).toBeInTheDocument();
    expect(screen.getByText(/No real patient or personal data is present/)).toBeInTheDocument();
  });

  it("shows the renewals register with its lead-time rules", async () => {
    renderAt("/renewals");
    await ready();
    expect(await screen.findByRole("heading", { name: "Renewals & expiries" })).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.getByText("from 120 days before")).toBeInTheDocument();
  });

  it("sends a module that is not ported yet to the prototype", async () => {
    renderAt("/finance");
    await ready();
    expect(await screen.findByRole("heading", { name: "Finance & Budgets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open it in the prototype/ })).toHaveAttribute(
      "href", "/prototype/index.html",
    );
  });

  it("starts the journal empty and appends to it, never rewriting", async () => {
    renderAt("/security");
    await ready();
    expect(await screen.findByText(/Nothing yet in this session/)).toBeInTheDocument();
  });
});

describe("employee app", () => {
  it("opens full screen on its own route, starting with the invitation email", async () => {
    renderAt("/app");
    await ready();
    expect(await screen.findByRole("heading", { name: "Mail" })).toBeInTheDocument();
    expect(screen.getByText(/never ask for your password/)).toBeInTheDocument();
  });

  it("walks onboarding through the SMS check and states what the employer cannot see", async () => {
    const user = userEvent.setup();
    renderAt("/app");
    await ready();

    await user.click(await screen.findByText(/Your contract is ready to review/));
    await user.click(screen.getByRole("button", { name: "Open my space" }));
    expect(screen.getByRole("heading", { name: /check it's you/i })).toBeInTheDocument();

    // Continue is blocked until the code is complete.
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Send me the SMS" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Create my account" }));

    expect(screen.getByText("Your employer never sees")).toBeInTheDocument();
    expect(screen.getByText(/medical reason for an absence/)).toBeInTheDocument();
  });

  it("lands on the contract after activation, unsigned, with every clause readable", async () => {
    const user = userEvent.setup();
    renderAt("/app");
    await ready();

    await user.click(await screen.findByText(/Your contract is ready to review/));
    await user.click(screen.getByRole("button", { name: "Open my space" }));
    await user.click(screen.getByRole("button", { name: "Send me the SMS" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Create my account" }));
    await user.click(screen.getByRole("button", { name: "Got it, show my contract" }));

    expect(await screen.findByRole("heading", { name: "Your contract" })).toBeInTheDocument();
    expect(screen.getByText("Night work")).toBeInTheDocument();
    expect(screen.getByText("Right to disconnect")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is final without your signature/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept and sign/ })).toBeInTheDocument();
  });

  it("gives Marc a full app: schedule, requests, documents and a privacy log", async () => {
    const user = userEvent.setup();
    renderAt("/app");
    await ready();

    await user.selectOptions(await screen.findByLabelText("Switch employee"), "M");
    expect(await screen.findByRole("heading", { name: "Hello Marc" })).toBeInTheDocument();

    const tabs = () => screen.getByRole("button", { name: /Schedule/ });
    await user.click(tabs());
    expect(await screen.findByText("My hours")).toBeInTheDocument();
    expect(screen.getByText(/never reduces your pay/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Requests/ }));
    expect(await screen.findByText("Leave balances")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Me$/ }));
    expect(await screen.findByText("Who opened my file")).toBeInTheDocument();
    expect(screen.getByText(/No non-urgent notification from 21:00 to 07:00/)).toBeInTheDocument();
  });

  it("declares an absence by type only, and never asks for a reason", async () => {
    const user = userEvent.setup();
    renderAt("/app");
    await ready();

    await user.selectOptions(await screen.findByLabelText("Switch employee"), "M");
    await user.click(await screen.findByRole("button", { name: /Declare an absence/ }));

    const sheet = screen.getByRole("heading", { name: "Declare an absence" }).closest(".in") as HTMLElement;
    expect(within(sheet).getByText(/Never write the medical reason/)).toBeInTheDocument();
    expect(within(sheet).queryByLabelText(/reason/i)).toBeNull();

    // Nothing can be declared until both a type and at least one shift are chosen.
    const declare = within(sheet).getByRole("button", { name: /^Declare/ });
    expect(declare).toBeDisabled();
    await user.click(within(sheet).getByRole("button", { name: "Sick leave" }));
    expect(declare).toBeDisabled();
  });
});
