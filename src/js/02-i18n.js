// Translations (English is the source language) and notifications
// ---------------------------------------------------------------- vertalingen (Engels = brontaal)
const tr = (str, v) => {
  let r = S.set.lang === 'nl' ? (NL[str] ?? str) : str;
  if (v) r = r.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  return r;
};
const pl = (n, one, many) => tr(n === 1 ? one : many);
function applyVersionInfo() {
  $('aboutVer').textContent = tr('Version {v}', { v: APP_VERSION });
  $('lnkRepo').href = REPO_URL; $('lnkRel').href = REPO_URL + '/releases'; $('lnkIss').href = REPO_URL + '/issues';
  const b = document.querySelector('.menubar .brand');
  if (b) {
    b.title = 'Papercraft Pattern Maker ' + APP_VERSION;
    if (APP_VERSION.includes('-') && !b.querySelector('.beta')) { const t = document.createElement('span'); t.className = 'beta'; t.textContent = 'BETA'; b.appendChild(t); }
    const t = b.querySelector('.beta'); if (t) t.title = tr('Beta version: please report problems via Help → Report a problem');
  }
}
function applyStatic() {
  document.documentElement.lang = S.set.lang === 'nl' ? 'nl' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    if (!el.dataset.src) el.dataset.src = el.textContent.trim();
    el.textContent = tr(el.dataset.src);
  }
  applyVersionInfo();
  for (const el of document.querySelectorAll('[data-i18n-title]')) { el.title = tr(el.dataset.i18nTitle); if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.title); }
}
function applyLanguage() {
  applyStatic();
  renderSide(); syncSide();
  $('cap3d').textContent = tr(CAPS[S.tool] || CAPS.select);
  if (S.model) { showMaterials(); $('cap2d').textContent = tr('Pattern') + ' · ' + S.name; }
  if (S.cp) { render2D(); updateStatus(); }
}
const NL = {
  // menu & werkbalk
  'Release notes': 'Release notes', 'Report a problem': 'Probleem melden', 'About Papercraft Pattern Maker': 'Over Papercraft Pattern Maker',
  'Turn low-poly 3D models into printable papercraft patterns.': 'Maakt van low-poly 3D-modellen printbare bouwplaten van papier.',
  'Source code on GitHub': 'Broncode op GitHub', 'Free software under the GNU General Public License v3.0 or later.': 'Vrije software onder de GNU General Public License v3.0 of later.',
  'Version {v}': 'Versie {v}', 'Beta version: please report problems via Help → Report a problem': 'Bètaversie: meld problemen via Help → Report a problem',
  'Simplify model…': 'Model vereenvoudigen…', 'Simplify model': 'Model vereenvoudigen', 'Simplify': 'Vereenvoudigen', 'Use original': 'Origineel gebruiken', 'triangles': 'driehoeken',
  'Papercraft works best with about 100 to 1,500 triangles: larger triangles are easier to cut, fold and glue. The shape and the color borders are kept as well as possible.': 'Een papiermodel werkt het best met ongeveer 100 tot 1.500 driehoeken: grotere driehoeken zijn makkelijker te knippen, vouwen en plakken. De vorm en de kleurgrenzen blijven zo goed mogelijk behouden.',
  'This model has {n} triangles.': 'Dit model heeft {n} driehoeken.',
  'Unfolding the original can take several minutes and gives hundreds of tiny pieces.': 'Het origineel uitvouwen kan enkele minuten duren en geeft honderden kleine stukjes.',
  'Your cuts, moved pieces and painted colors will be reset.': 'Je knippen, verplaatste stukken en geverfde kleuren worden teruggezet.',
  'Preview in the 3D view: {t} triangles': 'Voorbeeld in de 3D-weergave: {t} driehoeken',
  'This model is already simple enough.': 'Dit model is al eenvoudig genoeg.',
  ' · simplified from {n} triangles': ' · vereenvoudigd van {n} driehoeken',
  'Mirror': 'Spiegelen', 'Mirror 3D view': '3D-weergave spiegelen',
  'Show the 3D view as a mirror image (left ↔ right). The pattern does not change.': 'Toon de 3D-weergave in spiegelbeeld (links ↔ rechts). Het patroon verandert niet.',
  'Cut at sharp folds': 'Knippen bij scherpe vouwen', 'Sharp from': 'Scherp vanaf', 'Limit piece size': 'Stukgrootte beperken', 'Maximum size': 'Maximale grootte',
  'Sharp folds become a cut with a glue tab: easier to build than folding a sharp corner.': 'Scherpe vouwen worden een knip met plakstrook: makkelijker te bouwen dan een scherpe hoek vouwen.',
  'Folds of this angle or more are cut. 0° = flat, 90° = the corner of a box. Lower = more cuts.': 'Vouwen van deze hoek of meer worden geknipt. 0° = plat, 90° = de hoek van een doos. Lager = meer knippen.',
  'Smaller pieces are easier to fold and glue, but there are more of them.': 'Kleinere stukken zijn makkelijker te vouwen en te plakken, maar het worden er meer.',
  'Every piece (with its glue tabs) fits in a square of this size.': 'Elk stuk (met plakstroken) past in een vierkant van deze grootte.',
  'Printed side is the inside': 'Bedrukte kant is de binnenkant',
  'For plain (photo) card: the numbers and lines end up on the inside of the model and the outside stays clean. The pieces are mirrored on the paper and mountain and valley folds swap; you still print and cut on one side only.': 'Voor effen (foto)karton: de nummers en lijnen komen aan de binnenkant van het model en de buitenkant blijft schoon. De stukken worden gespiegeld op het papier en berg- en dalvouwen wisselen om; je print en snijdt nog steeds maar aan één kant.',
  'Score + perforate': 'Rillen + perforeren',
  'Score + perforate: folds that bend away from the printed side are scored; folds that bend towards it are perforated, because a score line on the inside of a fold folds badly.': 'Rillen + perforeren: vouwen die van de bedrukte kant af buigen worden gerild; vouwen die er naartoe buigen worden geperforeerd, want een rillijn aan de binnenkant van een vouw vouwt slecht.',
  'Perforation: cut': 'Perforatie: snede', 'Perforation: bridge': 'Perforatie: brug',
  'Length of each cut of a perforated fold line.': 'Lengte van elke snede van een geperforeerde vouwlijn.',
  'Uncut part between two cuts. Larger = stronger, but stiffer to fold. Photo card: about 1 mm.': 'Ongesneden stukje tussen twee sneden. Groter = sterker, maar stugger te vouwen. Fotokarton: ongeveer 1 mm.',
  'Shape of the pieces': 'Vorm van de stukken', 'Large (fewest pieces)': 'Groot (zo min mogelijk stukken)', 'Compact': 'Compact', 'Very compact': 'Zeer compact',
  'Compact pieces have no long arms or ragged edges, so they are easier to fold and glue. They are a bit more pieces.': 'Compacte stukken hebben geen lange armen of rafelige randen, dus ze zijn makkelijker te vouwen en te plakken. Het worden wel iets meer stukken.',
  'Pieces: together': 'Stukken: samen', 'Pieces: gaps': 'Stukken: openingen', 'Pieces: exploded': 'Stukken: uit elkaar', 'How far the pieces move apart': 'Hoe ver de stukken uit elkaar gaan',
  'Show the pieces separately in 3D: with a small gap, or moved apart (exploded). The pattern does not change.': 'Toon de stukken los in 3D: met een kleine opening, of uit elkaar geschoven. Het patroon verandert niet.',
  'Type': 'Soort', 'With glue': 'Met lijm',
  'Faces': 'Vlakken', 'Numbers only on tabs': 'Nummers alleen op stroken',
  'Piece numbers go on a glue tab or flap (next to its edge number, smaller where the tab is small; a piece where no tab has room gets no piece number on paper), and edge numbers are only printed on the tabs and flaps. The faces stay clean, so the printed side can be the outside of the model (for example to score on the outside). Tip: also switch off Print fold lines.': 'Stuknummers komen op een plakstrook of randje (naast het randnummer, kleiner als de strook klein is; een stuk waar op geen strook plek is krijgt geen stuknummer op papier), en randnummers alleen op de stroken en randjes. De vlakken blijven schoon, zodat de bedrukte kant de buitenkant van het model kan zijn (bijvoorbeeld om aan de buitenkant te rillen). Tip: zet ook Vouwlijnen printen uit.',
  'Skip folds below': 'Vouwen overslaan onder', 'Folds that bend less than this are not scored, perforated, printed or shown in the pattern and the 3D view: they fold easily by hand. 0 = all folds. Tab folds are always included.': 'Vouwen die minder knikken dan dit worden niet gerild, geperforeerd, geprint of in het patroon en de 3D-weergave getoond: die vouw je makkelijk met de hand. 0 = alle vouwen. Vouwen van stroken worden altijd meegenomen.',
  'Maximum faces per piece': 'Maximaal aantal vlakken per stuk',
  'Smaller pieces with fewer faces are easier to fold. A flat area made of several triangles (for example a square) counts as one face. 0 = no limit.': 'Kleinere stukken met minder vlakken zijn makkelijker te vouwen. Een plat vlak van meerdere driehoeken (bijvoorbeeld een vierkant) telt als één vlak. 0 = geen grens.',
  'Open project (Ctrl+Shift+O)': 'Project openen (Ctrl+Shift+O)', 'Creating files…': 'Bestanden maken…', 'Export failed: ': 'Exporteren mislukt: ',
  'ZIP with {n} SVG {pages}, the PDF and the project file': 'ZIP met {n} SVG-{pages}, de PDF en het projectbestand',
  'Arrangement': 'Indeling', 'Normal': 'Normaal', 'Fewest pages': 'Zo weinig mogelijk papier', 'Neighbours together': 'Buren bij elkaar',
  'Fewest pages: tries several arrangements and keeps the one with the fewest pages (takes a few seconds). Neighbours together: pieces that are joined in the model lie next to each other, which makes building easier but can take more paper.': 'Zo weinig mogelijk papier: probeert meerdere indelingen en houdt die met de minste pagina’s (duurt een paar seconden). Buren bij elkaar: stukken die in het model aan elkaar vastzitten liggen naast elkaar; dat bouwt makkelijker, maar kan meer papier kosten.',
  'Paper for this color (with Pages per color)': 'Papier voor deze kleur (met Pagina’s per kleur)', 'Paper: standard': 'Papier: standaard',
  'Drag to make the 3D view or the pattern larger (double-click: back to the standard)': 'Sleep om de 3D-weergave of het patroon groter te maken (dubbelklik: terug naar standaard)',
  'Custom size': 'Eigen formaat', 'Custom size…': 'Eigen formaat…', 'Paper width': 'Papierbreedte', 'Paper height': 'Papierhoogte',
  'Width of the paper in portrait; Landscape swaps width and height.': 'Breedte van het papier staand; bij Liggend worden breedte en hoogte omgewisseld.',
  'Paper width × height in mm (portrait)': 'Papierbreedte × hoogte in mm (staand)',
  'Pages per color switched on: every color gets its own pages.': 'Pagina’s per kleur aangezet: elke kleur krijgt eigen pagina’s.',
  '{k} PDFs (one per color) in a ZIP: {n} {pages}, true size (1:1).': '{k} PDF’s (één per kleur) in een ZIP: {n} {pages}, ware grootte (1:1).',
  'Avoid pieces narrower than': 'Stukken smaller dan dit vermijden', 'Avoid pieces smaller than': 'Stukken kleiner dan dit vermijden',
  'Narrow strips (average width) are joined to a neighbouring piece where possible. 0 = off.': 'Smalle stroken (gemiddelde breedte) worden waar mogelijk aan een buurstuk vastgemaakt. 0 = uit.',
  'Very small pieces are joined to a neighbouring piece where possible. 0 = off.': 'Heel kleine stukken worden waar mogelijk aan een buurstuk vastgemaakt. 0 = uit.',
  'Clean up faces thinner than': 'Vlakken dunner dan dit opschonen',
  'Very thin or tiny triangles in the model are removed by joining their shortest edge or turning an edge, where the shape hardly changes. Colour borders stay. 0 = off. Changing this starts the unfolding again.': 'Heel dunne of kleine driehoeken in het model worden weggewerkt door hun kortste rand samen te voegen of een rand om te klappen, waar de vorm nauwelijks verandert. Kleurgrenzen blijven. 0 = uit. Wijzigen begint het uitvouwen opnieuw.',
  '{n} thin faces cleaned up ({c} edges joined, {f} turned).': '{n} dunne vlakken opgeschoond ({c} randen samengevoegd, {f} omgeklapt).',
  ' · {n} thin faces cleaned up': ' · {n} dunne vlakken opgeschoond',
  'Objects: click a separate part of the model to make it larger or smaller (O)': 'Objecten: klik op een los deel van het model om het groter of kleiner te maken (O)',
  '⤢ Objects': '⤢ Objecten',
  '⤢ Click a separate part of the model to make it larger or smaller': '⤢ Klik op een los deel van het model om het groter of kleiner te maken',
  'This model is one connected object. Make all of it larger or smaller in Settings → Model.': 'Dit model is één samenhangend object. Maak het geheel groter of kleiner bij Instellingen → Model.',
  'Object {n}': 'Object {n}', 'Size in %': 'Grootte in %', 'All at 100 %': 'Alles op 100 %',
  'Click an object in the 3D view or in this list. A new size unfolds the model again.': 'Klik op een object in de 3D-weergave of in deze lijst. Een nieuwe grootte vouwt het model opnieuw uit.',
  'Name of this material: on the pages and in the file name of its PDF': 'Naam van dit materiaal: staat op de pagina’s en in de bestandsnaam van de PDF',
  'Two flaps glued together': 'Twee flapjes op elkaar plakken',
  'Zipper: on long seams the tabs alternate between the two pieces, each part glued under the other face. Short seams get one normal glue tab. Two flaps glued together: both pieces get a flap along the seam. Fold both flaps inwards and glue them onto each other. The edge number is printed on both flaps, so nothing has to be printed on the faces and the outside can be scored. The pieces are made so that both flaps fit; only on pieces you cut by hand can a normal glue tab remain where a second flap does not fit.': 'Ritssluiting: bij lange naden wisselen de plakstrookjes om en om tussen de twee stukken; elk deel plak je onder het andere vlak. Korte naden krijgen één gewone plakstrook. Twee flapjes op elkaar plakken: beide stukken krijgen een flapje langs de naad. Vouw beide flapjes naar binnen en plak ze op elkaar. Het randnummer staat op allebei, dus op de vlakken hoeft niets geprint te worden en de buitenkant kan gerild worden. De stukken worden zo gemaakt dat beide flapjes passen; alleen bij stukken die je zelf knipt kan er een gewone plakstrook overblijven waar geen tweede flapje past.',
  'Two flaps from seam length': 'Twee flapjes vanaf naadlengte',
  'Seams shorter than this get one normal glue tab instead of two flaps: stronger, and less bulk inside narrow parts. 0 = two flaps on every seam.': 'Naden korter dan dit krijgen één gewone plakstrook in plaats van twee flapjes: steviger, en minder dik binnenin smalle delen. 0 = twee flapjes bij elke naad.',
  'flap (on both pieces)': 'flapje (op beide stukken)',
  'Seams shorter than {n} mm: one glue tab': 'Naden korter dan {n} mm: één plakstrook',
  'Every seam: two flaps': 'Elke naad: twee flapjes',
  ' · {a} seams with two flaps, {b} with one glue tab': ' · {a} naden met twee flapjes, {b} met één plakstrook',
  'Zipper (alternating tabs)': 'Ritssluiting (om en om)',
  'Zipper: longest part': 'Ritssluiting: langste deel', 'Zipper: shortest part': 'Ritssluiting: kortste deel',
  'A seam is divided into equal parts as long as possible, but not longer than this.': 'Een naad wordt verdeeld in gelijke delen, zo lang mogelijk maar niet langer dan dit.',
  'Parts are never shorter than this. A seam shorter than twice this length gets one normal glue tab.': 'Delen zijn nooit korter dan dit. Een naad korter dan twee keer deze lengte krijgt één gewone plakstrook.',
  ' · {a} seams as a zipper, {b} with one glue tab': ' · {a} naden als ritssluiting, {b} met één plakstrook',
  'tab (alternating)': 'strookje (om en om)',
  'Seams of at least {n} mm: zipper, parts of {a}–{b} mm': 'Naden vanaf {n} mm: ritssluiting, delen van {a}–{b} mm',
  'File': 'Bestand', 'Edit': 'Bewerken', 'Model': 'Model', 'View': 'Beeld', 'Help': 'Help',
  'Open model…': 'Model openen…', 'Open project…': 'Project openen…', 'Save project': 'Project opslaan', 'Export': 'Exporteren',
  'Download PDF (true size)': 'PDF downloaden (ware grootte)', 'Cutting plotter files (SVG)': 'Snijplotter-bestanden (SVG)', 'Settings…': 'Instellingen…',
  'Undo': 'Ongedaan maken', 'Redo': 'Opnieuw', 'Tool': 'Gereedschap', 'Select': 'Selecteren', 'Objects': 'Objecten', 'Cut / join': 'Knippen / verbinden', 'Paint colors': 'Kleuren',
  'Selected piece': 'Geselecteerd stuk', 'Rotate 15° counterclockwise': 'Draai 15° linksom', 'Rotate 15° clockwise': 'Draai 15° rechtsom', 'Rotate 90°': 'Draai 90°', 'Clear selection': 'Selectie opheffen',
  'Unfold automatically': 'Automatisch knippen', 'Rearrange pieces on pages': 'Opnieuw indelen op pagina’s', 'Fix tiny color islands': 'Mini-vlakjes herstellen (kleur)',
  'Dimensions…': 'Afmetingen…', 'Paper & layout…': 'Papier & indeling…', 'Glue tabs…': 'Plakstrookjes…',
  '3D view': '3D-weergave', 'Color by piece': 'Kleur per stuk', 'Color by material': 'Kleur per materiaal', 'Piece numbers': 'Stuknummers', 'Dimensions': 'Maten',
  'Fit 3D view': '3D passend maken', 'Pattern': 'Patroon', 'Edge numbers': 'Randnummers', 'Fit pattern view': 'Patroon passend maken', 'User guide': 'Handleiding', 'Language': 'Taal',
  'Open model: STL, OBJ or GLB (Ctrl+O)': 'Model openen: STL, OBJ of GLB (Ctrl+O)', 'Save project (Ctrl+S)': 'Project opslaan (Ctrl+S)', 'Undo (Ctrl+Z)': 'Ongedaan maken (Ctrl+Z)', 'Redo (Ctrl+Y)': 'Opnieuw (Ctrl+Y)',
  'Select: click a piece, drag to move it (S)': 'Selecteren: klik op een stuk, sleep om te verplaatsen (S)',
  'Cut / join: click near an edge; Shift+click flips the glue tab (K)': 'Knippen / verbinden: klik bij een rand; Shift+klik draait de plakstrook om (K)',
  'Paint colors: click or drag over faces (B)': 'Kleuren: klik of sleep over vlakken (B)',
  'Unfold automatically into pieces as large as possible': 'Automatisch knippen in zo groot mogelijke stukken',
  'Rearrange: pack the pieces as tightly as possible on the pages': 'Opnieuw indelen: stukken zo dicht mogelijk op de pagina’s leggen',
  'Download PDF at true size, 1:1 (Ctrl+P)': 'PDF downloaden op ware grootte, 1:1 (Ctrl+P)', 'Cutting plotter: one SVG per page (ZIP)': 'Snijplotter: één SVG per pagina (ZIP)',
  'Settings (Ctrl+,)': 'Instellingen (Ctrl+,)', 'User guide (F1)': 'Handleiding (F1)',
  // weergaven
  'Colors in the 3D view': 'Kleuren in de 3D-weergave', 'Color: pieces': 'Kleur: stukken', 'Color: material': 'Kleur: materiaal', 'Numbers': 'Nummers', 'Fit': 'Passend',
  '🖌 Colors / materials': '🖌 Kleuren / materialen', 'cut': 'knip', 'fold': 'vouw', 'open edge': 'open rand', 'valley fold': 'dalvouw', 'mountain fold': 'bergvouw',
  'same numbers = glue together': 'gelijke nummers = aan elkaar', 'Open an STL, OBJ or GLB file': 'Open een STL-, OBJ- of GLB-bestand', 'or drop it here': 'of sleep het hierheen', 'Open model': 'Model openen',
  'No model loaded': 'Geen model geladen', 'Cancel': 'Annuleren', 'Settings': 'Instellingen', 'Close without applying (Esc)': 'Sluiten zonder toe te passen (Esc)', 'Close': 'Sluiten',
  'Reset all settings to their defaults': 'Alle instellingen terug naar de standaardwaarden', 'Defaults': 'Standaardwaarden', 'Changes are applied when you click Done': 'Wijzigingen worden toegepast als je op Klaar klikt', 'Done': 'Klaar',
  'Rotate selected piece (Q)': 'Draai geselecteerd stuk (Q)', 'Rotate selected piece (E)': 'Draai geselecteerd stuk (E)',
  '3D · click a piece to select it': '3D · klik op een stuk om het te selecteren', '✂ Click near an edge: cut ⇄ join · Shift: flip glue tab': '✂ Klik bij een rand: knippen ⇄ verbinden · Shift: strook omdraaien',
  '🖌 Click/drag = paint · right drag = rotate': '🖌 Klik/sleep = kleuren · rechts slepen = draaien',
  // instellingen
  'General': 'Algemeen', 'Language of the program.': 'Taal van het programma.',
  'Size of the finished paper model.': 'Afmetingen van het uiteindelijke papiermodel.', 'Length': 'Lengte', 'Width': 'Breedte', 'Height': 'Hoogte',
  'Change one size; the others scale along (proportions stay the same).': 'Pas één maat aan; de andere schalen mee (verhoudingen blijven gelijk).',
  'Flat below angle': 'Vlak tot knik', 'Edges with a smaller angle count as flat: no fold line, and preferably not cut.': 'Randen met een kleinere knik gelden als vlak: geen vouwlijn, en bij voorkeur niet geknipt.',
  'Paper & layout': 'Papier & indeling', 'Paper size and how the pieces are distributed over the pages.': 'Papierformaat en hoe de stukken over de pagina’s worden verdeeld.',
  'Paper': 'Papier', 'Size': 'Formaat', 'Orientation': 'Richting', 'Portrait': 'Staand', 'Landscape': 'Liggend', 'Margin': 'Marge',
  'Empty border all around; most printers cannot print up to the edge.': 'Lege rand rondom; de meeste printers kunnen niet tot aan de rand printen.',
  'Layout': 'Indeling', 'Space between pieces': 'Ruimte tussen stukken', 'Room to cut between the pieces.': 'Ruimte om tussen de stukken te knippen of te snijden.',
  'Pages per row': 'Pagina’s per rij', 'Only for the on-screen view.': 'Alleen voor de weergave op het scherm.',
  'Glue tabs': 'Plakstrookjes', 'Shape of the flaps used to glue the pieces together.': 'Vorm van de flapjes waarmee de stukken aan elkaar worden geplakt.',
  'Tab width': 'Breedte', 'How far a glue tab sticks out.': 'Hoe ver een strookje uitsteekt.', 'Angle': 'Hoek', 'Slope of the sides; smaller = more pointed.': 'Schuinte van de zijkanten; kleiner = spitser.',
  'Minimum width': 'Minimale breedte', 'Where space is tight, a tab may become this much narrower (or more pointed).': 'Is er weinig ruimte, dan mag een strookje tot dit percentage smaller (of spitser) worden.',
  'Automatic unfolding': 'Automatisch knippen', 'How the model is divided into pieces automatically.': 'Hoe het model automatisch in stukken wordt verdeeld.',
  'Cut along color borders': 'Knippen op kleurgrenzen', 'Every piece gets a single color – useful for colored paper.': 'Elk stuk krijgt één kleur – handig als je op gekleurd papier werkt.',
  'Merge tiny color islands': 'Mini-kleurvlakjes bij buurstuk', 'Small or narrow color islands of 1–2 triangles (below Avoid pieces smaller / narrower than) join a neighbouring piece (their color is printed) instead of becoming a tiny piece. Larger islands stay a piece of their own.': 'Kleine of smalle kleurvlakjes van 1–2 driehoeken (onder Stukken kleiner / smaller dan dit vermijden) gaan mee met een buurstuk (hun kleur wordt meegeprint) in plaats van een los mini-stukje. Grotere vlakjes blijven een eigen stuk.',
  'Pages per color': 'Pagina’s per kleur', 'Each color gets its own pages.': 'Elke kleur krijgt eigen pagina’s.',
  'When you change paper, size or tabs, the model is unfolded again automatically – unless you edited edges yourself. Then use <b>Unfold automatically</b>.': 'Wijzig je papier, afmetingen of strookjes, dan wordt opnieuw automatisch geknipt – tenzij je zelf al randen hebt aangepast. Gebruik dan <b>Automatisch knippen</b>.',
  'Text & numbers': 'Tekst & nummers', 'Font and size of the numbers in the pattern.': 'Lettertype en grootte van de nummers in het patroon.', 'Font': 'Lettertype', 'Helvetica bold': 'Helvetica vet',
  'Standard PDF fonts: work in every PDF reader, printer and Silhouette Studio.': 'Standaard-PDF-lettertypes: werken in elke PDF-lezer, printer en Silhouette Studio.',
  'Show edge numbers': 'Randnummers tonen', 'Edges with the same number are glued together.': 'Randen met hetzelfde nummer worden op elkaar geplakt.', 'Font size': 'Grootte',
  'Maximum size; on small faces they shrink automatically.': 'Maximale grootte; op kleine vlakken worden ze vanzelf kleiner.',
  'Show piece numbers': 'Stuknummers tonen', 'A number in a circle on every piece, also shown in 3D.': 'Nummer in een rondje op elk stuk, ook zichtbaar in 3D.',
  'Printing & PDF': 'Printen & PDF', 'What goes on the printed pages. The PDF is always true size (1:1).': 'Wat er op de geprinte pagina’s komt. De PDF is altijd op ware grootte (1:1).',
  'Print colors': 'Kleuren printen', 'Off = only lines and numbers, for colored paper.': 'Uit = alleen lijnen en nummers, voor gekleurd papier.',
  'Print fold lines': 'Vouwlijnen printen', 'Blue dashes = valley fold, red dash-dot = mountain fold.': 'Blauwe streepjes = dalvouw, rode streep-punt = bergvouw.',
  'Always print the PDF at <b>100% / actual size</b>. Every page has a 50 mm check line at the bottom.': 'Print de PDF altijd op <b>100% / werkelijke grootte</b>. Onderaan elke pagina staat een controlelijn van 50 mm.',
  'Cutting plotter': 'Snijplotter', 'Settings for the cutting plotter export and Silhouette Print & Cut.': 'Instellingen voor de snijplotter-export en Silhouette Print & Cut.',
  'Cut file (SVG)': 'Snijbestand (SVG)', 'Fold lines': 'Vouwlijnen', 'Score (own layer)': 'Rillen (eigen laag)', 'Perforate (dashes)': 'Perforeren (streepjes)', 'Leave out': 'Weglaten',
  'Registration marks (Type 1)': 'Registratiemarkeringen (Type 1)', 'Black square top left and L-corners; pieces automatically stay out of the keep-clear zones.': 'Zwart vierkant linksboven en L-hoeken; de stukken blijven automatisch buiten de vrije zones.',
  'Line thickness': 'Lijndikte', 'Inset': 'Inzet', 'Square': 'Vierkant', 'Size of the black square at the top left.': 'Grootte van het zwarte vierkant linksboven.',
  'In Silhouette Studio, turn on the registration marks under <b>Print &amp; Cut</b> with the <b>same</b> length, line thickness and inset, and set the page size to the same paper. These values are also printed at the bottom of every PDF page.': 'Zet in Silhouette Studio bij <b>Printen &amp; snijden</b> de registratiemarkeringen aan met <b>dezelfde</b> lengte, lijndikte en inzet, en het paginaformaat op hetzelfde papier. Deze waarden staan ook onderaan elke PDF-pagina.',
  'face': 'vlak', 'glue tab': 'plakstrook',
  // meldingen
  'Could not open file: ': 'Kon bestand niet openen: ', 'Not a papercraft project': 'Geen papercraft-project', 'No triangles found': 'Geen driehoeken gevonden',
  'Note: {n} open or non-manifold edges (orange). These get no glue tab.': 'Let op: {n} open of niet-gesloten randen (oranje). Die krijgen geen plakstrook.',
  'This model has no colors (STL): everything is white. Use 🖌 to add colors yourself.': 'Geen kleuren in dit model (STL): alles wit. Met 🖌 kun je zelf kleuren toevoegen.',
  'Click to paint with this color': 'Klik om met deze kleur te kleuren', 'Change color': 'Kleur aanpassen', 'Done painting': 'Klaar met kleuren', '🖌 Paint faces': '🖌 Vlakken kleuren', '+ Color': '+ Kleur',
  'Single triangles with a different color get the color of their neighbours': 'Losse driehoekjes met een afwijkende kleur krijgen de kleur van hun buren', 'Fix tiny islands': 'Mini-vlakjes herstellen',
  'White': 'Wit', 'Color {n}': 'Kleur {n}', 'Open a model first': 'Open eerst een model',
  'Color changed. Use Unfold automatically to recalculate.': 'Kleur aangepast. Klik op Automatisch knippen om opnieuw te berekenen.', 'Color changed.': 'Kleur aangepast.',
  'This model has no colors.': 'Dit model heeft geen kleuren.', 'No tiny color islands found.': 'Geen losse mini-vlakjes gevonden.',
  '{n} single triangle(s) got the color of their neighbours. Use Unfold automatically to recalculate.': '{n} los(se) driehoekje(s) kregen de kleur van hun buren. Klik op Automatisch knippen om opnieuw te berekenen.',
  '{n} piece(s) no longer fit on the page (orange). Use Unfold automatically to cut again, or cut them smaller yourself.': '{n} stuk(ken) passen niet meer op de pagina (oranje). Klik op Automatisch knippen om opnieuw te knippen, of knip ze zelf kleiner.',
  'Unfolding…': 'Automatisch knippen…', 'Unfolding… (please wait)': 'Automatisch knippen… (even geduld)', 'Unfolding… attempt {k}/{n} · best: {b} pieces': 'Automatisch knippen… poging {k}/{n} · beste: {b} stukken',
  'piece': 'stuk', 'pieces': 'stukken', 'page': 'pagina', 'pages': 'pagina’s', '{n} {pieces} on {p} {pages}': '{n} {pieces} op {p} {pages}',
  ' · note: {n} piece(s) do not fit (orange)': ' · let op: {n} stuk(ken) passen niet (oranje)', 'Cancelled: all edges cut': 'Geannuleerd: alle randen geknipt', 'Nothing to undo': 'Niets om ongedaan te maken',
  'Some edges could not stay joined (that would create a closed ring).': 'Enkele randen konden niet verbonden blijven (dat zou een gesloten ring geven).',
  '{f} triangles · {n} {pieces} · {p} {pages} · {c} glue edges · scale 1:{s} (model unit → mm)': '{f} driehoeken · {n} {pieces} · {p} {pages} · {c} plakranden · schaal 1:{s} (model-eenheid → mm)',
  '{n} piece(s) overlap themselves': '{n} stuk(ken) overlappen zichzelf', '{n} glue tab(s) without room': '{n} strook/stroken zonder ruimte', '{n} piece(s) larger than the paper': '{n} stuk(ken) groter dan papier',
  '{n} piece(s) outside the printable area': '{n} stuk(ken) buiten printgebied', '{n} pieces overlap each other': '{n} stukken liggen over elkaar', '✓ everything fits': '✓ alles past',
  'Page': 'Pagina', 'Keep-clear zone (Silhouette)': 'Vrij te houden zone (Silhouette)', 'Select a piece first (click on it)': 'Selecteer eerst een stuk (klik erop)',
  'This is an open edge; it cannot be joined.': 'Dit is een open rand; die kan niet verbonden worden.', 'Edge cut (no. {n})': 'Rand geknipt (nr. {n})',
  'Cannot join: the piece would become closed all around and could no longer lie flat.': 'Kan niet verbinden: dit stuk zou dan rondom gesloten zijn en niet meer plat kunnen.',
  'Note: this piece now overlaps itself or a glue tab has no room (red).': 'Let op: dit stuk overlapt nu zichzelf of een strook heeft geen ruimte (rood).', 'Note: this piece is now larger than the paper.': 'Let op: dit stuk is nu groter dan het papier.',
  'Edges joined': 'Randen verbonden', 'Shift+click works on a cut edge: the glue tab moves to the other side.': 'Shift+klik werkt op een knip-rand: de strook wisselt van kant.', 'Glue tab moved to the other side': 'Plakstrook naar de andere kant',
  'open edge': 'open rand', 'flat (Alt+click to cut)': 'vlak (Alt+klik om te knippen)', 'fold ({k})': 'vouw ({k})', 'mountain': 'berg', 'valley': 'dal', 'cut · no. {n}': 'knip · nr. {n}',
  'Edge: {s} · length {l} mm · angle {a}°': 'Rand: {s} · lengte {l} mm · knik {a}°',
  'page {k}/{n}': 'pagina {k}/{n}', 'portrait': 'staand', 'landscape': 'liggend',
  'Registration marks: Length {len} mm - Line thickness {th} mm - Inset {ins} mm - print at 100%': 'Registratiemarkeringen: Lengte {len} mm - Lijndikte {th} mm - Inzet {ins} mm - printen op 100%',
  'check 50 mm': 'controle 50 mm', 'Creating PDF…': 'PDF maken…', 'PDF downloaded: {n} {pages} {p}, true size (1:1).': 'PDF gedownload: {n} {pages} {p}, ware grootte (1:1).',
  ' Note: some pieces are (partly) outside the printable area.': ' Let op: sommige stukken vallen (deels) buiten het printgebied.', 'Creating PDF failed: ': 'PDF maken mislukt: ',
  'cut': 'knip', 'score': 'rillen', 'perforate': 'perforeren', 'cut layer': 'snijden', 'registration marks (do not cut)': 'registratiemarkeringen (niet snijden)',
  'cutter': 'snijplotter',
  'Unfolding automatically replaces your own edits (you can undo this). Continue?': 'Automatisch knippen vervangt je eigen aanpassingen (je kunt dit ongedaan maken). Doorgaan?',
  'Arranging pieces…': 'Stukken indelen…',
  // stukken opnieuw printen
  'Reprint pieces…': 'Stukken opnieuw printen…', 'Reprint pieces': 'Stukken opnieuw printen',
  'Print some pieces again, for example when cutting went wrong, on the same or other paper. The pieces keep their shape and their numbers, and the layout of your pattern stays as it is.': 'Print een paar stukken opnieuw, bijvoorbeeld als het snijden misging, op hetzelfde of ander papier. De stukken houden hun vorm en hun nummers, en de indeling van je patroon blijft zoals hij is.',
  'Pieces': 'Stukken', 'Clear': 'Wissen', 'Download PDF': 'PDF downloaden', 'Not on a page': 'Niet op een pagina',
  'Click piece numbers below, or a page to take all its pieces.': 'Klik hieronder op stuknummers, of op een pagina om al zijn stukken te nemen.',
  'Choose one or more pieces.': 'Kies een of meer stukken.',
  'Does not fit on this paper: piece {list}': 'Past niet op dit papier: stuk {list}',
  'Unknown piece numbers: {list}': 'Onbekende stuknummers: {list}',
  'reprint': 'opnieuw', 'ZIP with {n} SVG {pages} and the PDF': 'ZIP met {n} SVG-{pages} en de PDF',
  'Defaults filled in (the model size stays the same). Click Done to apply them.': 'Standaardwaarden ingevuld (de afmetingen van het model blijven gelijk). Klik op Klaar om ze toe te passen.', 'Loading failed: ': 'Laden mislukt: '
};
const fx = n => (Math.round(n * 1000) / 1000).toString();

// ---------------------------------------------------------------- meldingen
let toastT = 0;
function toast(msg, ms = 2800) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function busy(on, text) { $('busy').classList.toggle('show', on); if (text) $('busyText').textContent = text; if (!on) $('busyBar').style.width = '0'; }

