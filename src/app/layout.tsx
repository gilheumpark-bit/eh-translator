import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'EH Translator — 소설 특화 번역기',
  description: '캐릭터명/고유명사 일관성 유지, 문체 보존 4개국어 번역',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="ko">
        <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
      </html>
    </ClerkProvider>
  );
}
