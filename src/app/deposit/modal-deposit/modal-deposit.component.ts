import { Component, Input, OnInit } from '@angular/core';
import { gql } from '@apollo/client/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo } from 'apollo-angular';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { ContractService, PoolInfo } from '../../contract.service';

@Component({
  selector: 'app-modal-deposit',
  templateUrl: './modal-deposit.component.html',
  styleUrls: ['./modal-deposit.component.css']
})
export class ModalDepositComponent implements OnInit {
  DEPOSIT_DELAY = 20 * 60; // 20 minutes
  DEPOSIT_PERIOD_PRESETS = [7, 14, 30, 60, 90, 180, 365];

  @Input() defaultPoolName: string;

  poolList: PoolInfo[];
  selectedPoolInfo: PoolInfo;
  depositTokenBalance: BigNumber;
  depositAmount: BigNumber;
  depositAmountUSD: BigNumber;
  depositTimeInDays: BigNumber;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  apy: BigNumber;
  mphRewardAmount: BigNumber;
  mphTakeBackAmount: BigNumber;
  minDepositAmount: BigNumber;
  maxDepositAmount: BigNumber;
  minDepositPeriod: number;
  maxDepositPeriod: number;
  mphPriceUSD: BigNumber;
  mphAPY: BigNumber;
  tempMPHAPY: BigNumber;
  mphDepositorRewardMintMultiplier: BigNumber;
  mphDepositorRewardTakeBackMultiplier: BigNumber;
  shouldDisplayZap: boolean;
  selectedDepositToken: string;
  zapDepositTokens: string[];

  constructor(
    private apollo: Apollo,
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService
  ) {
    this.resetData();
  }

