import {describe,it,expect} from 'vitest';
import {analyzeCurriculum,validateCurriculum} from '../src/university/curriculum';
import {planBackup,parsePlanBackup,mergePlan} from '../src/university/planImport';
import {emptyUniversity} from '../src/university/state';
import type {CurriculumPlan} from '../src/university/curriculum';
const plan=():CurriculumPlan=>({id:'plan',name:'Synthetic',updatedAt:new Date().toISOString(),courses:[{id:'a',code:'101',name:'Math',year:1,semester:1,order:0,requires:[]},{id:'b',code:'102',name:'Advanced',year:1,semester:2,order:1,requires:['101']}]});
describe('curriculum map analysis and invariants',()=>{
 it('extracts multilingual columns without dropping course codes or order',()=>{const result=analyzeCurriculum([['מספר קורס','שם הקורס','שנה','סמסטר','דרישות קדם'],['101','Math','א','א',''],['102','Advanced','א','ב','101']]);expect(result.courses.map(c=>[c.code,c.year,c.semester,c.order,c.requires])).toEqual([['101',1,1,0,[]],['102',1,2,1,['101']]]);});
 it('uses year and term headings in textual documents',()=>{expect(analyzeCurriculum([['Year 2 Semester 1'],['ABC101 Linear Algebra'],['Semester 2'],['ABC102 Statistics']]).courses.map(c=>[c.code,c.year,c.semester])).toEqual([['ABC101',2,1],['ABC102',2,2]]);});
 it('leaves ambiguous placement unresolved and blocks saving it',()=>{const result=analyzeCurriculum([['101 Missing placement']]);expect(result.warnings.length).toBe(1);expect(()=>validateCurriculum({...plan(),courses:result.courses})).toThrow();});
 it('does not invent prerequisites and reports conflicting duplicate codes',()=>{const result=analyzeCurriculum([['Year 1 Semester 1'],['101 Math'],['101 Different']]);expect(result.courses).toHaveLength(1);expect(result.courses[0].requires).toEqual([]);expect(result.warnings).toHaveLength(1);});
 it('rejects cycles, missing dependencies and duplicate numbers',()=>{const p=plan();p.courses[0].requires=['102'];expect(()=>validateCurriculum(p)).toThrow('حلقة');p.courses[0].requires=['999'];expect(()=>validateCurriculum(p)).toThrow('غير موجود');p.courses[0].requires=[];p.courses[1].code='101';expect(()=>validateCurriculum(p)).toThrow();});
 it('permits moving a course independently without activating it',()=>{const p=plan();p.courses[1].year=2;p.courses[1].semester=1;expect(validateCurriculum(p).courses[0].semester).toBe(1);expect(validateCurriculum(p).courses[1].year).toBe(2);});
 it('bounds hostile input',()=>{expect(()=>analyzeCurriculum(Array.from({length:12001},()=>['x']))).toThrow();});
});

it('backs up and restores map-only plans without activating courses',()=>{const state={...emptyUniversity(),curricula:[plan()]};const restored=mergePlan(emptyUniversity(),parsePlanBackup(planBackup(state)));expect(restored.curricula).toEqual(state.curricula);expect(restored.courses).toEqual([]);});
