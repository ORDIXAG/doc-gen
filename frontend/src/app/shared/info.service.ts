import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';

export interface AppInfo {
    appName: string;
    version: string;
    contactEmail: string;
    fakeAuth: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class InfoService {
    private readonly _appInfo$ = new BehaviorSubject<AppInfo | null>(null);

    public setAppInfo(appName: string, version: string, contactEmail: string, fakeAuth: boolean): void {
        this._appInfo$.next({appName, version, contactEmail, fakeAuth});
    }

    public getAppInfo$(): Observable<AppInfo | null> {
        return this._appInfo$.asObservable();
    }

    public getSnapshot(): AppInfo | null {
        return this._appInfo$.value;
    }
}
