import type {WorkspaceToolInput} from './assistantTools.mjs';
export const NATIVE_WORKSPACE_TOOLS:WorkspaceToolInput['tools'];
export function zonedDeadline(value:unknown,timezone:string):string;
export function nativeToolProposal(calls:unknown[],context:unknown,text?:string,language?:string):string;
export function nativeWorkspaceInput(data:{message:string;language:string;context:string;repair?:{reason:string;proposal:string};functions?:string[];outputFormat?:string;requirements?:{target:string;fields:string[]}[]},history:{role:'user'|'assistant';content:string}[]):WorkspaceToolInput;
export function runNativeWorkspace(data:{message:string;language:string;context:string;repair?:{reason:string;proposal:string};functions?:string[];outputFormat?:string;requirements?:{target:string;fields:string[]}[]},history:{role:'user'|'assistant';content:string}[],invoke:(input:WorkspaceToolInput,signal:AbortSignal)=>Promise<unknown>,timeoutMs?:number,signal?:AbortSignal):Promise<string>;