'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { Field } from '../shared/catalog';
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
  return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal"><div className="modal-heading"><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="icon-button" aria-label="Fermer"><X size={20}/></Dialog.Close></div><Dialog.Description className="sr-only">Complétez le formulaire puis confirmez votre action.</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Fields({fields,value,onChange,disabled=false}:{fields:Field[];value:Record<string,any>;onChange:(v:Record<string,any>)=>void;disabled?:boolean}) {
  return <div className="form-fields">{fields.map(f=>{
    const id=`field-${f.key}`,v=value[f.key]??f.default;
    if(f.type==='boolean')return <label key={f.key} className="switch-row" htmlFor={id}><span>{f.label}</span><input id={id} type="checkbox" className="switch" checked={Boolean(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.checked})}/></label>;
    return <label key={f.key} htmlFor={id} className={f.type==='textarea'?'field wide':'field'}><span>{f.label}</span>{f.type==='textarea'?<textarea id={id} value={String(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.value})}/>:f.type==='select'?<select id={id} value={String(v)} disabled={disabled} onChange={e=>onChange({...value,[f.key]:e.target.value})}>{f.options?.map(o=><option key={o}>{o}</option>)}</select>:<input id={id} type={f.type==='number'?'number':f.type==='color'?'color':'text'} min={f.min} max={f.max} disabled={disabled} value={f.type==='ids'?(v as string[]).join(', '):v} onChange={e=>onChange({...value,[f.key]:f.type==='number'?Number(e.target.value):f.type==='ids'?e.target.value.split(',').map(s=>s.trim()).filter(Boolean):e.target.value})}/>} {f.hint&&<small>{f.hint}</small>}</label>;
  })}</div>;
}
export function Table({columns,rows,empty='Aucune donnée enregistrée.',actions}:{columns:{key:string;label:string;format?:(v:any,row:any)=>React.ReactNode}[];rows:any[];empty?:string;actions?:(row:any)=>React.ReactNode}){
  return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{actions&&<th>Actions</th>}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id??r.userId??i}>{columns.map(c=><td key={c.key}>{c.format?c.format(r[c.key],r):typeof r[c.key]==='object'?Array.isArray(r[c.key])?r[c.key].join(', '):'—':String(r[c.key]??'—')}</td>)}{actions&&<td><div className="row-actions">{actions(r)}</div></td>}</tr>):<tr><td colSpan={columns.length+(actions?1:0)}><div className="empty">{empty}</div></td></tr>}</tbody></table></div>;
}
export const date=(v:any)=>v?new Date(v).toLocaleString('fr-FR'):'—';
export const badge=(v:any)=><span className={`badge ${['active','open','done','accepted'].includes(v)?'green':['failed','rejected'].includes(v)?'red':''}`}>{String(v)}</span>;
