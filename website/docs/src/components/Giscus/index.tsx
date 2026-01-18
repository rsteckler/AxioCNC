/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {useEffect, useRef} from 'react';
import {useColorMode} from '@docusaurus/theme-common';
import Giscus from '@giscus/react';
import {useLocation} from '@docusaurus/router';

/**
 * Giscus Comments Component
 * 
 * This component embeds Giscus discussions into documentation pages.
 * The discussions are stored in a separate repository: rsteckler/AxioCNC-Docs
 * to avoid cluttering the main AxioCNC repository.
 * 
 * Configuration is set with default values from Giscus setup.
 * To customize, you can:
 * - Set environment variables (GISCUS_REPO_ID, GISCUS_CATEGORY_ID, etc.)
 * - Or update the defaults in this component
 * 
 * The theme automatically switches between 'dark' and 'light' to match
 * Docusaurus color mode. To use a specific theme (e.g., 'gruvbox_dark'),
 * replace the giscusTheme variable with your preferred theme name.
 */

// Giscus configuration for AxioCNC documentation discussions
// Discussions are stored in a separate repo: https://github.com/rsteckler/AxioCNC-Docs
const GISCUS_REPO = process.env.GISCUS_REPO || 'rsteckler/AxioCNC-Docs';
const GISCUS_REPO_ID = process.env.GISCUS_REPO_ID || 'R_kgDOQ8ay2g';
const GISCUS_CATEGORY = process.env.GISCUS_CATEGORY || 'Announcements';
const GISCUS_CATEGORY_ID = process.env.GISCUS_CATEGORY_ID || 'DIC_kwDOQ8ay2s4C1Hwk';

export default function GiscusComponent(): JSX.Element | null {
  const {colorMode} = useColorMode();
  const location = useLocation();
  const giscusRef = useRef<HTMLDivElement>(null);

  // Giscus is now configured with default values, so it should always render

  const giscusTheme = colorMode === 'dark' ? 'dark' : 'light';

  // Reset Giscus when theme changes or route changes
  useEffect(() => {
    // Small delay to ensure theme is applied
    const timer = setTimeout(() => {
      if (giscusRef.current) {
        const iframe = giscusRef.current.querySelector('iframe');
        if (iframe) {
          iframe.contentWindow?.postMessage(
            {giscus: {setConfig: {theme: giscusTheme}}},
            'https://giscus.app'
          );
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [giscusTheme, location.pathname]);

  return (
    <div ref={giscusRef} style={{marginTop: '3rem'}}>
      <Giscus
        repo={GISCUS_REPO}
        repoId={GISCUS_REPO_ID}
        category={GISCUS_CATEGORY}
        categoryId={GISCUS_CATEGORY_ID}
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme={giscusTheme}
        lang="en"
        loading="lazy"
      />
    </div>
  );
}
