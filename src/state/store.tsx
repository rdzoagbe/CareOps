/**
 * Demo state shared by the employer console and the employee app.
 *
 * The dataset arrives once from a `CareOpsRepository`; everything a user does
 * afterwards mutates this store, and is also appended to an in-memory journal
 * so both sides can show the same audit trail.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { defaultRepository, type CareOpsRepository, type Snapshot } from "@/data/repository";
import type { PortalState, Renewal } from "@/data/portal";
import type { OrderAlert, ServiceOrder } from "@/data/orders";
import { ALL_FACILITIES, type PeriodKey, type Scope } from "@/data/filters";
import type { Dataset } from "@/data/types";

export interface JournalEntry {
  id: string;
  action: string;
  object: string;
  result: "Success" | "Blocked by policy";
  actor: string;
  at: string;
}

export type ViewMode = "split" | "admin" | "emp";
export type RelayDirection = "go" | "back";

interface StoreValue {
  db: Dataset;
  portal: PortalState;
  renewals: Renewal[];
  /** The order ledger is read-only in the console: no action anywhere can change an order. */
  orders: ServiceOrder[];
  orderAlerts: OrderAlert[];
  journal: JournalEntry[];
  scope: Scope;
  view: ViewMode;
  toastMessage: string | null;
  relayMessage: { text: string; dir: RelayDirection; key: number } | null;
  setFacility: (id: string) => void;
  setPeriod: (p: PeriodKey) => void;
  setView: (v: ViewMode) => void;
  toast: (message: string) => void;
  relay: (text: string, dir: RelayDirection) => void;
  updatePortal: (fn: (draft: PortalState) => void) => void;
  updateRenewals: (fn: (draft: Renewal[]) => void) => void;
  updateOrderAlerts: (fn: (draft: OrderAlert[]) => void) => void;
  logEvent: (action: string, object: string, result?: JournalEntry["result"], actor?: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Structured clone that keeps the state update honest about immutability. */
const clone = <T,>(value: T): T => structuredClone(value);

export function StoreProvider({
  children,
  repository = defaultRepository,
}: {
  children: ReactNode;
  repository?: CareOpsRepository;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [portal, setPortal] = useState<PortalState | null>(null);
  const [renewals, setRenewals] = useState<Renewal[] | null>(null);
  const [orderAlerts, setOrderAlerts] = useState<OrderAlert[] | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [scope, setScope] = useState<Scope>({ facility: ALL_FACILITIES, period: "ytd" });
  const [view, setViewState] = useState<ViewMode>("split");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [relayMessage, setRelayMessage] = useState<StoreValue["relayMessage"]>(null);
  const counter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((s) => {
      if (cancelled) return;
      setSnapshot(s);
      setPortal(s.portal);
      setRenewals(s.renewals);
      setOrderAlerts(s.orderAlerts);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const toast = useCallback((message: string) => setToastMessage(message), []);

  const relay = useCallback((text: string, dir: RelayDirection) => {
    counter.current += 1;
    setRelayMessage({ text, dir, key: counter.current });
  }, []);

  const logEvent = useCallback(
    (action: string, object: string, result: JournalEntry["result"] = "Success", actor = "C. Laurent") => {
      counter.current += 1;
      setJournal((j) => [
        { id: "JRN-" + String(counter.current).padStart(4, "0"), action, object, result, actor, at: "today, 10:14" },
        ...j,
      ]);
    },
    [],
  );

  const updatePortal = useCallback((fn: (draft: PortalState) => void) => {
    setPortal((p) => {
      if (!p) return p;
      const draft = clone(p);
      fn(draft);
      return draft;
    });
  }, []);

  const updateRenewals = useCallback((fn: (draft: Renewal[]) => void) => {
    setRenewals((r) => {
      if (!r) return r;
      const draft = clone(r);
      fn(draft);
      return draft;
    });
  }, []);

  /**
   * Alerts move; orders never do. There is deliberately no `updateOrders`:
   * the over-ordering monitor can raise a question, but nothing in the console
   * can cancel or alter an order that a service placed.
   */
  const updateOrderAlerts = useCallback((fn: (draft: OrderAlert[]) => void) => {
    setOrderAlerts((a) => {
      if (!a) return a;
      const draft = clone(a);
      fn(draft);
      return draft;
    });
  }, []);

  const setFacility = useCallback((id: string) => setScope((s) => ({ ...s, facility: id })), []);
  const setPeriod = useCallback((p: PeriodKey) => setScope((s) => ({ ...s, period: p })), []);
  const setView = useCallback((v: ViewMode) => setViewState(v), []);

  const value = useMemo<StoreValue | null>(() => {
    if (!snapshot || !portal || !renewals || !orderAlerts) return null;
    return {
      db: snapshot.db, portal, renewals, orders: snapshot.orders, orderAlerts,
      journal, scope, view, toastMessage, relayMessage,
      setFacility, setPeriod, setView, toast, relay, updatePortal, updateRenewals,
      updateOrderAlerts, logEvent,
    };
  }, [
    snapshot, portal, renewals, orderAlerts, journal, scope, view, toastMessage, relayMessage,
    setFacility, setPeriod, setView, toast, relay, updatePortal, updateRenewals,
    updateOrderAlerts, logEvent,
  ]);

  if (!value) {
    return (
      <div className="boot" role="status" aria-live="polite">
        Preparing the CareOps demo dataset…
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside a StoreProvider");
  return ctx;
}
