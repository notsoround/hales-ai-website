import type { ReactNode } from 'react';
import './answer-text.css';
function inline(text:string):ReactNode[]{return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:part)}
export default function AnswerText({text}:{text:string}){
 const blocks:ReactNode[]=[];let paragraph:string[]=[],list:string[]=[];let ordered=false;
 const flush=()=>{if(paragraph.length){blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'))}</p>);paragraph=[]}if(list.length){const children=list.map((s,i)=><li key={i}>{inline(s)}</li>);blocks.push(ordered?<ol key={blocks.length} style={{listStyle:'decimal',paddingLeft:24}}>{children}</ol>:<ul key={blocks.length} style={{listStyle:'disc',paddingLeft:24}}>{children}</ul>);list=[]}};
 for(const line of text.split('\n')){const heading=line.match(/^#{1,6}\s+(.+)/),bullet=line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)/);if(heading){flush();blocks.push(<h4 key={blocks.length}>{inline(heading[1])}</h4>)}else if(bullet){if(paragraph.length)flush();const next=/^\s*\d/.test(line);if(list.length&&ordered!==next)flush();ordered=next;list.push(bullet[1])}else if(!line.trim()){flush()}else{if(list.length)flush();paragraph.push(line)}}flush();return <div className="cc-answer-text">{blocks}</div>
}
