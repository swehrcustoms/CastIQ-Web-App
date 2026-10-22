import assert from 'node:assert/strict';
import test from 'node:test';
import { annualSavings, priceFor } from '../src/data/pricing';
import { planAlertDispatch } from '../src/subscriptions/alerts';
import { applyBillingEvent, requestCheckout, tierFromSuccessUrl, type BillingState } from '../src/subscriptions/billing';
import { assertCatalogMatchesApprovedPrices, PURCHASE_SKUS, skuById } from '../src/subscriptions/catalog';
import { compareLakes, trendStatus } from '../src/subscriptions/compare';
import { canSaveLake, canSeeReportDetail, getEntitlements, hasFeature } from '../src/subscriptions/entitlements';
import { PRODUCTION_SUBSCRIPTION_FLAGS } from '../src/subscriptions/flags';
import { PROPOSED_LIMITS } from '../src/subscriptions/limits';
import { tierFromMembership, tierFromUntrustedClient, type MembershipRecord } from '../src/subscriptions/membership';
import { presentReport, reportsForStandard, responseHasPaidFields, type ReportLike } from '../src/subscriptions/reportAccess';
import { decideUnlock, settleUnlockRace, type UnlockRecord } from '../src/subscriptions/unlockLedger';

const NOW = Date.UTC(2026, 9, 14);
const DAY = 24 * 60 * 60 * 1000;

function report(id: string, lakeId: string, daysAgo: number): ReportLike {
  return {
    reportId: id,
    lakeId,
    species: ['walleye'],
    observedAt: NOW - daysAgo * DAY,
    source: 'seed_demo',
    lures: ['jig'],
    colors: ['orange'],
    depthFt: 18,
    waterTempF: 62,
    technique: 'Vertical jig',
    timeOfDay: 'morning',
    structureType: 'rock',
    conditions: 'Clear',
    note: 'Vertical jig over rock.',
  };
}

test('five purchase options keep the approved cents and one entitlement per interval', () => {
  assertCatalogMatchesApprovedPrices();
  assert.equal(PURCHASE_SKUS.length, 5);
  assert.equal(priceFor('standard', 'monthly').cents, 499);
  assert.equal(priceFor('standard', 'annual').cents, 3999);
  assert.equal(priceFor('premium', 'monthly').cents, 899);
  assert.equal(priceFor('premium', 'annual').cents, 6999);
  assert.equal(skuById('standard_monthly')?.tier, skuById('standard_annual')?.tier);
  assert.equal(skuById('premium_monthly')?.tier, skuById('premium_annual')?.tier);
  assert.deepEqual(getEntitlements('standard'), getEntitlements(skuById('standard_annual')!.tier));
  assert.deepEqual(getEntitlements('premium'), getEntitlements(skuById('premium_monthly')!.tier));
  assert.equal(hasFeature('premium', 'fishing_reports'), true);
  assert.equal(hasFeature('free', 'advanced_lake_species_filters'), false);
  assert.equal(hasFeature('free', 'seasonal_ice_reports'), true);
  assert.deepEqual(annualSavings('standard'), { cents: 1989, display: '$19.89', percent: 33 });
  assert.deepEqual(annualSavings('premium'), { cents: 3789, display: '$37.89', percent: 35 });
  assert.deepEqual(PRODUCTION_SUBSCRIPTION_FLAGS, {
    subscriptionEnforcement: false,
    paidCheckoutEnabled: false,
    premiumEmailDispatchEnabled: false,
  });
});

test('free unlocks charge three distinct reports, reopen free, and block the fourth', () => {
  let records: UnlockRecord[] = [];
  for (const id of ['a', 'b', 'c']) {
    const opened = decideUnlock({ records, reportId: id, now: NOW, authenticated: true });
    assert.equal(opened.code, 'opened');
    records = opened.records;
  }
  const again = decideUnlock({ records, reportId: 'a', now: NOW, authenticated: true });
  assert.equal(again.code, 'reopened');
  assert.equal(again.charged, false);
  assert.equal(again.records.length, 3);
  const fourth = decideUnlock({ records, reportId: 'd', now: NOW, authenticated: true });
  assert.equal(fourth.ok, false);
  assert.equal(fourth.code, 'quota');
  const anon = decideUnlock({ records: [], reportId: 'a', now: NOW, authenticated: false });
  assert.equal(anon.code, 'unauthenticated');
  assert.equal(decideUnlock({ records: [], reportId: ' a', now: NOW, authenticated: true }).code, 'invalid_report');
});

