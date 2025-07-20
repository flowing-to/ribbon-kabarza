# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Three.js/React application featuring an animated 3D ribbon with image carousel functionality. The project creates an immersive visual experience where a flowing ribbon leads to an interactive carousel of images that users can click and drag to navigate.

## Development Commands

- `npm run dev` - Start development server with Vite (runs on 0.0.0.0 with CORS enabled)
- `npm run build` - Build production bundle (outputs to `build/` directory as UMD)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint on JS/JSX files
- `npm run format` - Fix linting issues and format code with Prettier

## Architecture Overview

### Core Technologies

- **React 18** with TypeScript (strict mode enabled)
- **Three.js (v0.175.0)** for 3D graphics and WebGL
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Helper components and utilities
- **@theatre/core** & **@theatre/r3f** - Animation sequencing and timeline
- **Vite** - Build tool with HMR and single-file bundling
- **TailwindCSS** - Utility-first CSS
- **Zustand** - Lightweight state management

### Key Components Structure

**Scene.tsx** (`src/components/canvas/Scene.tsx:54-242`)

- Main 3D scene orchestrator
- Handles asset preloading and animation sequencing using Theatre.js
- Manages responsive behavior and performance monitoring
- Controls the main animation timeline that plays on load

**Experience.tsx** (`src/components/canvas/Experience.tsx:156-621`)

- Core 3D experience component containing all 3D objects
- Implements custom shader materials for ribbon and images
- Manages carousel interactions (click, drag, momentum)
- Handles camera controls and user input

**Carousel System**

- 12 images arranged in a circle (`carouselCount = 12`)
- Interactive dragging with momentum-based physics
- Click-to-focus individual images with smooth rotation
- Images loaded from DOM via `data-flow-ribbon-img` attributes

### Shader System

The project uses custom GLSL shaders located in `src/glsl/`:

- **Ribbon shaders** (`ribbon/`) - Animate the flowing ribbon along a 3D curve
- **Image shaders** (`image/`) - Handle carousel image rendering with effects
- **Text shaders** (`text/`, `ribbonText/`) - Text rendering on surfaces

### State Management

- **useCarouselStore** (`src/lib/store/useCarouselStore.tsx`) - Zustand store for carousel state
- Animation progress controlled via Theatre.js project state
- Image and text content dynamically loaded from DOM elements

### Asset Loading

Images and text content are loaded from the DOM using data attributes:

- Images: `[data-flow-ribbon-img="1"]` through `[data-flow-ribbon-img="12"]`
- Text: `[data-flow-ribbon-text-nr="1"]` through `[data-flow-ribbon-text-nr="12"]`

This allows the 3D application to integrate with CMS content from external systems.

## Build Configuration

- Vite builds to UMD format as `build/main.js` using `vite-plugin-singlefile`
- Supports GLSL shader imports via `vite-plugin-glsl`
- Development server runs on `0.0.0.0` with CORS enabled for external asset loading
- Build excludes jQuery as external dependency
- TypeScript with strict mode and project references (app/node configs)

## Key Files to Understand

- `src/components/canvas/constants.tsx` - Central configuration for carousel, curve points, and physics
- `src/components/canvas/BentPlaneGeometry.ts` - Custom geometry for the ribbon
- `src/components/canvas/CarouselImage.tsx` - Individual carousel image component
- Theatre project state stored in `Ribbon r3f Project.theatre-project-state.json`

## Development Notes

- The application fetches textures from external CDN (`flowing-canvas.vercel.app`)
- Performance monitoring automatically adjusts pixel ratio based on frame rate
- Uses TypeScript with custom shader material type definitions
- GLSL files imported with TypeScript ignore comments due to custom loader setup
