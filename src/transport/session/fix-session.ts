import { ElasticBuffer, MsgView } from '../../buffer'
import { ILooseObject } from '../../collections/collection'
import { IJsFixConfig, IJsFixLogger } from '../../config'
import { MsgTag } from '../../types'
import { MsgTransport } from '../factory'
import { FixSessionState } from './fix-session-state'

import * as events from 'events'
import { SegmentType } from '../../buffer/segment/segment-type'
import { SessionState } from './session-state'

export abstract class FixSession extends events.EventEmitter {
  public logReceivedMsgs: boolean = false
  protected timer: NodeJS.Timeout | null = null
  protected transport: MsgTransport | null = null
  public manageSession: boolean = true
  public checkMsgIntegrity: boolean = false
  protected readonly me: string
  protected readonly initiator: boolean
  protected readonly acceptor: boolean
  protected readonly sessionState: FixSessionState
  protected readonly sessionLogger: IJsFixLogger
  protected requestLogoutType: string
  protected respondLogoutType: string
  protected requestLogonType: string

  protected constructor (public readonly config: IJsFixConfig) {
    super()
    const description = config.description
    this.me = description?.application?.name ?? 'me'
    this.sessionState = new FixSessionState(
      {
        heartBeat: config.description.HeartBtInt,
        lastPeerMsgSeqNum: config.description.LastReceivedSeqNum
      })
    this.sessionLogger = config.logFactory.logger(`${this.me}:FixSession`)
    this.initiator = description?.application?.type === 'initiator'
    this.acceptor = !this.initiator
    this.checkMsgIntegrity = this.acceptor
    this.sessionState.compId = description.SenderCompId
  }

  stateStr (theState: SessionState): string {
    return SessionState[theState]
  }

  assignState (newState: SessionState): void {
    const currentState = this.sessionState.state
    const currentStateStr = this.stateStr(currentState)
    const logger = this.sessionLogger
    const msg = `current state ${currentStateStr} (${currentState}) moves to ${SessionState[newState]} (${newState})`
    logger.info(msg)
    this.sessionState.state = newState
  }

  public setState (state: SessionState): void {
    const logger = this.sessionLogger
    const currentState = this.sessionState.state
    const currentStateStr = this.stateStr(currentState)
    if (state === currentState) return
    switch (currentState) {
      case SessionState.ConfirmingLogout:
      case SessionState.Stopped:
        if (state !== SessionState.NetworkConnectionEstablished) {
          logger.info(`ignoring request to change state as now already in ${currentStateStr}`)
        } else {
          this.assignState(state)
        }
        break

      default: {
        this.assignState(state)
      }
    }
  }

  public getState (): SessionState {
    return this.sessionState.state
  }

  public lastSentSeqNum (): number {
    return this.sessionState.lastSentSeqNum()
  }

  public lastPeerSeqNum (): number {
    return this.sessionState.lastPeerMsgSeqNum
  }

  public sendLogon (): void {
    const lo = this.config.factory?.logon()
    if (lo) {
      this.send(this.requestLogonType, lo)
    }
  }

  private async waitPromise (): Promise<number> {
    const logger = this.sessionLogger
    return await new Promise<any>((resolve, reject) => {
      if (this.initiator) {
        logger.debug(`initiator sending logon state = ${this.stateString()}`)
        this.sendLogon()
        this.setState(SessionState.InitiationLogonSent)
      } else {
        logger.debug(`acceptor waits for logon state = ${this.stateString()}`)
        this.setState(SessionState.WaitingForALogon)
      }

      this.on('error', (e: Error) => {
        logger.error(e)
        reject(e)
      })

      this.on('done', () => {
        resolve(this.transport?.id)
      })
    })
  }

  public async run (transport: MsgTransport): Promise<number> {
    const logger = this.sessionLogger
    if (this.transport) {
      logger.info(`reset from previous transport. state ${this.stateString()}`)
      this.reset()
    }
    this.transport = transport
    this.subscribe()
    return await this.waitPromise()
  }

  protected expectedEndState (): boolean {
    switch (this.sessionState.state) {
      case SessionState.Stopped:
      case SessionState.ConfirmingLogout:
        return true

      default:
        return false
    }
  }

  protected rxOnEnd (): void {
    const logger = this.sessionLogger
    logger.info(`rx end received sessionState = [${this.sessionState.toString()}]`)
    const expectedState = this.expectedEndState()
    if (expectedState) {
      logger.info(`rx receives end state = ${this.stateString()} - stop session`)
      this.stop()
    } else {
      this.setState(SessionState.DetectBrokenNetworkConnection)
      const e = new Error(`unexpected state - transport failed? = ${this.stateString()}`)
      logger.info(`rx error ${e.message}`)
      this.terminate(e)
    }
  }

