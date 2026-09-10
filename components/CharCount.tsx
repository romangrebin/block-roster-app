/**
 * A quiet "1,847 / 2,000" hint under a textarea. Stays hidden until you're within ~15% of the
 * cap, then appears; turns red once you're at it (the paired input's `maxLength` means you can't
 * actually go over — this just makes hitting the ceiling visible instead of a silent paste-cut).
 */
export default function CharCount({ value, max }: { value: string; max: number }) {
  const used = value.length
  if (used < max * 0.85) return null
  return (
    <p className={`text-xs mt-1 text-right ${used >= max ? 'text-red-600' : 'text-muted'}`}>
      {used.toLocaleString()} / {max.toLocaleString()}
    </p>
  )
}
