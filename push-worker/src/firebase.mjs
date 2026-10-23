import {createRemoteJWKSet,jwtVerify,importPKCS8,SignJWT} from 'jose'
const authKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const appKeys=createRemoteJWKSet(new URL('https://firebaseappcheck.googleapis.com/v1/jwks'))
export async function verifyIdentity(request,env,keys={auth:authKeys,app:appKeys}) {
 const bearer=request.headers.get('authorization') || '',appcheck=request.headers.get('x-firebase-appcheck')
 if(!bearer.startsWith('Bearer ') || !appcheck)throw new Error('unauthenticated')
 const [identity,app]=await Promise.all([
  jwtVerify(bearer.slice(7),keys.auth,{issuer:`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,audience:env.FIREBASE_PROJECT_ID,algorithms:['RS256']}),
  jwtVerify(appcheck,keys.app,{issuer:`https://firebaseappcheck.googleapis.com/${env.FIREBASE_APP_ID.split(':')[1]}`,audience:`projects/${env.FIREBASE_APP_ID.split(':')[1]}`,algorithms:['RS256']})
 ])
 if(typeof identity.payload.exp!=='number' || typeof identity.payload.iat!=='number' || identity.payload.iat>Date.now()/1000 || typeof identity.payload.auth_time!=='number' || !identity.payload.sub || identity.payload.sub.length>128 || identity.payload.auth_time>Date.now()/1000 || !identity.payload.auth_time || app.payload.sub!==env.FIREBASE_APP_ID)throw new Error('unauthenticated')
 return {uid:identity.payload.sub,emailVerified:identity.payload.email_verified===true,token:{auth:bearer.slice(7),appcheck}}
}
let credentials,signingKey,oauth
async function accessToken(env) {
 if(oauth && oauth.expires>Date.now()+60000)return oauth.token
 credentials ||= JSON.parse(env.FIREBASE_READER)
 if(credentials.project_id!==env.FIREBASE_PROJECT_ID)throw new Error('wrong-project')
 signingKey ||= await importPKCS8(credentials.private_key,'RS256')
 const jwt=await new SignJWT({scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'}).setProtectedHeader({alg:'RS256'}).setIssuer(credentials.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(signingKey)
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})})
 if(!response.ok)throw Object.assign(new Error('reader-auth-failed'),{status:response.status})
 const data=await response.json();oauth={token:data.access_token,expires:Date.now()+data.expires_in*1000};return oauth.token
}
function decode(field) {
 if('stringValue' in field)return field.stringValue
 if('integerValue' in field)return Number(field.integerValue)
 if('doubleValue' in field)return field.doubleValue
 if('booleanValue' in field)return field.booleanValue
 if('timestampValue' in field)return Date.parse(field.timestampValue)
 if('mapValue' in field)return fields(field.mapValue.fields)
 if('arrayValue' in field)return (field.arrayValue.values || []).map(decode)
 return null
}
function fields(value={}){return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,decode(v)]))}
async function request(env,path,token) {
 const response=await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,{headers:{Authorization:`Bearer ${token?.auth || await accessToken(env)}`,...(token?.appcheck?{'X-Firebase-AppCheck':token.appcheck}:{})}})
 if(response.status===404)return null
 if(!response.ok)throw Object.assign(new Error('database-unavailable'),{status:response.status})
 return response.json()
}
export async function readDocument(env,path,token){const result=await request(env,path,token);return result?fields(result.fields):null}
export async function readCollection(env,path,token){
 const entries=[];let page=''
 for(let i=0;i<20;i++){
  const data=await request(env,`${path}?pageSize=200${page?'&pageToken='+encodeURIComponent(page):''}`,token)
  for(const d of data?.documents || [])entries.push({id:d.name.split('/').pop(),...fields(d.fields)})
  if(!data?.nextPageToken)return entries
  page=data.nextPageToken
 }
 throw new Error('too-many-cards')
}
export async function accountAvailable(env,uid,token){
 const [metric,deletion]=await Promise.all([readDocument(env,`appMetrics/${uid}`,token),readDocument(env,`accountDeletions/${uid}`,token)])
 if(metric?.suspended || deletion)throw new Error('account-unavailable')
 // Admin read-only Auth lookup also catches users disabled/deleted in the console.
 if(!token){
  const res=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`,{method:'POST',headers:{Authorization:`Bearer ${await accessToken(env)}`,'content-type':'application/json'},body:JSON.stringify({localId:[uid]})})
  if(!res.ok)throw Object.assign(new Error('auth-lookup-failed'),{status:res.status})
  const data=await res.json();if(!data.users?.length || data.users[0].disabled)throw new Error('account-unavailable')
 }
}
export async function cardDocument(env,uid,id,groupId='',token){
 if(!/^[A-Za-z0-9]{20}$/.test(id) || groupId&&!/^[A-Za-z0-9]{20}$/.test(groupId))throw new Error('invalid-card')
 if(groupId){
  const [member,group]=await Promise.all([readDocument(env,`groups/${groupId}/members/${uid}`,token),readDocument(env,`groups/${groupId}`,token)])
  if(!member || !group || group.deleted)throw new Error('card-unavailable')
 }
 const project=await readDocument(env,groupId?`groups/${groupId}/projects/${id}`:`users/${uid}/projects/${id}`,token)
 if(!project || groupId&&project.assignedTo!==uid)throw new Error('card-unavailable')
 return project
}
export async function scopeProjects(env,uid,scope){
 if(scope){
  const [member,group]=await Promise.all([readDocument(env,`groups/${scope}/members/${uid}`),readDocument(env,`groups/${scope}`)])
  if(!member || !group || group.deleted)return []
 }
 const entries=await readCollection(env,scope?`groups/${scope}/projects`:`users/${uid}/projects`)
 return entries.filter(p=>!scope || p.assignedTo===uid).map(p=>({...p,updatedAt:{toMillis:()=>typeof p.updatedAt==='number'?p.updatedAt:0}}))
}
