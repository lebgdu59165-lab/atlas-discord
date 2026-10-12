# Hébergement gratuit sans carte — préparation et limites

Offres et consoles consultées le 12 octobre 2026. Contrainte retenue : aucune carte bancaire, aucun abonnement payant et un bot indépendant de la mise en veille du site.

## Architecture à valider

| Ressource | Fournisseur | Limites |
|---|---|---|
| Site, API et OAuth2 | Render Web Service Free | Mise en veille après 15 minutes sans trafic entrant ; bot séparé. |
| Bot Gateway | Discloud Free | 100 Mo de mémoire ; tenue en charge non démontrée. |
| PostgreSQL | Aiven Free | 1 Go de disque et RAM, connexions limitées ; arrêt possible après inactivité prolongée. |
| Redis | Upstash Free | atlas-redis créé à Francfort, 500 000 commandes/mois et 10 Go de trafic/mois. |

Sources : [Render](https://render.com/docs/free), [Discloud](https://discloud.com/plans), [Aiven](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier), [Upstash](https://upstash.com/pricing/redis).

Railway est bloqué par un essai expiré. Northflank exige une carte même sur Sandbox : cette voie est abandonnée. La base Aiven a été passée de Developer-1 sur **Free-1-1gb** et son état Running est confirmé. Le bandeau de crédits d’essai reste affiché au niveau du compte ; le service PostgreSQL utilise bien le plan gratuit, avec vingt connexions maximum.

## Connexions et secrets

Les deux services partagent DATABASE_URL, REDIS_URL, APP_URL, ENCRYPTION_KEY, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, OWNER_DISCORD_ID et les valeurs des intents, avec NODE_ENV=production. La clé de chiffrement et la connexion Upstash TCP TLS sont enregistrées dans le fichier local privé .env, exclu des archives et du dépôt. Les identifiants Discord restent à renseigner. N’envoyez aucun secret dans le chat.

Utilisez le certificat CA fourni par Aiven et une connexion SQL chiffrée avec validation du certificat. Limitez chaque processus à cinq connexions (`connection_limit=5`) et respectez le total autorisé dans la console. Redis doit utiliser `rediss://` avec un identifiant de lecture et écriture ; l’URL REST et le token de lecture seule ne conviennent pas.

## Site Render

Le code est publié dans le [dépôt GitHub privé Atlas](https://github.com/lebgdu59165-lab/atlas-discord). L’application GitHub Render a été autorisée pour ce seul dépôt ; la connexion « Git Deployment Credentials » reste à terminer. Créez un **Web Service**, environnement **Node 24**, région Francfort et instance **Free**, sans carte. Compilation :

```sh
npm ci --include=dev --no-audit --no-fund && npm run build
```

Démarrage :

```sh
node scripts/start-hosted.mjs web
```

Le fichier render.yaml prépare aussi ces réglages pour un Blueprint : un seul Web Service Free, aucun service payant, et des champs privés à renseigner. La compilation inclut explicitement TypeScript et les outils CSS, même si NODE_ENV est configuré sur production. Le lanceur valide les secrets et le token Discord, applique les migrations Prisma puis démarre le web sur le port fourni par Render. Si APP_URL est absent, le web utilise RENDER_EXTERNAL_URL fourni par Render ; une valeur APP_URL explicite reste prioritaire. Configurez le contrôle de disponibilité sur /api/health : PostgreSQL et Redis doivent répondre, le champ bot contrôle séparément le heartbeat.

Reportez l’adresse HTTPS Render dans APP_URL des deux services. Dans Discord, ajoutez exactement APP_URL/api/auth/callback, invitez le bot sur un serveur de test et activez les intents nécessaires et autorisés.

## Bot Discloud

`npm run package:bot` produit le dossier voisin atlas-bot-discloud : bot compilé, configuration et fichiers Prisma, sans site ni secrets. La configuration demande TYPE=bot et RAM=100. Le web doit appliquer les migrations **avant** le lancement du bot.

Le bot s’exécute dans un seul processus, sans compilateur TypeScript ni migration au démarrage. Ne lancez qu’une seule instance ; arrêtez l’ancienne avant une mise à jour pour éviter les événements doubles.

Une mesure locale Windows donne environ 81 Mo après chargement du code et une connexion SQL, **avant Gateway et toute charge Discord**. Cela ne prouve pas la tenue sous 100 Mo sur Discloud. Mesurez la mémoire sur un vrai serveur avant de retenir ce plan. Le redémarrage automatique du fournisseur est réservé au plan Platinum ; Free ne garantit pas la récupération après un arrêt du processus. [Configuration officielle](https://docs.discloud.com/en/configurations/discloud.config).

Le bot est indépendant des visites du site, mais sa disponibilité permanente n’est pas encore validée. Aucun dispositif artificiel pour contourner la mise en veille Render n’est configuré.

## Recette et état

Redis réel : TLS, authentification, script de limitation et pub/sub vérifiés. PostgreSQL Aiven réel : connexion authentifiée avec TLS et validation du certificat réussie ; migration initiale appliquée. Tests locaux : 16 unitaires et 14 PostgreSQL réussis. Compilation du site et du bot exécutée.

Discloud est connecté et sa vérification humaine est terminée. Restent : terminer la liaison de déploiement GitHub dans Render, publier le web et le bot, renseigner Discord, inviter le bot et mesurer la mémoire. Aucune URL Atlas publique ni session OAuth2 ou Gateway réelle n’est validée.

```sh
node scripts/check-production.mjs --cloud --discord
node scripts/check-production.mjs --wait https://VOTRE-ADRESSE/api/health
```

Ces contrôles exigent la base, Redis, la configuration OAuth2 et le heartbeat. Une connexion OAuth2 réelle et les permissions sur deux serveurs restent à tester. Les fonctions manquantes sont recensées dans COUVERTURE.md ; l’hébergement ne les ajoute pas.
