/**
 * Where the two identities meet.
 *
 * This is the second composition root, after `App.tsx`. It is the only module
 * besides that one allowed to see both sides, and it is allowed because that
 * is precisely its job: a nurse is an employee record and a clinician record,
 * and something has to know they are one person.
 *
 * What comes out is deliberately thin. `staffRecord` and `careRecord` narrow
 * each side down before the directory sees it, so no salary and nothing
 * clinical enters this layer at all — `directory.test.ts` asserts that of the
 * output, which is the part that matters.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { defaultRepository } from "@/data/repository";
import { defaultClinicalRepository } from "@/clinical/data/repository";
import { iso, TODAY } from "@/data/dates";
import { buildDirectory, careRecord, staffRecord } from "./build";
import type { Directory, Person, RoleGrant } from "./types";

export const TODAY_ISO = iso(TODAY);

interface DirectoryValue {
  directory: Directory;
  today: string;
  revoke: (personId: string, index: number) => void;
  addGrant: (personId: string, grant: RoleGrant) => void;
  setStatus: (personId: string, status: Person["status"]) => void;
}

const Ctx = createContext<DirectoryValue | null>(null);

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // The roster, not the snapshot: this layer has no business holding a
    // patient record, and asking for one is how it would end up with them all.
    void Promise.all([
      defaultRepository.load(),
      defaultClinicalRepository.loadClinicians(),
    ]).then(([office, clinicians]) => {
      if (!mounted.current) return;
      setDirectory(
        buildDirectory(office.db.employees.map(staffRecord), clinicians.map(careRecord)),
      );
    });
    return () => { mounted.current = false; };
  }, []);

  const update = useCallback((fn: (d: Directory) => void) => {
    setDirectory((d) => {
      if (!d) return d;
      const draft = structuredClone(d);
      fn(draft);
      return draft;
    });
  }, []);

  const revoke = useCallback(
    (personId: string, index: number) =>
      update((d) => {
        const p = d.people.find((x) => x.id === personId);
        if (p) p.grants.splice(index, 1);
      }),
    [update],
  );

  const addGrant = useCallback(
    (personId: string, grant: RoleGrant) =>
      update((d) => {
        const p = d.people.find((x) => x.id === personId);
        if (p) p.grants.push(grant);
      }),
    [update],
  );

  const setStatus = useCallback(
    (personId: string, status: Person["status"]) =>
      update((d) => {
        const p = d.people.find((x) => x.id === personId);
        if (p) p.status = status;
      }),
    [update],
  );

  const value = useMemo<DirectoryValue | null>(
    () => (directory ? { directory, today: TODAY_ISO, revoke, addGrant, setStatus } : null),
    [directory, revoke, addGrant, setStatus],
  );

  if (!value) {
    return <div className="boot" role="status" aria-live="polite">Building the directory…</div>;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDirectory(): DirectoryValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDirectory must be used inside a DirectoryProvider");
  return c;
}
