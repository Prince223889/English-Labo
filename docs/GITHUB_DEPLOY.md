> **Version 2 :** les PDF ne sont plus dans le dépôt. Suis `LISEZ-MOI-DABORD.md` pour la publication et la sécurité.

# Publier English Arena sur GitHub Pages

Ce projet est une application statique : aucun `npm install` ni compilateur n'est nécessaire. Le dépôt qui contient le site doit être traité comme public, car GitHub Pages publie le site sur Internet même si le dépôt est privé avec un forfait compatible.

## 1. Préparer les fichiers

1. Télécharge puis décompresse `English_Arena_Terminale.zip` dans un dossier, par exemple `C:\Users\Prince\Desktop\EnglishArena`.
2. Vérifie que `index.html`, `css`, `js`, `assets` et `.github` sont directement à la racine de ce dossier.
3. Avant de publier, vérifie que tu as le droit de redistribuer tes PDF. Ils seront téléchargeables par toute personne qui connaît l'adresse du site.

## 2. Créer le dépôt GitHub

1. Connecte-toi à GitHub avec ton compte `Prince223889`.
2. Ouvre https://github.com/new.
3. Nom du dépôt : `english-arena`.
4. Choisis **Public** si tu utilises GitHub Free pour GitHub Pages. Ne coche pas l'option de création automatique d'un README, car le projet en possède déjà un.
5. Clique sur **Create repository**.

## 3. Envoyer les fichiers depuis PowerShell

Ouvre PowerShell dans le dossier décompressé. Adapte le chemin de la première commande si tu as choisi un autre dossier :

```powershell
cd C:\Users\Prince\Desktop\EnglishArena
git init
git add .
git status
git commit -m "Build English Arena learning PWA"
git branch -M main
git remote add origin https://github.com/Prince223889/english-arena.git
git push -u origin main
```

Si Git indique qu'il ne connaît pas ton identité, configure le nom et l'e-mail de commit depuis ton compte GitHub, puis relance `git commit`. Si `origin` existe déjà, ne répète pas `git remote add origin` : utilise `git remote -v` pour vérifier l'adresse.

Le fichier `tools-generate-codes.html` est volontairement ignoré par Git pour éviter d'exposer l'outil d'administration sur le site public. Il est bien inclus dans le ZIP; utilise-le localement avant le déploiement si tu actives le backend cloud.

## 4. Activer GitHub Pages

1. Ouvre `https://github.com/Prince223889/english-arena`.
2. Va dans **Settings → Pages**.
3. Sous **Build and deployment → Source**, choisis **GitHub Actions**.
4. Ouvre l'onglet **Actions** et vérifie le workflow nommé **Deploy English Arena to GitHub Pages**.
5. Quand le workflow termine avec succès, ouvre : `https://prince223889.github.io/english-arena/`.

Les prochaines modifications envoyées sur la branche `main` déclencheront automatiquement un nouveau déploiement. GitHub documente ce type de publication et les sites Pages sont publics sur Internet : https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 5. Installer l'application sur un téléphone

1. Ouvre l'adresse HTTPS publiée dans Chrome ou un navigateur compatible.
2. Attends le chargement initial complet; c'est à ce moment-là que la coquille de l'application est mise en cache.
3. Dans le menu du navigateur, choisis **Installer l'application** ou **Ajouter à l'écran d'accueil**, selon l'appareil.
4. Pour lire un PDF sans réseau, ouvre-le une première fois en étant connecté. Le navigateur pourra le conserver en cache; la place disponible et la politique de cache varient selon l'appareil.

## 6. Codes individuels et compteur partagé

En mode `local`, chaque appareil garde ses profils et ses progrès de son côté. Pour vérifier des codes individuels, synchroniser les progrès et compter les profils de toute la classe, suis `docs/CLOUD_SETUP.md` et configure un projet Supabase. Les PDF restent publics s'ils se trouvent dans ce dépôt : le code d'accès cloud ne protège pas leur URL directe.

Les SMS ne sont pas actifs dans cette version. Les rappels locaux et le fichier calendrier sont inclus; l'envoi SMS exige un service serveur, le consentement de chaque élève et un budget.
