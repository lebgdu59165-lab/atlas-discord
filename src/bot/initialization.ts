// Only fixed labels are logged: database errors can contain private connection URLs.
export function initializationErrorReason(error:unknown){
 const message=error instanceof Error?error.message:'';
 if(/certificate|ssl|tls/i.test(message))return 'tls';
 if(/authentication|password|P1000/i.test(message))return 'authentication';
 if(/ENOTFOUND|EAI_AGAIN|name resolution/i.test(message))return 'dns';
 if(/can[’']t reach|ECONNREFUSED|ETIMEDOUT|timed out|P1001|P1002/i.test(message))return 'unreachable';
 if(/permission denied|access denied/i.test(message))return 'permission';
 return 'unavailable';
}
// A dependency outage during ClientReady must not leave the bot half-started.
export function initializeWithRetry(initialize:()=>Promise<void>,onError:(error:unknown)=>void,delayMs=15000){
 let stopped=false,ready=false,timer:ReturnType<typeof setTimeout>|undefined;
 async function attempt(){
  try{await initialize();if(!stopped)ready=true;}
  catch(error){if(stopped)return;onError(error);timer=setTimeout(()=>void attempt(),delayMs);timer.unref?.();}
 }
 void attempt();
 return {isReady:()=>ready,stop(){stopped=true;ready=false;if(timer)clearTimeout(timer);}};
}
