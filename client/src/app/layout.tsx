import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { GlobalUI } from './global-ui';

export const metadata: Metadata = {
  title: 'TaskTrack',
  description: 'Local-first project and task management',
};

// Script to set theme before hydration to prevent flash
const darkModeScript = `
(function() {
  const storedTheme = localStorage.getItem('theme');
  const darkThemes = new Set([
    'taskflow-dark',
    'catppuccin-frappe',
    'catppuccin-macchiato',
    'catppuccin-mocha',
    'dracula',
    'nord',
    'tokyo-night',
    'one-dark',
    'gruvbox-dark',
    'solarized-dark',
    'github-dark'
  ]);
  const isValidStoredTheme = typeof storedTheme === 'string' && storedTheme.length > 0;
  const theme = isValidStoredTheme ? storedTheme : null;
  const legacyDarkMode = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme
    ? darkThemes.has(theme)
    : (legacyDarkMode !== null ? JSON.parse(legacyDarkMode) : prefersDark);

  const resolvedTheme = theme || (isDark ? 'taskflow-dark' : 'taskflow-light');
  document.documentElement.setAttribute('data-theme', resolvedTheme);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body>
        <Providers>
          {children}
          <GlobalUI />
        </Providers>
      </body>
    </html>
  );
}
