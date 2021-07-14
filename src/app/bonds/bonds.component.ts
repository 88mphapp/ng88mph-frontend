import { Component, OnInit, NgZone } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { request, gql } from 'graphql-request';
import BigNumber from 'bignumber.js';
import { ConstantsService } from '../constants.service';
import { ContractService } from '../contract.service';
import { HelpersService } from '../helpers.service';
import { WalletService } from '../wallet.service';
import { ModalBondDetailsComponent } from './modal-bond-details/modal-bond-details.component';
import { ModalBuyYieldTokenComponent } from './modal-buy-yield-token/modal-buy-yield-token.component';
import {
  FunderPool,
  Deposit,
  FundedDeposit,
  FundableDeposit,
  Funding,
  Fundingv3,
  DPool,
} from './interface';
import { Timer } from '../timer';

@Component({
  selector: 'app-bonds',
  templateUrl: './bonds.component.html',
  styleUrls: ['./bonds.component.css'],
})
export class BondsComponent implements OnInit {
  // V3 variables
  totalYieldTokenBalanceUSD: BigNumber;
  totalDepositEarningYield: BigNumber;
  totalYieldEarnedUSD: BigNumber;
  totalMPHEarned: BigNumber;

  // V2 variables
  allPoolList: DPool[];
  funderPools: FunderPool[];

  totalDeficitFundedUSD: BigNumber;
  totalCurrentDepositUSD: BigNumber;
  totalInterestUSD: BigNumber;

