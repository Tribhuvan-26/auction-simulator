import type { Metadata } from "next";
import { spaceGrotesk, inter, cormorant } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: "IPL Auction Simulator",
  description: "Step into the IPL auction arena, where strategy meets passion. Pick your team, bid for the best, and build a champion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="font-body bg-brand-white text-brand-charcoal min-h-full flex flex-col">{children}</body>
    </html>
  )
}
