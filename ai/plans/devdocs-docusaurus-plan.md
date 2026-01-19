# Developer Documentation Docusaurus Integration Plan

## Overview

Integrate the developer documentation from `developers/docs/` into a separate Docusaurus instance at `website/devdocs/`, deployed alongside user docs at `axiocnc.com/devdocs/`.

## Current State

- **User Docs**: `website/docs/` → deployed at `/docs/` (baseUrl: `/docs/`)
- **Dev Docs**: `developers/docs/` → not deployed (12 markdown files)
- **Deployment**: Single Docusaurus build in workflow

## Target State

- **User Docs**: `website/docs/` → deployed at `/docs/` (baseUrl: `/docs/`)
- **Dev Docs**: `website/devdocs/` → deployed at `/devdocs/` (baseUrl: `/devdocs/`)
- **Deployment**: Build both Docusaurus instances, deploy together

## Architecture Decision: Separate Docusaurus Instances

**Recommended Approach**: Two separate Docusaurus instances
- **Pros**:
  - Complete separation between user and dev docs
  - Independent versioning and navigation
  - Clear URL structure (`/docs/` vs `/devdocs/`)
  - Different branding/configuration if needed
  - Easier to manage different audiences
- **Cons**:
  - Two builds to maintain
  - Need to duplicate shared assets (CSS, images)

**Alternative Considered**: Single Docusaurus with routing
- Would require complex routing logic
- Harder to separate content and navigation
- Less flexible for future changes

## Implementation Steps

### Phase 1: Create Dev Docs Docusaurus Instance

1. **Initialize Docusaurus at `website/devdocs/`**
   ```bash
   cd website
   npx create-docusaurus@latest devdocs classic --typescript
   ```

2. **Copy/adapt configuration from `website/docs/`**
   - Copy `docusaurus.config.ts` and update:
     - `title`: "AxioCNC Developer Documentation"
     - `baseUrl`: `/devdocs/`
     - `tagline`: "Developer guide for contributing to AxioCNC"
     - Update navbar items for developer context

3. **Copy shared assets**
   - Copy CSS from `website/docs/src/css/custom.css` (same styling)
   - Copy logo/favicon images
   - Copy Giscus component (if needed for dev docs)
   - Update logo href to point to main site

4. **Create initial structure**
   ```
   website/devdocs/
   ├── docs/
   │   └── (will contain moved files from developers/docs/)
   ├── src/
   │   ├── css/
   │   │   └── custom.css (copied from website/docs/)
   │   └── components/
   │       └── Giscus/ (optional, if comments desired)
   └── static/
       └── img/ (logo, favicon)
   ```

### Phase 2: Migrate Content

1. **Move markdown files from `developers/docs/`**
   ```
   developers/docs/*.md → website/devdocs/docs/
   ```

2. **Organize content structure**
   - Determine logical folder structure:
     ```
     docs/
     ├── getting-started/
     │   ├── development.md
     │   └── gettingstarted.md
     ├── contributing/
     │   └── CONTRIBUTING.md
     ├── reference/
     │   ├── api.md
     │   └── testing.md
     ├── deployment/
     │   ├── deployment-guide.md
     │   ├── deployment-strategy.md
     │   ├── DEPLOYMENT.md
     │   └── server-package-guide.md
     └── guidelines/
         └── protected-code.md
     ```

3. **Create `sidebars.ts`**
   - Organize sidebar navigation
   - Group related docs logically
   - Match organization in developers/docs/README.md

4. **Update frontmatter**
   - Add Docusaurus frontmatter to all markdown files
   - Set appropriate `id`, `title`, `sidebar_position`
   - Ensure consistent formatting

### Phase 3: Update Build Workflow

1. **Modify `.github/workflows/website.yml`**
   - Add second Docusaurus build step for `website/devdocs`
   - Update "Prepare deployment" to include devdocs:
     ```yaml
     - name: Build Dev Docusaurus
       working-directory: website/devdocs
       run: yarn build
     
     - name: Prepare deployment
       run: |
         mkdir -p _site/docs _site/devdocs
         cp -r website/static/* _site/
         cp -r website/docs/build/* _site/docs/
         cp -r website/devdocs/build/* _site/devdocs/
         # Create redirects if needed
         touch _site/.nojekyll _site/docs/.nojekyll _site/devdocs/.nojekyll
     ```

