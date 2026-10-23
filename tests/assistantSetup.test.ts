import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {expect,it} from 'vitest'
it.each([false,true])('uses direct D1 queries, preserves existing bindings and stops deployment on SQL failure=%s',(fail)=>{
 const folder=mkdtempSync(join(tmpdir(),'wilo-ai-setup-'))
 try {
  for(const path of ['scripts','push-worker/node_modules/wrangler/bin'])mkdirSync(join(folder,path),{recursive:true})
  copyFileSync('scripts/setup-free-assistant.mjs',join(folder,'scripts/setup-free-assistant.mjs'))
  copyFileSync('push-worker/assistant-schema.sql',join(folder,'push-worker/assistant-schema.sql'))
  writeFileSync(join(folder,'push-worker/wrangler.local.json'),JSON.stringify({name:'existing-worker',account_id:'same-account',vars:{KEEP:'yes'},queues:{producers:[{binding:'Q',queue:'existing'}]},d1_databases:[{binding:'DB',database_name:'existing-db',database_id:'existing-id'}]}))
  writeFileSync(join(folder,'push-worker/node_modules/wrangler/bin/wrangler.js'),`const fs=require('node:fs');fs.appendFileSync('calls.jsonl',JSON.stringify(process.argv.slice(2))+'\\n');if(process.argv.includes('d1')&&${fail})process.exit(9);`)
  const result=spawnSync(process.execPath,[join(folder,'scripts/setup-free-assistant.mjs')],{encoding:'utf8'})
  const calls=readFileSync(join(folder,'calls.jsonl'),'utf8').trim().split('\n').map((line:string)=>JSON.parse(line))
  expect(calls[0].slice(0,4)).toEqual(['d1','execute','existing-db','--remote'])
  expect(calls[0]).not.toContain('--file');const sql=calls[0][calls[0].indexOf('--command')+1];expect(sql).toContain('CREATE TABLE IF NOT EXISTS ai_budget');expect(sql).toContain('CREATE TABLE IF NOT EXISTS ai_usage')
  expect(calls).toHaveLength(fail?1:2);expect(result.status).toBe(fail?1:0)
  const config=JSON.parse(readFileSync(join(folder,'push-worker/wrangler.local.json'),'utf8'))
  expect(config.name).toBe('existing-worker');expect(config.d1_databases[0].database_id).toBe('existing-id');expect(config.queues.producers[0].queue).toBe('existing');expect(config.vars.KEEP).toBe('yes');expect(config.ai.binding).toBe('AI')
 } finally {rmSync(folder,{recursive:true,force:true})}
})
