import { Injectable, Output, EventEmitter } from '@angular/core';
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from 'ethereum-multicall';
import { request, gql } from 'graphql-request';
import BigNumber from 'bignumber.js';

import { ConstantsService } from 'src/app/constants.service';
import { HelpersService } from 'src/app/helpers.service';
import { TimeSeriesService } from 'src/app/timeseries.service';
import { WalletService } from 'src/app/wallet.service';

import { MPH_DEPLOYMENT_TIMESTAMP } from 'src/app/constants/deployments';

@Injectable({
  providedIn: 'root',
})
export class MphService {
  @Output() loadedEvent = new EventEmitter();
  price: BigNumber = new BigNumber(0);
  totalSupply: BigNumber = new BigNumber(0);
  circulatingSupply: BigNumber = new BigNumber(0);
  supplyDistribution: Dataset = Object.create({});

  constructor(
    public constants: ConstantsService,
    public helpers: HelpersService,
    public timeseries: TimeSeriesService,
    public wallet: WalletService
  ) {
    this.loadData();
  }

  loadData() {
    Promise.all([
      this.fetchPrice(),
      this.fetchSupply(this.constants.CHAIN_ID.MAINNET),
      this.fetchSupplyDistribution(this.constants.CHAIN_ID.MAINNET),
    ]).then(() => {
      this.loadedEvent.emit();
    });
  }

  async fetchPrice() {
    this.price = await this.helpers.getMPHPriceUSD();
  }

