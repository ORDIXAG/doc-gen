import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {ActivatedRoute, RouterModule} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {map} from 'rxjs';
import {environment} from '../../environments/environment';
import {AuthService, MockAccount} from './auth.service';

@Component({
    selector: 'dokumentationsgenerator-error-landing-page',
    standalone: true,
    imports: [CommonModule, RouterModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
    templateUrl: './error-landing-page.component.html',
    styleUrls: ['./error-landing-page.component.scss'],
})
export class ErrorLandingPageComponent {
    protected readonly fakeAuth$ = this.route.data.pipe(map(d => !!d?.['fakeAuth']));

    protected readonly showMockAuth = environment.fakeAuth;
    protected readonly accounts: MockAccount[];
    protected activeAccountId = '';

    public constructor(
        private readonly route: ActivatedRoute,
        private readonly authService: AuthService
    ) {
        this.accounts = this.authService.getAccounts();
        this.activeAccountId = this.authService.getActiveAccountSnapshot()?.id ?? '';
    }

    protected selectAccount(id: string): void {
        this.authService.setActiveAccountById(id);
        this.activeAccountId = id;
    }
}
