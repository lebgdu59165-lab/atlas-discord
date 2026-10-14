export type Me={id:string;name:string;avatar:string|null;csrf:string;owner:boolean};
export class ApiError extends Error{constructor(message:string,public status=0){super(message);this.name='ApiError';}}
export async function request(path:string,csrf?:string,method='GET',value?:unknown){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),method==='GET'?60000:30000);
  try{
    const res=await fetch(`/api/${path}`,{method,headers:{'Content-Type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},...(value!==undefined?{body:JSON.stringify(value)}:{}),cache:'no-store',signal:controller.signal});
    const raw=await res.text();let result:any;
    try{result=raw?JSON.parse(raw):{};}catch{throw new ApiError('Le site est en cours de démarrage ou temporairement indisponible. Réessayez dans quelques instants.',res.ok?503:res.status);}
    if(!res.ok)throw new ApiError(typeof result.error==='string'?result.error:'Cette action n’a pas pu aboutir. Réessayez dans quelques instants.',res.status);return result;
  }catch(error){if(error instanceof ApiError)throw error;if(controller.signal.aborted)throw new ApiError(method==='GET'?'Le chargement prend plus de temps que prévu. Vous pouvez actualiser la page.':'La confirmation de cette action tarde. Vérifiez le suivi des actions avant de la relancer.',504);throw new ApiError('La connexion au site a été interrompue. Vérifiez votre connexion, puis réessayez.');}
  finally{clearTimeout(timer);}
}
