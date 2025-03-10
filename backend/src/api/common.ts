import { CpfpInfo, TransactionExtended, TransactionStripped } from '../mempool.interfaces';
import config from '../config';
export class Common {
  static median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }

  static percentile(numbers: number[], percentile: number) {
    if (percentile === 50) {
      return this.median(numbers);
    }
    const index = Math.ceil(numbers.length * (100 - percentile) * 1e-2);
    if (index < 0 || index > numbers.length - 1) {
      return 0;
    }
    return numbers[index];
  }

  static getFeesInRange(transactions: TransactionExtended[], rangeLength: number) {
    const arr = [transactions[transactions.length - 1].effectiveFeePerVsize];
    const chunk = 1 / (rangeLength - 1);
    let itemsToAdd = rangeLength - 2;

    while (itemsToAdd > 0) {
      arr.push(transactions[Math.floor(transactions.length * chunk * itemsToAdd)].effectiveFeePerVsize);
      itemsToAdd--;
    }

    arr.push(transactions[0].effectiveFeePerVsize);
    return arr;
  }

  static findRbfTransactions(added: TransactionExtended[], deleted: TransactionExtended[]): { [txid: string]: TransactionExtended } {
    const matches: { [txid: string]: TransactionExtended } = {};
    deleted
      // The replaced tx must have at least one input with nSequence < maxint-1 (That’s the opt-in)
      .filter((tx) => tx.vin.some((vin) => vin.sequence < 0xfffffffe))
      .forEach((deletedTx) => {
        const foundMatches = added.find((addedTx) => {
          // The new tx must, absolutely speaking, pay at least as much fee as the replaced tx.
          return addedTx.fee > deletedTx.fee
            // The new transaction must pay more fee per kB than the replaced tx.
            && addedTx.feePerVsize > deletedTx.feePerVsize
            // Spends one or more of the same inputs
            && deletedTx.vin.some((deletedVin) =>
              addedTx.vin.some((vin) => vin.txid === deletedVin.txid));
            });
        if (foundMatches) {
          matches[deletedTx.txid] = foundMatches;
        }
      });
    return matches;
  }

  static stripTransaction(tx: TransactionExtended): TransactionStripped {
    return {
      txid: tx.txid,
      fee: tx.fee,
      size: tx.weight,
      value: tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0),
    };
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
       setTimeout(() => {
         resolve();
       }, ms);
    });
  }

  static shuffleArray(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }

  static setRelativesAndGetCpfpInfo(tx: TransactionExtended, memPool: { [txid: string]: TransactionExtended }): CpfpInfo {
    const parents = this.findAllParents(tx, memPool);
    const lowerFeeParents = parents.filter((parent) => parent.feePerVsize < tx.effectiveFeePerVsize);

    let totalWeight = tx.weight + lowerFeeParents.reduce((prev, val) => prev + val.weight, 0);
    let totalFees = tx.fee + lowerFeeParents.reduce((prev, val) => prev + val.fee, 0);

    tx.ancestors = parents
      .map((t) => {
        return {
          txid: t.txid,
          weight: t.weight,
          fee: t.fee,
        };
      });

    // Add high (high fee) decendant weight and fees
    if (tx.bestDescendant) {
      totalWeight += tx.bestDescendant.weight;
      totalFees += tx.bestDescendant.fee;
    }

    tx.effectiveFeePerVsize = Math.max(config.MEMPOOL.NETWORK === 'liquid' ? 0.1 : 1, totalFees / (totalWeight));
    tx.cpfpChecked = true;

    return {
      ancestors: tx.ancestors,
      bestDescendant: tx.bestDescendant || null,
    };
  }


  private static findAllParents(tx: TransactionExtended, memPool: { [txid: string]: TransactionExtended }): TransactionExtended[] {
    let parents: TransactionExtended[] = [];
    tx.vin.forEach((parent) => {
      if (parents.find((p) => p.txid === parent.txid)) {
        return;
      }

      const parentTx = memPool[parent.txid];
      if (parentTx) {
        if (tx.bestDescendant && tx.bestDescendant.fee / (tx.bestDescendant.weight) > parentTx.feePerVsize) {
          if (parentTx.bestDescendant && parentTx.bestDescendant.fee < tx.fee + tx.bestDescendant.fee) {
            parentTx.bestDescendant = {
              weight: tx.weight + tx.bestDescendant.weight,
              fee: tx.fee + tx.bestDescendant.fee,
              txid: tx.txid,
            };
          }
        } else if (tx.feePerVsize > parentTx.feePerVsize) {
          parentTx.bestDescendant = {
            weight: tx.weight,
            fee: tx.fee,
            txid: tx.txid
          };
        }
        parents.push(parentTx);
        parents = parents.concat(this.findAllParents(parentTx, memPool));
      }
    });
    return parents;
  }
}
