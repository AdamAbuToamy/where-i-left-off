const APP_URL = 'https://where-i-left-off.web.app/'
chrome.action.onClicked.addListener(async tab => {
 const pageUrl=tab.url || '',pageTitle=(tab.title || '').trim()
 if(!pageTitle||!/^https?:\/\//i.test(pageUrl))return
 let checkpoint='',capturedUrl=pageUrl,resource='project'
 try{
  const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
   if(document.querySelector('.html5-video-player.ad-showing'))return null
   const videos=[...document.querySelectorAll('video')].filter(v=>Number.isFinite(v.currentTime)&&v.currentTime>=0&&Number.isFinite(v.duration)&&v.duration>0).sort((a,b)=>b.duration-a.duration)
   const video=videos[0]
   return video?{seconds:Math.floor(video.currentTime),duration:Math.floor(video.duration)}:null
  }})
  const position=results[0]?.result
  if(position){const seconds=position.seconds,time=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(v=>String(v).padStart(2,'0')).join(':');checkpoint=`${time} / ${[Math.floor(position.duration/3600),Math.floor(position.duration/60)%60,position.duration%60].map(v=>String(v).padStart(2,'0')).join(':')}`;resource=new URL(pageUrl).hostname.includes('coursera.org')?'course':'video';const url=new URL(pageUrl);if(/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname))url.searchParams.set('t',`${seconds}s`);capturedUrl=url.toString()}
 }catch{/* Restricted pages and cross-origin players fall back to the page title and URL. */}
 const captureUrl=new URL(APP_URL);captureUrl.searchParams.set('capture','tab');captureUrl.searchParams.set('auto','1');captureUrl.searchParams.set('title',pageTitle.slice(0,100));captureUrl.searchParams.set('url',capturedUrl.slice(0,500))
 if(checkpoint){captureUrl.searchParams.set('checkpoint',checkpoint);captureUrl.searchParams.set('resource',resource)}
 await chrome.tabs.create({url:captureUrl.toString(),active:true})
})

// A presence check from the companion site only. No page content is accessed.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
 let origin = ''
 try { origin = new URL(sender.url || sender.origin || '').origin } catch { return false }
 if (origin !== 'https://where-i-left-off.web.app' || message?.type !== 'WILO_PING') return false
 sendResponse({ app:'where-i-left-off', installed:true, version:chrome.runtime.getManifest().version })
 return false
})
