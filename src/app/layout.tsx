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
          <header className="text-center pb-4 border-b-2 border-gray-200">
            <h1 className="text-4xl font-bold text-gray-800">图片拼接</h1>
          </header>
          <main>{children}</main>
          <footer className="text-center mt-8 pt-8 border-t border-gray-200">
            <p>&copy; {new Date().getFullYear()} 理型健</p>
          </footer>
        </div>
      </body>
    </html>
  )
}
