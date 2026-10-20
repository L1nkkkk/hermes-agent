import { describe, expect, it } from 'vitest'

import { ATELIER_WINDOW_ATTR, bindAtelierWindow, type AtelierChromeHost } from './window-chrome'

function host(open: boolean): AtelierChromeHost & { calls: boolean[]; root: HTMLElement } {
  const root = document.createElement('html')
  const calls: boolean[] = []

  return {
    calls,
    root,
    documentElement: root,
    sidebarOpen: () => open,
    setSidebarOpen: next => {
      calls.push(next)
    }
  }
}

describe('atelier window chrome', () => {
  it('closes an open host sidebar and restores it on release', () => {
    const chrome = host(true)
    const release = bindAtelierWindow(chrome)

    expect(chrome.root.getAttribute(ATELIER_WINDOW_ATTR)).toBe('true')
    expect(chrome.calls).toEqual([false])

    release()

    expect(chrome.root.hasAttribute(ATELIER_WINDOW_ATTR)).toBe(false)
    expect(chrome.calls).toEqual([false, true])
  })

  it('leaves a sidebar the user already closed alone', () => {
    const chrome = host(false)
    const release = bindAtelierWindow(chrome)

    expect(chrome.calls).toEqual([])

    release()

    expect(chrome.calls).toEqual([])
    expect(chrome.root.hasAttribute(ATELIER_WINDOW_ATTR)).toBe(false)
  })

  it('restores the sidebar once when the page hides, and ignores a second release', () => {
    let hide: (() => void) | undefined
    const chrome = host(true)
    chrome.subscribePageHide = release => {
      hide = release
      return () => {
        hide = undefined
      }
    }

    const release = bindAtelierWindow(chrome)

    expect(chrome.calls).toEqual([false])

    hide?.()

    expect(chrome.calls).toEqual([false, true])
    expect(chrome.root.hasAttribute(ATELIER_WINDOW_ATTR)).toBe(false)
    expect(hide).toBeUndefined()

    release()

    expect(chrome.calls).toEqual([false, true])
  })
})
