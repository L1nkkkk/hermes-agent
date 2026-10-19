import type { MentionRoute } from './model'

export type MentionOutcome = 'child' | 'created' | 'main'

export interface MentionDispatch {
  submit: (agentId: string, sessionId: string, text: string) => Promise<void>
  createChild: (agentId: string, title: string) => Promise<string>
  mainSession: (agentId: string) => Promise<null | string>
}

/**
 * Child send, else create a session on that profile, else that profile's main
 * session. The room session is not a target: Hermes has no cross-profile
 * parent session, so the reply cannot land in this transcript.
 */
export async function dispatchMaidMentionTurn(input: {
  route: MentionRoute
  message: string
  roomTitle: string
  dispatch: MentionDispatch
}): Promise<MentionOutcome> {
  if (input.route.childKey) {
    await input.dispatch.submit(input.route.agent.id, input.route.childKey, input.message)

    return 'child'
  }

  let created: string

  try {
    created = await input.dispatch.createChild(input.route.agent.id, input.roomTitle)
  } catch {
    return submitMain(input.route.agent.id, input.message, input.dispatch)
  }

  await input.dispatch.submit(input.route.agent.id, created, input.message)

  return 'created'
}

async function submitMain(agentId: string, message: string, dispatch: MentionDispatch): Promise<MentionOutcome> {
  const main = await dispatch.mainSession(agentId)

  if (!main) {
    throw new Error('no main session')
  }

  await dispatch.submit(agentId, main, message)

  return 'main'
}
