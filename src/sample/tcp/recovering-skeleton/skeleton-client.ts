import { inject, injectable } from 'tsyringe'
import { MsgView } from '../../../buffer'
import { IJsFixConfig, IJsFixLogger } from '../../../config'
import { AsciiSession } from '../../../transport'

@injectable()
export class SkeletonClient extends AsciiSession {
  private readonly logger: IJsFixLogger
  private readonly fixLog: IJsFixLogger

  constructor (@inject('IJsFixConfig') public readonly config: IJsFixConfig,
    @inject('logoutSeconds') public readonly logoutSeconds: number) {
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
    const logoutSeconds = this.logoutSeconds
    this.logger.info(`will logout after ${logoutSeconds}`)
    setTimeout(() => {
      this.done()
    }, logoutSeconds * 1000)
  }

  protected onStopped (): void {
    this.logger.info('stopped')
  }
}
