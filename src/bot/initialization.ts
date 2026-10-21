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
