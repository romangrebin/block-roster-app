import Link from 'next/link'
import PageContainer from '@/components/PageContainer'

// Deliberately spare — a wrong community code lands here, and there's nothing useful to say
// beyond "that's not a page" plus a way back.
export default function NotFound() {
  return (
    <PageContainer className="flex flex-col items-center justify-center text-center gap-4">
      <p className="text-5xl font-semibold text-ink">404</p>
      <p className="text-base text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="text-accent underline text-base">
        Home
      </Link>
    </PageContainer>
  )
}
