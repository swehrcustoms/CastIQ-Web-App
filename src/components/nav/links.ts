export interface AppLink {
  to: string;
  label: string;
  end?: boolean;
  section?: string;
}

export const TOP_LINKS: AppLink[] = [
  { to: '/search', label: 'Search' },
  { to: '/ice', label: 'Ice' },
  { to: '/social', label: 'Social' },
];

/** Pages that also appear on the marketing site, then tools that stay in the app. */
export const MORE_LINKS: AppLink[] = [
  { to: '/features', label: 'Features', section: 'Website' },
  { to: '/how-it-works', label: 'How It Works', section: 'Website' },
  { to: '/pricing', label: 'Pricing', section: 'Website' },
  { to: '/about', label: 'About', section: 'Website' },
  { to: '/faq', label: 'FAQ', section: 'Website' },
  { to: '/border-waters', label: 'Border', section: 'App' },
  { to: '/regulations', label: 'Regulations', section: 'App' },
  { to: '/tactics', label: 'Tactics', section: 'App' },
  { to: '/submit-report', label: 'Share a Report', section: 'App' },
];
