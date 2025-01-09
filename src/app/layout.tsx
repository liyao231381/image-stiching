import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '图片拼接',
  description: '从网页爬图，自动拼接图片，自定义下载',
  authors: [{ name: '理·型·健', url: 'https://design.liyao.sbs' }],
  keywords: ['图片拼接', '自动拼接', '网页爬图']
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
            <h1 className="font-lora text-4xl font-bold text-gray-800">图片拼接</h1>
          </header>
          <main>{children}</main>
          <footer className="font-lora text-center mt-8 pt-8 border-t border-gray-200">
            <p>&copy; 2024-{new Date().getFullYear()} 理·型·健</p>
          </footer>
        </div>
      </body>
    </html>
  )
}
