import config from '../../config';
import * as bitcoin from '@mempool/bitcoin';
import * as bitcoinjs from 'bitcoinjs-lib';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IBitcoinApi } from './bitcoin-api.interface';
import { IEsploraApi } from './esplora-api.interface';
import blocks from '../blocks';
import mempool from '../mempool';
import { TransactionExtended } from '../../mempool.interfaces';

class BitcoinApi implements AbstractBitcoinApi {
  private rawMempoolCache: IBitcoinApi.RawMempool | null = null;
  private bitcoindClient: any;

  constructor() {
    this.bitcoindClient = new bitcoin.Client({
      host: config.CORE_RPC.HOST,
      port: config.CORE_RPC.PORT,
      user: config.CORE_RPC.USERNAME,
      pass: config.CORE_RPC.PASSWORD,
      timeout: 60000,
    });
  }

  $getRawTransaction(txId: string, skipConversion = false, addPrevout = false): Promise<IEsploraApi.Transaction> {
    // If the transaction is in the mempool we already converted and fetched the fee. Only prevouts are missing
    const txInMempool = mempool.getMempool()[txId];
    if (txInMempool && addPrevout) {
      return this.$addPrevouts(txInMempool);
    }

    // Special case to fetch the Coinbase transaction
    if (txId === '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b') {
      return this.$returnCoinbaseTransaction();
    }

    return this.bitcoindClient.getRawTransaction(txId, true)
      .then((transaction: IBitcoinApi.Transaction) => {
        if (skipConversion) {
          transaction.vout.forEach((vout) => {
            vout.value = vout.value * 100000000;
          });
          return transaction;
        }
        return this.$convertTransaction(transaction, addPrevout);
      });
  }

  $getBlockHeightTip(): Promise<number> {
    return this.bitcoindClient.getChainTips()
      .then((result: IBitcoinApi.ChainTips[]) => result[0].height);
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.bitcoindClient.getBlock(hash, 1)
      .then((rpcBlock: IBitcoinApi.Block) => rpcBlock.tx);
  }

  $getRawBlock(hash: string): Promise<string> {
    return this.bitcoindClient.getBlock(hash, 0);
  }

  $getBlockHash(height: number): Promise<string> {
    return this.bitcoindClient.getBlockHash(height);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return this.bitcoindClient.getBlockHeader(hash, false);
  }

  async $getBlock(hash: string): Promise<IEsploraApi.Block> {
    const foundBlock = blocks.getBlocks().find((block) => block.id === hash);
    if (foundBlock) {
      return foundBlock;
    }

    return this.bitcoindClient.getBlock(hash)
      .then((block: IBitcoinApi.Block) => this.convertBlock(block));
  }

  $getAddress(address: string): Promise<IEsploraApi.Address> {
    throw new Error('Method getAddress not supported by the Bitcoin RPC API.');
  }