test('one remaining credit survives a race and an expired unlock costs a new credit', () => {
  const full = [{ reportId: 'a', unlockedAt: NOW }, { reportId: 'b', unlockedAt: NOW }];
  const race = settleUnlockRace(full, ['d', 'e'], NOW);
  assert.equal(race.filter((item) => item.ok).length, 1);
  assert.equal(race.filter((item) => item.code === 'quota').length, 1);
  const expired = decideUnlock({
    records: [{ reportId: 'a', unlockedAt: NOW - PROPOSED_LIMITS.rollingWindowMs - 1 }],
    reportId: 'a',
    now: NOW,
    authenticated: true,
  });
  assert.equal(expired.code, 'opened');
  assert.equal(expired.charged, true);
});

test('standard keeps 30 days plus the latest older report and does not leak locked fields', () => {
  const recent = report('recent', 'lake-1', 2);
  const oldLatest = report('old', 'lake-2', 40);
  const older = report('older', 'lake-2', 80);
  const visible = reportsForStandard([recent, oldLatest, older], NOW).map((item) => item.reportId).sort();
  assert.deepEqual(visible, ['old', 'recent']);
  const locked = presentReport({ report: older, tier: 'standard', now: NOW, authenticated: true, unlocks: [], lakeReports: [oldLatest, older] });
  assert.equal(locked.detail, 'locked');
  assert.equal(locked.paid, null);
  assert.equal(responseHasPaidFields(locked), false);
  const marked = presentReport({ report: oldLatest, tier: 'standard', now: NOW, authenticated: true, unlocks: [], lakeReports: [oldLatest, older] });
  assert.equal(marked.detail, 'full');
  assert.equal(marked.olderThanWindow, true);
  const premium = presentReport({ report: older, tier: 'premium', now: NOW, authenticated: true, unlocks: [] });
  assert.equal(premium.detail, 'full');
  assert.equal(premium.paid?.lures[0], 'jig');
});

test('saved lakes keep extras after a downgrade and block the next new save', () => {
  assert.equal(canSaveLake('free', 2, false).ok, false);
  assert.equal(canSaveLake('standard', 10, false).ok, false);
  assert.equal(canSaveLake('standard', 14, false).ok, false);
  assert.equal(canSaveLake('standard', 14, true).ok, true);
  assert.equal(canSaveLake('premium', 40, false).ok, true);
});

test('comparison has no ranking and trends stay insufficient without enough observations', () => {
  const tooMany = compareLakes([
    { lakeId: '1', lakeName: 'A', species: 'walleye', observedAt: NOW, depthFt: 10, waterTempF: null, source: 'angler' },
    { lakeId: '2', lakeName: 'B', species: 'walleye', observedAt: NOW, depthFt: null, waterTempF: 60, source: null },
    { lakeId: '3', lakeName: 'C', species: 'walleye', observedAt: NOW, depthFt: 8, waterTempF: 61, source: 'angler' },
    { lakeId: '4', lakeName: 'D', species: 'walleye', observedAt: NOW, depthFt: 9, waterTempF: 62, source: 'angler' },
  ]);
  assert.equal(tooMany.code, 'too_many_lakes');
  assert.equal(tooMany.ranking, null);
  const ready = compareLakes([
    { lakeId: '1', lakeName: 'A', species: 'walleye', observedAt: NOW, depthFt: null, waterTempF: 60, source: null },
  ]);
  assert.equal(ready.rows[0].depth, 'Not reported');
  assert.equal(ready.ranking, null);
  assert.equal(trendStatus([{ observedAt: NOW, value: 1 }]).status, 'insufficient');
});

