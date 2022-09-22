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
    this.resetData(true, true, true);
  }

  ngOnInit(): void {
    this.loadData(
      this.wallet.connected || this.wallet.watching,
      true,
      true,
      this.wallet.networkID
    );
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false, false);
      this.loadData(true, false, false, this.wallet.networkID);
    });

    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false, false);
      this.loadData(false, false, false, this.wallet.networkID);
    });

    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true, false);
        this.loadData(true, true, false, networkID);
      });
    });

    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false, false);
        this.loadData(true, false, false, this.wallet.networkID);
      });
    });
  }

  async loadData(
    loadUser: boolean,
    loadGlobal: boolean,
    loadStats: boolean,
    networkID: number
  ) {
    const web3 = this.wallet.httpsWeb3();
    const userAddress: string = this.wallet.actualAddress.toLowerCase();

    if (loadUser && userAddress) {
      const stablecoin = this.contract.getPoolStablecoin(
        this.selectedPool.name,
        web3
      );
      const stablecoinPrecision = Math.pow(
        10,
        this.selectedPool.stablecoinDecimals
      );
      stablecoin.methods
        .balanceOf(userAddress)
        .call()
        .then((balance) => {
          this.depositTokenBalance = new BigNumber(balance).div(
            stablecoinPrecision
          );
        });
    }

    if (loadGlobal) {
      this.loadChainData(loadStats, this.constants.CHAIN_ID.MAINNET);
      this.loadChainData(loadStats, this.constants.CHAIN_ID.POLYGON);
      this.loadChainData(loadStats, this.constants.CHAIN_ID.AVALANCHE);
      this.loadChainData(loadStats, this.constants.CHAIN_ID.FANTOM);
      this.loadV2Data(loadStats);
    }
  }

  async loadChainData(loadStats: boolean, networkID: number) {
    let queryString = `{`;
    queryString += `dpools {
      id
      address
      totalDeposit
      totalInterestOwed
      oneYearInterestRate
      poolDepositorRewardMintMultiplier
      historicalInterestPaid
    }`;
    if (loadStats) {
      queryString += `xMPH(id: "${this.constants.XMPH_ADDRESS[
        networkID
      ].toLowerCase()}") {
        totalRewardDistributedUSD
      }`;
    }
    queryString += `}`;
    const query = gql`
      ${queryString}
    `;

    request(this.constants.GRAPHQL_ENDPOINT[networkID], query)
      .then((data: QueryResult) => this.handleData(data, loadStats, networkID))
      .catch((error) => this.loadChainData(false, networkID));
  }

  loadV2Data(loadStats: boolean) {
    if (!loadStats) return;

    const queryString = gql`
      {
        dpools {
          id
          address
          totalActiveDeposit
          totalInterestPaid
        }
        mph(id: "0") {
          totalHistoricalReward
        }
      }
    `;
    request(
      this.constants.GRAPHQL_ENDPOINT_V2[this.constants.CHAIN_ID.MAINNET],
      queryString
    ).then((data: QueryResultV2) => {
      const dpools = data.dpools;

      let totalDepositUSD = new BigNumber(0);
      let totalInterestUSD = new BigNumber(0);

      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(
            pool.address,
            this.constants.CHAIN_ID.MAINNET,
            true
          );
          const stablecoin = poolInfo.stablecoin.toLowerCase();
          const stablecoinPrice = await this.datas.getAssetPriceUSD(
            stablecoin,
            this.constants.CHAIN_ID.MAINNET
          );

          // update protocol total stats
          totalDepositUSD = totalDepositUSD.plus(
            new BigNumber(pool.totalActiveDeposit)
              .times(stablecoinPrice)
              .div(1e6)
          );
          totalInterestUSD = totalInterestUSD.plus(
            new BigNumber(pool.totalInterestPaid)
              .times(stablecoinPrice)
              .div(1e6)
          );
        })
      ).then(() => {
        this.totalDepositUSD = this.totalDepositUSD.plus(totalDepositUSD);
        this.totalInterestUSD = this.totalInterestUSD.plus(totalInterestUSD);
      });

      const totalEarningsUSD = new BigNumber(data.mph.totalHistoricalReward)
        .times(this.datas.daiPriceUSD)
        .div(1e6);
      if (!this.totalEarningsUSD.isNaN()) {
        this.totalEarningsUSD = this.totalEarningsUSD.plus(totalEarningsUSD);
      }
    });
  }

  async handleData(data: QueryResult, loadStats: boolean, networkID: number) {
    const dpools = data.dpools;

    if (dpools) {
      let maxAPR = new BigNumber(0);
      let maxRewardAPR = new BigNumber(0);
      let totalDepositUSD = new BigNumber(0);
      let totalInterestUSD = new BigNumber(0);
      let allPoolList = new Array<DPool>(0);
      let bestPoolList = {};

      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(
            pool.address,
            networkID
          );

          if (poolInfo.protocol === 'Cream') {
            return;
          }

          const stablecoin = poolInfo.stablecoin.toLowerCase();
          const stablecoinPrice = await this.datas.getAssetPriceUSD(
            stablecoin,
            networkID
          );

          if (networkID === this.wallet.networkID) {
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
              mphAPR: await this.datas.getPoolRewardAPR(pool.address),
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
          }

          // update protocol total stats
          totalDepositUSD = totalDepositUSD.plus(
            new BigNumber(pool.totalDeposit).times(stablecoinPrice).div(1e6)
          );
          totalInterestUSD = totalInterestUSD.plus(
            new BigNumber(pool.historicalInterestPaid)
              .plus(pool.totalInterestOwed)
              .times(stablecoinPrice)
              .div(1e6)
          );
        })
      ).then(() => {
        if (networkID === this.wallet.networkID) {
          allPoolList.sort((a, b) => {
            return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
          });
          this.maxAPR = maxAPR;
          this.maxRewardAPR = maxRewardAPR;
          this.allPoolList = allPoolList;
          this.bestPoolList = bestPoolList;
          switch (networkID) {
            case this.constants.CHAIN_ID.MAINNET:
              this.selectedPool = this.bestPoolList['WETH'];
              break;
            case this.constants.CHAIN_ID.POLYGON:
              this.selectedPool = this.bestPoolList['WMATIC'];
              break;
            case this.constants.CHAIN_ID.AVALANCHE:
              this.selectedPool = this.bestPoolList['WAVAX'];
              break;
            case this.constants.CHAIN_ID.FANTOM:
              this.selectedPool = this.bestPoolList['WFTM'];
              break;
          }
          this.updateAPY();
        }

        if (loadStats) {
          this.totalDepositUSD = this.totalDepositUSD.plus(totalDepositUSD);
          this.totalInterestUSD = this.totalInterestUSD.plus(totalInterestUSD);
        }
      });
    }

    if (loadStats) {
      const reward = new BigNumber(data.xMPH.totalRewardDistributedUSD);
      if (!this.totalEarningsUSD.isNaN()) {
        this.totalEarningsUSD = this.totalEarningsUSD.plus(reward);
      }
    }
  }

  resetData(
    resetUser: boolean,
    resetGlobal: boolean,
    resetStats: boolean
  ): void {
    if (resetUser) {
      this.depositTokenBalance = new BigNumber(0);
    }

    if (resetGlobal) {
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

    if (resetStats) {
      this.totalDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalEarningsUSD = new BigNumber(0);
    }
  }

  async updateAPY() {
    const web3 = this.wallet.httpsWeb3();
    const pool = this.contract.getPool(this.selectedPool.name, web3);
    const poolInfo = this.contract.getPoolInfo(this.selectedPool.name);

    const stablecoinPrice = await this.datas.getAssetPriceUSD(
      this.selectedPool.stablecoin,
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
        await stablecoin.methods.balanceOf(userAddress).call()
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
  xMPH: {
    totalRewardDistributedUSD: number;
  };
}

interface QueryResultV2 {
  dpools: {
    id: string;
    address: string;
    totalActiveDeposit: string;
    totalInterestPaid: string;
  }[];
  mph: {
    totalHistoricalReward: string;
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
