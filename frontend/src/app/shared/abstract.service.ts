import {environment} from '../../environments/environment';

export abstract class AbstractService {
    protected getRelativeServiceURL(path: string): string {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        const prefix = this._getAppsPrefix();
        return `${prefix}/dokumentationsgenerator_backend${normalizedPath}`;
    }

    private _getAppsPrefix(): string {
        const isLocalhost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '0.0.0.0';

        if (isLocalhost) {
            return '/apps-local';
        }

        const knownPrefixes = ['/apps', '/apps_dev', '/apps_test', '/apps_integration'];
        const path = window.location.pathname || '';
        const match = knownPrefixes.find(p => path === p || path.startsWith(`${p}/`));
        if (match) {
            return match;
        }

        switch (environment.environment) {
            case 'dev':
                return '/apps_dev';
            case 'test':
                return '/apps_test';
            case 'integration':
                return '/apps_integration';
            case 'prod':
                return '/apps';
            default:
                return '/apps';
        }
    }
}
