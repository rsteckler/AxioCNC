import { Redirect } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function Home(): JSX.Element {
  const startHereUrl = useBaseUrl('/00-start-here');
  return <Redirect to={startHereUrl} />;
}