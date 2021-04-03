import { MsgView } from '../../../buffer'
import { AsciiSession } from '../../../transport'
import { MsgType } from '../../../types'
import { IJsFixLogger, IJsFixConfig } from '../../../config'
import { IMarketDataRequest } from '../../../types/FIX4.4/quickfix'

// interfaces generated by compiler to make messages easy in an IDE

export class MDServer extends AsciiSession {
  private readonly logger: IJsFixLogger
  private readonly fixLog: IJsFixLogger
  private timerHandle: NodeJS.Timer = null

  constructor (public readonly config: IJsFixConfig) {
    super(config)
    this.logReceivedMsgs = true
    this.checkMsgIntegrity = false
    this.logger = config.logFactory.logger(`${this.me}:MDServer`)
    this.fixLog = config.logFactory.plain(`jsfix.${config!.description!.application!.name}.txt`)
  }

  protected onApplicationMsg (msgType: string, view: MsgView): void {
    this.logger.info(`${view.toJson()}`)
    switch (msgType) {
      case MsgType.MarketDataRequest: {
        const req: IMarketDataRequest = view.toObject()
        break
      }
    }
  }

  protected onReady (view: MsgView): void {
    // server waits for client to make a request
    this.logger.info('ready for requests.')
  }

  protected onStopped (): void {
    this.logger.info('stopped')
    if (this.timerHandle) {
      clearInterval(this.timerHandle)
    }
  }

  protected onLogon (view: MsgView, user: string, password: string): boolean {
    return true
  }

  // use msgType for example to persist only trade capture messages to database
  protected onDecoded (msgType: string, txt: string): void {
    this.fixLog.info(txt)
  }

  // delimiter substitution now done in encoding
  protected onEncoded (msgType: string, txt: string): void {
    this.fixLog.info(txt)
  }
}