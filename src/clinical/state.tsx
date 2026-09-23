/**
 * State for the care side.
 *
 * Separate provider, separate repository, separate data — it shares nothing
 * with the back-office store but the React tree it sits in.
 *
 * Two things are structural rather than conventional here:
 *
 * - every write goes through `canWrite`, so a screen cannot save what the
 *   reader's profession may not touch even if a button were rendered by
 *   mistake;
 * - `openRecord` appends to the file-access list on the way out. A read that
 *   reaches a screen has been logged, because it is the same call.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { iso, TODAY } from "@/data/dates";
import {
  buildRecordView, canWrite, contextFor, defaultClinicalRepository,
  type Administration, type CarePlanTask, type ClinicalDataset, type ClinicalRepository,
  type Clinician, type FileAccess, type Observation, type PatientRecordView, type Prescription,
} from "./data/repository";

const NOW = `${iso(TODAY)}T10:14`;

interface ClinicalValue {
  db: ClinicalDataset;
  /** The clinician the demo is signed in as. Switchable, which is the point. */
  me: Clinician;
  setMe: (id: string) => void;
  /**
   * Whether the clinician now signed in declared an emergency on this patient.
   *
   * Keyed by clinician AND patient, not by patient alone. Keyed by patient
   * alone, one person's declaration opened the record for whoever signed in
   * next — with no declaration, no warning, and no entry in the patient's
   * access list, since nothing is logged until a record is read. A shared ward
   * workstation with user switching is exactly the shape of that mistake.
   */
  hasEmergency: (patientId: string) => boolean;
  declareEmergency: (patientId: string, reason: string) => void;
  /** Reads the record under the current identity, and logs the read. */
  openRecord: (patientId: string) => PatientRecordView;
  completeTask: (taskId: string) => boolean;
  recordAdministration: (prescriptionId: string, status: Administration["status"], note: string | null) => boolean;
  addNote: (patientId: string, kind: Observation["kind"], text: string) => boolean;
  prescribe: (p: Omit<Prescription, "id" | "prescriber" | "status">) => boolean;
  toastMessage: string | null;
  toast: (m: string) => void;
}

const Ctx = createContext<ClinicalValue | null>(null);

const clone = <T,>(v: T): T => structuredClone(v);

