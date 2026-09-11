import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getRepository } from '@/lib/db'
import { resolveActiveSteward, resolveApprovedResident, getResidentDirectory } from '@/lib/application'
import { toCsv } from '@/lib/csv'

/**
 * CSV of the roster — "the data is never hostage" (product-brief.md). A steward always gets the
 * full export (every resident, every contact, regardless of status/visibility); an approved
 * resident gets the same peer-safe view as the directory on /<code> (approved residents only,
 * block_wide contacts only), and only if the steward hasn't turned that off
 * (blocks.resident_export_enabled).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const repo = getRepository()
  const block = await repo.blocks.getById(blockId)
  if (!block) return NextResponse.json({ error: 'Community not found' }, { status: 404 })

  const isSteward = (await resolveActiveSteward(blockId, user.id)) !== null
  const isApprovedResident = isSteward ? false : (await resolveApprovedResident(blockId, user.id)) !== null
  if (!isSteward && !(isApprovedResident && block.residentExportEnabled)) {
    return NextResponse.json({ error: 'Not authorized to export this roster' }, { status: 403 })
  }

  const headers = ['Residence', 'Nickname', 'Resident', 'Email', 'Phone']
  const rows: string[][] = []

  // Every residence gets at least one row — a residence with no residents comes out as a blank
  // line rather than being absent, so the export doubles as a template a steward can fill in
  // (e.g. after moving to a spreadsheet).
  const residenceRow = (residence: { label: string; nickname: string | null }) => [
    residence.label,
    residence.nickname ?? '',
  ]

  if (isSteward) {
    const residences = await repo.residences.listByBlock(blockId)
    for (const residence of residences) {
      const residents = await repo.residents.listByResidence(residence.id)
      if (residents.length === 0) {
        rows.push([...residenceRow(residence), '', '', ''])
        continue
      }
      for (const resident of residents) {
        const contacts = await repo.contactMethods.listByResident(resident.id)
        const email = contacts.find((c) => c.type === 'email')
        const phone = contacts.find((c) => c.type === 'phone')
        rows.push([
          ...residenceRow(residence),
          `${resident.name} (${resident.status})`,
          email?.value ?? '',
          phone?.value ?? '',
        ])
      }
    }
  } else {
    const directory = await getResidentDirectory(blockId)
    for (const { residence, residents } of directory) {
      if (residents.length === 0) {
        rows.push([...residenceRow(residence), '', '', ''])
        continue
      }
      for (const { resident, contacts } of residents) {
        const email = contacts.find((c) => c.type === 'email')
        const phone = contacts.find((c) => c.type === 'phone')
        rows.push([...residenceRow(residence), resident.name, email?.value ?? '', phone?.value ?? ''])
      }
    }
  }

  const csv = toCsv(headers, rows)
  // Date in the filename (not just the download's mtime, which most browsers don't surface) so
  // whoever ends up with the file later can tell how fresh it is at a glance.
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${block.code}-roster-${today}.csv"`,
    },
  })
}
