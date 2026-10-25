import {parseAssistantReply,planAssistantProposal,resolveProposalControls} from './actions';
import type {AssistantData} from './actions';
import {checkExplicitSection} from './explicitSection';
/** The app and the live local-model test must pass the same validation. */
export function validateWorkspaceReply(message:string,data:AssistantData,text:string){
 const reply=parseAssistantReply(text);
 checkExplicitSection(message,data,reply);
 if((reply.actions.length||reply.controls?.length)&&!reply.tasks?.length)throw new Error('assistant-task-coverage');
 const changes=planAssistantProposal(data,reply.actions);
 const controls=resolveProposalControls(data,reply.actions,changes,reply.controls||[]);
 return {reply,changes,controls};
}