  selectedPool: DPool;
  floatingRatePrediction: BigNumber;
  numDepositsToFund: string;
  numFundableDeposits: number;
  fundableDeposits: FundableDeposit[];
  debtToFundToken: BigNumber;
  debtToFundUSD: BigNumber;
  amountToEarnOnToken: BigNumber;
  amountToEarnOnUSD: BigNumber;
  mphRewardAmount: BigNumber;
  estimatedProfitToken: BigNumber;
  estimatedROI: BigNumber;
  estimatedProfitUSD: BigNumber;
  loadingCalculator: boolean;
  mphPriceUSD: BigNumber;
  mphROI: BigNumber;
  averageMaturationTime: BigNumber;
  medianMaturationTime: BigNumber;
  depositListIsCollapsed: boolean;

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
  }

  loadData(loadUser: boolean, loadGlobal: boolean): void {
    // ***********
    // V3 CODE
    // ***********

    let funderID;
    if (this.wallet.connected && !this.wallet.watching) {
      funderID = this.wallet.userAddress.toLowerCase();
    } else if (this.wallet.watching) {
      funderID = this.wallet.watchedAddress.toLowerCase();
    } else {
      funderID = '';
    }

    const queryString = gql`
      {
        ${
          loadUser
            ? `funder(id: "${funderID}") {
          address
          pools {
            address
            poolFunderRewardMultiplier
            fundings(where: { active: true }, orderBy: nftID) {
              id
              nftID
              totalSupply
              principalPerToken
              fundedDeficitAmount
              totalInterestEarned
              totalRefundEarned
              totalMPHEarned
              recordedMoneyMarketIncomeIndex
              deposit {
                id
                amount
                maturationTimestamp
                interestRate
                feeRate
              }
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
          surplus
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
    // ***********
    // V3 CODE
    // ***********
    //console.log(data);
    const funder = data.funder;
    const dpools = data.dpools;
    let stablecoinPriceCache = {};
    const now = Math.floor(Date.now() / 1e3);

    if (funder) {
      //console.log(funder);
      const funderPools: FunderPool[] = [];
      let totalDepositEarningYield = new BigNumber(0);
      let totalYieldEarnedUSD = new BigNumber(0);
      let totalMPHEarned = new BigNumber(0);

      Promise.all(
        funder.pools.map(async (pool) => {
          if (pool.fundings.length == 0) return;

          const lens = this.contract.getNamedContract('DInterestLens');
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const poolContract = this.contract.getContract(
            pool.address,
            'DInterest'
          );
          const poolFunderRewardMultiplier = new BigNumber(
            pool.poolFunderRewardMultiplier
          );
          console.log(poolFunderRewardMultiplier.toFixed(18));

          // get stablecoin price in USD
          const stablecoin = poolInfo.stablecoin.toLowerCase();
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
              console.log(yieldTokenAddress);
              yieldToken = this.contract.getContract(
                yieldTokenAddress,
                'FundingMultitoken'
              );
            });

          const fundings: Array<FundedDeposit> = [];

          for (const funding in pool.fundings) {
            const yieldTokenBalance = new BigNumber(
              await yieldToken.methods
                .balanceOf(funder.address, pool.fundings[funding].nftID)
                .call()
            ).div(this.constants.PRECISION);

            const maturity = new BigNumber(
              pool.fundings[funding].deposit.maturationTimestamp
            );

            if (yieldTokenBalance.gt(0) && maturity.gt(now)) {
              console.log(pool.fundings[funding]);

              const yieldTokenPercentage = yieldTokenBalance.div(
                pool.fundings[funding].totalSupply
              );
              //console.log(yieldTokenPercentage.toString());

              // calculate value of yield tokens
              //console.log(pool.fundings[funding].fundedDeficitAmount);

              // calculate amount of deposit earning yield
              const earnYieldOn = yieldTokenBalance.times(
                pool.fundings[funding].principalPerToken
              );

              // console.log("principal");
              // console.log(earnYieldOn.toFixed(18));

              // let test = earnYieldOn.times(1 - pool.fundings[funding].deposit.interestRate - pool.fundings[funding].deposit.feeRate);
              // console.log("test deposit");
              // console.log(test);

              // calculate amount of yield earned
              let yieldEarned = new BigNumber(0);

              // some will have been accrued, which is equally split among yield token holders
              await lens.methods
                .accruedInterestOfFunding(
                  pool.address,
                  pool.fundings[funding].nftID
                )
                .call()
                .then((result) => {
                  const totalAccruedInterest = new BigNumber(result).div(
                    this.constants.PRECISION
                  );
                  const funderAccruedInterest =
                    totalAccruedInterest.times(yieldTokenPercentage);
                  yieldEarned = yieldEarned.plus(funderAccruedInterest);
                });

              // some will have been paid out already
              // @dev this value will potentially include the refund amount
              await yieldToken.methods
                .accumulativeDividendOf(
                  pool.fundings[funding].nftID,
                  stablecoin,
                  funder.address
                )
                .call()
                .then((result) => {
                  const funderDistributedInterest = new BigNumber(result).div(
                    this.constants.PRECISION
                  );
                  console.log('yield paid out');
                  console.log(funderDistributedInterest.toFixed(18));
                  yieldEarned = yieldEarned.plus(funderDistributedInterest);
                });

              // calculate the amount that has been refunded
              // @dev this is an extremely rough implementation. update the subgraph to track refunds for specific users to get a more accurate estimation
              let refundedAmount = new BigNumber(0);
              refundedAmount = refundedAmount.plus(
                new BigNumber(pool.fundings[funding].totalRefundEarned).times(
                  yieldTokenPercentage
                )
              );
              yieldEarned = yieldEarned.minus(refundedAmount);

              // calculate the amount of mph earned
              // @dev this only accounts for already distributed MPH, does not estimate MPH rewards based on interest earned to date
              let mphEarned = new BigNumber(0);
              await yieldToken.methods
                .accumulativeDividendOf(
                  pool.fundings[funding].nftID,
                  this.constants.MPH_ADDRESS[this.wallet.networkID],
                  funder.address
                )
                .call()
                .then((result) => {
                  const funderDistributedMPH = new BigNumber(result).div(
                    this.constants.PRECISION
                  );
                  console.log(funderDistributedMPH.toFixed(18));
                  mphEarned = mphEarned.plus(funderDistributedMPH);
                });

              const fundingObj: FundedDeposit = {
                maturationTimestamp:
                  pool.fundings[funding].deposit.maturationTimestamp,
                countdownTimer: new Timer(
                  pool.fundings[funding].deposit.maturationTimestamp,
                  'down'
                ),
                yieldTokenBalance: yieldTokenBalance,
                yieldTokenBalanceUSD: new BigNumber(0),
                earnYieldOn: earnYieldOn,
                earnYieldOnUSD: earnYieldOn.times(stablecoinPrice),
                yieldEarned: yieldEarned,
                yieldEarnedUSD: yieldEarned.times(stablecoinPrice),
                refundedAmount: refundedAmount,
                refundedAmountUSD: refundedAmount.times(stablecoinPrice),
                mphRewardsEarned: mphEarned,
                mphRewardsEarnedUSD: mphEarned.times(this.mphPriceUSD),
              };
              fundingObj.countdownTimer.start();
              fundings.push(fundingObj);

              // update user totals
              totalDepositEarningYield = totalDepositEarningYield.plus(
                earnYieldOn.times(stablecoinPrice)
              );
              totalYieldEarnedUSD = totalYieldEarnedUSD.plus(
                yieldEarned.times(stablecoinPrice)
              );
              totalMPHEarned = totalMPHEarned.plus(mphEarned);
            }
          }

          // sort active positions by maturation timestamp
          fundings.sort((a, b) => {
            return a.maturationTimestamp - b.maturationTimestamp;
          });

          const funderPool: FunderPool = {
            poolInfo: poolInfo,
            fundings: fundings,
          };
          funderPools.push(funderPool);
        })
      ).then(() => {
        this.funderPools = funderPools;
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
            surplus: new BigNumber(pool.surplus),
            oneYearInterestRate: new BigNumber(pool.oneYearInterestRate).times(
              100
            ),
            oracleInterestRate: new BigNumber(pool.oracleInterestRate)
              .times(this.constants.YEAR_IN_SEC)
              .times(100),
            poolFunderRewardMultiplier: new BigNumber(
              pool.poolFunderRewardMultiplier
            ),
          };
          allPoolList.push(dpoolObj);
        })
      ).then(() => {
        this.allPoolList = allPoolList;
        console.log(this.allPoolList);
        this.selectPool(0);
      });
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      // v3
      this.totalYieldTokenBalanceUSD = new BigNumber(0);
      this.totalDepositEarningYield = new BigNumber(0);
      this.totalYieldEarnedUSD = new BigNumber(0);

      // end v3

      this.totalDeficitFundedUSD = new BigNumber(0);
      this.totalCurrentDepositUSD = new BigNumber(0);
      this.totalInterestUSD = new BigNumber(0);
      this.totalMPHEarned = new BigNumber(0);
      this.funderPools = [];
    }

    if (resetGlobal) {
      this.floatingRatePrediction = new BigNumber(0);
      this.allPoolList = [];
      this.numDepositsToFund = 'All';
      this.numFundableDeposits = 0;
      this.fundableDeposits = [];
      this.debtToFundToken = new BigNumber(0);
      this.debtToFundUSD = new BigNumber(0);
      this.amountToEarnOnToken = new BigNumber(0);
      this.amountToEarnOnUSD = new BigNumber(0);
      this.mphRewardAmount = new BigNumber(0);
      this.estimatedProfitToken = new BigNumber(0);
      this.estimatedProfitUSD = new BigNumber(0);
      this.estimatedROI = new BigNumber(0);
      this.loadingCalculator = true;
      this.mphPriceUSD = new BigNumber(0);
      this.mphROI = new BigNumber(0);
      this.averageMaturationTime = new BigNumber(0);
      this.medianMaturationTime = new BigNumber(0);
      this.depositListIsCollapsed = true;
    }
  }

  async selectPool(poolIdx: number) {
    this.selectedPool = this.allPoolList[poolIdx];
    //const selectedPoolContract = this.contract
    //console.log(this.selectedPool);

    // this.numFundableDeposits = Math.min(
    //   this.selectedPool.latestDeposit - this.selectedPool.latestFundedDeposit,
    //   20
    // );
    //
    const poolID = this.selectedPool.address.toLowerCase();
    const now = Math.floor(Date.now() / 1e3);

    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      this.selectedPool.stablecoin
    );

    const queryString = gql`
      {
        dpool(id: "${poolID}") {
          id
          poolFunderRewardMultiplier
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
      const lens = this.contract.getNamedContract('DInterestLens');

      // get MPH APY
      const mphFunderRewardMultiplier = new BigNumber(
        data.dpool.poolFunderRewardMultiplier
      );

      for (const deposit of data.dpool.deposits) {
        //const poolContract = this.contract.getPool(this.selectedPool.name);
        // NEW STUFF

        const virtualTokenTotalSupply = new BigNumber(
          deposit.virtualTokenTotalSupply
        );
        const interestRate = new BigNumber(deposit.interestRate);
        const feeRate = new BigNumber(deposit.feeRate);

        const totalPrincipal = virtualTokenTotalSupply
          .div(interestRate.plus(1))
          .times(interestRate.plus(feeRate).plus(1));

        const depositAmount = new BigNumber(deposit.amount);

        let surplus;
        await lens.methods
          .surplusOfDeposit(this.selectedPool.address, deposit.nftID)
          .call()
          .then((result) => {
            if (result.isNegative === true) {
              surplus = new BigNumber(result.surplusAmount)
                .div(this.constants.PRECISION)
                .negated();
            } else {
              surplus = new BigNumber(result.surplusAmount).div(
                this.constants.PRECISION
              );
            }
          });

        // deposit hasn't been funded yet
        // @dev yield tokens available will equal the total principal of the deposit
        if (deposit.funding === null) {
          const parsedDeposit: FundableDeposit = {
            id: deposit.id,
            pool: this.selectedPool,
            maturationTimestamp: deposit.maturationTimestamp,
            countdownTimer: new Timer(deposit.maturationTimestamp, 'down'),
            unfundedDepositAmount: depositAmount,
            unfundedDepositAmountUSD: depositAmount.times(stablecoinPrice),
            yieldTokensAvailable: totalPrincipal,
            yieldTokensAvailableUSD: totalPrincipal
              .minus(depositAmount)
              .times(stablecoinPrice),
            estimatedAPR: new BigNumber(0),
            mphRewardsAPR: new BigNumber(0),
          };
          parsedDeposit.countdownTimer.start();
          fundableDeposits.push(parsedDeposit);
        }

        // deposit has been partially funded and has a negative surplus
        else if (surplus.lt(0)) {
          const supply = deposit.funding.totalSupply;
          const principalPerToken = deposit.funding.principalPerToken;
          const unfundedPrincipalAmount = totalPrincipal.minus(
            supply * principalPerToken
          );
          const unfundedDepositAmount = unfundedPrincipalAmount.plus(surplus);
          const yieldTokensAvailable =
            unfundedPrincipalAmount.div(principalPerToken);

          const parsedDeposit: FundableDeposit = {
            id: deposit.id,
            pool: this.selectedPool,
            maturationTimestamp: deposit.maturationTimestamp,
            countdownTimer: new Timer(deposit.maturationTimestamp, 'down'),
            unfundedDepositAmount: unfundedDepositAmount,
            unfundedDepositAmountUSD:
              unfundedDepositAmount.times(stablecoinPrice),
            yieldTokensAvailable: yieldTokensAvailable,
            yieldTokensAvailableUSD: yieldTokensAvailable
              .minus(unfundedDepositAmount)
              .times(stablecoinPrice),
            estimatedAPR: new BigNumber(0),
            mphRewardsAPR: new BigNumber(0),
          };
          parsedDeposit.countdownTimer.start();
          fundableDeposits.push(parsedDeposit);
        }

        // sort deposits by maturation timestamp
        fundableDeposits.sort((a, b) => {
          return a.maturationTimestamp - b.maturationTimestamp;
        });
      }
      this.fundableDeposits = fundableDeposits;
      this.floatingRatePrediction = this.selectedPool.oracleInterestRate;
      this.updateEstimatedROI();
    });
  }

  selectedPoolHasDebt(): boolean {
    if (!this.selectedPool) {
      return false;
    }
    return this.selectedPool.surplus.lt(0);
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

  canContinue() {
    // return (
    //   this.wallet.connected &&
    //   this.selectedPoolHasDebt() &&
    //   this.debtToFundToken.gt(0)
    // );
  }
}

interface QueryResult {
  funder: {
    address: string;
    pools: {
      address: string;
      poolFunderRewardMultiplier: BigNumber;
      fundings: {
        id: number;
        nftID: number;
        totalSupply: number;
        principalPerToken: number;
        fundedDeficitAmount: number;
        totalInterestEarned: number;
        totalRefundEarned: number;
        totalMPHEarned: number;
        recordedMoneyMarketIncomeIndex: number;
        deposit: {
          id;
          amount: number;
          maturationTimestamp: number;
          interestRate: BigNumber;
          feeRate: BigNumber;
        };
      }[];
    }[];
  };
  dpools: {
    id: string;
    address: string;
    surplus: number;
    oneYearInterestRate: number;
    oracleInterestRate: number;
    poolFunderRewardMultiplier: BigNumber;
  }[];
}

interface FundableDepositsQuery {
  dpool: {
    id: string;
    poolFunderRewardMultiplier: BigNumber;
    deposits: {
      id: string;
      nftID: string;
      amount: BigNumber;
      virtualTokenTotalSupply: BigNumber;
      interestRate: BigNumber;
      feeRate: BigNumber;
      maturationTimestamp: number;
      funding: Fundingv3;
    }[];
  };
}
