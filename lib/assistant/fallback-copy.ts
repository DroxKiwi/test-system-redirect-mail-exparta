/**
 * Affiché quand le modèle renvoie une chaîne vide / uniquement des espaces,
 * ou en secours côté client si la dernière partie texte est vide.
 */
export const FALLBACK_EMPTY_ASSISTANT_REPLY_FR = `Je n’ai pas reçu de réponse exploitable du modèle (réponse vide ou illisible).

**Comment me guider :**
- **Mails reçus** (dernier message, expéditeur, sujet, contenu) : précise par exemple « dernier mail », « expéditeur du dernier message », « mails contenant facture » — j’utilise **search_inbox** ou **db_read** sur l’entité \`inbound_message\` (liste triée par date, \`take: 1\` pour le plus récent).
- **Tables / base de données** : « quelles tables ? » → **db_list_entities**, puis **db_read** avec la clé \`entity\`.
- **Tout ce que je peux faire** : « liste les outils » → **assistant_help**.

Je n’invente pas les données : il faut toujours passer par un outil. Reformule ta question si tu veux un autre angle.`;

/**
 * Quand Ollama remplit `thinking` mais laisse `content` vide : la réflexion est déjà affichée dans le bloc « Réflexion ».
 */
export const ASSISTANT_THINKING_ONLY_BRIDGE_FR = `Le modèle n’a pas renvoyé de réponse rédigée dans le message principal (tu peux lire sa réflexion dans le bloc « Réflexion » juste au-dessus).

**À faire :** réessaie, ou formule une consigne explicite du type « appelle **assistant_help** » ou « cherche dans la boîte avec **search_inbox** » (mots-clés : alerte, sujet, expéditeur). Les appels d’outils doivent apparaître en JSON dans le corps du message du modèle, pas seulement dans la réflexion interne.`;
