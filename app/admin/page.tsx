import Link from 'next/link'
import { getUserFromServerComponent } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { getRepository } from '@/lib/db'
import PageContainer from '@/components/PageContainer'
import AdminDeleteBlockButton from '@/components/AdminDeleteBlockButton'

export default async function AdminPage() {
  const user = await getUserFromServerComponent()
  if (!user || !isAdmin(user.email)) {
    return (
      <PageContainer className="flex items-center justify-center">
        <p className="text-muted">Not authorized.</p>
      </PageContainer>
    )
  }

  const repo = getRepository()
  const blocks = await repo.blocks.listAll()
  const rows = await Promise.all(
    blocks.map(async (block) => {
      const [residences, stewards] = await Promise.all([
        repo.residences.listByBlock(block.id),
        repo.stewards.listByBlock(block.id),
      ])
      return { block, residenceCount: residences.length, stewardCount: stewards.length }
    })
  )

  return (
    <PageContainer className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink">Admin</h1>
      {rows.length === 0 ? (
        <p className="text-base text-muted">No communities yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-2xl bg-surface">
          {rows.map(({ block, residenceCount, stewardCount }) => (
            <li key={block.id} className="flex items-center justify-between px-5 py-4 gap-4">
              <div>
                <Link href={`/${block.code}`} className="text-lg font-medium text-ink hover:underline">
                  {block.name}
                </Link>
                <p className="text-sm text-muted">
                  {block.status} · {residenceCount} residence{residenceCount === 1 ? '' : 's'} ·{' '}
                  {stewardCount} steward{stewardCount === 1 ? '' : 's'} · created{' '}
                  {new Date(block.createdAt).toLocaleDateString()}
                </p>
              </div>
              <AdminDeleteBlockButton blockId={block.id} blockName={block.name} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
