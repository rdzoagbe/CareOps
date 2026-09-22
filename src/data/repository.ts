/**
 * The only seam between the screens and where data comes from.
 *
 * Screens never import `seed.ts`. They ask a `CareOpsRepository` for a
 * snapshot. Phase 2 swaps `InMemoryRepository` for an HTTP-backed one talking
 * to Postgres in the EU, without touching a single screen.
 */
import { buildDataset } from "./seed";
import { applyStoryEmployees, buildPortalState, buildRenewals } from "./portal";
import { buildOrderAlerts, buildServiceOrders } from "./orders";
import type { OrderAlert, ServiceOrder } from "./orders";
import type { PortalState, Renewal } from "./portal";
import type { Dataset } from "./types";

export interface Snapshot {
  db: Dataset;
  portal: PortalState;
  renewals: Renewal[];
  orders: ServiceOrder[];
  orderAlerts: OrderAlert[];
}

export interface CareOpsRepository {
  /** Loads everything the demo needs in one round trip. */
  load(): Promise<Snapshot>;
}

/**
 * Generates the synthetic dataset in the browser. Nothing leaves the device
 * and there is no backend to configure, which is what makes the demo portable.
 */
export class InMemoryRepository implements CareOpsRepository {
  private cached: Snapshot | null = null;

  async load(): Promise<Snapshot> {
    if (this.cached) return this.cached;
    this.cached = buildSnapshot();
    return this.cached;
  }
}

/** Synchronous build, used by the tests and by the in-memory repository. */
export function buildSnapshot(): Snapshot {
  const db = buildDataset();
  applyStoryEmployees(db.employees);
  const renewals = buildRenewals(db.employees);
  const portal = buildPortalState(db);
  const orders = buildServiceOrders(db);
  const orderAlerts = buildOrderAlerts(orders, db.facilities);
  return { db, portal, renewals, orders, orderAlerts };
}

export const defaultRepository: CareOpsRepository = new InMemoryRepository();
