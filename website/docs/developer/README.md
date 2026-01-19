# AxioCNC Developer Documentation

This directory contains the Docusaurus instance for AxioCNC developer documentation.

## Structure

- `docs/` - Developer documentation markdown files
- `src/` - Source files (CSS, components)
- `static/` - Static assets (images, logos)
- `docusaurus.config.ts` - Docusaurus configuration
- `sidebars.ts` - Sidebar navigation configuration

## Development

```bash
# Install dependencies (from repo root)
yarn install

# Start dev server
cd website/devdocs
yarn start

# Build for production
yarn build
```

## Content Migration

Content was migrated from `developers/docs/` and organized into:
- `getting-started/` - Development setup guides
- `contributing/` - Contribution guidelines
- `reference/` - API and testing documentation
- `deployment/` - Deployment guides and strategies
- `guidelines/` - Development guidelines

## Deployment

The devdocs are automatically built and deployed to `axiocnc.com/devdocs/` via GitHub Actions when changes are pushed to the `main` branch.
