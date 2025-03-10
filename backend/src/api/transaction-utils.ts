import bitcoinApi from './bitcoin/bitcoin-api-factory';
import { TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import config from '../config';

class TransactionUtils {
  constructor() { }

  public stripCoinbaseTransaction(tx: TransactionExtended): TransactionMinerInfo {
    return {
      vin: [{
        scriptsig: tx.vin[0].scriptsig || tx.vin[0]['coinbase']
      }],
      vout: tx.vout
        .map((vout) => ({
          scriptpubkey_address: vout.scriptpubkey_address,
          value: vout.value
        }))
        .filter((vout) => vout.value)
    };
  }

  public async $getTransactionExtended(txId: string, addPrevouts = false): Promise<TransactionExtended> {
    const transaction: IEsploraApi.Transaction = await bitcoinApi.$getRawTransaction(txId, false, addPrevouts);
    return this.extendTransaction(transaction);
  }

  private extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    // @ts-ignore
    if (transaction.size) {
      // @ts-ignore
      return transaction;
    }
    const feePerVbytes = Math.max(config.MEMPOOL.NETWORK === 'liquid' ? 0.1 : 1, (transaction.fee || 0) / (transaction.weight));
    const transactionExtended: TransactionExtended = Object.assign({
      vsize: Math.round(transaction.weight),
      feePerVsize: feePerVbytes,
      effectiveFeePerVsize: feePerVbytes,
    }, transaction);
    if (!transaction.status.confirmed) {
      transactionExtended.firstSeen = Math.round((new Date().getTime() / 1000));
    }
    return transactionExtended;
  }
}

export default new TransactionUtils();
