/**
 * The one page-width decision for the whole app — every page wraps its content in this
 * instead of picking its own max-w. Change the width here, once, instead of in N files.
 */
export default function PageContainer({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`flex-1 w-full px-6 py-10 ${className}`}>{children}</div>
}
