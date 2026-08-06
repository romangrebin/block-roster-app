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
} from './types'

/**
 * The canonical data contracts for Block Roster, one interface per entity — schema v3.
 * Mirrors the adapter-swap pattern from geographic-community-webapp/lib/repository.ts (a
 * CommunityRepository implemented by supabase/json-file/mock adapters selected in lib/db.ts)
 * but split per entity here since Block Roster has several related tables instead of one.
 *
 * Interfaces + types only — no adapters (supabase/json-file/mock), no db.ts selector, and no
 * shared application-layer functions (createBlock, registerResident, approveResident,
 * moveResidentOut, confirmResidentPresence — see notes/minimal-schema-proposal.md's
 * "Data access" section) yet. Those functions are what will call these interfaces to enforce
 * cross-table invariants; the interfaces themselves stay single-entity and dumb on purpose.
 */

export interface BlockRepository {
  create(input: BlockInput): Promise<Block>
  getById(id: string): Promise<Block | null>
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
  listByResident(residentId: string): Promise<ContactMethod[]>
  markVerified(id: string, userId: string): Promise<ContactMethod>
  setVisibility(id: string, visibility: ContactMethod['visibility']): Promise<ContactMethod>
  delete(id: string): Promise<void>
}

export interface StewardRepository {
  invite(blockId: string, invitedEmail: string, addedBy: string | null): Promise<Steward>
  acceptInvite(inviteToken: string, userId: string): Promise<Steward>
  getById(id: string): Promise<Steward | null>
  listByBlock(blockId: string): Promise<Steward[]>
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

export type BlockRosterRepository = {
  blocks: BlockRepository
  residences: ResidenceRepository
  residents: ResidentRepository
  contactMethods: ContactMethodRepository
  stewards: StewardRepository
  confirmationLog: ConfirmationLogRepository
}
