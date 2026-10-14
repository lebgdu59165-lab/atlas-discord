export type NativeCommandDefinition={name:string;description:string;category:string;options:any[]};
export const builtinCommands:NativeCommandDefinition[]=[
  {
    "name": "help",
    "description": "Affiche l'aide du bot",
    "options": [
      {
        "type": 3,
        "name": "commande",
        "description": "Nom de la commande à consulter",
        "max_length": 1000
      }
    ],
    "category": "Informations"
  },
  {
    "name": "ping",
    "description": "Latence du bot",
    "options": [],
    "category": "Informations"
  },
  {
    "name": "uptime",
    "description": "Temps de fonctionnement du bot",
    "options": [],
    "category": "Informations"
  },
  {
    "name": "stats",
    "description": "Statistiques du bot",
    "options": [],
    "category": "Informations"
  },
  {
    "name": "userinfo",
    "description": "Infos sur un utilisateur",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné"
      }
    ],
    "category": "Informations"
  },
  {
    "name": "serverinfo",
    "description": "Infos sur le serveur",
    "options": [],
    "category": "Informations"
  },
  {
    "name": "avatar",
    "description": "Affiche l'avatar d'un utilisateur",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné"
      }
    ],
    "category": "Informations"
  },
  {
    "name": "poll",
    "description": "Crée un sondage",
    "options": [
      {
        "type": 3,
        "name": "question",
        "description": "Votre question",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Communauté"
  },
  {
    "name": "ban",
    "description": "Bannir un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 3,
        "name": "raison",
        "description": "Motif de l’action",
        "max_length": 1000
      }
    ],
    "category": "Modération"
  },
  {
    "name": "unban",
    "description": "Débannir un utilisateur",
    "options": [
      {
        "type": 3,
        "name": "user_id",
        "description": "Identifiant Discord exact, copié comme texte",
        "required": true,
        "max_length": 1000
      },
      {
        "type": 3,
        "name": "raison",
        "description": "Motif de l’action",
        "max_length": 1000
      }
    ],
    "category": "Modération"
  },
  {
    "name": "kick",
    "description": "Expulser un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 3,
        "name": "raison",
        "description": "Motif de l’action",
        "max_length": 1000
      }
    ],
    "category": "Modération"
  },
  {
    "name": "mute",
    "description": "Mettre en sourdine un membre (timeout)",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 4,
        "name": "duree",
        "description": "Durée en minutes",
        "min_value": 1,
        "max_value": 40320
      },
      {
        "type": 3,
        "name": "raison",
        "description": "Motif de l’action",
        "max_length": 1000
      }
    ],
    "category": "Modération"
  },
  {
    "name": "unmute",
    "description": "Retirer le mute d'un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      }
    ],
    "category": "Modération"
  },
  {
    "name": "warn",
    "description": "Avertir un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 3,
        "name": "raison",
        "description": "Motif de l’action",
        "max_length": 1000
      }
    ],
    "category": "Modération"
  },
  {
    "name": "warns",
    "description": "Voir les avertissements d'un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné"
      }
    ],
    "category": "Modération"
  },
  {
    "name": "clearwarns",
    "description": "Supprimer les warns d'un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      }
    ],
    "category": "Modération"
  },
  {
    "name": "clear",
    "description": "Supprimer des messages",
    "options": [
      {
        "type": 4,
        "name": "nombre",
        "description": "Nombre de messages (1 à 100)",
        "min_value": 1,
        "max_value": 100
      },
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné"
      }
    ],
    "category": "Modération"
  },
  {
    "name": "slowmode",
    "description": "Définir le slowmode d'un salon",
    "options": [
      {
        "type": 4,
        "name": "secondes",
        "description": "Secondes entre deux messages (0 à 21600)",
        "min_value": 0,
        "max_value": 21600
      }
    ],
    "category": "Modération"
  },
  {
    "name": "lock",
    "description": "Verrouiller un salon",
    "options": [
      {
        "type": 7,
        "name": "salon",
        "description": "Salon Discord concerné",
        "channel_types": [
          0,
          5
        ]
      }
    ],
    "category": "Modération"
  },
  {
    "name": "unlock",
    "description": "Déverrouiller un salon",
    "options": [
      {
        "type": 7,
        "name": "salon",
        "description": "Salon Discord concerné",
        "channel_types": [
          0,
          5
        ]
      }
    ],
    "category": "Modération"
  },
  {
    "name": "nick",
    "description": "Changer le pseudo d'un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 3,
        "name": "pseudo",
        "description": "Nouveau pseudo (32 caractères maximum)",
        "max_length": 32
      }
    ],
    "category": "Modération"
  },
  {
    "name": "rank",
    "description": "Affiche ton niveau et XP",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné"
      }
    ],
    "category": "Niveaux"
  },
  {
    "name": "leaderboard",
    "description": "Top 10 des membres",
    "options": [],
    "category": "Niveaux"
  },
  {
    "name": "givexp",
    "description": "Donner de l'XP à un membre (admin)",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 4,
        "name": "quantite",
        "description": "Quantité d’XP",
        "required": true,
        "min_value": 1,
        "max_value": 1000000
      }
    ],
    "category": "Niveaux"
  },
  {
    "name": "resetxp",
    "description": "Remettre l'XP d'un membre à 0 (admin)",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      }
    ],
    "category": "Niveaux"
  },
  {
    "name": "join",
    "description": "Rejoindre ton salon vocal",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "play",
    "description": "Jouer une musique (YouTube, recherche ou fichier audio Discord)",
    "options": [
      {
        "type": 3,
        "name": "recherche",
        "description": "Titre, lien YouTube ou lien d’un fichier audio Discord",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Musique"
  },
  {
    "name": "pause",
    "description": "Mettre en pause",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "resume",
    "description": "Reprendre la lecture",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "skip",
    "description": "Passer à la musique suivante",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "stop",
    "description": "Arrêter la musique et vider la file",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "queue",
    "description": "Voir la file d'attente",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "volume",
    "description": "Régler le volume (0-100)",
    "options": [
      {
        "type": 4,
        "name": "niveau",
        "description": "Volume (0 à 100)",
        "required": true,
        "min_value": 0,
        "max_value": 100
      }
    ],
    "category": "Musique"
  },
  {
    "name": "loop",
    "description": "Activer/désactiver la répétition",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "nowplaying",
    "description": "Voir la musique en cours",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "remove",
    "description": "Retirer un morceau de la file",
    "options": [
      {
        "type": 4,
        "name": "position",
        "description": "Position dans la file, à partir de 1",
        "required": true,
        "min_value": 1,
        "max_value": 100
      }
    ],
    "category": "Musique"
  },
  {
    "name": "shuffle",
    "description": "Mélanger la file d'attente",
    "options": [],
    "category": "Musique"
  },
  {
    "name": "8ball",
    "description": "Pose une question à la boule magique",
    "options": [
      {
        "type": 3,
        "name": "question",
        "description": "Votre question",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Divertissement"
  },
  {
    "name": "coinflip",
    "description": "Pile ou face !",
    "options": [],
    "category": "Divertissement"
  },
  {
    "name": "roll",
    "description": "Lancer un dé",
    "options": [
      {
        "type": 3,
        "name": "des",
        "description": "Format NdM, par exemple 2d6",
        "max_length": 1000
      }
    ],
    "category": "Divertissement"
  },
  {
    "name": "joke",
    "description": "Une blague aléatoire",
    "options": [],
    "category": "Divertissement"
  },
  {
    "name": "meme",
    "description": "Un mème aléatoire",
    "options": [],
    "category": "Divertissement"
  },
  {
    "name": "ship",
    "description": "Compatibilité amoureuse",
    "options": [
      {
        "type": 6,
        "name": "personne1",
        "description": "Premier membre",
        "required": true
      },
      {
        "type": 6,
        "name": "personne2",
        "description": "Second membre"
      }
    ],
    "category": "Divertissement"
  },
  {
    "name": "giveaway",
    "description": "Lancer un giveaway",
    "options": [
      {
        "type": 4,
        "name": "duree",
        "description": "Durée en minutes",
        "required": true,
        "min_value": 1,
        "max_value": 43200
      },
      {
        "type": 4,
        "name": "gagnants",
        "description": "Nombre de gagnants (1 à 100)",
        "required": true,
        "min_value": 1,
        "max_value": 100
      },
      {
        "type": 3,
        "name": "prix",
        "description": "Lot à gagner",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Communauté"
  },
  {
    "name": "balance",
    "description": "Voir ton solde",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné"
      }
    ],
    "category": "Économie"
  },
  {
    "name": "daily",
    "description": "Collecter ta récompense quotidienne",
    "options": [],
    "category": "Économie"
  },
  {
    "name": "work",
    "description": "Travailler pour gagner des pièces",
    "options": [],
    "category": "Économie"
  },
  {
    "name": "pay",
    "description": "Envoyer des pièces à quelqu'un",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 4,
        "name": "montant",
        "description": "Montant entier positif (ou all pour tout)",
        "required": true
      }
    ],
    "category": "Économie"
  },
  {
    "name": "deposit",
    "description": "Déposer des pièces à la banque",
    "options": [
      {
        "type": 3,
        "name": "montant",
        "description": "Montant entier positif (ou all pour tout)",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Économie"
  },
  {
    "name": "withdraw",
    "description": "Retirer des pièces de la banque",
    "options": [
      {
        "type": 3,
        "name": "montant",
        "description": "Montant entier positif (ou all pour tout)",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Économie"
  },
  {
    "name": "gamble",
    "description": "Parier des pièces",
    "options": [
      {
        "type": 3,
        "name": "montant",
        "description": "Montant entier positif (ou all pour tout)",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Économie"
  },
  {
    "name": "richesse",
    "description": "Top 10 des membres les plus riches",
    "options": [],
    "category": "Économie"
  },
  {
    "name": "shop",
    "description": "Voir la boutique",
    "options": [],
    "category": "Économie"
  },
  {
    "name": "prefix",
    "description": "Changer le préfixe du bot",
    "options": [
      {
        "type": 3,
        "name": "nouveau_prefix",
        "description": "Préfixe texte (1 à 5 caractères)",
        "required": true,
        "max_length": 5
      }
    ],
    "category": "Configuration"
  },
  {
    "name": "setlog",
    "description": "Définir le salon de logs",
    "options": [
      {
        "type": 7,
        "name": "salon",
        "description": "Salon Discord concerné",
        "channel_types": [
          0,
          5
        ]
      }
    ],
    "category": "Configuration"
  },
  {
    "name": "setwelcome",
    "description": "Configurer le message de bienvenue",
    "options": [
      {
        "type": 7,
        "name": "salon",
        "description": "Salon Discord concerné",
        "required": true,
        "channel_types": [
          0,
          5
        ]
      },
      {
        "type": 3,
        "name": "message",
        "description": "Texte du message",
        "max_length": 1000
      }
    ],
    "category": "Configuration"
  },
  {
    "name": "autorole",
    "description": "Rôle attribué automatiquement aux nouveaux membres",
    "options": [
      {
        "type": 8,
        "name": "role",
        "description": "Rôle Discord concerné"
      }
    ],
    "category": "Configuration"
  },
  {
    "name": "setxp",
    "description": "Activer/désactiver le système XP",
    "options": [
      {
        "type": 5,
        "name": "actif",
        "description": "Activer le système de niveaux",
        "required": true
      }
    ],
    "category": "Configuration"
  },
  {
    "name": "config",
    "description": "Voir la configuration du serveur",
    "options": [],
    "category": "Configuration"
  },
  {
    "name": "role",
    "description": "Ajouter/retirer un rôle à un membre",
    "options": [
      {
        "type": 6,
        "name": "membre",
        "description": "Membre Discord concerné",
        "required": true
      },
      {
        "type": 8,
        "name": "role",
        "description": "Rôle Discord concerné",
        "required": true
      }
    ],
    "category": "Rôles"
  },
  {
    "name": "createrole",
    "description": "Créer un nouveau rôle",
    "options": [
      {
        "type": 3,
        "name": "nom",
        "description": "Nom du rôle",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Rôles"
  },
  {
    "name": "deleterole",
    "description": "Supprimer un rôle",
    "options": [
      {
        "type": 8,
        "name": "role",
        "description": "Rôle Discord concerné",
        "required": true
      }
    ],
    "category": "Rôles"
  },
  {
    "name": "announce",
    "description": "Faire une annonce dans un salon",
    "options": [
      {
        "type": 7,
        "name": "salon",
        "description": "Salon Discord concerné",
        "required": true,
        "channel_types": [
          0,
          5
        ]
      },
      {
        "type": 3,
        "name": "message",
        "description": "Texte du message",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Communauté"
  },
  {
    "name": "embed",
    "description": "Créer un embed personnalisé",
    "options": [
      {
        "type": 3,
        "name": "titre",
        "description": "Titre du message",
        "required": true,
        "max_length": 1000
      },
      {
        "type": 3,
        "name": "description",
        "description": "Description du message",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Communauté"
  },
  {
    "name": "remind",
    "description": "Se fixer un rappel",
    "options": [
      {
        "type": 4,
        "name": "duree",
        "description": "Durée en minutes",
        "required": true,
        "min_value": 1,
        "max_value": 43200
      },
      {
        "type": 3,
        "name": "message",
        "description": "Texte du message",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Communauté"
  },
  {
    "name": "meteo",
    "description": "Météo d'une ville (wttr.in)",
    "options": [
      {
        "type": 3,
        "name": "ville",
        "description": "Nom de la ville",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Outils"
  },
  {
    "name": "calc",
    "description": "Calculatrice simple",
    "options": [
      {
        "type": 3,
        "name": "expression",
        "description": "Calcul : nombres, parenthèses, + - * / % ^",
        "required": true,
        "max_length": 200
      }
    ],
    "category": "Outils"
  },
  {
    "name": "color",
    "description": "Afficher une couleur hexadécimale",
    "options": [
      {
        "type": 3,
        "name": "hex_code",
        "description": "Couleur au format #RRGGBB",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Outils"
  },
  {
    "name": "encode",
    "description": "Encoder du texte en base64",
    "options": [
      {
        "type": 3,
        "name": "texte",
        "description": "Texte à convertir",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Outils"
  },
  {
    "name": "decode",
    "description": "Décoder du base64",
    "options": [
      {
        "type": 3,
        "name": "texte",
        "description": "Texte à convertir",
        "required": true,
        "max_length": 1000
      }
    ],
    "category": "Outils"
  }
];
export function commandsForSync(records:{title:string;data:unknown}[],disabled:string[]=[]){
 const commands=new Map<string,any>(builtinCommands.filter(c=>!disabled.includes(c.name)).map(({category,...c})=>[c.name,c]));
 const names=new Set<string>();
 for(const r of records){const d=r.data as any;if(!d.enabled)continue;if(names.has(d.name))throw new Error('Deux commandes personnalisées portent le même nom. Modifiez leurs noms avant de synchroniser.');names.add(d.name);commands.set(d.name,{name:d.name,description:String(d.description||r.title).slice(0,100)});}
 return [...commands.values()];
}
