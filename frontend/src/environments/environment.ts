// This file can be replaced during build by using the `fileReplacements` array.
// Single local environment.

import PackageInfo from '../../package.json';

export const environment = {
    production: false,
    environment: 'local',
    fakeAuth: true,
    version: PackageInfo.version,
    mockAccounts: [
        {
            id: 'alice',
            displayName: 'Alice Admin',
            jwt: '',
        },
        {
            id: 'bob',
            displayName: 'Bob Editor',
            jwt: '',
        },
        {
            id: 'carol',
            displayName: 'Carol Viewer',
            jwt: '',
        },
    ],
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