test('alerts stay off, ignore duplicates, and require opt-in', () => {
  const delivery = { userId: 'u1', lakeId: 'lake-1', reportId: 'r1', alertType: 'new_report' as const };
  const preference = { userId: 'u1', lakeId: 'lake-1', enabled: true, unsubscribed: false };
  assert.equal(planAlertDispatch({ tier: 'premium', preference, delivery, alreadySent: [] }).reason, 'email_dispatch_disabled');
  const forced = planAlertDispatch({
    tier: 'premium',
    preference,
    delivery,
    alreadySent: [],
    flags: { ...PRODUCTION_SUBSCRIPTION_FLAGS, premiumEmailDispatchEnabled: true },
  });
  assert.equal(forced.send, true);
  const duplicate = planAlertDispatch({
    tier: 'premium',
    preference,
    delivery,
    alreadySent: [forced.send ? forced.key : ''],
    flags: { ...PRODUCTION_SUBSCRIPTION_FLAGS, premiumEmailDispatchEnabled: true },
  });
  assert.equal(duplicate.send, false);
  const unsubscribed = planAlertDispatch({
    tier: 'premium',
    preference: { ...preference, unsubscribed: true },
    delivery,
    alreadySent: [],
    flags: { ...PRODUCTION_SUBSCRIPTION_FLAGS, premiumEmailDispatchEnabled: true },
  });
  assert.equal(unsubscribed.send, false);
});

test('checkout stays disabled and webhooks do not trust the browser', () => {
  assert.equal(requestCheckout({ sku: 'standard_monthly' }).code, 'checkout_disabled');
  assert.equal(requestCheckout({ sku: 'standard_monthly', clientPriceId: 'price_fake', flags: { ...PRODUCTION_SUBSCRIPTION_FLAGS, paidCheckoutEnabled: true } }).code, 'client_price_rejected');
  assert.equal(requestCheckout({ sku: 'standard_monthly', flags: { ...PRODUCTION_SUBSCRIPTION_FLAGS, paidCheckoutEnabled: true } }).code, 'provider_not_configured');
  assert.equal(tierFromSuccessUrl(), 'free');
  assert.equal(tierFromUntrustedClient({ tier: 'premium', search: '?tier=premium' }), 'free');
  const empty: BillingState = { membership: null, appliedEventIds: [], lastEventAt: 0 };
  const paid = applyBillingEvent(empty, {
    id: 'evt-1',
    type: 'checkout_completed',
    occurredAt: NOW,
    sku: 'premium_annual',
    userId: 'u1',
    currentPeriodEnd: NOW + 365 * DAY,
  });
  assert.equal(tierFromMembership(paid.state.membership, NOW), 'premium');
  const replay = applyBillingEvent(paid.state, {
    id: 'evt-1',
    type: 'checkout_completed',
    occurredAt: NOW,
    sku: 'premium_annual',
    userId: 'u1',
    currentPeriodEnd: NOW + DAY,
  });
  assert.equal(replay.duplicate, true);
  const cancel = applyBillingEvent(paid.state, {
    id: 'evt-2',
    type: 'cancel_at_period_end',
    occurredAt: NOW + DAY,
    sku: 'premium_annual',
    userId: 'u1',
    currentPeriodEnd: NOW + 10 * DAY,
  });
  assert.equal(tierFromMembership(cancel.state.membership, NOW + 2 * DAY), 'premium');
  assert.equal(tierFromMembership(cancel.state.membership, NOW + 11 * DAY), 'free');
  const ended: MembershipRecord = { tier: 'standard', status: 'expired', currentPeriodEnd: NOW - DAY, providerCustomerId: null, providerSubscriptionId: null };
  assert.equal(tierFromMembership(ended, NOW), 'free');
  assert.equal(tierFromMembership({ ...ended, status: 'pending' }, NOW), 'free');
  assert.equal(tierFromMembership({ ...ended, status: 'error' }, NOW), 'free');
});

test('free accounts do not receive lure, depth, structure, or the written report', () => {
  assert.equal(canSeeReportDetail('free'), false);
  assert.equal(canSeeReportDetail('standard'), true);
  assert.equal(canSeeReportDetail('premium'), true);
  const view = presentReport({
    report: report('1', 'lake', 1),
    tier: 'free',
    now: NOW,
    authenticated: true,
    unlocks: [],
  });
  assert.equal(view.detail, 'locked');
  assert.equal(view.paid, null);
});
