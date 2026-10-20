/** Host chrome Atelier claims while its route is mounted. */

export const ATELIER_WINDOW_ATTR = 'data-atelier-window'

export interface AtelierChromeHost {
  documentElement: {
    setAttribute(name: string, value: string): void
    removeAttribute(name: string): void
  }
  sidebarOpen: () => boolean
  setSidebarOpen: (open: boolean) => void
  /** Fires on reload and quit, before the persisted pane record is abandoned. */
  subscribePageHide?: (release: () => void) => () => void
}

/**
 * Mark the document so shell CSS can drop the light host sidebar, statusbar,
 * and titlebar clusters, and close the sidebar pane when it was open.
 * Release restores only a sidebar this claim closed. Page-hide runs the same
 * release so a reload does not persist the collapse onto the rest of Desktop.
 */
export function bindAtelierWindow(host: AtelierChromeHost): () => void {
  host.documentElement.setAttribute(ATELIER_WINDOW_ATTR, 'true')
  const restoreSidebar = host.sidebarOpen()

  if (restoreSidebar) {
    host.setSidebarOpen(false)
  }

  let released = false
  let unsubscribe = () => {}
  const release = () => {
    if (released) {
      return
    }

    released = true
    unsubscribe()
    host.documentElement.removeAttribute(ATELIER_WINDOW_ATTR)

    if (restoreSidebar) {
      host.setSidebarOpen(true)
    }
  }

  unsubscribe = host.subscribePageHide?.(release) ?? (() => {})

  return release
}
