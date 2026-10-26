import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createServer} from 'vite';import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';import {reportSummary} from './lib/localReleaseGate.mjs';
const source=process.argv[2]||'assistant-acceptance-pollinations.json',report=JSON.parse(readFileSync(source,'utf8'));
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',logLevel:'error'});
try{const {evaluateAcceptance}=await vite.ssrLoadModule('/tests/fixtures/assistant/oracle.ts');
 report.recheck={sourceReport:source,checkedAt:new Date().toISOString(),liveInferenceCalls:0,oracleFingerprint:createHash('sha256').update(readFileSync('tests/fixtures/assistant/oracle.ts')).digest('hex')};
 for(const row of report.results){if(!row.reply)continue;row.originalStatus=row.status;row.originalReason=row.reason;try{evaluateAcceptance(acceptanceCases.find(c=>c.id===row.id),row.reply);row.status='passed';delete row.reason;}catch(e){row.status='failed';row.reason=e.message;}}
 report.summary=reportSummary(report.results,acceptanceCases.length);writeFileSync(source.replace(/\.json$/,'.rechecked.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
}finally{await vite.close();}