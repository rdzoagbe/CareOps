/**
 * Local state for the employee app: who is signed in, which tab is open,
 * which bottom sheet is showing, and any unsent contract remarks.
 *
 * Kept separate from the shared store because none of it belongs to the
 * employer: a draft remark is the employee's until they choose to send it.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Who = "A" | "M";
export type Tab = "home" | "schedule" | "requests" | "docs" | "me";
export type OnboardStep = "inbox" | "mail" | "code" | "pwd" | "trust";

export interface Sheet {
  t: string;
  k?: string;
  d?: string;
  id?: string;
}

interface EmployeeState {
  who: Who;
  tab: Tab;
  view: string | null;
  sheet: Sheet | null;
  ob: OnboardStep;
  otp: string;
  day: string;
  /** Unsent contract remarks, keyed by clause. */
  draft: Record<string, string>;
  /** Scratch flags for the current sheet, e.g. a chosen absence type. */
  form: Record<string, unknown>;
  setWho: (w: Who) => void;
  go: (tab: Tab, view?: string | null) => void;
  setView: (v: string | null) => void;
  openSheet: (s: Sheet | null) => void;
  setOb: (s: OnboardStep) => void;
  setOtp: (v: string) => void;
  setDay: (d: string) => void;
  setDraft: (clause: string, text: string) => void;
  clearDrafts: () => void;
  setForm: (patch: Record<string, unknown>) => void;
}

const Ctx = createContext<EmployeeState | null>(null);

export function EmployeeStateProvider({ children }: { children: ReactNode }) {
  const [who, setWhoState] = useState<Who>("A");
  const [tab, setTab] = useState<Tab>("home");
  const [view, setView] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ob, setOb] = useState<OnboardStep>("inbox");
  const [otp, setOtp] = useState("");
  const [day, setDay] = useState("2026-09-21");
  const [draft, setDraftState] = useState<Record<string, string>>({});
  const [form, setFormState] = useState<Record<string, unknown>>({});

  const value = useMemo<EmployeeState>(
    () => ({
      who, tab, view, sheet, ob, otp, day, draft, form,
      setWho: (w) => {
        setWhoState(w);
        setTab("home");
        setView(null);
        setSheet(null);
        setOb("inbox");
        setOtp("");
      },
      go: (t, v = null) => {
        setTab(t);
        setView(v);
        setSheet(null);
      },
      setView,
      openSheet: (s) => {
        setSheet(s);
        setFormState({});
      },
      setOb,
      setOtp,
      setDay,
      setDraft: (clause, text) =>
        setDraftState((d) => {
          const next = { ...d };
          if (text.trim()) next[clause] = text.trim();
          else delete next[clause];
          return next;
        }),
      clearDrafts: () => setDraftState({}),
      setForm: (patch) => setFormState((f) => ({ ...f, ...patch })),
    }),
    [who, tab, view, sheet, ob, otp, day, draft, form],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmployeeState(): EmployeeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEmployeeState must be used inside an EmployeeStateProvider");
  return ctx;
}
