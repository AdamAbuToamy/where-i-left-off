const text=(maxLength)=>({type:'string',maxLength});
const enumeration=(...values)=>({type:'string',enum:values});
const boolean={type:'boolean'};
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const array=(items,maxItems)=>({type:'array',items,maxItems});
const object=(properties,required=[])=>({type:'object',additionalProperties:false,properties,...(required.length?{required}:{})});
const id={type:'string',pattern:'^[-\\w]{1,100}$'};
const reference={type:'string',pattern:'^[-\\w]{1,600}$'};
const date={type:'string',pattern:'^(|[0-9]{4}-[0-9]{2}-[0-9]{2})$'};
const clock={type:'string',pattern:'^([01][0-9]|2[0-3]):[0-5][0-9]$'};
export const actionFields={
 courses:{name:text(300),url:text(500),notes:text(10000),requires:array(reference,1000),x:{type:'number',minimum:0,maximum:10000},y:{type:'number',minimum:0,maximum:10000},topics:array(object({id:reference,title:text(500),done:boolean},['id','title','done']),200)},
 tasks:{courseId:reference,title:text(500),kind:enumeration('task','assignment','exam'),due:{type:'string',pattern:'^(|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2}))$'},done:boolean,notes:text(10000),url:text(500)},
 lessons:{courseId:reference,sessionType:enumeration('lecture','tutorial','lab'),day:integer(0,6),start:clock,end:clock,room:text(200),notes:text(1000)},
 projects:{name:text(100),nextStep:text(1000),status:enumeration('later','active','waiting','done'),description:text(1000),dueDate:date,followUpDate:date,checkpoint:text(1000),checklist:text(3000),sectionId:text(100),projectUrl:text(500),attachmentUrl:text(500),links:array(text(500),10),resourceType:enumeration('project','book','course','video','series','film','shopping','idea'),progressUnits:integer(0,1000000),totalUnits:integer(0,1000000),kind:enumeration('resume','waiting','deadline','list'),rank:{type:'number',minimum:-999999999999999,maximum:999999999999999},assignedTo:text(128),coverUrl:text(500),archivedAt:integer(0,9000000000000000),trashedAt:integer(0,9000000000000000)},
 sections:{name:text(60)},
};
export const controlFields={
 profile:{displayName:{type:'string',minLength:1,maxLength:100}},
 appearance:{theme:enumeration('original','ocean','olive','violet','cobalt','emerald','sunset','rose'),background:enumeration('dots','paper','grid','linen','mist','plain')},
 language:{language:enumeration('ar','en','he')},sleep:{enabled:boolean},
 workflow:{autoArchive:boolean,reminders:boolean,desktop:boolean,reviewDays:{type:'integer',enum:[7,14,30,60,90]}},
 navigate:{page:enumeration('personal','resume','university','groups','settings','notifications','library','analytics','logs','support'),groupId:id,tab:enumeration('overview','schedule','map'),courseId:reference,view:enumeration('board','week','archive','trash','review','ideas'),weekOf:date,filter:enumeration('all','today','waiting','overdue','upcoming','active','later','done','ideas'),search:text(300),section:id,mine:boolean},tour:{},
};
export const WORKSPACE_REPLY_FORMAT={type:'json_schema',json_schema:object({
 text:text(12000),
 actions:array({anyOf:[...Object.entries(actionFields).map(([target,fields])=>object({target:enumeration(target),action:target==='projects'?enumeration('create','update','trash'):enumeration('create','update','delete'),id:reference,...(['projects','sections'].includes(target)?{scope:id}:{}),values:object(fields)},['target','action','id','values'])),object({target:enumeration('projects'),action:enumeration('delete'),id:reference,scope:enumeration('personal'),values:object({})},['target','action','id','scope','values'])]},50),
 controls:array({anyOf:Object.entries(controlFields).map(([kind,fields])=>object({kind:enumeration(kind),values:object(fields)},['kind','values']))},20),
 tasks:array(object({title:text(300),outcome:enumeration('proposed','answer','needs-input','unsupported'),actionIndexes:array(integer(0,49),50),controlIndexes:array(integer(0,19),20),detail:text(1500)},['title','outcome','actionIndexes','controlIndexes','detail']),50),
 files:array(object({name:text(100),content:text(30000)},['name','content']),3),
},['text','actions','files','controls','tasks'])};
