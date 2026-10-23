import { createClientId } from '../lib/clientId'
import type { UniversityState } from '../university/model';
import type { PlanPreview } from '../university/planImport';
export function assistantPlan(text:string,state:UniversityState):{text:string;preview:PlanPreview}|null {
 try {
  const data=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
  if(typeof data.text!=='string'||!Array.isArray(data.tasks)||data.tasks.length>8)return null;
  const preview:PlanPreview={courses:[],tasks:[],lessons:[],errors:[],skipped:0};
  for(const t of data.tasks){
   if(!state.courses.some(c=>c.id===t.courseId)||typeof t.title!=='string'||!t.title.trim()||t.title.length>500||typeof t.due!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(t.due)||!Number.isFinite(Date.parse(t.due))||!['task','assignment','exam'].includes(t.kind))return null;
   const due=new Date(t.due).toISOString();
   if(state.tasks.some(old=>old.courseId===t.courseId&&old.title===t.title.trim()&&old.due===due)){preview.skipped++;continue;}
   preview.tasks.push({id:createClientId(),courseId:t.courseId,title:t.title.trim(),kind:t.kind,due,notes:'',done:false,url:''});
  }
  return {text:data.text.slice(0,5000),preview};
 }catch{return null;}
}
