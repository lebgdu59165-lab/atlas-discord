export const builtinCommands=[
  {name:'help',description:'Affiche les commandes disponibles et le tableau de bord',options:[{name:'commande',description:'Commande dont vous souhaitez consulter l’aide',type:3,required:false}]},
  {name:'ping',description:'Latence du bot'},
  {name:'uptime',description:'Temps de fonctionnement du bot'},
  {name:'stats',description:'Statistiques du bot sur ce serveur'},
  {name:'userinfo',description:'Informations sur un utilisateur',options:[{name:'membre',description:'Membre à consulter',type:6,required:false}]},
  {name:'serverinfo',description:'Informations sur le serveur'},
  {name:'avatar',description:'Affiche l’avatar d’un utilisateur',options:[{name:'membre',description:'Membre à consulter',type:6,required:false}]},
] as const;
export function commandsForSync(records:{title:string;data:unknown}[]){
  const commands=new Map<string,any>(builtinCommands.map(c=>[c.name,{...c}]));
  const names=new Set<string>();
  for(const r of records){const d=r.data as any;if(!d.enabled)continue;
    if(names.has(d.name))throw new Error('Deux commandes personnalisées portent le même nom. Modifiez leurs noms avant de synchroniser.');
    names.add(d.name);commands.set(d.name,{name:d.name,description:d.description||r.title});
  }
  return [...commands.values()];
}
