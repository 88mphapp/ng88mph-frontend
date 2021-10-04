import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';

@Injectable({
  providedIn: 'root',
})
export class ConstantsService {
  // NETWORK INFO //
  CHAIN_ID = {
    MAINNET: 1,
    RINKEBY: 4,
    POLYGON: 137,
  };
  CHAIN_ID_STRING = {
    [this.CHAIN_ID.MAINNET]: 'mainnet',
    [this.CHAIN_ID.RINKEBY]: 'rinkeby',
    [this.CHAIN_ID.POLYGON]: 'polygon',
  };
  NETWORK_METADATA = {
    [this.CHAIN_ID.MAINNET]: {
      chainId: '0x1',
      chainName: 'Ethereum',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://mainnet.infura.io/v3'],
      blockExplorerUrls: ['https://etherscan.com'],
    },
    [this.CHAIN_ID.RINKEBY]: {
      chainId: '0x4',
      chainName: 'Rinkeby',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://rinkeby.infura.io/v3'],
      blockExplorerUrls: ['https://rinkeby.etherscan.com'],
    },
    [this.CHAIN_ID.POLYGON]: {
      chainId: '0x89',
      chainName: 'Polygon Mainnet',
      nativeCurrency: {
        name: 'Polygon',
        symbol: 'MATIC',
        decimals: 18,
      },
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com'],
    },
  };

