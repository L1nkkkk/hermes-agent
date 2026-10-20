import { describe, expect, it } from 'vitest'

import {
  applyMaidMention,
  draftCandidates,
  findMaidMentionTarget,
  goalSummary,
  maidMentionTokens,
  maidPresenceHold,
  maidPullDraft,
  maidRoom,
  maidToggledProgressPlan,
  openStepTone,
  resolveMaidMentionRoute,
  resolveMaidProgress
} from './model'
import { PRESENCE_FILL, statusPaint } from './theme'

const harper = { id: 'harper', name: 'Harper' }
const notes = { id: 'notes', name: 'Notes' }
const notebook = { id: 'notebook', name: 'Notebook' }

describe('maid progress', () => {
  it('does not invent a fraction when nothing is tracked', () => {
    expect(resolveMaidProgress({})).toEqual({
      source: 'empty',
      target: '',
      tone: 'idle',
      completed: 0,
      total: 0
    })
  })

  it('reads a control goal and does not invent one when control has none', () => {
    expect(resolveMaidProgress({ goal: { objective: 'Ship the chapter', status: 'active' } })).toMatchObject({
      source: 'goal',
      target: 'Ship the chapter',
      tone: 'working'
    })
    expect(resolveMaidProgress({ goal: null, activeRun: true })).toMatchObject({ source: 'empty', target: '' })
  })

  it('counts only real steps', () => {
    const model = resolveMaidProgress({
      steps: [
        { step: 'lint', status: 'completed' },
        { step: 'ship', status: 'pending' }
      ]
    })

    expect(model).toMatchObject({ source: 'progress', completed: 1, total: 2, target: 'ship' })
  })

  it('takes Process n/m from the goal control only', () => {
    expect(
      resolveMaidProgress({
        goal: {
          objective: 'Ship volume 1',
          status: 'active',
          gates: [
            { command: 'pytest -q', exitCode: 0 },
            { command: 'pnpm lint', exitCode: null }
          ]
        }
      })
    ).toMatchObject({ completed: 1, total: 2 })

    expect(resolveMaidProgress({ goal: { objective: 'Ship', turnsUsed: 4, maxTurns: 5 } })).toMatchObject({
      completed: 4,
      total: 5
    })

    // A goal with neither gates nor turns reports no fraction at all.
    expect(resolveMaidProgress({ goal: { objective: 'Ship', status: 'blocked' } })).toMatchObject({
      completed: 0,
      total: 0
    })
  })
})

describe('goal summary', () => {
  it('lists only the subgoals and gates control reported', () => {
    expect(goalSummary(null)).toEqual([])
    expect(goalSummary({ objective: 'Ship' })).toEqual([])
    expect(
      goalSummary({
        objective: 'Ship',
        subgoals: ['Rewrite ch03', '  ', 'Review ch07'],
        gates: [
          { command: 'pytest -q', exitCode: 0 },
          { command: 'pnpm lint', exitCode: 2 },
          { command: '  ', exitCode: null }
        ]
      })
    ).toEqual([
      { kind: 'subgoal', index: 1, text: 'Rewrite ch03' },
      { kind: 'subgoal', index: 3, text: 'Review ch07' },
      { kind: 'gate', command: 'pytest -q', state: 'passed' },
      { kind: 'gate', command: 'pnpm lint', state: 'failed' }
    ])
  })
})

describe('work plan', () => {
  it('completes an open step and reopens a completed one', () => {
    const steps = [
      { step: 'lint', status: 'pending' as const },
      { step: 'ship', status: 'completed' as const }
    ]

    expect(maidToggledProgressPlan(steps, 0)?.[0]).toEqual({ step: 'lint', status: 'completed' })
    expect(maidToggledProgressPlan(steps, 1)?.[1]).toEqual({ step: 'ship', status: 'pending' })
    expect(maidToggledProgressPlan(steps, 3)).toBeNull()
  })
})

