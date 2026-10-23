/** Runs only in the clicked tab. No requests, credentials, page scripts or hidden form fields. */
export function readMoodlePage() {
  const current = new URL(location.href);
  const match = current.pathname.match(/^(.*)\/(course\/view|mod\/(assign|quiz)\/view)\.php$/);
  if (current.protocol !== 'https:' || !match || !/^\d+$/.test(current.searchParams.get('id') || '')) return null;
  const marked = /moodle/i.test(document.querySelector('meta[name="generator"]')?.content || '') || /^page-(course-view|mod-(assign|quiz)-view)/.test(document.body.id) || !!document.querySelector('link[href*="/theme/styles.php"]');
  if (!marked) return null;
  const clean = (value, max) => (value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const root = current.origin + match[1];
  const coursePage = match[2] === 'course/view';
  let courseUrl = '', courseName = '';
  if (coursePage) {
    courseUrl = root + '/course/view.php?id=' + current.searchParams.get('id');
    courseName = clean(document.querySelector('h1')?.textContent || document.title, 300);
  } else {
    const links = [...document.querySelectorAll('.breadcrumb a[href], #page-navbar a[href], nav[aria-label] a[href]')];
    for (const link of links) {
      try {
        const url = new URL(link.href, current);
        if (url.origin === current.origin && url.pathname === match[1] + '/course/view.php' && /^\d+$/.test(url.searchParams.get('id') || '')) {
          courseUrl = root + '/course/view.php?id=' + url.searchParams.get('id');
          courseName = clean(link.textContent, 300);
        }
      } catch { /* Not a course breadcrumb. */ }
    }
    // Do not infer course ownership from arbitrary page text or a hostname.
    if (!courseUrl || !courseName) return null;
  }
  if (!courseName) return null;
  const heading = document.querySelector('.activity-header h1, .activity-header h2, [data-region="header-content"] h2') || document.querySelector('h1');
  const title = coursePage ? courseName : clean(heading?.textContent || document.title, 500);
  if (!title) return null;
  const plain = value => clean(value, 5000);
  const parseDate = value => {
    const text = value.replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\s+/g,' ').trim();
    const iso = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})/);
    if(iso && Number.isFinite(Date.parse(iso[0])))return new Date(iso[0]).toISOString();
    const months = [
      ['january','jan','يناير','كانون الثاني','ינואר'],['february','feb','فبراير','شباط','פברואר'],['march','mar','مارس','آذار','מרץ'],['april','apr','أبريل','ابريل','نيسان','אפריל'],['may','مايو','أيار','מאי'],['june','jun','يونيو','حزيران','יוני'],['july','jul','يوليو','تموز','יולי'],['august','aug','أغسطس','اغسطس','آب','אוגוסט'],['september','sep','سبتمبر','أيلول','ספטמבר'],['october','oct','أكتوبر','اكتوبر','تشرين الأول','אוקטובר'],['november','nov','نوفمبر','تشرين الثاني','נובמבר'],['december','dec','ديسمبر','كانون الأول','דצמבר']];
    const lower=text.toLocaleLowerCase();
    const month=months.findIndex(names=>names.some(name=>new RegExp('(^|[\\s,،])(?:ב)?'+name+'(?=$|[\\s,،])','u').test(lower)));
    const time=lower.match(/(?:^|[^\d])(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|ص|م)?/i);
    const year=lower.match(/\b(20\d{2})\b/);
    if(!time||!year)return '';
    let day=0,mo=month+1;
    if(month>=0){
      const name=months[month].find(name=>lower.includes(name));
      const pos=lower.indexOf(name);const before=lower.slice(0,pos).replace(/ב$/,'').match(/(\d{1,2})\s*$/);const after=lower.slice(pos+name.length).match(/^\s+(\d{1,2})(?:,|\s)/);
      day=Number(before?.[1]||after?.[1]||0);
    }else{
      const numeric=lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) || lower.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
      if(!numeric)return '';
      if(numeric[1].length===4){mo=Number(numeric[2]);day=Number(numeric[3]);}
      else{if(Number(numeric[1])<=12&&Number(numeric[2])<=12)return '';day=Number(numeric[1]);mo=Number(numeric[2]);}
    }
    let hour=Number(time[1]);const minute=Number(time[2]),period=time[3];
    if(period){if(hour<1||hour>12)return '';hour=hour%12+(/pm|م/i.test(period)?12:0);}
    if(!day||mo<1||hour>23||minute>59)return '';
    const utc=/\b(?:UTC|GMT)\b/i.test(text);
    const d=utc?new Date(Date.UTC(Number(year[1]),mo-1,day,hour,minute)):new Date(Number(year[1]),mo-1,day,hour,minute);
    const parts=utc?[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes()]:[d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes()];
    if(parts.join('/')!==[Number(year[1]),mo,day,hour,minute].join('/'))return '';
    const offset=text.match(/(?:UTC|GMT)([+-])(\d{1,2})(?::(\d{2}))?/i);
    if(offset){const minutes=Number(offset[2])*60+Number(offset[3]||0);if(minutes>840)return '';return new Date(d.getTime()+(offset[1]==='+'?-1:1)*minutes*60000).toISOString();}
    return d.toISOString();
  };
  const dates=[];
  const dueLabel=/due(?: date)?|deadline|موعد التسليم|تاريخ التسليم|آخر موعد|מועד הגשה|תאריך הגשה|closes?|נסגר|סגירה/i;
  const openLabel=/open|available|פתיחה|נפתח|متاح|فتح/i;
  for(const row of document.querySelectorAll('[data-region="activity-dates"] > div, .activity-dates > div, .submissionstatustable tr, .quizinfo p, .quizinfo > div')){
    const labelNode=row.querySelector('strong, th, td:first-child');
    const label=clean(labelNode?.textContent,150);if(!label)continue;
    const value=clean(row.textContent,500).replace(label,'').trim();if(!value)continue;
    const machine=row.querySelector('time[datetime], [data-timestamp], [data-time]');
    const epoch=machine?.getAttribute('data-timestamp')||machine?.getAttribute('data-time')||'';
    const datetime=machine?.getAttribute('datetime')||'';
    let iso='';
    if(/^\d{10}$/.test(epoch))iso=new Date(Number(epoch)*1000).toISOString();
    else if(datetime && /(?:Z|[+-]\d{2}:?\d{2})$/.test(datetime)&&Number.isFinite(Date.parse(datetime)))iso=new Date(datetime).toISOString();
    else iso=parseDate(datetime||value);
    const type=dueLabel.test(label)?'due':openLabel.test(label)?'opens':'other';
    if(!dates.some(d=>d.label===label&&d.text===value))dates.push({label,text:value,iso,type,timezone:epoch||/(?:Z|[+-]\d{2}:?\d{2})$/.test(datetime)?'absolute':Intl.DateTimeFormat().resolvedOptions().timeZone});
    if(dates.length>=12)break;
  }
  const due=dates.find(d=>d.type==='due'&&d.iso);
  const description=plain(document.querySelector('.activity-description, #intro .no-overflow, #intro, .course-description .no-overflow')?.textContent);
  const materials=[];
  for(const anchor of document.querySelectorAll('#intro a[href], .activity-description a[href], .course-content .activity a[href]')){
    try{const url=new URL(anchor.href,current);if(url.origin!==current.origin||url.protocol!=='https:'||url.username||url.password||[...url.searchParams.keys()].some(k=>/token|sesskey|password|secret/i.test(k)))continue;
      const title=clean(anchor.textContent,300);if(!title||materials.some(m=>m.url===url.href))continue;materials.push({title,url:url.href.slice(0,2000)});if(materials.length>=30)break;
    }catch{/* Ignore malformed links. */}
  }
  const teachers=[...document.querySelectorAll('.teachers a, .coursecontacts a')].map(a=>clean(a.textContent,200)).filter(Boolean).slice(0,20);
  return { version: 1, kind: coursePage ? 'course' : match[3] === 'quiz' ? 'exam' : 'assignment', courseName, courseUrl, title, url: root + '/' + match[2] + '.php?id=' + current.searchParams.get('id'), ...(dates.length?{dates}:{}), ...(due?{due:due.iso}:{}), ...(description?{description}:{}), ...(materials.length?{materials}:{}), ...(teachers.length?{teachers}:{} ) };
}
