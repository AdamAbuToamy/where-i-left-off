import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceFingerprint} from './lib/localReleaseGate.mjs';
export function writeCloudRelease(validation){
 const config=JSON.parse(readFileSync('src/assistant/pollinationsConfig.json','utf8'));
 const release={release:{version:'wilo-cloud-v13-readiness-20261026',provider:'pollinations',models:[config.model],authentication:'user-owned-key-official-device-flow',toolChoice:'auto',protocol:'model-selected-typed-native-functions',localModel:false,streaming:true,supportedExports:['pdf','txt','md','csv','json'],unsupportedExports:['docx','binary-images']},fingerprint:sourceFingerprint(),audience:'verified-users',stage:'public',experience:{siteMotion:true,richReplies:true,stopRequest:true,fileCards:true,reducedMotion:true},validation,builtAt:new Date().toISOString()};
 writeFileSync('dist/wilo-release.json',JSON.stringify(release,null,2));return release;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))writeCloudRelease({status:'quality-workflow-passed',source:'github-quality-checks',liveProviderRerun:false,deviceChecks:'not-covered-by-ci'});
