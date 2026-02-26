import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../environments/environment';
import {AuthService} from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    public constructor(private readonly auth: AuthService) {}

    public intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        if (!environment.fakeAuth) {
            return next.handle(req);
        }

        if (req.headers.has('Authorization')) {
            return next.handle(req);
        }

        const token = this.auth.getActiveJwt();
        if (!token) {
            return next.handle(req);
        }

        // Only attach the token to our backend calls.
        if (!req.url.includes('dokumentationsgenerator_backend')) {
            return next.handle(req);
        }

        return next.handle(
            req.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`,
                },
            })
        );
    }
}
