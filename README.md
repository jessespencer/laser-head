# Laser Head

A browser-based arcade shoot-em-up where you use your own face to shoot lasers and destroy incoming enemies. Upload a photo, align your eyes, and fire away.

## Features

- **Custom Avatars** — upload a photo with automatic ML-based background removal, or use the default head
- **Eye Alignment Tool** — pan and zoom to position your eyes for accurate laser origin
- **4 Enemy Types** — Scouts, Drones, Tanks, and Bombs with progressive difficulty scaling
- **Combo System** — consecutive kills build a multiplier up to 8x
- **Ultra Mode** — collect power-ups for 10 seconds of rapid-fire lasers
- **Visual Effects** — screen shake, particle explosions, CRT scanlines, animated starfield

## Tech Stack

- TypeScript + Vite
- HTML5 Canvas for rendering
- @imgly/background-removal for ML-powered image processing
- Tailwind CSS (CDN)

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm run dev      # http://localhost:5173/laser-head/
pnpm run build    # Production build to dist/
pnpm run preview  # Serve production build
```

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Spacebar | Fire lasers |
| ESC | Quit to menu |
