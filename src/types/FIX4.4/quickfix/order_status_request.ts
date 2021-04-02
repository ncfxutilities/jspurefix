import { Iheader } from './set/header'
import { IParties } from './set/parties'
import { IInstrument } from './set/instrument'
import { IFinancingDetails } from './set/financing_details'
import { IUndInstrmtGrp } from './set/und_instrmt_grp'
import { Itrailer } from './set/trailer'

export interface IOrderStatusRequest {
  header: Iheader
  OrderID?: string// 37
  ClOrdID: string// 11
  SecondaryClOrdID?: string// 526
  ClOrdLinkID?: string// 583
  Parties?: IParties
  OrdStatusReqID?: string// 790
  Account?: string// 1
  AcctIDSource?: number// 660
  Instrument?: IInstrument
  FinancingDetails?: IFinancingDetails
  UndInstrmtGrp?: IUndInstrmtGrp
  Side: string// 54
  trailer: Itrailer
}
