/**
 * The care side's own seam, separate from the back office's by design.
 *
 * In Phase 2 these two do not merely become different tables: they become
 * different stores under different hosting obligations, because health data
 * carries requirements that payroll data does not. Keeping the seams apart now
 * is what makes that possible without rewriting a screen.
 */
import { buildClinicalDataset } from "./seed";
import type { CareRole, ClinicalDataset } from "./types";

export interface ClinicalSnapshot {
  db: ClinicalDataset;
}

/** The clinician roster, with no patient anywhere near it. */
export interface ClinicianRecord {
  id: string;
  name: string;
  facility: string;
  service: string;
  role: CareRole;
}

export interface ClinicalRepository {
  load(): Promise<ClinicalSnapshot>;
  /**
   * Just the roster. The directory needs to know who the clinicians are and
   * nothing else, and asking for the whole snapshot to use one field of it
   * would leave every patient record resident in a back-office page. Behind an
   * HTTP implementation that difference stops being about memory and becomes
   * an HR user's browser fetching the patient record set.
   */
  loadClinicians(): Promise<ClinicianRecord[]>;
}

export class InMemoryClinicalRepository implements ClinicalRepository {
  private cached: ClinicalSnapshot | null = null;
  private roster: ClinicianRecord[] | null = null;

  async load(): Promise<ClinicalSnapshot> {
    if (this.cached) return this.cached;
    this.cached = { db: buildClinicalDataset() };
    return this.cached;
  }

  async loadClinicians(): Promise<ClinicianRecord[]> {
    if (this.roster) return this.roster;
    // Generating in the browser means the records exist for a moment whatever
    // we do; what matters is that only the roster is kept, and that the
    // interface a real backend implements cannot return more than this.
    const source = this.cached?.db.clinicians ?? buildClinicalDataset().clinicians;
    this.roster = source.map((c) => ({
      id: c.id, name: c.name, facility: c.facility, service: c.service, role: c.role,
    }));
    return this.roster;
  }
}

export const defaultClinicalRepository: ClinicalRepository = new InMemoryClinicalRepository();

export * from "./types";
export * from "./access";
export * from "./formulary";
export * from "./record";
export { buildClinicalDataset, CARE_SERVICES, CLINICAL_SEED } from "./seed";
