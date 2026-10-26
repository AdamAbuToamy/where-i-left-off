import {readFileSync} from 'node:fs';
import {sourceFingerprint} from './lib/localReleaseGate.mjs';
import {writeCloudRelease} from './generate-cloud-release.mjs';
const report=JSON.parse(readFileSync('docs/readiness/2026-10-26.json','utf8'));
if(report.fingerprint!==sourceFingerprint()||report.status!=='automated-passed-manual-checks-pending'||report.productionWrites!==0)throw new Error('readiness-source-verification-mismatch');
writeCloudRelease({status:report.status,unitTests:report.tests.unit,securityTests:report.tests.security,workerTests:report.tests.worker,browserTests:report.tests.browser,authTests:report.tests.auth,automatedTotal:report.automatedTotal,liveProviderCases:report.liveProvider.latest.results.length,liveProvider618Rerun:false,architectureModules:report.architecture.checkedModules,productionDependencyAdvisories:report.dependencyAudit.production.total,toolingModerateAdvisories:report.dependencyAudit.all.moderate,manualDeviceChecksPending:true,productionWrites:0,report:'docs/readiness/2026-10-26.json'});
