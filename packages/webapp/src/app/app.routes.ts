import { Route } from '@angular/router';
import { conversionExistsGuard } from './auth/conversion-exists.guard';
import { C2RService } from './services/c2r.service';
import { ValidateService } from './services/validate.service';
import { R2CService } from './services/r2c.service';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./main-page/main-page.component').then(
        (m) => m.MainPageComponent,
      ),
  },
  {
    path: 'c2r',
    loadComponent: () =>
      import('./c2r-form-page/c2r-form-page.component').then(
        (m) => m.C2rFormPageComponent,
      ),
    title: 'CSVW → RDF',
  },
  {
    path: 'c2r-simple',
    loadComponent: () =>
      import('./c2r-simple-form-page/c2r-simple-form-page.component').then(
        (m) => m.C2rSimpleFormPageComponent,
      ),
    title: 'CSVW → RDF',
  },
  {
    path: 'c2r/results',
    loadComponent: () =>
      import('./c2r-results-page/c2r-results-page.component').then(
        (m) => m.C2rResultsPageComponent,
      ),
    canMatch: [conversionExistsGuard(C2RService, '/c2r-simple')],
    title: 'CSVW → RDF',
  },
  {
    path: 'validate',
    loadComponent: () =>
      import('./validate-form-page/validate-form-page.component').then(
        (m) => m.ValidateFormPageComponent,
      ),
    title: 'Validate CSVW',
  },
  {
    path: 'validate-simple',
    loadComponent: () =>
      import(
        './validate-simple-form-page/validate-simple-form-page.component'
      ).then((m) => m.ValidateSimpleFormPageComponent),
    title: 'Validate CSVW',
  },
  {
    path: 'validate/results',
    loadComponent: () =>
      import('./validate-results-page/validate-results-page.component').then(
        (m) => m.ValidateResultsPageComponent,
      ),
    canMatch: [conversionExistsGuard(ValidateService, '/validate-simple')],
    title: 'Validate CSVW',
  },
  {
    path: 'r2c',
    loadComponent: () =>
      import('./r2c-form-page/r2c-form-page.component').then(
        (m) => m.R2cFormPageComponent,
      ),
    title: 'RDF → CSVW',
  },
  {
    path: 'r2c-simple',
    loadComponent: () =>
      import('./r2c-simple-form-page/r2c-simple-form-page.component').then(
        (m) => m.R2cSimpleFormPageComponent,
      ),
    title: 'RDF → CSVW',
  },
  {
    path: 'r2c/results',
    loadComponent: () =>
      import('./r2c-results-page/r2c-results-page.component').then(
        (m) => m.R2cResultsPageComponent,
      ),
    canMatch: [conversionExistsGuard(R2CService, '/r2c-simple')],
    title: 'RDF → CSVW',
  },
];
