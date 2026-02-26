import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {LayoutComponent} from './layout/layout.component';
import {ErrorLandingPageComponent} from './security/error-landing-page.component';
import {LoggedInAuthGuard} from './security/logged-in-auth.guard';
import {LogoutPageComponent} from './security/logout-page.component';
import {environment} from '../environments/environment';
import {ConversationDetailComponent} from './pages/conversation-detail/conversation-detail.component';
import {ConversationsListComponent} from './pages/conversations-list/conversations-list.component';
import {MusterManagementComponent} from './pages/muster-management/muster-management.component';

const routes: Routes = [
    {
        path: '',
        redirectTo: 'conversations',
        pathMatch: 'full',
    },
    // Protected routes (require login)
    {
        path: '',
        component: LayoutComponent,
        canActivateChild: [LoggedInAuthGuard],
        children: [
            {path: 'conversations', component: ConversationsListComponent},
            {path: 'conversation/:id', component: ConversationDetailComponent},
            {path: 'muster', component: MusterManagementComponent},
        ],
    },

    // Public routes (no guard)
    {
        path: 'error',
        component: ErrorLandingPageComponent,
        data: {
            fakeAuth: environment.fakeAuth,
        },
    },
    {
        path: 'logout',
        component: LogoutPageComponent,
    },
    {
        path: '**',
        redirectTo: 'error',
        pathMatch: 'full',
    },
];

@NgModule({
    imports: [RouterModule.forRoot(routes, {useHash: true})],
    exports: [RouterModule],
})
export class AppRoutingModule {}
