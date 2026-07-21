import fs from "node:fs/promises";
import path from "node:path";
import type { AdapterAction, AdapterContext, AdapterResult, ExecutionAdapter, ReconciliationResult } from "./model.js";

export class SandboxTestAdapter implements ExecutionAdapter {
  readonly id="envforge.test-sandbox"; readonly version="1.0.0";
  constructor(private readonly root:string) {}
  supports(action:AdapterAction):boolean { return action.type.length>0; }
  async execute(action:AdapterAction,context:AdapterContext):Promise<AdapterResult>{
    await fs.mkdir(this.root,{recursive:true});
    const marker=this.marker(context.idempotencyKey); const mode=String(action.inputs.testMode??"success");
    if(mode==="fail-before") return {outcome:"failed",errorClass:"retryable",receipt:{effect:"absent"}};
    await fs.writeFile(marker,`${context.runId}:${action.key}`,{flag:"wx"}).catch((error:NodeJS.ErrnoException)=>{if(error.code!=="EEXIST")throw error;});
    if(mode==="unknown-after-effect") return {outcome:"outcome-unknown",errorClass:"unknown-outcome",receipt:{marker:path.basename(marker)}};
    if(mode==="fail-after-effect") return {outcome:"failed",errorClass:"manual-intervention",receipt:{marker:path.basename(marker),effect:"present"}};
    return {outcome:"succeeded",receipt:{marker:path.basename(marker),verified:true},checkpoint:{marker:path.basename(marker),effectHash:context.idempotencyKey}};
  }
  async reconcile(_action:AdapterAction,context:AdapterContext,_receipt:Record<string,unknown>):Promise<ReconciliationResult>{
    const present=await fs.stat(this.marker(context.idempotencyKey)).then(()=>true).catch(()=>false);
    return {outcome:present?"effect-present-valid":"effect-absent",evidence:{markerPresent:present}};
  }
  async rollback(_action:AdapterAction,context:AdapterContext,_receipt:Record<string,unknown>):Promise<AdapterResult>{
    await fs.rm(this.marker(context.idempotencyKey),{force:true});
    return {outcome:"succeeded",receipt:{removed:true},checkpoint:{rolledBack:true}};
  }
  private marker(key:string):string{return path.join(this.root,Buffer.from(key).toString("hex").slice(0,96)+".marker");}
}
