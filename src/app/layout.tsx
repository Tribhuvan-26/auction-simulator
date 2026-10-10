import type { Metadata } from "next";
import { spaceGrotesk, spaceGroteskExt, inter, interExt, oswald, oswaldExt, bebasNeue, bebasNeueExt, teko, tekoExt } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: "IPL Auction Live — Official Control Room",
  description: "Official Indian Premier League live player auction simulation system",
};

const LOADER_GATE = `try{if(sessionStorage.getItem('ipl-loader'))document.documentElement.classList.add('loader-skip')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${oswald.variable} ${bebasNeue.variable} ${teko.variable} ${spaceGroteskExt.variable} ${interExt.variable} ${oswaldExt.variable} ${bebasNeueExt.variable} ${tekoExt.variable} h-full antialiased dark`}
      suppressHydrationWarning // the loader gate below adds a class before hydration
    >
      <head>
        {/* landing loader (src/components/ui/Loader.tsx) plays once per session: skip it before first paint */}
        <script dangerouslySetInnerHTML={{ __html: LOADER_GATE }} />
      </head>

      <body className="font-body bg-[#121212] text-brand-white min-h-full flex flex-col selection:bg-brand-blue selection:text-white">
        {children}
      </body>
    </html>
  )
}
