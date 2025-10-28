import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

import { ConfirmDialogData } from '@cadai/pxs-ng-core/interfaces';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'confirm' | translate }}</h2>

    <div mat-dialog-content>
      @if (data.contentTpl) {
        <ng-container [ngTemplateOutlet]="data.contentTpl" [ngTemplateOutletContext]="data.context">
        </ng-container>
      } @else {
        {{ data.message }}
      }
    </div>

    <div mat-dialog-actions align="end">
      @if (data.actionsTpl) {
        <ng-container [ngTemplateOutlet]="data.actionsTpl" [ngTemplateOutletContext]="data.context">
        </ng-container>
      } @else {
        <button
          mat-button
          type="button"
          [color]="'warn'"
          class="warn"
          (click)="dialogRef.close(false)"
        >
          {{ data.cancelText || 'cancel' | translate }}
        </button>
        <button
          mat-flat-button
          color="primary"
          [color]="'primary'"
          class="primary"
          type="button"
          (click)="closeWithResult()"
        >
          {{ data.confirmText || 'confirm' | translate }}
        </button>
      }
    </div>
  `,
})
export class ConfirmDialogComponent<TContext = unknown> {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent<TContext>, any>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData<TContext>,
  ) {}

  closeWithResult() {
    const result = this.data?.getResult ? this.data.getResult() : true;
    this.dialogRef.close(result);
  }
}
