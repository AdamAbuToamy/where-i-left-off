import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readIntents,INTENT_FORMAT,INTENT_SYSTEM} from './src/assistantIntents.mjs';
import {assistantProviderError} from './src/assistantErrors.mjs';
import {acceptanceCases} from '../tests/fixtures/assistant/corpus.mjs';
const records=JSON.parse(readFileSync(new URL('../tests/fixtures/assistant/recorded-inventories.json',import.meta.url),'utf8'));
const unresolved=new Set(['new-course-lesson-ar','ten-cards-ar','ten-cards-he','update-projects-links-en','update-projects-links-he','update-projects-archivedAt-ar','update-courses-notes-en']);
for(const record of records)test(`captured provider inventory: ${record.id}`,()=>{
 const text=typeof record.inventory==='string'?record.inventory:JSON.stringify(record.inventory),message=acceptanceCases.find(c=>c.id===record.id).message;
 if(unresolved.has(record.id))assert.throws(()=>readIntents(text,message),/ai-intent-format/);
 else assert.ok(readIntents(text,message).length);
});
test('new wire contract uses typed expected values, not JSON encoded inside strings',()=>{
 const requirements=INTENT_FORMAT.json_schema.properties.intents.items.properties.requirements.items;
 assert.ok(requirements.properties.expected.anyOf);assert.equal(requirements.properties.expectedJson,undefined);assert.match(INTENT_SYSTEM,/kind=deadline/);
});
for(const name of ['123','true','null','عمار','a "quoted" title'])test(`typed text remains literal: ${name}`,()=>{
 const intent={title:'Name',source:'Rename',subject:'card',recordId:'card',outcome:'proposed',requirements:[{target:'projects',operation:'update',field:'name',expected:name,match:'equals'}]};
 assert.equal(readIntents(JSON.stringify({intents:[intent]}),'Rename')[0].requirements[0].expected,name);
});
for(const message of ['You have used up your daily free allocation of neurons','Daily allocation exceeded','quota exceeded','rate limit'])test(`provider quota classification: ${message}`,()=>assert.equal(assistantProviderError(new Error(message)),'ai-provider-limit'));
test('network and access failures remain distinct from quota',()=>{
 assert.equal(assistantProviderError(new Error('connection reset')),'ai-unavailable-or-quota');assert.equal(assistantProviderError({status:403}),'ai-provider-access');
});
test('a malformed inventory gets one bounded repair before proposal generation',async()=>{
 const {assistant}=await import('./src/assistant.mjs'),{database}=await import('./test-db.mjs');let calls=0;
 const env={DB:database(),ASSISTANT_FREE_ONLY:'true',AI:{run:async()=>{calls++;return calls===1?{response:'!!!!'}:calls===2?{response:{intents:[{title:'Answer',source:'Hi',subject:'answer',recordId:'',outcome:'answer',requirements:[]}]}}:{response:{text:'Hello',actions:[],controls:[],files:[],tasks:[]}};}}};
 env.DB.sqlite.prepare("INSERT INTO accounts(uid,prefs) VALUES('alice','{}')").run();
 assert.equal(JSON.parse((await assistant(env,'alice',{mode:'workspace',message:'Hi',language:'en'})).text).text,'Hello');assert.equal(calls,3);
});
