// Keep each service within the shared database budget; preserve managed TLS options.
export function databaseOptions(databaseUrl?:string):{datasourceUrl?:string;transactionOptions:{maxWait:number;timeout:number}}{
 const transactionOptions={maxWait:10000,timeout:20000};if(!databaseUrl)return {transactionOptions};
 let url:URL;try{url=new URL(databaseUrl);}catch{throw new Error('La connexion à la base de données est mal configurée.');}
 if(!url.searchParams.has('connection_limit'))url.searchParams.set('connection_limit','4');
 if(!url.searchParams.has('pool_timeout'))url.searchParams.set('pool_timeout','10');
 return {datasourceUrl:url.toString(),transactionOptions};
}
