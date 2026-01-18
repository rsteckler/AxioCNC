/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import clsx from 'clsx';
import {useWindowSize} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/theme-common/internal';
import DocItemPaginator from '@theme/DocItem/Paginator';
import DocVersionBanner from '@theme/DocVersionBanner';
import DocVersionBadge from '@theme/DocVersionBadge';
import DocItemFooter from '@theme/DocItem/Footer';
import DocItemContent from '@theme/DocItem/Content';
import DocBreadcrumbs from '@theme/DocBreadcrumbs';
import DocItemTOCDesktop from '@theme/DocItem/TOC/Desktop';
import DocItemTOCMobile from '@theme/DocItem/TOC/Mobile';
import Giscus from '@site/src/components/Giscus';
import styles from './styles.module.css';

/**
 * Decide if the toc should be rendered, on mobile or desktop.
 * We don't want to display it in the documentation footer.
 */
function useDocTOC() {
  const {frontMatter, toc} = useDoc();
  const windowSize = useWindowSize();

  const hidden = frontMatter.hide_table_of_contents;
  const canRender = !hidden && toc.length > 0;

  const mobile = canRender ? <DocItemTOCMobile /> : undefined;

  const desktop =
    canRender && (windowSize === 'desktop' || windowSize === 'ssr') ? (
      <DocItemTOCDesktop />
    ) : undefined;

  return {mobile, desktop};
}

export default function DocItemLayout({children}) {
  const docTOC = useDocTOC();
  return (
    <div className={clsx(styles.docItemWrapper)}>
      <DocVersionBanner />
      <div className={clsx('container padding-vert--lg', styles.docItemContainer)}>
        <div className="row">
          <aside className={clsx('col', !docTOC.desktop && styles.docItemCol)}>
            <DocBreadcrumbs />
            <DocVersionBadge />
            {docTOC.mobile}
            <DocItemContent>{children}</DocItemContent>
            <DocItemFooter />
            <DocItemPaginator />
            <Giscus />
          </aside>
          {docTOC.desktop && <div className="col col--3">{docTOC.desktop}</div>}
        </div>
      </div>
    </div>
  );
}
