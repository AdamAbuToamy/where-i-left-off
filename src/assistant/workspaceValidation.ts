import {parseAssistantReply,planAssistantProposal,resolveProposalControls} from './actions';
import type {AssistantData} from './actions';

/** The app and the live local-model test must pass the same validation. */
export function validateWorkspaceReply(_message:string,data:AssistantData,text:string){
 const reply=parseAssistantReply(text);

 if((reply.actions.length||reply.controls?.length)&&!reply.tasks?.length)throw new Error('assistant-task-coverage');
 const changes=planAssistantProposal(data,reply.actions);
 const controls=resolveProposalControls(data,reply.actions,changes,reply.controls||[]);
 return {reply,changes,controls};
}
