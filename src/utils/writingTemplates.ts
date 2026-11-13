export interface WritingTemplate { id:string; title:string; task:0|1|2|3; body:string }
/** Parse the supplied document as inert text. Never render source HTML. */
export function parseWritingTemplates(markdown:string):WritingTemplate[] {
 const entries:WritingTemplate[]=[];let task:0|1|2|3=0;let current:WritingTemplate|undefined;
 for(const line of markdown.split(/\r?\n/)) {
  const section=line.match(/^# Task ([123])\b/);
  if(section){task=Number(section[1]) as 1|2|3;current=undefined;continue;}
  if(/^# Completed examples/.test(line)||/^# What to learn first/.test(line)){task=0;current=undefined;continue;}
  const heading=line.match(/^## (.+)$/);
  if(heading) {
   const inferred=heading[1].match(/Task ([123])/i);
   current={id:`template-${entries.length}`,title:heading[1],task:inferred?Number(inferred[1]) as 1|2|3:task,body:''};entries.push(current);
  } else if(current) current.body += line+'\n';
 }
 return entries.filter(e=>e.body.trim());
}
export function filterWritingTemplates(entries:WritingTemplate[],task:number,query:string) {
 const normalized=query.trim().toLocaleLowerCase();
 return entries.filter(e=>(task===0||e.task===task||e.task===0)&&(!normalized||(e.title+' '+e.body).toLocaleLowerCase().includes(normalized)));
}
