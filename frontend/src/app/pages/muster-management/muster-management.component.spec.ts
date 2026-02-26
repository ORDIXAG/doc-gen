import {ComponentFixture, TestBed} from '@angular/core/testing';

import {MusterManagementComponent} from './muster-management.component';

describe('MusterManagementComponent', () => {
    let component: MusterManagementComponent;
    let fixture: ComponentFixture<MusterManagementComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [MusterManagementComponent],
        });
        fixture = TestBed.createComponent(MusterManagementComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
