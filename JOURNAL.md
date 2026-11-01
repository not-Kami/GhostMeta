# Journal — GhostMeta

## 2026-10-29 — Reconstruction intégrale de GhostMeta (Wipe C2PA, Photos, Films, Audio)

- **Contexte** : Fichiers du projet corrompus (octets nuls suite à un incident disque). Demande de refonte complète de GhostMeta pour essuyer les métadonnées et spécialement les tags C2PA sur photos, films, png, etc.
- **Réalisations** :
  - `server.js` : Serveur HTTP Node.js natif ES Module sur le port 8780 avec types MIME complets et sécurité.
  - `serve.py` : Serveur Python 3 miroir sur le port 8780.
  - Sanitizers modulaires sous `js/sanitizer/` :
    - `jpeg.js` : Éradication des tags C2PA (APP11 JUMBF), EXIF, XMP, IPTC et commentaires.
    - `png.js` : Éradication des prompts IA (`tEXt`, `zTXt`, `iTXt` Stable Diffusion / ComfyUI / Midjourney), chunks `c2pa`, `eXIf`, `tIME` et nettoyage stéganographique post-IEND.
    - `webp.js` : Nettoyage des chunks EXIF, XMP, C2PA et mise à jour dynamique des flags d'en-tête VP8X.
    - `mp4.js` : Nettoyage des films/vidéos MP4/MOV : suppression des boîtes `c2pa`, `uuid` XMP/manifestes, `udta` (géolocalisation/appareil) et remise à zéro des horodatages.
    - `pdf.js` : Neutralisation sécurisée des dictionnaires `/Info` et flux `/Metadata`.
    - `audio.js` : Nettoyage MP3 (ID3v1/ID3v2/APE), WAV (LIST INFO) et FLAC (Vorbis Comment/Picture).
    - `index.js` : Détection automatique des formats et détection dédiée de la présence de tags C2PA.
  - `test/run-tests.js` : Suite complète de 7 tests unitaires couvrant tous les formats et le C2PA (7/7 validés avec succès).
  - UI Web (`index.html`, `css/styles.css`, `js/app.js`) : Interface moderne sombre avec drag-and-drop, badges spécifiques C2PA, téléchargement unitaire ou global en archive ZIP via JSZip.

## 2026-11-01 — Internationalisation en anglais & analyse d'éradication C2PA / Métadonnées

- **Contexte** : Demande de passage de l'interface en anglais et questionnement sur le niveau de certitude quant à l'éradication de toute trace.
- **Réalisations** :
  - Traduction intégrale en anglais de l'interface utilisateur dans [`index.html`](file:///d:/Projects/GhostMeta/index.html) et [`js/app.js`](file:///d:/Projects/GhostMeta/js/app.js) (badges, boutons, barre de statut, messages de nettoyage et formats).
  - Traduction des messages d'erreur et exceptions dans [`js/sanitizer/index.js`](file:///d:/Projects/GhostMeta/js/sanitizer/index.js).
  - Validation complète des tests unitaires (`7/7 passed`).

