import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Old School Faces - Guess the older merged actors | AGWS',
  description: 'A Guessing game of merged actors, for the older generations.',
  openGraph: {
    type: 'website',
    images: ['https://agws.app/oldschoolfaces/oldschoolfaceslogo.png'],
    url: 'https://agws.app/oldschoolfaces',
    description: 'A Guessing game of merged actors, for the older generations.',
    title: 'Old School Faces',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
