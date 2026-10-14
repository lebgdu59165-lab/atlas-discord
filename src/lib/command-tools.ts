import {randomInt} from 'node:crypto';
import {AppError} from './errors';
export function positiveAmount(value:string,balance:number){
 const amount=value.toLowerCase()==='all'?balance:Number(value);
 if(!/^(?:all|[0-9]+)$/i.test(value)||!Number.isSafeInteger(amount)||amount<1||amount>1000000000)throw new AppError(400,'Indiquez un montant entier positif ou all.');return amount;
}
export function rollDice(value='1d6'){
 const match=/^(\d{1,2})d(\d{1,7})$/i.exec(value.trim());if(!match)throw new AppError(400,'Utilisez le format NdM, par exemple 2d6.');
 const count=Number(match[1]),faces=Number(match[2]);if(count<1||count>20||faces<2||faces>1000000)throw new AppError(400,'Limites : 1 à 20 dés, de 2 à 1 000 000 faces.');
 const rolls=Array.from({length:count},()=>randomInt(1,faces+1));return {rolls,total:rolls.reduce((a,b)=>a+b,0)};
}
export function calculate(expression:string){
 if(expression.length>200)throw new AppError(400,'Calcul trop long.');
 const input=expression.replace(/\*\*/g,'^'),tokens:string[]=[];let offset=0;
 while(offset<input.length){const space=/^\s+/.exec(input.slice(offset))?.[0];if(space){offset+=space.length;continue;}const token=/^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+\-*/%^])/i.exec(input.slice(offset))?.[0];if(!token)throw new AppError(400,'Expression arithmétique invalide.');tokens.push(token);offset+=token.length;}
 let at=0,depth=0;
 function expr(min=0):number{if(++depth>32)throw new AppError(400,'Calcul trop imbriqué.');let left:number;const t=tokens[at++];
  if(t==='+'||t==='-'){left=expr(2)*(t==='-'?-1:1);}else if(t==='('){left=expr();if(tokens[at++]!==')')throw new AppError(400,'Parenthèses invalides.');}else{left=Number(t);if(t===undefined||!Number.isFinite(left))throw new AppError(400,'Nombre invalide.');}
  const precedence:Record<string,number>={'+':1,'-':1,'*':2,'/':2,'%':2,'^':3};
  while(at<tokens.length&&(precedence[tokens[at]]??0)>min){const op=tokens[at++],p=precedence[op],right=expr(op==='^'?p-1:p);if((op==='/'||op==='%')&&right===0)throw new AppError(400,'Division par zéro.');left=op==='+'?left+right:op==='-'?left-right:op==='*'?left*right:op==='/'?left/right:op==='%'?left%right:left**right;if(!Number.isFinite(left))throw new AppError(400,'Résultat hors limites.');}
  depth--;return left;
 }
 const value=expr();if(at!==tokens.length)throw new AppError(400,'Expression arithmétique invalide.');return value;
}
export function decodeBase64(value:string){
 if(value.length>1000||!value.length||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new AppError(400,'Base64 invalide.');
 try{return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(value,'base64'));}catch{throw new AppError(400,'Le texte décodé n’est pas du UTF-8 valide.');}
}
