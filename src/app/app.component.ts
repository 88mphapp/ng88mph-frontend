import { Component } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { WalletService } from './wallet.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'ng88mph-frontend';
  themeName = '80s'
  themeURL = this.getThemeURL();
  themes = [
    '80s',
    'boring'
  ];

  constructor(public wallet: WalletService, public sanitizer: DomSanitizer) {
    const storedThemeName = window.localStorage.getItem('themeName');
    if (storedThemeName != null) {
      this.themeName = storedThemeName;
    }
    this.themeURL = this.getThemeURL();
    wallet.connect(() => {}, () => {}, true);
  }

  setTheme(newThemeName: string): void {
    this.themeName = newThemeName;
    this.themeURL = this.getThemeURL();
    window.localStorage.setItem('themeName', newThemeName);
  }

  getThemeURL() {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`assets/css/theme-${this.themeName}.css`);
  }
}
