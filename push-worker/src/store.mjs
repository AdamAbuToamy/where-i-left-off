export const account=(env,uid)=>env.DB.prepare('SELECT * FROM accounts WHERE uid=?').bind(uid).first()
export const card=(env,uid,id)=>env.DB.prepare('SELECT settings FROM cards WHERE uid=? AND id=?').bind(uid,id).first().then(r=>r?JSON.parse(r.settings):{})
export async function ensureAccount(env,uid,prefs){await env.DB.prepare('INSERT INTO accounts(uid,prefs) VALUES(?,?) ON CONFLICT(uid) DO NOTHING').bind(uid,JSON.stringify(prefs)).run()}
export async function wake(env,uid,scope=''){
 await env.DB.prepare('INSERT INTO scopes(uid,scope,next_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM accounts WHERE uid=?) ON CONFLICT(uid,scope) DO UPDATE SET next_at=MIN(next_at,excluded.next_at),lease=0').bind(uid,scope,Date.now(),uid).run()
}
export async function saveCard(env,uid,id,value){await env.DB.prepare('INSERT INTO cards(uid,id,settings) VALUES(?,?,?) ON CONFLICT(uid,id) DO UPDATE SET settings=excluded.settings').bind(uid,id,JSON.stringify(value)).run()}
export async function erase(env,uid){await env.DB.prepare('DELETE FROM accounts WHERE uid=?').bind(uid).run()}
export async function claimEvent(env,uid,id,type,key){
 const result=await env.DB.prepare('INSERT INTO events(uid,id,type,event_key) VALUES(?,?,?,?) ON CONFLICT(uid,id,type) DO UPDATE SET event_key=excluded.event_key WHERE event_key<>excluded.event_key').bind(uid,id,type,key).run()
 return result.meta.changes>0
}
export async function claimDelivery(env,id,uid){const r=await env.DB.prepare('INSERT OR IGNORE INTO deliveries(id,uid,created_at) VALUES(?,?,?)').bind(id,uid,Date.now()).run();return r.meta.changes>0}
