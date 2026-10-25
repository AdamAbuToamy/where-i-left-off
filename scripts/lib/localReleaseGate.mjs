import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {LOCAL_RELEASE} from '../../shared/localRelease.mjs';
export const LOCAL_REPORT_KIND='live-browser-local-model';
export function sourceFingerprint(root=process.cwd()){
 const files=[];
 const walk=dir=>{for(const e of readdirSync(join(root,dir),{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())walk(path);else if(e.isFile())files.push(path);}};
 // Hash every shipped source and domain validator, not merely the model name.
 for(const dir of ['src','shared','push-worker/src','tests/fixtures/assistant','tests/browser-local'])walk(dir);
 files.push('package.json','package-lock.json','scripts/test-assistant-browser.mjs','scripts/lib/localReleaseGate.mjs');
 const hash=createHash('sha256');
 for(const file of files.sort())hash.update(relative(root,join(root,file)).replaceAll('\\','/')).update('\0').update(readFileSync(join(root,file))).update('\0');
 return hash.digest('hex');
}
export function reportSummary(results,total){
 const unique=new Map(results.map(r=>[r.id,r]));
 const values=[...unique.values()];
 const passed=values.filter(r=>r.status==='passed').length,failed=values.filter(r=>r.status==='failed').length,blocked=values.filter(r=>r.status==='blocked').length;
 return {total,passed,failed,blocked,notRun:total-passed-failed-blocked};
}
export function inferenceEvidenceHash(report){
 return createHash('sha256').update(JSON.stringify({fingerprint:report.fingerprint,release:report.release,results:report.results})).digest('hex');
}
export function assertLocalAcceptance(report,cases,fingerprint,{requirePersistence=false}={}){
 if(report?.kind!==LOCAL_REPORT_KIND||report.provider!=='webllm'||JSON.stringify(report.release)!==JSON.stringify(LOCAL_RELEASE))throw new Error('release-model-mismatch');
 if(report.fingerprint!==fingerprint)throw new Error('release-source-mismatch');
 if(!report.browser?.adapter||!Array.isArray(report.results)||report.results.length!==cases.length)throw new Error('release-incomplete');
 const known=new Set(cases.map(c=>c.id)),seen=new Set();
 for(const result of report.results){
  if(!known.has(result.id)||seen.has(result.id))throw new Error('release-case-mismatch');seen.add(result.id);
  if(result.status!=='passed'||typeof result.reply!=='string'||!result.reply.trim()||!result.trace?.some(t=>t.stage==='local-inference'&&typeof t.text==='string'&&t.text.trim()))throw new Error('release-real-inference-required');
 }
 if(requirePersistence&&(report.persistence?.status!=='passed'||report.persistence?.cases!==cases.length||report.persistence?.evidenceHash!==inferenceEvidenceHash(report)))throw new Error('release-persistence-unverified');
 return true;
}
