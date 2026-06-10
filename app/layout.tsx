import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'EditorPulse - Publication Summary & Planner',
  description: 'A professional publication summary system that automatically handles parsing, front & back page summarization, and jump news integration.',
  icons: {
    icon: '/editorpulse-logo.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
