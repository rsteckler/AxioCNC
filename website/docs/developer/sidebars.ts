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
    'getting-started',
    'repo-layout',
    'build-and-bundle-contract',
    'branch-strategy',
    'pull-request-guidelines',
    'testing-strategy',
    'release-process',
    'api-philosophy',
  ],
};

export default sidebars;
