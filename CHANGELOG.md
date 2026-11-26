# Changelog

All notable changes to Papercraft Pattern Maker are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Find a piece selected in 3D in the pattern**: the other pieces fade, the selected piece blinks briefly, and when it is not (fully) in view the pattern moves to it (zooming out when it does not fit).
- **Movable divider** between the 3D view and the pattern: drag it (mouse or touch) or use the arrow keys to make one side larger; double-click goes back to the standard. The width is remembered, and the pattern keeps its zoom.
- **Custom paper size** (*Settings → Paper & layout → Size → Custom size*): enter the width and height of the paper in mm (100–1000, portrait; *Landscape* swaps them). Also per material in the colours panel (*Custom size…*, then width × height). Automatic unfolding makes the pieces fit; the page, the PDF and the plotter SVG get that size, and the file names show it (for example *300x450*).
- **Pinch to zoom** in the pattern on a touchscreen: two fingers zoom and pan; one finger still pans or moves a piece.

### Changed

- **Zipper: longest and shortest part** (*Settings → Glue tabs*, default 20 and 10 mm) instead of one part length: a seam is divided into equal parts, as long as possible but not longer than the longest part; when the parts would be shorter than the shortest part (a seam shorter than twice that), the seam gets one normal glue tab. A saved part length is kept as the shortest part.
- **Selecting a piece in the pattern no longer turns the 3D view**; the piece is only highlighted there. Double-click (or double-tap) the piece to turn the 3D view towards it.

### Fixed
- **Glue tabs at an inward (concave) seam get a valley fold** instead of a mountain fold: a tab bends the same way as the face it is glued to. (Flaps glued together still always fold inward.)
- **Glue tabs no longer stick out past the other piece**: a tab is glued under the face on the other side of the seam, and where that face is narrower than the tab, the tab stuck out (in the test snake about 200 of 550 tabs). The tab now goes on the other side when it fits there unchanged; otherwise it gets a steeper angle at the end where that face is narrow, and is made lower where it is short. Faces joined flat to it count as one surface. Also for *Zipper* and *Two flaps glued together*. In the test snake: 5 tabs still reach slightly past a very thin face.
- **No piece numbers on the outside** with *Numbers only on tabs*: where a piece number did not fit next to the edge number on a tab, it went on a face (in the test snake on most pieces). It now first tries lower on the tab, where it is wider, with the edge number moved to the other end, then a smaller gap and smaller numbers (down to 1 mm). A piece where no tab has room gets no piece number on paper; it still shows in 3D.

## [1.0.0-beta.5] - 2026-11-23

### Added

- **Two flaps glued together** (*Settings → Glue tabs → Type*): both pieces get a flap along each seam; fold both inwards and glue them onto each other. The edge number is printed on both flaps, so with *Numbers only on tabs* nothing is printed on the faces and the outside can be scored. Automatic unfolding keeps room for both flaps on every seam; switching the type unfolds again. *Two flaps from seam length* gives shorter seams one normal glue tab instead (stronger, less bulk in narrow parts).
- **Zipper** (*Settings → Glue tabs → Type*): on long seams the glue tabs alternate between the two pieces, each part glued under the other face, so the seam is held from both sides. *Zipper part length* sets the length of each part; seams shorter than twice that get one normal glue tab.

### Changed

- **Source code split up** (for developers): `src/app.html` now holds only the page; the styling is in `src/style.css` and the program in `src/js/`, one file per subject. `node tools/build.js` still builds the one self-contained `index.html`. Unused code and translations were removed.

### Fixed

- **Piece number over the edge number**: on a glue tab, the piece number now keeps 1 mm clear of the edge number on that tab (with *Zipper* it avoided the number of another part of the seam). Where it does not fit on any tab, it goes on a face.

### Removed

