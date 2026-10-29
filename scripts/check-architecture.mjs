import ts from 'typescript';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CORE_ROOTS=['src/lib/projectEntity.ts','src/lib/offlineWorkspace.ts','src/assistant/actions.ts','src/university/planImport.ts','src/session/domain.ts','src/session/control.ts','src/session/commands.ts','src/session/repository.ts','src/session/speechController.ts','src/session/clipController.ts','src/session/cloudSpeechController.ts','src/session/audioClip.ts'];
const browserGlobals=new Set(['window','document','navigator','localStorage','sessionStorage','indexedDB']);
/** Follow runtime dependencies only; type-only DTO references never load an adapter. */
export function checkCoreBoundaries(root=process.cwd()){
 const checked=new Set(),violations=[];
 const visit=(file,chain)=>{
  if(checked.has(file))return;checked.add(file);
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true),path=relative(root,file).replaceAll('\\','/');
  const issue=(message,node)=>violations.push({file:path,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,message,chain});
  const walk=node=>{
   if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
    if(node.isTypeOnly||ts.isImportDeclaration(node)&&(node.importClause?.isTypeOnly||node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)&&!node.importClause.name&&node.importClause.namedBindings.elements.every(item=>item.isTypeOnly)))return;
    const name=node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)?node.moduleSpecifier.text:null;
    if(name){
     if(/^(?:firebase(?:-admin)?(?:\/|$)|react(?:-dom)?(?:\/|$)|@pollinations\/|@mlc-ai\/|jspdf$|node:fs)/.test(name))issue('Core imports an outer framework/driver: '+name,node);
     if(name.startsWith('.')){
      const base=resolve(dirname(file),name),target=[base+'.ts',base+'.tsx',base+'.mjs',base+'.js',base,resolve(base,'index.ts')].find(candidate=>existsSync(candidate)&&/\.(?:[cm]?js|tsx?)$/.test(candidate));
      if(target)visit(target,[...chain,path]);else issue('Unresolved core runtime dependency: '+name,node);
     }
    }
   }
   if(ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.expression)&&browserGlobals.has(node.expression.text))issue('Core accesses a browser driver: '+node.expression.text,node);
   if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='fetch')issue('Core performs HTTP directly',node);
   ts.forEachChild(node,walk);
  };
  walk(source);
 };
 for(const path of CORE_ROOTS)visit(resolve(root,path),[]);
 return {status:violations.length?'failed':'passed',roots:CORE_ROOTS,checkedModules:checked.size,violations};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=checkCoreBoundaries();console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exitCode=1;
}
