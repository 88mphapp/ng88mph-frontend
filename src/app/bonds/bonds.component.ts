import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { request, gql } from 'graphql-request';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService, PoolInfo } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import { ModalBuyYieldTokenComponent } from './modal-buy-yield-token/modal-buy-yield-token.component';
import {
  FunderPool,
  Funding,
  FundedDeposit,
  FundableDeposit,
  DPool,
} from './interface';
import { ModalWithdrawYieldTokenInterestComponent } from './modal-withdraw-yield-token-interest/modal-withdraw-yield-token-interest.component';

@Component({
  selector: 'app-bonds',
  templateUrl: './bonds.component.html',
  styleUrls: ['./bonds.component.css'],
})
export class BondsComponent implements OnInit {
  funderPools: FunderPool[];
  totalYieldTokenBalanceUSD: BigNumber;
  totalDepositEarningYield: BigNumber;
  totalYieldEarnedUSD: BigNumber;
  totalMPHEarned: BigNumber;

  allPoolList: DPool[];
  fundableDeposits: FundableDeposit[];
  loadingCalculator: boolean;
  floatingRatePrediction: BigNumber;
  mphPriceUSD: BigNumber;
  selectedPool: DPool;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private zone: NgZone
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false);
      });
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      setTimeout(() => {
        this.resetData(true, true);
        this.loadData(true, true);
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  loadData(loadUser: boolean, loadGlobal: boolean): void {
    let funderID = this.wallet.actualAddress.toLowerCase();
    const queryString = gql`
      {
        ${
          loadUser
            ? `funder(id: "${funderID}") {
          address
          fundings (
            where: {
              active: true
              principalPerToken_gt: "${this.constants.DUST_THRESHOLD}"
             }
          ) {
            nftID
            totalSupply
            principalPerToken
            totalRefundEarned
            pool {
              address
              poolFunderRewardMultiplier
            }
            deposit {
              maturationTimestamp
              interestRate
              feeRate
            }
          }
        }`
            : ''
        }
        ${
          loadGlobal
            ? `dpools {
          id
          address
          oneYearInterestRate
          oracleInterestRate
          poolFunderRewardMultiplier
        }`
            : ''
        }
      }
    `;

    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => this.handleData(data));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  async handleData(data: QueryResult) {
    const funder = data.funder;
    const dpools = data.dpools;
    let stablecoinPriceCache = {};
    const now = Math.floor(Date.now() / 1e3);

    if (funder) {
      const funderPools: FunderPool[] = [];
      let totalYieldTokenBalanceUSD = new BigNumber(0);
      let totalDepositEarningYield = new BigNumber(0);
      let totalYieldEarnedUSD = new BigNumber(0);
      let totalMPHEarned = new BigNumber(0);

      Promise.all(
        funder.fundings.map(async (funding) => {
          const lens = this.contract.getNamedContract('DInterestLens');
          const poolInfo = this.contract.getPoolInfoFromAddress(
            funding.pool.address
          );
          const poolContract = this.contract.getContract(
            funding.pool.address,
            'DInterest'
          );
          const poolFunderRewardMultiplier = new BigNumber(
            funding.pool.poolFunderRewardMultiplier
          );

          // get stablecoin price in USD
          const stablecoin = poolInfo.stablecoin.toLowerCase();
          const stablecoinPrecision = Math.pow(10, poolInfo.stablecoinDecimals);
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          let yieldToken;
          await poolContract.methods
            .fundingMultitoken()
            .call()
            .then((yieldTokenAddress) => {
              yieldToken = this.contract.getContract(
                yieldTokenAddress,
                'FundingMultitoken'
              );
            });

          const yieldTokenBalance = new BigNumber(
            await yieldToken.methods
              .balanceOf(funder.address, funding.nftID)
              .call()
          ).div(stablecoinPrecision);

          const yieldTokenPercentage = yieldTokenBalance.div(
            funding.totalSupply
          );
          const maturity = new BigNumber(funding.deposit.maturationTimestamp);

          // calculate amount of deposit earning yield
          const earnYieldOn = yieldTokenBalance.times(
            funding.principalPerToken
          );

          // calculate USD value of yield tokens
          const interestRate = new BigNumber(funding.deposit.interestRate);
          const feeRate = new BigNumber(funding.deposit.feeRate);
          const fundedDepositAmount = earnYieldOn.div(
            interestRate.plus(feeRate).plus(1)
          );
          const yieldTokenBalanceUSD = earnYieldOn
            .minus(fundedDepositAmount)
            .times(stablecoinPrice);

          // calculate amount of yield earned
          let yieldEarned = new BigNumber(0);

          // some will have been accrued, which is equally split among yield token holders
          let funderAccruedInterest;
          await lens.methods
            .accruedInterestOfFunding(funding.pool.address, funding.nftID)
            .call()
            .then((result) => {
              const fundingTotalAccruedInterest = new BigNumber(result).div(
                stablecoinPrecision
              );
              funderAccruedInterest =
                fundingTotalAccruedInterest.times(yieldTokenPercentage);
              yieldEarned = yieldEarned.plus(funderAccruedInterest);
            });

          // some will have been paid out already
          // @dev this value will potentially include the refund amount
          await yieldToken.methods
            .accumulativeDividendOf(funding.nftID, stablecoin, funder.address)
            .call()
            .then((result) => {
              const funderDistributedInterest = new BigNumber(result).div(
                stablecoinPrecision
              );
              yieldEarned = yieldEarned.plus(funderDistributedInterest);
            });

          // calculate the amount that has been refunded
          // @dev this is an extremely rough implementation. update the subgraph to track refunds for specific users to get a more accurate estimation
          let refundedAmount = new BigNumber(0);
          refundedAmount = refundedAmount.plus(
            new BigNumber(funding.totalRefundEarned).times(yieldTokenPercentage)
          );
          yieldEarned = yieldEarned.minus(refundedAmount);

          // calculate the amount of mph earned
          // @dev this only accounts for already distributed MPH, does not estimate MPH rewards based on interest earned to date
          let mphEarned = new BigNumber(0);
          await yieldToken.methods
            .accumulativeDividendOf(
              funding.nftID,
              this.constants.MPH_ADDRESS[this.wallet.networkID],
              funder.address
            )
            .call()
            .then((result) => {
              const funderDistributedMPH = new BigNumber(result).div(
                this.constants.PRECISION
              );
              mphEarned = mphEarned.plus(funderDistributedMPH);
            });

          let pool: FunderPool = funderPools.find(
            (pool) =>
              pool.poolInfo.address.toLowerCase() ===
              funding.pool.address.toLowerCase()
          );

          // if no funderPool exists, create one
          if (pool === undefined) {
            const funderPool: FunderPool = {
              poolInfo: poolInfo,
              fundings: [],
              userTotalYieldTokenBalance: new BigNumber(0),
              userTotalYieldTokenBalanceUSD: new BigNumber(0),
              userTotalEarnYieldOn: new BigNumber(0),
              userTotalEarnYieldOnUSD: new BigNumber(0),
              userTotalYieldEarned: new BigNumber(0),
              userTotalYieldEarnedUSD: new BigNumber(0),
              userTotalRefundedAmount: new BigNumber(0),
              userTotalRefundedAmountUSD: new BigNumber(0),
              userTotalMPHRewardsEarned: new BigNumber(0),
              userTotalMPHRewardsEarnedUSD: new BigNumber(0),
            };
            funderPools.push(funderPool);
            pool = funderPool;
          }

          // add the funding to the funderPool
          const fundingObj: FundedDeposit = {
            yieldToken: yieldToken,
            fundingID: +funding.nftID,
            stablecoinPrice: stablecoinPrice,
            funderAccruedInterest: funderAccruedInterest,
            maturationTimestamp: +funding.deposit.maturationTimestamp,
            yieldTokenBalance: yieldTokenBalance,
            yieldTokenBalanceUSD: yieldTokenBalanceUSD,
            earnYieldOn: earnYieldOn,
            earnYieldOnUSD: earnYieldOn.times(stablecoinPrice),
            yieldEarned: yieldEarned,
            yieldEarnedUSD: yieldEarned.times(stablecoinPrice),
            refundedAmount: refundedAmount,
            refundedAmountUSD: refundedAmount.times(stablecoinPrice),
            mphRewardsEarned: mphEarned,
            mphRewardsEarnedUSD: mphEarned.times(this.mphPriceUSD),
          };
          pool.fundings.push(fundingObj);

          // sort active positions by maturation timestamp
          pool.fundings.sort((a, b) => {
            return a.maturationTimestamp - b.maturationTimestamp;
          });

          // update user pool totals
          pool.userTotalYieldTokenBalance =
            pool.userTotalYieldTokenBalance.plus(yieldTokenBalance);
          pool.userTotalYieldTokenBalanceUSD =
            pool.userTotalYieldTokenBalanceUSD.plus(yieldTokenBalanceUSD);
          pool.userTotalEarnYieldOn =
            pool.userTotalEarnYieldOn.plus(earnYieldOn);
          pool.userTotalEarnYieldOnUSD = pool.userTotalEarnYieldOnUSD.plus(
            earnYieldOn.times(stablecoinPrice)
          );
          pool.userTotalYieldEarned =
            pool.userTotalYieldEarned.plus(yieldEarned);
          pool.userTotalYieldEarnedUSD = pool.userTotalYieldEarnedUSD.plus(
            yieldEarned.times(stablecoinPrice)
          );
          pool.userTotalRefundedAmount =
            pool.userTotalRefundedAmount.plus(refundedAmount);
          pool.userTotalRefundedAmountUSD =
            pool.userTotalRefundedAmountUSD.plus(
              refundedAmount.times(stablecoinPrice)
            );
          pool.userTotalMPHRewardsEarned =
            pool.userTotalMPHRewardsEarned.plus(mphEarned);
          pool.userTotalMPHRewardsEarnedUSD =
            pool.userTotalMPHRewardsEarnedUSD.plus(
              mphEarned.times(this.mphPriceUSD)
            );

          // update user totals
          totalYieldTokenBalanceUSD =
            totalYieldTokenBalanceUSD.plus(yieldTokenBalanceUSD);
          totalDepositEarningYield = totalDepositEarningYield.plus(
            earnYieldOn.times(stablecoinPrice)
          );
          totalYieldEarnedUSD = totalYieldEarnedUSD.plus(
            yieldEarned.times(stablecoinPrice)
          );
          totalMPHEarned = totalMPHEarned.plus(mphEarned);
        })
      ).then(() => {
        this.funderPools = funderPools;
        this.totalYieldTokenBalanceUSD = totalYieldTokenBalanceUSD;
        this.totalDepositEarningYield = totalDepositEarningYield;
        this.totalYieldEarnedUSD = totalYieldEarnedUSD;
        this.totalMPHEarned = totalMPHEarned;
      });
    }

    if (dpools) {
      const allPoolList = new Array<DPool>(0);
      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);

          if (!poolInfo) {
            return;
          }

          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(stablecoin);
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          const dpoolObj: DPool = {
            name: poolInfo.name,
            address: poolInfo.address,
            protocol: poolInfo.protocol,
            stablecoin: poolInfo.stablecoin,
            stablecoinSymbol: poolInfo.stablecoinSymbol,
            stablecoinDecimals: poolInfo.stablecoinDecimals,
            iconPath: poolInfo.iconPath,
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(
              100
            ),
            oracleInterestRate: new BigNumber(pool.oracleInterestRate),
            poolFunderRewardMultiplier: new BigNumber(
              pool.poolFunderRewardMultiplier
            ),
          };
          allPoolList.push(dpoolObj);
        })
      ).then(() => {
        allPoolList.sort((a, b) => {
          const aName = a.name;
          const bName = b.name;
          if (aName > bName) {
            return 1;
          }
          if (aName < bName) {
            return -1;
          }
          return 0;
        });
        this.allPoolList = allPoolList;
        this.selectPool(0);
      });
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.funderPools = [];
      this.totalYieldTokenBalanceUSD = new BigNumber(0);
      this.totalDepositEarningYield = new BigNumber(0);
      this.totalYieldEarnedUSD = new BigNumber(0);
      this.totalMPHEarned = new BigNumber(0);
    }

    if (resetGlobal) {
      this.allPoolList = [];
      this.fundableDeposits = [];
      this.loadingCalculator = true;
      this.floatingRatePrediction = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
    }
  }

  async selectPool(poolIdx: number) {
    this.selectedPool = this.allPoolList[poolIdx];

    const poolID = this.selectedPool.address;
    const now = Math.floor(Date.now() / 1e3);

    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      this.selectedPool.stablecoin
    );

    const queryString = gql`
      {
        dpools(
          where: {
            id_in: ["${poolID}", "${poolID.toLowerCase()}"]
          }
        ) {
          id
          poolFunderRewardMultiplier
          moneyMarketIncomeIndex
          deposits(
            where: {
              amount_gt: "${this.constants.DUST_THRESHOLD}",
              maturationTimestamp_gt: "${now}"
            }
          ) {
            id
            nftID
            amount
            virtualTokenTotalSupply
            interestRate
            feeRate
            maturationTimestamp
            funding {
              id
              active
              fundedDeficitAmount
              totalSupply
              principalPerToken
            }
            averageRecordedIncomeIndex
          }
        }
      }
    `;
    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then(async (data: FundableDepositsQuery) => {
      const fundableDeposits = [];
      const pool = this.contract.getPool(this.selectedPool.name);

      for (const deposit of data.dpools[0].deposits) {
        const virtualTokenTotalSupply = new BigNumber(
          deposit.virtualTokenTotalSupply
        );
        const interestRate = new BigNumber(deposit.interestRate);
        const feeRate = new BigNumber(deposit.feeRate);

        const totalPrincipal = virtualTokenTotalSupply
          .div(interestRate.plus(1))
          .times(interestRate.plus(feeRate).plus(1));

        const depositAmount = new BigNumber(deposit.amount);

        // compute fundable deposit fund amount upper bound
        let bound: BigNumber;
        let unfundedDepositAmount: BigNumber;
        const stablecoinPrecision = Math.pow(
          10,
          this.selectedPool.stablecoinDecimals
        );
        if (deposit.funding) {
          const supply = deposit.funding.totalSupply;
          const principalPerToken = deposit.funding.principalPerToken;
          const unfundedPrincipalAmount = totalPrincipal.minus(
            supply * principalPerToken
          );
          unfundedDepositAmount = unfundedPrincipalAmount
            .div(totalPrincipal)
            .times(deposit.amount);
          if (unfundedDepositAmount.lt(this.constants.DUST_THRESHOLD)) {
            unfundedDepositAmount = new BigNumber(0);
          }
          bound = new BigNumber(
            await pool.methods
              .calculateInterestAmount(
                this.helpers.processWeb3Number(
                  unfundedDepositAmount.times(stablecoinPrecision)
                ),
                this.helpers.processWeb3Number(
                  +deposit.maturationTimestamp - now
                )
              )
              .call()
          ).div(stablecoinPrecision);
        } else {
          bound = new BigNumber(
            await pool.methods
              .calculateInterestAmount(
                this.helpers.processWeb3Number(
                  new BigNumber(deposit.amount).times(stablecoinPrecision)
                ),
                this.helpers.processWeb3Number(
                  +deposit.maturationTimestamp - now
                )
              )
              .call()
          ).div(stablecoinPrecision);
        }

        // deposit hasn't been funded yet
        // @dev yield tokens available will equal the total principal of the deposit
        if (
          deposit.funding === null &&
          bound.gt(this.constants.DUST_THRESHOLD)
        ) {
          const parsedDeposit: FundableDeposit = {
            id: deposit.id,
            pool: this.selectedPool,
            maturationTimestamp: +deposit.maturationTimestamp,
            unfundedDepositAmount: depositAmount,
            unfundedDepositAmountUSD: depositAmount.times(stablecoinPrice),
            yieldTokensAvailable: totalPrincipal,
            yieldTokensAvailableUSD: bound.times(stablecoinPrice),
            estimatedAPR: new BigNumber(0),
            mphRewardsAPR: new BigNumber(0),
          };
          fundableDeposits.push(parsedDeposit);
        }
        // deposit has been partially funded
        else if (bound.gt(this.constants.DUST_THRESHOLD)) {
          const supply = deposit.funding.totalSupply;
          const principalPerToken = deposit.funding.principalPerToken;
          const unfundedPrincipalAmount = totalPrincipal.minus(
            supply * principalPerToken
          );
          const yieldTokensAvailable =
            unfundedPrincipalAmount.div(principalPerToken);

          const parsedDeposit: FundableDeposit = {
            id: deposit.id,
            pool: this.selectedPool,
            maturationTimestamp: +deposit.maturationTimestamp,
            unfundedDepositAmount: unfundedDepositAmount,
            unfundedDepositAmountUSD:
              unfundedDepositAmount.times(stablecoinPrice),
            yieldTokensAvailable: yieldTokensAvailable,
            yieldTokensAvailableUSD: bound.times(stablecoinPrice),
            estimatedAPR: new BigNumber(0),
            mphRewardsAPR: new BigNumber(0),
          };
          fundableDeposits.push(parsedDeposit);
        }
      }
      // sort deposits by maturation timestamp
      fundableDeposits.sort((a, b) => {
        return a.maturationTimestamp - b.maturationTimestamp;
      });

      this.fundableDeposits = fundableDeposits;
      this.floatingRatePrediction = this.helpers
        .parseInterestRate(
          this.selectedPool.oracleInterestRate,
          this.constants.YEAR_IN_SEC
        )
        .times(100);
      this.updateEstimatedROI();
    });
  }

  updateFloatingRatePrediction(newPrediction: number) {
    this.floatingRatePrediction = new BigNumber(newPrediction);
    this.updateEstimatedROI();
  }

  async updateEstimatedROI() {
    const estimatedFloatingRate = this.floatingRatePrediction.div(100);
    const mphFunderRewardMultiplier = new BigNumber(
      this.selectedPool.poolFunderRewardMultiplier
    );
    const now = Date.now() / 1e3;

    for (const deposit of this.fundableDeposits) {
      // calculate APR
      const debtToFund = deposit.yieldTokensAvailableUSD;
      const estimatedInterest = deposit.unfundedDepositAmountUSD
        .times(estimatedFloatingRate)
        .times(deposit.maturationTimestamp - now)
        .div(this.constants.YEAR_IN_SEC);
      const estimatedProfit = estimatedInterest.minus(debtToFund);
      const estimatedAPR = estimatedProfit.div(debtToFund).times(100);
      deposit.estimatedAPR = estimatedAPR;

      // calculate MPH APR
      const estimatedInterestToken = deposit.unfundedDepositAmount
        .times(Math.pow(10, this.selectedPool.stablecoinDecimals))
        .times(estimatedFloatingRate)
        .times(deposit.maturationTimestamp - now)
        .div(this.constants.YEAR_IN_SEC);
      const mphReward = estimatedInterestToken
        .times(mphFunderRewardMultiplier)
        .div(this.constants.PRECISION);
      const mphRewardUSD = mphReward.times(this.mphPriceUSD);
      const mphRewardAPR = mphRewardUSD.div(debtToFund).times(100);
      deposit.mphRewardsAPR = mphRewardAPR;
    }
    this.loadingCalculator = false;
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleDateString();
  }

  buyYieldTokens(deposit: FundableDeposit) {
    const modalRef = this.modalService.open(ModalBuyYieldTokenComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.deposit = deposit;
  }

  openWithdrawYieldTokenInterestModal(
    poolInfo: PoolInfo,
    fundedDeposit: FundedDeposit
  ) {
    const modalRef = this.modalService.open(
      ModalWithdrawYieldTokenInterestComponent,
      {
        windowClass: 'fullscreen',
      }
    );
    modalRef.componentInstance.poolInfo = poolInfo;
    modalRef.componentInstance.fundedDeposit = fundedDeposit;
    modalRef.componentInstance.mphPriceUSD = this.mphPriceUSD;
  }

  canContinue() {
    return this.wallet.connected;
  }

  get estimatedCurrentFloatingInterestRate(): BigNumber {
    if (!this.selectedPool) {
      return new BigNumber(0);
    }
    return this.helpers
      .parseInterestRate(
        this.selectedPool.oracleInterestRate,
        this.constants.YEAR_IN_SEC
      )
      .times(100);
  }

  get hasDebt(): boolean {
    return this.fundableDeposits.length > 0;
  }
}

interface QueryResult {
  funder: {
    address: string;
    fundings: {
      nftID: string;
      totalSupply: string;
      principalPerToken: string;
      totalRefundEarned: string;
      pool: {
        address: string;
        poolFunderRewardMultiplier: string;
      };
      deposit: {
        maturationTimestamp: string;
        interestRate: string;
        feeRate: string;
      };
    }[];
  };
  dpools: {
    id: string;
    address: string;
    oneYearInterestRate: string;
    oracleInterestRate: string;
    poolFunderRewardMultiplier: string;
  }[];
}

interface FundableDepositsQuery {
  dpools: {
    id: string;
    poolFunderRewardMultiplier: string;
    moneyMarketIncomeIndex: string;
    deposits: {
      id: string;
      nftID: string;
      amount: string;
      virtualTokenTotalSupply: string;
      interestRate: string;
      feeRate: string;
      maturationTimestamp: string;
      funding: Funding;
      averageRecordedIncomeIndex: string;
    }[];
  };
}