  async fetchSupply(networkID: number) {
    const web3 = this.wallet.httpsWeb3(networkID);
    const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });

    const context: ContractCallContext[] = [
      {
        reference: 'MPH',
        contractAddress: this.constants.MPH_ADDRESS[networkID],
        abi: require(`src/assets/abis/MPHToken.json`),
        calls: [
          {
            reference: 'Total Supply',
            methodName: 'totalSupply',
            methodParameters: [],
          },
          {
            reference: 'Gov Treasury Balance',
            methodName: 'balanceOf',
            methodParameters: [this.constants.GOV_TREASURY[networkID]],
          },
          {
            reference: 'Dev Wallet Balance',
            methodName: 'balanceOf',
            methodParameters: [this.constants.DEV_WALLET[networkID]],
          },
          {
            reference: 'Merkle Distributor',
            methodName: 'balanceOf',
            methodParameters: [this.constants.MERKLE_DISTRIBUTOR[networkID]],
          },
        ],
      },
    ];

    const results: ContractCallResults = await multicall.call(context);
    const data = results.results.MPH.callsReturnContext;

    const totalSupply = new BigNumber(data[0].returnValues[0].hex).div(1e18);
    const govTreasuryBalance = new BigNumber(data[1].returnValues[0].hex).div(
      1e18
    );
    const devWalletBalance = new BigNumber(data[2].returnValues[0].hex).div(
      1e18
    );
    const merkleDistributorBalance = new BigNumber(
      data[3].returnValues[0].hex
    ).div(1e18);

    this.totalSupply = totalSupply;
    this.circulatingSupply = totalSupply
      .minus(govTreasuryBalance)
      .minus(devWalletBalance)
      .minus(merkleDistributorBalance);
  }

  async fetchSupplyDistribution(networkID: number) {
    const [timestamps, blocks] = await this.timeseries.getCustomTimeSeries(
      MPH_DEPLOYMENT_TIMESTAMP[networkID],
      this.constants.DAY_IN_SEC,
      networkID
    );

    let ids = `[`;
    ids += `"${this.constants.GOV_TREASURY[networkID].toLowerCase()}",`;
    ids += `"${this.constants.DEV_WALLET[networkID].toLowerCase()}",`;
    ids += `"${this.constants.MERKLE_DISTRIBUTOR[networkID].toLowerCase()}",`;
    ids += `"${this.constants.XMPH_ADDRESS[networkID].toLowerCase()}",`;
    ids += `]`;

    let supplyData: QueryResult = Object.create({});
    let distributionData: QueryResult = Object.create({});

    let supplyCount: number = 0;
    while (supplyCount < blocks.length) {
      let limit = blocks.length - supplyCount;
      if (limit > 500) {
        // @dev adjust the limit to prevent 413 errors
        limit = 500;
      }

      let supplyQueryString = `query Supply {`;
      for (let i = supplyCount; i < supplyCount + limit; i++) {
        supplyQueryString += `t${i}: mph(
          id: "${this.constants.MPH_ADDRESS[networkID].toLowerCase()}",
          block: {
            number: ${blocks[i]}
          }
        ) {
          totalSupply
        }`;
      }
      supplyQueryString += `}`;
      const supplyQuery = gql`
        ${supplyQueryString}
      `;

      await request(this.constants.GRAPHQL_ENDPOINT[networkID], supplyQuery)
        .then(
          (result: QueryResult) => (supplyData = { ...supplyData, ...result })
        )
        .catch((error) => console.error(error));

      supplyCount += limit;
    }

    let distributionCount: number = 0;
    while (distributionCount < blocks.length) {
      let limit = blocks.length - distributionCount;
      if (limit > 150) {
        // @dev adjust the limit to prevent 413 errors
        limit = 150;
      }

      let distributionQueryString = `query Distribution {`;
      for (let i = distributionCount; i < distributionCount + limit; i++) {
        distributionQueryString += `t${i}: users(
          where: {
            id_in: ${ids}
          }
          block: {
            number: ${blocks[i]}
          }
        ) {
          address
          mphBalance
        }`;
      }
      distributionQueryString += `}`;
      const distributionQuery = gql`
        ${distributionQueryString}
      `;

      await request(
        this.constants.GRAPHQL_ENDPOINT[networkID],
        distributionQuery
      )
        .then(
          (result: QueryResult) =>
            (distributionData = { ...distributionData, ...result })
        )
        .catch((error) => console.error(error));

      distributionCount += limit;
    }

    this.handleDataset(supplyData, distributionData, timestamps, networkID);
  }

  handleDataset(
    supplyData: QueryResult,
    distributionData: QueryResult,
    timestamps: number[],
    networkID: number
  ) {
    const community: number[] = [];
    const governanceTreasury: number[] = [];
    const merkleDistributor: number[] = [];
    const developerWallet: number[] = [];
    const staked: number[] = [];

    for (let point in supplyData) {
      community.push(
        supplyData[point] ? parseFloat(supplyData[point].totalSupply) : 0
      );
    }

    for (let point in distributionData) {
      const gov = distributionData[point].find(
        (x) =>
          x.address === this.constants.GOV_TREASURY[networkID].toLowerCase()
      );
      const dev = distributionData[point].find(
        (x) => x.address === this.constants.DEV_WALLET[networkID].toLowerCase()
      );
      const merkle = distributionData[point].find(
        (x) =>
          x.address ===
          this.constants.MERKLE_DISTRIBUTOR[networkID].toLowerCase()
      );
      const xmph = distributionData[point].find(
        (x) =>
          x.address === this.constants.XMPH_ADDRESS[networkID].toLowerCase()
      );

      governanceTreasury.push(gov ? parseFloat(gov.mphBalance) : 0);
      merkleDistributor.push(merkle ? parseFloat(merkle.mphBalance) : 0);
      developerWallet.push(dev ? parseFloat(dev.mphBalance) : 0);
      staked.push(xmph ? parseFloat(xmph.mphBalance) : 0);

      community[parseInt(point.substring(1))] -=
        governanceTreasury[parseInt(point.substring(1))];
      community[parseInt(point.substring(1))] -=
        merkleDistributor[parseInt(point.substring(1))];
      community[parseInt(point.substring(1))] -=
        developerWallet[parseInt(point.substring(1))];
      community[parseInt(point.substring(1))] -=
        staked[parseInt(point.substring(1))];
    }

    this.supplyDistribution.labels = this.getReadableTimestamps(timestamps);
    this.supplyDistribution.community = community;
    this.supplyDistribution.governanceTreasury = governanceTreasury;
    this.supplyDistribution.merkleDistributor = merkleDistributor;
    this.supplyDistribution.developerWallet = developerWallet;
    this.supplyDistribution.staked = staked;
  }

  getReadableTimestamps(timestamps: number[]): string[] {
    let readable: string[] = [];
    for (let i in timestamps) {
      readable.push(
        new Date(timestamps[i] * 1000).toLocaleString('en-US', {
          timeZone: 'UTC',
          month: 'short',
          day: 'numeric',
        })
      );
    }
    return readable;
  }
}

interface QueryResult {
  mph: {
    totalSupply: string;
  };
  users: {
    address: string;
    mphBalance: string;
  }[];
}

interface Dataset {
  labels: string[];
  community: number[];
  governanceTreasury: number[];
  merkleDistributor: number[];
  developerWallet: number[];
  staked: number[];
}
