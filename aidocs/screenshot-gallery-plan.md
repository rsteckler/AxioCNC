---
name: Add Screenshot Gallery Section
overview: Add a dedicated screenshot gallery section to the AxioCNC website with lightbox functionality to showcase the application interface and features. The section will be integrated between existing sections with responsive design and dark mode support.
todos:
  - id: add_section_html
    content: Add screenshot gallery section HTML structure to index.html after the Features section
    status: pending
  - id: add_lightbox_modal
    content: Create lightbox modal HTML structure with overlay, image container, navigation arrows, and close button
    status: pending
  - id: add_lightbox_js
    content: Implement JavaScript for lightbox functionality (open, close, navigation, keyboard support)
    status: pending
    dependencies:
      - add_lightbox_modal
  - id: style_gallery
    content: Style gallery grid with Tailwind CSS matching existing section design patterns
    status: pending
    dependencies:
      - add_section_html
  - id: style_lightbox
    content: Style lightbox modal with overlay, animations, and responsive sizing
    status: pending
    dependencies:
      - add_lightbox_modal
  - id: add_accessibility
    content: Add ARIA labels, keyboard navigation, and accessibility attributes
    status: pending
    dependencies:
      - add_lightbox_js
  - id: test_responsive
    content: Test gallery and lightbox on mobile, tablet, and desktop viewports
    status: pending
    dependencies:
      - style_gallery
      - style_lightbox
  - id: test_dark_mode
    content: Verify dark mode styling works correctly for both gallery and lightbox
    status: pending
    dependencies:
      - style_gallery
      - style_lightbox
---

# Add Screenshot Gallery Section to Website

Add a dedicated screenshot gallery section to showcase AxioCNC's interface and features with a lightbox viewer.

## Overview

Create a new "Screenshots" section on the landing page (`website/index.html`) featuring:

- Responsive image grid (2-3 columns on desktop, single column on mobile)
- Lightbox modal with full-size image viewing
- Navigation between images in lightbox
- Keyboard support (arrow keys, ESC to close)
- Dark mode compatibility
- Fade-in animation matching existing sections

## Implementation Details

### 1. HTML Structure

Add a new section after the "What's Included" section (around line 398) with:

- Section heading and accent bar (consistent with other sections)
- Grid container for thumbnail images
- Each thumbnail wrapped in a clickable link/image
- Data attributes for lightbox navigation

### 2. Lightbox Modal

Create a modal overlay that:

- Shows full-size image when thumbnail is clicked
- Includes navigation arrows (previous/next)
- Shows image caption/description
- Close button (X) in top-right corner
- Click outside modal to close
- Disables body scroll when open

### 3. JavaScript Functionality

Add JavaScript to handle:

- Opening lightbox on thumbnail click
- Navigation between images (arrows and keyboard)
- Closing lightbox (ESC key, close button, click outside)
- Preloading adjacent images for smooth navigation
- Keyboard accessibility

### 4. Styling

Style with Tailwind CSS:

- Match existing section styles (background, padding, spacing)
- Responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Hover effects on thumbnails (scale/opacity transition)
- Lightbox overlay with backdrop blur
- Mobile-friendly modal sizing

### 5. Image Assets

Create placeholder structure for screenshots:

- Use `media/screenshots/` directory (create if needed)
- Placeholder filenames: `screenshot-1.jpg`, `screenshot-2.jpg`, etc.
- Alt text for each image describing the feature shown

## File Changes

**`website/index.html`**

- Add new `<section id="screenshots">` after line 398
- Add lightbox modal HTML structure
- Add JavaScript for lightbox functionality
- Update navigation links if needed (optional)

**Directory structure** (if images don't exist yet):

- `website/media/screenshots/` - directory for screenshot images

## Design Considerations

- Match existing color scheme (primary orange accent, zinc grays)
- Use fade-in animation class already defined
- Ensure accessibility (ARIA labels, keyboard navigation)
- Optimize images for web (consider lazy loading)
- Mobile-first responsive design

## Testing Checklist

- [ ] Gallery displays correctly on desktop, tablet, mobile
- [ ] Lightbox opens and closes smoothly
- [ ] Keyboard navigation works (arrows, ESC)
- [ ] Dark mode styling is correct
- [ ] Images load properly
- [ ] No layout shifts when opening lightbox
- [ ] Body scroll is disabled when lightbox is open
