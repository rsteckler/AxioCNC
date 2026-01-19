import { Redirect } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function Home(): JSX.Element {
  const gettingStartedUrl = useBaseUrl('/getting-started');
  return <Redirect to={gettingStartedUrl} />;
}