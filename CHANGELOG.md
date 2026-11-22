# Changelog

All notable changes to Papercraft Pattern Maker are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Cut at sharp folds** (*Settings → Automatic unfolding*): folds sharper than a chosen angle (default 60°) become a cut with a glue tab, which is easier to build.
- **Limit piece size** (*Settings → Automatic unfolding*): every piece fits in a square of a chosen size, for smaller pieces that are easier to fold and glue.
- **Mirror the 3D view** (checkbox *Mirror* above the 3D view, or *View → Mirror 3D view*): shows the model as a mirror image, for example to compare it with a photo or the real model. Only the display changes; the pattern, pieces and numbers stay the same.

### Changed

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

[Unreleased]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.2...HEAD
[1.0.0-beta.2]: https://github.com/Jochem77/papercraft-pattern-maker/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/Jochem77/papercraft-pattern-maker/releases/tag/v1.0.0-beta.1
