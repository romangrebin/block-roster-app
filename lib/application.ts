import { getRepository } from './db'
import { createSupabaseAdminClient } from './supabase-admin'
import { sendEmail } from './email'
import { escapeHtml } from './validation'
import type { Block, BlockInput, ContactMethod, ContactVisibility, Residence, Resident, Steward } from './types'

/**
 * Cross-table invariants that no single repository method can enforce alone (see
 * notes/minimal-schema-proposal.md's "Data access" section).
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
  // Required at registration (not just editable later via My Info) — besides being the
  // "something about you" neighbors see, it's the one piece of free text a steward has to help
  // judge whether a pending registration is a real neighbor before approving them.
  blurb: string,
  contact: { type: ContactMethod['type']; value: string; visibility?: ContactVisibility },
  // Never verified — no phone-OTP path exists yet (needs a paid SMS vendor, deliberately not
  // chosen). Stored purely as steward-visible info alongside the verified contact above.
  unverifiedPhone?: { value: string; visibility?: ContactVisibility }
): Promise<{ resident: Resident; contactMethod: ContactMethod }> {
  const repo = getRepository()
  const residence = await repo.residences.getById(residenceId)
  if (!residence) throw new Error('registerResident: residence not found')

  const resident = await repo.residents.create({ residenceId, name, blurb })
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

/**
 * Emails every active steward of a block when a resident finishes registering — either still
 * waiting on approval, or already auto-approved because the block has that turned on
 * (`autoApproveJoins`; see BlockContentForm) — the point where a steward can actually do
 * something about it (verifying first, rather than notifying on the raw form submission, avoids
 * pinging stewards about registrations abandoned before the confirmation link is ever clicked).
 * Includes the resident's contact info and blurb so a steward can judge them (or just follow up)
 * straight from the email, without having to click through first. Steward emails come from
 * Supabase Auth itself (`stewards` only stores a `userId`) via the admin API, one lookup per
 * steward — fine at the handful-of-stewards-per-community scale this app operates at.
 */
async function notifyStewardsOfRegistration(
  blockId: string,
  resident: Resident,
  residenceLabel: string,
  contactMethod: ContactMethod,
  autoApproved: boolean
) {
  const repo = getRepository()
  const [block, stewards] = await Promise.all([repo.blocks.getById(blockId), repo.stewards.listByBlock(blockId)])
  if (!block) return
  const activeStewardUserIds = stewards.filter((s) => s.status === 'active').map((s) => s.userId)
  if (activeStewardUserIds.length === 0) return

  const admin = createSupabaseAdminClient()
  const emails: string[] = []
  for (const userId of activeStewardUserIds) {
    const { data } = await admin.auth.admin.getUserById(userId)
    if (data.user?.email) emails.push(data.user.email)
  }
  if (emails.length === 0) return

  // Every interpolated value below is user-supplied (resident name/blurb/contact value,
  // residence label) or free-text a steward set (community name) — escape before it goes into
  // an HTML email body.
  const safeName = escapeHtml(resident.name)
  const safeLabel = escapeHtml(residenceLabel)
  const safeBlockName = escapeHtml(block.name)
  const contactLabel = contactMethod.type === 'email' ? 'Email' : 'Phone'
  const safeContactValue = escapeHtml(contactMethod.value)
  const blurbLine = resident.blurb ? `<p>${escapeHtml(resident.blurb)}</p>` : ''
  const siteUrl = process.env.SITE_URL
  const reviewLink = siteUrl
    ? `<p><a href="${siteUrl}/${encodeURIComponent(block.code)}">Open ${safeBlockName}</a></p>`
    : ''

  const intro = autoApproved
    ? `<p><strong>${safeName}</strong> just joined <strong>${safeLabel}</strong> — auto-approved, since that's turned on for ${safeBlockName}.</p>`
    : `<p><strong>${safeName}</strong> just registered at <strong>${safeLabel}</strong> and is waiting for a steward to approve them.</p>`

  await sendEmail({
    to: emails,
    subject: autoApproved ? `${resident.name} just joined ${block.name}` : `${resident.name} wants to join ${block.name}`,
    html: `${intro}<p>${contactLabel}: ${safeContactValue}</p>${blurbLine}${reviewLink}`,
  })
}

/**
 * Verifies a contact method, then decides how to handle the now-pending registration:
 * auto-approves if either the verifying session belongs to an active steward of that residence's
 * block (they're already the trusted party who'd normally be the one clicking Approve — attributed
 * to them, `approvedBy` set) or the block has `autoApproveJoins` turned on (nobody actually
 * approved it — `approvedBy` left null). Stewards get an email either way (approval-needed or
 * already-auto-approved), except when they approved themselves just now, since they already know.
 * Shared by app/[code]/complete (a fresh magic-link click) and the register route's fast path
 * (the visitor was already signed in under this exact email, so there's nothing left for a
 * magic link to prove). Guarded by `alreadyVerified` so reloading the confirmation page (or
 * clicking an already-used magic link again) can't re-send the steward notification.
 */
