import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { PluginStorage } from '@hermes/plugin-sdk'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type AtelierRpc, createGateway } from './gateway'
import plugin from './plugin'
import { AtelierWorkbench } from './workbench'

const stylesheet = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'atelier.css'), 'utf8')

function storage(): PluginStorage {
  return {
    get(_key, fallback) {
      return fallback
    },
    set() {},
    remove() {}
  }
}

afterEach(() => {
  cleanup()
  globalThis.document.documentElement.removeAttribute('data-atelier-window')
})

describe('atelier composes in the workspace pane', () => {
  it('stays enabled and does not cover host chrome', () => {
    expect(plugin.defaultEnabled).toBe(true)

    const clicks: string[] = []
    globalThis.document.documentElement.setAttribute('data-atelier-window', 'true')

    render(
      <>
        <style>{stylesheet}</style>
        <aside data-sidebar="sidebar">
          <button onClick={() => clicks.push('session')} type="button">
            Host session
          </button>
        </aside>
        <div data-titlebar-cluster="left">
          <button onClick={() => clicks.push('settings')} type="button">
            Host settings
          </button>
        </div>
        <div data-slot="statusbar">
          <button onClick={() => clicks.push('model')} type="button">
            Host model
          </button>
        </div>
        <label>
          Host composer
          <textarea aria-label="Host composer" />
        </label>
        <div data-workspace-pane="" style={{ position: 'relative', width: 960, height: 640 }}>
          <AtelierWorkbench
            gateway={createGateway((async () => ({ profiles: [] })) as AtelierRpc)}
            gatewayOpen
            notify={vi.fn()}
            storage={storage()}
          />
        </div>
      </>
    )

    const atelier = globalThis.document.querySelector('.atelier')
    const sidebar = globalThis.document.querySelector('[data-sidebar="sidebar"]')
    const titlebar = globalThis.document.querySelector('[data-titlebar-cluster="left"]')
    const statusbar = globalThis.document.querySelector('[data-slot="statusbar"]')

    expect(atelier).toBeTruthy()
    expect(getComputedStyle(atelier as Element).position).toBe('absolute')
    expect(getComputedStyle(atelier as Element).zIndex).not.toBe('100')
    expect(getComputedStyle(sidebar as Element).display).not.toBe('none')
    expect(getComputedStyle(titlebar as Element).display).not.toBe('none')
    expect(getComputedStyle(statusbar as Element).display).not.toBe('none')
    expect(getComputedStyle(screen.getByRole('textbox', { name: 'Host composer' })).pointerEvents).not.toBe('none')

    fireEvent.click(screen.getByRole('button', { name: 'Host session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Host settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Host model' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Host composer' }), { target: { value: 'hello' } })

    expect(clicks).toEqual(['session', 'settings', 'model'])
    expect((screen.getByRole('textbox', { name: 'Host composer' }) as HTMLTextAreaElement).value).toBe('hello')
    expect(globalThis.document.querySelector('.atelier button')).toBeTruthy()
  })

  it('paints from the shell surface token instead of a frozen dark pane', async () => {
    render(
      <>
        <style>{stylesheet}</style>
        <div data-workspace-pane="" style={{ position: 'relative', width: 960, height: 640 }}>
          <AtelierWorkbench
            gateway={createGateway((async () => ({ profiles: [] })) as AtelierRpc)}
            gatewayOpen
            notify={vi.fn()}
            storage={storage()}
          />
        </div>
      </>
    )

    await screen.findByText('No workspace')

    const atelier = globalThis.document.querySelector('.atelier') as HTMLElement

    const rule = [...globalThis.document.styleSheets]
      .flatMap(sheet => [...sheet.cssRules])
      .find((entry): entry is CSSStyleRule => entry instanceof CSSStyleRule && entry.selectorText === '.atelier')

    expect(rule).toBeTruthy()
    expect(rule?.style.getPropertyValue('--atelier-bg')).toContain('var(--ui-chat-surface-background')
    expect(rule?.style.getPropertyValue('--atelier-rail')).toContain('var(--ui-sidebar-surface-background')
    expect(rule?.style.getPropertyValue('--atelier-text')).toContain('var(--ui-text-secondary')
    expect(rule?.style.getPropertyValue('background-color') || rule?.style.getPropertyValue('background')).toContain(
      'var(--atelier-bg)'
    )
    expect(rule?.style.getPropertyValue('color-scheme')).toBe('inherit')
    expect(rule?.style.getPropertyValue('background')).not.toContain('#1e1f23')
    expect(atelier.style.background).toBe('')
    expect(atelier.style.getPropertyValue('--atelier-pending')).toContain('var(--status-pending')
    expect(atelier.style.getPropertyValue('--atelier-pending')).not.toBe('#5b8def')
    expect(getComputedStyle(atelier).colorScheme).not.toBe('dark')
  })
})
