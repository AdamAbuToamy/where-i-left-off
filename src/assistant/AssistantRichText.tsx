import {memo} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export default memo(function AssistantRichText({text}:{text:string}){
 return <div className="assistant-rich-text" dir="auto"><Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={['img','input']} components={{a:({href,children})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,table:({children})=><div className="assistant-table-scroll" tabIndex={0}><table>{children}</table></div>}}>{text}</Markdown></div>;
});
