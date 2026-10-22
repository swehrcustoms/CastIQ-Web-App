import { Link } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/ui/Chrome';
import { usePageTitle } from '../hooks/usePageTitle';

const FEATURES = [
  { title: 'Lake search', body: 'Search the Minnesota DNR lake catalog by name. County and nearby town help when more than one lake shares a name.', href: '/search' },
  { title: 'Fishing reports', body: 'A lake page shows which species were reported, and when. Lure, depth, structure, and the written report are Standard and Premium.', href: '/search' },
  { title: 'Species information', body: 'Filter a lake by the species on its record. CastIQ does not invent species that are missing.', href: '/search' },
  { title: 'Lake surveys', body: 'Survey and stocking panels open where that data has been loaded.', href: '/search' },
  { title: 'Seasonal tactics', body: 'The tactics list for a lake is Standard and Premium. Free accounts still see the species on the lake.', href: '/tactics' },
  { title: 'Ice information', body: 'Thickness reports are informational. They do not certify that ice is safe.', href: '/ice' },
  { title: 'Saved lakes', body: 'Save a lake from its page and find it again on your profile.', href: '/profile' },
];

export function Features() {
  usePageTitle('Features');
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="CastIQ"
        title="Features"
        subtitle="What you can do in the app today."
      />
      <ul className="space-y-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="rounded-lg bg-castiq-blue p-4">
            <h2 className="text-sm font-semibold text-castiq-white">{feature.title}</h2>
            <p className="mt-1 text-sm text-castiq-muted">{feature.body}</p>
            <Link to={feature.href} className="mt-2 inline-flex text-sm text-castiq-teal hover:underline">Open</Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
