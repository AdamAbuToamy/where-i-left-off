import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('keeps origin-based Google browser-key checks compatible with hosting privacy and framing headers',()=>{
 const config=JSON.parse(readFileSync('firebase.json','utf8'));
 const headers=config.hosting.headers.find((x:{source:string})=>x.source==='**').headers;
 const value=(name:string)=>headers.find((x:{key:string})=>x.key.toLowerCase()===name.toLowerCase())?.value;
 expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
 expect(value('X-Frame-Options')).toBe('DENY');
 expect(value('X-Content-Type-Options')).toBe('nosniff');
 expect(value('Content-Security-Policy')).toContain("frame-ancestors 'none'");
});
