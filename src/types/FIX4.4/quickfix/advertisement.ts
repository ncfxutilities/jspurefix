import { Iheader } from './set/header'
import { IInstrument } from './set/instrument'
import { IInstrmtLegGrp } from './set/instrmt_leg_grp'
import { IUndInstrmtGrp } from './set/und_instrmt_grp'
import { Itrailer } from './set/trailer'

export interface IAdvertisement {
  header: Iheader
  AdvId: string// 2
  AdvTransType: string// 5
  AdvRefID?: string// 3
  Instrument?: IInstrument
  InstrmtLegGrp?: IInstrmtLegGrp
  UndInstrmtGrp?: IUndInstrmtGrp
  AdvSide: string// 4
  Quantity: number// 53
  QtyType?: number// 854
  Price?: number// 44
  Currency?: string// 15
  TradeDate?: Date// 75
  TransactTime?: Date// 60
  Text?: string// 58
  EncodedTextLen?: number// 354
  EncodedText?: Buffer// 355
  URLLink?: string// 149
  LastMkt?: string// 30
  TradingSessionID?: string// 336
  TradingSessionSubID?: string// 625
  trailer: Itrailer
}
