import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConstantsService } from 'src/app/constants.service';
import { ContractService, PoolInfo } from 'src/app/contract.service';
import { HelpersService } from 'src/app/helpers.service';
import { WalletService } from 'src/app/wallet.service';
import { NFTStorage, File } from 'nft.storage';
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

  name: string;
  description: string;
  imageURL: SafeUrl;
  imageFile: any;
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
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const pool = this.contract.getPool(this.poolInfo.name, readonlyWeb3);
    pool.methods
      .depositNFT()
      .call()
      .then((nftAddress) => {
        this.nftAddress = nftAddress;
        this.loadedNFTAddress = true;
      });

    this.imageURL = '../../assets/img/placeholder.svg';
    this.nftStorageClient = new NFTStorage({
      token: this.constants.NFTSTORAGE_KEY,
    });
    this.isLoading = false;
    this.loadedNFTAddress = false;

    // Auto-resize the textarea
    autosize(document.querySelector('textarea'));
  }

  addAttribute() {
    const newAttribute = this.fb.group({
      trait_type: ['', Validators.required],
      value: ['', Validators.required],
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
    const metadata = {
      name: this.name,
      image: new File([this.imageFile], this.imageFile.name, {
        type: this.imageFile.type,
      }),
      description: this.description,
      external_url: this.externalURL,
      attributes: attributesList,
    };
    const uploadResult = await this.nftStorageClient.store(metadata);

    this.isLoading = false;

    return uploadResult.url;
  }

  private setTokenURI(uri: string) {
    const nft = this.contract.getContract(this.nftAddress, 'NFT');
    const func = nft.methods.setTokenURI(this.userDeposit.nftID, uri);

    this.wallet.sendTx(
      func,
      () => {},
      () => {
        this.activeModal.dismiss();
      },
      (error) => {
        this.wallet.displayGenericError(error);
      },
      false
    );
  }
}
