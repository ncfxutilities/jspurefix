import { IMsgApplication } from './session-description'
import { MsgTransport } from './factory'

export abstract class FixInitiator {
  protected constructor (public readonly application: IMsgApplication) {
  }

  public abstract connect (timeout: number): Promise<MsgTransport>
  public abstract end (): void
}
