'use client';
import {useState} from 'react';
import {ArrowRight,Command,LayoutDashboard,Search} from 'lucide-react';
import {modules} from '../shared/catalog';
import {builtinCommands} from '../shared/commands';
import {Modal} from './forms';
export function NavigationSearch({guildId,onNavigate,onClose}:{guildId?:string;onNavigate:(path:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(''),q=query.trim().toLocaleLowerCase('fr');
 const found=modules.filter(m=>m.id!=='global'&&(!q||`${m.label} ${m.description}`.toLocaleLowerCase('fr').includes(q))),commands=q?builtinCommands.filter(c=>`${c.name} ${c.description}`.toLocaleLowerCase('fr').includes(q.replace(/^\//,''))).slice(0,8):[];
 const navigate=(id:string)=>{onNavigate(guildId?`/dashboard/${guildId}/${id}`:'/servers');onClose();};
 return <Modal title="Rechercher dans Atlas" onClose={onClose}><label className="palette-search"><Search size={20}/><input autoFocus aria-label="Module ou commande" placeholder="Tickets, Twitch, musique, /play…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="palette-list"><p className="palette-section">Modules</p>{found.map(m=><button className="palette-result" key={m.id} onClick={()=>navigate(m.id)}><LayoutDashboard size={18}/><span><strong>{m.label}</strong><small>{m.description}</small></span><ArrowRight size={16}/></button>)}{commands.length>0&&<p className="palette-section">Commandes Discord</p>}{commands.map(c=><button className="palette-result" key={c.name} onClick={()=>navigate('commands')}><Command size={18}/><span><strong>/{c.name}</strong><small>{c.description}</small></span><ArrowRight size={16}/></button>)}{!found.length&&!commands.length&&<div className="empty">Aucun résultat. Essayez un autre mot.</div>}</div></Modal>;
}
