/**
 * The front door.
 *
 * Two properties are worth a test rather than a glance. The page has to name
 * all three platforms and reach each one, because the reason it exists is that
 * a visitor could not otherwise discover two of them. And it has to render
 * without either dataset — the landing page is the first thing a stranger
 * loads, and a front door that pulls the clinical snapshot has put patient
 * records in it.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "@/App";

const atRoot = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

describe("the landing page", () => {
  it("names all three platforms and who each is for", () => {
    atRoot();
    for (const [title, who] of [
      ["Administration", /HR, payroll, finance, procurement/],
      ["Care", /doctors, nurses, care assistants/],
      ["The patient", /The person being treated/],
    ] as const) {
      const card = screen.getByRole("heading", { name: title }).closest("section")!;
      expect(within(card as HTMLElement).getByText(who)).toBeInTheDocument();
    }
  });

  it("gives a way into every platform, and into the directory", () => {
    atRoot();
    const href = (name: RegExp) => screen.getByRole("link", { name }).getAttribute("href");
    expect(href(/Open the back office/)).toBe("/portal");
    expect(href(/Open the staff app/)).toBe("/app");
    expect(href(/Open the clinical record/)).toBe("/care");
    expect(href(/Open the patient's side/)).toBe("/patient");
    expect(href(/See who can open what/)).toBe("/access");
  });

  it("says for each platform what it cannot open, not only what it can", () => {
    atRoot();
    // The refusals are the product. A card listing features alone would be
    // describing a different one.
    const admin = screen.getByRole("heading", { name: "Administration" }).closest("section")! as HTMLElement;
    expect(within(admin).getByText("Never opens")).toBeInTheDocument();
    expect(within(admin).getByText("A patient record")).toBeInTheDocument();
    expect(within(admin).getByText("The medical reason for an absence")).toBeInTheDocument();

    const care = screen.getByRole("heading", { name: "Care" }).closest("section")! as HTMLElement;
    expect(within(care).getByText("Pay, contracts or personnel files")).toBeInTheDocument();
  });

  it("states the data is synthetic and that there is no decision support", () => {
    atRoot();
    expect(screen.getByText("Synthetic data only")).toBeInTheDocument();
    expect(screen.getByText("Fictional patients")).toBeInTheDocument();
    expect(screen.getByText("No clinical decision support")).toBeInTheDocument();
    expect(screen.getByText(/nothing to check against/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is medical or legal advice/)).toBeInTheDocument();
  });

  it("renders without building either dataset", () => {
    // Both providers show a "Preparing…" screen while they generate. Neither
    // may be mounted here: the front door has to paint before any of that, and
    // more importantly it must not hold data it has no business holding.
    atRoot();
    expect(screen.queryByText(/Preparing the CareOps demo dataset/)).toBeNull();
    expect(screen.queryByText(/Preparing the care demo dataset/)).toBeNull();
    // Synchronously present, with no waitFor: nothing was awaited to get here.
    expect(screen.getByRole("heading", { name: /One group, three platforms/ })).toBeInTheDocument();
  });

  it("offers the way back from inside a workspace", async () => {
    // Inside a workspace the wordmark is the only route to "/", so it is a
    // link there and plain text here, where you have already arrived.
    render(
      <MemoryRouter initialEntries={["/care"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: "CareOps" })).toHaveAttribute("href", "/");
  });
});