  protected rxOnMsg (msgType: string, view: MsgView): void {
    const logger = this.sessionLogger

    if (this.logReceivedMsgs) {
      const name = view.segment.type !== SegmentType.Unknown ? view?.segment?.set?.name : 'unknown'
      logger.info(`${msgType}: ${name}`)
      logger.info(`${view.toString()}`)
    }
    this.sessionState.lastReceivedAt = new Date()
    if (this.manageSession) {
      this.onMsg(msgType, view)
    } else {
      this.checkForwardMsg(msgType, view)
    }
  }

  protected rxOnDone (): void {
    const logger = this.sessionLogger
    logger.info('rx done received')
    this.done()
  }

  protected rxOnError (e: Error): void {
    const logger = this.sessionLogger
    logger.warning(`rx error event: ${e.message} ${e.stack ?? ''}`)
    this.terminate(e)
  }

  protected rxOnDecoded (msgType: string, data: ElasticBuffer, ptr: number): void {
    const logger = this.sessionLogger
    logger.debug(`rx: [${msgType}] ${ptr} bytes`)
    this.onDecoded(msgType, data.toString(ptr))
  }

  protected txOnError (e: Error): void {
    const logger = this.sessionLogger
    logger.warning(`tx error event: ${e.message} ${e.stack ?? ''}`)
    this.terminate(e)
  }

  protected txOnEncoded (msgType: string, data: string, hdr: ILooseObject): void {
    const logger = this.sessionLogger
    this.sessionState.lastHeader = hdr
    logger.debug(`tx: [${msgType}] ${data.length} bytes seqNo = ${this.lastSentSeqNum()}`)
    this.onEncoded(msgType, data)
  }

  protected unsubscribe (): void {
    const logger = this.sessionLogger
    logger.info(`unsubscribe sessionState = [${this.sessionState.toString()}]`)
    const transport = this.transport
    const rx = transport?.receiver
    const tx = transport?.transmitter

    rx?.removeListener('msg', this.rxOnMsg)
    rx?.removeListener('error', this.rxOnError)
    rx?.removeListener('done', this.rxOnDone)
    rx?.removeListener('end', this.rxOnEnd)
    rx?.removeListener('decoded', this.rxOnDecoded)
    tx?.removeListener('error', this.txOnError)
    tx?.removeListener('encoded', this.txOnEncoded)
  }

  protected subscribe (): void {
    const transport = this.transport

    const rx = transport?.receiver
    const tx = transport?.transmitter
    const inst = this
    rx?.on('msg', (msgType: string, view: MsgView) => inst.rxOnMsg(msgType, view))
    rx?.on('error', (e: Error) => inst.rxOnError(e))
    rx?.on('done', () => inst.rxOnDone())
    rx?.on('end', () => inst.rxOnEnd())
    rx?.on('decoded', (msgType: string, data: ElasticBuffer, ptr: number) => inst.rxOnDecoded(msgType, data, ptr))
    tx?.on('error', (e: Error) => inst.txOnError(e))
    tx?.on('encoded', (msgType: string, data: string, hdr: ILooseObject) => inst.txOnEncoded(msgType, data, hdr))
  }

  protected validStateApplicationMsg (): boolean {
    switch (this.sessionState.state) {
      case SessionState.Idle:
      case SessionState.InitiateConnection:
      case SessionState.InitiationLogonSent:
      case SessionState.WaitingForALogon:
      case SessionState.HandleResendRequest:
      case SessionState.AwaitingProcessingResponseToTestRequest:
      case SessionState.AwaitingProcessingResponseToResendRequest:
        return false
      default:
        return true
    }
  }

  protected stateString (): string {
    return SessionState[this.sessionState.state]
  }

  protected checkForwardMsg (msgType: string, view: MsgView): void {
    this.sessionLogger.info(`forwarding msgType = '${msgType}' to application`)
    this.setState(SessionState.ActiveNormalSession)
    this.onApplicationMsg(msgType, view)
  }

  private stopTimer (): void {
    if (this.timer) {
      this.sessionLogger.info('stopTimer')
      clearInterval(this.timer)
      this.timer = null
    }
  }

  protected terminate (error: Error): void {
    if (this.sessionState.state === SessionState.Stopped) return
    this.sessionLogger.error(error)
    this.stopTimer()
    if (this.transport) {
      this.transport.end()
    }
    this.transport = null
    this.setState(SessionState.Stopped)
    this.emit('error', error)
  }

