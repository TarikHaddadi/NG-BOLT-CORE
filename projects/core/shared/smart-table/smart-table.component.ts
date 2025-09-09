import { SelectionModel } from '@angular/cdk/collections';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  EventEmitter,
  HostBinding,
  inject,
  Injectable,
  Input,
  NgZone,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { DateAdapter } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import {
  MatPaginator,
  MatPaginatorIntl,
  MatPaginatorModule,
  PageEvent,
} from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, tap } from 'rxjs';

import { ServerPage, SmartColumn } from '@cadai/pxs-ng-core/interfaces';
import { HttpService } from '@cadai/pxs-ng-core/services';
import { AppSelectors } from '@cadai/pxs-ng-core/store';

/* -------------------------------------------
 * Paginator i18n that reacts to language changes
 * ------------------------------------------*/
@Injectable()
export class I18nPaginatorIntl extends MatPaginatorIntl {
  constructor(private t: TranslateService) {
    super();
    this._update();
    this.t.onLangChange.subscribe(() => this._update());
  }
  private _update() {
    this.itemsPerPageLabel = this.t.instant('table.paginator.itemsPerPage');
    this.nextPageLabel = this.t.instant('table.paginator.nextPage');
    this.previousPageLabel = this.t.instant('table.paginator.prevPage');
    this.firstPageLabel = this.t.instant('table.paginator.firstPage');
    this.lastPageLabel = this.t.instant('table.paginator.lastPage');
    this.getRangeLabel = (page, pageSize, length) => {
      if (length === 0 || pageSize === 0) return this.t.instant('table.paginator.rangeEmpty');
      const start = page * pageSize + 1;
      const end = Math.min((page + 1) * pageSize, length);
      return this.t.instant('table.paginator.range', { start, end, length });
    };
    this.changes.next();
  }
}

@Component({
  selector: 'app-smart-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTreeModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatCheckboxModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDividerModule,
    MatRippleModule,
    DragDropModule,
    TranslateModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: I18nPaginatorIntl }],
  templateUrl: './smart-table.component.html',
  styleUrls: ['./smart-table.component.scss'],
})
export class SmartTableComponent implements OnInit {
  // Inputs
  @Input({ required: true }) columns: SmartColumn[] = [];
  @Input() endpoint?: string;
  @Input() data?: any[];
  @Input() serverSide = false;
  @Input() idKey = 'id';
  @Input() childrenKey = 'children';
  @Input() enableTree = false;
  @Input() pageSize = 10;
  @Input() pageSizeOptions = [10, 20, 50, 100];
  @Input() stickyHeader = true;
  @Input() stickyFooter = false;
  @Input() rippleRows = true;
  @Input() enableGlobalFilter = true;
  @Input() globalFilterPlaceholder = 'table.searchPlaceholder'; // i18n key by default
  @Input() columnFilterEnabled = false; // server supports f_{col}
  @Input() enableReorder = true;
  @Input() multiSelect = true;

  // Outputs
  @Output() rowClick = new EventEmitter<any>();
  @Output() action = new EventEmitter<{ id: string; row: any }>();
  @Output() selectionChange = new EventEmitter<any[]>();

