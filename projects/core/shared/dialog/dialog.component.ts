import { CommonModule } from '@angular/common';
import { Component, Inject, TemplateRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export interface ConfirmDialogData {
  title?: string;
  message?: string;

  // Optional custom content/actions
  contentTpl?: TemplateRef<any>;
  actionsTpl?: TemplateRef<any>;
  context?: any;

  // Button labels
  confirmText?: string;
  cancelText?: string;

  // Optional: compute a value to return on confirm
  getResult?: () => any;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'confirm' | translate }}</h2>

    <div mat-dialog-content>
      <ng-container
        *ngIf="data.contentTpl; else defaultContent"
        [ngTemplateOutlet]="data.contentTpl"
        [ngTemplateOutletContext]="data.context"
      >
      </ng-container>

      <ng-template #defaultContent>
        {{ data.message }}
      </ng-template>
    </div>

    <div mat-dialog-actions align="end">
      <ng-container
        *ngIf="data.actionsTpl; else defaultActions"
        [ngTemplateOutlet]="data.actionsTpl"
        [ngTemplateOutletContext]="data.context"
      >
      </ng-container>

      <ng-template #defaultActions>
        <button mat-button (click)="dialogRef.close(false)">
          {{ data.cancelText || 'cancel' | translate }}
        </button>
        <button mat-raised-button color="primary" (click)="closeWithResult()">
          {{ data.confirmText || 'confirm' | translate }}
        </button>
      </ng-template>
    </div>
  `,
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
    private translate: TranslateService,
  ) {}

  closeWithResult() {
    const result = this.data?.getResult ? this.data.getResult() : true;
    this.dialogRef.close(result);
  }
}
