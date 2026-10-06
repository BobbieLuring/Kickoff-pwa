import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SortList } from './sort-list';

describe('SortList', () => {
  let component: SortList;
  let fixture: ComponentFixture<SortList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SortList],
    }).compileComponents();

    fixture = TestBed.createComponent(SortList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
