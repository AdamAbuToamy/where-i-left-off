const APP_URL = 'https://where-i-left-off.web.app/'

chrome.action.onClicked.addListener(async tab => {
  const pageUrl = tab.url || ''
  const pageTitle = (tab.title || '').trim()

  if (!pageTitle || !/^https?:\/\//i.test(pageUrl)) return

  const captureUrl = new URL(APP_URL)
  captureUrl.searchParams.set('capture', 'tab')
  captureUrl.searchParams.set('title', pageTitle.slice(0, 100))
  captureUrl.searchParams.set('url', pageUrl.slice(0, 500))

  await chrome.tabs.create({ url: captureUrl.toString(), active: true })
})
