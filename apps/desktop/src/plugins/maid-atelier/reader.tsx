import { useEffect, useState } from 'react'

import { COPY } from './copy'
import { MarkdownView } from './markdown-view'
import { Emoji, Mark } from './marks'
import {
  crumbTrail,
  listWorkspace,
  readWorkspaceText,
  type WorkspaceEntry,
  type WorkspaceScope,
  type WorkspaceText,
  workspaceWritable,
  writeWorkspaceText
} from './workspace-fs'

const MARKDOWN = /\.(?:md|markdown)$/iu

export function Reader(props: { root: string | null; scope: WorkspaceScope }) {
  const root = props.root?.trim() || null
  const connectionId = props.scope.connectionId
  const profile = props.scope.profile
  const scope = { connectionId, profile }
  const writable = workspaceWritable(scope)
  const [directory, setDirectory] = useState<string | null>(root)
  const [entries, setEntries] = useState<WorkspaceEntry[]>([])
  const [listError, setListError] = useState('')
  const [file, setFile] = useState<WorkspaceText | null>(null)
  const [fileError, setFileError] = useState('')
  const [mode, setMode] = useState<'preview' | 'source'>('preview')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setDirectory(root)
    setFile(null)
    setFileError('')
    setEditing(false)
    setMode('preview')
    setFilter('')
  }, [root])

  useEffect(() => {
    if (!directory) {
      setEntries([])
      setListError('')

      return
    }

    let live = true
    const listed = { connectionId, profile }

    listWorkspace(directory, listed)
      .then(rows => {
        if (live) {
          setEntries(rows)
          setListError('')
        }
      })
      .catch(error => {
        if (live) {
          setEntries([])
          setListError(error instanceof Error && error.message ? error.message : COPY.filesUnavailable)
        }
      })

    return () => {
      live = false
    }
  }, [directory, connectionId, profile])

  const openDirectory = (path: string) => {
    setDirectory(path)
    setFile(null)
    setFileError('')
    setEditing(false)
  }

  const openFile = (path: string) => {
    setFileError('')
    readWorkspaceText(path, props.scope)
      .then(next => {
        setFile(next)
        setDraft(next.text)
        setEditing(false)
        setMode(MARKDOWN.test(next.path) ? 'preview' : 'source')
      })
      .catch(error => {
        setFile(null)
        setFileError(error instanceof Error && error.message ? error.message : COPY.filesUnavailable)
      })
  }

  const save = () => {
    if (!file) {
      return
    }

    writeWorkspaceText(file.path, draft, props.scope)
      .then(() => {
        setFile({ ...file, text: draft, truncated: false })
        setEditing(false)
        setFileError('')
      })
      .catch(error => {
        setFileError(error instanceof Error && error.message ? error.message : COPY.saveFailed)
      })
  }

  const shown = entries.filter(entry => entry.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const currentPath = file?.path || directory || ''
  const crumbs = crumbTrail(currentPath)
  const leaf = file ? fileName(file.path) : crumbs.at(-1)?.label || COPY.readerEmpty
  const markdown = file ? MARKDOWN.test(file.path) : false
  const canEdit = Boolean(file && writable && !file.binary && !file.truncated)

  return (
    <aside className="atelier-pane atelier-reader" data-atelier-pane="right">
      <div className="atelier-reader__tabbar">
        <span className="atelier-reader__tab">
          <Mark name={file ? 'file' : 'folder'} />
          <Emoji symbol={file && markdown ? '📝' : file ? '📄' : '📁'} />
          <span>{leaf}</span>
        </span>
        {directory && !writable ? <span className="atelier-reader__badge">{COPY.readOnly}</span> : null}
      </div>
      <div className="atelier-reader__toolbar">
        <div aria-label={COPY.workspacePath} className="atelier-reader__path" role="navigation" title={currentPath}>
          <Mark name={currentPath ? 'folder' : 'file'} />
          {crumbs.map((crumb, index) => (
            <span className="atelier-reader__crumb" key={crumb.path}>
              {index > 0 ? <Mark name="chevron" /> : null}
              <button onClick={() => openDirectory(crumb.path)} type="button">
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
        <button
          aria-pressed={mode === 'source'}
          className="atelier-reader__source"
          disabled={!file || file.binary}
          onClick={() => setMode(current => (current === 'source' ? 'preview' : 'source'))}
          type="button"
        >
          <Mark name="code" />
          <span>{COPY.source}</span>
        </button>
        {editing ? (
          <button className="atelier-reader__source" onClick={save} type="button">
            <Mark name="check" />
            <span>{COPY.save}</span>
          </button>
        ) : (
          <button className="atelier-reader__source" disabled={!canEdit} onClick={() => setEditing(true)} type="button">
            <Mark name="draft" />
            <span>{COPY.edit}</span>
          </button>
        )}
        <button
          className="atelier-reader__copy"
          disabled={!currentPath}
          onClick={() => {
            if (currentPath) {
              void navigator.clipboard?.writeText(currentPath)
            }
          }}
          type="button"
        >
          <Mark name="copy" />
          <span>{COPY.copyPath}</span>
        </button>
      </div>
      {root ? (
        <div className="atelier-reader__stage">
          <div aria-label={COPY.workspaceFiles} className="atelier-reader__files" role="navigation">
            <input
              aria-label={COPY.fileFilter}
              onChange={event => setFilter(event.target.value)}
              placeholder={COPY.fileFilter}
              type="search"
              value={filter}
            />
            {listError ? <p className="atelier-empty">{listError}</p> : null}
            {shown.map(entry => (
              <button
                className="atelier-reader__file"
                data-selected={file?.path === entry.path ? 'true' : 'false'}
                key={entry.path}
                onClick={() => (entry.isDirectory ? openDirectory(entry.path) : openFile(entry.path))}
                type="button"
              >
                <Mark name={entry.isDirectory ? 'folder' : 'file'} />
                <span>{entry.name}</span>
              </button>
            ))}
            {!listError && shown.length === 0 ? <p className="atelier-empty">{COPY.emptyFolder}</p> : null}
          </div>
          <div className="atelier-reader__scroll">
            <Preview
              draft={draft}
              editing={editing}
              error={fileError}
              file={file}
              markdown={markdown}
              mode={mode}
              onDraft={setDraft}
            />
          </div>
        </div>
      ) : (
        <div className="atelier-reader__scroll">
          <p className="atelier-empty atelier-empty--reader">
            <Mark name="folder" />
            <Emoji symbol="📁" />
            <span>{COPY.noWorkspace}</span>
          </p>
        </div>
      )}
    </aside>
  )
}

function Preview(props: {
  file: WorkspaceText | null
  error: string
  editing: boolean
  draft: string
  markdown: boolean
  mode: 'preview' | 'source'
  onDraft: (value: string) => void
}) {
  if (props.error) {
    return <p className="atelier-empty">{props.error}</p>
  }

  if (!props.file) {
    return (
      <p className="atelier-empty atelier-empty--reader">
        <Mark name="file" />
        <span>{COPY.pickFile}</span>
      </p>
    )
  }

  if (props.file.binary) {
    return <p className="atelier-empty">{COPY.binaryFile}</p>
  }

  if (props.editing) {
    return (
      <textarea
        aria-label={COPY.edit}
        className="atelier-reader__editor"
        onChange={event => props.onDraft(event.target.value)}
        value={props.draft}
      />
    )
  }

  return (
    <>
      {props.file.truncated ? <p className="atelier-reader__note">{COPY.truncatedFile}</p> : null}
      {props.markdown && props.mode === 'preview' ? (
        <MarkdownView markdown={props.file.text} />
      ) : (
        <pre className="atelier-reader__source-text">{props.file.text}</pre>
      )}
    </>
  )
}

function fileName(path: string): string {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) || path
}
