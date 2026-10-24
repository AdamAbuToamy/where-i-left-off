/** Only the synthetic CLI opts in. Normal site requests never record upstream response text. */
export function syntheticProviderDiagnostic(diagnostic,key){
 let body=String(diagnostic?.body||'');
 const secret=String(key||'').trim();
 if(secret)for(const value of new Set([secret,encodeURIComponent(secret)]))body=body.replaceAll(value,'[REDACTED]');
 body=body.replace(/AIza[A-Za-z0-9_-]{20,}/g,'[REDACTED]').replace(/gsk_[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [REDACTED]').replace(/https?:\/\/[^\s"'<>]+/g,'[URL]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]').replace(/\d{8,}/g,'[NUMBER]').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 return {status:Number(diagnostic?.status)||0,body:body.slice(0,8000),syntheticDataOnly:true};
}
