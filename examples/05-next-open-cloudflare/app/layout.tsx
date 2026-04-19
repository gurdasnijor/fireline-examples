import type { ReactNode } from 'react'
import './styles.css'

export const metadata = {
  title: 'Fireline OpenNext Cloudflare Discovery',
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
