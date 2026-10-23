import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';
import type { Language } from '../translations';
import { StudyLocaleContext, useStudyLanguage, translateStudyText } from './studyLocaleContext';
export function StudyLocaleProvider({value,children}:{value:Language;children:ReactNode}){return <StudyLocaleContext value={value}>{children}</StudyLocaleContext>;}
/** Translate UI primitives in React, never mutate DOM or translate user text marked dir=auto. */
function localize(node:ReactNode,language:Language,content=false):ReactNode{
 if(typeof node==='string')return content?node:translateStudyText(node,language);
 if(!isValidElement(node))return node;
 const element=node as ReactElement<Record<string,unknown>>;
 const props=element.props,protectedContent=content||props.dir==='auto'||!!props['data-study-content'];
 const next:Record<string,unknown>={};
 for(const name of ['title','aria-label','placeholder'])if(typeof props[name]==='string'&&!props['data-study-content'])next[name]=translateStudyText(props[name] as string,language);
 if(props.dir==='rtl')next.dir=language==='en'?'ltr':'rtl';
 if(props.children!==undefined)next.children=Children.map(props.children as ReactNode,child=>localize(child,language,props['data-study-ui']?false:protectedContent));
 return cloneElement(element,next);
}
export default function StudyLocalized({children}:{children:ReactNode}){return <>{localize(children,useStudyLanguage())}</>;}
