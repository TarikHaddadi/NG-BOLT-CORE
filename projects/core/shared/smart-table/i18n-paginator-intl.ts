import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class I18nPaginatorIntl extends MatPaginatorIntl {
  constructor(private t: TranslateService) {
    super();
    this.updateLabels();
    // Re-run whenever language changes
    this.t.onLangChange.subscribe(() => this.updateLabels());
  }

  private updateLabels() {
    this.itemsPerPageLabel = this.t.instant('table.paginator.itemsPerPage');
    this.nextPageLabel = this.t.instant('table.paginator.nextPage');
    this.previousPageLabel = this.t.instant('table.paginator.prevPage');
    this.firstPageLabel = this.t.instant('table.paginator.firstPage');
    this.lastPageLabel = this.t.instant('table.paginator.lastPage');

    this.getRangeLabel = (page: number, pageSize: number, length: number) => {
      if (length === 0 || pageSize === 0) {
        // You can return '0 of 0' or a proper key if you prefer
        return this.t.instant('table.paginator.rangeEmpty', { length });
      }
      const start = page * pageSize + 1;
      const end = Math.min((page + 1) * pageSize, length);
      return this.t.instant('table.paginator.range', { start, end, length });
    };

    // Notify Material paginator to re-render labels
    this.changes.next();
  }
}
