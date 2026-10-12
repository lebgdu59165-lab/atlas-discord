# Hébergement gratuit et production

Recommandation vérifiée le **12 octobre 2026** : **Oracle Cloud Infrastructure Always Free**, dans les limites de votre compte et de la capacité disponible. Cette recommandation n’est pas une promesse de disponibilité permanente ou de SLA.

La documentation officielle consultée indique pour un compte Free Tier les ressources Ampere A1 équivalentes à **2 OCPU et 12 Go de mémoire au total**. Les anciens articles parlant de 4 OCPU/24 Go ne décrivent pas nécessairement le quota actuel d’un nouveau compte. Vérifiez toujours la mention **Always Free** et vos limites dans la console avant création. [Ressources Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Oracle demande une carte bancaire compatible pour vérifier l’identité. Une autorisation bancaire temporaire peut apparaître. Les ressources inactives peuvent être récupérées par Oracle et l’offre gratuite n’inclut pas de SLA. La disponibilité régionale varie. [FAQ officielle](https://www.oracle.com/cloud/free/faq/).

Un bot Discord permanent, Next.js, PostgreSQL et Redis peuvent partager une VM ARM Always Free suffisamment dimensionnée. C’est une proposition d’architecture à mesurer avec votre usage, pas un hébergement déjà créé. L’inscription et la vérification bancaire restent à effectuer par vous. Le projet n’a été déployé sur aucun compte cloud.

Render gratuit est peu adapté à cette plateforme permanente : les services web gratuits s’arrêtent après une période d’inactivité et PostgreSQL gratuit expire après 30 jours. [Limites officielles](https://render.com/docs/free).

## VM Oracle

1. Créez votre compte depuis [Oracle Cloud Free](https://www.oracle.com/cloud/free/).
2. Choisissez une région adaptée, puis une VM Ubuntu ARM/Ampere A1 portant la mention Always Free, dans vos quotas. Ne remplacez pas silencieusement cette forme par une ressource payante si la capacité manque.
3. Conservez votre clé SSH localement, activez MFA sur le compte cloud et préparez des sauvegardes hors de cette VM.
4. Autorisez l’entrée TCP 80 et 443 ; limitez SSH à votre adresse. Les ports PostgreSQL, Redis et Node ne doivent pas être publics.
5. Installez Docker Engine et Compose selon [le guide officiel Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Les images utilisées fonctionnent sur ARM64 et AMD64 ; la construction sur la VM reste à valider.
6. Copiez le dossier du projet sur la VM, sans `node_modules`, `.next` ni `.env` de développement.

## Domaine et HTTPS

Le fichier de production utilise Caddy pour les certificats TLS. Il faut un nom de domaine ou sous-domaine dont vous contrôlez les DNS ; un domaine peut être payant même si la machine est gratuite.

Faites pointer son enregistrement DNS A vers l’IP publique de votre VM. Depuis le projet :

```sh
node scripts/setup-env.mjs
```

Éditez `.env` : identifiants Discord, `DOMAIN`, `ACME_EMAIL`, `APP_URL=https://votre-domaine`, `NODE_ENV=production`. Ajoutez dans Discord `https://votre-domaine/api/auth/callback`.

```sh
sh scripts/deploy.sh
docker compose logs --tail=100 web bot
```

Le service `migrate` doit réussir avant le démarrage du web et du bot. Caddy transmet HTTP et WebSocket au service web. Le fichier de base expose uniquement les services de données et le web sur la boucle locale ; Caddy fournit l’accès HTTPS public.

Le script prépare `.env` s’il manque, puis s’arrête pour permettre de renseigner les identifiants. Il construit les images, vérifie les paramètres et demande à Discord si le token appartient bien à l’application déclarée. Il lance ensuite les services et attend la base de données, Redis et le heartbeat du bot. Il n’affiche aucune valeur secrète. Il ne crée pas votre compte Oracle, votre VM ou votre application Discord et ne modifie pas vos DNS. Le flux OAuth2 complet, les intents et l’accès HTTPS public restent à vérifier depuis un navigateur.

Si Node.js n’est pas installé sur Ubuntu, lancez directement `sh scripts/deploy.sh` avec Docker installé : le script peut générer la configuration avec l’image Node. Vous n’avez pas besoin d’installer Node sur la VM.

## Sauvegardes et mises à jour

```sh
sh scripts/backup.sh
```

Copiez les sauvegardes vers un stockage indépendant et chiffrez-les. Ne gardez pas l’unique sauvegarde sur la VM gratuite. Sauvegardez également `.env` dans un gestionnaire de secrets : perdre `ENCRYPTION_KEY` rend les tokens OAuth2 chiffrés illisibles.

Restauration d’une sauvegarde **dans une nouvelle base**, après arrêt des services et vérification de la cible :

```sh
docker compose exec -T postgres pg_restore -U atlas -d atlas --no-owner < backups/atlas-DATE.dump
```

`pg_restore` peut échouer si la base cible contient déjà le schéma : choisissez une base vide et testez la restauration avant de compter sur le plan de sauvegarde.

Avant une mise à jour : sauvegarde, tests, construction, revue des migrations, puis `docker compose ... up -d --build`. Surveillez les tâches échouées et le heartbeat du bot. Une panne pendant une opération Discord peut laisser l’action appliquée mais sa confirmation absente ; il faut vérifier Discord avant toute relance.

Le cahier des charges complet n’est pas livré dans cette version. N’annoncez pas l’ensemble des modules comme disponibles et effectuez la recette décrite dans TESTS.md avant ouverture à votre communauté.
