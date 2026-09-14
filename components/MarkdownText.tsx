import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

/**
 * Renders steward-authored free text (community blurb, about-this-community) as Markdown —
 * bold, links, lists. remarkBreaks keeps a single newline as a line break, matching the
 * whitespace-pre-wrap behavior this replaced, since stewards typed that text expecting it.
 * External links open in a new tab since they're leaving the community page.
 */
export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`${className ?? ''} [&_a]:underline [&_a]:text-accent [&>*+*]:mt-2`}>
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          // react-markdown passes a `node` (the mdast node) that must not be spread onto the DOM element.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          // Tailwind's preflight strips default list-style/margin from ul/ol — restore it here.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
