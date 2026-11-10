import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hydrateStudy} from './src/apiStudyService.mjs';
test('map-only curriculum never becomes active courses or breaks the existing API',()=>{
 const value={kind:'curricula',id:'plan',revision:0,deleted:false,payload:JSON.stringify({id:'plan',name:'Synthetic',courses:[{code:'101'}]})};
 const {data,records}=hydrateStudy([{key:'curricula_plan',value}]);assert.deepEqual(data.study.courses,[]);assert.equal(records.size,0);
 assert.throws(()=>hydrateStudy([{key:'curricula_wrong',value}]));
});
