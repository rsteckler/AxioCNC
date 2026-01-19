# Docusaurus Setup Summary

## What's Been Configured

✅ **Docusaurus Project**: Initialized in `website/docs/` with TypeScript support
✅ **Base URL**: Configured for `/docs/` path on GitHub Pages
✅ **Giscus Integration**: Configured to use `rsteckler/AxioCNC-Docs` repository
✅ **Custom Components**: `src/components/` directory set up for React components
✅ **Documentation Migration**: Existing markdown files moved to `docs/` directory
✅ **GitHub Actions**: Workflow created to build and deploy on changes
✅ **Theme Customization**: Giscus comments added to all documentation pages

## Next Steps

### 1. Set Up Giscus (Required for Comments)

1. Go to [https://giscus.app](https://giscus.app)
2. Select repository: `rsteckler/AxioCNC-Docs`
3. Configure the repository (enable Discussions if not already enabled)
4. Get the **Repository ID** and **Category ID** from the configuration
5. Set these as GitHub Secrets in your repository:
   - `GISCUS_REPO_ID`
   - `GISCUS_CATEGORY_ID`
   
   Or update the defaults in `src/components/Giscus/index.tsx`

### 2. Install Dependencies

```bash
cd website/docs
yarn install
```

### 3. Test Locally

```bash
yarn start
```

Visit `http://localhost:3000/docs/` to see the documentation.

### 4. Customize

- **Logo**: Replace `static/img/logo.svg` with AxioCNC logo
- **Favicon**: Replace `static/img/favicon.ico`
- **Colors**: Customize in `src/css/custom.css`
- **Sidebar**: Edit `sidebars.ts` to customize structure

### 5. Deploy

Once you push changes to `main` branch:
- The `docs.yml` workflow will automatically build and deploy
- Documentation will be available at `https://axiocnc.com/docs/`

## File Structure

```
website/docs/
├── docs/                    # Your documentation markdown files
│   ├── intro.md            # Landing page
│   ├── DOCKER.md
│   ├── camera-streaming.md
│   ├── simulator.md
│   └── installation/
├── src/
│   ├── components/         # Custom React components
│   │   └── Giscus/        # Giscus comments
│   ├── css/               # Custom styles
│   └── theme/             # Theme overrides
├── static/                # Static assets
├── docusaurus.config.ts   # Main config
└── sidebars.ts           # Sidebar config
```

## Important Notes

- **Base URL**: The site is configured for `/docs/` path. All internal links should be relative.
- **Giscus**: Comments won't appear until you configure Giscus (step 1 above)
- **Deployment**: Both `static.yml` and `docs.yml` workflows use the same concurrency group, so only one will run at a time
- **Combined Deployment**: The `docs.yml` workflow includes both static files and docs in the deployment

## Troubleshooting

### Giscus not showing
- Check that `GISCUS_REPO_ID` and `GISCUS_CATEGORY_ID` are set
- Verify the repository has Discussions enabled
- Check browser console for errors

### Build fails
- Ensure Node.js 20+ is installed
- Run `yarn install` in `website/docs/`
- Check for TypeScript errors: `yarn typecheck`

### Links broken
- Remember base URL is `/docs/`, so internal links should be relative
- Use Docusaurus Link component: `<Link to="/path">` instead of markdown links for internal pages
