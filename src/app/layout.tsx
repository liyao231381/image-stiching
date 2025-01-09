import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'URL Image Stitching App',
  description: 'Stitch images from a URL.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="container mx-auto p-4">
          <header className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">URL Image Stitching App</h1>
          </header>
          <main>{children}</main>
          <footer className="text-center mt-8 pt-8 border-t border-gray-200">
            <p>&copy; {new Date().getFullYear()} Your Name</p>
          </footer>
        </div>
      </body>
    </html>
  )
}
