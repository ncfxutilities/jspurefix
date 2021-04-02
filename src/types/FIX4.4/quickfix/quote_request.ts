import { Iheader } from './set/header'
import { IQuotReqGrp } from './set/quot_req_grp'
import { Itrailer } from './set/trailer'

export interface IQuoteRequest {
  header: Iheader
  QuoteReqID: string// 131
  RFQReqID?: string// 644
  ClOrdID?: string// 11
  OrderCapacity?: string// 528
  QuotReqGrp?: IQuotReqGrp
  Text?: string// 58
  EncodedTextLen?: number// 354
  EncodedText?: Buffer// 355
  trailer: Itrailer
}
