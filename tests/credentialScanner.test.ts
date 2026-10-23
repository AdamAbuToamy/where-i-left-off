import {copyFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {expect,it} from 'vitest';
it('distinguishes embedded wasm base64 sequences from a standalone credential token',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wilo-scanner-'));
 try{
  mkdirSync(join(folder,'scripts'));mkdirSync(join(folder,'src'));copyFileSync('scripts/check-credentials.mjs',join(folder,'scripts/check-credentials.mjs'));
  const marker=['AK','IA','A'.repeat(16)].join(''),file=join(folder,'src/example.js');
  writeFileSync(file,'const wasm="AGFzbQA'+marker+'AAAA==";');expect(spawnSync(process.execPath,['scripts/check-credentials.mjs'],{cwd:folder,encoding:'utf8'}).status).toBe(0);
  writeFileSync(file,'const token="'+marker+'";');const result=spawnSync(process.execPath,['scripts/check-credentials.mjs'],{cwd:folder,encoding:'utf8'});expect(result.status).toBe(1);expect(result.stderr).toContain('src/example.js');expect(result.stderr).not.toContain(marker);
 }finally{rmSync(folder,{recursive:true,force:true});}
});
