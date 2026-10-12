# Installation

## Prérequis

Node.js 24, npm, Docker Desktop avec Compose sur Windows ou Docker Engine avec Compose sur Linux. Une application créée dans [Discord Developer Portal](https://discord.com/developers/applications), un serveur de test sur lequel vous êtes administrateur et l’autorisation d’ajouter un bot.

Les inscriptions et les clés doivent être créées par le propriétaire. Ne collez pas de token dans le chat, un ticket, une capture ou Git.

## Application Discord

1. Créez une application, puis son bot.
2. Dans OAuth2, ajoutez exactement `http://localhost:3000/api/auth/callback` pour le développement ; utilisez votre domaine HTTPS en production.
3. Renseignez l’identifiant d’application dans `DISCORD_CLIENT_ID`, le secret OAuth2 dans `DISCORD_CLIENT_SECRET`, et le token du bot dans `DISCORD_BOT_TOKEN`.
4. Activez **Server Members Intent** pour arrivées, départs et autorôles. Activez **Message Content Intent** pour les règles de contenu. Le code ne contourne pas les restrictions d’intents ; une application soumise à vérification doit obtenir les approbations Discord nécessaires.
5. Laissez `DISCORD_PRESENCE_INTENT=false` si vous ne disposez pas de cette intention. Le site affichera les présences comme indisponibles.
6. Activez le mode développeur dans Discord, copiez votre identifiant utilisateur et renseignez `OWNER_DISCORD_ID`.
7. L’invitation demande des permissions spécifiques, sans Administrator. Placez le rôle du bot au-dessus des rôles qu’il doit gérer. Le bot ne peut pas agir sur le propriétaire ni sur les rôles de rang égal ou supérieur.

Documentation officielle : [OAuth2](https://docs.discord.com/developers/topics/oauth2), [permissions](https://docs.discord.com/developers/topics/permissions), [Gateway et intents](https://docs.discord.com/developers/events/gateway).

## Configuration locale

Depuis le dossier du projet :

```sh
node scripts/setup-env.mjs
```

Le script refuse d’écraser un `.env` existant. Il crée un mot de passe PostgreSQL et une clé de chiffrement aléatoires, puis configure `DATABASE_URL`. Renseignez les quatre valeurs Discord manquantes.

Sur Windows, les commandes suivantes fonctionnent dans PowerShell :

```powershell
docker compose up -d postgres redis
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

Dans un autre terminal, au même emplacement :

```powershell
npm run dev:bot
```

Ouvrez le site sur `http://localhost:3000`. La page d’accueil affiche l’état réel de PostgreSQL, Redis, OAuth2 et du bot. Une valeur « À configurer » ne signifie pas que la fonctionnalité a été testée ou simulée.

## Premier serveur

Connectez-vous avec Discord, choisissez votre serveur, invitez le bot si nécessaire et attendez sa synchronisation. Pour chaque module, enregistrez la configuration avant de publier un panneau ou lancer une action. Les tâches apparaissent dans « Suivi d’exécution » : `queued`, `running`, `done` ou `failed`. Une tâche en attente n’est pas une confirmation d’exécution.

Tickets : créez une catégorie privée et un rôle de support, configurez leurs identifiants, créez un panneau avec son salon, puis publiez-le. L’ouverture se fait avec le bouton Discord. Les transcriptions conservent les auteurs et dates ; le contenu est masqué tant que « Conserver le contenu des messages » est désactivé dans Logs. La limite explicite est de 5 000 messages par transcription.

Commandes : créez une commande dans le dashboard, puis utilisez « Synchroniser ». La synchronisation remplace les commandes de cette application sur ce serveur. Elle ne modifie pas celles des autres bots.

Membres communautaires : ils peuvent accéder à `/community/IDENTIFIANT_DU_SERVEUR`, se connecter, voter, candidater, participer aux événements et utiliser l’économie. Les routes vérifient leur appartenance au serveur côté serveur.

## Assistant IA facultatif

Renseignez `AI_API_KEY` et, si nécessaire, `AI_BASE_URL` côté serveur. Configurez le modèle, la base de connaissances et le quota dans le dashboard. Activez explicitement l’envoi externe. Le fournisseur peut facturer les requêtes : l’hébergement gratuit ne fournit aucun abonnement IA. Le système limite les requêtes et les tokens de sortie ; il ne mesure pas encore une dépense monétaire exacte.

## Erreurs courantes

| Erreur | Vérification |
|---|---|
| Redirection OAuth2 refusée | `APP_URL` et URL déclarée dans Discord doivent correspondre exactement. |
| Session refusée | Redis et PostgreSQL actifs, cookie de session présent, origine du formulaire identique à `APP_URL`. |
| Accès interdit au serveur | Appartenance Discord actuelle, Administrator ou permission déléguée, bot installé. |
| Timeout/ban/rôle refusé | Permissions Discord du bot et hiérarchie du membre/rôle cible. |
| Bot déconnecté | Token, intents autorisés et journaux du processus bot. |
| Tâche interrompue | Vérifier Discord avant de lancer une nouvelle action ; les actions irréversibles ne sont pas rejouées automatiquement. |
| Configuration conflictuelle | Une autre personne l’a modifiée. Recharger avant de sauvegarder. |
| Statut FiveM refusé | Endpoint HTTPS public sur port 443, JSON valide, sans redirection. Les IP privées sont interdites. |
