import { Iheader } from './set/header'
import { IOrdListStatGrp } from './set/ord_list_stat_grp'
import { Itrailer } from './set/trailer'

export interface IListStatus {
  header: Iheader
  ListID: string// 66
  ListStatusType: number// 429
  NoRpts: number// 82
  ListOrderStatus: number// 431
  RptSeq: number// 83
  ListStatusText?: string// 444
  EncodedListStatusTextLen?: number// 445
  EncodedListStatusText?: Buffer// 446
  TransactTime?: Date// 60
  TotNoOrders: number// 68
  LastFragment?: boolean// 893
  OrdListStatGrp?: IOrdListStatGrp
  trailer: Itrailer
}
