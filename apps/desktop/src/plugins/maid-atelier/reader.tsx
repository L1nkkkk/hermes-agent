import { COPY } from './copy'
import { MarkdownView } from './markdown-view'

export function Reader(props: { title: string; markdown: string; crumbs: readonly string[]; fullPath?: string }) {
  const empty = !props.markdown.trim()
  const label = props.title || COPY.readerEmpty
  const crumbs = props.crumbs.length > 0 ? props.crumbs : [label]
  const leaf = crumbs[crumbs.length - 1] || label
  const fullPath = props.fullPath?.trim() ?? ''

  return (
    <aside className="atelier-pane atelier-reader" data-atelier-pane="right">
      <div className="atelier-reader__tabbar">
        <span className="atelier-reader__tab">{leaf}</span>
      </div>
      <div className="atelier-reader__toolbar">
        <div className="atelier-reader__path" title={fullPath || crumbs.join('/')}>
          {crumbs.map((crumb, index) => (
            <span key={`${index}:${crumb}`}>
              {index > 0 ? (
                <span aria-hidden="true" className="atelier-reader__sep">
                  /
                </span>
              ) : null}
              <span>{crumb}</span>
            </span>
          ))}
        </div>
        {fullPath ? (
          <button
            className="atelier-reader__copy"
            onClick={() => {
              void navigator.clipboard?.writeText(fullPath)
            }}
            type="button"
          >
            {COPY.copyPath}
          </button>
        ) : null}
      </div>
      <div className="atelier-reader__scroll">
        {empty ? <p className="atelier-empty">{COPY.noLog}</p> : <MarkdownView markdown={props.markdown} />}
      </div>
    </aside>
  )
}
