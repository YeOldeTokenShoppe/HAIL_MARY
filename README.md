# HAIL_MARY

A Next.js project with selected pages and components from the pumpkinspice project.

## Pages Included

- `/` - Root page with PalmTreeDrive scene
- `/home3` - Main home page with 3D scenes and interactions
- `/temple` - Temple page with Cyborg Temple scene
- `/fountain` - Fountain visualization page
- `/model-viewer` - 3D model viewer
- `/tokenomics` - Tokenomics information page

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Copy `.env.local.example` to `.env.local` and fill in your API keys and configuration.

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- Next.js 14
- React Three Fiber
- Three.js
- Tailwind CSS
- Framer Motion
- Firebase
- Clerk Authentication

## Project Structure

```
HAIL_MARY/
├── public/           # Static assets
├── src/
│   ├── app/         # Next.js app directory
│   ├── components/  # React components
│   ├── hooks/       # Custom React hooks
│   ├── utils/       # Utility functions
│   ├── utilities/   # Additional utilities
│   └── trading/     # Trading-related components
```