  // Refs
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable, { static: false }) table!: MatTable<any>;

  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpService);
  private zone = inject(NgZone);

  // State
  readonly selection = new SelectionModel<any>(true, []);
  readonly globalFilter = new FormControl<string>('');
  readonly columnFilterInput = new FormControl<string>('');
  private _activeFilterColumn = signal<string | null>(null);
  activeFilterColumn = computed(() => this._activeFilterColumn());

  private _allColumns = signal<SmartColumn[]>([]);
  allColumns = computed(() => this._allColumns());

  // Persistent order and hidden set
  private _masterOrder = signal<string[]>([]);
  private _hidden = signal<Set<string>>(new Set());

  private _data = signal<any[]>([]);
  private _flatData = signal<any[]>([]);
  private _total = signal<number>(0);
  private _pageIndex = signal<number>(0);
  private _loading = signal<boolean>(false);

  total = computed(() => this._total());
  pageIndex = computed(() => this._pageIndex());
  loading = computed(() => this._loading());

  private _columnFilters = signal<Record<string, string>>({});
  columnFilters = computed(() => this._columnFilters());

  tableData = computed(() => (this.enableTree ? this._flatData() : this._data()));

  get hasSelection() {
    return this.multiSelect;
  }

  private _expanded = new Set<any>();
  private idOf = (obj: any) => this.valueAt(obj, this.idKey);

  // bump revision to prod a mat-table rerender (safe)
  private _rev = signal(0);
  rev = computed(() => this._rev());

  isStickyStart = (id: string) => !!this._allColumns().find((c) => c.id === id)?.sticky;
  isStickyEnd = (id: string) => !!this._allColumns().find((c) => c.id === id)?.stickyEnd;

  // Theming
  @HostBinding('class.dark-theme') isDark$ = false;
  private store = inject(Store);
  private destroyRef = inject(DestroyRef);

  // i18n
  private translate = inject(TranslateService);
  private dateAdapter = inject(DateAdapter, { optional: true });

  constructor() {
    // Normalize columns + build master order, hidden stays intact
    effect(() => {
      const defs = (this.columns || []).map((c) => {
        const legacy = c.filtrable;
        const filterable =
          typeof c.filtrable === 'boolean'
            ? c.filtrable
            : typeof legacy === 'boolean'
              ? legacy
              : false;
        return {
          ...c,
          filterable,
          sticky: c.sticky && c.stickyEnd ? false : c.sticky,
        } as SmartColumn;
      });
      this._allColumns.set(defs);

      // allowed data columns (exclude 'select'/'tree')
      const allowed = defs
        .filter((c) => (c.visible ?? true) && c.id !== 'select' && c.id !== 'tree')
        .map((c) => c.id);

      // master order reconcile
      const current = this._masterOrder();
      let next: string[];
      if (!current.length) {
        next = [...allowed];
      } else {
        next = [
          ...current.filter((id) => allowed.includes(id)),
          ...allowed.filter((id) => !current.includes(id)),
        ];
      }
      if (next.join('|') !== current.join('|')) {
        this._masterOrder.set(next);
      }

      // cleanup hidden set (drop ids that no longer exist)
      const hidden = new Set(this._hidden());
      let changedHidden = false;
      Array.from(hidden).forEach((id) => {
        if (!allowed.includes(id)) {
          hidden.delete(id);
          changedHidden = true;
        }
      });
      if (changedHidden) this._hidden.set(hidden);

      // bump rev + recompute displayed
      this._rev.update((n) => n + 1);
      this.displayedColumns = this.computeDisplayedColumns();
      this.cdr.markForCheck();
    });

    // Filters
    this.globalFilter.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.refresh());

    this.columnFilterInput.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((val) => {
        const colId = this._activeFilterColumn();
        if (!colId) return;
        const col = this._allColumns().find((x) => x.id === colId);
        if (!col || !this.isFilterable(col)) return;
        const next = { ...this._columnFilters() };
        if (val) next[colId] = val;
        else delete next[colId];
        this._columnFilters.set(next);
        this.refresh();
      });

    // Selection emit
    this.selection.changed.subscribe(() => this.selectionChange.emit(this.selection.selected));
  }

  ngOnInit(): void {
    // theme
    this.store
      .select(AppSelectors.ThemeSelectors.selectIsDark)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isDark) => {
        this.isDark$ = isDark;
        this.cdr.markForCheck();
      });

    // i18n reactivity
    this.setupLangReactivity();
  }

  private setupLangReactivity() {
    if (!this.translate) return;

    // Update UI when ngx-translate language changes (pipes, paginator)
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.dateAdapter?.setLocale?.(this.translate.currentLang);
      this.cdr.markForCheck();
      queueMicrotask(() => this.table?.renderRows?.());
    });

    // Store → TranslateService.use(lang) and optional data refresh
    this.store
      .select(AppSelectors.LangSelectors.selectLang)
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((lang) => {
        if (lang) {
          this.translate.use(lang);
          this.dateAdapter?.setLocale?.(lang);
          if (this.serverSide) this.refresh(); // fetch localized data if API supports it
          queueMicrotask(() => this.table?.renderRows?.());
          this.cdr.markForCheck();
        }
      });
  }

  // Column helpers
  stickyCase(c: SmartColumn): 'start' | 'end' | 'none' {
    if (c.sticky && c.stickyEnd) return 'end';
    if (c.sticky) return 'start';
    if (c.stickyEnd) return 'end';
    return 'none';
  }
  trackCol = (_: number, c: SmartColumn) => c.id;

  menuColumns = computed(() =>
    this.allColumns().filter((c) => c.id !== 'select' && c.id !== 'tree'),
  );

  // Visible columns are masterOrder filtered by hidden set
  visibleColumns = computed(() => {
    const hidden = this._hidden();
    const byId = new Map(this._allColumns().map((c) => [c.id, c] as const));
    return this._masterOrder()
      .filter((id) => !hidden.has(id))
      .map((id) => byId.get(id)!)
      .filter(Boolean) as SmartColumn[];
  });

  // Derived for mat row/headers
  displayedColumns: string[] = [];
  computeDisplayedColumns(): string[] {
    const arr: string[] = [];
    if (this.hasSelection) arr.push('select');
    if (this.enableTree) arr.push('tree');
    arr.push(...this.visibleColumns().map((c) => c.id));
    return arr;
  }

  displayedColumnIds = computed(() => this.computeDisplayedColumns());
  draggableHeaderIds = computed(() =>
    this.visibleColumns()
      .filter((c) => c.draggable !== false)
      .map((c) => c.id),
  );

  dragging = false;
  onHeaderDragStart() {
    this.dragging = true;
  }
  onHeaderDragEnd() {
    this.dragging = false;
  }

  // Lifecycle
  ngAfterViewInit() {
    queueMicrotask(() => this.refresh());
  }

  // Data
  refresh() {
    this._loading.set(true);
    const pageIndex = this._pageIndex();
    const pageSize = this.pageSize;
    const sort = this.sort?.active
      ? ({ active: this.sort.active, direction: this.sort.direction } as Sort)
      : undefined;
    const gf = this.globalFilter.value || '';
    const cf = this.columnFilters();

    const run$ =
      this.serverSide && this.endpoint
        ? this.fetchServer(pageIndex, pageSize, sort, gf, cf)
        : this.fetchClient(pageIndex, pageSize, sort, gf, cf);

    run$
      .pipe(
        catchError((err) => {
          console.error('SmartTable load error', err);
          return of({ data: [], total: 0 });
        }),
        tap(() => this._loading.set(false)),
      )
      .subscribe(({ data, total }) => {
        this._total.set(total);
        this._data.set(data);
        if (this.enableTree) this._flatData.set(this.flattenTree(data, this.childrenKey));
        this._rev.update((n) => n + 1);
      });
  }

  private fetchServer(
    pageIndex: number,
    pageSize: number,
    sort?: Sort,
    globalFilter?: string,
    columnFilters?: Record<string, string>,
  ) {
    const params = this.buildParams({ pageIndex, pageSize, sort, globalFilter, columnFilters });
    return this.http.post<ServerPage>(this.endpoint!, { params }).pipe(
      map((res) => ({
        data: res.data ?? (res as any).items ?? [],
        total: res.total ?? (res as any).count ?? 0,
      })),
    );
  }

  private fetchClient(
    pageIndex: number,
    pageSize: number,
    sort?: Sort,
    globalFilter?: string,
    columnFilters?: Record<string, string>,
  ) {
    const filterableSet = new Set(
      this._allColumns()
        .filter((c) => c.filtrable)
        .map((c) => c.id),
    );
    const all = (this.data ?? []).slice();
    const gf = (globalFilter || '').toLowerCase();
    const cfs = Object.fromEntries(
      Object.entries(columnFilters || {}).filter(([k]) => filterableSet.has(k)),
    );

    const filtered = all.filter((row) => {
      const globalOk = !gf || JSON.stringify(row).toLowerCase().includes(gf);
      const perColOk = Object.entries(cfs).every(([k, v]) =>
        `${this.valueAt(row, k)}`.toLowerCase().includes(v.toLowerCase()),
      );
      return globalOk && perColOk;
    });

    if (sort?.active) {
      const dir = sort.direction === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const av = this.valueAt(a, sort.active);
        const bv = this.valueAt(b, sort.active);
        return av > bv ? dir : av < bv ? -dir : 0;
      });
    }

    const total = filtered.length;
    const start = pageIndex * pageSize;
    const data = filtered.slice(start, start + pageSize);
    return of({ data, total });
  }

  // Tree
  flattenTree(nodes: any[], childrenKey: string) {
    const out: any[] = [];
    const walkChildren = (arr: any[], level: number, parity: 'even' | 'odd') => {
      arr?.forEach((n) => {
        const expandable = !!n?.[childrenKey]?.length;
        out.push({ ...n, level, expandable, __rootParity: parity });
        if (expandable && this._expanded.has(this.idOf(n))) {
          walkChildren(n[childrenKey], level + 1, parity);
        }
      });
    };
    nodes?.forEach((n, idx) => {
      const parity: 'even' | 'odd' = idx % 2 === 0 ? 'even' : 'odd';
      const expandable = !!n?.[childrenKey]?.length;
      out.push({ ...n, level: 0, expandable, __rootParity: parity });
      if (expandable && this._expanded.has(this.idOf(n))) walkChildren(n[childrenKey], 1, parity);
    });
    return out;
  }
  isExpanded = (row: any) => this._expanded.has(this.idOf(row));
  toggleNode(row: any) {
    const id = this.idOf(row);
    if (this._expanded.has(id)) this._expanded.delete(id);
    else this._expanded.add(id);
    this._flatData.set(this.flattenTree(this._data(), this.childrenKey));
    this._rev.update((n) => n + 1);
  }

  isFilterable(c: SmartColumn) {
    if (!c.filtrable) return false;
    if (this.serverSide && !this.columnFilterEnabled) return false;
    return true;
  }
  setActiveFilterColumn(id: string) {
    const col = this._allColumns().find((x) => x.id === id);
    if (!col || !this.isFilterable(col)) return;
    this._activeFilterColumn.set(id);
    this.columnFilterInput.setValue(this.columnFilters()[id] || '');
  }

  // Events
  onSort(_: Sort) {
    this._pageIndex.set(0);
    this.refresh();
  }
  onPage(e: PageEvent) {
    this._pageIndex.set(e.pageIndex);
    this.pageSize = e.pageSize;
    this.refresh();
  }
  onRowClick(row: any) {
    this.rowClick.emit(row);
  }

  // Selection
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.tableData().length;
    return numSelected === numRows && numRows > 0;
  }
  masterToggle() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.tableData().forEach((r) => this.selection.select(r));
  }
  toggleRow(row: any) {
    this.selection.toggle(row);
  }

  // Show/hide columns — position preserved
  toggleColumn(id: string) {
    const hidden = new Set(this._hidden());
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    this._hidden.set(hidden);

    this.displayedColumns = this.computeDisplayedColumns();
    this.bumpRevAndRecalcSticky();
  }
  isVisible(id: string) {
    return !this._hidden().has(id);
  }

  // Reorder via header drag
  dropHeader(event: CdkDragDrop<string[]>) {
    if (!this.enableReorder) return;

    const dragIds = event.container.data as string[];
    const from = event.previousIndex;
    const to = event.currentIndex;
    if (from === to || from < 0 || to < 0 || from >= dragIds.length || to >= dragIds.length) {
      this.dragging = false;
      return;
    }

    const nextDrag = [...dragIds];
    moveItemInArray(nextDrag, from, to);

    const master = [...this._masterOrder()];
    const dragSet = new Set(dragIds);
    let di = 0;
    const nextMaster = master.map((id) => (dragSet.has(id) ? nextDrag[di++] : id));

    this.zone.run(() => {
      this._masterOrder.set(nextMaster);
      this.displayedColumns = this.computeDisplayedColumns();

      this.cdr.detectChanges();
      queueMicrotask(() => {
        try {
          this.table?.renderRows?.();
          (this.table as any).updateStickyColumnStyles?.();
          (this.table as any).updateStickyHeaderRowStyles?.();
          (this.table as any).updateStickyFooterRowStyles?.();
        } catch {}
        this.dragging = false;
        this.cdr.markForCheck();
      });
    });
  }

  private bumpRevAndRecalcSticky() {
    this._rev.update((n) => n + 1);
    queueMicrotask(() => {
      try {
        this.table?.renderRows?.();
        (this.table as any).updateStickyColumnStyles?.();
        (this.table as any).updateStickyHeaderRowStyles?.();
        (this.table as any).updateStickyFooterRowStyles?.();
      } catch {}
      this.cdr.markForCheck();
    });
  }

  // Cell helpers
  cellClass(c: SmartColumn, row: any) {
    const cc = c.cellClass;
    return typeof cc === 'function' ? cc(row) : cc || '';
  }
  resolveValue(c: SmartColumn, row: any) {
    return c.value ? c.value(row) : this.valueAt(row, c.id);
  }
  valueAt(obj: any, path: string) {
    return path.split('.').reduce((v, k) => v?.[k], obj);
  }
  asArray(v: any) {
    return Array.isArray(v) ? v : v == null ? [] : [v];
  }
  toCss(w: any) {
    return typeof w === 'number' ? `${w}px` : w || null;
  }

  buildParams(opts: {
    pageIndex: number;
    pageSize: number;
    sort?: Sort;
    globalFilter?: string;
    columnFilters?: Record<string, string>;
  }) {
    let p = new HttpParams().set('page', opts.pageIndex).set('size', opts.pageSize);
    if (opts.sort?.active) p = p.set('sort', `${opts.sort.active},${opts.sort.direction || 'asc'}`);
    if (opts.globalFilter) p = p.set('q', opts.globalFilter);
    if (opts.columnFilters) {
      Object.entries(opts.columnFilters).forEach(([k, v]) => {
        if (v) p = p.set(`f_${k}`, v);
      });
    }
    // include current lang for server localization (optional)
    const lang = this.translate?.currentLang || this.translate?.getDefaultLang() || 'en';
    p = p.set('lang', lang);
    return p;
  }
}
