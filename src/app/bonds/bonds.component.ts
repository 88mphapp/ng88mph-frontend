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
            fundedDeficitAmount
            pool {
              address
              poolFunderRewardMultiplier
            }
            deposit {
              nftID
              amount
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
          surplus
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
    const web3 = this.wallet.httpsWeb3(networkID);

    if (funder) {
      const funderPools: FunderPool[] = [];
      let totalYieldTokenBalanceUSD = new BigNumber(0);
      let totalDepositEarningYield = new BigNumber(0);
      let totalYieldEarnedUSD = new BigNumber(0);
      let totalMPHEarned = new BigNumber(0);

      Promise.all(
        funder.fundings.map(async (funding) => {
          const lens = this.contract.getNamedContract(
            'DInterestLens',
            web3,
            networkID
          );
          const poolInfo = this.contract.getPoolInfoFromAddress(
            funding.pool.address,
            networkID
          );
          const poolContract = this.contract.getContract(
            funding.pool.address,
            'DInterest',
            web3
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
          let yieldTokenAddress;
          await poolContract.methods
            .fundingMultitoken()
            .call()
            .then((yieldTokenAddr) => {
              yieldToken = this.contract.getContract(
                yieldTokenAddr,
                'FundingMultitoken',
                web3
              );
              yieldTokenAddress = yieldTokenAddr;
            });

          const yieldTokenBalance = new BigNumber(
            await yieldToken.methods
              .balanceOf(funder.address, funding.nftID)
              .call()
          ).div(stablecoinPrecision);

          const yieldTokenPercentage = yieldTokenBalance.div(
            funding.totalSupply
          );
          console.log('deposit ID: ' + funding.deposit.nftID);
          console.log('YT percentage: ' + yieldTokenPercentage.toString());
          const maturity = new BigNumber(funding.deposit.maturationTimestamp);

          // calculate amount of deposit earning yield
          const earnYieldOn = yieldTokenBalance.times(
            funding.principalPerToken
          );

          console.log('earn yield on: ' + earnYieldOn.toString());

          console.log('deposit amount: ' + funding.deposit.amount);
          console.log('funded deficit amount: ' + funding.fundedDeficitAmount);

          // calculate USD value of yield tokens
          const interestRate = new BigNumber(funding.deposit.interestRate);
          const feeRate = new BigNumber(funding.deposit.feeRate);
          const fundedDepositAmount = earnYieldOn.div(
            interestRate.plus(feeRate).plus(1)
          );
          console.log(
            'funded deposit amount: ' + fundedDepositAmount.toString()
          );
          const yieldTokenBalanceUSD2 = earnYieldOn
            .minus(fundedDepositAmount)
            .times(stablecoinPrice);

          // @dev this is an inaccurate implementation, specifically for funders who purchase <100% of a Deposit's YTs
          // @dev our subgraph needs to be updated to track exact amount paid by each funder
          const yieldTokenBalanceUSD = new BigNumber(
            funding.fundedDeficitAmount
          )
            .times(yieldTokenPercentage)
            .times(stablecoinPrice);
          console.log(
            'yield token balance: ' + yieldTokenBalanceUSD.toString()
          );
          console.log(
            'yield token balance 2: ' + yieldTokenBalanceUSD2.toString()
          );

          console.log(stablecoinPrice.toString());

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
            this.wallet.networkID === this.constants.CHAIN_ID.RINKEBY ||
            this.wallet.networkID === this.constants.CHAIN_ID.FANTOM
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

            // @dev MPH rewards are only applicable to interest earned before the maturity date
            // https://github.com/88mphapp/88mph-contracts/blob/948e5812afe923800ae63f4f737c51b9f37ddf4b/contracts/DInterest.sol#L1310
            const fundingObj = await poolContract.methods
              .getFunding(funding.nftID)
              .call();
            console.log(fundingObj);

            const now = Date.now() / 1e3;
            const maturationTimstamp = parseInt(
              funding.deposit.maturationTimestamp
            );
            const lastPayoutTimestamp = parseInt(
              fundingObj.lastInterestPayoutTimestamp
            );

            let effectiveAccruedInterest = funderAccruedInterest;
            if (
              now > maturationTimstamp &&
              lastPayoutTimestamp < maturationTimstamp
            ) {
              effectiveAccruedInterest = funderAccruedInterest
                .times(
                  parseInt(funding.deposit.maturationTimestamp) -
                    parseInt(fundingObj.lastInterestPayoutTimestamp)
                )
                .div(now - parseInt(fundingObj.lastInterestPayoutTimestamp));
            }
            funderAccruedMPH = effectiveAccruedInterest.times(
              funding.pool.poolFunderRewardMultiplier
            );
            mphEarned = mphEarned.plus(funderAccruedMPH);
          }

          const currentROI = yieldEarned
            .times(stablecoinPrice)
            .plus(mphEarned.times(this.mphPriceUSD))
            .plus(refundedAmount.times(stablecoinPrice))
            .minus(yieldTokenBalanceUSD)
            .div(yieldTokenBalanceUSD)
            .times(100);

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
              userTotalCurrentROI: new BigNumber(0),
              isExpanded: false,
            };
            funderPools.push(funderPool);
            pool = funderPool;
          }

          // add the funding to the funderPool
          const fundingObj: FundedDeposit = {
            yieldToken: yieldToken,
            yieldTokenAddress: yieldTokenAddress,
            fundingID: +funding.nftID,
            stablecoinPrice: stablecoinPrice,
            funderAccruedInterest: funderAccruedInterest,
            funderAccruedMPH: funderAccruedMPH,
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
            principalPerToken: new BigNumber(funding.principalPerToken),
            currentROI: currentROI,
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
          pool.userTotalCurrentROI = pool.userTotalYieldEarnedUSD
            .plus(pool.userTotalMPHRewardsEarnedUSD)
            .plus(pool.userTotalRefundedAmountUSD)
            .minus(pool.userTotalYieldTokenBalanceUSD)
            .div(pool.userTotalYieldTokenBalanceUSD)
            .times(100);

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
          const poolInfo = this.contract.getPoolInfoFromAddress(
            pool.address,
            networkID
          );

          if (poolInfo.protocol === 'Cream') {
            return;
          }

          const poolContract = this.contract.getPool(poolInfo.name, web3);

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
            poolFundableDeposits: [],
            totalYieldTokensAvailable: new BigNumber(0),
            totalYieldTokensAvailableUSD: new BigNumber(0),
            totalYieldTokensAvailableToken: new BigNumber(0),
            totalEarnYieldOn: new BigNumber(0),
            totalEarnYieldOnUSD: new BigNumber(0),
            maxEstimatedAPR: new BigNumber(0),
            surplus: new BigNumber(pool.surplus),
            isExpanded: false,
            emaRate: this.helpers
              .parseInterestRate(
                new BigNumber(pool.oracleInterestRate),
                this.constants.YEAR_IN_SEC
              )
              .times(100),
            marketRate: new BigNumber(0),
            floatingRatePrediction: this.helpers
              .parseInterestRate(
                new BigNumber(pool.oracleInterestRate),
                this.constants.YEAR_IN_SEC
              )
              .times(100),
            useMarketRate: false,
          };
          this.getCurrentMarketRate(dpoolObj, poolInfo);

          if (dpoolObj.surplus.lt(0)) {
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
                    .call()
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
                    .call()
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
                  unfundedDepositAmountUSD:
                    depositAmount.times(stablecoinPrice),
                  yieldTokensAvailable: totalPrincipal,
                  yieldTokensAvailableUSD: bound.times(stablecoinPrice),
                  yieldTokensAvailableToken: bound,
                  estimatedAPR: new BigNumber(0),
                };
                this.getEstimatedROI(fundableDeposit);
                poolFundableDeposits.push(fundableDeposit);

                dpoolObj.totalYieldTokensAvailable =
                  dpoolObj.totalYieldTokensAvailable.plus(
                    fundableDeposit.yieldTokensAvailable
                  );
                dpoolObj.totalYieldTokensAvailableUSD =
                  dpoolObj.totalYieldTokensAvailableUSD.plus(
                    fundableDeposit.yieldTokensAvailableUSD
                  );
                dpoolObj.totalYieldTokensAvailableToken =
                  dpoolObj.totalYieldTokensAvailableToken.plus(
                    fundableDeposit.yieldTokensAvailableToken
                  );
                dpoolObj.totalEarnYieldOn = dpoolObj.totalEarnYieldOn
                  .plus(fundableDeposit.unfundedDepositAmount)
                  .plus(fundableDeposit.yieldTokensAvailableToken);
                dpoolObj.totalEarnYieldOnUSD = dpoolObj.totalEarnYieldOnUSD
                  .plus(fundableDeposit.unfundedDepositAmountUSD)
                  .plus(fundableDeposit.yieldTokensAvailableUSD);
                if (fundableDeposit.estimatedAPR.gt(dpoolObj.maxEstimatedAPR)) {
                  dpoolObj.maxEstimatedAPR = fundableDeposit.estimatedAPR;
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
                  yieldTokensAvailableToken: bound,
                  estimatedAPR: new BigNumber(0),
                };
                this.getEstimatedROI(fundableDeposit);
                poolFundableDeposits.push(fundableDeposit);

                dpoolObj.totalYieldTokensAvailable =
                  dpoolObj.totalYieldTokensAvailable.plus(
                    fundableDeposit.yieldTokensAvailable
                  );
                dpoolObj.totalYieldTokensAvailableUSD =
                  dpoolObj.totalYieldTokensAvailableUSD.plus(
                    fundableDeposit.yieldTokensAvailableUSD
                  );
                dpoolObj.totalYieldTokensAvailableToken =
                  dpoolObj.totalYieldTokensAvailableToken.plus(
                    fundableDeposit.yieldTokensAvailableToken
                  );
                dpoolObj.totalEarnYieldOn = dpoolObj.totalEarnYieldOn
                  .plus(fundableDeposit.unfundedDepositAmount)
                  .plus(fundableDeposit.yieldTokensAvailableToken);
                dpoolObj.totalEarnYieldOnUSD = dpoolObj.totalEarnYieldOnUSD
                  .plus(fundableDeposit.unfundedDepositAmountUSD)
                  .plus(fundableDeposit.yieldTokensAvailableUSD);
                if (fundableDeposit.estimatedAPR.gt(dpoolObj.maxEstimatedAPR)) {
                  dpoolObj.maxEstimatedAPR = fundableDeposit.estimatedAPR;
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
          }
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
        let firstPoolWithDebt = allPoolList.find(
          (pool) => pool.poolFundableDeposits.length > 0
        );
        if (firstPoolWithDebt) {
          firstPoolWithDebt.isExpanded = true;
        }
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

  // @dev which estimated interst calculation is most accurate?
  getEstimatedROI(deposit: FundableDeposit) {
    const now = Date.now() / 1e3;
    const debtToFund = deposit.yieldTokensAvailableUSD;

    // @dev this returns a slightly smaller amount
    // @dev likely because the returned rate compounds for less time
    // const estimatedInterest = deposit.unfundedDepositAmountUSD
    //   .plus(debtToFund)
    //   .times(
    //     this.helpers.parseInterestRate(
    //       deposit.pool.oracleInterestRate,
    //       deposit.maturationTimestamp - now
    //     )
    //   );

    // @dev this returns a slightly larger amount
    // @dev likely because the returned rate compounds for more time
    const estimatedInterest = deposit.unfundedDepositAmountUSD
      .plus(debtToFund)
      .times(deposit.pool.floatingRatePrediction)
      .div(100)
      .times(deposit.maturationTimestamp - now)
      .div(this.constants.YEAR_IN_SEC);

    const estimatedProfit = estimatedInterest.minus(debtToFund);
    const estimatedAPR = estimatedProfit.div(debtToFund).times(100);
    deposit.estimatedAPR = estimatedAPR;
  }

  async getCurrentMarketRate(pool: DPool, poolInfo: PoolInfo) {
    const web3 = this.wallet.httpsWeb3();

    switch (pool.protocol) {
      case 'Aave':
        const aaveDataProvider = this.contract.getNamedContract(
          'AaveProtocolDataProvider',
          web3
        );
        aaveDataProvider.methods
          .getReserveData(pool.stablecoin)
          .call()
          .then((result) => {
            const apr = new BigNumber(result.liquidityRate).div(1e27);
            const apy =
              Math.pow(
                apr.div(this.constants.YEAR_IN_SEC).plus(1).toNumber(),
                this.constants.YEAR_IN_SEC
              ) - 1;
            const marketRate = new BigNumber(apy).times(100);
            pool.marketRate = marketRate;
          });
        break;
      case 'Compound':
        // @dev https://compound.finance/docs
        // @dev uses blocks per day (6570) to calculat markete rate APY
        const compoundMarket = this.contract.getContract(
          poolInfo.moneyMarket,
          'CompoundMoneyMarket',
          web3
        );
        compoundMarket.methods
          .cToken()
          .call()
          .then(async (result) => {
            const cToken = this.contract.getContract(result, 'CERC20', web3);
            cToken.methods
              .supplyRatePerBlock()
              .call()
              .then((result) => {
                const marketRate = new BigNumber(
                  (Math.pow((result / 1e18) * 6570 + 1, 365) - 1) * 100
                );
                pool.marketRate = marketRate;
              });
          });
        break;
      case 'Harvest':
        // @dev https://github.com/harvest-finance/harvest-api/blob/master/docs/api.md
        const tokenSymbol = poolInfo.stablecoinSymbol;
        const apiStr = `https://api.harvest.finance/apy/${tokenSymbol}?key=fc8ad696-7905-4daa-a552-129ede248e33`;
        const result = await this.helpers.httpsGet(apiStr);
        const marketRate = new BigNumber(result);
        pool.marketRate = marketRate;
        break;
      case 'Cream':
        // @dev https://compound.finance/docs
        // @dev uses blocks per day (6570) to calculat markete rate APY
        const creamMarket = this.contract.getContract(
          poolInfo.moneyMarket,
          'CompoundMoneyMarket',
          web3
        );
        creamMarket.methods
          .cToken()
          .call()
          .then(async (result) => {
            const cToken = this.contract.getContract(result, 'CERC20', web3);
            cToken.methods
              .supplyRatePerBlock()
              .call()
              .then((result) => {
                const marketRate = new BigNumber(
                  (Math.pow((result / 1e18) * 6570 + 1, 365) - 1) * 100
                );
                pool.marketRate = marketRate;
              });
          });
        break;
      case 'B.Protocol':
        // @dev https://compound.finance/docs
        // @dev uses blocks per day (6570) to calculat markete rate APY
        const bprotocolMarket = this.contract.getContract(
          poolInfo.moneyMarket,
          'BProtocolMoneyMarket',
          web3
        );
        bprotocolMarket.methods
          .bToken()
          .call()
          .then(async (result) => {
            const cToken = this.contract.getContract(result, 'CERC20', web3);
            cToken.methods
              .supplyRatePerBlock()
              .call()
              .then((result) => {
                const marketRate = new BigNumber(
                  (Math.pow((result / 1e18) * 6570 + 1, 365) - 1) * 100
                );
                pool.marketRate = marketRate;
              });
          });
        break;
      case 'Benqi':
        // @dev https://compound.finance/docs
        // @dev uses seconds per day (86400) to calculate market rate APY
        const benqiMarket = this.contract.getContract(
          poolInfo.moneyMarket,
          'CompoundMoneyMarket',
          web3
        );
        benqiMarket.methods
          .cToken()
          .call()
          .then(async (result) => {
            const cToken = this.contract.getContract(result, 'QIERC20', web3);
            cToken.methods
              .supplyRatePerTimestamp()
              .call()
              .then((result) => {
                const marketRate = new BigNumber(
                  (Math.pow((result / 1e18) * 86400 + 1, 365) - 1) * 100
                );
                pool.marketRate = marketRate;
              });
          });
        break;
      case 'Geist':
        const geistDataProvider = this.contract.getNamedContract(
          'GeistProtocolDataProvider',
          web3
        );
        geistDataProvider.methods
          .getReserveData(pool.stablecoin)
          .call()
          .then((result) => {
            const apr = new BigNumber(result.liquidityRate).div(1e27);
            const apy =
              Math.pow(
                apr.div(this.constants.YEAR_IN_SEC).plus(1).toNumber(),
                this.constants.YEAR_IN_SEC
              ) - 1;
            const marketRate = new BigNumber(apy).times(100);
            pool.marketRate = marketRate;
          });
        break;
      case 'Scream':
        // @dev https://compound.finance/docs
        // @dev uses seconds per day (86400) to calculate market rate APY
        const screamMarket = this.contract.getContract(
          poolInfo.moneyMarket,
          'CompoundMoneyMarket',
          web3
        );
        screamMarket.methods
          .cToken()
          .call()
          .then(async (result) => {
            const cToken = this.contract.getContract(result, 'CERC20', web3);
            cToken.methods
              .supplyRatePerBlock()
              .call()
              .then((result) => {
                const marketRate = new BigNumber(
                  (Math.pow((result / 1e18) * 86400 + 1, 365) - 1) * 100
                );
                pool.marketRate = marketRate;
              });
          });
        break;
    }
  }

  updatePoolFloatingRatePrediction(pool: DPool, rate: any) {
    pool.floatingRatePrediction = new BigNumber(rate);
    for (let deposit in pool.poolFundableDeposits) {
      const fundableDeposit = pool.poolFundableDeposits[deposit];
      this.getEstimatedROI(fundableDeposit);
    }
  }

  updatePoolFloatingRateType(pool: DPool) {
    pool.useMarketRate = !pool.useMarketRate;

    pool.floatingRatePrediction = pool.useMarketRate
      ? pool.marketRate
      : pool.emaRate;

    this.updatePoolFloatingRatePrediction(pool, pool.floatingRatePrediction);
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

  displayError(): boolean {
    const protocolPool = this.allPoolList.find(
      (pool) => pool.protocol === this.selectedProtocol && pool.surplus.lt(0)
    );
    if (
      this.selectedProtocol !== 'all' &&
      this.selectedAsset === 'all' &&
      !protocolPool
    ) {
      return true;
    }

    const assetPool = this.allPoolList.find(
      (pool) =>
        pool.stablecoinSymbol === this.selectedAsset && pool.surplus.lt(0)
    );
    if (
      this.selectedProtocol === 'all' &&
      this.selectedAsset !== 'all' &&
      !assetPool
    ) {
      return true;
    }

    const pool = this.allPoolList.find(
      (pool) =>
        pool.protocol === this.selectedProtocol &&
        pool.stablecoinSymbol === this.selectedAsset &&
        pool.surplus.lt(0)
    );
    if (
      this.selectedProtocol !== 'all' &&
      this.selectedAsset !== 'all' &&
      !pool
    ) {
      return true;
    }

    return false;
  }

  timestampToDateString(timestampSec: number): string {
    return new Date(timestampSec * 1e3).toLocaleDateString();
  }

  buyYieldTokens(deposit: FundableDeposit, pool: DPool) {
    const modalRef = this.modalService.open(ModalBuyYieldTokenComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.deposit = deposit;
    modalRef.componentInstance.pool = pool;
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
    const zeroIndexIsExpanded: boolean = this.allPoolList[0].isExpanded;
    for (let pool in this.allPoolList) {
      zeroIndexIsExpanded
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
      fundedDeficitAmount: string;
      pool: {
        address: string;
        poolFunderRewardMultiplier: string;
      };
      deposit: {
        nftID: string;
        amount: string;
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
    surplus: string;
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
