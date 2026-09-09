import type {
  Block,
  BlockInput,
  Residence,
  ResidenceInput,
  ResidenceStatus,
  Resident,
  ResidentInput,
  ContactMethod,
  ContactMethodInput,
  Steward,
  StewardStatus,
  ConfirmationLogEntry,
  Item,
  ItemInput,
} from './types'

/**
 * One repository interface per entity, implemented by lib/adapters/supabase.ts and selected
 * via lib/db.ts. Deliberately dumb single-entity CRUD — cross-table invariants (creating a
 * block's founding steward, deriving residence status, etc.) live in lib/application.ts.
 */

export interface BlockRepository {
  create(input: BlockInput): Promise<Block>
  getById(id: string): Promise<Block | null>
  getByCode(code: string): Promise<Block | null>
  listAll(): Promise<Block[]>
  update(id: string, input: Partial<BlockInput> & { status?: Block['status'] }): Promise<Block>
  delete(id: string): Promise<void>
}

export interface ResidenceRepository {
  create(input: ResidenceInput): Promise<Residence>
  getById(id: string): Promise<Residence | null>
  listByBlock(blockId: string): Promise<Residence[]>
  update(id: string, input: Partial<ResidenceInput>): Promise<Residence>
  setStatus(id: string, status: ResidenceStatus): Promise<Residence>
  delete(id: string): Promise<void>
}

export interface ResidentRepository {
  create(input: ResidentInput): Promise<Resident>
  getById(id: string): Promise<Resident | null>
  listByResidence(residenceId: string): Promise<Resident[]>
  approve(id: string, stewardId: string): Promise<Resident>
  moveOut(id: string): Promise<Resident>
  setBlurb(id: string, blurb: string | null): Promise<Resident>
  delete(id: string): Promise<void>
}

export interface ContactMethodRepository {
  create(input: ContactMethodInput): Promise<ContactMethod>
  getById(id: string): Promise<ContactMethod | null>
  listByResident(residentId: string): Promise<ContactMethod[]>
  // Every contact method a given Supabase Auth user has verified, across every block/residence
  // they've ever registered at — how a returning resident's session gets resolved back to
  // their resident row(s). See resolveApprovedResident in lib/application.ts.
  listByUserId(userId: string): Promise<ContactMethod[]>
  markVerified(id: string, userId: string): Promise<ContactMethod>
  setVisibility(id: string, visibility: ContactMethod['visibility']): Promise<ContactMethod>
  // Editing the *value* — only meant for an unverified phone (never tied to a userId, so nothing
  // else depends on it staying fixed). An email's value is load-bearing for identity (it's what
  // markVerified's userId link is proven against) and deliberately has no edit path here.
  setValue(id: string, value: string): Promise<ContactMethod>
  delete(id: string): Promise<void>
}

export interface StewardRepository {
  // Founding steward: created alongside the block itself, addedBy always null.
  createFounding(blockId: string, userId: string): Promise<Steward>
  // Any other steward: added by an existing active steward promoting an already-registered,
  // approved resident — see promoteResidentToSteward in lib/application.ts. No invite
  // round-trip; the person is already authenticated (they have a userId from registering).
  promote(blockId: string, userId: string, addedBy: string): Promise<Steward>
  getById(id: string): Promise<Steward | null>
  listByBlock(blockId: string): Promise<Steward[]>
  listByUserId(userId: string): Promise<Steward[]>
  setStatus(id: string, status: StewardStatus): Promise<Steward>
}

export interface ConfirmationLogRepository {
  record(
    residenceId: string,
    residentId: string | null,
    confirmedBy: string | null
  ): Promise<ConfirmationLogEntry>
  listByResidence(residenceId: string): Promise<ConfirmationLogEntry[]>
}

export interface ItemRepository {
  create(input: ItemInput): Promise<Item>
  getById(id: string): Promise<Item | null>
  listByResident(residentId: string): Promise<Item[]>
  // Every item belonging to any resident in the block — how the Browse view is populated.
  // Doesn't filter by resident status (approved/pending/moved_out); callers needing the
  // peer-safe view should cross-reference against an already-fetched resident list, same as
  // getResidentDirectory does for contact methods.
  listByBlock(blockId: string): Promise<Item[]>
  update(id: string, input: Partial<Pick<ItemInput, 'name' | 'description' | 'category'>>): Promise<Item>
  delete(id: string): Promise<void>
}

export type BlockRosterRepository = {
  blocks: BlockRepository
  residences: ResidenceRepository
  residents: ResidentRepository
  contactMethods: ContactMethodRepository
  stewards: StewardRepository
  confirmationLog: ConfirmationLogRepository
  items: ItemRepository
}
