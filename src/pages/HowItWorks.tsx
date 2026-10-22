import { Link } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/ui/Chrome';
import { usePageTitle } from '../hooks/usePageTitle';

const STEPS = [
  { title: 'Choose a lake', body: 'Search by name. County and nearby town separate lakes that share a name.' },
  { title: 'Read what is on file', body: 'The lake page shows which species were reported, and when, plus survey records that have been loaded. Lure, depth, the written report, and seasonal tactics are Standard and Premium.' },
  { title: 'Plan the outing', body: 'Standard and Premium open structure, depth, and the tactics list. CastIQ does not name a spot on the lake, and it does not decide whether ice is safe.' },
];

export function HowItWorks() {
  usePageTitle('How it works');
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="CastIQ"
        title="How it works"
        subtitle="Search a Minnesota lake, see which species were reported, and open Standard or Premium for lure, depth, and tactics."
      />
      <ol className="space-y-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-lg bg-castiq-blue p-4">
            <h2 className="text-sm font-semibold text-castiq-white">{index + 1}. {step.title}</h2>
            <p className="mt-1 text-sm text-castiq-muted">{step.body}</p>
          </li>
        ))}
      </ol>
      <Link to="/search" className="ciq-btn-primary mt-5 inline-flex">Search lakes</Link>
    </PageContainer>
  );
}
