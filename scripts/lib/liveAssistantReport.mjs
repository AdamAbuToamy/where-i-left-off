/** Select actual saved model replies. Never substitute authored expected actions for a missing reply. */
export function liveReplayCases(report,cases){
 if(report?.kind!=='live-provider-synthetic-data'||!['gemini','groq','cloudflare'].includes(report.provider)||!Array.isArray(report.results))throw new Error('live-report-invalid');
 const ids=new Set(),selected=[];
 for(const result of report.results){
  if(result.status!=='passed')continue;
  const testCase=cases.find(c=>c.id===result.id);
  if(!testCase||ids.has(result.id)||typeof result.reply!=='string'||!result.reply.trim())throw new Error('live-report-missing-reply');
  ids.add(result.id);selected.push({testCase,reply:result.reply});
 }
 if(!selected.length)throw new Error('live-report-no-passed-replies');
 return selected;
}
