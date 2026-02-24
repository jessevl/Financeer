<p align="center">
  <img src="public/icons/app-icon.svg" width="128" height="128" alt="Financeer logo" />
</p>

<h1 align="center">Financeer</h1>

<p align="center">
  <strong>A comprehensive, privacy-first Dutch FIRE &amp; financial planning simulator.</strong><br/>
  Model your income, housing, investments, taxes, toeslagen, and retirement — all in the browser, all offline.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#license">License</a>
</p>

---

## Overview

Financeer is a client-side single-page application that lets you build detailed long-term financial plans tailored to the Dutch fiscal system. Every calculation — from box 1/2/3 taxes and hypotheekrenteaftrek to zorgtoeslag and kindgebonden budget — runs entirely in your browser. **No data ever leaves your device.**


## Features

### Planning Modules

| Module | Description |
| --- | --- |
| **Personal** | Age, partner, dependents — the basis for every calculation |
| **Income** | Salary, bonuses, freelance income, benefit growth projections |
| **Housing** | Rent or mortgage, WOZ value, hypotheekrenteaftrek, costs |
| **Investments** | Portfolio allocation, expected returns, rebalancing, box 3 forfaitair rendement |
| **Expenses** | Living costs, discretionary spending, inflation modelling |
| **Retirement** | AOW, pensioen, early-FIRE targets, withdrawal strategies |
| **Tax** | Full Dutch box 1 / 2 / 3 income tax, heffingskortingen, arbeidskorting |
| **Toeslagen** | Zorgtoeslag, huurtoeslag, kinderbijslag, kindgebonden budget |
| **Life Events** | Career changes, home purchases, children — scheduled future events |

### Analysis & Results

| Module | Description |
| --- | --- |
| **Dashboard** | Net-worth trajectory charts and key financial metrics |
| **Breakdown** | Year-by-year detailed table of all income, expenses, and taxes |
| **Compare** | Side-by-side scenario comparison |
| **Monte Carlo** | Probabilistic simulation with configurable runs for confidence intervals |

### Core Capabilities

- **Scenario management** — Create, duplicate, rename, and compare multiple what-if scenarios
- **Undo / Redo** — Full history tracking across all changes
- **Import / Export** — JSON-based data portability with schema validation
- **Offline & private** — 100% client-side; data persists in `localStorage`
- **Responsive** — Works on desktop, tablet, and mobile (with sidebar drawer)
- **Glass-morphism UI** — Modern glassmorphic design via the Frameer design system

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19, TypeScript 5.9 |
| Build | Vite 7.3 |
| Styling | Tailwind CSS 4, Frameer UI |
| State | Zustand 5 with undo/redo middleware |
| Charts | Recharts 3 |
| Forms | React Hook Form + Zod 4 validation |
| Testing | Vitest 4 |
| CI/CD | GitHub Actions (lint, type-check, test, Docker build) |
| Deployment | Docker + nginx (multi-stage build) |

## Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **npm** ≥ 10
- The **[Frameer](https://github.com/)** repo cloned as a sibling directory (`../Frameer`)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/<your-org>/Financeer.git
cd Financeer

# Make sure ../Frameer exists (the shared UI library)
# Then install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
├── App.tsx                 # Shell: sidebar, top bar, routing
├── main.tsx                # Entry point
├── index.css               # Tailwind + global styles
├── components/
│   ├── layout/             # Sidebar, TopBar
│   ├── common/             # ModuleLayout, shared UI pieces
│   ├── ui/                 # shadcn/ui primitives (button, dialog, …)
│   └── OnboardingWizard.tsx
├── modules/
│   ├── dashboard/          # Net-worth charts, KPI cards
│   ├── income/             # Income input forms + summary
│   ├── housing/            # Mortgage / rent configuration
│   ├── investments/        # Portfolio allocation
│   ├── expenses/           # Cost categories
│   ├── retirement/         # FIRE targets, AOW, pensioen
│   ├── tax/                # Dutch tax engine UI
│   ├── toeslagen/          # Benefits calculator UI
│   ├── events/             # Life events timeline
│   ├── breakdown/          # Year-by-year table
│   ├── comparison/         # Scenario diff view
│   ├── montecarlo/         # Monte Carlo simulation UI
│   ├── about/              # About page
│   └── settings/           # App settings
├── engine/
│   ├── simulation.ts       # Core year-by-year simulation engine
│   ├── simulation.worker.ts# Web Worker for heavy computation
│   ├── tax.ts              # Dutch tax calculation (box 1/2/3)
│   ├── toeslagen.ts        # Benefit entitlement logic
│   ├── mortgage.ts         # Annuity / linear mortgage engine
│   ├── investment.ts       # Portfolio growth model
│   ├── monteCarlo.ts       # Monte Carlo runner
│   └── *.test.ts           # Unit tests for engines
├── store/
│   ├── index.ts            # Zustand store (scenarios, settings)
│   └── undoRedo.ts         # Undo/redo middleware
├── types/                  # Shared TypeScript interfaces
├── data/                   # Static reference data (tax brackets, rates)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions, import schema
└── assets/                 # Static assets
```

## Deployment

### Docker

```bash
# Build the image (Frameer must be available at ../Frameer)
docker build -t financeer .

# Run
docker run -p 8080:80 financeer
```

The multi-stage Dockerfile builds the app with Node 22 and serves the static output via nginx with gzip compression, SPA fallback routing, and a `/health` endpoint.

### GitHub Actions

Three workflows are included:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| **CI** | Push / PR to `main` | Lint, type-check, test, build |
| **Docker Publish** | Push to `main` or `v*` tags | Build & push Docker image to GHCR |
| **Release** | Push to `main` / manual | Automated semantic versioning |

## Privacy

Financeer runs entirely in your browser. **No server, no analytics, no tracking.**

- All data is stored in `localStorage`
- No network requests are made (after initial page load)
- Export your data as JSON at any time
- Delete everything with a single "Reset all data" action

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

Make sure `npm run build` and `npm test` pass before submitting.

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

In short: you are free to use, modify, and distribute this software, but any modified version that is made available over a network must also be released under the AGPL-3.0 with its source code available.
