const scopes=new Set(['tokens-minute','requests-minute','tokens-day','requests-day']);
/** Derive only fixed labels and numeric limits; upstream text never leaves here. */
export function groqRateLimit(message,retryAfter){
 const text=String(message||''),scope=/tokens per day|\bTPD\b/i.test(text)?'tokens-day':/requests per day|\bRPD\b/i.test(text)?'requests-day':/tokens per minute|\bTPM\b/i.test(text)?'tokens-minute':/requests per minute|\bRPM\b/i.test(text)?'requests-minute':'unknown';
 const number=pattern=>{const match=text.match(pattern),n=match?Number(match[1].replaceAll(',','')):NaN;return Number.isFinite(n)&&n>=0&&n<=1e12?n:undefined;};
 const limit=number(/\blimit\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i),requested=number(/\brequested\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
 let seconds=Number(retryAfter);if(!retryAfter||!Number.isFinite(seconds))seconds=number(/try again in\s+([\d.]+)s/i);
 const retryAfterSeconds=Number.isFinite(seconds)&&seconds>=0&&seconds<=86400?seconds:undefined;
 return {scope,...(limit!==undefined?{limit}:{}),...(requested!==undefined?{requested}:{}),...(retryAfterSeconds!==undefined?{retryAfterSeconds}:{}),...(scope==='tokens-minute'&&limit!==undefined&&requested>limit?{oversized:true}:{})};
}
export function safeGroqRate(rate){
 if(!rate||!scopes.has(rate.scope))return undefined;
 const safe={scope:rate.scope};for(const key of ['limit','requested','retryAfterSeconds'])if(Number.isFinite(rate[key])&&rate[key]>=0&&rate[key]<=1e12)safe[key]=rate[key];
 if(safe.scope==='tokens-minute'&&safe.requested>safe.limit)safe.oversized=true;
 return safe;
}
export function minuteRetry(rate){return /-minute$/.test(rate.scope)&&!rate.oversized&&Number.isFinite(rate.retryAfterSeconds)&&rate.retryAfterSeconds>=0&&rate.retryAfterSeconds<=15;}
