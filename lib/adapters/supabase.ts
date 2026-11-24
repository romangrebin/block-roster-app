import type { SupabaseClient } from '@supabase/supabase-js'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { generateBlockCode } from '../blockCode'
import type {
  BlockRepository,
  ResidenceRepository,
  ResidentRepository,
  ContactMethodRepository,
  StewardRepository,
  ItemRepository,
  BorrowRequestRepository,
  CorkboardNoteRepository,
  CorkboardInterestRepository,
  CorkboardPhotoStorage,
  ExpeditionRunRepository,
  BlockRosterRepository,
} from '../repository'
import type {
  Block,
  Residence,
  Resident,
  ResidentInput,
  ResidentProfile,
  SignupPromptKey,
  ContactMethod,
  ContactMethodInput,
  Steward,
  StewardStatus,
  Item,
  ItemCategory,
  BorrowRequest,
  CorkboardNote,
  CorkboardInterest,
  ExpeditionRun,
} from '../types'

/**
 * Supabase implementation of BlockRosterRepository. Mechanical snake_case-row <->
 * camelCase-domain-type mapping plus per-entity CRUD — no cross-table logic here, see
 * lib/application.ts for that.
 */

// Row shapes mirror supabase/migrations/20260806000000_initial_schema.sql.

type BlockRow = {
  id: string
  name: string
  canvas_type: 'geo_map' | 'image' | 'none'
  boundary: unknown | null
  canvas_background: unknown | null
  status: 'draft' | 'live' | 'archived'
  resident_export_enabled: boolean
  lending_library_enabled: boolean
  auto_approve_joins: boolean
  hidden_signup_prompts: SignupPromptKey[]
  borrow_requests_enabled: boolean
  corkboard_enabled: boolean
  code: string
  print_code: string
  public_blurb: string | null
  private_notes: string | null
  created_at: string
}

type ResidenceRow = {
  id: string
  block_id: string
  label: string
  nickname: string | null
  shape: unknown | null
  steward_notes: string | null
  created_at: string
  updated_at: string | null
}

type ResidentRow = {
  id: string
  residence_id: string
  name: string
  status: Resident['status']
  approved_by: string | null
  approved_at: string | null
  blurb: string | null
  moved_in_year: number | null
  favorite_spot: string | null
  count_me_in_for: string | null
  ask_me_about: string | null
  created_at: string
  updated_at: string | null
}

type ContactMethodRow = {
  id: string
  resident_id: string
  type: ContactMethod['type']
  value: string
  verified_at: string | null
  user_id: string | null
  visibility: ContactMethod['visibility']
  created_at: string
  updated_at: string | null
}

type StewardRow = {
  id: string
  block_id: string
  user_id: string
  added_by: string | null
  status: StewardStatus
  last_active_at: string | null
  created_at: string
}

type ItemRow = {
  id: string
  resident_id: string
  name: string
  description: string | null
  category: ItemCategory
  created_at: string
  updated_at: string | null
}

type BorrowRequestRow = {
  item_id: string
  requester_id: string
  requested_at: string
}

type CorkboardNoteRow = {
  id: string
  resident_id: string
  text: string | null
  image_path: string | null
  board_column: number
  position: number
  created_at: string
  updated_at: string | null
}

type CorkboardInterestRow = {
  note_id: string
  resident_id: string
  created_at: string
}

type ExpeditionRunRow = {
  id: string
  resident_id: string
  party: string[]
  items: string[]
  failures: number
  created_at: string
}

// ── Row -> domain mappers ──

function toBlock(row: BlockRow): Block {
  return {
    id: row.id,
    name: row.name,
    canvasType: row.canvas_type,
    boundary: row.boundary as Feature<Polygon | MultiPolygon> | null,
    canvasBackground: row.canvas_background,
    status: row.status,
    residentExportEnabled: row.resident_export_enabled,
    lendingLibraryEnabled: row.lending_library_enabled,
    autoApproveJoins: row.auto_approve_joins,
    hiddenSignupPrompts: row.hidden_signup_prompts,
    borrowRequestsEnabled: row.borrow_requests_enabled,
    corkboardEnabled: row.corkboard_enabled,
    code: row.code,
    printCode: row.print_code,
    publicBlurb: row.public_blurb,
    privateNotes: row.private_notes,
    createdAt: row.created_at,
  }
}

