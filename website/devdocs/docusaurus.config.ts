import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'AxioCNC Developer Documentation',
  tagline: 'Developer guide for contributing to AxioCNC',
  favicon: 'img/favicon.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://axiocnc.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, devdocs will be served at /devdocs
  baseUrl: '/devdocs/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'rsteckler', // Usually your GitHub org/user name.
  projectName: 'AxioCNC', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/rsteckler/AxioCNC/tree/main/website/devdocs/',
          showLastUpdateTime: true,
          routeBasePath: '/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'AxioCNC Dev', // Title hidden if logo contains text
      logo: {
        alt: 'AxioCNC Logo',
        src: 'img/logo.png',
        href: 'https://axiocnc.com',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'devdocsSidebar',
          position: 'left',
          label: 'Developer Docs',
        },
        {
          href: '/docs/',
          label: 'User Docs',
          position: 'right',
        },
        {
          href: 'https://github.com/rsteckler/AxioCNC',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'User Documentation',
              href: '/docs/',
            },
            {
              label: 'Getting Started',
              to: '/getting-started/development',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/rsteckler/AxioCNC/discussions',
            },
            {
              label: 'GitHub Issues',
              href: 'https://github.com/rsteckler/AxioCNC/issues',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Website',
              href: 'https://axiocnc.com',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/rsteckler/AxioCNC',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AxioCNC. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
