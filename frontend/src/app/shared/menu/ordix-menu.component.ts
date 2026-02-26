import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, inject} from '@angular/core';
import {RouterModule} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatToolbarModule} from '@angular/material/toolbar';
import {Subscription} from 'rxjs';
import {InfoService} from '../info.service';
import {environment} from '../../../environments/environment';
import {AuthService, MockAccount} from '../../security/auth.service';

export interface OrdixMenuButton {
    displayName: string;
    routerLink: string;
}

@Component({
    selector: 'ordix-menu',
    standalone: true,
    imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatMenuModule, MatToolbarModule],
    templateUrl: './ordix-menu.component.html',
    styleUrls: ['./ordix-menu.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdixMenuComponent implements OnDestroy {
    private readonly _infoService = inject(InfoService);
    private readonly _authService = inject(AuthService);
    private readonly _cdr = inject(ChangeDetectorRef);
    private readonly _sub = new Subscription();

    protected appName = 'App';
    protected version = '';
    protected contactEmail = '';
    protected fakeAuth = false;

    protected readonly showMockAuth = environment.fakeAuth;
    protected accounts: MockAccount[] = [];
    protected activeAccountId = '';
    protected activeAccountName = '';

    private _buttons: OrdixMenuButton[] = [];
    protected navButtons: OrdixMenuButton[] = [];

    @Input()
    public set buttons(value: OrdixMenuButton[]) {
        this._buttons = value ?? [];
        this._recomputeButtons();
    }

    public get buttons(): OrdixMenuButton[] {
        return this._buttons;
    }

    public constructor() {
        this._sub.add(
            this._infoService.getAppInfo$().subscribe(info => {
                if (!info) {
                    return;
                }
                this.appName = info.appName;
                this.version = info.version;
                this.contactEmail = info.contactEmail;
                this.fakeAuth = info.fakeAuth;
                this._cdr.markForCheck();
            })
        );

        this.accounts = this._authService.getAccounts();
        this._sub.add(
            this._authService.getActiveAccount$().subscribe(acc => {
                this.activeAccountId = acc?.id ?? '';
                this.activeAccountName = acc?.displayName ?? 'Account';
                this._cdr.markForCheck();
            })
        );

        this._recomputeButtons();
    }

    protected trackByRouterLink(_index: number, button: OrdixMenuButton): string {
        return button.routerLink;
    }

    protected selectAccount(id: string): void {
        this._authService.setActiveAccountById(id);
        window.location.reload();
    }

    private _recomputeButtons(): void {
        const normalized = (this._buttons ?? []).filter(b => !!b?.displayName && !!b?.routerLink);
        const hasConversations = normalized.some(b => b.routerLink === '/conversations');
        this.navButtons = hasConversations
            ? normalized
            : [{displayName: 'Conversations', routerLink: '/conversations'}, ...normalized];
        this._cdr.markForCheck();
    }

    public ngOnDestroy(): void {
        this._sub.unsubscribe();
    }
}
