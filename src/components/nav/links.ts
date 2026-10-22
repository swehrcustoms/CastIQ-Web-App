export interface AppLink {
  to: string;
  label: string;
  end?: boolean;
}

export const TOP_LINKS: AppLink[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Search' },
  { to: '/ice', label: 'Ice' },
  { to: '/social', label: 'Social' },
];

export const MORE_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/border-waters', label: 'Border' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/regulations', label: 'Regulations' },
  { to: '/tactics', label: 'Tactics' },
  { to: '/submit-report', label: 'Share a Report' },
];
