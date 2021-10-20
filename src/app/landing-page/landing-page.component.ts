import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConstantsService } from '../constants.service';
import { ContractService, PoolInfo } from '../contract.service';
import { WalletService } from '../wallet.service';
import { HelpersService } from '../helpers.service';
import { DataService } from '../data.service';
import BigNumber from 'bignumber.js';
import { request, gql } from 'graphql-request';
import { ModalDepositComponent } from '../deposit/modal-deposit/modal-deposit.component';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css'],
})
export class LandingPageComponent implements OnInit {
  // header
  maxAPR: BigNumber;
  maxRewardAPR: BigNumber;

  // totals stats
  totalDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;
  totalEarningsUSD: BigNumber;

  // pools
  allPoolList: DPool[];
  bestPoolList: any;
  selectedPool: DPool;

  // calculator inputs
  initialDeposit: BigNumber;
  depositTokenBalance: BigNumber;
  termInDays: BigNumber;

  // calculator outputs
  fixedAPR: BigNumber;
  rewardAPR: BigNumber;
  interestEarned: BigNumber;
  interestEarnedUSD: BigNumber;
  mphReward: BigNumber;
  totalEarnedUSD: BigNumber;

  constructor(
    private modalService: NgbModal,
    public constants: ConstantsService,
    public contract: ContractService,
    public wallet: WalletService,
    public helpers: HelpersService,
    public datas: DataService,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(
      this.wallet.connected || this.wallet.watching,
      true,
      this.wallet.networkID
    );
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false, this.wallet.networkID);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(false, true, this.wallet.networkID);
    });

    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true, networkID);
      });
    });

    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false, this.wallet.networkID);
      });
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean, networkID: number) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const userAddress: string = this.wallet.actualAddress.toLowerCase();

    if (loadUser && userAddress) {
      const stablecoin = this.contract.getPoolStablecoin(
        this.selectedPool.name
      );
      const stablecoinPrecision = Math.pow(
        10,
        this.selectedPool.stablecoinDecimals
      );
      stablecoin.methods
        .balanceOf(userAddress)
        .call({}, (await readonlyWeb3.eth.getBlockNumber()) - 1)
        .then((balance) => {
          this.depositTokenBalance = new BigNumber(balance).div(
            stablecoinPrecision
          );
        });
    }

    if (loadGlobal) {
      const queryString = gql`
        {
          dpools {
            id
            address
            totalDeposit
            totalInterestOwed
            oneYearInterestRate
            poolDepositorRewardMintMultiplier
            historicalInterestPaid
          }
          globalStats(id: "0") {
            xMPHRewardDistributed
          }
        }
      `;
      request(
        this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
        queryString
      ).then((data: QueryResult) => this.handleData(data, networkID));
    }
  }

  async handleData(data: QueryResult, networkID: number) {
    // bail if a chain change has occured
    if (networkID !== this.wallet.networkID) {
      return;
    }

    const dpools = data.dpools;
    let stablecoinPriceCache = {};

    if (dpools) {
      let maxAPR = new BigNumber(0);
      let maxRewardAPR = new BigNumber(0);
      let totalDepositUSD = new BigNumber(0);
      let totalInterestUSD = new BigNumber(0);
      let allPoolList = new Array<DPool>(0);
      let bestPoolList = {};

      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(
              stablecoin,
              this.wallet.networkID
            );
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          // update all pool list
          const dpoolObj: DPool = {
            name: poolInfo.name,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            stablecoinDecimals: poolInfo.stablecoinDecimals,
            iconPath: poolInfo.iconPath,
            totalDepositToken: new BigNumber(pool.totalDeposit),
            totalDepositUSD: new BigNumber(pool.totalDeposit).times(
              stablecoinPrice
            ),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate),
            poolDepositorRewardMintMultiplier: new BigNumber(
              pool.poolDepositorRewardMintMultiplier
            ),
            maxAPR: await this.datas.getPoolMaxAPR(pool.address),
            mphAPR: await this.datas.getPoolRewardAPR(
              pool.address,
              new BigNumber(pool.poolDepositorRewardMintMultiplier)
            ),
          };
          allPoolList.push(dpoolObj);

          // update best pool list
          const bestPool = bestPoolList[dpoolObj.stablecoinSymbol];
          if (bestPool && dpoolObj.maxAPR.gt(bestPool.maxAPR)) {
            bestPoolList[dpoolObj.stablecoinSymbol] = dpoolObj;
          } else if (!bestPool) {
            bestPoolList[dpoolObj.stablecoinSymbol] = dpoolObj;
          }

          // update max APR
          if (dpoolObj.maxAPR.gt(maxAPR)) {
            maxAPR = dpoolObj.maxAPR;
          }

          // update max rewards APR
          if (dpoolObj.mphAPR.gt(maxRewardAPR)) {
            maxRewardAPR = dpoolObj.mphAPR;
          }

          // update protocol total stats
          totalDepositUSD = totalDepositUSD.plus(
            dpoolObj.totalDepositUSD.div(1e6)
          );
          totalInterestUSD = totalInterestUSD.plus(
            new BigNumber(pool.historicalInterestPaid)
              .plus(pool.totalInterestOwed)
              .times(stablecoinPrice)
          );
        })
      ).then(() => {
        allPoolList.sort((a, b) => {
          return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
        });
        this.maxAPR = maxAPR;
        this.maxRewardAPR = maxRewardAPR;
        this.totalDepositUSD = totalDepositUSD;
        this.totalInterestUSD = totalInterestUSD;
        this.allPoolList = allPoolList;
        this.bestPoolList = bestPoolList;
        this.selectedPool = this.bestPoolList['DAI'];
        this.updateAPY();
      });
    }
    this.totalEarningsUSD = new BigNumber(
      data.globalStats.xMPHRewardDistributed
    )
      .times(this.datas.mphPriceUSD)
      .div(1e6);
    if (this.totalEarningsUSD.isNaN()) {
      this.totalEarningsUSD = new BigNumber(0);
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.depositTokenBalance = new BigNumber(0);
    }

    if (resetGlobal) {
      this.totalDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalEarningsUSD = new BigNumber(0);

      const allPoolList = new Array<DPool>(0);
      const poolInfoList = this.contract.getPoolInfoList();
      for (const poolInfo of poolInfoList) {
        const dpoolObj: DPool = {
          name: poolInfo.name,
          protocol: poolInfo.protocol,
          stablecoin: poolInfo.stablecoin,
          stablecoinSymbol: poolInfo.stablecoinSymbol,
          stablecoinDecimals: poolInfo.stablecoinDecimals,
          iconPath: poolInfo.iconPath,
          totalDepositToken: new BigNumber(0),
          totalDepositUSD: new BigNumber(0),
          oneYearInterestRate: new BigNumber(0),
          poolDepositorRewardMintMultiplier: new BigNumber(0),
          maxAPR: new BigNumber(0),
          mphAPR: new BigNumber(0),
        };
        allPoolList.push(dpoolObj);
      }
      this.allPoolList = allPoolList;
      this.bestPoolList = {};
      this.selectedPool = allPoolList[0];
      this.initialDeposit = new BigNumber(10000);
      this.termInDays = new BigNumber(30);
      this.fixedAPR = new BigNumber(0);
      this.rewardAPR = new BigNumber(0);
      this.interestEarned = new BigNumber(0);
      this.interestEarnedUSD = new BigNumber(0);
      this.mphReward = new BigNumber(0);
      this.totalEarnedUSD = new BigNumber(0);
      this.maxAPR = new BigNumber(0);
      this.maxRewardAPR = new BigNumber(0);
    }
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.selectedPool.name, readonlyWeb3);
    const poolInfo = this.contract.getPoolInfo(this.selectedPool.name);

    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      poolInfo.stablecoin,
      this.wallet.networkID
    );
    const stablecoinPrecision = Math.pow(10, poolInfo.stablecoinDecimals);

    // get interest amount
    const depositAmount = this.helpers.processWeb3Number(
      this.initialDeposit.times(stablecoinPrecision)
    );
    const depositTime = this.helpers.processWeb3Number(
      this.termInDays.times(this.constants.DAY_IN_SEC)
    );
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmount, depositTime)
        .call()
    );
    const interestAmountToken = new BigNumber(
      await this.helpers.applyFeeToInterest(rawInterestAmountToken, poolInfo)
    );

    this.interestEarned = new BigNumber(interestAmountToken).div(
      stablecoinPrecision
    );
    this.interestEarnedUSD = new BigNumber(interestAmountToken)
      .div(stablecoinPrecision)
      .times(stablecoinPrice);

    // get fixed APR amount
    this.fixedAPR = interestAmountToken
      .div(depositAmount)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (this.fixedAPR.isNaN()) {
      this.fixedAPR = new BigNumber(0);
    }

    // get MPH reward amount
    this.mphReward = this.selectedPool.poolDepositorRewardMintMultiplier
      .times(depositAmount)
      .times(depositTime)
      .div(stablecoinPrecision);
    this.rewardAPR = this.selectedPool.mphAPR;

    // calculate total earned USD
    this.totalEarnedUSD = this.initialDeposit
      .times(stablecoinPrice)
      .plus(
        this.interestEarnedUSD.plus(
          this.mphReward.times(this.datas.mphPriceUSD)
        )
      );

    // load user token balance
    const userAddress: string = this.wallet.actualAddress.toLowerCase();
    if (userAddress) {
      const stablecoin = this.contract.getPoolStablecoin(
        this.selectedPool.name
      );
      this.depositTokenBalance = new BigNumber(
        await stablecoin.methods
          .balanceOf(userAddress)
          .call({}, (await readonlyWeb3.eth.getBlockNumber()) - 1)
      ).div(stablecoinPrecision);
    }
  }

  setDepositAmount(amount: string): void {
    this.initialDeposit = new BigNumber(amount);
    if (this.initialDeposit.isNaN()) {
      this.initialDeposit = new BigNumber(0);
    }
    this.updateAPY();
  }

  setTermLength(days: string): void {
    this.termInDays = new BigNumber(days);
    if (this.termInDays.isNaN()) {
      this.termInDays = new BigNumber(0);
    } else if (this.termInDays.gt(365)) {
      this.termInDays = new BigNumber(365);
    }
    this.updateAPY();
  }

  selectPool(stablecoinSymbol: string) {
    this.selectedPool = this.bestPoolList[stablecoinSymbol];
    this.updateAPY();
  }

  openDepositModal(poolName?: string) {
    const modalRef = this.modalService.open(ModalDepositComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.defaultPoolName = poolName;
    modalRef.componentInstance.inputDepositAmount = this.initialDeposit;
    modalRef.componentInstance.inputDepositLength = this.termInDays;
  }
}

interface QueryResult {
  dpools: {
    id: string;
    address: string;
    totalDeposit: number;
    totalInterestOwed: number;
    oneYearInterestRate: number;
    poolDepositorRewardMintMultiplier: number;
    historicalInterestPaid: number;
  }[];
  globalStats: {
    xMPHRewardDistributed: number;
  };
}

interface DPool {
  name: string;
  protocol: string;
  stablecoin: string;
  stablecoinSymbol: string;
  stablecoinDecimals: number;
  iconPath: string;
  totalDepositToken: BigNumber;
  totalDepositUSD: BigNumber;
  oneYearInterestRate: BigNumber;
  poolDepositorRewardMintMultiplier: BigNumber;
  maxAPR: BigNumber;
  mphAPR: BigNumber;
}
