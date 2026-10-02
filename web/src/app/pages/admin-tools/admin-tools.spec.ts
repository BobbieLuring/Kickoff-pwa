import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminTools } from './admin-tools';

describe('AdminTools', () => {
  let component: AdminTools;
  let fixture: ComponentFixture<AdminTools>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTools],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTools);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
