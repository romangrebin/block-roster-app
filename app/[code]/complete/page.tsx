import Link from 'next/link'
import { getUserFromServerComponent } from '@/lib/auth'
import { verifyContactMethod, resolveActiveSteward, approveResident } from '@/lib/application'
import { getRepository } from '@/lib/db'
import PageContainer from '@/components/PageContainer'

// Where the resident intake magic link lands — app/api/auth/callback has already exchanged
// it for a session by the time this renders, so all that's left is linking that session back
// to the contact method it verified.
export default async function JoinCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ contactMethodId?: string }>
}) {
  const { code } = await params
  const { contactMethodId } = await searchParams
  const user = await getUserFromServerComponent()

  const registerAgainLink = (
    <Link href={`/${code}`} className="text-accent underline">
      Register again
    </Link>
  )

  if (!user || !contactMethodId) {
    return (
      <PageContainer className="space-y-2">
        <p className="text-lg font-medium text-ink">That link didn&apos;t work.</p>
        <p className="text-base text-muted">It may have expired. {registerAgainLink}.</p>
      </PageContainer>
    )
  }

  let autoApproved = false
  try {
    const contactMethod = await verifyContactMethod(contactMethodId, user.id, user.email)

    // A steward registering their own residence doesn't need another steward to approve them —
    // they're already the trusted party who'd normally be the one clicking Approve. Only kicks in
    // if they're not already approved some other way (idempotent re-verification, etc.).
    const repo = getRepository()
    const resident = await repo.residents.getById(contactMethod.residentId)
    if (resident && resident.status === 'pending') {
      const residence = await repo.residences.getById(resident.residenceId)
      const steward = residence ? await resolveActiveSteward(residence.blockId, user.id) : null
      if (steward) {
        await approveResident(resident.id, steward.id)
        autoApproved = true
      }
    }
  } catch {
    return (
      <PageContainer className="space-y-2">
        <p className="text-lg font-medium text-ink">Something went wrong confirming your registration.</p>
        <p className="text-base text-muted">{registerAgainLink}.</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-2">
      <p className="text-2xl font-medium text-ink">You&apos;re registered!</p>
      {autoApproved ? (
        <p className="text-lg text-muted">
          You&apos;re approved automatically since you&apos;re already a steward here. Visit{' '}
          <Link href={`/${code}`} className="text-accent underline">
            this community&apos;s page
          </Link>{' '}
          to see the resident directory.
        </p>
      ) : (
        <p className="text-lg text-muted">
          A steward will approve you soon — no further action needed. Once approved, sign in on{' '}
          <Link href={`/${code}`} className="text-accent underline">
            this community&apos;s page
          </Link>{' '}
          anytime to see the resident directory.
        </p>
      )}
    </PageContainer>
  )
}