  $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAddressTransactions not supported by the Bitcoin RPC API.');
  }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return this.bitcoindClient.getRawMemPool();
  }

  $getAddressPrefix(prefix: string): string[] {
    const found: string[] = [];
    const mp = mempool.getMempool();
    for (const tx in mp) {
      for (const vout of mp[tx].vout) {
        if (vout.scriptpubkey_address.indexOf(prefix) === 0) {
          found.push(vout.scriptpubkey_address);
          if (found.length >= 10) {
            return found;
          }
        }
      }
    }
    return found;
  }

  protected async $convertTransaction(transaction: IBitcoinApi.Transaction, addPrevout: boolean): Promise<IEsploraApi.Transaction> {
    let esploraTransaction: IEsploraApi.Transaction = {
      txid: transaction.txid,
      version: transaction.version,
      locktime: transaction.locktime,
      size: transaction.size,
      weight: transaction.size,
      fee: 0,
      vin: [],
      vout: [],
      status: { confirmed: false },
    };

    esploraTransaction.vout = transaction.vout.map((vout) => {
      return {
        value: vout.value * 100000000,
        scriptpubkey: vout.scriptPubKey.hex,
        scriptpubkey_address: vout.scriptPubKey && vout.scriptPubKey.addresses ? vout.scriptPubKey.addresses[0] : '',
        scriptpubkey_asm: vout.scriptPubKey.asm ? this.convertScriptSigAsm(vout.scriptPubKey.asm) : '',
        scriptpubkey_type: this.translateScriptPubKeyType(vout.scriptPubKey.type),
      };
    });

    esploraTransaction.vin = transaction.vin.map((vin) => {
      return {
        is_coinbase: !!vin.coinbase,
        prevout: null,
        scriptsig: vin.scriptSig && vin.scriptSig.hex || vin.coinbase || '',
        scriptsig_asm: vin.scriptSig && this.convertScriptSigAsm(vin.scriptSig.asm) || '',
        sequence: vin.sequence,
        txid: vin.txid || '',
        vout: vin.vout || 0,
        witness: vin.txinwitness,
      };
    });

    if (transaction.confirmations) {
      esploraTransaction.status = {
        confirmed: true,
        block_height: blocks.getCurrentBlockHeight() - transaction.confirmations + 1,
        block_hash: transaction.blockhash,
        block_time: transaction.blocktime,
      };
    }

    if (transaction.confirmations) {
      esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, addPrevout);
    } else {
      esploraTransaction = await this.$appendMempoolFeeData(esploraTransaction);
      if (addPrevout) {
        esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, addPrevout);
      }
    }

    return esploraTransaction;
  }

  private convertBlock(block: IBitcoinApi.Block): IEsploraApi.Block {
    return {
      id: block.hash,
      height: block.height,
      version: block.version,
      timestamp: block.time,
      bits: parseInt(block.bits, 16),
      nonce: block.nonce,
      difficulty: block.difficulty,
      merkle_root: block.merkleroot,
      tx_count: block.nTx,
      size: block.size,
      weight: block.size,
      previousblockhash: block.previousblockhash,
    };
  }

  private translateScriptPubKeyType(outputType: string): string {
    const map = {
      'pubkey': 'p2pk',
      'pubkeyhash': 'p2pkh',
      'scripthash': 'p2sh',
      'witness_v0_keyhash': 'v0_p2wpkh',
      'witness_v0_scripthash': 'v0_p2wsh',
      'witness_v1_taproot': 'v1_p2tr',
      'nonstandard': 'nonstandard',
      'nulldata': 'op_return'
    };

    if (map[outputType]) {
      return map[outputType];
    } else {
      return '';
    }
  }

  private async $appendMempoolFeeData(transaction: IEsploraApi.Transaction): Promise<IEsploraApi.Transaction> {
    if (transaction.fee) {
      return transaction;
    }
    let mempoolEntry: IBitcoinApi.MempoolEntry;
    if (!mempool.isInSync() && !this.rawMempoolCache) {
      this.rawMempoolCache = await this.$getRawMempoolVerbose();
    }
    if (this.rawMempoolCache && this.rawMempoolCache[transaction.txid]) {
      mempoolEntry = this.rawMempoolCache[transaction.txid];
    } else {
      mempoolEntry = await this.$getMempoolEntry(transaction.txid);
    }
    transaction.fee = mempoolEntry.fee * 100000000;
    return transaction;
  }

  protected async $addPrevouts(transaction: TransactionExtended): Promise<TransactionExtended> {
    for (const vin of transaction.vin) {
      if (vin.prevout) {
        continue;
      }
      const innerTx = await this.$getRawTransaction(vin.txid, false);
      vin.prevout = innerTx.vout[vin.vout];
      this.addInnerScriptsToVin(vin);
    }
    return transaction;
  }

  protected $returnCoinbaseTransaction(): Promise<IEsploraApi.Transaction> {
    return this.bitcoindClient.getBlock('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', 2)
      .then((block: IBitcoinApi.Block) => {
        return this.$convertTransaction(Object.assign(block.tx[0], {
          confirmations: blocks.getCurrentBlockHeight() + 1,
          blocktime: 1231006505 }), false);
      });
  }

  private $getMempoolEntry(txid: string): Promise<IBitcoinApi.MempoolEntry> {
    return this.bitcoindClient.getMempoolEntry(txid);
  }

  private $getRawMempoolVerbose(): Promise<IBitcoinApi.RawMempool> {
    return this.bitcoindClient.getRawMemPool(true);
  }

  private async $calculateFeeFromInputs(transaction: IEsploraApi.Transaction, addPrevout: boolean): Promise<IEsploraApi.Transaction> {
    if (transaction.vin[0].is_coinbase) {
      transaction.fee = 0;
      return transaction;
    }
    let totalIn = 0;
    for (const vin of transaction.vin) {
      const innerTx = await this.$getRawTransaction(vin.txid, !addPrevout);
      if (addPrevout) {
        vin.prevout = innerTx.vout[vin.vout];
        this.addInnerScriptsToVin(vin);
      }
      totalIn += innerTx.vout[vin.vout].value;
    }
    const totalOut = transaction.vout.reduce((p, output) => p + output.value, 0);
    transaction.fee = parseFloat((totalIn - totalOut).toFixed(8));
    return transaction;
  }

  private convertScriptSigAsm(str: string): string {
    const a = str.split(' ');
    const b: string[] = [];
    a.forEach((chunk) => {
      if (chunk.substr(0, 3) === 'OP_') {
        chunk = chunk.replace(/^OP_(\d+)/, 'OP_PUSHNUM_$1');
        chunk = chunk.replace('OP_CHECKSEQUENCEVERIFY', 'OP_CSV');
        b.push(chunk);
      } else {
        chunk = chunk.replace('[ALL]', '01');
        if (chunk === '0') {
          b.push('OP_0');
        } else {
          b.push('OP_PUSHBYTES_' + Math.round(chunk.length / 2) + ' ' + chunk);
        }
      }
    });
    return b.join(' ');
  }

  private addInnerScriptsToVin(vin: IEsploraApi.Vin): void {
    if (!vin.prevout) {
      return;
    }

    if (vin.prevout.scriptpubkey_type === 'p2sh') {
      const redeemScript = vin.scriptsig_asm.split(' ').reverse()[0];
      vin.inner_redeemscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(redeemScript, 'hex')));
      if (vin.witness && vin.witness.length > 2) {
        const witnessScript = vin.witness[vin.witness.length - 1];
        vin.inner_witnessscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(witnessScript, 'hex')));
      }
    }

    if (vin.prevout.scriptpubkey_type === 'v0_p2wsh' && vin.witness) {
      const witnessScript = vin.witness[vin.witness.length - 1];
      vin.inner_witnessscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(witnessScript, 'hex')));
    }
  }

}

export default BitcoinApi;
