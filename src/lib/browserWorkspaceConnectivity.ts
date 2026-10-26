import type {WorkspaceConnectivity} from './workspacePorts';

/** Browser events are wired outside the offline business coordinator. */
export const browserWorkspaceConnectivity:WorkspaceConnectivity={
 isOnline:()=>navigator.onLine,
 whenOnline(resume){
  window.addEventListener('online',resume);
  return()=>window.removeEventListener('online',resume);
 },
};
