import {safeGroqRate} from './groqLimits.mjs';
/** Translate provider exceptions to stable codes without exposing provider payloads. */
export function assistantProviderError(error){
 if(['ai-response-too-large','ai-empty-response','ai-provider-context','ai-incomplete-proposal'].includes(error?.message))return error.message;
 const status=Number(error?.status||error?.statusCode),message=String(error?.message||'');
 if(status===429||/quota|rate.?limit|too many requests|daily.*(?:allocation|limit)|free.*allocation|neurons.*(?:limit|exceed)|usage.*limit/i.test(message))return 'ai-provider-limit';
 if(status===401||status===403)return 'ai-provider-access';
 return 'ai-unavailable-or-quota';
}
export const blockedProviderCodes=new Set(['ai-provider-limit','ai-provider-access','ai-provider-context','ai-unavailable-or-quota']);

/** Only fixed diagnostic labels may leave the provider boundary. Never raw text/headers. */
export function safeProviderFailure(error){
 const statuses=Number(error?.status),codes=new Set(['invalid_api_key','invalid_request_error','json_validate_failed','model_not_found','model_decommissioned','rate_limit_exceeded','context_length_exceeded','permission_denied']);
 const params=new Set(['model','messages','response_format','max_completion_tokens','max_tokens','reasoning_effort','temperature']);
 const network=new Set(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
 return {status:Number.isInteger(statuses)&&statuses>=400&&statuses<=599?statuses:0,code:codes.has(error?.providerCode)?error.providerCode:'unclassified',parameter:params.has(error?.providerParameter)?error.providerParameter:'',network:network.has(error?.cause?.code)?error.cause.code:'',...(safeGroqRate(error?.providerRate)?{rate:safeGroqRate(error.providerRate)}:{})};
}
