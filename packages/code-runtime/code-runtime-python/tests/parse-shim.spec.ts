import { describe, expect, it } from 'vitest'
import { parseShimMessage } from '../src/index.ts'

describe('parseShimMessage', () => {
  it('parses a call message', () => {
    expect(parseShimMessage({ op: 'call', global: 'tools', name: 'read', args: { a: 1 } })).toEqual({
      op: 'call',
      global: 'tools',
      name: 'read',
      args: { a: 1 },
    })
  })

  it('parses a log message', () => {
    expect(parseShimMessage({ op: 'log', text: 'hello' })).toEqual({ op: 'log', text: 'hello' })
  })

  it('parses a done message with a value', () => {
    expect(parseShimMessage({ op: 'done', value: { x: 1 } })).toEqual({ op: 'done', value: { x: 1 } })
  })

  it('parses a done message with an error', () => {
    expect(parseShimMessage({ op: 'done', error: { kind: 'exception', message: 'boom' } })).toEqual({
      op: 'done',
      error: { kind: 'exception', message: 'boom' },
    })
  })

  it('drops junk', () => {
    expect(parseShimMessage(null)).toBeUndefined()
    expect(parseShimMessage({ op: 'log' })).toBeUndefined()
    expect(parseShimMessage({ op: 'done', error: { kind: 'nope', message: 'x' } })).toBeUndefined()
  })
})
