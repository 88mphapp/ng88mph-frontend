import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { request, gql } from 'graphql-request';
import BigNumber from 'bignumber.js';
import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import {
  ContractService,
  PoolInfo,
  ZeroCouponBondInfo,
} from '../../contract.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, Validators } from '@angular/forms';
import { NFTStorage, File } from 'nft.storage';
import { Web3Storage } from 'web3.storage/dist/bundle.esm.min.js';
import autosize from 'autosize';

@Component({
  selector: 'app-modal-deposit',
  templateUrl: './modal-deposit.component.html',
  styleUrls: ['./modal-deposit.component.css'],
})
export class ModalDepositComponent implements OnInit {
  @Input() defaultPoolName: string;
  @Input() inputDepositAmount: BigNumber;
  @Input() inputDepositLength: BigNumber;

  poolList: PoolInfo[];
  selectedPoolInfo: PoolInfo;
  depositTokenBalance: BigNumber;
  depositAmount: BigNumber;
  depositAmountUSD: BigNumber;
  depositTimeInDays: BigNumber;
  depositMaturation: string;
  interestAmountToken: BigNumber;
  interestAmountUSD: BigNumber;
  apy: BigNumber;
  mphRewardAmount: BigNumber;
  minDepositAmount: BigNumber;
  maxDepositPeriodInDays: number;
  totalDeposit: BigNumber;
  rewardRate: BigNumber;
  mphPriceUSD: BigNumber;
  mphAPR: BigNumber;
  shouldDisplayZap: boolean;
  selectedDepositToken: string;
  zapDepositTokens: string[];
  tokenAllowance: BigNumber;

  presetMaturity: ZeroCouponBondInfo;
  selectedZCBPools: ZeroCouponBondInfo[];

  // nft metadata
  nftStorageClient: NFTStorage;
  web3StorageClient: Web3Storage;
  name: string;
  description: string;
  imageURL: SafeUrl;
  imageFile: any;
  mediaURL: SafeUrl;
  mediaFile: any;
  audioURL: SafeUrl;
  notUpload: boolean;
  externalURL: string;
  isLoading: boolean;
  loadingMessage: string;
  attributes = this.fb.array([]);

