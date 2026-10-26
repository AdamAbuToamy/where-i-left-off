import {writeFileSync} from 'node:fs';
import {LOCAL_RELEASE} from '../shared/localRelease.mjs';
import {sourceFingerprint} from './lib/localReleaseGate.mjs';
writeFileSync('dist/wilo-release.json',JSON.stringify({release:LOCAL_RELEASE,fingerprint:sourceFingerprint(),audience:'verified-admin',stage:'manual-test-preview',modelAcceptance:{status:'not-certified'},builtAt:new Date().toISOString()},null,2));