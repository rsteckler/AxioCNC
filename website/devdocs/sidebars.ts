import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  devdocsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/development',
        'getting-started/gettingstarted',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing/CONTRIBUTING',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/api',
        'reference/testing',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/deployment-guide',
        'deployment/deployment-strategy',
        'deployment/DEPLOYMENT',
        'deployment/server-package-guide',
      ],
    },
    {
      type: 'category',
      label: 'Guidelines',
      items: [
        'guidelines/protected-code',
      ],
    },
  ],
};

export default sidebars;
