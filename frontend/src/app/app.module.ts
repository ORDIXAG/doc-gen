import {NgModule, APP_INITIALIZER, ErrorHandler} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {ConversationsListComponent} from './pages/conversations-list/conversations-list.component';
import {ConversationDetailComponent} from './pages/conversation-detail/conversation-detail.component';
import {MarkdownModule} from 'ngx-markdown';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpClientModule} from '@angular/common/http';
import {HTTP_INTERCEPTORS} from '@angular/common/http';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTreeModule} from '@angular/material/tree';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {ChatDialogComponent} from './components/chat-dialog.component';
import {MusterManagementComponent} from './pages/muster-management/muster-management.component';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Router} from '@angular/router';
import {MatMenuModule} from '@angular/material/menu';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {AuthInterceptor} from './security/auth.interceptor';

@NgModule({
    declarations: [
        AppComponent,
        ConversationsListComponent,
        ConversationDetailComponent,
        ChatDialogComponent,
        MusterManagementComponent,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        HttpClientModule,
        FormsModule,
        MatCardModule,
        MatInputModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatTreeModule,
        MatSlideToggleModule,
        MatProgressBarModule,
        MatTooltipModule,
        MatMenuModule,
        DragDropModule,
        MarkdownModule.forRoot({loader: HttpClient}),
    ],
    providers: [
        {
            provide: 'RESET_TEST_BACKEND',
            useValue: '/test/reset',
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthInterceptor,
            multi: true,
        }
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
