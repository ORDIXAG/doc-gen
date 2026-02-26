import {CommonModule} from '@angular/common';
import {Component, OnInit} from '@angular/core';
import {RouterModule} from '@angular/router';
import {MatButtonModule} from '@angular/material/button';

@Component({
    selector: 'dokumentationsgenerator-logout-page',
    standalone: true,
    imports: [CommonModule, RouterModule, MatButtonModule],
    templateUrl: './logout-page.component.html',
    styleUrls: ['./logout-page.component.scss'],
})
export class LogoutPageComponent implements OnInit {
    public ngOnInit(): void {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch {
            // ignore
        }
    }
}
