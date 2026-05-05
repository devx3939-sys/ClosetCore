import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://closetcore.app'),
  title: {
    default: 'ClosetCore — your wardrobe, beautifully organized',
    template: '%s — ClosetCore',
  },
  description:
    'Digitize your wardrobe, build outfits in seconds, and discover the colors that look best on you. One account on Mac, Windows, iOS, Android, and the web.',
  openGraph: {
    title: 'ClosetCore — your wardrobe, beautifully organized',
    description:
      'Digitize your wardrobe, build outfits in seconds, and discover the colors that look best on you.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClosetCore — your wardrobe, beautifully organized',
    description:
      'Your wardrobe, organized. Outfits in seconds. The colors that flatter you.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
