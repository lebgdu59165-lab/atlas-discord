# Atlas — Bot Discord et tableau de bord

**Version initiale 0.1, fonctionnelle sur les parcours implémentés. Ce projet ne satisfait pas encore 100 % du cahier des charges fourni.** Les fonctions partielles et absentes sont détaillées dans [la couverture fonctionnelle](docs/COUVERTURE.md) et dans le site. Aucune donnée de démonstration n’est injectée. Un formulaire sauvegarde de vraies données ; une action Discord est confirmée seulement lorsque le bot l’a exécutée.

Stack : Next.js 16, React 19, TypeScript, Tailwind 4, Radix Dialog, Node.js 24, discord.js 14, PostgreSQL, Prisma 6, Redis et Socket.IO. Les versions exactes et leurs dépendances sont verrouillées dans `package-lock.json`.

- [Installation locale](docs/INSTALLATION.md)
- [Hébergement gratuit sans carte](docs/HEBERGEMENT-GRATUIT.md)
- [Hébergement gratuit Oracle et déploiement HTTPS](docs/HEBERGEMENT.md)
- [Architecture, sécurité et API](docs/ARCHITECTURE.md)
- [Tests automatisés et recette Discord](docs/TESTS.md)
- [Notifications automatiques Twitch](docs/TWITCH.md)
- [Panneau de contrôle directement dans Discord](docs/DASHBOARD-DISCORD.md)
- [Couverture et développements restants](docs/COUVERTURE.md)

## Démarrage

Installez Node.js 24 et Docker avec Compose, puis dans ce dossier :

```sh
node scripts/setup-env.mjs
```

Renseignez `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` et `OWNER_DISCORD_ID` dans `.env`. Pour le développement, laissez `APP_URL=http://localhost:3000`. Déclarez dans Discord la redirection `http://localhost:3000/api/auth/callback`.

```sh
docker compose up -d postgres redis
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

Dans un second terminal :

```sh
npm run dev:bot
```

Ouvrez `http://localhost:3000`, connectez-vous avec Discord, invitez le bot puis sélectionnez un serveur. Pour le déploiement complet, suivez le guide HTTPS plutôt que d’exposer le serveur de développement.

## Vérification effectuée

Le [site Atlas](https://atlas-dashboard-vf3d.onrender.com) est publié sur Render Free, connecté à PostgreSQL Aiven et Redis Upstash. Le bot est hébergé sur Wispbyte Free et sa connexion Gateway à un serveur Discord est confirmée. Le contrôle public a validé la base, Redis, la configuration OAuth et le heartbeat du bot. Reconnectez-vous au compte Wispbyte au moins toutes les deux semaines pour garder le serveur gratuit actif ; la disponibilité continue n’est pas garantie. Le parcours OAuth2 utilisateur et les actions sur votre serveur restent à valider. Compilation Next.js, TypeScript, 16 tests unitaires et 14 tests PostgreSQL réussis. Docker n’est pas installé sur la machine. Voir `VERIFICATION.md`, `docs/HEBERGEMENT-GRATUIT.md` et `docs/COUVERTURE.md` pour l’état exact et les fonctions manquantes.

Les secrets ne sont jamais inclus dans l’archive. `scripts/setup-env.mjs` génère les secrets locaux sans les imprimer. L’archive ne contient ni bases de données, ni dépendances installées, ni données de test.