describe('draft line', () => {
  it('appends a pull ask and does not receive a member list', () => {
    const members = ['harper']

    expect(maidPullDraft('', 'Pull Notes into this conversation.')).toBe('Pull Notes into this conversation.')
    expect(maidPullDraft('hold', 'Pull Notes into this conversation.')).toBe('hold\nPull Notes into this conversation.')
    expect(members).toEqual(['harper'])
  })
})

describe('mentions', () => {
  it('routes the first other agent already in the room', () => {
    const route = resolveMaidMentionRoute({
      message: '@Notes review @Harper later',
      agents: [harper, notes],
      currentAgentId: 'harper',
      childKeys: { notes: 'child-notes' }
    })

    expect(route).toEqual({ agent: notes, childKey: 'child-notes' })
  })

  it('ignores slash commands, the current agent, and outsiders', () => {
    expect(
      resolveMaidMentionRoute({
        message: '/goal @Notes',
        agents: [harper, notes],
        currentAgentId: 'harper'
      })
    ).toBeNull()
    expect(
      resolveMaidMentionRoute({
        message: '@Harper continue',
        agents: [harper, notes],
        currentAgentId: 'harper'
      })
    ).toBeNull()
    expect(
      resolveMaidMentionRoute({
        message: '@Archive',
        agents: [harper, notes],
        currentAgentId: 'harper'
      })
    ).toBeNull()
  })

  it('lets the longer name win', () => {
    expect(maidMentionTokens('@Notebook', [notes, notebook]).map(token => token.agent.id)).toEqual(['notebook'])
  })

  it('inserts a spaced mention from the caret', () => {
    const target = findMaidMentionTarget('@No', 3)

    expect(target?.query).toBe('No')
    expect(applyMaidMention('@No', target!, notes)).toEqual({ value: '@Notes ', caret: 7 })
  })
})

describe('room', () => {
  it('stays a private chat until another profile is a member', () => {
    const room = maidRoom({
      ownerId: 'harper',
      ownerName: 'Harper',
      userName: 'You',
      title: 'desk',
      memberIds: [],
      names: {}
    })

    expect(room.kind).toBe('dm')
    expect(draftCandidates([harper, notes], [], 'harper')).toEqual([notes])
  })
})

describe('presence holds', () => {
  it('keeps pending approval and blocked off the busy idle online trio', () => {
    expect(maidPresenceHold({ pendingApproval: true, status: 'working' })).toBe('pending')
    expect(maidPresenceHold({ status: 'pending_approval' })).toBe('pending')
    expect(maidPresenceHold({ status: 'blocked' })).toBe('blocked')
    expect(maidPresenceHold({ status: 'paused' })).toBeNull()
    expect(maidPresenceHold({ status: 'working' })).toBeNull()
    expect(openStepTone('pending', null)).toBe('pending')
    expect(openStepTone('in_progress', 'blocked')).toBe('blocked')
    expect(openStepTone('completed', 'blocked')).toBeNull()
  })
})

describe('presence fills', () => {
  it('keeps pending and blocked apart from each other and from the busy idle online trio', () => {
    expect(PRESENCE_FILL.pending).toBe('#5b8def')
    expect(PRESENCE_FILL.blocked).toBe('#d4546a')
    expect(statusPaint('pending')).toBe('var(--status-pending, #5b8def)')
    expect(statusPaint('blocked')).toBe('var(--status-blocked, #d4546a)')
    expect(statusPaint('online')).not.toBe(PRESENCE_FILL.online)
    expect(PRESENCE_FILL.pending).not.toBe(PRESENCE_FILL.blocked)
    expect(new Set([PRESENCE_FILL.busy, PRESENCE_FILL.idle, PRESENCE_FILL.online]).size).toBe(3)
    expect(PRESENCE_FILL.unknown).toBe('transparent')
    expect(PRESENCE_FILL.busy).not.toBe(PRESENCE_FILL.online)
    expect(PRESENCE_FILL.idle).not.toBe(PRESENCE_FILL.online)
  })
})
