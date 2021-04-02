import { Iheader } from './set/header'
import { IParties } from './set/parties'
import { IInstrument } from './set/instrument'
import { IInstrmtLegGrp } from './set/instrmt_leg_grp'
import { IUndInstrmtGrp } from './set/und_instrmt_grp'
import { Itrailer } from './set/trailer'

export interface IRequestForPositionsAck {
  header: Iheader
  PosMaintRptID: string// 721
  PosReqID?: string// 710
  TotalNumPosReports?: number// 727
  UnsolicitedIndicator?: boolean// 325
  PosReqResult: number// 728
  PosReqStatus: number// 729
  Parties?: IParties
  Account: string// 1
  AcctIDSource?: number// 660
  AccountType: number// 581
  Instrument?: IInstrument
  Currency?: string// 15
  InstrmtLegGrp?: IInstrmtLegGrp
  UndInstrmtGrp?: IUndInstrmtGrp
  ResponseTransportType?: number// 725
  ResponseDestination?: string// 726
  Text?: string// 58
  EncodedTextLen?: number// 354
  EncodedText?: Buffer// 355
  trailer: Itrailer
}
