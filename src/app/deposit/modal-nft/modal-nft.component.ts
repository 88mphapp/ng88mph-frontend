import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { NFTStorage, File } from 'nft.storage';
import { Web3Storage } from 'web3.storage/dist/bundle.esm.min.js';
import autosize from 'autosize';
import { UserDeposit } from '../types';

@Component({
  selector: 'app-modal-nft',
  templateUrl: './modal-nft.component.html',
  styleUrls: ['./modal-nft.component.css'],
})
export class ModalNftComponent implements OnInit {
  @Input() userDeposit: UserDeposit;
  @Input() poolInfo: PoolInfo;
  nftAddress: string;
  loadedNFTAddress: boolean;

  nftStorageClient: NFTStorage;
  web3StorageClient: Web3Storage;
  openseaURL: string;

  name: string;
  description: string;
  imageURL: SafeUrl;
  imageFile: any;
  mediaURL: SafeUrl;
  audioURL: SafeUrl;
  mediaFile: any;
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
  ) {}

  ngOnInit(): void {
    const web3 = this.wallet.httpsWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, web3);
    pool.methods
      .depositNFT()
      .call()
      .then((nftAddress) => {
        this.nftAddress = nftAddress;
        this.loadedNFTAddress = true;
        this.loadNFTData(nftAddress);
      });

    this.imageURL = '../../assets/img/placeholder.svg';
    this.audioURL = '../../assets/img/cassette_tape.gif';
    this.nftStorageClient = new NFTStorage({
      token: this.constants.NFTSTORAGE_KEY,
    });
    this.web3StorageClient = new Web3Storage({
      token: this.constants.WEB3STORAGE_KEY,
    });
    this.isLoading = false;
    this.loadedNFTAddress = false;

    // Auto-resize the textarea
    autosize(document.querySelector('textarea'));
  }

  async loadNFTData(nftAddress: string) {
    this.openseaURL = `https://${
      this.wallet.networkID == this.constants.CHAIN_ID.MAINNET ? '' : ''
    }${
      this.wallet.networkID == this.constants.CHAIN_ID.RINKEBY
        ? 'testnets.'
        : ''
    }opensea.io/assets/${
      this.wallet.networkID == this.constants.CHAIN_ID.POLYGON ? 'matic/' : ''
    }${nftAddress}/${this.userDeposit.nftID}`;

    const nftContract = this.contract.getContract(nftAddress, 'NFT');
    const tokenURI = await nftContract.methods
      .tokenURI(this.userDeposit.nftID)
      .call();
    if (!tokenURI) return;

    // use custom metadata
    if (tokenURI.includes('ipfs://')) {
      const hash = tokenURI.split('//');
      const request = await fetch(`https://ipfs.io/ipfs/${hash[1]}`);
      const json = await request.json();

      this.name = json.name;
      this.imageURL = `https://ipfs.io/ipfs/${json.image.split('//')[1]}`;
      json.animation_url
        ? (this.mediaURL = `https://ipfs.io/ipfs/${
            json.animation_url.split('//')[1]
          }`)
        : (this.mediaURL = '');
      this.description = json.description;
      for (let i = 0; i < json.attributes.length; i++) {
        this.addAttribute(
          json.attributes[i].trait_type,
          json.attributes[i].value
        );
      }
      this.externalURL = json.externalURL;

      // use default metadata
    } else {
      const request = await fetch(`${tokenURI}`);
      const json = await request.json();

      this.name = json.name;
      this.imageURL = this.sanitizer.bypassSecurityTrustUrl(json.image);
      this.description = json.description;
    }
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
  }

  async clickUpdateMetadata() {
    const uri = await this.uploadMetadata();
    this.setTokenURI(uri);
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

  private setTokenURI(uri: string) {
    const nft = this.contract.getContract(this.nftAddress, 'NFT');
    const func = nft.methods.setTokenURI(this.userDeposit.nftID, uri);

    this.wallet.sendTx(
      func,
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
}
