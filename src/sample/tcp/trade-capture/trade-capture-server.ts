import { MsgView } from '../../../buffer'
import { IJsFixConfig, IJsFixLogger } from '../../../config'
import { AsciiSession } from '../../../transport'
import { MsgType } from '../../../types'
// interfaces generated by compiler to make messages easy in an IDE
import {
  ITradeCaptureReport,
  ITradeCaptureReportRequest,
  MsgTag, SessionRejectReason,
  SubscriptionRequestType, TradeRequestStatus
} from '../../../types/FIX4.4/repo'
import { TradeFactory } from './trade-factory'

export class TradeCaptureServer extends AsciiSession {
  private readonly logger: IJsFixLogger
  private readonly fixLog: IJsFixLogger
  private readonly tradeFactory: TradeFactory = new TradeFactory()
  private timerHandle: NodeJS.Timeout | null = null

  constructor (public readonly config: IJsFixConfig) {
    super(config)
    this.logReceivedMsgs = true
    this.logger = config.logFactory.logger(`${this.me}:TradeCaptureServer`)
    this.fixLog = config.logFactory.plain(`jsfix.${config?.description?.application?.name}.txt`)
  }

  protected onApplicationMsg (msgType: string, view: MsgView): void {
    this.logger.info(`${view.toJson()}`)
    switch (msgType) {
      case MsgType.TradeCaptureReportRequest: {
        this.tradeCaptureReportRequest(view!.toObject() as ITradeCaptureReportRequest)
        break
      }

      default: {
        const seqNum = view.getTyped(MsgTag.MsgSeqNum)
        const msg = this.config.factory?.reject(msgType, seqNum, `${this.me}: unexpected msg type '${msgType}'`, SessionRejectReason.InvalidMsgType)
        if (msg) {
          this.send(msgType, msg)
        }
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

  protected async onLogon (view: MsgView, user: string, password: string): Promise<boolean> {
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

  private tradeCaptureReportRequest (tcr: ITradeCaptureReportRequest): void {
    this.logger.info(`received tcr ${tcr.TradeRequestID}`)
    // send back an ack.
    this.send(MsgType.TradeCaptureReportRequestAck, TradeFactory.tradeCaptureReportRequestAck(tcr, TradeRequestStatus.Accepted))
    // send some trades
    const batch: ITradeCaptureReport[] = this.tradeFactory.batchOfTradeCaptureReport(5)
    batch.forEach((tc: ITradeCaptureReport) => {
      this.send(MsgType.TradeCaptureReport, tc)
    })
    this.send(MsgType.TradeCaptureReportRequestAck, TradeFactory.tradeCaptureReportRequestAck(tcr, TradeRequestStatus.Completed))
    // start sending the odd 'live' trade
    switch (tcr.SubscriptionRequestType) {
      case SubscriptionRequestType.SnapshotAndUpdates: {
        this.timerHandle = setInterval(() => {
          if (Math.random() < 0.4) {
            const tc: ITradeCaptureReport = this.tradeFactory.singleTradeCaptureReport()
            this.send(MsgType.TradeCaptureReport, tc)
          }
        }, 5000)
        break
      }
    }
  }
}
