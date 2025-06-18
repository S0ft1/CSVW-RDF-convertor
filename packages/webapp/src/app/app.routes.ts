import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./main-page/main-page.component').then(
        (m) => m.MainPageComponent
      ),
  },
  {
    path: 'c2r',
    loadComponent: () =>
      import('./c2r-form-page/c2r-form-page.component').then(
        (m) => m.C2rFormPageComponent
      ),
    title: 'CSVW → RDF',
  },
];