function toResidence(row: ResidenceRow): Residence {
  return {
    id: row.id,
    blockId: row.block_id,
    label: row.label,
    nickname: row.nickname,
    shape: row.shape,
    stewardNotes: row.steward_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toResident(row: ResidentRow): Resident {
  return {
    id: row.id,
    residenceId: row.residence_id,
    name: row.name,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    blurb: row.blurb,
    movedInYear: row.moved_in_year,
    favoriteSpot: row.favorite_spot,
    countMeInFor: row.count_me_in_for,
    askMeAbout: row.ask_me_about,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toProfileRow(profile: ResidentProfile) {
  return {
    moved_in_year: profile.movedInYear,
    favorite_spot: profile.favoriteSpot,
    count_me_in_for: profile.countMeInFor,
    ask_me_about: profile.askMeAbout,
  }
}

function toContactMethod(row: ContactMethodRow): ContactMethod {
  return {
    id: row.id,
    residentId: row.resident_id,
    type: row.type,
    value: row.value,
    verifiedAt: row.verified_at,
    userId: row.user_id,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSteward(row: StewardRow): Steward {
  return {
    id: row.id,
    blockId: row.block_id,
    userId: row.user_id,
    addedBy: row.added_by,
    status: row.status,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
  }
}


function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    residentId: row.resident_id,
    name: row.name,
    description: row.description,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCorkboardNote(row: CorkboardNoteRow): CorkboardNote {
  return {
    id: row.id,
    residentId: row.resident_id,
    text: row.text,
    imagePath: row.image_path,
    boardColumn: row.board_column,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCorkboardInterest(row: CorkboardInterestRow): CorkboardInterest {
  return { noteId: row.note_id, residentId: row.resident_id, createdAt: row.created_at }
}

function toBorrowRequest(row: BorrowRequestRow): BorrowRequest {
  return { itemId: row.item_id, requesterId: row.requester_id, requestedAt: row.requested_at }
}

function toExpeditionRun(row: ExpeditionRunRow): ExpeditionRun {
  return {
    id: row.id,
    residentId: row.resident_id,
    party: row.party,
    items: row.items,
    failures: row.failures,
    createdAt: row.created_at,
  }
}

function requireNoError<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[supabase adapter] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[supabase adapter] ${context}: no row returned`)
  return data
}

// ── Adapter ──

// Postgres unique_violation. The generated code is adjective-animal-number (~200k
// combinations, see lib/blockCode.ts) — a collision is rare, so this retry loop is a
// correctness backstop, not an expected path.
const UNIQUE_VIOLATION = '23505'
const MAX_CODE_ATTEMPTS = 5

function createBlockRepository(client: SupabaseClient): BlockRepository {
  return {
    async create(input) {
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        const { data, error } = await client
          .from('blocks')
          .insert({
            name: input.name,
            canvas_type: input.canvasType ?? 'geo_map',
            boundary: input.boundary ?? null,
            hidden_signup_prompts: input.hiddenSignupPrompts ?? [],
            code: input.code ?? generateBlockCode(),
          })
          .select()
          .single()
        if (!error) return toBlock(data as BlockRow)
        if (error.code !== UNIQUE_VIOLATION || input.code) {
          throw new Error(`[supabase adapter] blocks.create: ${error.message}`)
        }
        // Collision on an auto-generated code — retry with a fresh one.
      }
      throw new Error('[supabase adapter] blocks.create: could not generate a unique code')
    },
    async getById(id) {
      const { data, error } = await client.from('blocks').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] blocks.getById: ${error.message}`)
      return data ? toBlock(data as BlockRow) : null
    },
    async getByCode(code) {
      const { data, error } = await client.from('blocks').select().eq('code', code).maybeSingle()
      if (error) throw new Error(`[supabase adapter] blocks.getByCode: ${error.message}`)
      return data ? toBlock(data as BlockRow) : null
    },
    async getByPrintCode(printCode) {
      const { data, error } = await client.from('blocks').select().eq('print_code', printCode).maybeSingle()
      if (error) throw new Error(`[supabase adapter] blocks.getByPrintCode: ${error.message}`)
      return data ? toBlock(data as BlockRow) : null
    },
    async listByIds(ids) {
      if (ids.length === 0) return []
      const { data, error } = await client.from('blocks').select().in('id', ids)
      if (error) throw new Error(`[supabase adapter] blocks.listByIds: ${error.message}`)
      return (data as BlockRow[]).map(toBlock)
    },
    async listAll() {
      const { data, error } = await client.from('blocks').select().order('created_at', { ascending: false })
      if (error) throw new Error(`[supabase adapter] blocks.listAll: ${error.message}`)
      return (data as BlockRow[]).map(toBlock)
    },
    async update(id, input) {
      const patch: Record<string, unknown> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.canvasType !== undefined) patch.canvas_type = input.canvasType
      if (input.boundary !== undefined) patch.boundary = input.boundary
      if (input.status !== undefined) patch.status = input.status
      if (input.code !== undefined) patch.code = input.code
      if (input.publicBlurb !== undefined) patch.public_blurb = input.publicBlurb
      if (input.privateNotes !== undefined) patch.private_notes = input.privateNotes
      if (input.residentExportEnabled !== undefined) patch.resident_export_enabled = input.residentExportEnabled
      if (input.lendingLibraryEnabled !== undefined) patch.lending_library_enabled = input.lendingLibraryEnabled
      if (input.autoApproveJoins !== undefined) patch.auto_approve_joins = input.autoApproveJoins
      if (input.hiddenSignupPrompts !== undefined) patch.hidden_signup_prompts = input.hiddenSignupPrompts
      if (input.borrowRequestsEnabled !== undefined) patch.borrow_requests_enabled = input.borrowRequestsEnabled
      if (input.corkboardEnabled !== undefined) patch.corkboard_enabled = input.corkboardEnabled
      const { data, error } = await client.from('blocks').update(patch).eq('id', id).select().single()
      if (error) {
        if (error.code === UNIQUE_VIOLATION) throw new Error('That code is already taken.')
        throw new Error(`[supabase adapter] blocks.update: ${error.message}`)
      }
      return toBlock(requireNoError(data as BlockRow | null, error, 'blocks.update'))
    },
    async delete(id) {
      const { error } = await client.from('blocks').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] blocks.delete: ${error.message}`)
    },
  }
}

function createResidenceRepository(client: SupabaseClient): ResidenceRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from('residences')
        .insert({
          block_id: input.blockId,
          label: input.label,
          shape: input.shape ?? null,
        })
        .select()
        .single()
      return toResidence(requireNoError(data as ResidenceRow | null, error, 'residences.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('residences').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] residences.getById: ${error.message}`)
      return data ? toResidence(data as ResidenceRow) : null
    },
    async listByIds(ids) {
      if (ids.length === 0) return []
      const { data, error } = await client.from('residences').select().in('id', ids)
      if (error) throw new Error(`[supabase adapter] residences.listByIds: ${error.message}`)
      return (data as ResidenceRow[]).map(toResidence)
    },
    async listByBlock(blockId) {
      const { data, error } = await client
        .from('residences')
        .select()
        .eq('block_id', blockId)
        .order('label', { ascending: true })
      if (error) throw new Error(`[supabase adapter] residences.listByBlock: ${error.message}`)
      return (data as ResidenceRow[]).map(toResidence)
    },
    async update(id, input) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.label !== undefined) patch.label = input.label
      if (input.nickname !== undefined) patch.nickname = input.nickname
      if (input.shape !== undefined) patch.shape = input.shape
      if (input.stewardNotes !== undefined) patch.steward_notes = input.stewardNotes
      const { data, error } = await client.from('residences').update(patch).eq('id', id).select().single()
      return toResidence(requireNoError(data as ResidenceRow | null, error, 'residences.update'))
    },
    async delete(id) {
      const { error } = await client.from('residences').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] residences.delete: ${error.message}`)
    },
  }
}

function createResidentRepository(client: SupabaseClient): ResidentRepository {
  return {
    async create(input: ResidentInput) {
      const { data, error } = await client
        .from('residents')
        .insert({
          residence_id: input.residenceId,
          name: input.name,
          blurb: input.blurb ?? null,
          ...(input.profile && toProfileRow(input.profile)),
        })
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('residents').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] residents.getById: ${error.message}`)
      return data ? toResident(data as ResidentRow) : null
    },
    async listByIds(ids) {
      if (ids.length === 0) return []
      const { data, error } = await client.from('residents').select().in('id', ids)
      if (error) throw new Error(`[supabase adapter] residents.listByIds: ${error.message}`)
      return (data as ResidentRow[]).map(toResident)
    },
    async listByResidence(residenceId) {
      const { data, error } = await client
        .from('residents')
        .select()
        .eq('residence_id', residenceId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] residents.listByResidence: ${error.message}`)
      return (data as ResidentRow[]).map(toResident)
    },
    // Same embedded-resource-filter pattern as items.listByBlock below — residents has no
    // block_id of its own, so this filters through residences via PostgREST's `!inner` join
    // so the whole block loads in one round-trip rather than one per residence.
    async listByBlock(blockId) {
      const { data, error } = await client
        .from('residents')
        .select('*, residences!inner(block_id)')
        .eq('residences.block_id', blockId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] residents.listByBlock: ${error.message}`)
      return (data as ResidentRow[]).map(toResident)
    },
    async approve(id, stewardId) {
      const { data, error } = await client
        .from('residents')
        .update({
          status: 'approved',
          approved_by: stewardId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.approve'))
    },
    async moveOut(id) {
      const { data, error } = await client
        .from('residents')
        .update({ status: 'moved_out', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.moveOut'))
    },
    async setName(id, name) {
      const { data, error } = await client
        .from('residents')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.setName'))
    },
    async setBlurb(id, blurb) {
      const { data, error } = await client
        .from('residents')
        .update({ blurb, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.setBlurb'))
    },
    async setProfile(id, profile) {
      const { data, error } = await client
        .from('residents')
        .update({ ...toProfileRow(profile), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.setProfile'))
    },
    async delete(id) {
      const { error } = await client.from('residents').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] residents.delete: ${error.message}`)
    },
  }
}

function createContactMethodRepository(client: SupabaseClient): ContactMethodRepository {
  return {
    async create(input: ContactMethodInput) {
      const { data, error } = await client
        .from('contact_methods')
        .insert({
          resident_id: input.residentId,
          type: input.type,
          value: input.value,
          visibility: input.visibility ?? 'block_wide',
        })
        .select()
        .single()
      return toContactMethod(requireNoError(data as ContactMethodRow | null, error, 'contactMethods.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('contact_methods').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] contactMethods.getById: ${error.message}`)
      return data ? toContactMethod(data as ContactMethodRow) : null
    },
    async listByResident(residentId) {
      const { data, error } = await client
        .from('contact_methods')
        .select()
        .eq('resident_id', residentId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] contactMethods.listByResident: ${error.message}`)
      return (data as ContactMethodRow[]).map(toContactMethod)
    },
    async listByResidents(residentIds) {
      if (residentIds.length === 0) return []
      const { data, error } = await client
        .from('contact_methods')
        .select()
        .in('resident_id', residentIds)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] contactMethods.listByResidents: ${error.message}`)
      return (data as ContactMethodRow[]).map(toContactMethod)
    },
    async listByUserId(userId) {
      const { data, error } = await client.from('contact_methods').select().eq('user_id', userId)
      if (error) throw new Error(`[supabase adapter] contactMethods.listByUserId: ${error.message}`)
      return (data as ContactMethodRow[]).map(toContactMethod)
    },
    async markVerified(id, userId) {
      const { data, error } = await client
        .from('contact_methods')
        .update({ verified_at: new Date().toISOString(), user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toContactMethod(requireNoError(data as ContactMethodRow | null, error, 'contactMethods.markVerified'))
    },
    async setVisibility(id, visibility) {
      const { data, error } = await client
        .from('contact_methods')
        .update({ visibility, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toContactMethod(requireNoError(data as ContactMethodRow | null, error, 'contactMethods.setVisibility'))
    },
    async setValue(id, value) {
      const { data, error } = await client
        .from('contact_methods')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toContactMethod(requireNoError(data as ContactMethodRow | null, error, 'contactMethods.setValue'))
    },
    async delete(id) {
      const { error } = await client.from('contact_methods').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] contactMethods.delete: ${error.message}`)
    },
  }
}

function createStewardRepository(client: SupabaseClient): StewardRepository {
  return {
    async createFounding(blockId, userId) {
      const { data, error } = await client
        .from('stewards')
        .insert({ block_id: blockId, user_id: userId, status: 'active' })
        .select()
        .single()
      return toSteward(requireNoError(data as StewardRow | null, error, 'stewards.createFounding'))
    },
    async promote(blockId, userId, addedBy) {
      const { data, error } = await client
        .from('stewards')
        .insert({ block_id: blockId, user_id: userId, added_by: addedBy, status: 'active' })
        .select()
        .single()
      if (error) {
        if (error.code === UNIQUE_VIOLATION) throw new Error('This resident is already a steward of this community.')
        throw new Error(`[supabase adapter] stewards.promote: ${error.message}`)
      }
      return toSteward(requireNoError(data as StewardRow | null, error, 'stewards.promote'))
    },
    async getById(id) {
      const { data, error } = await client.from('stewards').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] stewards.getById: ${error.message}`)
      return data ? toSteward(data as StewardRow) : null
    },
    async listByBlock(blockId) {
      const { data, error } = await client
        .from('stewards')
        .select()
        .eq('block_id', blockId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] stewards.listByBlock: ${error.message}`)
      return (data as StewardRow[]).map(toSteward)
    },
    async listByUserId(userId) {
      const { data, error } = await client
        .from('stewards')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] stewards.listByUserId: ${error.message}`)
      return (data as StewardRow[]).map(toSteward)
    },
    async setStatus(id, status) {
      const { data, error } = await client.from('stewards').update({ status }).eq('id', id).select().single()
      return toSteward(requireNoError(data as StewardRow | null, error, 'stewards.setStatus'))
    },
  }
}

/**
 * Every resident id in a block, whatever their status. Items and corkboard notes have no block_id
 * of their own (they belong to a resident, not an address), so listing a block's rows goes
 * through residents -> residences via Supabase's embedded-resource filtering, the join pattern
 * PostgREST supports natively.
 */
async function listResidentIdsInBlock(client: SupabaseClient, blockId: string, caller: string): Promise<string[]> {
  const { data, error } = await client
    .from('residents')
    .select('id, residences!inner(block_id)')
    .eq('residences.block_id', blockId)
  if (error) throw new Error(`[supabase adapter] ${caller}: ${error.message}`)
  return (data as { id: string }[]).map((r) => r.id)
}

function createItemRepository(client: SupabaseClient): ItemRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from('items')
        .insert({
          resident_id: input.residentId,
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? 'other',
        })
        .select()
        .single()
      return toItem(requireNoError(data as ItemRow | null, error, 'items.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('items').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] items.getById: ${error.message}`)
      return data ? toItem(data as ItemRow) : null
    },
    async listByResident(residentId) {
      const { data, error } = await client
        .from('items')
        .select()
        .eq('resident_id', residentId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(`[supabase adapter] items.listByResident: ${error.message}`)
      return (data as ItemRow[]).map(toItem)
    },
    async listByBlock(blockId) {
      const residentIds = await listResidentIdsInBlock(client, blockId, 'items.listByBlock')
      if (residentIds.length === 0) return []

      const { data, error } = await client
        .from('items')
        .select()
        .in('resident_id', residentIds)
        .order('created_at', { ascending: false })
      if (error) throw new Error(`[supabase adapter] items.listByBlock: ${error.message}`)
      return (data as ItemRow[]).map(toItem)
    },
    async update(id, input) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.name !== undefined) patch.name = input.name
      if (input.description !== undefined) patch.description = input.description
      if (input.category !== undefined) patch.category = input.category
      const { data, error } = await client.from('items').update(patch).eq('id', id).select().single()
      return toItem(requireNoError(data as ItemRow | null, error, 'items.update'))
    },
    async delete(id) {
      const { error } = await client.from('items').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] items.delete: ${error.message}`)
    },
  }
}

function createBorrowRequestRepository(client: SupabaseClient): BorrowRequestRepository {
  return {
    async get(itemId, requesterId) {
      const { data, error } = await client
        .from('borrow_requests')
        .select()
        .eq('item_id', itemId)
        .eq('requester_id', requesterId)
        .maybeSingle()
      if (error) throw new Error(`[supabase adapter] borrowRequests.get: ${error.message}`)
      return data ? toBorrowRequest(data as BorrowRequestRow) : null
    },
    async record(itemId, requesterId) {
      const { data, error } = await client
        .from('borrow_requests')
        .upsert({ item_id: itemId, requester_id: requesterId, requested_at: new Date().toISOString() })
        .select()
        .single()
      return toBorrowRequest(requireNoError(data as BorrowRequestRow | null, error, 'borrowRequests.record'))
    },
    async listByRequester(requesterId) {
      const { data, error } = await client
        .from('borrow_requests')
        .select()
        .eq('requester_id', requesterId)
        .order('requested_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] borrowRequests.listByRequester: ${error.message}`)
      return (data as BorrowRequestRow[]).map(toBorrowRequest)
    },
  }
}