  ngOnInit(): void {
    this.loadData();
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData();
      this.loadData();
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData();
    });
  }

  loadData(): void {
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
    this.poolList = this.contract.getPoolInfoList();
    this.selectPool(this.defaultPoolName ? this.defaultPoolName : this.poolList[0].name);
  }

  resetData(): void {
    this.poolList = [];
    this.depositTokenBalance = new BigNumber(0);
    this.depositTimeInDays = new BigNumber(365);
    this.depositAmount = new BigNumber(0);
    this.depositAmountUSD = new BigNumber(0);
    this.interestAmountToken = new BigNumber(0);
    this.interestAmountUSD = new BigNumber(0);
    this.apy = new BigNumber(0);
    this.mphRewardAmount = new BigNumber(0);
    this.mphTakeBackAmount = new BigNumber(0);
    this.minDepositAmount = new BigNumber(0);
    this.maxDepositAmount = new BigNumber(0);
    this.minDepositPeriod = 0;
    this.maxDepositPeriod = 1e4;
    this.mphPriceUSD = new BigNumber(0);
    this.mphAPY = new BigNumber(0);
    this.tempMPHAPY = new BigNumber(0);
    this.mphDepositorRewardMintMultiplier = new BigNumber(0);
    this.mphDepositorRewardTakeBackMultiplier = new BigNumber(0);
    this.shouldDisplayZap = false;
    this.selectedDepositToken = '';
    this.zapDepositTokens = [];
  }

  async selectPool(poolName: string) {
    this.selectedPoolInfo = this.contract.getPoolInfo(poolName);
    this.shouldDisplayZap = !!this.selectedPoolInfo.zapDepositTokens;
    this.selectedDepositToken = this.selectedPoolInfo.stablecoinSymbol;
    this.zapDepositTokens = [this.selectedPoolInfo.stablecoinSymbol].concat(this.selectedPoolInfo.zapDepositTokens);

    const queryString = gql`
      {
        dpool(id: "${this.selectedPoolInfo.address.toLowerCase()}") {
          id
          MinDepositAmount
          MaxDepositAmount
          MinDepositPeriod
          MaxDepositPeriod
          mphDepositorRewardMintMultiplier
          mphDepositorRewardTakeBackMultiplier
        }
      }
    `;
    this.apollo.query<QueryResult>({
      query: queryString
    }).subscribe((x) => {
      const pool = x.data.dpool;
      this.minDepositAmount = new BigNumber(pool.MinDepositAmount);
      this.maxDepositAmount = new BigNumber(pool.MaxDepositAmount);
      this.minDepositPeriod = Math.ceil(pool.MinDepositPeriod / this.constants.DAY_IN_SEC);
      this.maxDepositPeriod = Math.floor(pool.MaxDepositPeriod / this.constants.DAY_IN_SEC);
      this.mphDepositorRewardMintMultiplier = new BigNumber(pool.mphDepositorRewardMintMultiplier);
      this.mphDepositorRewardTakeBackMultiplier = new BigNumber(pool.mphDepositorRewardTakeBackMultiplier);
    });

    if (this.wallet.connected) {
      const stablecoin = this.contract.getPoolStablecoin(poolName);
      const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
      this.depositTokenBalance = new BigNumber(await stablecoin.methods.balanceOf(this.wallet.userAddress).call()).div(stablecoinPrecision);
    }

    this.updateAPY();
  }

  async selectZapDepositToken(tokenSymbol: string) {
    this.selectedDepositToken = tokenSymbol;
    if (this.wallet.connected) {
      if (this.selectedDepositToken === this.selectedPoolInfo.stablecoinSymbol) {
        const stablecoin = this.contract.getPoolStablecoin(this.selectedPoolInfo.name);
        const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
        this.depositTokenBalance = new BigNumber(await stablecoin.methods.balanceOf(this.wallet.userAddress).call()).div(stablecoinPrecision);
      } else {
        const tokenAddress = this.contract.getZapDepositTokenAddress(tokenSymbol);
        if (tokenAddress === this.constants.ZERO_ADDR) {
          // ETH
          this.depositTokenBalance = new BigNumber(await this.wallet.web3.eth.getBalance(this.wallet.userAddress)).div(this.constants.PRECISION);
        } else {
          // ERC20
          const token = this.contract.getERC20(tokenAddress);
          const tokenDecimals = +await token.methods.decimals().call();
          const tokenPrecision = Math.pow(10, tokenDecimals);
          this.depositTokenBalance = new BigNumber(await token.methods.balanceOf(this.wallet.userAddress).call()).div(tokenPrecision);
        }
      }
    }
  }

  setDepositAmount(amount: string): void {
    this.depositAmount = new BigNumber(+amount);
    this.updateAPY();
  }

  setMaxDepositAmount(): void {
    this.depositAmount = BigNumber.min(this.depositTokenBalance, this.maxDepositAmount);
    this.updateAPY();
  }

  setDepositTime(timeInDays: number | string): void {
    this.depositTimeInDays = new BigNumber(+timeInDays);
    this.updateAPY();
  }

  async updateAPY() {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.selectedPoolInfo.name, readonlyWeb3);
    const stablecoinPrice = await this.helpers.getTokenPriceUSD(this.selectedPoolInfo.stablecoin);

    // get deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmount).times(stablecoinPrice);

    // get interest amount
    const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(stablecoinPrecision));
    const depositTime = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.constants.DAY_IN_SEC));
    const rawInterestAmountToken = new BigNumber(await pool.methods.calculateInterestAmount(depositAmount, depositTime).call()).div(stablecoinPrecision);
    const rawInterestAmountUSD = rawInterestAmountToken.times(stablecoinPrice);
    this.interestAmountToken = this.helpers.applyFeeToInterest(rawInterestAmountToken, this.selectedPoolInfo);
    this.interestAmountUSD = this.helpers.applyFeeToInterest(rawInterestAmountUSD, this.selectedPoolInfo);

    // get APY
    this.apy = this.interestAmountToken.div(this.depositAmount).div(this.depositTimeInDays).times(365).times(100);
    if (this.apy.isNaN()) {
      this.apy = new BigNumber(0);
    }

    // get MPH reward amount
    this.mphRewardAmount = this.mphDepositorRewardMintMultiplier.times(this.depositAmount).times(depositTime);
    this.mphTakeBackAmount = this.mphDepositorRewardTakeBackMultiplier.times(this.mphRewardAmount);

    const mphAPY = this.mphRewardAmount.minus(this.mphTakeBackAmount).times(this.mphPriceUSD).div(this.depositAmountUSD).div(this.depositTimeInDays).times(365).times(100);
    if (mphAPY.isNaN()) {
      this.mphAPY = new BigNumber(0);
    } else {
      this.mphAPY = mphAPY;
    }

    const tempMPHAPY = this.mphRewardAmount.times(this.mphPriceUSD).div(this.depositAmountUSD).div(this.depositTimeInDays).times(365).times(100);
    if (tempMPHAPY.isNaN()) {
      this.tempMPHAPY = new BigNumber(0);
    } else {
      this.tempMPHAPY = tempMPHAPY;
    }
  }

  deposit() {
    if (this.selectedDepositToken === this.selectedPoolInfo.stablecoinSymbol) {
      this.normalDeposit();
    } else {
      this.zapCurveDeposit();
    }
  }

  normalDeposit() {
    const pool = this.contract.getPool(this.selectedPoolInfo.name);
    const stablecoin = this.contract.getPoolStablecoin(this.selectedPoolInfo.name);
    const stablecoinPrecision = Math.pow(10, this.selectedPoolInfo.stablecoinDecimals);
    const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(stablecoinPrecision));
    const maturationTimestamp = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.constants.DAY_IN_SEC).plus(Date.now() / 1e3).plus(this.DEPOSIT_DELAY));
    const func = pool.methods.deposit(depositAmount, maturationTimestamp);

    this.wallet.sendTxWithToken(func, stablecoin, this.selectedPoolInfo.address, depositAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
  }

  async zapCurveDeposit() {
    const slippage = 0.01;
    const tokenAddress = this.contract.getZapDepositTokenAddress(this.selectedDepositToken);
    const maturationTimestamp = this.helpers.processWeb3Number(this.depositTimeInDays.times(this.constants.DAY_IN_SEC).plus(Date.now() / 1e3).plus(this.DEPOSIT_DELAY));

    if (tokenAddress === this.constants.ZERO_ADDR) {
      // ETH deposit
      const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(this.constants.PRECISION));

      let funcZapIn = this.contract.getNamedContract('CurveZapIn').methods.ZapIn(
        tokenAddress,
        tokenAddress,
        this.selectedPoolInfo.curveSwapAddress,
        depositAmount,
        0,
        this.constants.ZERO_ADDR,
        '0x',
        this.constants.ZERO_ADDR
      );

      const curveOutputValue = new BigNumber(await funcZapIn.call({ from: this.wallet.userAddress, value: depositAmount }));
      const minOutputTokenAmount = this.helpers.processWeb3Number(curveOutputValue.times(1 - slippage));

      if (curveOutputValue.lt(this.minDepositAmount.times(this.constants.PRECISION))) {
        // output curve tokens less than minimum threshold
        this.wallet.displayGenericError(new Error('Output Curve LP token amount less than minimum deposit threshold.'));
        return;
      }

      funcZapIn = this.contract.getNamedContract('CurveZapIn').methods.ZapIn(
        tokenAddress,
        tokenAddress,
        this.selectedPoolInfo.curveSwapAddress,
        depositAmount,
        minOutputTokenAmount,
        this.constants.ZERO_ADDR,
        '0x',
        this.constants.ZERO_ADDR
      );

      this.wallet.sendTxWithValue(funcZapIn, depositAmount, () => { }, (receipt) => {
        let outputAmount;
        for (const eventKey of Object.keys(receipt.events)) {
          const event = receipt.events[eventKey];
          if (event.address.toLowerCase() === this.selectedPoolInfo.stablecoin.toLowerCase()) {
            // is mint event
            outputAmount = event.raw.data;
            break;
          }
        }

        const pool = this.contract.getPool(this.selectedPoolInfo.name);
        const stablecoin = this.contract.getPoolStablecoin(this.selectedPoolInfo.name);
        const funcDeposit = pool.methods.deposit(outputAmount, maturationTimestamp);
        this.wallet.sendTxWithToken(funcDeposit, stablecoin, this.selectedPoolInfo.address, outputAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
      }, (error) => { this.wallet.displayGenericError(error) });
    } else {
      // ERC20 deposit
      const token = this.contract.getERC20(tokenAddress);
      const tokenDecimals = +await token.methods.decimals().call();
      const tokenPrecision = Math.pow(10, tokenDecimals);
      const depositAmount = this.helpers.processWeb3Number(this.depositAmount.times(tokenPrecision));

      this.wallet.approveToken(token, this.contract.getNamedContractAddress('CurveZapIn'), depositAmount, () => { }, async () => {
        let funcZapIn = this.contract.getNamedContract('CurveZapIn').methods.ZapIn(
          tokenAddress,
          tokenAddress,
          this.selectedPoolInfo.curveSwapAddress,
          depositAmount,
          0,
          this.constants.ZERO_ADDR,
          '0x',
          this.constants.ZERO_ADDR
        );

        const curveOutputValue = new BigNumber(await funcZapIn.call({ from: this.wallet.userAddress }));
        const minOutputTokenAmount = this.helpers.processWeb3Number(curveOutputValue.times(1 - slippage));

        if (curveOutputValue.lt(this.minDepositAmount.times(Math.pow(10, this.selectedPoolInfo.stablecoinDecimals)))) {
          // output curve tokens less than minimum threshold
          this.wallet.displayGenericError(new Error('Output Curve LP token amount less than minimum deposit threshold.'));
          return;
        }

        funcZapIn = this.contract.getNamedContract('CurveZapIn').methods.ZapIn(
          tokenAddress,
          tokenAddress,
          this.selectedPoolInfo.curveSwapAddress,
          depositAmount,
          minOutputTokenAmount,
          this.constants.ZERO_ADDR,
          '0x',
          this.constants.ZERO_ADDR
        );

        this.wallet.sendTx(funcZapIn, () => { }, (receipt) => {
          let outputAmount;
          for (const eventKey of Object.keys(receipt.events)) {
            const event = receipt.events[eventKey];
            if (event.address.toLowerCase() === this.selectedPoolInfo.stablecoin.toLowerCase()) {
              // is mint event
              outputAmount = event.raw.data;
              break;
            }
          }

          const pool = this.contract.getPool(this.selectedPoolInfo.name);
          const stablecoin = this.contract.getPoolStablecoin(this.selectedPoolInfo.name);
          const funcDeposit = pool.methods.deposit(outputAmount, maturationTimestamp);
          this.wallet.sendTxWithToken(funcDeposit, stablecoin, this.selectedPoolInfo.address, outputAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });
        }, (error) => { this.wallet.displayGenericError(error) });
      }, (error) => { this.wallet.displayGenericError(error) });

      /*const func = this.contract.getNamedContract('ZapCurve').methods.zapCurveDeposit(
        this.selectedPoolInfo.address,
        this.selectedPoolInfo.curveSwapAddress,
        tokenAddress,
        depositAmount,
        minOutputTokenAmount,
        maturationTimestamp
      );
  
      this.wallet.sendTxWithToken(func, token, this.contract.getNamedContractAddress('ZapCurve'), depositAmount, () => { }, () => { this.activeModal.dismiss() }, (error) => { this.wallet.displayGenericError(error) });*/
    }
  }

  canContinue() {
    return this.wallet.connected && this.depositAmount.gte(this.minDepositAmount) && this.depositAmount.lte(this.maxDepositAmount)
      && this.depositTimeInDays.gte(this.minDepositPeriod) && this.depositTimeInDays.lte(this.maxDepositPeriod);
  }
}

interface QueryResult {
  dpool: {
    id: string;
    MinDepositAmount: number;
    MaxDepositAmount: number;
    MinDepositPeriod: number;
    MaxDepositPeriod: number;
    mphDepositorRewardMintMultiplier: number;
    mphDepositorRewardTakeBackMultiplier: number;
  };
}