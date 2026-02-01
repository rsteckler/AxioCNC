import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * User docs sidebar. Order: Intro → Installation → Getting Started → Workflow
 * → Jobs → Machine Control → Settings → Features → Troubleshooting → Reference.
 * Category labels use proper casing (e.g. "Getting Started", not "getting-started").
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Installation',
      link: {type: 'doc', id: 'installation/overview'},
      items: [
        'installation/docker',
        'installation/rpi-server',
        'installation/linux-headless',
        'installation/windows',
        'installation/mac',
        {type: 'doc', id: 'installation/linux', label: 'Linux (Desktop UI)'},
        {type: 'doc', id: 'installation/rpi', label: 'Raspberry Pi (Desktop UI)'},
        'installation/uninstall',
      ],
    },
    {
      type: 'category',
      label: 'Getting Started',
      link: {type: 'doc', id: 'getting-started/first-use'},
      items: [
        'getting-started/connecting-to-machine',
        'getting-started/quick-tour',
      ],
    },
    {
      type: 'category',
      label: 'Workflow',
      link: {type: 'doc', id: 'workflow/overview'},
      items: [
        'workflow/setup-screen',
        'workflow/monitor-screen',
        'workflow/stats-screen',
      ],
    },
    {
      type: 'category',
      label: 'Jobs',
      items: [
        'jobs/uploading-files',
        'jobs/visualizing-toolpath',
        'jobs/starting-a-job',
        'jobs/pausing-and-resuming',
        'jobs/canceling-a-job',
      ],
    },
    {
      type: 'category',
      label: 'Machine Control',
      items: [
        'machine-control/jogging',
        'machine-control/setting-home',
        'machine-control/zeroing-workpiece',
        'machine-control/zeroing-methods',
      ],
    },
    {
      type: 'category',
      label: 'Settings',
      link: {type: 'doc', id: 'settings/overview'},
      items: [
        'settings/general-settings',
        'settings/appearance-settings',
        'settings/connection-settings',
        'settings/machine-settings',
        'settings/zeroing-and-tool-changes',
        'settings/camera-settings',
        'settings/joystick-settings',
        'settings/tool-library',
        'settings/macros',
        'settings/events',
        'settings/advanced-settings',
        'settings/about',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: ['features/camera-streaming'],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/connection-issues',
        'troubleshooting/serial-port-issues',
        'troubleshooting/job-execution-issues',
        'troubleshooting/common-errors',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      link: {type: 'doc', id: 'reference/supported-controllers'},
      items: [
        'reference/g-code-compatibility',
      ],
    },
  ],
};

export default sidebars;
