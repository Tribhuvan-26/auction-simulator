import type { Metadata } from "next";
import { spaceGrotesk, inter } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: "Auction Live",
  description: "Real-time IPL-style player auction",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="font-body bg-brand-white text-brand-charcoal min-h-full flex flex-col">{children}</body>
    </html>
  )
}
