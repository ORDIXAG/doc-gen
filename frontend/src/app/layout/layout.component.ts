import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {OrdixMenuComponent} from '../shared/menu/ordix-menu.component';

@Component({
    selector: 'dokumentationsgenerator-layout',
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    imports: [OrdixMenuComponent, RouterOutlet],
    standalone: true,
})
export class LayoutComponent {
    public constructor() {}
}
