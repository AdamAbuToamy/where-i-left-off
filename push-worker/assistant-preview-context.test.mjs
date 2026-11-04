import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeWorkspaceInput} from './src/assistantNativeTools.mjs';
test('preview selection guidance applies only to an explicit administrator experience and preserves supported tools',()=>{
 const make=site=>nativeWorkspaceInput({language:'en',message:'Update its next step',context:JSON.stringify({localDate:'2026-11-04',timezone:'Asia/Jerusalem',controls:{site},scopes:[{id:'personal',projects:[],sections:[]}],study:{courses:[],tasks:[],lessons:[]}})},[]);
 const ordinary=make({}),preview=make({adminExperience:true,selection:{page:'personal',card:{scope:'personal',id:'one',name:'Card'}}});
 assert.equal(ordinary.messages[0].content.includes('validated controls.site.selection'),false);
 assert.ok(preview.messages[0].content.includes('validated controls.site.selection'));
 assert.ok(preview.messages[0].content.includes('no executor'));
 assert.deepEqual(preview.tools,ordinary.tools);
});
