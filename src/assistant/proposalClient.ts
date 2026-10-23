export type ProposalRequest={mode:string;message:string;language:string;context:string;history:{role:string;content:string}[];repair?:{reason:string;proposal:string}};
type Transport=(request:ProposalRequest,timeout:number)=>Promise<{text:string}>;
const repairable=new Set(['assistant-format','assistant-invalid','assistant-reference','assistant-fields','assistant-clock','assistant-task-coverage','assistant-alias','assistant-task-date','invalid-project','invalid-due-date','invalid-project-url','invalid-attachment-url','order-limit']);
/** Proposal generation never writes data. A single repair gets the original request and
 * snapshot, not a reduced request that could silently discard its other instructions. */
export class AssistantProposalClient {
 private readonly transport:Transport;
 private readonly pause:(ms:number)=>Promise<void>;
 constructor(transport:Transport,pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){
  this.transport=transport;this.pause=pause;
 }
 async prepare<T>(request:ProposalRequest,validate:(text:string)=>T,onRepair:()=>void):Promise<T>{
  const result=await this.transport(request,60000);
  try{return validate(result.text);}catch(error){
   // Permission, account, conflict, reminder and network failures must never be retried as model errors.
   if(!repairable.has((error as Error).message)||request.mode!=='workspace'||result.text.length>12000)throw error;
   let reason=(error as Error).message,current:unknown=error;
   for(let depth=0;depth<5&&current instanceof Error;depth++,current=current.cause)if(repairable.has(current.message))reason=current.message;
   const repaired={...request,repair:{reason,proposal:result.text}};
   if(JSON.stringify(repaired).length>65000)throw error;
   onRepair();
   // Start after receipt: token/App Check/config setup may delay the initial request.
   // Respect the server interval even then; ordinary valid requests incur no delay.
   await this.pause(3200);
   return validate((await this.transport(repaired,30000)).text);
  }
 }
}