export async function verifyAndMaybeAutoApprove(
  contactMethodId: string,
  userId: string,
  verifiedValue: string
): Promise<{ contactMethod: ContactMethod; autoApproved: boolean }> {
  const repo = getRepository()
  const alreadyVerified = !!(await repo.contactMethods.getById(contactMethodId))?.verifiedAt

  const contactMethod = await verifyContactMethod(contactMethodId, userId, verifiedValue)
  let autoApproved = false
  if (!alreadyVerified) {
    const resident = await repo.residents.getById(contactMethod.residentId)
    if (resident && resident.status === 'pending') {
      const residence = await repo.residences.getById(resident.residenceId)
      if (residence) {
        const residenceLabel = residence.nickname || residence.label
        const verifyingSteward = await resolveActiveSteward(residence.blockId, userId)
        if (verifyingSteward) {
          await approveResident(resident.id, verifyingSteward.id)
          autoApproved = true
        } else {
          const block = await repo.blocks.getById(residence.blockId)
          if (block?.autoApproveJoins) {
            await approveResident(resident.id, null)
            autoApproved = true
          }
          await notifyStewardsOfRegistration(residence.blockId, resident, residenceLabel, contactMethod, autoApproved)
        }
      }
    }
  }
  return { contactMethod, autoApproved }
}

/**
 * Emails a resident once a steward approves them — the point where they actually gain access to
 * the roster. Sent to their own verified email contact method (not looked up via Supabase Auth,
 * unlike the steward notification above), since that's the address they registered with and
 * expect to hear from. Silently skipped if they registered with phone only.
 */
async function notifyResidentOfApproval(resident: Resident) {
  const repo = getRepository()
  const residence = await repo.residences.getById(resident.residenceId)
  if (!residence) return
  const [block, contacts] = await Promise.all([
    repo.blocks.getById(residence.blockId),
    repo.contactMethods.listByResident(resident.id),
  ])
  if (!block) return
  const email = contacts.find((c) => c.type === 'email' && c.verifiedAt)
  if (!email) return

  const safeName = escapeHtml(resident.name)
  const safeBlockName = escapeHtml(block.name)
  const siteUrl = process.env.SITE_URL
  const openLink = siteUrl
    ? `<p><a href="${siteUrl}/${encodeURIComponent(block.code)}">Open ${safeBlockName}</a></p>`
    : ''
  await sendEmail({
    to: [email.value],
    subject: `You're approved for ${block.name}`,
    html: `<p>Hi ${safeName},</p><p>You're approved for <strong>${safeBlockName}</strong> — you can now see your neighbors, read what your steward's posted, and everything else there.</p>${openLink}`,
  })
}

// stewardId is null for auto-approval (blocks.autoApproveJoins) — nobody actually approved it.
export async function approveResident(residentId: string, stewardId: string | null): Promise<Resident> {
  const repo = getRepository()
  const resident = await repo.residents.approve(residentId, stewardId)
  await notifyResidentOfApproval(resident)
  return resident
}

/**
 * approved → moved_out. Resets this resident's block_wide contacts to steward_only — moving out
 * re-locks visibility rather than leaving stale contact info exposed community-wide.
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

export type DemoteStewardResult = { error: string; status: number } | { steward: Steward }

/**
 * Deactivates an active steward back to a regular resident (status -> 'inactive', row kept for
 * history — same non-destructive pattern as moveResidentOut). Refuses to demote a block's last
 * active steward: every community has to keep at least one, or nobody could manage it afterward.
 */
export async function demoteSteward(stewardId: string, callerUserId: string): Promise<DemoteStewardResult> {
  const repo = getRepository()
  const target = await repo.stewards.getById(stewardId)
  if (!target) return { error: 'Steward not found', status: 404 }

  const caller = await resolveActiveSteward(target.blockId, callerUserId)
  if (!caller) return { error: 'Not a steward of this community', status: 403 }

  if (target.status !== 'active') return { steward: target }

  const blockStewards = await repo.stewards.listByBlock(target.blockId)
  const activeCount = blockStewards.filter((s) => s.status === 'active').length
  if (activeCount <= 1) {
    return { error: 'A community needs at least one steward — promote someone else first.', status: 400 }
  }

  return { steward: await repo.stewards.setStatus(stewardId, 'inactive') }
}

/** Resolves a user to their active steward row for a block, or null if they aren't one. */
export async function resolveActiveSteward(blockId: string, userId: string): Promise<Steward | null> {
  const repo = getRepository()
  const stewards = await repo.stewards.listByBlock(blockId)
  return stewards.find((s) => s.userId === userId && s.status === 'active') ?? null
}

export type StewardForResidentResult =
  | { error: string; status: number }
  | { resident: Resident; residence: Residence; steward: Steward }

/**
 * Loads a resident and confirms the caller is an active steward of that resident's community —
 * the auth chain shared by every steward-only action on a resident (approve, move out, promote,
 * remove). Returns a ready-to-respond `{ error, status }` on the first failure, or the resolved
 * rows on success.
 */
