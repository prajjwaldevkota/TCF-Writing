import React,{useState,useEffect} from 'react';
import {X,Search,Copy,Check,BookOpen} from 'lucide-react';
import source from '../data/writingTemplates.md?raw';
import {parseWritingTemplates,filterWritingTemplates} from '../utils/writingTemplates';
import {useLanguage} from '../context/LanguageContext';
import {TaskKey} from '../types/exam';
const templates=parseWritingTemplates(source);
function Inline({text}:{text:string}) {
 return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((s,i)=>s.startsWith('**')?<strong key={i}>{s.slice(2,-2)}</strong>:s.startsWith('`')?<code key={i}>{s.slice(1,-1)}</code>:<React.Fragment key={i}>{s.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')}</React.Fragment>)}</>;
}
function Markdown({body,canCopy,en}:{body:string;canCopy:boolean;en:boolean}) {
 const [copied,setCopied]=useState<number|null>(null);const [error,setError]=useState('');
 return <>{body.split(/```(?:text|\w*)\n([\s\S]*?)```/g).map((part,i)=>i%2?<div className="template-code" key={i}><button disabled={!canCopy} title={!canCopy?(en?'Copy is available in targeted practice.':'La copie est disponible en pratique ciblée.'):undefined} onClick={async()=>{try{await navigator.clipboard.writeText(part.trim());setCopied(i);setError('');}catch{setError(en?'Copy unavailable. Select the text to copy it.':'Copie indisponible. Sélectionnez le texte pour le copier.');}}}>{copied===i?<Check size={14}/>:<Copy size={14}/>} {copied===i?(en?'Copied':'Copié'):(en?'Copy French structure':'Copier la structure française')}</button><pre>{part.trim()}</pre></div>:<div className="template-prose" key={i}>{part.split(/\n\s*\n/).filter(Boolean).map((block,j)=>{
 if(block.trim().startsWith('|')){const rows=block.trim().split('\n').filter(l=>!/^\|[\s:|-]+\|$/.test(l));return <div className="template-table" key={j}><table><tbody>{rows.map((row,k)=><tr key={k}>{row.split('|').slice(1,-1).map((cell,n)=>k===0?<th key={n}><Inline text={cell.trim()}/></th>:<td key={n}><Inline text={cell.trim()}/></td>)}</tr>)}</tbody></table></div>;}
 return <p key={j}><Inline text={block.replace(/^###? /,'')}/></p>;
 })}</div>)}{error&&<p role="status">{error}</p>}</>;
}
export const WritingTemplatePanel:React.FC<{activeTask:TaskKey;isPracticeMode:boolean;onClose:()=>void}> = ({activeTask,isPracticeMode,onClose})=>{
 const {language}=useLanguage();const en=language==='en';
 const [task,setTask]=useState(Number(activeTask.slice(-1)));const [query,setQuery]=useState('');const [selected,setSelected]=useState('');
 useEffect(()=>{setTask(Number(activeTask.slice(-1)));setQuery('');setSelected('');},[activeTask]);
 const matches=filterWritingTemplates(templates,task,query).sort((a,b)=>(a.task===task?0:1)-(b.task===task?0:1));const active=matches.find(t=>t.id===selected)||matches[0];
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
 return <aside className="writing-template-panel" aria-label={en?'Writing templates':'Modèles de rédaction'}>
  <div className="template-panel-header"><div><p className="studio-eyebrow">{en?'YOUR REFERENCE LIBRARY':'VOTRE BIBLIOTHÈQUE DE RÉFÉRENCE'}</p><h2><BookOpen size={19}/>{en?'Writing templates':'Modèles de rédaction'}</h2></div><button autoFocus aria-label={en?'Close templates':'Fermer les modèles'} onClick={onClose}><X size={20}/></button></div>
  <div className="template-panel-controls"><p>{en?'From your TCFFormation writing collection. Adapt every bracket to the actual prompt; these are study structures, not official scoring rules.':'Extraits de votre collection TCFFormation. Adaptez chaque crochet à la consigne : ce sont des structures de travail, pas une grille officielle.'}</p><div className="flex gap-2 mt-3">{[1,2,3,0].map(n=><button key={n} aria-pressed={task===n} className={task===n?'is-active':''} onClick={()=>{setTask(n);setSelected('');}}>{n===0?(en?'All':'Tous'):`T${n}`}</button>)}</div><label className="template-search"><Search size={16}/><input aria-label={en?'Search templates':'Rechercher un modèle'} placeholder={en?'Search: invitation, complaint…':'Rechercher : invitation, récit…'} value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="block text-xs mt-3">{en?'Choose a structure':'Choisir une structure'}<select className="w-full mt-2 rounded border p-2 text-sm" value={active?.id||''} onChange={e=>setSelected(e.target.value)}>{matches.map(entry=><option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label></div>
  <div className="template-panel-content">{active?<><h3>{active.title}</h3><Markdown key={active.id} body={active.body} canCopy={isPracticeMode} en={en}/></>:<p>{en?'No matching template.':'Aucun modèle correspondant.'}</p>}</div>
  <div className="template-panel-footer">{en?'Use as a reference. Replace every [bracket] and check your final word count.':'Utilisez ces modèles comme référence. Remplacez chaque [crochet] et comptez vos mots.'}{!isPracticeMode&&<p className="mt-2">{en?'Full mock: reference is open; copying into the editor is disabled.':'Examen blanc : référence ouverte, copie vers l’éditeur désactivée.'}</p>}</div>
 </aside>;
};
