# TODO — GhostMeta

- [x] Restauration complète du projet GhostMeta après corruption du disque
- [x] Implémentation du sanitizer JPEG (EXIF, XMP, IPTC, APP11 C2PA, COM)
- [x] Implémentation du sanitizer PNG (tEXt, zTXt, iTXt, eXIf, c2pa, suppression stéganographie post-IEND)
- [x] Implémentation du sanitizer WebP (EXIF, XMP, c2pa, correction des flags VP8X)
- [x] Implémentation du sanitizer Vidéo / Film MP4 & MOV (c2pa, uuid, udta, timestamps mvhd/tkhd)
- [x] Implémentation du sanitizer PDF (/Metadata streams, /Info dictionary)
- [x] Implémentation du sanitizer Audio (MP3 ID3v1/ID3v2, WAV INFO, FLAC Vorbis/Picture)
- [x] Serveur local Node.js `server.js` (Port 8780)
- [x] Serveur local Python `serve.py` (Port 8780)
- [x] Interface utilisateur Web moderne avec drag & drop, mise en évidence des tags C2PA et téléchargement ZIP
- [x] Traduction complète de l'application en anglais (UI, tags, logs et formats)
- [x] Suite de tests automatisée `test/run-tests.js`
- [ ] Ajout d'options de configuration avancées (sélection manuelle des métadonnées à préserver)
