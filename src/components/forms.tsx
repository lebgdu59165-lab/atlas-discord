'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { Field } from '../shared/catalog';
export type Directory={channels:{id:string;name:string;type:number}[];roles:{id:string;name:string;managed?:boolean;manageable?:boolean}[]};
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal"><div className="modal-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Fermer"><X size={20}/></Dialog.Close></div><Dialog.Description className="sr-only">Complétez le formulaire puis confirmez votre action.</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Fields({fields,value,onChange,disabled=false,directory}:{fields:Field[];value:Record<string,any>;onChange:(v:Record<string,any>)=>void;disabled?:boolean;directory?:Directory|null}) {
  return <div className="form-fields">{fields.map(f=>{
    const id=`field-${f.key}`,v=value[f.key]??f.default;
    if(f.type==='boolean')return <label key={f.key} className="switch-row" htmlFor={id}><span>{f.label}</span><input id={id} type="checkbox" className="switch" checked={Boolean(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.checked})}/></label>;
    const channelField=/channelId$/i.test(f.key)||f.key==='categoryId',roleField=/roleId$/i.test(f.key);
    if(directory&&(channelField||roleField)){
      const choices=roleField?directory.roles.filter(r=>!r.managed&&r.manageable!==false):directory.channels.filter(c=>f.key==='categoryId'?c.type===4:[0,5].includes(c.type));
      return <label key={f.key} htmlFor={id} className="field"><span>{f.label}</span><select id={id} value={String(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.value})}><option value="">{f.key==='categoryId'?'Aucune catégorie sélectionnée':`Aucun ${roleField?'rôle':'salon'} sélectionné`}</option>{v&&!choices.some(c=>c.id===v)&&<option value={String(v)}>Sélection actuelle · {String(v)}</option>}{choices.map(c=><option value={c.id} key={c.id}>{roleField?'':f.key==='categoryId'?'':'# '}{c.name}</option>)}</select><small>{roleField?'Les rôles attribuables par le bot sont proposés.':'Choisissez un élément de votre serveur Discord.'}</small></label>;
    }
    if(directory&&f.type==='ids'&&/(Roles|roleIds|Channels)$/.test(f.key)){
      const roles=f.key!=='excludedChannels',choices=roles?directory.roles.filter(r=>f.key!=='roleIds'||!r.managed&&r.manageable!==false):directory.channels.filter(c=>[0,5].includes(c.type)),selected=Array.isArray(v)?v:[];
      return <div key={f.key} className="field wide"><span>{f.label}</span><details className="directory-choices"><summary>{selected.length?`${selected.length} ${roles?'rôle':'salon'}${selected.length>1?'s':''} sélectionné${selected.length>1?'s':''}`:`Choisir des ${roles?'rôles':'salons'}`}</summary><div className="role-choices">{choices.map(c=><label key={c.id} className="role-choice"><input type="checkbox" checked={selected.includes(c.id)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.checked?[...selected,c.id]:selected.filter((s:string)=>s!==c.id)})}/>{roles?'':'# '}{c.name}</label>)}{selected.filter((s:string)=>!choices.some(c=>c.id===s)).map((s:string)=><label key={s} className="role-choice"><input type="checkbox" checked disabled={disabled} onChange={()=>onChange({...value,[f.key]:selected.filter((x:string)=>x!==s)})}/>Sélection précédente · {s}</label>)}</div></details>{f.hint&&<small>Choisissez les {roles?'rôles':'salons'} concernés.</small>}</div>;
    }
    if(['startsAt','endsAt','sendAt'].includes(f.key)){
      const current=v?new Date(String(v)):null,local=current&&!Number.isNaN(current.getTime())?new Date(current.getTime()-current.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
      return <label key={f.key} className="field" htmlFor={id}><span>{f.label.replace(' ISO 8601','')}</span><input id={id} type="datetime-local" disabled={disabled} value={local} onChange={e=>onChange({...value,[f.key]:e.target.value?new Date(e.target.value).toISOString():''})}/><small>Date et heure locales. {f.key==='sendAt'?'Laissez vide pour envoyer dès la publication.':''}</small></label>;
    }
    return <label key={f.key} htmlFor={id} className={f.type==='textarea'?'field wide':'field'}><span>{f.label}</span>{f.type==='textarea'?<textarea id={id} value={String(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.value})}/>:f.type==='select'?<select id={id} value={String(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.value})}>{f.options?.map(o=><option key={o}>{o}</option>)}</select>:<input id={id} type={f.type==='number'?'number':f.type==='color'?'color':'text'} min={f.min} max={f.max} disabled={disabled} value={f.type==='ids'?(v as string[]).join(', '):v} onChange={e=>onChange({...value,[f.key]:f.type==='number'?Number(e.target.value):f.type==='ids'?e.target.value.split(',').map(s=>s.trim()).filter(Boolean):e.target.value})}/>} {f.hint&&<small>{f.hint}</small>}</label>;
  })}</div>;
}
export function Table({columns,rows,empty='Aucune donnée enregistrée.',actions}:{columns:{key:string;label:string;format?:(v:any,row:any)=>React.ReactNode}[];rows:any[];empty?:string;actions?:(row:any)=>React.ReactNode}){
  return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{actions&&<th>Actions</th>}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id??r.userId??i}>{columns.map(c=><td key={c.key}>{c.format?c.format(r[c.key],r):typeof r[c.key]==='object'?Array.isArray(r[c.key])?r[c.key].join(', '):'—':String(r[c.key]??'—')}</td>)}{actions&&<td><div className="row-actions">{actions(r)}</div></td>}</tr>):<tr><td colSpan={columns.length+(actions?1:0)}><div className="empty">{empty}</div></td></tr>}</tbody></table></div>;
}
export const date=(v:any)=>v?new Date(v).toLocaleString('fr-FR'):'—';
export const statusLabel=(value:any)=>(({active:'Actif',disabled:'Désactivé',open:'Ouvert',closed:'Fermé',done:'Réussi',accepted:'Accepté',failed:'Échec',rejected:'Refusé',queued:'En attente',running:'En cours',offline:'Hors ligne',cancelled:'Annulé'} as Record<string,string>)[String(value)]??String(value??'—'));
export const badge=(v:any)=><span className={`badge ${['active','open','done','accepted'].includes(v)?'green':['failed','rejected'].includes(v)?'red':''}`}>{statusLabel(v)}</span>;
