import { useState } from 'react';
import { PageContainer, PageHeader } from '../components/ui/Chrome';
import { AppCard } from '../components/ui/Data';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  LIVE_CHECKOUT_ENABLED,
  PLANS,
  PRICING_DISCLAIMER,
  PRICING_HERO,
  annualPricePerMonth,
  annualSavings,
  monthlyYearTotal,
  priceFor,
  type BillingInterval,
} from '../data/pricing';

export function Pricing() {
  usePageTitle('Pricing');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <PageContainer>
      <PageHeader eyebrow="Plans" title={PRICING_HERO.title} subtitle={PRICING_HERO.description} />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Billing interval">
        {(['monthly', 'annual'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={interval === option}
            onClick={() => setInterval(option)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium ${
              interval === option ? 'bg-castiq-teal text-castiq-blue-dark' : 'bg-castiq-blue text-castiq-white'
            }`}
          >
            {option === 'monthly' ? 'Monthly' : 'Annual'}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 lg:grid-cols-3">
        <li>
          <AppCard className="flex h-full flex-col">
            <h2 className="text-lg font-semibold text-castiq-white">Free</h2>
            <p className="mt-1 text-2xl font-bold text-castiq-teal">$0</p>
            <p className="mt-2 text-sm text-castiq-muted">Search lakes, read public report dates, and open ice safety guidance.</p>
            <ul className="mt-3 flex-1 list-disc space-y-2 pl-5 text-sm text-castiq-white">
              <li>Lake and species search</li>
              <li>Dated public report previews</li>
              <li>Ice safety guidance and official source links</li>
            </ul>
            <p className="mt-4 text-sm font-medium text-castiq-white">No renewal</p>
            <p className="mt-5 text-sm text-castiq-muted">Lure, depth, structure, the written report, and seasonal tactics stay on Standard and Premium.</p>
          </AppCard>
        </li>
        {PLANS.map((plan) => {
          const monthly = priceFor(plan.tier, 'monthly');
          const annual = priceFor(plan.tier, 'annual');
          const annualPerMonth = annualPricePerMonth(plan.tier);
          const monthToMonthYear = monthlyYearTotal(plan.tier);
          return (
            <li key={plan.tier}>
              <AppCard className={`flex h-full flex-col ${plan.tier === 'premium' ? 'ring-1 ring-castiq-teal' : ''}`}>
                <h2 className="text-lg font-semibold text-castiq-white">{plan.name}</h2>
                {interval === 'monthly' ? (
                  <p className="mt-1 text-2xl font-bold text-castiq-teal">{monthly.display}</p>
                ) : (
                  <div className="mt-1">
                    <p className="text-2xl font-bold text-castiq-teal">{annual.display}</p>
                    <p className="mt-2 text-lg font-semibold text-red-400 line-through decoration-red-500 decoration-2">
                      {monthly.display}
                    </p>
                    <p className="text-2xl font-bold text-castiq-white">{annualPerMonth.display}</p>
                    <p className="text-xs text-castiq-muted">
                      Annual plan broken down by month. Save {annualSavings(plan.tier).display} versus 12 monthly payments.
                    </p>
                  </div>
                )}
                <p className="mt-2 text-sm text-castiq-muted">{plan.subtitle}</p>
                {'inherits' in plan && plan.inherits && (
                  <p className="mt-4 text-sm font-medium text-castiq-white">{plan.inherits}</p>
                )}
                <ul className="mt-3 flex-1 list-disc space-y-2 pl-5 text-sm text-castiq-white">
                  {plan.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-4 text-sm font-medium text-castiq-white">
                  {interval === 'monthly' ? `Annual plan: ${monthToMonthYear.display}` : `Annual plan: ${annual.display}`}
                </p>
                <button
                  type="button"
                  className="ciq-btn-primary mt-5"
                  onClick={() =>
                    setNotice(
                      LIVE_CHECKOUT_ENABLED
                        ? 'Checkout is open.'
                        : 'Coming soon. CastIQ is not charging for Standard or Premium yet.',
                    )
                  }
                >
                  {LIVE_CHECKOUT_ENABLED ? `Continue with ${plan.name}` : 'Coming soon'}
                </button>
              </AppCard>
            </li>
          );
        })}
      </ul>

      {notice && <p className="mt-4 text-sm text-castiq-muted" role="status">{notice}</p>}
      <section className="mt-8" aria-labelledby="plan-access">
        <h2 id="plan-access" className="text-sm font-semibold text-castiq-white">What each plan can open</h2>
        <p className="mt-1 text-xs text-castiq-muted">
          Monthly and annual copies of a plan open the same features. Full report detail is Standard and Premium. Saved-lake number caps below are proposed and are not turned on.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm text-castiq-white">
            <thead>
              <tr className="text-xs text-castiq-muted">
                <th className="py-2 pr-3 font-medium">Access</th>
                <th className="py-2 pr-3 font-medium">Free</th>
                <th className="py-2 pr-3 font-medium">Standard</th>
                <th className="py-2 font-medium">Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/10"><td className="py-2 pr-3">Lake search</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
              <tr className="border-t border-white/10"><td className="py-2 pr-3">Report dates and sources</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
              <tr className="border-t border-white/10"><td className="py-2 pr-3">Full report detail</td><td>Not included</td><td>Included</td><td>Included</td></tr>
              <tr className="border-t border-white/10"><td className="py-2 pr-3">Saved lakes</td><td>Proposed: 2</td><td>Proposed: 10</td><td>Unlimited</td></tr>
              <tr className="border-t border-white/10"><td className="py-2 pr-3">Ice safety</td><td>Always</td><td>Always</td><td>Always</td></tr>
              <tr className="border-t border-white/10"><td className="py-2 pr-3">Compare lakes and trends</td><td>No</td><td>No</td><td>When the data supports it</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-6 text-xs text-castiq-muted">{PRICING_DISCLAIMER}</p>
    </PageContainer>
  );
}