export function ClinicalProvider({
  children,
  repository = defaultClinicalRepository,
}: {
  children: ReactNode;
  repository?: ClinicalRepository;
}) {
  const [db, setDb] = useState<ClinicalDataset | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  // Entries are `${clinicianId}|${patientId}`.
  const [emergencies, setEmergencies] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const counter = useRef(0);
  // Reads are logged as a side effect of rendering a record, so they are
  // queued and flushed after paint rather than written during render.
  const pending = useRef<FileAccess[]>([]);

  useEffect(() => {
    let cancelled = false;
    void repository.load().then((s) => {
      if (cancelled) return;
      setDb(s.db);
      setMeId(s.db.clinicians.find((c) => c.role === "Nurse")?.id ?? s.db.clinicians[0].id);
    });
    return () => { cancelled = true; };
  }, [repository]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const toast = useCallback((m: string) => setToastMessage(m), []);

  const update = useCallback((fn: (draft: ClinicalDataset) => void) => {
    setDb((d) => {
      if (!d) return d;
      const draft = clone(d);
      fn(draft);
      return draft;
    });
  }, []);

  const me = db && meId ? db.clinicians.find((c) => c.id === meId)! : null;

  const emergencyKey = (clinicianId: string, patientId: string) => `${clinicianId}|${patientId}`;

  const hasEmergency = useCallback(
    (patientId: string) => (meId ? emergencies.includes(emergencyKey(meId, patientId)) : false),
    [emergencies, meId],
  );

  const openRecord = useCallback(
    (patientId: string): PatientRecordView => {
      const ctx = contextFor(db!, meId!, patientId, hasEmergency(patientId));
      const view = buildRecordView(db!, patientId, ctx);
      if (view.read.length > 0) {
        const already = db!.access.some(
          (a) => a.patient === patientId && a.who === meId && a.at === NOW,
        );
        if (!already && !pending.current.some((a) => a.patient === patientId && a.who === meId)) {
          counter.current += 1;
          pending.current.push({
            id: "ACC-L" + String(counter.current).padStart(5, "0"),
            patient: patientId,
            at: NOW,
            who: meId!,
            role: me!.role,
            classes: view.read,
            basis: ctx.onCareTeam ? "Care team" : "Emergency access",
            reason: ctx.onCareTeam ? "Record opened during care" : "Emergency access declared",
          });
        }
      }
      return view;
    },
    [db, meId, hasEmergency, me],
  );

  // Flush the queued read entries once the render that produced them is done.
  useEffect(() => {
    if (pending.current.length === 0) return;
    const batch = pending.current;
    pending.current = [];
    update((d) => { d.access.unshift(...batch); });
  });

  const declareEmergency = useCallback(
    (patientId: string, reason: string) => {
      const key = emergencyKey(meId!, patientId);
      setEmergencies((e) => (e.includes(key) ? e : [...e, key]));
      counter.current += 1;
      update((d) => {
        d.access.unshift({
          id: "ACC-E" + String(counter.current).padStart(5, "0"),
          patient: patientId,
          at: NOW,
          who: meId!,
          role: me!.role,
          classes: [],
          basis: "Emergency access",
          reason,
        });
      });
      toast("Emergency access recorded. The patient sees this in their file-access list.");
    },
    [meId, me, update, toast],
  );

  const guard = useCallback(
    (patientId: string, cls: Parameters<typeof canWrite>[1]): boolean => {
      const ctx = contextFor(db!, meId!, patientId, hasEmergency(patientId));
      if (canWrite(ctx, cls)) return true;
      toast("Your profession does not write to this part of the record.");
      return false;
    },
    [db, meId, hasEmergency, toast],
  );

  const completeTask = useCallback(
    (taskId: string): boolean => {
      const t = db!.tasks.find((x) => x.id === taskId)!;
      if (!guard(t.patient, "careplan")) return false;
      update((d) => {
        const task = d.tasks.find((x) => x.id === taskId) as CarePlanTask | undefined;
        if (!task) return;
        task.done = true;
        task.by = meId;
      });
      return true;
    },
    [db, guard, update, meId],
  );

  const recordAdministration = useCallback(
    (prescriptionId: string, status: Administration["status"], note: string | null): boolean => {
      const p = db!.prescriptions.find((x) => x.id === prescriptionId)!;
      if (!guard(p.patient, "vitals")) return false;
      counter.current += 1;
      update((d) => {
        d.administrations.unshift({
          id: "ADM-L" + String(counter.current).padStart(5, "0"),
          prescription: prescriptionId,
          patient: p.patient,
          at: NOW,
          by: meId!,
          status,
          note,
        });
      });
      return true;
    },
    [db, guard, update, meId],
  );

  const addNote = useCallback(
    (patientId: string, kind: Observation["kind"], text: string): boolean => {
      if (!guard(patientId, kind === "Rehab" ? "rehab" : "notes")) return false;
      counter.current += 1;
      update((d) => {
        d.observations.unshift({
          id: "OBS-L" + String(counter.current).padStart(5, "0"),
          patient: patientId, at: NOW, by: meId!, role: me!.role, kind,
          temperature: null, pulse: null, systolic: null, diastolic: null, pain: null,
          text,
        });
      });
      return true;
    },
    [guard, update, meId, me],
  );

  const prescribe = useCallback(
    (p: Omit<Prescription, "id" | "prescriber" | "status">): boolean => {
      if (!guard(p.patient, "medication")) return false;
      counter.current += 1;
      update((d) => {
        d.prescriptions.unshift({
          ...p,
          id: "RX-L" + String(counter.current).padStart(5, "0"),
          prescriber: meId!,
          status: "Active",
        });
      });
      return true;
    },
    [guard, update, meId],
  );

  const value = useMemo<ClinicalValue | null>(() => {
    if (!db || !me) return null;
    return {
      db, me, setMe: setMeId, hasEmergency, declareEmergency, openRecord,
      completeTask, recordAdministration, addNote, prescribe, toastMessage, toast,
    };
  }, [
    db, me, hasEmergency, declareEmergency, openRecord, completeTask,
    recordAdministration, addNote, prescribe, toastMessage, toast,
  ]);

  if (!value) {
    return <div className="boot" role="status" aria-live="polite">Preparing the care demo dataset…</div>;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClinical(): ClinicalValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useClinical must be used inside a ClinicalProvider");
  return c;
}
