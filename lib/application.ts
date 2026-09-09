import { getRepository } from './db'
import type { Block, BlockInput, ContactMethod, ContactVisibility, Residence, Resident, Steward } from './types'

/**
 * Cross-table invariants that no single repository method can enforce alone (see
 * notes/minimal-schema-proposal.md's "Data access" section). confirmResidentPresence (the
 * annual "still here?" reconfirmation cycle) is designed there but not implemented — Roman's
 * call 2026-09-08, a steward will notice and record move-outs manually for now rather than
 * building an automated nudge before there's a real pilot to learn from.
 */

export async function createBlock(input: BlockInput, founderUserId: string): Promise<Block> {
  const repo = getRepository()
  const block = await repo.blocks.create(input)
  await repo.stewards.createFounding(block.id, founderUserId)
  return block
}

export async function registerResident(
  residenceId: string,
  name: string,
  contact: { type: ContactMethod['type']; value: string; visibility?: ContactVisibility },
  // Never verified — no phone-OTP path exists yet (needs a paid SMS vendor, deliberately not
  // chosen). Stored purely as steward-visible info alongside the verified contact above.
  unverifiedPhone?: { value: string; visibility?: ContactVisibility }
): Promise<{ resident: Resident; contactMethod: ContactMethod }> {
  const repo = getRepository()
  const residence = await repo.residences.getById(residenceId)
  if (!residence) throw new Error('registerResident: residence not found')

  const resident = await repo.residents.create({ residenceId, name })
  const contactMethod = await repo.contactMethods.create({
    residentId: resident.id,
    type: contact.type,
    value: contact.value,
    visibility: contact.visibility,
  })
  if (unverifiedPhone) {
    await repo.contactMethods.create({
      residentId: resident.id,
      type: 'phone',
      value: unverifiedPhone.value,
      visibility: unverifiedPhone.visibility,
    })
  }
  return { resident, contactMethod }
}

/**
 * Links a verified Supabase Auth session back to the contact method it verified. The value
 * check stops a session from confirming a *different* resident's contact method via a
 * guessed/reused id.
 */
export async function verifyContactMethod(
  contactMethodId: string,
  userId: string,
  verifiedValue: string
): Promise<ContactMethod> {
  const repo = getRepository()
  const contactMethod = await repo.contactMethods.getById(contactMethodId)
  if (!contactMethod) throw new Error('verifyContactMethod: contact method not found')
  if (contactMethod.value.trim().toLowerCase() !== verifiedValue.trim().toLowerCase()) {
    throw new Error('verifyContactMethod: verified session does not match this contact method')
  }
  if (contactMethod.verifiedAt) return contactMethod // idempotent
  return repo.contactMethods.markVerified(contactMethodId, userId)
}

export async function approveResident(residentId: string, stewardId: string): Promise<Resident> {
  const repo = getRepository()
  const resident = await repo.residents.approve(residentId, stewardId)
  await repo.residences.setStatus(resident.residenceId, 'current')
  return resident
}

/**
 * approved → moved_out. Resets this resident's block_wide contacts to steward_only — moving out
 * re-locks visibility rather than leaving stale contact info exposed community-wide — then
 * re-derives the residence's status: vacant only if no other resident there is still approved
 * (a residence can hold several residents, e.g. roommates, so one moving out doesn't necessarily
 * vacate it).
 */
export async function moveResidentOut(residentId: string): Promise<Resident> {
  const repo = getRepository()
  const resident = await repo.residents.moveOut(residentId)

  const contactMethods = await repo.contactMethods.listByResident(residentId)
  for (const contactMethod of contactMethods) {
    if (contactMethod.visibility === 'block_wide') {
      await repo.contactMethods.setVisibility(contactMethod.id, 'steward_only')
    }
  }

  const siblings = await repo.residents.listByResidence(resident.residenceId)
  const stillCurrent = siblings.some((r) => r.status === 'approved')
  await repo.residences.setStatus(resident.residenceId, stillCurrent ? 'current' : 'vacant')

  return resident
}

/**
 * Promotes an approved resident directly to active steward — no email invite round-trip, since
 * a co-steward candidate is someone already registered and known, not a cold contact. Requires
 * the resident to hold a verified contact method, which approval already guarantees.
 */
