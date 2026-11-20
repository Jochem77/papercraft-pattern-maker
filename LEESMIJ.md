# Papercraft Pattern Maker

Maakt van een low-poly 3D-model (STL, OBJ of GLB) een bouwplaat van papier, met plakstrookjes, randnummers en vouwlijnen. Jij bepaalt waar de stukken geknipt worden.

Werkt helemaal in je browser: niets installeren, geen account, en je modellen verlaten je computer niet. De standaardtaal is Engels; kies **Help → Language → Nederlands** (of Instellingen → Algemeen) voor Nederlands.

> **Bèta:** dit is een bètaversie. Het werkt, maar er zitten waarschijnlijk nog bugs in. [Meld problemen](https://github.com/Jochem77/papercraft-pattern-maker/issues/new/choose) graag; daarmee wordt versie 1.0 degelijk.

[English version → README.md](README.md)

![Papercraft Pattern Maker: 3D-weergave met het geselecteerde stuk, en het uitgevouwen patroon op A4-pagina's](docs/screenshot.png)

## Starten

Open **`index.html`** in Chrome, Edge, Firefox of Safari. De eerste keer is internet nodig om [three.js](https://threejs.org) (de 3D-weergave) te laden.

## Werkwijze

1. **Openen**: kies een model, of sleep het in het venster. GLB-materialen worden de kleuren in het patroon. Heeft het model meer dan 2.000 driehoeken, dan kun je het eerst vereenvoudigen; de 3D-weergave toont meteen het resultaat.
2. **Automatisch knippen** gebeurt meteen. Het model wordt verdeeld in zo groot mogelijke stukken:
   - elk stuk past op het papier, binnen de marges;
   - er is geen overlap;
   - elk plakstrookje heeft genoeg ruimte.
3. Pas het aan met het gereedschap in de werkbalk (beweeg de muis over een pictogram voor de naam):
   - **Selecteren** (S): een stuk aanklikken, verslepen, draaien met Q/E (met Shift 90°).
   - **Knippen** (K): klik bij een rand om te knippen of te verbinden. Shift+klik zet de plakstrook aan de andere kant; Alt+klik knipt ook randen binnen een plat vlak.
   - **Kleuren** (B): vlakken een andere kleur geven. **Mini-vlakjes herstellen** lost losse foutjes in de kleuren op.
4. Onder **Instellingen** kies je onder meer:
   - de afmetingen van het model;
   - het papier (A4 of A3) en de marges;
   - de plakstrookjes;
   - het lettertype en de grootte van de nummers;
   - de opties voor de snijplotter.
5. **PDF** downloadt het patroon op ware grootte (1:1). Print op **100% / werkelijke grootte** en meet de controlelijn van 50 mm na.
6. **Snijplotter** geeft een ZIP met één SVG per pagina, in mm. De lagen zijn `print`, `snijden` (gesloten contouren) en `rillen` of `perforeren`.
7. **Opslaan** bewaart het model én al je aanpassingen in één `.papercraft.json`-bestand.

Onder **Help** (F1) staan alle bediening en sneltoetsen.

## Lijnen en nummers in het patroon

| Wat je ziet | Betekenis |
|---|---|
| doorgetrokken lijn | knippen |
| streepjes | dalvouw (naar je toe) |
| stippen | bergvouw (van je af) |
| zelfde randnummer | deze randen worden op elkaar geplakt |
| nummer in een rondje | stuknummer (ook zichtbaar in 3D) |
| rood vlak of rode strook | overlap, of een strook zonder ruimte |
| oranje rand | stuk valt buiten het printgebied of over een ander stuk |

## Silhouette Print & Cut

1. Zet **Instellingen → Snijplotter → Registratiemarkeringen (Type 1)** aan.
2. Neem in Silhouette Studio bij **Printen & snijden** dezelfde lengte, lijndikte en inzet over, en zet het paginaformaat op hetzelfde papier. De waarden staan ook onderaan elke PDF-pagina.
3. Print de PDF op 100%.
4. Open in Studio de SVG van dezelfde pagina, laat de rode laag `snijden` snijden, en laat de machine de markeringen lezen.

## Bekende problemen

- De 3D-weergave heeft de eerste keer internet nodig (three.js via een CDN).
- Vooral getest in Chrome en Edge op Windows. Firefox, Safari en touchscreens zijn minder getest.
- Een model met meer dan zo'n 5.000 driehoeken uitvouwen is traag en geeft veel kleine stukjes. Vereenvoudig het (Model → Model vereenvoudigen…) of maak een low-poly versie in een 3D-programma zoals Blender (*Decimate*-modifier) voor het mooiste resultaat.
- Randnummers kunnen elkaar overlappen bij heel scherpe hoeken.
- OBJ-bestanden worden als Y-omhoog gelezen.

## Problemen melden

Een bug gevonden of een idee? Maak een [issue](https://github.com/Jochem77/papercraft-pattern-maker/issues/new/choose) aan.

Vermeld de versie (Help → About) en je browser. Voeg als het kan het model of een opgeslagen project (`.papercraft.json`) toe.

## Ontwikkeling

- `src/core.js`: rekenkern (inlezen, uitvouwen, plakstrookjes, nesting). Werkt ook in Node.
- `src/app.html`: interface.
- `node tools/build.js`: bouwt `index.html`, één los bestand.
- `node tools/browsertest.js pad/naar/model`: headless test in Chrome of Edge.
- `node tools/release.js`: nieuwe versie, changelog, tag en GitHub-release.
- `node --test`: unit-tests van de rekenkern (ook automatisch op GitHub Actions).

## Versies en releasenotes

Het project volgt [Semantic Versioning](https://semver.org). Wat er per versie veranderd is, staat in [CHANGELOG.md](CHANGELOG.md) en op de [Releases-pagina](https://github.com/Jochem77/papercraft-pattern-maker/releases). De versie van het programma zie je onder **Help → About**.

Een nieuwe versie uitbrengen:

1. Beschrijf de wijzigingen onder `## [Unreleased]` in `CHANGELOG.md` en commit ze.
2. Voer `node tools/release.js beta --publish` uit voor de volgende bèta (1.0.0-beta.2), of `node tools/release.js patch|minor|major --publish` voor een definitieve versie.

Het script verplaatst de notities naar een nieuwe versie, verhoogt het versienummer, bouwt `index.html`, commit, maakt de tag `vX.Y.Z`, uploadt, en maakt de GitHub-release met die notities.

## Licentie

Copyright © 2026 Jochem Steenbakkers. Uitgebracht onder de **GNU General Public License v3.0 of later**; zie [LICENSE](LICENSE).
