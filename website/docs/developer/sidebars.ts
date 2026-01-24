import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Developer docs sidebar. Ordered by happy path: start → setup → map → workflow
 * → architecture → standards → testing → safety → contributing → release → CI
 * → troubleshooting → reference → test-analytics-locally.
 */
const sidebars: SidebarsConfig = {
  devdocsSidebar: [
    '00-start-here',
    '01-getting-set-up',
    '02-repository-map',
    '03-day-1-workflow',
    '04-architecture',
    '05-code-standards',
    '06-testing-strategy',
    '07-making-changes-safely',
    '08-contributing',
    '09-release-process',
    '10-ci-cd',
    '11-troubleshooting',
    '12-reference',
    '13-test-analytics-locally',
  ],
};

export default sidebars;
