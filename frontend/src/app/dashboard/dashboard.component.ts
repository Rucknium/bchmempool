import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { combineLatest, merge, Observable, of, timer } from 'rxjs';
import { filter, map, scan, share, switchMap, tap } from 'rxjs/operators';
import { Block } from '../interfaces/electrs.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { MempoolInfo, TransactionStripped } from '../interfaces/websocket.interface';
import { ApiService } from '../services/api.service';
import { StateService } from '../services/state.service';
import * as Chartist from '@mempool/chartist';
import { formatDate } from '@angular/common';
import { WebsocketService } from '../services/websocket.service';
import { SeoService } from '../services/seo.service';
import { StorageService } from '../services/storage.service';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface EpochProgress {
  base: string;
  change: number;
  progress: string;
  remainingBlocks: number;
  newDifficultyHeight: number;
  colorAdjustments: string;
  colorPreviousAdjustments: string;
  timeAvg: string;
  remainingTime: number;
  previousRetarget: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressClass: string;
}

interface MempoolStatsData {
  mempool: OptimizedMempoolStats[];
  weightPerSecond: any;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  collapseLevel: string;
  network$: Observable<string>;
  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  difficultyEpoch$: Observable<EpochProgress>;
  mempoolLoadingStatus$: Observable<number>;
  BytesPerSecondLimit = 53333;
  blocks$: Observable<Block[]>;
  transactions$: Observable<TransactionStripped[]>;
  latestBlockHeight: number;
  mempoolTransactionsWeightPerSecondData: any;
  mempoolStats$: Observable<MempoolStatsData>;
  transactionsWeightPerSecondOptions: any;
  isLoadingWebSocket$: Observable<boolean>;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    public stateService: StateService,
    private apiService: ApiService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private storageService: StorageService,
  ) { }

  ngOnInit(): void {

    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.seoService.resetTitle();
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks', 'live-2h-chart']);
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.collapseLevel = this.storageService.getValue('dashboard-collapsed') || 'one';
    this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$.pipe(
      map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
    );

    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ])
    .pipe(
      map(([mempoolInfo, vbytesPerSecond]) => {
        const percent = Math.round((Math.min(vbytesPerSecond, this.BytesPerSecondLimit) / this.BytesPerSecondLimit) * 100);

        let progressClass = 'bg-danger';
        if (percent <= 75) {
          progressClass = 'bg-success';
        } else if (percent <= 99) {
          progressClass = 'bg-warning';
        }

        const mempoolSizePercentage = (mempoolInfo.usage / mempoolInfo.maxmempool * 100);
        let mempoolSizeProgress = 'bg-danger';
        if (mempoolSizePercentage <= 50) {
          mempoolSizeProgress = 'bg-success';
        } else if (mempoolSizePercentage <= 75) {
          mempoolSizeProgress = 'bg-warning';
        }

        return {
          memPoolInfo: mempoolInfo,
          vBytesPerSecond: vbytesPerSecond,
          progressWidth: percent + '%',
          progressClass: progressClass,
          mempoolSizeProgress: mempoolSizeProgress,
        };
      })
    );

    this.difficultyEpoch$ = timer(0, 1000)
      .pipe(
        switchMap(() => combineLatest([
          this.stateService.blocks$.pipe(map(([block]) => block)),
          this.stateService.lastDifficultyAdjustment$,
          this.stateService.previousRetarget$
        ])),
        map(([block, DATime, previousRetarget]) => {
          const now = new Date().getTime() / 1000;
          const diff = now - DATime;
          const blocksInEpoch = block.height % 2016;
          const progress = (blocksInEpoch >= 0) ? (blocksInEpoch / 2016 * 100).toFixed(2) : `100`;
          const remainingBlocks = 2016 - blocksInEpoch;
          const newDifficultyHeight = block.height + remainingBlocks;

          let change = 0;
          if (blocksInEpoch > 0) {
            change = (600 / (diff / blocksInEpoch ) - 1) * 100;
          }
          if (change > 300) {
            change = 300;
          }
          if (change < -75) {
            change = -75;
          }

          const timeAvgDiff = change * 0.1;

          let timeAvgMins = 10;
          if (timeAvgDiff > 0) {
            timeAvgMins -= Math.abs(timeAvgDiff);
          } else {
            timeAvgMins += Math.abs(timeAvgDiff);
          }

          const timeAvg = timeAvgMins.toFixed(0);
          const remainingTime = (remainingBlocks * timeAvgMins * 60 * 1000) + (now * 1000);

          let colorAdjustments = '#ffffff66';
          if (change > 0) {
            colorAdjustments = '#3bcc49';
          }
          if (change < 0) {
            colorAdjustments = '#dc3545';
          }

          let colorPreviousAdjustments = '#dc3545';
          if (previousRetarget){
            if (previousRetarget >= 0) {
              colorPreviousAdjustments = '#3bcc49';
            }
            if (previousRetarget === 0) {
              colorPreviousAdjustments = '#ffffff66';
            }
          } else {
            colorPreviousAdjustments = '#ffffff66';
          }

          return {
            base: `${progress}%`,
            change,
            progress,
            remainingBlocks,
            timeAvg,
            colorAdjustments,
            colorPreviousAdjustments,
            blocksInEpoch,
            newDifficultyHeight,
            remainingTime,
            previousRetarget,
          };
        })
      );


    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / this.stateService.blockVSize)
          };
        })
      );

    this.blocks$ = this.stateService.blocks$
      .pipe(
        tap(([block]) => {
          this.latestBlockHeight = block.height;
        }),
        scan((acc, [block]) => {
          acc.unshift(block);
          acc = acc.slice(0, 6);
          return acc;
        }, []),
      );

    this.transactions$ = this.stateService.transactions$
      .pipe(
        scan((acc, tx) => {
          acc.unshift(tx);
          acc = acc.slice(0, 6);
          return acc;
        }, []),
      );

    this.mempoolStats$ = this.stateService.connectionState$.pipe(
      filter((state) => state === 2),
      switchMap(() => this.apiService.list2HStatistics$()),
      switchMap((mempoolStats) => {
        return merge(
          this.stateService.live2Chart$
            .pipe(
              scan((acc, stats) => {
                acc.unshift(stats);
                acc = acc.slice(0, 120);
                return acc;
              }, mempoolStats)
            ),
          of(mempoolStats)
        );
      }),
      map((mempoolStats) => {
        return {
          mempool: mempoolStats,
          weightPerSecond: this.handleNewMempoolData(mempoolStats.concat([])),
        };
      }),
      share(),
    );

    this.transactionsWeightPerSecondOptions = {
        showArea: false,
        showLine: true,
        fullWidth: true,
        showPoint: false,
        low: 0,
        axisY: {
          offset: 40
        },
        axisX: {
          labelInterpolationFnc: (value: any, index: any) => index % 24 === 0 ? formatDate(value, 'HH:mm', this.locale) : null,
          offset: 20
        },
        plugins: [
          Chartist.plugins.ctTargetLine({
            value: 1667
          }),
        ]
      };
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    return {
      labels: labels,
      series: [mempoolStats.map((stats) => stats.vbytes_per_second)],
    };
  }

  trackByBlock(index: number, block: Block) {
    return block.height;
  }

  toggleCollapsed() {
    if (this.collapseLevel === 'one') {
      this.collapseLevel = 'two';
    } else if (this.collapseLevel === 'two') {
      this.collapseLevel = 'three';
    } else {
      this.collapseLevel = 'one';
    }
    this.storageService.setValue('dashboard-collapsed', this.collapseLevel);
  }
}
