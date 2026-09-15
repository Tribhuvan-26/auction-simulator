import type { Metadata } from "next";
import { spaceGrotesk, inter, oswald } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: "IPL Auction Live — Control Room",
  description: "Real-time professional IPL-style live player auction control system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${oswald.variable} h-full antialiased dark`}
    >
      <body className="font-body bg-[#121212] text-brand-white min-h-full flex flex-col selection:bg-brand-blue selection:text-white">
        {children}
      </body>
    </html>
  )
}

