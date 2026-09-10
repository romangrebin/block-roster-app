import { notFound } from 'next/navigation'
import { getUserFromServerComponent } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward, resolveApprovedResident, getResidentDirectory } from '@/lib/application'
import type { Resident, ContactMethod } from '@/lib/types'
import ResidentIntakeForm from '@/components/ResidentIntakeForm'
import JoinLinkBox from '@/components/JoinLinkBox'
import ResidencesWorkspace from '@/components/ResidencesWorkspace'
import BlockContentForm from '@/components/BlockContentForm'
import MyInfoForm from '@/components/MyInfoForm'
import PageContainer from '@/components/PageContainer'
import CommunityTabs from '@/components/CommunityTabs'
import LendingLibrarySection, { type LibraryItem } from '@/components/LendingLibrarySection'

type ResidentRow = { resident: Resident; contacts: ContactMethod[] }

// The community's one page — everyone who knows the code lands here. A steward sees the exact same
// page as a resident would, with a "Manage" panel and the unfiltered resident list (pending
// included, every contact method, Approve controls) layered on top — not a separate dashboard.
// See resolveApprovedResident/getResidentDirectory in lib/application.ts for the access checks.
export default async function CommunityPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const repo = getRepository()
  const block = await repo.blocks.getByCode(code)
  if (!block) notFound()

  const user = await getUserFromServerComponent()
  const isSteward = user ? (await resolveActiveSteward(block.id, user.id)) !== null : false
  const viewerResident = user ? await resolveApprovedResident(block.id, user.id) : null
  const hasPrivateAccess = isSteward || viewerResident !== null
  const viewerContacts = viewerResident ? await repo.contactMethods.listByResident(viewerResident.id) : []

  const residences = await repo.residences.listByBlock(block.id)
  const joinOptions = residences.map((r) => ({ id: r.id, label: r.label, nickname: r.nickname, shape: r.shape }))

  // Stewards see every resident (pending included) with full contact info and Approve/
  // promote/move-out controls; approved residents see the peer-safe view instead —
  // approved-only, block_wide contacts only.
  let residentsByResidence: Map<string, ResidentRow[]> | null = null
  let activeStewardUserIds: string[] = []
  if (isSteward) {
    residentsByResidence = new Map()
    for (const residence of residences) {
      const residents = await repo.residents.listByResidence(residence.id)
      const rows = await Promise.all(
        residents.map(async (resident) => ({
          resident,
          contacts: await repo.contactMethods.listByResident(resident.id),
        }))
      )
      residentsByResidence.set(residence.id, rows)
    }
    const stewards = await repo.stewards.listByBlock(block.id)
    activeStewardUserIds = stewards.filter((s) => s.status === 'active').map((s) => s.userId)
  } else if (hasPrivateAccess) {
    const directory = await getResidentDirectory(block.id)
    residentsByResidence = new Map(directory.map((entry) => [entry.residence.id, entry.residents]))
  }

  const currentCount = residences.filter((r) => r.status === 'current').length

  // Reuses the same steward-full/peer-safe resident+contact data already fetched above, keyed by
  // resident instead of residence — items belong to a resident, and this is exactly the same
  // "who's allowed to see whose contact info" split getResidentDirectory already computed, so
  // there's no separate visibility logic to write for the Lending Library's owner-contact display.
  let libraryItems: LibraryItem[] = []
  if (block.lendingLibraryEnabled && hasPrivateAccess) {
    const residentInfoById = new Map<string, { name: string; contacts: ContactMethod[] }>()
    for (const rows of residentsByResidence?.values() ?? []) {
      for (const { resident, contacts } of rows) {
        residentInfoById.set(resident.id, { name: resident.name, contacts })
      }
    }
    const items = await repo.items.listByBlock(block.id)
    libraryItems = items.flatMap((item) => {
      const owner = residentInfoById.get(item.residentId)
      // Shouldn't normally miss — items only ever belong to approved residents (see
      // POST /api/blocks/[id]/items), same population getResidentDirectory already includes.
      // A moved-out owner's stale listing just quietly stops showing to peers this way, same as
      // their contact info already does elsewhere on this page.
      return owner ? [{ item, ownerName: owner.name, ownerContacts: owner.contacts }] : []
    })
  }

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-ink">{block.name}</h1>
        {isSteward && (
          <p className="text-base text-muted mt-1">
            {currentCount} of {residences.length} residences current
          </p>
        )}
        {block.publicBlurb && (
          <p className="text-lg text-muted mt-2 whitespace-pre-wrap">{block.publicBlurb}</p>
        )}
      </div>

      {hasPrivateAccess && (
        <CommunityTabs
          community={
            <div className="space-y-8">
              <ResidencesWorkspace
                isSteward={isSteward}
                blockId={block.id}
                blockBoundary={block.boundary}
                canvasType={block.canvasType}
                entries={
                  residentsByResidence
                    ? residences.map((residence) => ({
                        residence,
                        residents: residentsByResidence!.get(residence.id) ?? [],
                      }))
                    : null
                }
                activeStewardUserIds={activeStewardUserIds}
                showExportLink={isSteward || block.residentExportEnabled}
                viewerEmail={user?.email ?? null}
                viewerResidenceId={viewerResident?.residenceId ?? null}
              />
              {block.privateNotes && (
                <div className="space-y-2">
                  <h2 className="text-lg font-medium text-ink">From your steward</h2>
                  <p className="text-base text-ink whitespace-pre-wrap">{block.privateNotes}</p>
                </div>
              )}
            </div>
          }
          library={
            block.lendingLibraryEnabled && (
              <LendingLibrarySection
                blockId={block.id}
                items={libraryItems}
                viewerResidentId={viewerResident?.id ?? null}
              />
            )
          }
          myInfo={
            viewerResident ? (
              <MyInfoForm residentId={viewerResident.id} blurb={viewerResident.blurb} contacts={viewerContacts} />
            ) : isSteward ? (
              // A steward isn't automatically a resident too — createFounding just makes a
              // stewards row, no matching residence claimed. Same registration form anyone else
              // uses, just surfaced here instead of hidden behind the signed-out join section
              // (hasPrivateAccess, which is true for any steward, hides that one entirely) —
              // auto-approved on verification since they're already the trusted party (see
              // app/[code]/complete/page.tsx).
              <div className="space-y-3">
                <h2 className="text-lg font-medium text-ink">Register your own residence</h2>
                <p className="text-base text-muted">
                  You&apos;re a steward here, but haven&apos;t registered your own residence yet —
                  do that below to show up in the directory like everyone else. You&apos;ll be
                  approved automatically.
                </p>
                {joinOptions.length === 0 ? (
                  <p className="text-base text-muted">No residences have been set up for this community yet.</p>
                ) : (
                  <ResidentIntakeForm
                    code={block.code}
                    residences={joinOptions}
                    canvasType={block.canvasType}
                    signedInEmail={user?.email ?? null}
                  />
                )}
              </div>
            ) : null
          }
          manage={
            isSteward && (
              <div className="space-y-6 border border-border rounded-2xl bg-surface-muted p-5">
                <JoinLinkBox code={block.code} />
                <BlockContentForm
                  blockId={block.id}
                  code={block.code}
                  publicBlurb={block.publicBlurb}
                  privateNotes={block.privateNotes}
                  residentExportEnabled={block.residentExportEnabled}
                  lendingLibraryEnabled={block.lendingLibraryEnabled}
                />
              </div>
            )
          }
        />
      )}

      {!hasPrivateAccess && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-ink">Join {block.name}</h2>
          {joinOptions.length === 0 ? (
            <p className="text-base text-muted">No residences have been set up for this community yet.</p>
          ) : (
            <ResidentIntakeForm
              code={block.code}
              residences={joinOptions}
              canvasType={block.canvasType}
              signedInEmail={user?.email ?? null}
            />
          )}
        </div>
      )}
    </PageContainer>
  )
}