export async function resolveStewardForResident(residentId: string, userId: string): Promise<StewardForResidentResult> {
  const repo = getRepository()
  const resident = await repo.residents.getById(residentId)
  if (!resident) return { error: 'Resident not found', status: 404 }

  const residence = await repo.residences.getById(resident.residenceId)
  if (!residence) return { error: 'Residence not found', status: 404 }

  const steward = await resolveActiveSteward(residence.blockId, userId)
  if (!steward) return { error: 'Not a steward of this community', status: 403 }

  return { resident, residence, steward }
}

export type OwnResidentAuthResult = { error: string; status: number } | { contacts: ContactMethod[] }

/**
 * Confirms the caller owns a resident record — i.e. one of the resident's contact methods was
 * verified under their own user id — the auth check shared by every self-service edit a resident
 * makes to their own record (name, blurb, phone).
 */
export async function authorizeOwnResident(residentId: string, userId: string): Promise<OwnResidentAuthResult> {
  const repo = getRepository()
  const resident = await repo.residents.getById(residentId)
  if (!resident) return { error: 'Resident not found', status: 404 }

  const contacts = await repo.contactMethods.listByResident(residentId)
  const owns = contacts.some((c) => c.userId === userId)
  if (!owns) return { error: 'Not authorized', status: 403 }

  return { contacts }
}

/**
 * Every approved resident row a signed-in user's verified contact methods resolve to, paired
 * with its residence — the shared traversal behind resolveApprovedResident and
 * listApprovedResidentBlocks. Three batched queries (contact methods -> residents -> residences)
 * regardless of how many blocks the user has ever registered at, instead of a getById chain per
 * contact method.
 */
async function resolveApprovedResidencesForUser(
  userId: string
): Promise<{ resident: Resident; residence: Residence }[]> {
  const repo = getRepository()
  const contactMethods = await repo.contactMethods.listByUserId(userId)
  const residentIds = [...new Set(contactMethods.map((c) => c.residentId))]
  if (residentIds.length === 0) return []

  const residents = (await repo.residents.listByIds(residentIds)).filter((r) => r.status === 'approved')
  if (residents.length === 0) return []

  const residenceIds = [...new Set(residents.map((r) => r.residenceId))]
  const residenceById = new Map((await repo.residences.listByIds(residenceIds)).map((r) => [r.id, r]))

  return residents.flatMap((resident) => {
    const residence = residenceById.get(resident.residenceId)
    return residence ? [{ resident, residence }] : []
  })
}

/**
 * Resolves a signed-in user to their approved resident row for a block, or null if they aren't
 * one. A user can hold several verified contact methods (one per block they've ever registered
 * at) — this checks all of them for one that lands in this block and is approved.
 */
export async function resolveApprovedResident(blockId: string, userId: string): Promise<Resident | null> {
  const entries = await resolveApprovedResidencesForUser(userId)
  return entries.find((e) => e.residence.blockId === blockId)?.resident ?? null
}

export type MemberBlock = { block: Block; resident: Resident }

/**
 * Every block a signed-in user is an approved resident of — the resident-side counterpart to
 * stewards.listByUserId, used by the home page's "Your blocks" list. Dedupes by block: a user
 * with more than one verified contact method landing in the same block only appears once.
 */
export async function listApprovedResidentBlocks(userId: string): Promise<MemberBlock[]> {
  const entries = await resolveApprovedResidencesForUser(userId)
  const blockIds = [...new Set(entries.map((e) => e.residence.blockId))]
  if (blockIds.length === 0) return []

  const blockById = new Map((await getRepository().blocks.listByIds(blockIds)).map((b) => [b.id, b]))
  const seenBlockIds = new Set<string>()
  const results: MemberBlock[] = []
  for (const { resident, residence } of entries) {
    if (seenBlockIds.has(residence.blockId)) continue
    const block = blockById.get(residence.blockId)
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
  const [residences, allResidents] = await Promise.all([
    repo.residences.listByBlock(blockId),
    repo.residents.listByBlock(blockId),
  ])
  const approvedResidents = allResidents.filter((r) => r.status === 'approved')
  const contacts = await repo.contactMethods.listByResidents(approvedResidents.map((r) => r.id))

  const blockWideContactsByResident = new Map<string, ContactMethod[]>()
  for (const contact of contacts) {
    if (contact.visibility !== 'block_wide') continue
    const list = blockWideContactsByResident.get(contact.residentId) ?? []
    list.push(contact)
    blockWideContactsByResident.set(contact.residentId, list)
  }

  const residentsByResidence = new Map<string, DirectoryEntry['residents']>()
  for (const resident of approvedResidents) {
    const list = residentsByResidence.get(resident.residenceId) ?? []
    list.push({ resident, contacts: blockWideContactsByResident.get(resident.id) ?? [] })
    residentsByResidence.set(resident.residenceId, list)
  }

  return residences.map((residence) => ({ residence, residents: residentsByResidence.get(residence.id) ?? [] }))
}
