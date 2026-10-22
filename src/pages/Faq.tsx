import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageContainer, PageHeader } from '../components/ui/Chrome';
import { usePageTitle } from '../hooks/usePageTitle';

const FAQS = [
  { q: 'What can I do without paying?', a: 'You can create an account, search Minnesota lakes, see which species were reported and when, and open ice guidance. Lure, depth, structure, the written report, and seasonal tactics are Standard and Premium.' },
  { q: 'Which waters are covered?', a: 'Search uses the Minnesota DNR lake catalog. A lake can appear even when CastIQ does not yet have a fishing report or survey for it.' },
  { q: 'How fresh is a fishing report?', a: 'Reports show their dates and sources. CastIQ does not rewrite a report to look newer than it is.' },
  { q: 'Is there a free trial of Standard or Premium?', a: 'No. The approved pricing does not include a free trial, and paid checkout is not open yet.' },
  { q: 'What is the difference between Standard and Premium?', a: 'The pricing page lists the approved features. Billing interval does not change those features. Several Premium items are not sold as working features yet.' },
  { q: 'Can I cancel?', a: 'There is nothing to cancel until CastIQ starts charging.' },
  { q: 'Does ice information mean the ice is safe?', a: 'No. Ice pages are informational. You have to judge ice conditions yourself.' },
];

export function Faq() {
  usePageTitle('FAQ');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(FAQS[0].q);
  const visible = useMemo(
    () => FAQS.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader eyebrow="CastIQ" title="FAQ" subtitle="Accounts, coverage, reports, plans, and ice." />
      <form onSubmit={(event: FormEvent) => event.preventDefault()}>
        <label htmlFor="faq-search" className="sr-only">Search questions</label>
        <input id="faq-search" className="ciq-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" />
      </form>
      <div className="mt-4 divide-y divide-white/10 rounded-lg bg-castiq-blue">
        {visible.map((item) => {
          const expanded = open === item.q;
          return (
            <div key={item.q}>
              <button type="button" className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? '' : item.q)}>
                <span className="text-sm font-medium text-castiq-white">{item.q}</span>
                <span className="text-castiq-muted" aria-hidden>{expanded ? '−' : '+'}</span>
              </button>
              {expanded && <p className="px-4 pb-3 text-sm leading-relaxed text-castiq-muted">{item.a}</p>}
            </div>
          );
        })}
        {visible.length === 0 && <p className="px-4 py-6 text-sm text-castiq-muted">No questions match that search.</p>}
      </div>
    </PageContainer>
  );
}
