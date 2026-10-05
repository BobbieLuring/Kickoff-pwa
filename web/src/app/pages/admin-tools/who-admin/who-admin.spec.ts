import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WhoAdmin } from './who-admin';

describe('WhoAdmin', () => {
  let component: WhoAdmin;
  let fixture: ComponentFixture<WhoAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhoAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(WhoAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