  protected peerLogout (view: MsgView): void {
    const msg = view.getString(MsgTag.Text)
    const state = this.sessionState.state
    switch (state) {
      case SessionState.WaitingLogoutConfirm: {
        this.sessionLogger.info(`peer confirms logout Text = '${msg}'`)
        this.stop()
        break
      }

      case SessionState.InitiationLogonResponse:
      case SessionState.ActiveNormalSession:
      case SessionState.InitiationLogonReceived: {
        this.setState(SessionState.ConfirmingLogout)
        this.sessionLogger.info(`peer initiates logout Text = '${msg}'`)
        this.sessionLogout()
      }
    }
  }

  protected send (msgType: string, obj: ILooseObject): void {
    const state = this.sessionState.state
    switch (state) {
      case SessionState.Stopped: {
        this.sessionLogger.warning(`can't send in state ${this.stateString()}`)
        break
      }

      default: {
        this.sessionState.LastSentAt = new Date()
        this.transport?.transmitter.send(msgType, obj)
        break
      }
    }
  }

  protected sendLogout (msg: string): void {
    const factory = this.config.factory
    this.sessionLogger.info(`sending logout with ${msg}`)
    const lo = factory?.logout(this.requestLogoutType, msg)
    if (lo) {
      this.send(this.requestLogoutType, lo)
    }
  }

  protected sessionLogout (): void {
    const sessionState = this.sessionState
    if (sessionState.logoutSentAt) {
      return
    }

    switch (sessionState.state) {
      case SessionState.ActiveNormalSession:
      case SessionState.InitiationLogonResponse:
      case SessionState.InitiationLogonReceived: {
        // this instance initiates logout
        this.setState(SessionState.WaitingLogoutConfirm)
        sessionState.logoutSentAt = new Date()
        const msg = `${this.me} initiate logout`
        this.sessionLogger.info(msg)
        this.sendLogout(msg)
        break
      }

      case SessionState.ConfirmingLogout: {
        // this instance responds to log out
        this.setState(SessionState.ConfirmingLogout)
        sessionState.logoutSentAt = new Date()
        const msg = `${this.me} confirming logout`
        this.sessionLogger.info(msg)
        this.sendLogout(msg)
        break
      }

      default: {
        this.sessionLogger.info(`sessionLogout ignored as in state ${sessionState.state}`)
      }
    }
  }

  public done (): void {
    switch (this.sessionState.state) {
      case SessionState.InitiationLogonResponse:
      case SessionState.ActiveNormalSession:
      case SessionState.InitiationLogonReceived: {
        this.sessionLogout()
        break
      }

      case SessionState.Stopped:
        this.sessionLogger.info('done. session is now stopped')
        break

      default: {
        this.stop()
        break
      }
    }
    this.sessionLogger.info(`done. check logout sequence state ${this.stateString()}`)
  }

  public reset (resetSeqNum?: number | null): void {
    this.stopTimer()
    this.transport = null
    const resetFlag = this.config.description.ResetSeqNumFlag
    const seqNum = resetFlag ? 0 : resetSeqNum ?? this.sessionState.lastPeerMsgSeqNum
    this.sessionState.reset(seqNum) // from header def ... eventually
    this.setState(SessionState.NetworkConnectionEstablished)
  }

  protected stop (error: Error | null = null): void {
    if (this.sessionState.state === SessionState.Stopped) {
      return
    }
    this.stopTimer()
    this.unsubscribe()
    this.sessionLogger.info('stop: kill transport')
    this.transport?.end()
    if (error) {
      this.sessionLogger.info(`stop: emit error ${error.message}`)
      this.emit('error', error)
    } else {
      this.emit('done')
    }

    this.setState(SessionState.Stopped)
    this.onStopped(error ?? undefined)
    this.transport = null
  }

  protected abstract onMsg (msgType: string, view: MsgView): void
  // application responsible for writing its own log
  protected abstract onDecoded (msgType: string, txt: string): void
  protected abstract onEncoded (msgType: string, txt: string): void
  // an application level message to be handled by implementation, unless
  // manageSession = false in which case all messages will be forwarded
  protected abstract onApplicationMsg (msgType: string, view: MsgView): void
  // inform application peer has logged in - provide login message
  protected abstract onReady (view: MsgView): void
  // inform application this session has now ended - either from logout or connection dropped
  protected abstract onStopped (error?: Error): void
  // does the application accept the inbound logon request
  protected abstract onLogon (view: MsgView, user: string, password: string): Promise<boolean>
}
