import { COPY } from './copy'
import { MarkdownView } from './markdown-view'

export function Reader(props: { title: string; markdown: string; crumb?: string }) {
  const empty = !props.markdown.trim()
  const title = props.title || COPY.readerEmpty

  return (
    <aside className="atelier-pane atelier-reader" data-atelier-pane="right">
      <div className="atelier-reader__path">
        {props.crumb ? (
          <>
            <span>{props.crumb}</span>
            <span aria-hidden="true" className="atelier-reader__sep">
              /
            </span>
          </>
        ) : null}
        <span>{title}</span>
      </div>
      <div className="atelier-reader__scroll">
        {empty ? <p className="atelier-empty">{COPY.noLog}</p> : <MarkdownView markdown={props.markdown} />}
      </div>
    </aside>
  )
}
