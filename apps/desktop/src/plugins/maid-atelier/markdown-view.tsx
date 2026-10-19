type Block = { type: 'h1' | 'h2' | 'p'; text: string } | { type: 'li'; text: string } | { type: 'pre'; text: string }

/** A small reader. Text only — no raw HTML. */
export function MarkdownView(props: { markdown: string }) {
  const blocks = parseMarkdown(props.markdown)

  return (
    <article className="atelier-reader__body">
      {blocks.map((block, index) => {
        if (block.type === 'h1') {
          return (
            <h1 className="atelier-reader__h1" key={index}>
              {block.text}
            </h1>
          )
        }

        if (block.type === 'h2') {
          return <h2 key={index}>{block.text}</h2>
        }

        if (block.type === 'li') {
          return <li key={index}>{block.text}</li>
        }

        if (block.type === 'pre') {
          return <pre key={index}>{block.text}</pre>
        }

        return <p key={index}>{block.text}</p>
      })}
    </article>
  )
}

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let code: string[] | null = null

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code) {
        blocks.push({ type: 'pre', text: code.join('\n') })
        code = null
      } else {
        code = []
      }

      continue
    }

    if (code) {
      code.push(line)

      continue
    }

    const block = plainBlock(line)

    if (block) {
      blocks.push(block)
    }
  }

  if (code) {
    blocks.push({ type: 'pre', text: code.join('\n') })
  }

  return blocks
}

function plainBlock(line: string): Block | null {
  if (line.startsWith('# ')) {
    return { type: 'h1', text: line.slice(2).trim() }
  }

  if (line.startsWith('## ')) {
    return { type: 'h2', text: line.slice(3).trim() }
  }

  if (line.startsWith('- ')) {
    return { type: 'li', text: line.slice(2).trim() }
  }

  const text = line.trim()

  return text ? { type: 'p', text } : null
}
