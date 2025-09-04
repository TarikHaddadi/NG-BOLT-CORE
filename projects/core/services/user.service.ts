import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CoreOptions, CreateUserDto, UpdateUserDto, User } from '@cadai/pxs-ng-core/interfaces';
import { CORE_OPTIONS } from '@cadai/pxs-ng-core/tokens';

import { HttpService } from './http.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(
    private http: HttpService,
    @Inject(CORE_OPTIONS) private readonly coreOpts: Required<CoreOptions>,
  ) {}

  private get base(): string {
    const apiUrl = this.coreOpts.environments.apiUrl;
    if (!apiUrl) throw new Error('Runtime config missing: apiUrl');
    return `${apiUrl}/users`;
  }

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.base);
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.base}/${id}`);
  }

  create(user: CreateUserDto): Observable<User> {
    return this.http.post<User, CreateUserDto>(this.base, user);
  }

  update(id: string, user: UpdateUserDto): Observable<User> {
    return this.http.put<User, UpdateUserDto>(`${this.base}/${id}`, user);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.base}/me`);
  }
}
