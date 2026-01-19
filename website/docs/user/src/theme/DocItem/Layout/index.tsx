/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import LayoutOriginal from '@theme-original/DocItem/Layout';
import Giscus from '@site/src/components/Giscus';

/**
 * Wrapper around the original DocItemLayout to add Giscus comments
 */
export default function DocItemLayout(props) {
  return (
    <>
      <LayoutOriginal {...props} />
      <Giscus />
    </>
  );
}
