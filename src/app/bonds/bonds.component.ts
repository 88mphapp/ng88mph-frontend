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
  allProtocolList: string[];
  allAssetList: string[];
  selectedAsset: string;
  selectedProtocol: string;
  mphPriceUSD: BigNumber;
  selectedPool: DPool;
  loading: boolean;
  now: number;

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
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.zone.run(() => {
        this.resetData(true, true);
        this.loadData(true, true, this.wallet.networkID);
      });
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.zone.run(() => {
        this.resetData(true, false);
        this.loadData(true, false, this.wallet.networkID);
      });
    });
    this.wallet.txConfirmedEvent.subscribe(() => {
      setTimeout(() => {
        this.resetData(true, true);
        this.loadData(true, true, this.wallet.networkID);
      }, this.constants.TX_CONFIRMATION_REFRESH_WAIT_TIME);
    });
  }

  loadData(loadUser: boolean, loadGlobal: boolean, networkID: number): void {
    this.now = Math.floor(Date.now() / 1e3);
    let funderID = this.wallet.actualAddress.toLowerCase();
    const queryString = gql`
      {
        ${
          loadUser
            ? `funder(id: "${funderID}") {
          address
          fundings {
            nftID
            active
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
          deposits(
            where: {
              amount_gt: "${this.constants.DUST_THRESHOLD}",
              maturationTimestamp_gt: "${this.now}"
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
        }`
            : ''
        }
      }
    `;

    request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => this.handleData(data, networkID));

    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
  }

  async handleData(data: QueryResult, networkID: number) {
    // bail if a chain change has occured
    if (networkID !== this.wallet.networkID) {
      return;
    }

    const funder = data.funder;
    const dpools = data.dpools;
    let stablecoinPriceCache = {};
    const now = Math.floor(Date.now() / 1e3);
    const readonlyWeb3 = this.wallet.readonlyWeb3(networkID);

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
            stablecoinPrice = await this.helpers.getTokenPriceUSD(
              stablecoin,
              this.wallet.networkID
            );
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

          // fetch amount of interest that can be withdrawn
          let funderWithdrawableInterest;
          await yieldToken.methods
            .dividendOf(funding.nftID, stablecoin, funder.address)
            .call()
            .then((result) => {
              funderWithdrawableInterest = new BigNumber(result).div(
                stablecoinPrecision
              );
            });

          // calculate the amount that has been refunded
          // @dev this is an extremely rough implementation. update the subgraph to track refunds for specific users to get a more accurate estimation
          let refundedAmount = new BigNumber(0);
          refundedAmount = refundedAmount.plus(
            new BigNumber(funding.totalRefundEarned).times(yieldTokenPercentage)
          );
          yieldEarned = yieldEarned.minus(refundedAmount);

          // calculate the amount of mph earned
          let mphEarned = new BigNumber(0);
          let funderAccruedMPH = new BigNumber(0);
          let funderWithdrawableMPH = new BigNumber(0);
          if (
            this.wallet.networkID === this.constants.CHAIN_ID.MAINNET ||
            this.wallet.networkID === this.constants.CHAIN_ID.RINKEBY
          ) {
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

            // fetch amount of mph that can be withdrawn
            await yieldToken.methods
              .dividendOf(
                funding.nftID,
                this.constants.MPH_ADDRESS[this.wallet.networkID],
                funder.address
              )
              .call()
              .then((result) => {
                funderWithdrawableMPH = new BigNumber(result).div(
                  this.constants.PRECISION
                );
              });

            funderAccruedMPH = funderAccruedInterest.times(
              funding.pool.poolFunderRewardMultiplier
            );
            mphEarned = mphEarned.plus(funderAccruedMPH);
          }

          if (
            funderAccruedInterest.eq(0) &&
            funderWithdrawableInterest.eq(0) &&
            funderWithdrawableMPH.eq(0) &&
            (!funding.active ||
              new BigNumber(funding.principalPerToken).lte(
                this.constants.DUST_THRESHOLD
              ) ||
              now > parseInt(funding.deposit.maturationTimestamp))
          ) {
            return;
          }

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
              isExpanded: false,
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
        funderPools.sort((a, b) => {
          return a.userTotalYieldTokenBalanceUSD <
            b.userTotalYieldTokenBalanceUSD
            ? 1
            : a.userTotalYieldTokenBalanceUSD > b.userTotalYieldTokenBalanceUSD
            ? -1
            : 0;
        });
        this.funderPools = funderPools;
        this.totalYieldTokenBalanceUSD = totalYieldTokenBalanceUSD;
        this.totalDepositEarningYield = totalDepositEarningYield;
        this.totalYieldEarnedUSD = totalYieldEarnedUSD;
        this.totalMPHEarned = totalMPHEarned;
      });
    }

    if (dpools) {
      let allPoolList = new Array<DPool>(0);
      let allProtocolList = new Array<string>(0);
      let allAssetList = new Array<string>(0);

      Promise.all(
        dpools.map(async (pool) => {
          const poolInfo = this.contract.getPoolInfoFromAddress(pool.address);
          const poolContract = this.contract.getPool(poolInfo.name);

          if (!poolInfo) {
            return;
          }

          // fetch the price of the pool asset in USD
          const stablecoin = poolInfo.stablecoin.toLowerCase();
          let stablecoinPrice = stablecoinPriceCache[stablecoin];
          if (!stablecoinPrice) {
            stablecoinPrice = await this.helpers.getTokenPriceUSD(
              stablecoin,
              this.wallet.networkID
            );
            stablecoinPriceCache[stablecoin] = stablecoinPrice;
          }

          // add pool objects
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
            poolFundableDeposits: [],
            totalYieldTokensAvailable: new BigNumber(0),
            totalYieldTokensAvailableUSD: new BigNumber(0),
            totalEarnYieldOn: new BigNumber(0),
            totalEarnYieldOnUSD: new BigNumber(0),
            maxEstimatedAPR: new BigNumber(0),
            maxEstimatedMPHRewardsAPR: new BigNumber(0),
            isExpanded: false,
          };

          let poolFundableDeposits: FundableDeposit[] = [];

          for (let d in pool.deposits) {
            const deposit = pool.deposits[d];

            const depositAmount = new BigNumber(deposit.amount);
            const interestRate = new BigNumber(deposit.interestRate);
            const feeRate = new BigNumber(deposit.feeRate);
            const virtualTokenTotalSupply = new BigNumber(
              deposit.virtualTokenTotalSupply
            );
            const totalPrincipal = virtualTokenTotalSupply
              .div(interestRate.plus(1))
              .times(interestRate.plus(feeRate).plus(1));

            // compute upper bound / max fund amount for the deposit
            let bound: BigNumber;
            let unfundedDepositAmount: BigNumber;
            const stablecoinPrecision = Math.pow(
              10,
              poolInfo.stablecoinDecimals
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
                await poolContract.methods
                  .calculateInterestAmount(
                    this.helpers.processWeb3Number(
                      unfundedDepositAmount.times(stablecoinPrecision)
                    ),
                    this.helpers.processWeb3Number(
                      +deposit.maturationTimestamp - now
                    )
                  )
                  .call({}, (await readonlyWeb3.eth.getBlockNumber()) - 1)
              ).div(stablecoinPrecision);
            } else {
              bound = new BigNumber(
                await poolContract.methods
                  .calculateInterestAmount(
                    this.helpers.processWeb3Number(
                      new BigNumber(deposit.amount).times(stablecoinPrecision)
                    ),
                    this.helpers.processWeb3Number(
                      +deposit.maturationTimestamp - now
                    )
                  )
                  .call({}, (await readonlyWeb3.eth.getBlockNumber()) - 1)
              ).div(stablecoinPrecision);
            }
            if (
              deposit.funding === null &&
              bound.gt(this.constants.DUST_THRESHOLD)
            ) {
              const fundableDeposit: FundableDeposit = {
                id: deposit.id,
                pool: dpoolObj,
                maturationTimestamp: +deposit.maturationTimestamp,
                unfundedDepositAmount: depositAmount,
                unfundedDepositAmountUSD: depositAmount.times(stablecoinPrice),
                yieldTokensAvailable: totalPrincipal,
                yieldTokensAvailableUSD: bound.times(stablecoinPrice),
                estimatedAPR: new BigNumber(0),
                mphRewardsAPR: new BigNumber(0),
              };
              this.getEstimatedROI(fundableDeposit);
              this.getEstimatedRewardsAPR(fundableDeposit);
              poolFundableDeposits.push(fundableDeposit);

              dpoolObj.totalYieldTokensAvailable =
                dpoolObj.totalYieldTokensAvailable.plus(
                  fundableDeposit.yieldTokensAvailable
                );
              dpoolObj.totalYieldTokensAvailableUSD =
                dpoolObj.totalYieldTokensAvailableUSD.plus(
                  fundableDeposit.yieldTokensAvailableUSD
                );
              dpoolObj.totalEarnYieldOn = dpoolObj.totalEarnYieldOn.plus(
                fundableDeposit.unfundedDepositAmount
              );
              dpoolObj.totalEarnYieldOnUSD = dpoolObj.totalEarnYieldOnUSD.plus(
                fundableDeposit.unfundedDepositAmountUSD
              );
              if (fundableDeposit.estimatedAPR.gt(dpoolObj.maxEstimatedAPR)) {
                dpoolObj.maxEstimatedAPR = fundableDeposit.estimatedAPR;
              }
              if (
                fundableDeposit.mphRewardsAPR.gt(
                  dpoolObj.maxEstimatedMPHRewardsAPR
                )
              ) {
                dpoolObj.maxEstimatedMPHRewardsAPR =
                  fundableDeposit.mphRewardsAPR;
              }
            } else if (bound.gt(this.constants.DUST_THRESHOLD)) {
              const supply = deposit.funding.totalSupply;
              const principalPerToken = deposit.funding.principalPerToken;
              const unfundedPrincipalAmount = totalPrincipal.minus(
                supply * principalPerToken
              );
              const yieldTokensAvailable =
                unfundedPrincipalAmount.div(principalPerToken);
              const fundableDeposit: FundableDeposit = {
                id: deposit.id,
                pool: dpoolObj,
                maturationTimestamp: +deposit.maturationTimestamp,
                unfundedDepositAmount: unfundedDepositAmount,
                unfundedDepositAmountUSD:
                  unfundedDepositAmount.times(stablecoinPrice),
                yieldTokensAvailable: yieldTokensAvailable,
                yieldTokensAvailableUSD: bound.times(stablecoinPrice),
                estimatedAPR: new BigNumber(0),
                mphRewardsAPR: new BigNumber(0),
              };
              this.getEstimatedROI(fundableDeposit);
              this.getEstimatedRewardsAPR(fundableDeposit);
              poolFundableDeposits.push(fundableDeposit);

              dpoolObj.totalYieldTokensAvailable =
                dpoolObj.totalYieldTokensAvailable.plus(
                  fundableDeposit.yieldTokensAvailable
                );
              dpoolObj.totalYieldTokensAvailableUSD =
                dpoolObj.totalYieldTokensAvailableUSD.plus(
                  fundableDeposit.yieldTokensAvailableUSD
                );
              dpoolObj.totalEarnYieldOn = dpoolObj.totalEarnYieldOn.plus(
                fundableDeposit.unfundedDepositAmount
              );
              dpoolObj.totalEarnYieldOnUSD = dpoolObj.totalEarnYieldOnUSD.plus(
                fundableDeposit.unfundedDepositAmountUSD
              );
              if (fundableDeposit.estimatedAPR.gt(dpoolObj.maxEstimatedAPR)) {
                dpoolObj.maxEstimatedAPR = fundableDeposit.estimatedAPR;
              }
              if (
                fundableDeposit.mphRewardsAPR.gt(
                  dpoolObj.maxEstimatedMPHRewardsAPR
                )
              ) {
                dpoolObj.maxEstimatedMPHRewardsAPR =
                  fundableDeposit.mphRewardsAPR;
              }
            }
          }
          poolFundableDeposits.sort((a, b) => {
            return a.maturationTimestamp > b.maturationTimestamp
              ? 1
              : a.maturationTimestamp < b.maturationTimestamp
              ? -1
              : 0;
          });
          dpoolObj.poolFundableDeposits = poolFundableDeposits;
          allPoolList.push(dpoolObj);
          if (!allAssetList.includes(poolInfo.stablecoinSymbol)) {
            allAssetList.push(poolInfo.stablecoinSymbol);
          }
          if (!allProtocolList.includes(poolInfo.protocol)) {
            allProtocolList.push(poolInfo.protocol);
          }
        })
      ).then(() => {
        allPoolList.sort((a, b) => {
          return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
        });
        allAssetList.sort((a, b) => {
          return a > b ? 1 : a < b ? -1 : 0;
        });
        allProtocolList.sort((a, b) => {
          return a > b ? 1 : a < b ? -1 : 0;
        });
        allPoolList.find(
          (pool) => pool.poolFundableDeposits.length > 0
        ).isExpanded = true;
        this.allPoolList = allPoolList;
        this.allProtocolList = allProtocolList;
        this.allAssetList = allAssetList;
        this.loading = false;
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
      this.allProtocolList = [];
      this.allAssetList = [];
      this.selectedAsset = 'all';
      this.selectedProtocol = 'all';
      this.mphPriceUSD = new BigNumber(0);
      this.loading = true;
    }
  }

  getEstimatedROI(deposit: FundableDeposit) {
    const now = Date.now() / 1e3;
    const estimatedFloatingRate = this.helpers.parseInterestRate(
      deposit.pool.oracleInterestRate,
      this.constants.YEAR_IN_SEC
    );
    const debtToFund = deposit.yieldTokensAvailableUSD;
    const estimatedInterest = deposit.unfundedDepositAmountUSD
      .times(estimatedFloatingRate)
      .times(deposit.maturationTimestamp - now)
      .div(this.constants.YEAR_IN_SEC);
    const estimatedProfit = estimatedInterest.minus(debtToFund);
    const estimatedAPR = estimatedProfit.div(debtToFund).times(100);
    deposit.estimatedAPR = estimatedAPR;
  }

  getEstimatedRewardsAPR(deposit: FundableDeposit) {
    const now = Date.now() / 1e3;
    const debtToFund = deposit.yieldTokensAvailableUSD;
    const mphFunderRewardMultiplier = new BigNumber(
      deposit.pool.poolFunderRewardMultiplier
    );
    const estimatedFloatingRate = this.helpers.parseInterestRate(
      deposit.pool.oracleInterestRate,
      this.constants.YEAR_IN_SEC
    );
    const estimatedInterestToken = deposit.unfundedDepositAmount
      .times(Math.pow(10, deposit.pool.stablecoinDecimals))
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

  debtAvailable(): boolean {
    for (let p in this.allPoolList) {
      const pool = this.allPoolList[p];
      if (pool.poolFundableDeposits.length > 0) {
        return true;
      }
    }
    return false;
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

  toggleAllFundings() {
    for (let pool in this.funderPools) {
      this.funderPools[pool].isExpanded = !this.funderPools[pool].isExpanded;
    }
  }

  toggleAllOpportunities() {
    for (let pool in this.allPoolList) {
      this.allPoolList[0].isExpanded
        ? (this.allPoolList[pool].isExpanded = false)
        : (this.allPoolList[pool].isExpanded = true);
    }
  }

  sortByFunderPool(event: any) {
    if (event.active === 'name') {
      this.funderPools =
        event.direction === 'asc'
          ? [
              ...this.funderPools.sort((a, b) =>
                a[event.active] > b[event.active] ? 1 : -1
              ),
            ]
          : [
              ...this.funderPools.sort((a, b) =>
                b[event.active] > a[event.active] ? 1 : -1
              ),
            ];
    } else {
      this.funderPools =
        event.direction === 'asc'
          ? [
              ...this.funderPools.sort(
                (a, b) => a[event.active] - b[event.active]
              ),
            ]
          : [
              ...this.funderPools.sort(
                (a, b) => b[event.active] - a[event.active]
              ),
            ];
    }
  }

  sortByFunding(pool: FunderPool, event: any) {
    pool.fundings =
      event.direction === 'asc'
        ? [...pool.fundings.sort((a, b) => a[event.active] - b[event.active])]
        : [...pool.fundings.sort((a, b) => b[event.active] - a[event.active])];
  }

  sortAllPools(event: any) {
    if (event.active === 'stablecoinSymbol') {
      this.allPoolList =
        event.direction === 'asc'
          ? [
              ...this.allPoolList.sort((a, b) =>
                a[event.active] > b[event.active] ? 1 : -1
              ),
            ]
          : [
              ...this.allPoolList.sort((a, b) =>
                b[event.active] > a[event.active] ? 1 : -1
              ),
            ];
    } else {
      this.allPoolList =
        event.direction === 'asc'
          ? [
              ...this.allPoolList.sort(
                (a, b) => a[event.active] - b[event.active]
              ),
            ]
          : [
              ...this.allPoolList.sort(
                (a, b) => b[event.active] - a[event.active]
              ),
            ];
    }
  }

  sortByFundableDeposit(pool: DPool, event: any) {
    pool.poolFundableDeposits =
      event.direction === 'asc'
        ? [
            ...pool.poolFundableDeposits.sort(
              (a, b) => a[event.active] - b[event.active]
            ),
          ]
        : [
            ...pool.poolFundableDeposits.sort(
              (a, b) => b[event.active] - a[event.active]
            ),
          ];
  }
}

interface QueryResult {
  funder: {
    address: string;
    fundings: {
      nftID: string;
      active: boolean;
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
  }[];
}
