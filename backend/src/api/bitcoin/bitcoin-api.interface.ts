export namespace IBitcoinApi {
  export interface MempoolInfo {
    loaded: boolean;                 //  (boolean) True if the mempool is fully loaded
    size: number;                    //  (numeric) Current tx count
    bytes: number;                   //  (numeric) Sum of all virtual transaction sizes as defined in BIP 141.
    usage: number;                   //  (numeric) Total memory usage for the mempool
    maxmempool: number;              //  (numeric) Maximum memory usage for the mempool
    mempoolminfee: number;           //  (numeric) Minimum fee rate in BCH/kB for tx to be accepted.
    minrelaytxfee: number;           //  (numeric) Current minimum relay fee for transactions
  }

  export interface RawMempool { [txId: string]: MempoolEntry; }

  export interface MempoolEntry {
    size: number;                    //  (numeric) transaction size in bytes
    fee: number;                     //  (numeric) transaction fee in BCH
    modifiedfee: number;             // (numeric) transaction fee with fee deltas used for mining priority
    time: number;                    //  (numeric) local time transaction entered pool in seconds since 1 Jan 1970 GMT
    height: number;                  //  (numeric) block height when transaction entered pool
    startingpriority: number;        //  (numeric) priority when transaction entered pool
    currentpriority: number;         //  (numeric) transaction priority now
    ancestorcount: number;           //  (numeric) size of in-mempool ancestors (including this one)
    ancestorsize: number;            //  (numeric) virtual transaction size of in-mempool ancestors (including this one)
    ancestorfees: string;            //  (numeric) modified fees (see above) of in-mempool ancestors (including this one)
    depends: string[];               //  (string) parent transaction id
    spentby: string[];               //  (array) unconfirmed transactions spending outputs from this transaction
  }

  export interface Block {
    hash: string;                    //  (string) the block hash (same as provided)
    confirmations: number;           //  (numeric) The number of confirmations, or -1 if the block is not on the main chain
    size: number;                    //  (numeric) The block size
    strippedsize: number;            //  (numeric) The block size excluding witness data
    weight: number;                  //  (numeric) The block weight as defined in BIP 141
    height: number;                  //  (numeric) The block height or index
    version: number;                 //  (numeric) The block version
    versionHex: string;              //  (string) The block version formatted in hexadecimal
    merkleroot: string;              //  (string) The merkle root
    tx: Transaction[];
    time: number;                    //  (numeric) The block time expressed in UNIX epoch time
    mediantime: number;              //  (numeric) The median block time expressed in UNIX epoch time
    nonce: number;                   //  (numeric) The nonce
    bits: string;                    //  (string) The bits
    difficulty: number;              //  (numeric) The difficulty
    chainwork: string;               //  (string) Expected number of hashes required to produce the chain up to this block (in hex)
    nTx: number;                     //  (numeric) The number of transactions in the block
    previousblockhash: string;       //  (string) The hash of the previous block
    nextblockhash: string;           //  (string) The hash of the next block
  }

  export interface Transaction {
    in_active_chain: boolean;        //  (boolean) Whether specified block is in the active chain or not
    hex: string;                     //  (string) The serialized, hex-encoded data for 'txid'
    txid: string;                    //  (string) The transaction id (same as provided)
    hash: string;                    //  (string) The transaction hash (differs from txid for witness transactions)
    size: number;                    //  (numeric) The serialized transaction size
    version: number;                 //  (numeric) The version
    locktime: number;                //  (numeric) The lock time
    vin: Vin[];
    vout: Vout[];
    blockhash: string;               //  (string) the block hash
    confirmations: number;           //  (numeric) The confirmations
    blocktime: number;               //  (numeric) The block time expressed in UNIX epoch time
    time: number;                    //  (numeric) Same as blocktime
  }

  interface Vin {
    txid?: string;                   //  (string) The transaction id
    vout?: number;                   //  (string)
    scriptSig?: {                    //  (json object) The script
      asm: string;                   //  (string) asm
      hex: string;                   //  (string) hex
    };
    sequence: number;                //  (numeric) The script sequence number
    txinwitness?: string[];          //  (string) hex-encoded witness data
    coinbase?: string;
  }

  interface Vout {
    value: number;                   //  (numeric) The value in BCH
    n: number;                       //  (numeric) index
    scriptPubKey: {                  //  (json object)
      asm: string;                   //  (string) the asm
      hex: string;                   //  (string) the hex
      reqSigs: number;               //  (numeric) The required sigs
      type: string;                  //  (string) The type, eg 'pubkeyhash'
      addresses: string[]            //  (string) bitcoin address
    };
  }

  export interface AddressInformation {
    isvalid: boolean;                //  (boolean) If the address is valid or not. If not, this is the only property returned.
    isvalid_parent?: boolean;        //  (boolean) Elements only
    address: string;                 //  (string) The bitcoin address validated
    scriptPubKey: string;            //  (string) The hex-encoded scriptPubKey generated by the address
    isscript: boolean;               //  (boolean) If the key is a script
    confidential_key?: string;       //  (string) Elements only
    unconfidential?: string;         //  (string) Elements only
  }

  export interface ChainTips {
    height: number;                  //  (numeric) height of the chain tip
    hash: string;                    //  (string) block hash of the tip
    branchlen: number;               //  (numeric) zero for main chain, otherwise length of branch connecting the tip to the main chain
    status: 'invalid' | 'headers-only' | 'valid-headers' | 'valid-fork' | 'active';
  }

  export interface BlockchainInfo {
    chain: number;                   // (string) current network name as defined in BIP70 (main, test, regtest)
    blocks: number;                  // (numeric) the current number of blocks processed in the server
    headers: number;                 // (numeric) the current number of headers we have validated
    bestblockhash: string,           // (string) the hash of the currently best block
    difficulty: number;              // (numeric) the current difficulty
    mediantime: number;              // (numeric) median time for the current best block
    verificationprogress: number;    // (numeric) estimate of verification progress [0..1]
    initialblockdownload: boolean;   // (bool) (debug information) estimate of whether this node is in Initial Block Download mode.
    chainwork: string                // (string) total amount of work in active chain, in hexadecimal
    size_on_disk: number;            // (numeric) the estimated size of the block and undo files on disk
    pruned: number;                  // (boolean) if the blocks are subject to pruning
    pruneheight: number;             // (numeric) lowest-height complete block stored (only present if pruning is enabled)
    automatic_pruning: number;       // (boolean) whether automatic pruning is enabled (only present if pruning is enabled)
    prune_target_size: number;       // (numeric) the target size used by pruning (only present if automatic pruning is enabled)
    softforks: SoftFork[];           // (array) status of softforks in progress
    bip9_softforks: { [name: string]: Bip9SoftForks[] } // (object) status of BIP9 softforks in progress
    warnings: string;                // (string) any network and blockchain warnings.
  }

  interface SoftFork {
    id: string;                      // (string) name of softfork
    version: number;                 // (numeric) block version
    reject: {                        // (object) progress toward rejecting pre-softfork blocks
      status: boolean;               // (boolean) true if threshold reached
    },
  }
  interface Bip9SoftForks {
    status: number;                  // (string) one of defined, started, locked_in, active, failed
    bit: number;                     // (numeric) the bit (0-28) in the block version field used to signal this softfork (only for started status)
    startTime: number;               // (numeric) the minimum median time past of a block at which the bit gains its meaning
    timeout: number;                 // (numeric) the median time past of a block at which the deployment is considered failed if not yet locked in
    since: number;                   // (numeric) height of the first block to which the status applies
    statistics: {                    // (object) numeric statistics about BIP9 signalling for a softfork (only for started status)
      period: number;                // (numeric) the length in blocks of the BIP9 signalling period 
      threshold: number;             // (numeric) the number of blocks with the version bit set required to activate the feature 
      elapsed: number;               // (numeric) the number of blocks elapsed since the beginning of the current period 
      count: number;                 // (numeric) the number of blocks with the version bit set in the current period 
      possible: boolean;             // (boolean) returns false if there are not enough blocks left in this period to pass activation threshold 
    }
  }

}
