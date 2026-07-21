import { assertNoSensitiveKeys, canonicalHash } from "../platform/foundation.js";

export type RunState = "created"|"queued"|"claimed"|"running"|"waiting"|"pause-requested"|"pausing"|"paused"|"blocked"|"recovering"|"cancel-requested"|"cancelling"|"rollback-required"|"rolling-back"|"succeeded"|"failed"|"cancelled"|"rolled-back"|"partially-rolled-back"|"attention-required";
export type AttemptOutcome = "succeeded"|"failed"|"outcome-unknown"|"cancelled";

export interface AdapterAction {
  id: string; key: string; type: string; inputs: Record<string,unknown>; resourceKeys: string[];
  verificationCheckIds: string[]; retryPolicy: { maxAttempts?: number }; rollbackDefinition?: Record<string,unknown>;
}
export interface AdapterContext { runId:string; actionRunId:string; attemptId:string; idempotencyKey:string; fencingToken:number; signal?:AbortSignal }
export interface AdapterResult { outcome:AttemptOutcome; receipt:Record<string,unknown>; checkpoint?:Record<string,unknown>; errorClass?:"retryable"|"non-retryable"|"manual-intervention"|"unknown-outcome"|"cancelled" }
export interface ReconciliationResult { outcome:"effect-absent"|"effect-present-valid"|"effect-present-invalid"|"manual-intervention"; evidence:Record<string,unknown> }
export interface ExecutionAdapter {
  readonly id:string; readonly version:string;
  supports(action:AdapterAction):boolean;
  execute(action:AdapterAction,context:AdapterContext):Promise<AdapterResult>;
  reconcile(action:AdapterAction,context:AdapterContext,receipt:Record<string,unknown>):Promise<ReconciliationResult>;
  rollback(action:AdapterAction,context:AdapterContext,receipt:Record<string,unknown>):Promise<AdapterResult>;
}

export function assertExecutionSafe(value:unknown):void { assertNoSensitiveKeys(value,"execution"); }
export function checkpointHash(payload:unknown):string { assertExecutionSafe(payload); return canonicalHash(payload); }

const transitions:Record<RunState,RunState[]>={
  created:["queued","cancelled"], queued:["claimed","cancel-requested"], claimed:["running","recovering"],
  running:["waiting","pause-requested","cancel-requested","rollback-required","succeeded","failed","recovering","attention-required"],
  waiting:["queued","pause-requested","cancel-requested","failed"], "pause-requested":["pausing"], pausing:["paused"], paused:["queued","cancel-requested"],
  blocked:["queued","failed"], recovering:["queued","blocked","rollback-required","failed"], "cancel-requested":["cancelling"], cancelling:["cancelled","rollback-required"],
  "rollback-required":["rolling-back","failed"], "rolling-back":["rolled-back","partially-rolled-back","failed"],
  succeeded:["attention-required"], failed:[], cancelled:[], "rolled-back":[], "partially-rolled-back":[], "attention-required":[]
};
export function assertRunTransition(from:RunState,to:RunState):void { if(!transitions[from]?.includes(to)) throw new Error(`Illegal ExecutionRun transition ${from} -> ${to}`); }

