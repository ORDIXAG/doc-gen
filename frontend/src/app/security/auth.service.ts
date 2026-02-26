import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {environment} from '../../environments/environment';

export interface MockAccount {
    id: string;
    displayName: string;
    jwt: string;
}

const STORAGE_KEY = 'mock-auth.account-id';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly _accounts: MockAccount[] = (environment.mockAccounts ?? []).map(a => ({...a}));
    private readonly _jwtByAccountId = new Map<string, string>();
    private readonly _active$ = new BehaviorSubject<MockAccount | null>(this._loadInitialAccount());

    public constructor() {
        for (const account of this._accounts) {
            const fromEnv = this._normalizeJwt(account.jwt);
            const jwt = fromEnv || (environment.fakeAuth ? this._createDummyJwtToken(account.id) : '');
            account.jwt = jwt;
            this._jwtByAccountId.set(account.id, jwt);
        }
    }

    public getAccounts(): MockAccount[] {
        return this._accounts.slice();
    }

    public getActiveAccount$(): Observable<MockAccount | null> {
        return this._active$.asObservable();
    }

    public getActiveAccountSnapshot(): MockAccount | null {
        return this._active$.value;
    }

    public getActiveJwt(): string {
        const accountId = this._active$.value?.id ?? '';
        if (!accountId) {
            return '';
        }
        return this._jwtByAccountId.get(accountId) ?? '';
    }

    public setActiveAccountById(id: string): void {
        const next = this._accounts.find(a => a.id === id) ?? null;
        this._setActive(next);
    }

    private _setActive(account: MockAccount | null): void {
        this._active$.next(account);
        try {
            if (account?.id) {
                localStorage.setItem(STORAGE_KEY, account.id);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // ignore
        }
    }

    private _loadInitialAccount(): MockAccount | null {
        if (!environment.fakeAuth) {
            return null;
        }

        if (this._accounts.length === 0) {
            return null;
        }

        let storedId = '';
        try {
            storedId = localStorage.getItem(STORAGE_KEY) ?? '';
        } catch {
            storedId = '';
        }

        return this._accounts.find(a => a.id === storedId) ?? this._accounts[0];
    }

    private _normalizeJwt(jwt: string): string {
        const trimmed = (jwt ?? '').trim();
        if (!trimmed) {
            return '';
        }
        if (trimmed.includes('REPLACE_WITH_JWT')) {
            return '';
        }
        return trimmed;
    }

    private _createDummyJwtToken(sub: string): string {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub,
            iat: now,
            exp: now + 60 * 60 * 24,
            iss: 'fakeauth-frontend',
        };

        const header = {alg: 'none', typ: 'JWT'};

        const headerB64 = this._base64UrlEncode(JSON.stringify(header));
        const urlEncodedPayloadJson = encodeURIComponent(JSON.stringify(payload));
        const payloadB64 = this._base64UrlEncode(urlEncodedPayloadJson);
        const signature = 'dummySignature';

        return `${headerB64}.${payloadB64}.${signature}`;
    }

    private _base64UrlEncode(input: string): string {
        const bytes = new TextEncoder().encode(input);
        let binary = '';
        for (const b of bytes) {
            binary += String.fromCharCode(b);
        }
        const b64 = btoa(binary);
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
}
