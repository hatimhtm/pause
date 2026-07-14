/**
 * Newest first. `id` marks the "what's new" popup generation: bump it (usually to the new
 * version string, or version+letter for OTA-only drops) whenever an entry should pop up once
 * on users' phones after they receive the update.
 */
export type ChangelogEntry = {
  id: string;
  version: string;
  date: string; // human, short
  title: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '1.4.0',
    version: '1.4.0',
    date: 'Jul 14, 2026',
    title: 'Purpose-built',
    highlights: [
      'A day under your usual pace now gets credit, not a scolding',
      'Walking away shows the time it bought back — and repeat opens wait longer',
      'Write your own reflection question; preview the pause from Settings',
      'Long-press a watched app for quick mute / pause-off',
      'Dozens of small fixes: contrast, touch targets, haptics, battery',
    ],
  },
  {
    id: '1.3.0c',
    version: '1.3.0',
    date: 'Jul 14, 2026',
    title: 'Glass & motion',
    highlights: [
      'iOS-feel everywhere: every button eases into the press and back out',
      'The tab pill glides quickly and precisely — no bounce, no lag',
      'Add several apps at once, with a search bar that never scrolls away',
      'Breathe screen reborn: glowing orb, drifting embers, layered breathing',
      'Version info (UI + engine) and this changelog, right here in Settings',
    ],
  },
  {
    id: '1.2.0',
    version: '1.2.0',
    date: 'Jul 14, 2026',
    title: 'The wait you can’t count',
    highlights: [
      'No more countdown — the wait is slightly different every time',
      '“Close it” is now the big button; “open anyway” shows up late and small',
      'A different reflection question every open',
      'Stats now reach into months and years (as Android collects them)',
      'New screens: Reaching for them & Walking away (with your streak)',
    ],
  },
  {
    id: '1.1.0',
    version: '1.1.0',
    date: 'Jul 14, 2026',
    title: 'Guilt mode',
    highlights: [
      'The pause shows your real numbers — today, yesterday, this week',
      'Pauses now last at least 15 seconds',
      'Pull down on Today to refresh and pull updates',
      'Full week view — tap any day for the breakdown',
      'Faster loading, new themes, permission and quiet-hours fixes',
    ],
  },
  {
    id: '1.0.0',
    version: '1.0.0',
    date: 'Jul 14, 2026',
    title: 'First release',
    highlights: ['A calm breath before the apps that pull you in — and honest numbers about them.'],
  },
];

export const CURRENT_CHANGELOG_ID = CHANGELOG[0].id;
