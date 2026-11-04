function notificationAccount(identity){return identity.emailVerified===true&&typeof identity.uid==='string'&&identity.uid.length>0;}
export async function readNotifications(env,identity){
 if(!notificationAccount(identity))throw new Error('account-unavailable');
 await env.DB.prepare('INSERT INTO notification_centers(uid) VALUES(?) ON CONFLICT(uid) DO NOTHING').bind(identity.uid).run();
 const state=await env.DB.prepare('SELECT last_read FROM notification_centers WHERE uid=?').bind(identity.uid).first();
 const rows=await env.DB.prepare('SELECT id,title,body,url,created_at FROM notification_items WHERE uid=? ORDER BY created_at DESC,id LIMIT 50').bind(identity.uid).all();
 const unread=await env.DB.prepare('SELECT COUNT(*) AS count FROM notification_items WHERE uid=? AND created_at>?').bind(identity.uid,state.last_read).first();
 return {items:rows.results,lastRead:state.last_read,unread:unread.count,checkedAt:Date.now()};
}
export async function readThrough(env,identity,at){
 if(!notificationAccount(identity))throw new Error('account-unavailable');
 if(!Number.isSafeInteger(at)||at<0||at>Date.now())throw new Error('invalid-size');
 await env.DB.prepare('UPDATE notification_centers SET last_read=MAX(last_read,?) WHERE uid=?').bind(at,identity.uid).run();
 return {ok:true};
}
export async function recordNotification(env,uid,id,payload,now=Date.now()){
 const opted=await env.DB.prepare('SELECT uid FROM notification_centers WHERE uid=?').bind(uid).first();if(!opted)return;
 await env.DB.prepare('INSERT INTO notification_items(id,uid,title,body,url,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(uid,id) DO NOTHING').bind(id,uid,payload.title.slice(0,100),payload.body.slice(0,1000),payload.url,now).run();
 await env.DB.prepare('DELETE FROM notification_items WHERE uid=? AND id NOT IN (SELECT id FROM notification_items WHERE uid=? ORDER BY created_at DESC,id LIMIT 100)').bind(uid,uid).run();
}
