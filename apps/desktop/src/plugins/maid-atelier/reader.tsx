import { COPY } from './copy'
import { MarkdownView } from './markdown-view'

export function Reader(props: { title: string; markdown: string }) {
  const empty = !props.markdown.trim()

  return (
    <aside className="atelier-pane atelier-reader" data-atelier-pane="right">
      <div className="atelier-reader__path">{props.title || COPY.readerEmpty}</div>
      {empty ? <p className="atelier-empty">{COPY.noLog}</p> : <MarkdownView markdown={props.markdown} />}
    </aside>
  )
}
