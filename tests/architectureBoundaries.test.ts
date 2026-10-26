import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {expect,it} from 'vitest';
import {checkCoreBoundaries,CORE_ROOTS} from '../scripts/check-architecture.mjs';
it('rejects a transitive HTTP dependency but permits type-only external DTO references',()=>{
 const root=mkdtempSync(join(tmpdir(),'wilo-boundary-'));
 try{
  for(const path of CORE_ROOTS){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),'export const value=1;');}
  const entry=join(root,CORE_ROOTS[0]),adapter=join(root,'src/lib/outer.ts');
  writeFileSync(entry,"import './outer';");
  writeFileSync(adapter,"export const load=()=>fetch('https://example.test');");
  const result=checkCoreBoundaries(root);expect(result.status).toBe('failed');expect(result.violations[0]).toMatchObject({file:'src/lib/outer.ts',message:'Core performs HTTP directly'});
  writeFileSync(entry,"import type {Firestore} from 'firebase/firestore'; export type Store=Firestore;");
  expect(checkCoreBoundaries(root).status).toBe('passed');
 }finally{rmSync(root,{recursive:true,force:true});}
});
