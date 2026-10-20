import { COPY } from './copy'
import { MarkdownView } from './markdown-view'
import { Mark } from './marks'

export function Reader(props: { title: string; markdown: string; crumbs: readonly string[]; fullPath?: string }) {
  const empty = !props.markdown.trim()
  const label = props.title || COPY.readerEmpty
  const crumbs = props.crumbs.length > 0 ? props.crumbs : [label]
  const leaf = crumbs[crumbs.length - 1] || label
  const fullPath = props.fullPath?.trim() ?? ''
  return (
    <aside className="atelier-pane atelier-reader" data-atelier-pane="right">
      <div className="atelier-reader__tabbar">
        <span className="atelier-reader__tab">
          <Mark name="file" />
          <span>{leaf}</span>
        </span>
      </div>
      <div className="atelier-reader__toolbar">
        <div className="atelier-reader__path" title={fullPath || crumbs.join('/')}>
          <Mark name={fullPath ? 'folder' : 'file'} />
          {crumbs.map((crumb, index) => (
            <span className="atelier-reader__crumb" key={`${index}:${crumb}`}>
              {index > 0 ? <Mark name="chevron" /> : null}
              <span>{crumb}</span>
            </span>
          ))}
        </div>
        <button className="atelier-reader__source" disabled title={COPY.readerSourceHint} type="button">
          <Mark name="code" />
          <span>{COPY.source}</span>
        </button>
        <button
          className="atelier-reader__copy"
          disabled={!fullPath}
          onClick={() => {
            if (fullPath) {
              void navigator.clipboard?.writeText(fullPath)
            }
          }}
          type="button"
        >
          <Mark name="copy" />
          <span>{COPY.copyPath}</span>
        </button>
      </div>
      <div className="atelier-reader__scroll">
        {empty ? (
          <p className="atelier-empty atelier-empty--reader">
            <Mark name="file" />
            <span>{COPY.noLog}</span>
          </p>
        ) : (
          <MarkdownView markdown={props.markdown} />
        )}
      </div>
    </aside>
  )
}
