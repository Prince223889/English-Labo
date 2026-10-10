# Rappels : options sans connexion et SMS

## Option incluse, sans coût SMS

English Arena propose un réglage de rappel local et peut exporter un fichier de calendrier `.ics` pour créer un rendez-vous quotidien de 15 minutes. C'est la meilleure première option si le budget ou la couverture réseau est limité.

Le rappel du navigateur n'est pas garanti quand l'application ou le navigateur est fermé. Le système d'exploitation peut également limiter les notifications de PWA. Pour un rappel régulier fiable, utilise une application calendrier native et vérifie que l'alarme fonctionne sur le téléphone.

## Pourquoi les SMS nécessitent un service à part

Un navigateur statique ne peut pas envoyer un SMS de façon sécurisée : la clé du fournisseur ne doit jamais être placée dans `js/config.js` ou dans un dépôt public. Il faut un serveur/fonction planifiée, une base avec le consentement des élèves, un fournisseur compatible avec les opérateurs du Mali et un mécanisme de désinscription.

Twilio publie un tarif SMS de sortie vers le Mali sur sa page officielle; le tarif consulté le 9 octobre 2026 affichait environ **0,3485 USD par segment de SMS**, avant éventuels frais d'opérateur et changements de tarif. Ce coût peut vite être trop élevé pour une classe si un message est envoyé chaque jour. Vérifie toujours le tarif actuel et la délivrabilité locale avant de décider : https://www.twilio.com/fr-fr/sms/pricing/ml

## Recommandation

Commence avec le rappel calendrier / local. Quand le nombre d'élèves et le budget seront connus, ajoute un service SMS côté serveur avec des rappels opt-in, par exemple un résumé hebdomadaire plutôt qu'un SMS quotidien. Ne demande pas de numéro de téléphone si la classe n'a pas réellement besoin de SMS.
