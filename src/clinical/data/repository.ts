/**
 * The care side's own seam, separate from the back office's by design.
 *
 * In Phase 2 these two do not merely become different tables: they become
 * different stores under different hosting obligations, because health data
 * carries requirements that payroll data does not. Keeping the seams apart now
 * is what makes that possible without rewriting a screen.
 */
import { buildClinicalDataset } from "./seed";
import type { ClinicalDataset } from "./types";

export interface ClinicalSnapshot {
  db: ClinicalDataset;
}

export interface ClinicalRepository {
  load(): Promise<ClinicalSnapshot>;
}

export class InMemoryClinicalRepository implements ClinicalRepository {
  private cached: ClinicalSnapshot | null = null;

  async load(): Promise<ClinicalSnapshot> {
    if (this.cached) return this.cached;
    this.cached = { db: buildClinicalDataset() };
    return this.cached;
  }
}

export const defaultClinicalRepository: ClinicalRepository = new InMemoryClinicalRepository();

export * from "./types";
export * from "./access";
export * from "./formulary";
export * from "./record";
export { buildClinicalDataset, CARE_SERVICES, CLINICAL_SEED } from "./seed";
