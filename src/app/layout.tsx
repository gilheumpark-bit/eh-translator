import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/AuthContext';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EH-Translator V3.1 — Professional AI Narrative Engine',
  description: '하이엔드 소설 및 문서 번역을 위한 에이전틱 번역 시스템. 고유 명사 유지, 캐릭터 페르소나 보존, 멀티 스테이지 정밀 파이프라인 제공.',
  keywords: ['AI translator', 'Novel translation', 'Narrative engine', 'DeepSeek', 'Claude', 'GPT-4o', 'Professional translation'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} ${manrope.variable} min-h-screen`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
