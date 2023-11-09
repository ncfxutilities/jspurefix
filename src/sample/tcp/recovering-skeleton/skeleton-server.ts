import { inject, injectable } from 'tsyringe'
import { MsgView } from '../../../buffer'
import { IJsFixConfig, IJsFixLogger } from '../../../config'
import { AsciiSession } from '../../../transport'

@injectable()
export class SkeletonServer extends AsciiSession {
  private readonly logger: IJsFixLogger
  private readonly fixLog: IJsFixLogger

  constructor (@inject('IJsFixConfig') public readonly config: IJsFixConfig,
    @inject('dropConnectionTimeout') public readonly dropConnectionTimeout: number) {
    super(config)
    this.logReceivedMsgs = true
    this.fixLog = config.logFactory.plain(`jsfix.${config?.description?.application?.name}.txt`)
    this.logger = config.logFactory.logger(`${this.me}`)
  }

  protected onApplicationMsg (msgType: string, view: MsgView): void {
    // dispatch messages
    switch (msgType) {
      default: {
        this.logger.info(`received message type ${msgType}`)
        break
      }
    }
  }

  // use msgType for example to persist only trade capture messages to database
  protected onDecoded (msgType: string, txt: string): void {
    this.fixLog.info(txt)
  }

  // delimiter substitution now done in encoding
  protected onEncoded (msgType: string, txt: string): void {
    this.fixLog.info(txt)
  }

  protected async onLogon (view: MsgView, user: string, password: string): Promise<boolean> {
    this.logger.info(`peer logs in user ${user}`)
    return true
  }

  protected onReady (view: MsgView): void {
    this.logger.info('onReady')
    if (this.dropConnectionTimeout > 0) {
      this.logger.info(`acceptor is ready for requests - drop connection in ${this.dropConnectionTimeout}`)
      setTimeout(() => {
        setImmediate(() => {
          this.logger.info('kill transport')
          this.stop(new Error(`loss of tcp. ${this.me}`))
        })
      }, this.dropConnectionTimeout * 1000)
    } else {
      this.logger.info('acceptor is ready for requests')
    }
  }

  protected onStopped (): void {
    this.logger.info('stopped')
  }
}