2. **Update workflow triggers**
   - Add `website/devdocs/**` to paths trigger
   - Consider `developers/docs/**` if source remains there temporarily

### Phase 4: Package Configuration

1. **Update root `package.json`**
   - Add `website/devdocs` to workspaces (if using workspaces)
   - Verify dependencies

2. **Create `website/devdocs/package.json`**
   - Copy from `website/docs/package.json`
   - Update name to `axiocnc-devdocs`
   - Ensure dependencies match

### Phase 5: Cross-linking & Navigation

1. **Update main website (`website/static/index.html`)**
   - Add link to devdocs in footer/navigation (optional)

2. **Update user docs navbar**
   - Optionally add link to devdocs: "Developer Docs" → `/devdocs/`

3. **Update devdocs navbar**
   - Link to user docs: "User Docs" → `/docs/`
   - Link to main site: "Home" → `https://axiocnc.com`

4. **Update GitHub README.md**
   - Change developer docs link from `developers/docs/` to `https://axiocnc.com/devdocs/`
   - Update any other references

### Phase 6: Cleanup

1. **Deprecate `developers/docs/`** (optional)
   - Add README pointing to new location
   - Keep for migration period
   - Eventually remove after all links updated

2. **Verify all links work**
   - Test internal navigation
   - Check external links from GitHub
   - Verify deployment URLs

## File Structure After Migration

```
website/
├── static/              # Main website static files
│   └── index.html       # Links to /docs/ and /devdocs/
├── docs/                # User documentation (existing)
│   ├── docs/            # User-facing docs
│   ├── docusaurus.config.ts
│   └── ...
└── devdocs/             # Developer documentation (new)
    ├── docs/            # Developer docs (moved from developers/docs/)
    ├── docusaurus.config.ts
    └── ...
```

## Deployment Structure

```
_site/
├── index.html           # Main website (from website/static/)
├── media/               # Main website assets
├── docs/                # User docs (from website/docs/build/)
│   ├── index.html
│   ├── intro/
│   └── ...
└── devdocs/             # Dev docs (from website/devdocs/build/)
    ├── index.html
    ├── getting-started/
    └── ...
```

## Configuration Notes

### Dev Docs Docusaurus Config

- `baseUrl: '/devdocs/'` (different from user docs)
- `title: 'AxioCNC Developer Documentation'`
- Logo links to `https://axiocnc.com` or `/` (main site)
- Same styling as user docs (copy custom.css)
- Navbar items focused on dev topics
- Footer links to GitHub, user docs, main site

### Sidebar Organization

Match the logical structure in `developers/docs/README.md`:
- Getting Started (development setup)
- Contributing (workflow, guidelines)
- Reference (API, testing)
- Deployment (guides, strategies)
- Guidelines (protected code, etc.)

## Benefits

1. **Clear separation** between user and developer content
2. **Professional deployment** at `axiocnc.com/devdocs/`
3. **Consistent branding** with main site and user docs
4. **Easy maintenance** with Docusaurus features
5. **Better discoverability** through search and navigation
6. **GitHub integration** - README can link to live docs

## Migration Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Broken links from GitHub | Update README.md links before/after migration |
| Lost content during move | Test build locally before merging |
| Deployment conflicts | Test workflow with both builds |
| Styling differences | Copy CSS from user docs |

## Timeline Estimate

- Phase 1 (Setup): 1-2 hours
- Phase 2 (Content): 2-3 hours
- Phase 3 (Workflow): 1 hour
- Phase 4 (Config): 30 minutes
- Phase 5 (Linking): 1 hour
- Phase 6 (Cleanup): 30 minutes

**Total**: ~6-8 hours

## Next Steps

1. Review and approve plan
2. Start with Phase 1 (create devdocs instance)
3. Test build locally before updating workflow
4. Deploy and verify URLs work
5. Update GitHub README links
6. Announce to team (if applicable)
