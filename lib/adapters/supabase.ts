import type { SupabaseClient } from '@supabase/supabase-js'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { generateBlockCode } from '../blockCode'
import type {
  BlockRepository,
  ResidenceRepository,
  ResidentRepository,
  ContactMethodRepository,
  StewardRepository,
  ConfirmationLogRepository,
  ItemRepository,
  BlockRosterRepository,
} from '../repository'
import type {
  Block,
  Residence,
  ResidenceStatus,
  Resident,
  ResidentInput,
  ContactMethod,
  ContactMethodInput,
  Steward,
  StewardStatus,
  ConfirmationLogEntry,
  Item,
  ItemCategory,
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
  code: string
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
  status: ResidenceStatus
  last_confirmed_at: string | null
  sort_order: number | null
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

type ConfirmationLogRow = {
  id: string
  residence_id: string
  resident_id: string | null
  confirmed_by: string | null
  confirmed_at: string
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
    code: row.code,
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
    status: row.status,
    lastConfirmedAt: row.last_confirmed_at,
    sortOrder: row.sort_order,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function toConfirmationLogEntry(row: ConfirmationLogRow): ConfirmationLogEntry {
  return {
    id: row.id,
    residenceId: row.residence_id,
    residentId: row.resident_id,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
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
          sort_order: input.sortOrder ?? null,
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
    async listByBlock(blockId) {
      const { data, error } = await client
        .from('residences')
        .select()
        .eq('block_id', blockId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('label', { ascending: true })
      if (error) throw new Error(`[supabase adapter] residences.listByBlock: ${error.message}`)
      return (data as ResidenceRow[]).map(toResidence)
    },
    async update(id, input) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.label !== undefined) patch.label = input.label
      if (input.nickname !== undefined) patch.nickname = input.nickname
      if (input.shape !== undefined) patch.shape = input.shape
      if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
      const { data, error } = await client.from('residences').update(patch).eq('id', id).select().single()
      return toResidence(requireNoError(data as ResidenceRow | null, error, 'residences.update'))
    },
    async setStatus(id, status) {
      const { data, error } = await client
        .from('residences')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toResidence(requireNoError(data as ResidenceRow | null, error, 'residences.setStatus'))
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
        .insert({ residence_id: input.residenceId, name: input.name })
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.create'))
    },
    async getById(id) {
      const { data, error } = await client.from('residents').select().eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase adapter] residents.getById: ${error.message}`)
      return data ? toResident(data as ResidentRow) : null
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
    async setBlurb(id, blurb) {
      const { data, error } = await client
        .from('residents')
        .update({ blurb, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      return toResident(requireNoError(data as ResidentRow | null, error, 'residents.setBlurb'))
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

function createConfirmationLogRepository(client: SupabaseClient): ConfirmationLogRepository {
  return {
    async record(residenceId, residentId, confirmedBy) {
      const { data, error } = await client
        .from('confirmation_log')
        .insert({ residence_id: residenceId, resident_id: residentId, confirmed_by: confirmedBy })
        .select()
        .single()
      return toConfirmationLogEntry(
        requireNoError(data as ConfirmationLogRow | null, error, 'confirmationLog.record')
      )
    },
    async listByResidence(residenceId) {
      const { data, error } = await client
        .from('confirmation_log')
        .select()
        .eq('residence_id', residenceId)
        .order('confirmed_at', { ascending: false })
      if (error) throw new Error(`[supabase adapter] confirmationLog.listByResidence: ${error.message}`)
      return (data as ConfirmationLogRow[]).map(toConfirmationLogEntry)
    },
  }
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
      // items has no block_id of its own (deliberately — it belongs to a resident, not an
      // address), so this goes through residents -> residences via Supabase's embedded-resource
      // filtering rather than a raw join, matching the read pattern PostgREST supports natively.
      const { data: residentRows, error: residentsError } = await client
        .from('residents')
        .select('id, residences!inner(block_id)')
        .eq('residences.block_id', blockId)
      if (residentsError) throw new Error(`[supabase adapter] items.listByBlock: ${residentsError.message}`)
      const residentIds = (residentRows as { id: string }[]).map((r) => r.id)
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

export function createSupabaseRepository(client: SupabaseClient): BlockRosterRepository {
  return {
    blocks: createBlockRepository(client),
    residences: createResidenceRepository(client),
    residents: createResidentRepository(client),
    contactMethods: createContactMethodRepository(client),
    stewards: createStewardRepository(client),
    confirmationLog: createConfirmationLogRepository(client),
    items: createItemRepository(client),
  }
}
