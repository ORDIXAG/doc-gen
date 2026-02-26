import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateChild, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {environment} from '../../environments/environment';
import {AuthService} from './auth.service';

@Injectable({
    providedIn: 'root',
})
export class LoggedInAuthGuard implements CanActivateChild {
    public constructor(
        private readonly router: Router,
        private readonly authService: AuthService
    ) {}

    public canActivateChild(_childRoute: ActivatedRouteSnapshot, _state: RouterStateSnapshot): boolean | UrlTree {
        if (!environment.fakeAuth) {
            return true;
        }

        const jwt = this.authService.getActiveJwt();
        if (jwt) {
            return true;
        }

        return this.router.parseUrl('/error');
    }
}
