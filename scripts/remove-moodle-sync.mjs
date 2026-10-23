import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const config = 'push-worker/wrangler.local.json', cli = resolve('push-worker/node_modules/wrangler/bin/wrangler.js');
function run(args, options = {}) { return execFileSync(process.execPath, [cli, ...args, '--config', config], { encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, ...options }); }
try {
    if (!existsSync(config))
        throw new Error('إعداد Cloudflare غير موجود. شغّل هذا على جهاز المشروع الذي نشرت منه خدمة الإشعارات.');
    if (!existsSync(cli))
        throw new Error('شغّل npm ci --prefix push-worker أولًا.');
    console.log('نشر خدمة الإشعارات بدون التكامل القديم…');
    run(['deploy'], { stdio: 'inherit' });
    run(['d1', 'execute', 'wilo-push', '--remote', '--command', 'DROP TABLE IF EXISTS moodle_browser_pending; DROP TABLE IF EXISTS moodle_probes; DROP TABLE IF EXISTS moodle_attempts; DROP TABLE IF EXISTS moodle_links;', '--yes'], { stdio: 'inherit' });
    const secrets = JSON.parse(run(['secret', 'list']));
    if (secrets.some(s => s.name === 'MOODLE_TOKEN_KEY'))
        run(['secret', 'delete', 'MOODLE_TOKEN_KEY'], { input: 'y\n', stdio: ['pipe', 'inherit', 'inherit'] });
    const privatePath = 'push-worker/.moodle-private.json';
    if (existsSync(privatePath))
        unlinkSync(privatePath);
    console.log('تمت إزالة الربط وبياناته السحابية. انشر الواجهة: bash scripts/deploy-production.sh');
}
catch (e) {
    console.error(e.message?.startsWith('Command failed') ? 'تعذرت خطوة الإزالة؛ راجع الرسالة السابقة ثم أعد تشغيل السكربت. يمكن تكراره بأمان.' : e.message);
    process.exitCode = 1;
}
