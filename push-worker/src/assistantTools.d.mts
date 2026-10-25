export type NativeCall={id:string;type:'function';function:{name:string;arguments:string}};
export type WorkspaceToolInput={
 messages:{role:'user'|'assistant'|'system'|'tool';content:string|null;tool_calls?:NativeCall[]}[];
 tools:{function:{name:string;parameters:Record<string,unknown>}}[];
};
export function workspaceToolStep(choice: unknown): unknown;
export function runWorkspaceTools(data: {message:string;language:string;context:string;repair?:{reason:string;proposal:string}}, history: {role:'user'|'assistant';content:string}[], invoke:(input:WorkspaceToolInput,signal:AbortSignal)=>Promise<unknown>, timeoutMs?:number,askOptionalDetails?:boolean):Promise<string>;
