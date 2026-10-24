import {test} from 'node:test';import assert from 'node:assert/strict';
import {clarifyMinimalCreation} from './src/assistantClarification.mjs';
const plan=values=>({text:'Review',actions:[{target:'projects',action:'create',id:'new',values}],controls:[],files:[],tasks:[{title:'Add card',outcome:'proposed',actionIndexes:[0],controlIndexes:[],detail:''}]});
test('minimal creation asks optional choices without preserving a guessed section or offering Apply',()=>{
 const result=clarifyMinimalCreation(plan({name:'Algorithms',sectionId:'guessed'}),'ar','{"scopes":[{"id":"personal","sections":[{"id":"s","name":"Study"}]}]}');
 assert.equal(result.actions.length,0);assert.equal(result.tasks[0].outcome,'needs-input');assert.ok(result.text.includes('Algorithms'));assert.ok(result.text.includes('Study'));assert.equal(JSON.stringify(result).includes('guessed'),false);
});
test('explicit empty choices and fully specified compound creations proceed to review',()=>{
 for(const values of [{name:'Quick',sectionId:'',dueDate:'',description:'',projectUrl:''},{name:'Ammar',dueDate:'2026-10-25',description:'Hello'}]){const p=plan(values);assert.equal(clarifyMinimalCreation(p,'en','{}'),p);}
});
test('missing identity asks a name and never invents one',()=>{const r=clarifyMinimalCreation(plan({}),'en','{}');assert.equal(r.actions.length,0);assert.equal(r.text,'What would you like to name it?');});