  // GRAPHQL ENDPOINTS //
  GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph-v3-rinkeby',
    [this.CHAIN_ID.POLYGON]: '',
  };
  GRAPHQL_ENDPOINT_V2 = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/bacon-labs/eighty-eight-mph',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  MPH_TOKEN_GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/mph-token',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/mph-token-rinkeby',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BACK_TO_THE_FUTURE_GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/back-to-the-future',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/0xszeth/back-to-the-future-rinkeby',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BLOCKS_GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
    [this.CHAIN_ID.RINKEBY]:
      'https://api.thegraph.com/subgraphs/name/blocklytics/rinkeby-blocks',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CHAINLINK_GRAPHQL_ENDPOINT = {
    [this.CHAIN_ID.MAINNET]:
      'https://api.thegraph.com/subgraphs/name/openpredict/chainlink-prices-subgraph',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  UNISWAP_V2_GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
  UNISWAP_V3_GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
  SUSHISWAP_GRAPHQL_ENDPOINT =
    'https://api.thegraph.com/subgraphs/name/sushiswap/exchange';

  // RPC ENDPOINTS //
  RPC = {
    [this.CHAIN_ID.MAINNET]:
      'https://eth-mainnet.alchemyapi.io/v2/y8L870PADfUHPFM9_-GMMUOpHckqNtR-',
    [this.CHAIN_ID.RINKEBY]:
      'https://eth-rinkeby.alchemyapi.io/v2/2LxgvUYd5FzgiXVoAWlq-KyM4v-E7KJ4',
    [this.CHAIN_ID.POLYGON]: '',
  };
  RPC_WS = {
    [this.CHAIN_ID.MAINNET]:
      'wss://eth-mainnet.ws.alchemyapi.io/v2/y8L870PADfUHPFM9_-GMMUOpHckqNtR-',
    [this.CHAIN_ID.RINKEBY]:
      'wss://eth-rinkeby.ws.alchemyapi.io/v2/2LxgvUYd5FzgiXVoAWlq-KyM4v-E7KJ4',
    [this.CHAIN_ID.POLYGON]: '',
  };

  // API KEYS //
  BLOCKNATIVE_KEY = 'af9c0a83-8874-4e07-a272-19c879420693';
  INFURA_KEY = '9e5f0d08ad19483193cc86092b7512f2';
  PORTIS_KEY = 'a838dbd2-c0b1-4465-8dbe-36b88f3d0d4e';
  FORTMATIC_KEY = 'pk_live_937F9430B2CB3407';
  NFTSTORAGE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGM1NWQxRjE1OEFDY2IwOTFCRTBGNTNkYTZkYTMzYzdmMDJhNzdlNTkiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTYyNzg3MDUwNDI1NSwibmFtZSI6Ijg4bXBoIn0.wwMdT6BQp3cB0DJPWy5qm4uWZLhjY0BPYxsqGiYKHOk';
  WEB3STORAGE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDkyNDZmMjcyQTlmMDViYzIzOTlCNzM5MzFEZWZEZDA0Mzg2NDI0NjMiLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2MzI0MzU5MDQ2ODUsIm5hbWUiOiI4OG1waCJ9.6zBwjl7oVSO2QOMwMbooidfuVznSXVCMbADAAzd8xYs';
  // UTILITIES //
  PRECISION = 1e18;
  YEAR_IN_SEC = 31556952;
  MONTH_IN_SEC = 30 * 24 * 60 * 60;
  WEEK_IN_SEC = 7 * 24 * 60 * 60;
  DAY_IN_SEC = 24 * 60 * 60;
  SUBGRAPH_SYNC_WARNING_THRESHOLD = 20; // if falls behind by 20 blocks, display error banner
  TX_CONFIRMATION_REFRESH_WAIT_TIME = 3 * 1e3; // Time between tx confirmation and data refresh, in ms. Should only be used when data is loaded through the subgraph.
  DUST_THRESHOLD = new BigNumber(1e-10).toFixed(10); // The minimum amount below which deposits/fundings won't be displayed

  // 88MPH CONTRACTS //
  DUMPER_V2 = '0x5B3C81C86d17786255904c316bFCB38A46146ef8';
  DUMPER_V3 = '0x8Cc9ADF88fe0b5C739bD936E9edaAd30578f4265';

  GOV_TREASURY = {
    [this.CHAIN_ID.MAINNET]: '0x56f34826Cc63151f74FA8f701E4f73C5EAae52AD',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  DEV_WALLET = {
    [this.CHAIN_ID.MAINNET]: '0xfecBad5D60725EB6fd10f8936e02fa203fd27E4b',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  MERKLE_DISTRIBUTOR = {
    [this.CHAIN_ID.MAINNET]: '0x8c5ddBB0fd86B6480D81A1a5872a63812099C043',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  MPH_ADDRESS = {
    [this.CHAIN_ID.MAINNET]: '0x8888801af4d980682e47f1a9036e589479e835c5',
    [this.CHAIN_ID.RINKEBY]: '0xC79a56Af51Ec36738E965e88100e4570c5C77A93',
    [this.CHAIN_ID.POLYGON]: '',
  };
  XMPH_ADDRESS = {
    [this.CHAIN_ID.MAINNET]: '0x1702F18c1173b791900F81EbaE59B908Da8F689b',
    [this.CHAIN_ID.RINKEBY]: '0x59EE65726f0b886Ec924271B51A3c1e78F52d1FB',
    [this.CHAIN_ID.POLYGON]: '',
  };
  V2_REWARDS = {
    [this.CHAIN_ID.MAINNET]: '0x98df8D9E56b51e4Ea8AA9b57F8A5Df7A044234e1',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };

  // EXTERNAL CONTRACTS //
  COMPOUND_COMPTROLLER = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b';
  SUSHI_MASTERCHEF = '0xc2edad668740f1aa35e4d8f227fb8e17dca888cd';
  SUSHI_MPH_ONSEN_ID = 92;
  BANCOR_LP_STATS = '0x9712Bb50DC6Efb8a3d7D12cEA500a50967d2d471';
  BANCOR_STAKING_REWARDS = '0x4B90695C2013FC60df1e168c2bCD4Fd12f5C9841';
  BANCOR_STAKING_REWARDS_STORE = '0x891AfF26593Da95e574E3f62619dAD6624FB5693';

  SUSHI_MASTERCHEF_V2 = {
    [this.CHAIN_ID.MAINNET]: '0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  SUSHI_MPH_REWARDER = {
    [this.CHAIN_ID.MAINNET]: '0x2889fE6B8cfAE15CC53157b8f0494FdB08721C39',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  SUSHI_MPH_REWARDER_ID = {
    [this.CHAIN_ID.MAINNET]: 4,
    [this.CHAIN_ID.RINKEBY]: null,
    [this.CHAIN_ID.POLYGON]: null,
  };

  // TOKENS //
  AAVE = {
    [this.CHAIN_ID.MAINNET]: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BAL = {
    [this.CHAIN_ID.MAINNET]: '0xba100000625a3754423978a60c9317c58a424e3d',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BAT = {
    [this.CHAIN_ID.MAINNET]: '0x0d8775f648430679a709e98d2b0cb6250d2887ef',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BNT = {
    [this.CHAIN_ID.MAINNET]: '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BTCCRV = {
    [this.CHAIN_ID.MAINNET]: '',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '0xf8a57c1d3b9629b77b6726a042ca48990a84fb49',
  };
  COMP = {
    [this.CHAIN_ID.MAINNET]: '0xc00e94cb662c3520282e6f5717214004a7f26888',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRV = {
    [this.CHAIN_ID.MAINNET]: '0xd533a949740bb3306d119cc777fa900ba034cd52',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRVRENWBTC = {
    [this.CHAIN_ID.MAINNET]: '0x49849c98ae39fff122806c06791fa73784fb3675',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRVUSDBTCETH = {
    [this.CHAIN_ID.MAINNET]: '',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '0xdad97f7713ae9437fa9249920ec8507e5fbb23d3',
  };
  DAI = {
    [this.CHAIN_ID.MAINNET]: '0x6b175474e89094c44da98b954eedeac495271d0f',
    [this.CHAIN_ID.RINKEBY]: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
    [this.CHAIN_ID.POLYGON]: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
  };
  FARM = {
    [this.CHAIN_ID.MAINNET]: '0xa0246c9032bC3A600820415aE600c6388619A14D',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  FTT = {
    [this.CHAIN_ID.MAINNET]: '0x50d1c9771902476076ecfc8b2a83ad6b9355a4c9',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  GUSD = {
    [this.CHAIN_ID.MAINNET]: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  LINK = {
    [this.CHAIN_ID.MAINNET]: '0x514910771af9ca656af840dff83e8264ecf986ca',
    [this.CHAIN_ID.RINKEBY]: '0x01be23585060835e02b77ef475b0cc51aa1e0709',
    [this.CHAIN_ID.POLYGON]: '',
  };
  RAI = {
    [this.CHAIN_ID.MAINNET]: '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  REN = {
    [this.CHAIN_ID.MAINNET]: '0x408e41876cccdc0f92210600ef50372656052a38',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  SNX = {
    [this.CHAIN_ID.MAINNET]: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  STKAAVE = {
    [this.CHAIN_ID.MAINNET]: '0x4da27a545c0c5b758a6ba100e3a049001de870f5',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  SUSD = {
    [this.CHAIN_ID.MAINNET]: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  SUSHI = {
    [this.CHAIN_ID.MAINNET]: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  TUSD = {
    [this.CHAIN_ID.MAINNET]: '0x0000000000085d4780b73119b644ae5ecd22b376',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  UNI = {
    [this.CHAIN_ID.MAINNET]: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  USDC = {
    [this.CHAIN_ID.MAINNET]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    [this.CHAIN_ID.RINKEBY]: '0x4dbcdf9b62e891a7cec5a2568c3f4faf9e8abe2b',
    [this.CHAIN_ID.POLYGON]: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  };
  USDP = {
    [this.CHAIN_ID.MAINNET]: '0x8e870d67f660d95d5be530380d0ec0bd388289e1',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  USDT = {
    [this.CHAIN_ID.MAINNET]: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  };
  WBTC = {
    [this.CHAIN_ID.MAINNET]: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
  };
  WETH = {
    [this.CHAIN_ID.MAINNET]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  };
  WMATIC = {
    [this.CHAIN_ID.MAINNET]: '',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  };
  YFI = {
    [this.CHAIN_ID.MAINNET]: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  ZRX = {
    [this.CHAIN_ID.MAINNET]: '0xe41d2489571d322189246dafa5ebde1f4699f498',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  // v2 tokens
  STECRV = {
    [this.CHAIN_ID.MAINNET]: '0x06325440d014e39736583c165c2963ba99faf14e',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  ALINK = {
    [this.CHAIN_ID.MAINNET]: '0xa64bd6c70cb9051f6a9ba1f163fdc07e0dfb5f84',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRVOBTC = {
    [this.CHAIN_ID.MAINNET]: '0x2fe94ea3d5d4a175184081439753de15aef9d614',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRVHBTC = {
    [this.CHAIN_ID.MAINNET]: '0xb19059ebb43466c323583928285a49f558e572fd',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  THREECRV = {
    [this.CHAIN_ID.MAINNET]: '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRVHUSD = {
    [this.CHAIN_ID.MAINNET]: '0x5b5cfe992adac0c9d48e05854b2d91c73a003858',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  CRVRENWSBTC = {
    [this.CHAIN_ID.MAINNET]: '0x075b1bb99792c9e1041ba13afef80c91a1e70fb3',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  YCRV = {
    [this.CHAIN_ID.MAINNET]: '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };

  // LP TOKENS //
  UNISWAP_V2_LP = {
    [this.CHAIN_ID.MAINNET]: '0x4d96369002fc5b9687ee924d458a7e5baa5df34e',
    [this.CHAIN_ID.RINKEBY]: '0x52768abae4e3f4a714aee3d0f85b4eba6360fda3',
    [this.CHAIN_ID.POLYGON]: '',
  };
  UNISWAP_V3_LP = {
    [this.CHAIN_ID.MAINNET]: '0xda7dd9ad1b2af1e50c73a0cc5d23ec5397478763',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  SUSHISWAP_LP = {
    [this.CHAIN_ID.MAINNET]: '0xb2c29e311916a346304f83aa44527092d5bd4f0f',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };
  BANCOR_LP = {
    [this.CHAIN_ID.MAINNET]: '0xdf3fdfbce72da4fd42e7cfde7249e15357c7d808',
    [this.CHAIN_ID.RINKEBY]: '',
    [this.CHAIN_ID.POLYGON]: '',
  };

  SUSHI_LP = '0xb2c29e311916a346304f83aa44527092d5bd4f0f';
  BANCOR_MPHBNT_POOL = '0xabf26410b1cff45641af087ee939e52e328cee46';
}
