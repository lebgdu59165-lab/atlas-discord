export type Me={id:string;name:string;avatar:string|null;csrf:string;owner:boolean};
export async function request(path:string,csrf?:string,method='GET',value?:unknown){
  const res=await fetch(`/api/${path}`,{method,headers:{'Content-Type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},...(value!==undefined?{body:JSON.stringify(value)}:{}),cache:'no-store'});
  const result=await res.json();if(!res.ok)throw new Error(result.error??'Service indisponible.');return result;
}
