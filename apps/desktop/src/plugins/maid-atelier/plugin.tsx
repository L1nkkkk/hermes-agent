import './atelier.css'

import { host, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA, useValue } from '@hermes/plugin-sdk'
import type {
  HermesPlugin,
  PaletteContribution,
  PluginContext,
  RouteContribution,
  SidebarNavContribution
} from '@hermes/plugin-sdk'
import { useEffect, useMemo } from 'react'

import { $sidebarOpen, setSidebarOpen } from '@/store/layout'

import { COPY } from './copy'
import { hostGateway } from './gateway'
import { bindAtelierWindow } from './window-chrome'
import { AtelierWorkbench } from './workbench'

const PATH = '/atelier'

function AtelierPage(props: { storage: PluginContext['storage'] }) {
  const gatewayState = useValue(host.state.gateway)
  const gateway = useMemo(() => hostGateway(), [])

  useEffect(
    () =>
      bindAtelierWindow({
        documentElement: document.documentElement,
        setSidebarOpen,
        sidebarOpen: () => $sidebarOpen.get(),
        subscribePageHide: release => {
          window.addEventListener('pagehide', release)
          return () => window.removeEventListener('pagehide', release)
        }
      }),
    []
  )

  return (
    <AtelierWorkbench
      gateway={gateway}
      gatewayOpen={gatewayState === 'open'}
      notify={(message, kind) => host.notify({ kind, message })}
      storage={props.storage}
    />
  )
}

const plugin: HermesPlugin = {
  id: 'maid-atelier',
  name: 'Maid Atelier',
  description: 'Three-column Maid Atelier workbench: sessions, desk with goal and work queue, and a Markdown reader.',
  defaultEnabled: true,
  register(ctx) {
    const page = () => <AtelierPage storage={ctx.storage} />

    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: PATH } satisfies RouteContribution,
        render: page
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 15,
        data: { codicon: 'organization', label: COPY.nav, path: PATH } satisfies SidebarNavContribution
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'maid-atelier.open',
          keywords: ['maid', 'atelier', 'workbench', 'goal'],
          label: COPY.open,
          run: () => host.navigate(PATH)
        } satisfies PaletteContribution
      }
    ])
  }
}

export default plugin
