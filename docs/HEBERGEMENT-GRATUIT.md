# Hébergement gratuit sans carte — déploiement et limites

Offres et consoles consultées le 12 octobre 2026. Contrainte retenue : aucune carte bancaire, aucun abonnement payant et un bot indépendant de la mise en veille du site.

## Architecture à valider

| Ressource | Fournisseur | Limites |
|---|---|---|
| Site, API et OAuth2 | Render Web Service Free | Mise en veille après 15 minutes sans trafic entrant ; bot séparé. |
| Bot Gateway | À déployer | Discloud refuse la création : capacité gratuite saturée (`NO_CLUSTER`). |
| PostgreSQL | Aiven Free | 1 Go de disque et RAM, connexions limitées ; arrêt possible après inactivité prolongée. |
| Redis | Upstash Free | atlas-redis créé à Francfort, 500 000 commandes/mois et 10 Go de trafic/mois. |

Sources : [Render](https://render.com/docs/free), [Discloud](https://discloud.com/plans), [Aiven](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier), [Upstash](https://upstash.com/pricing/redis).

Railway est bloqué par un essai expiré. Northflank exige une carte même sur Sandbox : cette voie est abandonnée. La base Aiven a été passée de Developer-1 sur **Free-1-1gb** et son état Running est confirmé. Le bandeau de crédits d’essai reste affiché au niveau du compte ; le service PostgreSQL utilise bien le plan gratuit, avec vingt connexions maximum.

## Connexions et secrets

Les deux services partagent DATABASE_URL, REDIS_URL, APP_URL, ENCRYPTION_KEY, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, OWNER_DISCORD_ID et les valeurs des intents, avec NODE_ENV=production. Les secrets et identifiants Discord sont renseignés dans le fichier local privé .env, exclu des archives publiques et du dépôt. Leur transfert à Render et Discloud a été autorisé ; tout autre hébergeur doit recevoir une autorisation distincte. N’envoyez aucun secret dans le chat.

Utilisez le certificat CA fourni par Aiven et une connexion SQL chiffrée avec validation du certificat. Limitez chaque processus à cinq connexions (`connection_limit=5`) et respectez le total autorisé dans la console. Redis doit utiliser `rediss://` avec un identifiant de lecture et écriture ; l’URL REST et le token de lecture seule ne conviennent pas.

## Site Render

Le code est publié dans le [dépôt GitHub public Atlas](https://github.com/lebgdu59165-lab/atlas-discord), rendu public avec autorisation après contrôle de l’absence des secrets. Le Blueprint **Atlas Discord** a créé le Web Service **atlas-dashboard**, environnement **Node 24**, région Francfort et instance **Free**, sans carte. Le déploiement est **Live** sur [le site Atlas](https://atlas-dashboard-vf3d.onrender.com). Compilation :

```sh
npm ci --include=dev --no-audit --no-fund && npm run build
```

Démarrage :

```sh
node scripts/start-hosted.mjs web
```

Le fichier render.yaml prépare aussi ces réglages pour un Blueprint : un seul Web Service Free, aucun service payant, et des champs privés à renseigner. La compilation inclut explicitement TypeScript et les outils CSS, même si NODE_ENV est configuré sur production. Le lanceur valide les secrets et le token Discord, applique les migrations Prisma puis démarre le web sur le port fourni par Render. Si APP_URL est absent, le web utilise RENDER_EXTERNAL_URL fourni par Render ; une valeur APP_URL explicite reste prioritaire. Configurez le contrôle de disponibilité sur /api/health : PostgreSQL et Redis doivent répondre, le champ bot contrôle séparément le heartbeat.

Le fichier local utilise APP_URL=https://atlas-dashboard-vf3d.onrender.com et NODE_ENV=production. Dans Discord, ajoutez exactement `https://atlas-dashboard-vf3d.onrender.com/api/auth/callback`, puis invitez le bot sur un serveur de test. Le parcours OAuth2 avec consentement utilisateur reste à vérifier.

## Bot Discloud

`npm run package:bot` produit le dossier voisin atlas-bot-discloud : bot compilé, configuration et fichiers Prisma, sans site ni secrets. La configuration demande TYPE=bot et RAM=100. Le web doit appliquer les migrations **avant** le lancement du bot.

Le bot s’exécute dans un seul processus, sans compilateur TypeScript ni migration au démarrage. Ne lancez qu’une seule instance ; arrêtez l’ancienne avant une mise à jour pour éviter les événements doubles.

Le test Gateway réel confirme la connexion à Discord avec **zéro serveur rejoint**, les intents membres et contenu des messages activés, et environ **80 à 88 Mo** de mémoire locale Windows. Le processus de test a ensuite été arrêté. Cela ne prouve pas la tenue sous 100 Mo sur Discloud. Mesurez la mémoire sur un vrai serveur avant de retenir ce plan. Le redémarrage automatique du fournisseur est réservé au plan Platinum ; Free ne garantit pas la récupération après un arrêt du processus. [Configuration officielle](https://docs.discloud.com/en/configurations/discloud.config).

La tentative réelle d’envoi du paquet configuré a échoué : Discloud retourne `NO_CLUSTER` et indique une forte demande de bots sur Free. **Aucune application bot n’a été créée.** Aucune offre payante n’a été choisie.

Une alternative est [Wispbyte](https://wispbyte.com/free-discord-bot-hosting), annoncé gratuit sans carte. Sa [page de connexion](https://wispbyte.com/client) exige toutefois une connexion au compte toutes les deux semaines pour garder un serveur gratuit actif. L’utilisateur a autorisé le transfert des secrets nécessaires à Wispbyte. La connexion au compte et les ressources disponibles restent à vérifier avant tout déploiement chez ce fournisseur.

Le bot est indépendant des visites du site, mais sa disponibilité permanente n’est pas encore validée. Aucun dispositif artificiel pour contourner la mise en veille Render n’est configuré.

## Recette et état

Redis réel : TLS, authentification, script de limitation et pub/sub vérifiés. PostgreSQL Aiven réel : connexion authentifiée avec TLS et validation du certificat réussie ; migration initiale appliquée. Tests locaux : 16 unitaires et 14 PostgreSQL réussis. Compilation du site et du bot exécutée.

Le site public et `/api/health` répondent HTTP 200. Le contrôle public indique PostgreSQL=true, Redis=true, OAuth configuré=true et bot=false. Le champ OAuth indique la présence de configuration, pas la réussite d’une connexion utilisateur. Le secret OAuth a été accepté par Discord via une authentification client de test ; le jeton temporaire a été révoqué. L’utilisateur indique avoir ajouté la redirection dans Discord. Restent : trouver une place d’hébergement gratuit pour le bot, vérifier la session OAuth2, inviter le bot et mesurer sa mémoire en charge.

```sh
node scripts/check-production.mjs --cloud --discord
node scripts/check-production.mjs --wait https://atlas-dashboard-vf3d.onrender.com/api/health
```

Ces contrôles exigent la base, Redis, la configuration OAuth2 et le heartbeat. Une connexion OAuth2 réelle et les permissions sur deux serveurs restent à tester. Les fonctions manquantes sont recensées dans COUVERTURE.md ; l’hébergement ne les ajoute pas.
