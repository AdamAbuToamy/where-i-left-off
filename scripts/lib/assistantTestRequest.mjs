/** Trusted-main GitOps requests select synthetic cases only; never a model, endpoint, code, or account. */
export function assistantTestRequest(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['requestId','provider','freeProjectConfirmed','caseId','sample'].includes(k))||!/^request-[a-z0-9-]{1,70}$/.test(value.requestId||'')||value.provider!=='gemini'||value.freeProjectConfirmed!==true)throw new Error('invalid-assistant-test-request');
 const single=typeof value.caseId==='string'&&/^[a-z][a-z0-9-]{0,150}$/.test(value.caseId);
 const sample=Number.isInteger(value.sample)&&value.sample>=1&&value.sample<=200;
 if(single===sample||value.caseId!==undefined&&!single||value.sample!==undefined&&!sample)throw new Error('invalid-assistant-test-selection');
 return {requestId:value.requestId,provider:'gemini',args:[single?'--case='+value.caseId:'--sample='+value.sample,'--stop-on-failure']};
}
