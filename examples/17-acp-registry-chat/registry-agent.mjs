#!/usr/bin/env node
import {
  AgentSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
} from '@agentclientprotocol/sdk'
import { randomUUID } from 'node:crypto'
import { Readable, Writable } from 'node:stream'

class RegistryEchoAgent {
  constructor(connection) {
    this.connection = connection
    this.sessions = new Set()
  }

  async initialize() {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    }
  }

  async authenticate() {
    return {}
  }

  async newSession() {
    const sessionId = randomUUID()
    this.sessions.add(sessionId)
    return { sessionId }
  }

  async loadSession() {
    throw new Error('registry echo agent does not support loading sessions')
  }

  async setSessionMode() {
    return {}
  }

  async prompt(params) {
    if (!this.sessions.has(params.sessionId)) {
      throw new Error(`unknown session ${params.sessionId}`)
    }
    const text = params.prompt
      .filter((entry) => entry.type === 'text')
      .map((entry) => entry.text)
      .join(' ')
      .trim()
    await this.connection.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `registry echo received: ${text || '(empty prompt)'}`,
        },
      },
    })
    return { stopReason: 'end_turn' }
  }

  async cancel() {
  }
}

const stream = ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin),
)
new AgentSideConnection((connection) => new RegistryEchoAgent(connection), stream)