export async function promoteResidentToSteward(residentId: string, promotedBy: string): Promise<Steward> {
  const repo = getRepository()
  const resident = await repo.residents.getById(residentId)
  if (!resident) throw new Error('promoteResidentToSteward: resident not found')
  if (resident.status !== 'approved') throw new Error('promoteResidentToSteward: resident is not approved')

  const residence = await repo.residences.getById(resident.residenceId)
  if (!residence) throw new Error('promoteResidentToSteward: residence not found')

  const contactMethods = await repo.contactMethods.listByResident(residentId)
  const userId = contactMethods.find((c) => c.userId)?.userId
  if (!userId) throw new Error('promoteResidentToSteward: resident has no verified sign-in to promote')

  return repo.stewards.promote(residence.blockId, userId, promotedBy)
}

/** Resolves a user to their active steward row for a block, or null if they aren't one. */
export async function resolveActiveSteward(blockId: string, userId: string): Promise<Steward | null> {
  const repo = getRepository()
  const stewards = await repo.stewards.listByBlock(blockId)
  return stewards.find((s) => s.userId === userId && s.status === 'active') ?? null
}

/**
 * Resolves a signed-in user to their approved resident row for a block, or null if they aren't
 * one. A user can hold several verified contact methods (one per block they've ever registered
 * at) — this checks all of them for one that lands in this block and is approved.
 */
export async function resolveApprovedResident(blockId: string, userId: string): Promise<Resident | null> {
  const repo = getRepository()
  const contactMethods = await repo.contactMethods.listByUserId(userId)
  for (const contactMethod of contactMethods) {
    const resident = await repo.residents.getById(contactMethod.residentId)
    if (!resident || resident.status !== 'approved') continue
    const residence = await repo.residences.getById(resident.residenceId)
    if (residence?.blockId === blockId) return resident
  }
  return null
}

export type MemberBlock = { block: Block; resident: Resident }

/**
 * Every block a signed-in user is an approved resident of — the resident-side counterpart to
 * stewards.listByUserId, used by the home page's "Your blocks" list. Dedupes by block: a user
 * with more than one verified contact method landing in the same block only appears once.
 */
export async function listApprovedResidentBlocks(userId: string): Promise<MemberBlock[]> {
  const repo = getRepository()
  const contactMethods = await repo.contactMethods.listByUserId(userId)
  const seenBlockIds = new Set<string>()
  const results: MemberBlock[] = []
  for (const contactMethod of contactMethods) {
    const resident = await repo.residents.getById(contactMethod.residentId)
    if (!resident || resident.status !== 'approved') continue
    const residence = await repo.residences.getById(resident.residenceId)
    if (!residence || seenBlockIds.has(residence.blockId)) continue
    const block = await repo.blocks.getById(residence.blockId)
    if (!block) continue
    seenBlockIds.add(block.id)
    results.push({ block, resident })
  }
  return results
}

export type DirectoryEntry = {
  residence: Residence
  residents: { resident: Resident; contacts: ContactMethod[] }[]
}

/**
 * The block's roster as a peer (an approved resident) is allowed to see it: approved residents
 * only, and only their block_wide contact methods — steward_only contacts stay hidden even from
 * other verified neighbors. app/[code]/page.tsx uses this for a resident viewer, but queries the
 * repository directly for a steward viewer, who sees the unfiltered version on the same page.
 */
export async function getResidentDirectory(blockId: string): Promise<DirectoryEntry[]> {
  const repo = getRepository()
  const residences = await repo.residences.listByBlock(blockId)
  const directory: DirectoryEntry[] = []
  for (const residence of residences) {
    const approvedResidents = (await repo.residents.listByResidence(residence.id)).filter(
      (r) => r.status === 'approved'
    )
    const residents = await Promise.all(
      approvedResidents.map(async (resident) => ({
        resident,
        contacts: (await repo.contactMethods.listByResident(resident.id)).filter(
          (c) => c.visibility === 'block_wide'
        ),
      }))
    )
    directory.push({ residence, residents })
  }
  return directory
}
