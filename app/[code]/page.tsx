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
  // The three lookups below don't depend on each other — running them together instead of one
  // after another saves two round-trips' worth of latency on every load of this page.
  const [steward, viewerResident, residences] = await Promise.all([
    user ? resolveActiveSteward(block.id, user.id) : Promise.resolve(null),
    user ? resolveApprovedResident(block.id, user.id) : Promise.resolve(null),
    repo.residences.listByBlock(block.id),
  ])
  const isSteward = steward !== null
  const hasPrivateAccess = isSteward || viewerResident !== null
  const viewerContacts = viewerResident ? await repo.contactMethods.listByResident(viewerResident.id) : []

  const joinOptions = residences.map((r) => ({ id: r.id, label: r.label, nickname: r.nickname, shape: r.shape }))
  // stewardNotes is steward-eyes-only — strip it before a residence reaches any client prop for
  // a non-steward viewer. Not just a UI gate: this keeps it out of the page's RSC payload
  // entirely, so it can't be found via view-source either.
  const residencesForViewer = isSteward ? residences : residences.map((r) => ({ ...r, stewardNotes: null }))

  // Stewards see every resident (pending included) with full contact info and Approve/
  // promote/move-out controls; approved residents see the peer-safe view instead —
  // approved-only, block_wide contacts only.
  let residentsByResidence: Map<string, ResidentRow[]> | null = null
  let activeStewards: { userId: string; stewardId: string }[] = []
  if (isSteward) {
    const [allResidents, stewards] = await Promise.all([
      repo.residents.listByBlock(block.id),
      repo.stewards.listByBlock(block.id),
    ])
    const contacts = await repo.contactMethods.listByResidents(allResidents.map((r) => r.id))
    const contactsByResident = new Map<string, ContactMethod[]>()
    for (const contact of contacts) {
      const list = contactsByResident.get(contact.residentId) ?? []
      list.push(contact)
      contactsByResident.set(contact.residentId, list)
    }

    residentsByResidence = new Map(residences.map((residence) => [residence.id, [] as ResidentRow[]]))
    for (const resident of allResidents) {
      residentsByResidence.get(resident.residenceId)?.push({
        resident,
        contacts: contactsByResident.get(resident.id) ?? [],
      })
    }
    activeStewards = stewards
      .filter((s) => s.status === 'active')
      .map((s) => ({ userId: s.userId, stewardId: s.id }))
  } else if (hasPrivateAccess) {
    const directory = await getResidentDirectory(block.id)
    residentsByResidence = new Map(directory.map((entry) => [entry.residence.id, entry.residents]))
  }

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
        {isSteward && residences.length > 0 && (
          <p className="text-base text-muted mt-1">
            {residences.length} residence{residences.length === 1 ? '' : 's'}
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
              {block.privateNotes && (
                <div className="rounded-2xl border border-border bg-surface-muted p-5">
                  <p className="text-sm font-medium text-muted mb-1.5">About this community</p>
                  <p className="text-base text-ink whitespace-pre-wrap">{block.privateNotes}</p>
                </div>
              )}
              <ResidencesWorkspace
                isSteward={isSteward}
                blockId={block.id}
                blockBoundary={block.boundary}
                canvasType={block.canvasType}
                entries={
                  residentsByResidence
                    ? residencesForViewer.map((residence) => ({
                        residence,
                        residents: residentsByResidence!.get(residence.id) ?? [],
                      }))
                    : null
                }
                activeStewards={activeStewards}
                showExportLink={isSteward || block.residentExportEnabled}
                viewerEmail={user?.email ?? null}
                viewerResidenceId={viewerResident?.residenceId ?? null}
              />
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
              <MyInfoForm
                residentId={viewerResident.id}
                name={viewerResident.name}
                blurb={viewerResident.blurb}
                contacts={viewerContacts}
              />
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
                  name={block.name}
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