  constructor(
    public activeModal: NgbActiveModal,
    public wallet: WalletService,
    public contract: ContractService,
    public helpers: HelpersService,
    public constants: ConstantsService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder
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
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData();
      this.loadData();
    });

    // nft
    this.nftStorageClient = new NFTStorage({
      token: this.constants.NFTSTORAGE_KEY,
    });
    this.web3StorageClient = new Web3Storage({
      token: this.constants.WEB3STORAGE_KEY,
    });
    this.isLoading = false;
    autosize(document.querySelector('textarea'));
  }

  loadData(): void {
    this.helpers.getMPHPriceUSD().then((price) => {
      this.mphPriceUSD = price;
    });
    this.poolList = this.contract.getPoolInfoList();
    this.selectPool(
      this.defaultPoolName ? this.defaultPoolName : this.poolList[0].name
    );
    this.setDepositAmount(
      this.inputDepositAmount ? this.inputDepositAmount.toFixed(18) : 0
    );
    this.setDepositTime(
      this.inputDepositLength ? this.inputDepositLength.toFixed(18) : 30
    );
  }

  resetData(): void {
    this.poolList = [];
    this.depositTokenBalance = new BigNumber(0);
    this.depositTimeInDays = new BigNumber(0);
    this.depositMaturation = new Date(
      Date.now() +
        this.depositTimeInDays
          .times(this.constants.DAY_IN_SEC)
          .times(1e3)
          .toNumber()
    ).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    this.depositAmount = new BigNumber(0);
    this.depositAmountUSD = new BigNumber(0);
    this.interestAmountToken = new BigNumber(0);
    this.interestAmountUSD = new BigNumber(0);
    this.apy = new BigNumber(0);
    this.mphRewardAmount = new BigNumber(0);
    this.minDepositAmount = new BigNumber(0);
    this.maxDepositPeriodInDays = 0;
    this.totalDeposit = new BigNumber(0);
    this.rewardRate = new BigNumber(0);
    this.mphPriceUSD = new BigNumber(0);
    this.mphAPR = new BigNumber(0);
    this.shouldDisplayZap = false;
    this.selectedDepositToken = '';
    this.zapDepositTokens = [];
    this.tokenAllowance = new BigNumber(0);

    this.presetMaturity = null;
    this.selectedZCBPools = [];
  }

  async selectPool(poolName: string) {
    this.selectedPoolInfo = this.contract.getPoolInfo(poolName);
    // only display ZCB pools that aren't mature
    const selectedZCBPools = this.contract.getZeroCouponBondPool(poolName);
    this.selectedZCBPools = selectedZCBPools
      ? selectedZCBPools.filter(
          (zcbInfo) => zcbInfo.maturationTimestamp > Date.now() / 1e3
        )
      : [];
    this.shouldDisplayZap = !!this.selectedPoolInfo.zapDepositTokens;
    this.selectedDepositToken = this.selectedPoolInfo.stablecoinSymbol;
    this.zapDepositTokens = [this.selectedPoolInfo.stablecoinSymbol].concat(
      this.selectedPoolInfo.zapDepositTokens
    );

    let rewardRate = new BigNumber(0);
    const vest = this.contract.getNamedContract('Vesting03');

    if (vest.options.address) {
      rewardRate = await vest.methods
        .rewardRate(this.selectedPoolInfo.address)
        .call();
    }
    this.rewardRate = new BigNumber(rewardRate);

    const queryString = gql`
      {
        dpools (
          where: {
            id_in: ["${
              this.selectedPoolInfo.address
            }", "${this.selectedPoolInfo.address.toLowerCase()}"]
          }
        ) {
          id
          totalDeposit
          MinDepositAmount
          MaxDepositPeriod
        }
      }
    `;
    await request(
      this.constants.GRAPHQL_ENDPOINT[this.wallet.networkID],
      queryString
    ).then((data: QueryResult) => {
      const pool = data.dpools[0];
      this.minDepositAmount = new BigNumber(pool.MinDepositAmount);
      this.maxDepositPeriodInDays = Math.floor(
        pool.MaxDepositPeriod / this.constants.DAY_IN_SEC
      );
      this.totalDeposit = new BigNumber(pool.totalDeposit);
    });

    let userAddress: string = this.wallet.actualAddress;

    if (this.wallet.connected) {
      const stablecoin = this.contract.getPoolStablecoin(poolName);
      const stablecoinPrecision = Math.pow(
        10,
        this.selectedPoolInfo.stablecoinDecimals
      );
      this.depositTokenBalance = new BigNumber(
        await stablecoin.methods.balanceOf(userAddress).call()
      ).div(stablecoinPrecision);
      this.tokenAllowance = new BigNumber(
        await stablecoin.methods
          .allowance(userAddress, this.selectedPoolInfo.address)
          .call()
      ).div(stablecoinPrecision);
    }

    this.updateAPY();
  }

  async selectZapDepositToken(tokenSymbol: string) {
    this.selectedDepositToken = tokenSymbol;
    if (this.wallet.connected) {
      if (
        this.selectedDepositToken === this.selectedPoolInfo.stablecoinSymbol
      ) {
        const stablecoin = this.contract.getPoolStablecoin(
          this.selectedPoolInfo.name
        );
        const stablecoinPrecision = Math.pow(
          10,
          this.selectedPoolInfo.stablecoinDecimals
        );
        this.depositTokenBalance = new BigNumber(
          await stablecoin.methods.balanceOf(this.wallet.userAddress).call()
        ).div(stablecoinPrecision);
      } else {
        const tokenAddress =
          this.contract.getZapDepositTokenAddress(tokenSymbol);
        if (tokenAddress === this.constants.ZERO_ADDR) {
          // ETH
          this.depositTokenBalance = new BigNumber(
            await this.wallet.web3.eth.getBalance(this.wallet.userAddress)
          ).div(this.constants.PRECISION);
        } else {
          // ERC20
          const token = this.contract.getERC20(tokenAddress);
          const tokenDecimals = +(await token.methods.decimals().call());
          const tokenPrecision = Math.pow(10, tokenDecimals);
          this.depositTokenBalance = new BigNumber(
            await token.methods.balanceOf(this.wallet.userAddress).call()
          ).div(tokenPrecision);
        }
      }
    }
  }

  setDepositAmount(amount: string | number): void {
    this.depositAmount = new BigNumber(amount);
    if (this.depositAmount.isNaN()) {
      this.depositAmount = new BigNumber(0);
    }
    this.updateAPY();
  }

  presetDepositAmount(percent: string | number): void {
    const ratio = new BigNumber(percent).div(100);
    this.depositAmount = this.depositTokenBalance.times(ratio);
    this.updateAPY();
  }

  setDepositTime(timeInDays: number | string): void {
    this.presetMaturity = null;
    this.depositTimeInDays = new BigNumber(+timeInDays);
    if (this.depositTimeInDays.isNaN()) {
      this.depositTimeInDays = new BigNumber(0);
    }
    this.depositMaturation = new Date(
      Date.now() +
        this.depositTimeInDays
          .times(this.constants.DAY_IN_SEC)
          .times(1e3)
          .toNumber()
    ).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    this.updateAPY();
  }

  async setPresetMaturity() {
    if (this.presetMaturity) {
      const zcb = this.contract.getZeroCouponBondContract(
        this.presetMaturity.address
      );
      const maturationTimestamp = new BigNumber(
        await zcb.methods.maturationTimestamp().call()
      );
      this.depositTimeInDays = new BigNumber(
        maturationTimestamp
          .minus(new BigNumber(Date.now()).div(1e3))
          .div(this.constants.DAY_IN_SEC)
          .dp(0)
      );
      this.depositMaturation = new Date(
        Date.now() +
          this.depositTimeInDays
            .times(this.constants.DAY_IN_SEC)
            .times(1e3)
            .toNumber()
      ).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      this.updateAPY();
    }
  }

  async updateAPY() {
    const web3 = this.wallet.httpsWeb3();
    const pool = this.contract.getPool(this.selectedPoolInfo.name, web3);
    const feeModelAddress = await pool.methods.feeModel().call();
    const feeModelContract = this.contract.getContract(
      feeModelAddress,
      'IFeeModel',
      web3
    );

    const stablecoinPrice = await this.helpers.getTokenPriceUSD(
      this.selectedPoolInfo.stablecoin,
      this.wallet.networkID
    );

    // get deposit amount
    this.depositAmountUSD = new BigNumber(this.depositAmount).times(
      stablecoinPrice
    );

    // get interest amount
    const stablecoinPrecision = Math.pow(
      10,
      this.selectedPoolInfo.stablecoinDecimals
    );
    const depositAmount = this.helpers.processWeb3Number(
      this.depositAmount.times(stablecoinPrecision)
    );
    const depositTime = this.helpers.processWeb3Number(
      this.depositTimeInDays.times(this.constants.DAY_IN_SEC)
    );
    const rawInterestAmountToken = new BigNumber(
      await pool.methods
        .calculateInterestAmount(depositAmount, depositTime)
        .call()
    );
    const interestAmountToken = await this.helpers.applyFeeToInterest(
      rawInterestAmountToken,
      this.selectedPoolInfo
    );
    this.interestAmountToken = interestAmountToken.div(stablecoinPrecision);
    this.interestAmountUSD = interestAmountToken
      .div(stablecoinPrecision)
      .times(stablecoinPrice);

    // get APR
    this.apy = this.interestAmountToken
      .div(this.depositAmount)
      .div(depositTime)
      .times(this.constants.YEAR_IN_SEC)
      .times(100);
    if (this.apy.isNaN()) {
      this.apy = new BigNumber(0);
    }

    const mphAPR = this.rewardRate
      .times(this.constants.YEAR_IN_SEC)
      .div(this.constants.PRECISION)
      .times(this.mphPriceUSD)
      .div(this.totalDeposit.plus(this.depositAmount))
      .div(stablecoinPrice)
      .times(100);
    this.mphAPR = mphAPR.isNaN() ? new BigNumber(0) : mphAPR;

    // estimate the MPH reward amount for the deposit duration
    const mphAmount = this.rewardRate
      .div(this.constants.PRECISION)
      .times(depositTime)
      .times(this.depositAmount)
      .div(this.totalDeposit.plus(this.depositAmount));
    this.mphRewardAmount = mphAmount.isNaN() ? new BigNumber(0) : mphAmount;
  }

  approve() {
    const userAddress: string = this.wallet.actualAddress;
    const stablecoin = this.contract.getPoolStablecoin(
      this.selectedPoolInfo.name
    );
    const stablecoinPrecision = Math.pow(
      10,
      this.selectedPoolInfo.stablecoinDecimals
    );
    const depositAmount = this.helpers.processWeb3Number(
      this.depositAmount.times(stablecoinPrecision)
    );
    this.wallet.approveToken(
      stablecoin,
      this.selectedPoolInfo.address,
      depositAmount,
      () => {},
      () => {},
      async () => {
        const web3 = this.wallet.httpsWeb3();
        const stablecoin = this.contract.getPoolStablecoin(
          this.selectedPoolInfo.name,
          web3
        );
        await stablecoin.methods
          .allowance(userAddress, this.selectedPoolInfo.address)
          .call()
          .then((result) => {
            this.tokenAllowance = new BigNumber(result).div(
              stablecoinPrecision
            );
          });
      },
      (error) => {
        this.wallet.displayGenericError(error);
      },
      true
    );
  }

  deposit() {
    if (this.selectedDepositToken === this.selectedPoolInfo.stablecoinSymbol) {
      this.normalDeposit();
    } else {
      this.zapCurveDeposit();
    }
  }

  async normalDeposit() {
    const stablecoin = this.contract.getPoolStablecoin(
      this.selectedPoolInfo.name
    );
    const stablecoinPrecision = Math.pow(
      10,
      this.selectedPoolInfo.stablecoinDecimals
    );
    const depositAmount = this.helpers.processWeb3Number(
      this.depositAmount.times(stablecoinPrecision)
    );
    const maturationTimestamp = this.helpers.processWeb3Number(
      this.depositTimeInDays
        .times(this.constants.DAY_IN_SEC)
        .plus(Date.now() / 1e3)
    );

    const zcb: boolean = this.presetMaturity !== null;

    if (!zcb) {
      const pool = this.contract.getPool(this.selectedPoolInfo.name);
      let func;
      if (this.name && this.imageURL && this.description) {
        const uri = await this.uploadMetadata();
        func = pool.methods.deposit(depositAmount, maturationTimestamp, 0, uri);
      } else {
        func = pool.methods.deposit(depositAmount, maturationTimestamp);
      }

      this.wallet.sendTxWithToken(
        func,
        stablecoin,
        this.selectedPoolInfo.address,
        depositAmount,
        () => {
          this.activeModal.dismiss();
        },
        () => {},
        () => {},
        (error) => {
          this.wallet.displayGenericError(error);
        }
      );
    } else {
      const zcbContract = this.contract.getZeroCouponBondContract(
        this.presetMaturity.address
      );
      const func = zcbContract.methods.mint(depositAmount);

      this.wallet.sendTxWithToken(
        func,
        stablecoin,
        this.presetMaturity.address,
        depositAmount,
        (hash) => {
          this.activeModal.dismiss();
        },
        () => {},
        () => {},
        (error) => {
          this.wallet.displayGenericError(error);
        }
      );
    }
  }

  // @dev only works on mainnet since zapper only exists on mainnet
  // TODO: switch to v3 version of CurveZapIn
  // TODO: add ability to use custom NFT metadata
  async zapCurveDeposit() {
    const slippage = 0.01;
    const tokenAddress = this.contract.getZapDepositTokenAddress(
      this.selectedDepositToken
    );
    const maturationTimestamp = this.helpers.processWeb3Number(
      this.depositTimeInDays
        .times(this.constants.DAY_IN_SEC)
        .plus(Date.now() / 1e3)
    );

    if (tokenAddress === this.constants.ZERO_ADDR) {
      // ETH deposit
      const depositAmount = this.helpers.processWeb3Number(
        this.depositAmount.times(this.constants.PRECISION)
      );

      let funcZapIn = this.contract
        .getNamedContract('CurveZapIn')
        .methods.ZapIn(
          tokenAddress,
          tokenAddress,
          this.selectedPoolInfo.curveSwapAddress,
          depositAmount,
          0,
          this.constants.ZERO_ADDR,
          '0x',
          this.constants.ZERO_ADDR
        );

      const curveOutputValue = new BigNumber(
        await funcZapIn.call({
          from: this.wallet.userAddress,
          value: depositAmount,
        })
      );
      const minOutputTokenAmount = this.helpers.processWeb3Number(
        curveOutputValue.times(1 - slippage)
      );

      if (
        curveOutputValue.lt(
          this.minDepositAmount.times(this.constants.PRECISION)
        )
      ) {
        // output curve tokens less than minimum threshold
        this.wallet.displayGenericError(
          new Error(
            'Output Curve LP token amount less than minimum deposit threshold.'
          )
        );
        return;
      }

      funcZapIn = this.contract
        .getNamedContract('CurveZapIn')
        .methods.ZapIn(
          tokenAddress,
          tokenAddress,
          this.selectedPoolInfo.curveSwapAddress,
          depositAmount,
          minOutputTokenAmount,
          this.constants.ZERO_ADDR,
          '0x',
          this.constants.ZERO_ADDR
        );

      this.wallet.sendTxWithValue(
        funcZapIn,
        depositAmount,
        () => {},
        (receipt) => {
          let outputAmount;
          for (const eventKey of Object.keys(receipt.events)) {
            const event = receipt.events[eventKey];
            if (
              event.address.toLowerCase() ===
              this.selectedPoolInfo.stablecoin.toLowerCase()
            ) {
              // is mint event
              outputAmount = event.raw.data;
              break;
            }
          }

          const zcb: boolean = this.presetMaturity !== null;
          const stablecoin = this.contract.getPoolStablecoin(
            this.selectedPoolInfo.name
          );

          if (!zcb) {
            const pool = this.contract.getPool(this.selectedPoolInfo.name);
            const funcDeposit = pool.methods.deposit(
              outputAmount,
              maturationTimestamp
            );

            this.wallet.sendTxWithToken(
              funcDeposit,
              stablecoin,
              this.selectedPoolInfo.address,
              outputAmount,
              () => {
                this.activeModal.dismiss();
              },
              () => {},
              () => {},
              (error) => {
                this.wallet.displayGenericError(error);
              }
            );
          } else {
            const zcbContract = this.contract.getZeroCouponBondContract(
              this.presetMaturity.address
            );
            const funcDeposit = zcbContract.methods.mint(outputAmount);

            this.wallet.sendTxWithToken(
              funcDeposit,
              stablecoin,
              this.presetMaturity.address,
              outputAmount,
              () => {
                this.activeModal.dismiss();
              },
              () => {},
              () => {},
              (error) => {
                this.wallet.displayGenericError(error);
              }
            );
          }
        },
        () => {},
        (error) => {
          this.wallet.displayGenericError(error);
        }
      );
    } else {
      // ERC20 deposit
      const token = this.contract.getERC20(tokenAddress);
      const tokenDecimals = +(await token.methods.decimals().call());
      const tokenPrecision = Math.pow(10, tokenDecimals);
      const depositAmount = this.helpers.processWeb3Number(
        this.depositAmount.times(tokenPrecision)
      );

      this.wallet.approveToken(
        token,
        this.contract.getNamedContractAddress('CurveZapIn'),
        depositAmount,
        () => {},
        async () => {
          let funcZapIn = this.contract
            .getNamedContract('CurveZapIn')
            .methods.ZapIn(
              tokenAddress,
              tokenAddress,
              this.selectedPoolInfo.curveSwapAddress,
              depositAmount,
              0,
              this.constants.ZERO_ADDR,
              '0x',
              this.constants.ZERO_ADDR
            );

          const curveOutputValue = new BigNumber(
            await funcZapIn.call({ from: this.wallet.userAddress })
          );
          const minOutputTokenAmount = this.helpers.processWeb3Number(
            curveOutputValue.times(1 - slippage)
          );

          if (
            curveOutputValue.lt(
              this.minDepositAmount.times(
                Math.pow(10, this.selectedPoolInfo.stablecoinDecimals)
              )
            )
          ) {
            // output curve tokens less than minimum threshold
            this.wallet.displayGenericError(
              new Error(
                'Output Curve LP token amount less than minimum deposit threshold.'
              )
            );
            return;
          }

          funcZapIn = this.contract
            .getNamedContract('CurveZapIn')
            .methods.ZapIn(
              tokenAddress,
              tokenAddress,
              this.selectedPoolInfo.curveSwapAddress,
              depositAmount,
              minOutputTokenAmount,
              this.constants.ZERO_ADDR,
              '0x',
              this.constants.ZERO_ADDR
            );

          this.wallet.sendTx(
            funcZapIn,
            () => {},
            (receipt) => {
              let outputAmount;
              for (const eventKey of Object.keys(receipt.events)) {
                const event = receipt.events[eventKey];
                if (
                  event.address.toLowerCase() ===
                  this.selectedPoolInfo.stablecoin.toLowerCase()
                ) {
                  // is mint event
                  outputAmount = event.raw.data;
                  break;
                }
              }

              const zcb: boolean = this.presetMaturity !== null;
              const stablecoin = this.contract.getPoolStablecoin(
                this.selectedPoolInfo.name
              );

              if (!zcb) {
                const pool = this.contract.getPool(this.selectedPoolInfo.name);
                const funcDeposit = pool.methods.deposit(
                  outputAmount,
                  maturationTimestamp
                );

                this.wallet.sendTxWithToken(
                  funcDeposit,
                  stablecoin,
                  this.selectedPoolInfo.address,
                  outputAmount,
                  () => {
                    this.activeModal.dismiss();
                  },
                  () => {},
                  () => {},
                  (error) => {
                    this.wallet.displayGenericError(error);
                  }
                );
              } else {
                const zcbContract = this.contract.getZeroCouponBondContract(
                  this.presetMaturity.address
                );
                const funcDeposit = zcbContract.methods.mint(outputAmount);

                this.wallet.sendTxWithToken(
                  funcDeposit,
                  stablecoin,
                  this.presetMaturity.address,
                  outputAmount,
                  () => {
                    this.activeModal.dismiss();
                  },
                  () => {},
                  () => {},
                  (error) => {
                    this.wallet.displayGenericError(error);
                  }
                );
              }
            },
            () => {},
            (error) => {
              this.wallet.displayGenericError(error);
            }
          );
        },
        () => {},
        (error) => {
          this.wallet.displayGenericError(error);
        }
      );

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
    return (
      this.wallet.connected &&
      this.depositAmount.gte(this.minDepositAmount) &&
      this.depositTimeInDays.lte(this.maxDepositPeriodInDays) &&
      this.depositTokenBalance.gte(this.depositAmount) &&
      this.tokenAllowance.gte(this.depositAmount)
    );
  }

  async updateImageFile(files) {
    this.imageFile = files.item(0);
    this.imageURL = this.sanitizer.bypassSecurityTrustUrl(
      URL.createObjectURL(this.imageFile)
    );
  }

  async updateMediaFile(files) {
    this.mediaFile = files.item(0);
    this.mediaURL = this.sanitizer.bypassSecurityTrustUrl(
      URL.createObjectURL(this.mediaFile)
    );
    this.audioURL = '../../assets/img/cassette_tape.gif';
  }

  addAttribute(trait_type?: string, value?: string) {
    const newAttribute = this.fb.group({
      trait_type: [trait_type ? trait_type : '', Validators.required],
      value: [value ? value : '', Validators.required],
    });
    this.attributes.push(newAttribute);
  }

  deleteAttribute(i) {
    this.attributes.removeAt(i);
  }

  private async uploadMetadata(): Promise<string> {
    this.isLoading = true;
    this.loadingMessage = 'Uploading metadata to IPFS...';

    // Parse through attributes
    let attributesList = [];
    for (let i = 0; i < this.attributes.length; i++) {
      let item = (this.attributes.at(i) as any).controls;
      let a = {};
      a['trait_type'] = item.trait_type.value;
      a['value'] = item.value.value;
      attributesList.push(a);
    }

    let largeMediaFile = [];
    let largeMediaFileURL;
    if (this.mediaFile && this.mediaFile.size > 1000000 * 100) {
      // > 100MB
      largeMediaFile.push(
        new File([this.mediaFile], this.mediaFile.name, {
          type: this.mediaFile.type,
        })
      );
      const largeMediaFileCID = await this.web3StorageClient.put(
        largeMediaFile,
        {
          name: encodeURIComponent(this.mediaFile.name),
          maxRetries: 3,
        }
      );
      largeMediaFileURL = `ipfs://${largeMediaFileCID}/${encodeURIComponent(
        this.mediaFile.name
      )}`;
    }

    let metadata;
    if (this.mediaFile) {
      metadata = {
        name: this.name,
        image: new File(
          [this.imageFile],
          encodeURIComponent(this.imageFile.name),
          {
            type: this.imageFile.type,
          }
        ),
        animation_url: largeMediaFileURL
          ? largeMediaFileURL
          : new File(
              [this.mediaFile],
              encodeURIComponent(this.mediaFile.name),
              {
                type: this.mediaFile.type,
              }
            ),
        description: this.description,
        external_url: this.externalURL,
        attributes: attributesList,
      };
    } else {
      metadata = {
        name: this.name,
        image: new File(
          [this.imageFile],
          encodeURIComponent(this.imageFile.name),
          {
            type: this.imageFile.type,
          }
        ),
        description: this.description,
        external_url: this.externalURL,
        attributes: attributesList,
      };
    }

    const uploadResult = await this.nftStorageClient.store(metadata);

    this.isLoading = false;

    return uploadResult.url;
  }
}

interface QueryResult {
  dpools: {
    id: string;
    totalDeposit: string;
    MinDepositAmount: number;
    MaxDepositPeriod: number;
  }[];
}
