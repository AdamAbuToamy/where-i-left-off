import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const env={...process.env,VITE_USE_EMULATORS:'true',VITE_TEST_OFFLINE:'true',VITE_ASSISTANT_ENABLED:'true',VITE_REQUIRE_APP_CHECK:'false',VITE_REQUIRE_FIREBASE_CONFIG:'false'};
const run=(file,args=[])=>execFileSync(process.execPath,[resolve(file),...args],{stdio:'inherit',env});
run('node_modules/vite/bin/vite.js',['build']);
// Fixtures override these config responses. Never contact production from emulator tests.
writeFileSync('dist/push-config.json',JSON.stringify({endpoint:'https://emulator.invalid/'}));
writeFileSync('dist/assistant-config.json',JSON.stringify({endpoint:'https://emulator.invalid/assistant'}));
run('scripts/generate-sw.mjs');
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const command=[process.execPath,resolve('node_modules/@playwright/test/cli.js'),'test',...process.argv.slice(2)].map(quote).join(' ');
run('node_modules/firebase-tools/lib/bin/firebase.js',['emulators:exec','--project','demo-where-i-left-off','--only','auth,firestore',command]);
