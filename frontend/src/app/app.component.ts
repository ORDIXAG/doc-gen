import {Component, inject} from '@angular/core';
import {InfoService} from './shared/info.service';
import {environment} from '../environments/environment';

@Component({
    selector: 'dokumentationsgenerator-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: false,
})
export class AppComponent {
    private infoService = inject(InfoService);

    public constructor() {
        const infoService = this.infoService;

        infoService.setAppInfo(
            'Dokumentationsgenerator',
            environment.version,
            'fli@ordix.de',
            environment.fakeAuth
        );
    }
}
