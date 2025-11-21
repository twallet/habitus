# Brand Colors - Manual de Marca

This document contains the brand colors extracted from `ManualMarca.pdf`.

## Primary Colors

- **Primary Color**: `#005A7F` (Dark Teal/Blue)

  - Used for: Primary buttons, links, active states, focus indicators
  - Hover variant: `#004A6B` (darker shade)

- **Accent Color**: `#FFCC00` (Yellow/Gold)

  - Used for: Accent elements, highlights

- **Black**: `#000000`
  - Used for: Primary text color

## Implementation

These colors have been integrated into the application's CSS variables in `frontend/src/App.css`:

```css
:root {
  --primary-color: #005a7f;
  --primary-hover: #004a6b;
  --accent-color: #ffcc00;
  --text-primary: #000000;
}
```

## Background Gradient

The application background uses a gradient based on the primary color:

```css
background: linear-gradient(135deg, #005a7f 0%, #003d5a 100%);
```

## Typography

- **Font Family**: Red Hat Display
  - Weights: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)
  - Imported from Google Fonts
  - Applied globally via `body` element in `frontend/src/App.css`

## Notes

- All color values were extracted from `ManualMarca.pdf` using automated extraction tools
- Colors have been applied consistently across all components
- Focus states and shadows have been updated to use the new primary color
- Red Hat Display font is loaded from Google Fonts and applied throughout the application
