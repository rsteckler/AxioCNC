# AxioCNC Documentation

This directory contains the Docusaurus-based documentation for AxioCNC. The documentation is automatically built and deployed to GitHub Pages at `https://axiocnc.com/docs/` when changes are pushed to the `main` branch.

## Structure

```
website/docs/
├── docs/              # Documentation markdown files
│   ├── intro.md       # Landing page
│   ├── DOCKER.md      # Docker usage guide
│   ├── camera-streaming.md
│   ├── simulator.md
│   └── installation/  # Installation guides
├── src/
│   ├── components/    # Custom React components
│   │   └── Giscus/    # Giscus comments component
│   ├── css/           # Custom styles
│   └── theme/         # Theme customizations
├── static/            # Static assets (images, etc.)
├── docusaurus.config.ts  # Docusaurus configuration
├── sidebars.ts        # Sidebar configuration
└── package.json       # Dependencies

```

## Development

### Prerequisites

- Node.js 20 or higher
- Yarn package manager

### Local Development

```bash
# Install dependencies
yarn install

# Start development server
yarn start

# Build for production
yarn build

# Serve production build locally
yarn serve
```

The development server will be available at `http://localhost:3000/docs/`.

## Custom Components

Custom React components can be added to `src/components/`. These components can be imported in MDX files using:

```mdx
import MyComponent from '@site/src/components/MyComponent';

<MyComponent />
```

## Giscus Comments

Documentation pages include Giscus comments for discussions. The discussions are stored in a separate repository: [rsteckler/AxioCNC-Docs](https://github.com/rsteckler/AxioCNC-Docs).

### Setting up Giscus

1. Go to [giscus.app](https://giscus.app)
2. Configure the repository: `rsteckler/AxioCNC-Docs`
3. Get the repository ID and category ID
4. Set these as GitHub Secrets (optional, or update defaults in `src/components/Giscus/index.tsx`):
   - `GISCUS_REPO_ID`
   - `GISCUS_CATEGORY_ID`

The component will automatically use environment variables if set, or fall back to defaults configured in the component.

## Deployment

Documentation is automatically deployed via GitHub Actions when:
- Changes are pushed to `website/docs/**`
- The workflow is manually triggered

The deployment process:
1. Builds the Docusaurus site
2. Combines it with static website files
3. Deploys to GitHub Pages at `/docs/`

See `.github/workflows/docs.yml` for the deployment configuration.

## Adding New Documentation

1. Add markdown files to the `docs/` directory
2. The sidebar is auto-generated from the directory structure
3. Use frontmatter to customize page behavior:

```markdown
---
title: My Page Title
sidebar_position: 1
hide_table_of_contents: false
---

# My Page Content
```

## Configuration

Key configuration files:
- `docusaurus.config.ts` - Main Docusaurus configuration
- `sidebars.ts` - Sidebar structure (currently auto-generated)
- `src/components/Giscus/index.tsx` - Giscus comments configuration

## Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Giscus Documentation](https://github.com/giscus/giscus)
- [AxioCNC Repository](https://github.com/rsteckler/AxioCNC)