function createCorkboardNoteRepository(client: SupabaseClient): CorkboardNoteRepository {
  return {
    async create(residentId, text, boardColumn) {
      const { data, error } = await client
        .from('corkboard_notes')
        .insert({ resident_id: residentId, text, board_column: boardColumn })
        .select()
        .single()
      return toCorkboardNote(requireNoError(data as CorkboardNoteRow | null, error, 'corkboardNotes.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('corkboard_notes').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] corkboardNotes.getById: ${error.message}`)
      return data ? toCorkboardNote(data as CorkboardNoteRow) : null
    },
    async listByBlock(blockId) {
      const residentIds = await listResidentIdsInBlock(client, blockId, 'corkboardNotes.listByBlock')
      if (residentIds.length === 0) return []
      const { data, error } = await client
        .from('corkboard_notes')
        .select()
        .in('resident_id', residentIds)
        .order('position', { ascending: true })
      if (error) throw new Error(`[supabase adapter] corkboardNotes.listByBlock: ${error.message}`)
      return (data as CorkboardNoteRow[]).map(toCorkboardNote)
    },
    async updateText(id, text) {
      const { data, error } = await client
        .from('corkboard_notes')
        .update({ text, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toCorkboardNote(requireNoError(data as CorkboardNoteRow | null, error, 'corkboardNotes.updateText'))
    },
    async setLayout(columns) {
      // One update per note is fine: a board holds a handful of notes.
      const results = await Promise.all(
        columns.flatMap((noteIds, boardColumn) =>
          noteIds.map((id, position) =>
            client.from('corkboard_notes').update({ board_column: boardColumn, position }).eq('id', id)
          )
        )
      )
      const failed = results.find((result) => result.error)
      if (failed?.error) throw new Error(`[supabase adapter] corkboardNotes.setLayout: ${failed.error.message}`)
    },
    async delete(id) {
      const { error } = await client.from('corkboard_notes').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] corkboardNotes.delete: ${error.message}`)
    },
  }
}

function createCorkboardInterestRepository(client: SupabaseClient): CorkboardInterestRepository {
  return {
    async add(noteId, residentId) {
      const { error } = await client
        .from('corkboard_interests')
        .upsert({ note_id: noteId, resident_id: residentId }, { ignoreDuplicates: true })
      if (error) throw new Error(`[supabase adapter] corkboardInterests.add: ${error.message}`)
    },
    async remove(noteId, residentId) {
      const { error } = await client
        .from('corkboard_interests')
        .delete()
        .eq('note_id', noteId)
        .eq('resident_id', residentId)
      if (error) throw new Error(`[supabase adapter] corkboardInterests.remove: ${error.message}`)
    },
    async listByNotes(noteIds) {
      if (noteIds.length === 0) return []
      const { data, error } = await client
        .from('corkboard_interests')
        .select()
        .in('note_id', noteIds)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`[supabase adapter] corkboardInterests.listByNotes: ${error.message}`)
      return (data as CorkboardInterestRow[]).map(toCorkboardInterest)
    },
  }
}

const CORKBOARD_PHOTOS_BUCKET = 'corkboard-photos'
const PHOTO_URL_LIFETIME_SECONDS = 60 * 60

function createCorkboardPhotoStorage(client: SupabaseClient): CorkboardPhotoStorage {
  return {
    async createViewUrls(paths) {
      if (paths.length === 0) return new Map()
      const { data, error } = await client.storage
        .from(CORKBOARD_PHOTOS_BUCKET)
        .createSignedUrls(paths, PHOTO_URL_LIFETIME_SECONDS)
      if (error) throw new Error(`[supabase adapter] corkboardPhotos.createViewUrls: ${error.message}`)
      return new Map(data.flatMap(({ path, signedUrl }) => (path && signedUrl ? [[path, signedUrl]] : [])))
    },
    async remove(path) {
      const { error } = await client.storage.from(CORKBOARD_PHOTOS_BUCKET).remove([path])
      if (error) throw new Error(`[supabase adapter] corkboardPhotos.remove: ${error.message}`)
    },
  }
}

function createExpeditionRunRepository(client: SupabaseClient): ExpeditionRunRepository {
  return {
    async create(input) {
      const { data, error } = await client
        .from('expedition_runs')
        .insert({ resident_id: input.residentId, party: input.party, items: input.items, failures: input.failures })
        .select()
        .single()
      return toExpeditionRun(requireNoError(data as ExpeditionRunRow | null, error, 'expeditionRuns.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('expedition_runs').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] expeditionRuns.getById: ${error.message}`)
      return data ? toExpeditionRun(data as ExpeditionRunRow) : null
    },
    async listByResidents(residentIds, limit) {
      if (residentIds.length === 0) return []
      const { data, error } = await client
        .from('expedition_runs')
        .select()
        .in('resident_id', residentIds)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw new Error(`[supabase adapter] expeditionRuns.listByResidents: ${error.message}`)
      return (data as ExpeditionRunRow[]).map(toExpeditionRun)
    },
    async delete(id) {
      const { error } = await client.from('expedition_runs').delete().eq('id', id)
      if (error) throw new Error(`[supabase adapter] expeditionRuns.delete: ${error.message}`)
    },
  }
}

export function createSupabaseRepository(client: SupabaseClient): BlockRosterRepository {
  return {
    blocks: createBlockRepository(client),
    residences: createResidenceRepository(client),
    residents: createResidentRepository(client),
    contactMethods: createContactMethodRepository(client),
    stewards: createStewardRepository(client),
    items: createItemRepository(client),
    borrowRequests: createBorrowRequestRepository(client),
    corkboardNotes: createCorkboardNoteRepository(client),
    corkboardInterests: createCorkboardInterestRepository(client),
    corkboardPhotos: createCorkboardPhotoStorage(client),
    expeditionRuns: createExpeditionRunRepository(client),
  }
}
