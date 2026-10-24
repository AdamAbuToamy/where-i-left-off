import {it,expect} from 'vitest';
import {pilotWorkerConfiguration,deployAssistantPilot} from '../scripts/deploy-assistant-pilot.mjs';
it('requires all deployment secrets before attempting any mutation',()=>{
 expect(()=>deployAssistantPilot({})).toThrow('Missing repository secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_WORKER_CONFIG, GEMINI_API_KEY');
});
it('preserves existing bindings and restricts a free Gemini pilot to the owner',()=>{
 const config={name:'wilo-free-push',account_id:'a'.repeat(32),vars:{FIREBASE_PROJECT_ID:'where-i-left-off-b5683',ASSISTANT_FREE_ONLY:'true',APP_ORIGINS:'https://where-i-left-off.web.app'},d1_databases:[{binding:'DB',database_id:'294c215a-67db-4ba6-b2ff-67f482f29f71'}],queues:{consumers:[]}};
 const pilot=pilotWorkerConfiguration(JSON.stringify(config));
 expect(pilot.vars.ASSISTANT_PROVIDER).toBe('gemini');expect(pilot.vars.ASSISTANT_PILOT_EMAIL).toBe('adam2002hosny@gmail.com');expect(pilot.queues).toEqual(config.queues);expect(pilot.vars.APP_ORIGINS).toBe(config.vars.APP_ORIGINS);
 expect(()=>pilotWorkerConfiguration(JSON.stringify({...config,name:'another-worker'}))).toThrow();
});
