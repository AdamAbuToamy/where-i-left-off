/** Translate provider exceptions to stable codes without exposing provider payloads. */
export function assistantProviderError(error){
 if(['ai-response-too-large','ai-empty-response','ai-provider-context'].includes(error?.message))return error.message;
 const status=Number(error?.status||error?.statusCode),message=String(error?.message||'');
 if(status===429||/quota|rate.?limit|too many requests|daily.*(?:allocation|limit)|free.*allocation|neurons.*(?:limit|exceed)|usage.*limit/i.test(message))return 'ai-provider-limit';
 if(status===401||status===403)return 'ai-provider-access';
 return 'ai-unavailable-or-quota';
}
export const blockedProviderCodes=new Set(['ai-provider-limit','ai-provider-access','ai-provider-context','ai-unavailable-or-quota']);
