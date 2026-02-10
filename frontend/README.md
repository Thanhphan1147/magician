# Juju Magician - Frontend

Svelte 5 application for visualizing Juju infrastructure.

## Setup

```bash
npm install
npm run dev
```

## Project Structure

- `src/App.svelte` - Main application with canvas and sidebar
- `src/lib/nodes/CharmNode.svelte` - Custom node for charms
- `src/lib/nodes/ModelFrame.svelte` - Group node for Juju models
- `src/lib/edges/RelationEdge.svelte` - Custom edge for relations
- `src/lib/api.js` - API utility functions

## Development

The app uses Svelte 5's new Runes syntax:
- `$state` for reactive state
- `$derived` for computed values
- `$props` for component properties

## Building

```bash
npm run build
npm run preview
```