- **Tab and flap (no glue)**: inserting the tabs through the slits was too hard in practice (the flaps get in each other's way inside and thick card does not go through a slit). Projects and settings that used it now use *Two flaps glued together*.

## [1.0.0-beta.4] - 2026-11-23

### Added

- **Rename materials**: click the name of a colour in the colours panel and type a new one (for example *green photo card*). The name is printed on every page of that material, is part of its PDF file name, and the plotter SVGs in the ZIP are now named and numbered like the PDF they belong to (material, paper, page). Saved in the project. Letters like é and ü now appear in the PDF instead of a question mark, and the page line shows the paper of that page.
- **Make separate objects larger or smaller** (tool *Objects*, O): click a separate part of the model (for example a base, a tongue or a hat) in the 3D view or in the list, and set its size in %. It is scaled around its own centre and the model is unfolded again; the rest of the model keeps its size. Saved in the project. *All at 100 %* undoes it.
- **Clean up thin faces** (*Settings → Model → Clean up faces thinner than*, default 2 mm): very thin or tiny triangles in the model are removed before unfolding, by joining their shortest edge or turning an edge, only where the shape hardly changes; colour borders and open edges stay. In the test model: 4 instead of 41 faces thinner than 2 mm, volume change 0.01 %. Projects keep their mesh (the tolerance is saved; older projects are not cleaned up).

- **Avoid narrow and small pieces** (*Settings → Automatic unfolding*, default 8 mm average width and 25 mm size): such pieces are joined to the neighbour they share the longest border with, or take over a branch of it, when that stays valid. A narrow strip between sharp folds may join across one of them (colour borders stay cut). In the test project: 5 instead of 16 strips narrower than 8 mm.

- **Paper per color** (colors panel, next to every color: *Paper: standard / A4 / A3*): with *Pages per color* (switched on automatically), each color gets pages in its own paper size, and automatic unfolding makes its pieces fit that paper. **A separate PDF per material** (one ZIP when there are several), also in the cutting plotter ZIP; the SVG of each page has its own paper size and registration marks. The choice is saved in the project.

- **Arrangement on the pages** (*Settings → Paper & layout → Arrangement*): *Fewest pages* tries several arrangements and finer rotations and keeps the one with the fewest pages; *Neighbours together* places pieces that are joined in the model next to each other (walking through the model from piece to neighbour), which makes building easier.
- With *Tab and flap*, a flap is only added where the piece still fits on the paper (a piece could stick out past the printable area).

- **Open project button** in the toolbar (next to *Open model*), and *Ctrl+Shift+O*.
- **Maximum faces per piece** (*Settings → Automatic unfolding*, default 8): automatic unfolding makes no piece with more faces than this. A flat area of several triangles counts as one face. 0 = no limit.
- **Fewer tiny pieces**: a piece of only 1 or 2 faces takes over a branch of a neighbouring piece, or joins it, when both stay valid. With *Cut at sharp folds*, a tiny piece enclosed by sharp folds may still join a neighbour across a fold of less than 85° (box edges and colour borders stay cut). In the test project: 9 instead of 61 pieces with 1 or 2 faces.

### Changed

- **Settings are more compact**: the explanation of each setting is now behind an (i) after its name and shows when you point at it (or tab to it with the keyboard).
- **Skip folds below** now also hides those nearly flat folds in the pattern on screen and in the 3D view, so the preview shows what goes on paper. Pointing at a fold now also shows how much it bends (in degrees), to choose the value.
- **Merge tiny color islands** now only merges islands that are really small or narrow (below *Avoid pieces smaller / narrower than*, or 25 / 8 mm when those are off). Larger islands of 1–2 triangles, like the eyes of the test snake (46 × 21 mm), stay a piece of their own and go on the page of their own colour.
- **Slivers between sharp folds are removed from the model**: a thin face that cannot be removed by joining an edge or turning one (for example a sliver between a colour border and two sharp folds) now has its tip moved straight onto its long edge, and the face on the other side is split there. The shape moves by at most the sliver's own thickness (always less than *Clean up faces thinner than*); a colour border may shift by that much. In the test snake: 2 instead of 35 faces thinner than 5 mm and no pieces narrower than 8 mm, at the same volume. Projects saved earlier keep their mesh until you use *Unfold automatically*; then the model is cleaned up again and the colours, painted ones too, go along. Narrow or tiny pieces whose neighbour was just changed are also tried again, and a piece of 1 or 2 faces may as a last resort join a neighbour that then goes 1 or 2 faces over the maximum.
- **6 and 9 underlined**: edge and piece numbers that read as another number upside down (6, 9, 16, 91, 86, 98 …) get a line under them, on screen, in the PDF and in the plotter SVG.
- **Plotter SVG layer order**: the score (blue) and perforation (green) layers now come first and the cut lines (red) last. Silhouette Studio lists the line colours in that order and cuts from top to bottom, so pieces are scored before they are cut loose. Faces in the print layer no longer get a white fill on white paper, so the score lines stay visible in Studio.
- **Cutting plotter files** are now always one ZIP with the SVG per page, the PDF with the same pages in the same order (they belong together when printing and cutting) and the project file.

## [1.0.0-beta.3] - 2026-11-23

### Added

- **Skip nearly flat folds** (*Settings → Cutting plotter → Skip folds below*): folds that bend less than a chosen angle are not scored, perforated or printed (the screen still shows them); tab folds are always included.
- **Numbers only on tabs** (*Settings → Text & numbers*): piece numbers go on a glue tab or flap and edge numbers only on the tabs and flaps, so the faces stay clean and the printed side can be the outside (for example to score on the outside).
- **Tabs without glue: tab and flap** (*Settings → Glue tabs → Type*): one side of a cut edge gets arrow-shaped tabs, the other side a flap with slits on its fold line. The tabs go through the slits, so tab and flap cross exactly at the seam and hook it tight; nothing shows on the outside. Long edges get several hooks; the edge number is printed on the flap. The tab shapes stay inside the normal tab area, so the unfolding does not change; where there is no room a normal glue tab is used. The slits are in the cut layer of the plotter SVG and drawn as cut lines in the PDF.
- **Cut at sharp folds** (*Settings → Automatic unfolding*): folds sharper than a chosen angle (default 60°) become a cut with a glue tab, which is easier to build.
- **Limit piece size** (*Settings → Automatic unfolding*): every piece fits in a square of a chosen size, for smaller pieces that are easier to fold and glue.
- **Printed side is the inside** (*Settings → Printing & PDF*): for plain card, the numbers and lines go on the inside of the model and the outside stays clean. The pieces are mirrored on the paper and mountain and valley folds swap, so you still print and cut on one side only. The 3D view keeps showing the model the right way round.
- **Score + perforate** (*Settings → Cutting plotter → Fold lines*): folds that bend away from the printed side are scored, folds that bend towards it are perforated (a score line on the inside of a fold folds badly). Both layers are in the SVG: score lines blue, perforation green, so Silhouette Studio can use different cut settings for each.
- **Adjustable perforation**: length of the cuts and of the bridges (default 2 mm and 1 mm, was fixed 1.5 mm and 1.2 mm). The dashes are now centred on each fold line, with a bridge at both ends.
- **See the pieces in 3D** (list above the 3D view): *Pieces: gaps* shrinks every piece a little along its cuts; *Pieces: exploded* moves the pieces apart, with a slider for the distance (0.75–1.5 % of the model size). Only the display changes.
- **Mirror the 3D view** (checkbox *Mirror* above the 3D view, or *View → Mirror 3D view*): shows the model as a mirror image, for example to compare it with a photo or the real model. Only the display changes; the pattern, pieces and numbers stay the same.

### Changed

- **Compact pieces** (*Settings → Automatic unfolding → Shape of the pieces*): automatic unfolding no longer makes pieces with long arms or ragged edges. *Compact* (new default) gives a few more pieces that are much easier to fold and glue; *Large* keeps the old behaviour with the fewest pieces; *Very compact* goes further.
- **Settings are applied when you click Done**, all at once (the model is unfolded again at most once). Closing the panel with ✕, Esc or a click outside it discards the changes. *Defaults* only fills in the panel.
- **Clearer fold lines**: valley folds are blue dashes and mountain folds are red dash-dot lines (were grey dashes and grey dots, which were hard to tell apart on paper). Also in the PDF and the plotter SVG print layer.

### Fixed

- Edge and piece numbers in the cutting-plotter SVG were shifted in Silhouette Studio, which ignores `text-anchor` and `dominant-baseline`. Numbers near the page edge could even stick out past the registration marks, so the selection was wider than the marks. The text is now positioned explicitly. The cut and score lines were not affected.

## [1.0.0-beta.2] - 2026-11-20

### Added

- **Simplify detailed models**: a model with more than 2,000 triangles opens a dialog to reduce it to a number of triangles you choose (default 1,000), with a live preview in the 3D view. The shape and the borders between colors are kept. Also available later via *Model → Simplify model…*. Projects remember the setting.
- A warning before unfolding a model with more than 10,000 triangles unchanged.

### Changed

- The status bar shows how many triangles the original model had when it was simplified.

## [1.0.0-beta.1] - 2026-11-20

First public beta. Please report problems via [GitHub Issues](https://github.com/Jochem77/papercraft-pattern-maker/issues).

### Added

- **Import** of STL (binary and ASCII), OBJ and GLB models. GLB materials and textures become the printed colors.
- **Automatic unfolding** into pieces that are as large as possible:
  - every piece fits on the paper, inside the margins;
  - no piece overlaps itself;
  - every glue tab has room, and tabs get narrower or more pointed only where space is tight;
  - tiny leftover pieces are merged into their neighbours.
- **Manual editing**:
  - cut or join any edge, in the 3D view or in the pattern;
  - move a glue tab to the other side of its edge;
  - drag and rotate pieces;
  - unlimited undo and redo.
- **Tools**: *Select*, *Cut / join* and *Paint colors*. A selected piece is highlighted in 3D, and the 3D view turns towards a piece selected in the pattern.
- **Colors**:
  - paint faces;
  - edit and add materials;
  - fix single-triangle color errors;
  - optionally cut along color borders and group pages per color.
- **Nesting**: pieces are packed tightly on A4 or A3 pages, using their real shape and 24 rotations.
- **Numbering**: matching edge numbers on edges that are glued together, plus a piece number in a circle (also shown in 3D). Piece numbers avoid overlapping the edge numbers.
- **Fold lines**: mountain and valley folds in distinct line styles.
- **PDF export** at true size (1:1). Every page carries a 50 mm check line.
- **Cutting plotter export**: one SVG per page (ZIP), in millimetres, with layers *print*, *cut* (one closed outline per piece) and *score* or *perforate*.
- **Silhouette Print & Cut**:
  - Type 1 registration marks with configurable length, line thickness and inset;
  - the mark settings are printed on every page;
  - pieces stay out of the keep-clear zones.
- **Model dimensions** as X/Y/Z in millimetres, shown in the 3D view.
- **Settings dialog** with tabs, live previews of glue tabs and fonts, and a reset to defaults.
- **Menu bar** and an icon toolbar with tooltips and keyboard shortcuts.
- **English and Dutch** user interface.
- **Projects**: the model and all edits are saved in a single `.papercraft.json` file.

### Known issues

- The 3D view needs an internet connection the first time, to load three.js from a CDN.
- Mainly tested in Chrome and Edge on Windows. Firefox, Safari and touch devices are less tested.
- Large models (more than about 5,000 triangles) can take a long time to unfold.
- Edge numbers can overlap each other at very sharp corners.
- OBJ files are assumed to be Y-up.
- The Silhouette registration marks have been checked against Silhouette Studio's default settings only.

[Unreleased]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.5...HEAD
[1.0.0-beta.5]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.4...v1.0.0-beta.5
[1.0.0-beta.4]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.3...v1.0.0-beta.4
[1.0.0-beta.3]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.2...v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/Jochem77/papercraft-pattern-maker/releases/tag/v1.0.0-beta.1
