import {blockedProviderCodes} from '../../push-worker/src/assistantErrors.mjs';
export function providerStop(code,consecutive){return blockedProviderCodes.has(code)&&(code!=='ai-unavailable-or-quota'||consecutive>=3);}
export function acceptanceSummary(results,total){
 const done=results.filter(r=>r.status==='passed'||r.status==='failed');
 return {passed:done.filter(r=>r.status==='passed').length,failed:done.filter(r=>r.status==='failed').length,blocked:results.filter(r=>r.status==='blocked').length,notRun:total-new Set(done.map(r=>r.id)).size,slowOver20s:results.filter(r=>r.elapsedMs>20000).length};
}
